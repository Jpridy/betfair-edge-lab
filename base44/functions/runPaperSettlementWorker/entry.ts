import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

const OPEN_STATES = new Set(['OPEN', 'SUSPENDED']);
const ELIGIBLE_SETTLEMENTS = new Set(['pending', 'awaiting_result', 'result_unknown']);
const normalizeMarketId = (value) => String(value ?? '').trim();
const normalizeSelectionId = (value) => String(value ?? '').trim();
const normalizeName = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizeCommission = (value) => { const n = Number(value); if (!Number.isFinite(n) || n < 0) return 0.05; const r = n > 1 ? n / 100 : n; return r <= 0.2 ? r : 0.05; };

async function proxyPost(url, headers, payload) {
  const proxy = Deno.env.get('BETFAIR_PROXY_URL');
  if (!proxy) throw new Error('BETFAIR_PROXY_URL_NOT_SET');
  const response = await fetch(`${proxy}?url=${encodeURIComponent(url)}`, { method: 'POST', headers, body: payload });
  const text = await response.text();
  if (text.trimStart().startsWith('<!DOCTYPE') || text.includes('<html')) throw new Error(`BETFAIR_HTML_RESPONSE_${response.status}`);
  if (!response.ok) throw new Error(`BETFAIR_HTTP_${response.status}:${text.slice(0,200)}`);
  const parsed = JSON.parse(text);
  if (parsed?.faultcode || parsed?.error) throw new Error(`BETFAIR_ERROR:${JSON.stringify(parsed).slice(0,300)}`);
  return parsed;
}

