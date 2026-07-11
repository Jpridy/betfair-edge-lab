import { createClientFromRequest } from 'npm:@base44/sdk@0.8.37';

const ORDER_STATES = new Set(['matched', 'partially_matched', 'awaiting_result']);
const SETTLEMENT_STATES = new Set(['pending', 'awaiting_result', 'result_unknown']);
const OPEN_MARKETS = new Set(['OPEN', 'SUSPENDED']);
const RETRY_COUNT = 3;
const MAX_RESULT_DELAY_MS = 30 * 60 * 1000;
const cleanId = value => String(value ?? '').trim();
const cleanName = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizeOrderStatus = value => ({ partial_match:'partially_matched', partiallymatched:'partially_matched', result_pending:'awaiting_result' }[cleanName(value).replaceAll(' ','_')] || cleanName(value).replaceAll(' ','_'));
const normalizeSettlementStatus = value => ({ resultpending:'awaiting_result', unknown:'result_unknown', pending_result:'awaiting_result' }[cleanName(value).replaceAll(' ','_')] || cleanName(value).replaceAll(' ','_') || 'pending');
const credentialStatus = () => ({ credentialSource:'backend_environment', appKeyConfigured:!!Deno.env.get('BETFAIR_APP_KEY'), usernameConfigured:!!Deno.env.get('BETFAIR_USERNAME'), passwordConfigured:!!Deno.env.get('BETFAIR_PASSWORD') });
const errorResponse = (code, message, status, extra={}) => Response.json({ error:code, errorCode:code, errorMessage:message, checkedAt:new Date().toISOString(), ...extra }, { status });

async function proxyPost(url, headers, payload) {
  const proxy = Deno.env.get('BETFAIR_PROXY_URL');
  if (!proxy) throw new Error('BETFAIR_LOGIN_FAILED:BETFAIR_PROXY_URL_NOT_SET');
  const response = await fetch(`${proxy}?url=${encodeURIComponent(url)}`, { method:'POST', headers, body:payload });
  const text = await response.text();
  if (!response.ok || text.trimStart().startsWith('<!DOCTYPE') || text.includes('<html')) throw new Error(`BETFAIR_HTTP_${response.status}`);
  const parsed = JSON.parse(text);
  if (parsed?.faultcode || parsed?.error) throw new Error(`BETFAIR_ERROR:${JSON.stringify(parsed).slice(0,200)}`);
  return parsed;
}