async function login() {
  const appKey = Deno.env.get('BETFAIR_APP_KEY');
  const username = Deno.env.get('BETFAIR_USERNAME');
  const password = Deno.env.get('BETFAIR_PASSWORD');
  if (!appKey || !username || !password) throw new Error('BETFAIR_CREDENTIALS_NOT_SET');
  const headers = { 'X-Application': appKey, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' };
  const loginBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  let result = await proxyPost('https://identitysso-cert.betfair.com/api/certlogin', headers, loginBody);
  let token = result.token || result.sessionToken;
  if ((!token || result.status !== 'SUCCESS') && result.loginStatus === 'CERT_AUTH_REQUIRED') {
    result = await proxyPost('https://identitysso.betfair.com/api/login', headers, loginBody);
    token = result.token || result.sessionToken;
  }
  if (!token || (result.status && result.status !== 'SUCCESS')) throw new Error(`BETFAIR_LOGIN_FAILED:${result.loginStatus || result.error || result.status || 'NO_TOKEN'}`);
  return { appKey, token };
}

async function fetchMarketBooks(marketIds) {
  const { appKey, token } = await login();
  const jurisdiction = Deno.env.get('BETFAIR_JURISDICTION') || 'AU';
  const apiBase = jurisdiction === 'AU' ? 'https://api.betfair.com.au' : 'https://api.betfair.com';
  const headers = { 'X-Application': appKey, 'X-Authentication': token, 'Content-Type': 'application/json', Accept: 'application/json' };
  const books = [];
  for (let i = 0; i < marketIds.length; i += 10) {
    const batch = await proxyPost(`${apiBase}/exchange/betting/rest/v1.0/listMarketBook/`, headers, JSON.stringify({ marketIds: marketIds.slice(i, i + 10), priceProjection: { priceData: ['EX_TRADED'] } }));
    if (!Array.isArray(batch)) throw new Error('BETFAIR_MARKET_BOOK_INVALID_RESPONSE');
    books.push(...batch);
  }
  return books;
}

function grossFor(order, winners) {
  const selectionWon = winners.includes(normalizeSelectionId(order.normalizedSelectionId || order.selectionId));
  const stake = Number(order.matchedStake ?? order.matched_size) || 0;
  const odds = Number(order.matchedOdds ?? order.matched_price) || 0;
  const liability = Number(order.liability) || stake * Math.max(0, odds - 1);
  const betWon = order.side === 'LAY' ? !selectionWon : selectionWon;
  const grossProfit = order.side === 'LAY' ? (selectionWon ? -liability : stake) : (selectionWon ? stake * (odds - 1) : -stake);
  return { order, selectionWon, betWon, grossProfit, liability };
}

function allocateCommission(calculations, rate) {
  const totalGross = calculations.reduce((sum, item) => sum + item.grossProfit, 0);
  const marketCommission = totalGross > 0 ? totalGross * rate : 0;
  const positiveTotal = calculations.reduce((sum, item) => sum + Math.max(0, item.grossProfit), 0);
  let allocated = 0;
  return calculations.map((item, index) => {
    const commission = marketCommission === 0 ? 0 : index === calculations.length - 1 ? marketCommission - allocated : marketCommission * Math.max(0, item.grossProfit) / positiveTotal;
    allocated += commission;
    return { ...item, commission, netProfit: item.grossProfit - commission, marketGrossProfit: totalGross, marketCommission };
  });
}

async function recoverOrderMetadata(base44, order, signals, cycles) {
  let marketId = order.betfairMarketId || order.marketId;
  let commission = order.normalizedCommissionRate;
  if (!marketId || commission == null) {
    const signal = signals.find(item => normalizeSelectionId(item.selectionId) === normalizeSelectionId(order.selectionId) && (!order.marketId || normalizeMarketId(item.marketId || item.betfairMarketId) === normalizeMarketId(order.marketId)));
    marketId ||= signal?.betfairMarketId || signal?.marketId;
    commission ??= signal?.commissionRate;
  }
  if (!marketId) {
    for (const cycle of cycles) {
      const candidate = cycle.bestCandidate || {};
      if (normalizeSelectionId(candidate.selectionId) === normalizeSelectionId(order.selectionId)) { marketId = candidate.betfairMarketId || candidate.marketId; if (marketId) break; }
    }
  }
  return { ...order, betfairMarketId: marketId || null, normalizedMarketId: normalizeMarketId(marketId), normalizedSelectionId: normalizeSelectionId(order.selectionId), raceStartTime: order.raceStartTime || order.marketStartTime, normalizedCommissionRate: normalizeCommission(commission ?? order.commissionRateUsed) };
}

async function fallbackLookup(base44, orders, marketId) {
  const representative = orders[0];
  if ((representative.settlementAttempts || 0) < 3) return null;
  const response = await base44.asServiceRole.functions.invoke('openAIWebSearch', { action:'result_lookup', eventName:representative.eventName || '', marketName:representative.marketName || '', marketStartTime:representative.raceStartTime || representative.marketStartTime || '', runnerName:representative.runnerName || '', selectionId:representative.selectionId || '', marketType:representative.marketType || 'WIN', runners:orders.map(order => ({ selectionId:normalizeSelectionId(order.selectionId), runnerName:order.runnerName || '' })) });
  const lookup = response?.data?.resultLookup || response?.resultLookup;
  if (!lookup || lookup.resultLookupStatus !== 'success' || !lookup.winnerName || !(lookup.sourceUrls || []).length) return null;
  const date = new Date(representative.raceStartTime || representative.marketStartTime || 0);
  if (!representative.venue || !representative.raceNumber || !Number.isFinite(date.getTime())) return null;
  const winnerOrder = orders.find(order => normalizeName(order.runnerName) === normalizeName(lookup.winnerName));
  if (!winnerOrder) return null;
  return { marketId, status:'CLOSED', inplay:false, runners:orders.map(order => ({ selectionId:order.selectionId, status:order.id === winnerOrder.id ? 'WINNER' : 'LOSER' })), fallback:true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const isAuthed = await base44.auth.isAuthenticated();
    if (!isAuthed) return Response.json({ error:'Unauthorized' }, { status:401 });
    const now = new Date();
    const runId = crypto.randomUUID();
    let body = {}; try { body = await req.json(); } catch (_) {}
    const [matched, partial] = await Promise.all([base44.asServiceRole.entities.PaperOrder.filter({ status:'matched' }, '-created_date', 500), base44.asServiceRole.entities.PaperOrder.filter({ status:'partially_matched' }, '-created_date', 500)]);
    const candidates = [...matched, ...partial].filter(order => ELIGIBLE_SETTLEMENTS.has(order.settlementStatus || 'pending') && order.result !== 'won' && order.result !== 'lost' && !order.settledAt && new Date(order.raceStartTime || order.marketStartTime || 0).getTime() < now.getTime() - 120000);
    const needsRecovery = candidates.some(order => !order.betfairMarketId || order.normalizedCommissionRate == null);
    const [signals, cycles] = needsRecovery ? await Promise.all([base44.asServiceRole.entities.StrategySignal.list('-created_date', 500), base44.asServiceRole.entities.BotCycle.list('-created_date', 200)]) : [[], []];
    const orders = [];
    for (const candidate of candidates) orders.push(await recoverOrderMetadata(base44, candidate, signals, cycles));
    const unresolved = [], errorMessages = [];
    const missing = orders.filter(order => !order.normalizedMarketId);
    if (missing.length) await base44.asServiceRole.entities.PaperOrder.bulkUpdate(missing.map(order => ({ id:order.id, settlementStatus:'result_unknown', settlementError:'MISSING_MARKET_ID', settlementAttempts:(order.settlementAttempts || 0)+1, settlementLastCheckedAt:now.toISOString(), settlementWorkerRunId:runId })));
    const valid = orders.filter(order => order.normalizedMarketId);
    const groups = new Map(); for (const order of valid) { if (!groups.has(order.normalizedMarketId)) groups.set(order.normalizedMarketId, []); groups.get(order.normalizedMarketId).push(order); }
    let books = [], fetchError = null;
    if (groups.size) { try { books = await fetchMarketBooks([...groups.keys()]); } catch (error) { fetchError = error.message; errorMessages.push(error.message); } }
    const updates = []; let marketsStillOpen=0, marketsClosed=0, ordersSettled=0, ordersVoided=0;
    for (const [marketId, marketOrders] of groups) {
      let book = books.find(item => normalizeMarketId(item.marketId) === marketId);
      if (!book && fetchError) { try { book = await fallbackLookup(base44, marketOrders, marketId); } catch (error) { errorMessages.push(error.message); } }
      if (!book) { for (const order of marketOrders) { const reason=fetchError || 'BETFAIR_MARKET_RESULT_NOT_AVAILABLE'; unresolved.push({orderId:order.id,runnerName:order.runnerName,marketId,reason}); updates.push({id:order.id,betfairMarketId:order.betfairMarketId,normalizedMarketId:marketId,normalizedSelectionId:order.normalizedSelectionId,raceStartTime:order.raceStartTime,normalizedCommissionRate:order.normalizedCommissionRate,settlementStatus:'awaiting_result',settlementAttempts:(order.settlementAttempts||0)+1,settlementError:reason,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:'UNAVAILABLE'}); } continue; }
      const status=String(book.status || '').toUpperCase();
      if (OPEN_STATES.has(status) || book.inplay) { marketsStillOpen++; for (const order of marketOrders) updates.push({id:order.id,betfairMarketId:order.betfairMarketId,normalizedMarketId:marketId,normalizedSelectionId:order.normalizedSelectionId,raceStartTime:order.raceStartTime,normalizedCommissionRate:order.normalizedCommissionRate,settlementStatus:'awaiting_result',settlementAttempts:(order.settlementAttempts||0)+1,settlementError:null,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:status}); continue; }
      marketsClosed++;
      const runnerResults=(book.runners || []).map(runner => ({selectionId:normalizeSelectionId(runner.selectionId),status:String(runner.status || '').toUpperCase(),adjustmentFactor:runner.adjustmentFactor ?? null}));
      const winners=runnerResults.filter(runner=>runner.status==='WINNER').map(runner=>runner.selectionId);
      const voided=book.voided === true || runnerResults.length > 0 && runnerResults.every(runner=>['REMOVED','VOIDED'].includes(runner.status));
      if (voided) { for (const order of marketOrders) { ordersVoided++; updates.push({id:order.id,status:'voided',settlementStatus:'voided',result:'void',grossProfit:0,commission:0,netProfit:0,netPL:0,voided:true,voidReason:'BETFAIR_MARKET_VOIDED',settledAt:now.toISOString(),settled_date:now.toISOString(),resultSource:'BETFAIR_MARKET_BOOK',resultConfidence:1,settlementAttempts:(order.settlementAttempts||0)+1,settlementError:null,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:status,marketStatusAtSettlement:status,normalizedMarketId:marketId,normalizedSelectionId:order.normalizedSelectionId,raceStartTime:order.raceStartTime,normalizedCommissionRate:order.normalizedCommissionRate}); } continue; }
      if (!winners.length) { for (const order of marketOrders) { const reason='CLOSED_MARKET_WITHOUT_WINNER'; unresolved.push({orderId:order.id,runnerName:order.runnerName,marketId,reason}); updates.push({id:order.id,settlementStatus:'awaiting_result',settlementAttempts:(order.settlementAttempts||0)+1,settlementError:reason,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:status,normalizedMarketId:marketId,normalizedSelectionId:order.normalizedSelectionId,raceStartTime:order.raceStartTime,normalizedCommissionRate:order.normalizedCommissionRate}); } continue; }
      const removedBeforeMatch = marketOrders.filter(order => { const runner=runnerResults.find(item=>item.selectionId===order.normalizedSelectionId); return runner?.status==='REMOVED' && (!order.matched_date || !book.lastMatchTime || new Date(book.lastMatchTime) >= new Date(order.matched_date)); });
      for (const order of removedBeforeMatch) { ordersVoided++; updates.push({id:order.id,status:'voided',settlementStatus:'voided',result:'void',grossProfit:0,commission:0,netProfit:0,netPL:0,voided:true,voidReason:'RUNNER_REMOVED_BEFORE_SIMULATED_MATCH',settledAt:now.toISOString(),settled_date:now.toISOString(),resultSource:'BETFAIR_MARKET_BOOK',resultConfidence:1,winnerSelectionId:winners[0],settlementAttempts:(order.settlementAttempts||0)+1,settlementError:null,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:status,marketStatusAtSettlement:status,normalizedMarketId:marketId,normalizedSelectionId:order.normalizedSelectionId,raceStartTime:order.raceStartTime,normalizedCommissionRate:order.normalizedCommissionRate}); }
      const settleable=marketOrders.filter(order=>!removedBeforeMatch.some(removed=>removed.id===order.id));
      const rate=normalizeCommission(settleable[0]?.normalizedCommissionRate);
      const calculated=allocateCommission(settleable.map(order=>grossFor(order,winners)),rate);
      for (const item of calculated) { ordersSettled++; updates.push({id:item.order.id,status:'settled',settlementStatus:'settled',result:item.betWon?'won':'lost',grossProfit:item.grossProfit,commission:item.commission,netProfit:item.netProfit,netPL:item.netProfit,marketGrossProfit:item.marketGrossProfit,marketCommission:item.marketCommission,commissionRateUsed:rate,normalizedCommissionRate:rate,commissionSource:'BETFAIR_MARKET_LEVEL',settledAt:now.toISOString(),settled_date:now.toISOString(),resultSource:book.fallback?'EXTERNAL_VERIFIED_RESULT':'BETFAIR_MARKET_BOOK',resultConfidence:1,winnerSelectionId:winners[0],winnerSelectionIds:winners,settlementAttempts:(item.order.settlementAttempts||0)+1,settlementError:null,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:status,marketStatusAtSettlement:status,settlementKey:`${marketId}:${item.order.customerRef}`,normalizedMarketId:marketId,normalizedSelectionId:item.order.normalizedSelectionId,raceStartTime:item.order.raceStartTime}); }
    }
    if (updates.length) {
      const ids=updates.map(update=>update.id); const current=await base44.asServiceRole.entities.PaperOrder.filter({id:{$in:ids}},'-created_date',500); const currentById=new Map(current.map(order=>[order.id,order]));
      const safeUpdates=updates.filter(update=>{const existing=currentById.get(update.id);return existing && existing.settlementStatus!=='settled' && !existing.settledAt && !['won','lost'].includes(existing.result);});
      if (safeUpdates.length) await base44.asServiceRole.entities.PaperOrder.bulkUpdate(safeUpdates);
    }
    return Response.json({ runId, trigger:body.trigger || 'manual', checkedAt:now.toISOString(), ordersChecked:candidates.length, marketsChecked:groups.size, marketsStillOpen, marketsClosed, ordersSettled, ordersVoided, ordersUnresolved:unresolved.length + missing.length, errors:errorMessages.length, unresolved:[...missing.map(order=>({orderId:order.id,runnerName:order.runnerName,reason:'MISSING_MARKET_ID'})),...unresolved], errorMessages });
  } catch (error) { console.error(error); return Response.json({ error:error.message, checkedAt:new Date().toISOString() }, { status:500 }); }
});