async function login() {
  const appKey=Deno.env.get('BETFAIR_APP_KEY'), username=Deno.env.get('BETFAIR_USERNAME'), password=Deno.env.get('BETFAIR_PASSWORD');
  if (!appKey || !username || !password) throw new Error('BETFAIR_CREDENTIALS_NOT_SET');
  const createdAt = new Date();
  const headers={'X-Application':appKey,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json'};
  const body=`username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
  let result=await proxyPost('https://identitysso-cert.betfair.com/api/certlogin',headers,body);
  let token=result.token || result.sessionToken;
  if ((!token || result.status !== 'SUCCESS') && result.loginStatus === 'CERT_AUTH_REQUIRED') { result=await proxyPost('https://identitysso.betfair.com/api/login',headers,body); token=result.token || result.sessionToken; }
  if (!token || (result.status && result.status !== 'SUCCESS')) throw new Error(`BETFAIR_LOGIN_FAILED:${result.loginStatus || result.error || result.status || 'NO_TOKEN'}`);
  return { appKey, token, createdAt:createdAt.toISOString(), expiresAt:new Date(createdAt.getTime()+12*60*60*1000).toISOString() };
}

async function fetchBooks(marketIds, session) {
  const jurisdiction=Deno.env.get('BETFAIR_JURISDICTION') || 'AU';
  const base=jurisdiction==='AU'?'https://api.betfair.com.au':'https://api.betfair.com';
  const headers={'X-Application':session.appKey,'X-Authentication':session.token,'Content-Type':'application/json',Accept:'application/json'};
  const books=[];
  for (let i=0;i<marketIds.length;i+=10) {
    const batch=await proxyPost(`${base}/exchange/betting/rest/v1.0/listMarketBook/`,headers,JSON.stringify({marketIds:marketIds.slice(i,i+10),priceProjection:{priceData:['EX_TRADED']}}));
    if (!Array.isArray(batch)) throw new Error('MARKET_BOOK_EMPTY');
    books.push(...batch);
  }
  return books;
}

function strictCommission(value) {
  const raw=Number(value);
  if (!Number.isFinite(raw) || raw<0) throw new Error('INVALID_COMMISSION');
  const rate=raw>1?raw/100:raw;
  if (rate>0.2) throw new Error('INVALID_COMMISSION');
  return rate;
}

function calculate(order,winners) {
  const wonSelection=winners.includes(cleanId(order.normalizedSelectionId || order.selectionId));
  const stake=Number(order.matchedStake ?? order.matched_size) || 0;
  const odds=Number(order.matchedOdds ?? order.matched_price) || 0;
  const liability=Number(order.liability) || stake*Math.max(0,odds-1);
  const betWon=order.side==='LAY'?!wonSelection:wonSelection;
  const grossProfit=order.side==='LAY'?(wonSelection?-liability:stake):(wonSelection?stake*(odds-1):-stake);
  return { order, betWon, grossProfit };
}

async function fallbackLookup(base44, orders, marketId) {
  const order=orders[0];
  const response=await base44.asServiceRole.functions.invoke('openAIWebSearch',{action:'result_lookup',eventName:order.eventName||'',marketName:order.marketName||'',marketStartTime:order.raceStartTime||order.marketStartTime||'',runnerName:order.runnerName||'',selectionId:order.selectionId||'',marketType:order.marketType||'WIN',runners:orders.map(item=>({selectionId:cleanId(item.selectionId),runnerName:item.runnerName||''}))});
  const lookup=response?.data?.resultLookup || response?.resultLookup;
  if (!lookup || lookup.resultLookupStatus!=='success' || !lookup.winnerName || !(lookup.sourceUrls||[]).length) return null;
  const winner=orders.find(item=>cleanName(item.runnerName)===cleanName(lookup.winnerName));
  if (!winner) return null;
  return {marketId,status:'CLOSED',inplay:false,fallback:true,runners:orders.map(item=>({selectionId:item.selectionId,status:item.id===winner.id?'WINNER':'LOSER'}))};
}

Deno.serve(async req => {
  const base44=createClientFromRequest(req);
  let body={}; try { body=await req.json(); } catch (_) {}
  const internalRequested=body.trigger==='scheduled' || body.trigger==='workflow';
  const workflowHeaderIdentity=!!(req.headers.get('x-base44-workflow-run-id') || req.headers.get('x-base44-workflow-id') || req.headers.get('x-base44-internal-invocation'));
  let user=null; try { user=await base44.auth.me(); } catch (_) {}
  let authenticated=false; try { authenticated=await base44.auth.isAuthenticated(); } catch (_) {}
  const workflowIdentity=workflowHeaderIdentity || (authenticated && !user);
  if (internalRequested && !workflowIdentity) return errorResponse('INVALID_INTERNAL_WORKFLOW_TOKEN','Scheduled invocation did not include a valid Base44 service identity',401);
  if (!internalRequested && !user) return errorResponse('UNAUTHORIZED_MANUAL_REQUEST','Manual settlement requires an authenticated user',401);
  if (body.action === 'credential_status') {
    const latest = await base44.asServiceRole.entities.SettlementWorkerRun.list('-created_date', 1);
    const previous = latest?.[0] || {};
    return Response.json({ ...credentialStatus(), lastLoginStatus:previous.lastLoginStatus || 'not_attempted', lastLoginError:previous.lastLoginError || null, currentSessionCreatedAt:previous.currentSessionCreatedAt || null, currentSessionExpiresAt:previous.currentSessionExpiresAt || null });
  }

  const now=new Date(), runId=crypto.randomUUID(), creds=credentialStatus();
  const triggerMode=internalRequested?'internal':'manual';
  let runRecord=null;
  try { runRecord=await base44.asServiceRole.entities.SettlementWorkerRun.create({runId,triggerMode,requestingUserId:user?.id||null,startedAt:now.toISOString(),status:'running',...creds,lastLoginStatus:'not_attempted',ordersChecked:0,marketsChecked:0,ordersSettled:0,ordersVoided:0,ordersUnresolved:0}); } catch (error) { return errorResponse('DATABASE_UPDATE_FAILED',error.message,500,{runId,...creds}); }
  const finish=async payload=>{ try { await base44.asServiceRole.entities.SettlementWorkerRun.update(runRecord.id,{completedAt:new Date().toISOString(),status:payload.errorCode?'failed':'completed',errorCode:payload.errorCode||null,errorMessage:payload.errorMessage||null,lastLoginStatus:payload.lastLoginStatus||'not_attempted',lastLoginError:payload.lastLoginError||null,currentSessionCreatedAt:payload.currentSessionCreatedAt||null,currentSessionExpiresAt:payload.currentSessionExpiresAt||null,ordersChecked:payload.ordersChecked||0,marketsChecked:payload.marketsChecked||0,ordersSettled:payload.ordersSettled||0,ordersVoided:payload.ordersVoided||0,ordersUnresolved:payload.ordersUnresolved||0,details:payload}); } catch (_) {} return payload; };

  try {
    if (!creds.appKeyConfigured || !creds.usernameConfigured || !creds.passwordConfigured) { const payload=await finish({runId,trigger:triggerMode,checkedAt:now.toISOString(),...creds,errorCode:'BETFAIR_CREDENTIALS_NOT_SET',errorMessage:'One or more required Betfair credentials are not configured',lastLoginStatus:'not_attempted'}); return errorResponse(payload.errorCode,payload.errorMessage,500,payload); }
    let session;
    try { session=await login(); } catch (error) { const code=error.message.startsWith('BETFAIR_CREDENTIALS_NOT_SET')?'BETFAIR_CREDENTIALS_NOT_SET':'BETFAIR_LOGIN_FAILED'; const payload=await finish({runId,trigger:triggerMode,checkedAt:now.toISOString(),...creds,errorCode:code,errorMessage:error.message,lastLoginStatus:'failed',lastLoginError:error.message}); return errorResponse(code,error.message,500,payload); }

    const all=await base44.asServiceRole.entities.PaperOrder.filter({},'-created_date',500);
    const candidates=all.filter(order=>ORDER_STATES.has(normalizeOrderStatus(order.status)) && SETTLEMENT_STATES.has(normalizeSettlementStatus(order.settlementStatus)) && !order.settledAt && !['won','lost','void'].includes(order.result));
    const groups=new Map();
    for (const order of candidates) { const marketId=cleanId(order.normalizedMarketId || order.betfairMarketId || order.marketId); if (!marketId) continue; const normalized={...order,normalizedMarketId:marketId,normalizedSelectionId:cleanId(order.normalizedSelectionId||order.selectionId)}; if (!groups.has(marketId)) groups.set(marketId,[]); groups.get(marketId).push(normalized); }
    const marketIds=[...groups.keys()];
    let books=[], lastFetchError=null;
    for (let attempt=1;attempt<=RETRY_COUNT;attempt++) { try { books=await fetchBooks(marketIds,session); lastFetchError=books.length?'': 'MARKET_BOOK_EMPTY'; if (books.length) break; } catch (error) { lastFetchError=error.message; } }

    const updates=[], unresolved=[], lookups=[]; let ordersSettled=0,ordersVoided=0,marketsStillOpen=0,marketsClosed=0;
    for (const [marketId,orders] of groups) {
      let book=books.find(item=>cleanId(item.marketId)===marketId);
      const noRunnerResults=book && (!Array.isArray(book.runners) || book.runners.length===0);
      const beyondDelay=orders.some(order=>now.getTime()-new Date(order.raceStartTime||order.marketStartTime||now).getTime()>MAX_RESULT_DELAY_MS);
      const retriesExhausted=orders.some(order=>(order.settlementAttempts||0)+1>=RETRY_COUNT);
      if (!book || noRunnerResults || (book && OPEN_MARKETS.has(String(book.status||'').toUpperCase()) && beyondDelay)) {
        if (retriesExhausted || beyondDelay) { try { book=await fallbackLookup(base44,orders,marketId); } catch (error) { lastFetchError=error.message; } }
      }
      if (!book || !Array.isArray(book.runners) || book.runners.length===0) { const reason=!books.length?'MARKET_BOOK_EMPTY':'MARKET_RESULT_NOT_AVAILABLE'; for (const order of orders) { unresolved.push({orderId:order.id,runnerName:order.runnerName,marketId,reason}); updates.push({id:order.id,status:'awaiting_result',settlementStatus:'result_unknown',settlementAttempts:(order.settlementAttempts||0)+1,settlementError:reason,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:'UNAVAILABLE'}); } continue; }
      const status=String(book.status||'').toUpperCase();
      const runnerResults=book.runners.map(item=>({selectionId:cleanId(item.selectionId),status:String(item.status||'').toUpperCase()}));
      const winners=runnerResults.filter(item=>item.status==='WINNER').map(item=>item.selectionId);
      lookups.push({marketId,status,winnerSelectionIds:winners,runnerResults});
      if (OPEN_MARKETS.has(status)) { marketsStillOpen++; for (const order of orders) { unresolved.push({orderId:order.id,runnerName:order.runnerName,marketId,reason:'MARKET_RESULT_NOT_AVAILABLE'}); updates.push({id:order.id,status:'awaiting_result',settlementStatus:'awaiting_result',settlementAttempts:(order.settlementAttempts||0)+1,settlementError:'MARKET_RESULT_NOT_AVAILABLE',settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:status}); } continue; }
      marketsClosed++;
      const voided=book.voided===true || runnerResults.every(item=>['REMOVED','VOIDED'].includes(item.status));
      if (voided) { for (const order of orders) { ordersVoided++; updates.push({id:order.id,status:'voided',settlementStatus:'voided',result:'void',grossProfit:0,commission:0,netProfit:0,netPL:0,voided:true,voidReason:'BETFAIR_MARKET_VOIDED',settledAt:now.toISOString(),settled_date:now.toISOString(),resultSource:'BETFAIR_MARKET_BOOK',resultConfidence:1,settlementAttempts:(order.settlementAttempts||0)+1,settlementError:null,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtSettlement:status}); } continue; }
      if (!winners.length) { for (const order of orders) { unresolved.push({orderId:order.id,runnerName:order.runnerName,marketId,reason:'MARKET_RESULT_NOT_AVAILABLE'}); updates.push({id:order.id,status:'awaiting_result',settlementStatus:'result_unknown',settlementAttempts:(order.settlementAttempts||0)+1,settlementError:'MARKET_RESULT_NOT_AVAILABLE',settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtLastCheck:status}); } continue; }
      const rate=strictCommission(orders[0].normalizedCommissionRate ?? orders[0].commissionRateUsed);
      const calculations=orders.map(order=>calculate(order,winners));
      const marketGross=calculations.reduce((sum,item)=>sum+item.grossProfit,0), marketCommission=marketGross>0?marketGross*rate:0, positiveTotal=calculations.reduce((sum,item)=>sum+Math.max(0,item.grossProfit),0);
      for (const item of calculations) { const commission=item.grossProfit>0&&positiveTotal>0?marketCommission*item.grossProfit/positiveTotal:0; ordersSettled++; updates.push({id:item.order.id,status:'settled',settlementStatus:'settled',result:item.betWon?'won':'lost',grossProfit:item.grossProfit,commission,netProfit:item.grossProfit-commission,netPL:item.grossProfit-commission,marketGrossProfit:marketGross,marketCommission,commissionRateUsed:rate,normalizedCommissionRate:rate,settledAt:now.toISOString(),settled_date:now.toISOString(),resultSource:book.fallback?'EXTERNAL_VERIFIED_RESULT':'BETFAIR_MARKET_BOOK',resultConfidence:1,winnerSelectionId:winners[0],winnerSelectionIds:winners,settlementAttempts:(item.order.settlementAttempts||0)+1,settlementError:null,settlementLastCheckedAt:now.toISOString(),settlementWorkerRunId:runId,marketStatusAtSettlement:status}); }
    }
    try { if (updates.length) await base44.asServiceRole.entities.PaperOrder.bulkUpdate(updates); } catch (error) { const payload=await finish({runId,...creds,errorCode:'DATABASE_UPDATE_FAILED',errorMessage:error.message,lastLoginStatus:'success',currentSessionCreatedAt:session.createdAt,currentSessionExpiresAt:session.expiresAt,ordersChecked:candidates.length,marketsChecked:groups.size,ordersSettled,ordersVoided,ordersUnresolved:unresolved.length}); return errorResponse('DATABASE_UPDATE_FAILED',error.message,500,payload); }
    const result=await finish({runId,trigger:triggerMode,requestingUserId:user?.id||null,checkedAt:now.toISOString(),...creds,lastLoginStatus:'success',lastLoginError:null,currentSessionCreatedAt:session.createdAt,currentSessionExpiresAt:session.expiresAt,ordersChecked:candidates.length,marketsChecked:groups.size,marketsStillOpen,marketsClosed,ordersSettled,ordersVoided,ordersUnresolved:unresolved.length,errors:unresolved.length?1:0,errorCode:unresolved.length?(lastFetchError==='MARKET_BOOK_EMPTY'?'MARKET_BOOK_EMPTY':'MARKET_RESULT_NOT_AVAILABLE'):null,errorMessage:unresolved.length?(lastFetchError||'One or more market results are not yet available'):null,marketLookups:lookups,unresolved});
    return Response.json(result);
  } catch (error) { const code=['BETFAIR_CREDENTIALS_NOT_SET','BETFAIR_LOGIN_FAILED','MARKET_BOOK_EMPTY','MARKET_RESULT_NOT_AVAILABLE','DATABASE_UPDATE_FAILED'].find(item=>error.message.startsWith(item)) || 'DATABASE_UPDATE_FAILED'; const payload=await finish({runId,...creds,errorCode:code,errorMessage:error.message,lastLoginStatus:code==='BETFAIR_LOGIN_FAILED'?'failed':'not_attempted',lastLoginError:code==='BETFAIR_LOGIN_FAILED'?error.message:null}); return errorResponse(code,error.message,500,payload); }
});