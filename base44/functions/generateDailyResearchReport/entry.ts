import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
Deno.serve(async req => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error:'Unauthorized' }, { status:401 });
    if (user.role !== 'admin' && !String(user.id ?? '').startsWith('service_')) return Response.json({ error:'Forbidden' }, { status:403 });
    const [orders,profiles,reliability,previousReports,botRows,snapshots,candidates,outcomes,holdouts]=await Promise.all([
      base44.asServiceRole.entities.PaperOrder.filter({status:'settled'},'-settled_date',1000),
      base44.asServiceRole.entities.CalibrationProfile.list('-created_date',50),
      base44.asServiceRole.entities.ReliabilityEvent.filter({resolved:false},'-timestamp',200),
      base44.asServiceRole.entities.ResearchDailyReport.list('-generatedAt',1),
      base44.asServiceRole.entities.BotSettings.list('-created_date',1),
      base44.asServiceRole.entities.MarketEventSnapshot.list('-timestamp',5000),
      base44.asServiceRole.entities.CounterfactualCandidate.list('-decisionTimestamp',1000),
      base44.asServiceRole.entities.CandidateOutcomeEvent.list('-observedAt',1000),
      base44.asServiceRole.entities.HoldoutVault.filter({locked:true,consumed:false},'-createdAt',20),
    ]);
    const eligible = orders.filter(order => order.settlementStatus === 'settled' && ['won','lost','void'].includes(order.result) && !order.proofMode && !order.excludeFromPerformance && !order.invalidTestRecord);
    for(const holdout of holdouts){const start=new Date(holdout.startDate).getTime(),end=new Date(holdout.endDate).getTime(),orderIds=eligible.filter(order=>{const settled=new Date(order.settledAt??order.settled_date??order.created_date).getTime();return settled>=start&&settled<=end;}).map(order=>order.id);if(JSON.stringify(orderIds)!==JSON.stringify(holdout.orderIds||[]))await base44.asServiceRole.entities.HoldoutVault.update(holdout.id,{orderIds,integrityHash:`locked-${holdout.holdoutId}-${orderIds.join('|')}`});}
    const recent = eligible.slice(0, 50), netPL = eligible.reduce((sum, order) => sum + number(order.netProfit), 0);
    const wins = eligible.filter(order => order.result === 'won').length, strikeRate = eligible.length ? wins / eligible.length : 0;
    const breakevenStrikeRate = eligible.length ? eligible.reduce((sum, order) => sum + number(order.breakevenProbability ?? order.calculationResult?.breakevenProbability), 0) / eligible.length : 0;
    const clvUpdates=[];
    for(const order of eligible){const start=new Date(order.marketStartTime??order.raceStartTime??0).getTime(),marketId=String(order.normalizedMarketId??order.betfairMarketId??order.marketId??''),selectionId=String(order.normalizedSelectionId??order.selectionId??'');if(!Number.isFinite(start)||!marketId||!selectionId)continue;const pre=snapshots.filter(event=>String(event.marketId)===marketId&&String(event.selectionId)===selectionId&&!event.inPlay&&new Date(event.timestamp).getTime()<start&&event.dataFreshness==='LIVE').sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp)),close=pre.find(event=>new Date(event.timestamp).getTime()<=start-5000)??pre[0],closingOdds=order.side==='BACK'?number(close?.bestBackPrice):number(close?.bestLayPrice),entryOdds=number(order.matchedOdds??order.matched_price??order.requestedOdds);if(!(closingOdds>1&&entryOdds>1))continue;const entryProbability=1/entryOdds,closingProbability=1/closingOdds,clv=order.side==='BACK'?closingProbability-entryProbability:entryProbability-closingProbability;clvUpdates.push({id:order.id,closingOdds,clv,simulatedCLV:clv});order.clv=clv;}
    if(clvUpdates.length)await base44.asServiceRole.entities.PaperOrder.bulkUpdate(clvUpdates);
    const existingOutcomeIds=new Set(outcomes.map(outcome=>outcome.candidateId)),outcomeRows=[];
    for(const candidate of candidates){if(existingOutcomeIds.has(candidate.candidateId))continue;const start=new Date(candidate.marketStartTime??0).getTime(),entered=new Date(candidate.decisionTimestamp).getTime();if(!(Number.isFinite(start)&&start<Date.now()&&Number.isFinite(entered)))continue;const future=snapshots.filter(event=>String(event.marketId)===String(candidate.marketId)&&String(event.selectionId)===String(candidate.selectionId)&&!event.inPlay&&new Date(event.timestamp).getTime()>entered&&new Date(event.timestamp).getTime()<start).sort((a,b)=>new Date(a.timestamp)-new Date(b.timestamp));if(!future.length)continue;const entryOdds=number(candidate.odds),price=event=>number(candidate.side==='BACK'?event.bestBackPrice:event.bestLayPrice),movement=event=>{if(!event)return null;const next=price(event);return candidate.side==='BACK'?entryOdds-next:next-entryOdds;},at=seconds=>future.find(event=>new Date(event.timestamp).getTime()>=entered+seconds*1000),close=[...future].reverse().find(event=>new Date(event.timestamp).getTime()<=start-5000)??future.at(-1),moves=[movement(at(5)),movement(at(15)),movement(at(30)),movement(close)].filter(value=>value!=null),matchingOrder=eligible.find(order=>String(order.normalizedMarketId??order.betfairMarketId??order.marketId)===String(candidate.marketId)&&String(order.normalizedSelectionId??order.selectionId)===String(candidate.selectionId)),eventualResult=matchingOrder?(matchingOrder.side===candidate.side?matchingOrder.result:matchingOrder.result==='won'?'lost':matchingOrder.result==='lost'?'won':matchingOrder.result):null,capital=number(candidate.hypotheticalCapitalAtRisk),commission=number(matchingOrder?.normalizedCommissionRate??matchingOrder?.commissionRateUsed),hypotheticalNetPL=eventualResult==='won'?(candidate.side==='BACK'?(entryOdds-1)*capital*(1-commission):capital*(1-commission)):eventualResult==='lost'?-capital:null,closingOdds=price(close),entryProbability=entryOdds>1?1/entryOdds:null,closingProbability=closingOdds>1?1/closingOdds:null,clv=entryProbability!=null&&closingProbability!=null?(candidate.side==='BACK'?closingProbability-entryProbability:entryProbability-closingProbability):null;outcomeRows.push({outcomeId:crypto.randomUUID(),candidateId:candidate.candidateId,observedAt:new Date().toISOString(),eventualResult,hypotheticalNetPL,hypotheticalCapitalAtRisk:capital,closingOdds,clv,movement5Seconds:movement(at(5)),movement15Seconds:movement(at(15)),movement30Seconds:movement(at(30)),movementToClose:movement(close),immediateAdverseMovementRate:moves.length?moves.filter(value=>value>0).length/moves.length:null,averageAdverseTicks:moves.length?moves.reduce((a,b)=>a+b,0)/moves.length:null,adverseSelectionCost:moves.length?Math.max(0,moves.reduce((a,b)=>a+b,0)/moves.length)*capital:0,futureSnapshotsUsed:future.length,integrityPassed:future.every(event=>new Date(event.timestamp).getTime()>entered&&new Date(event.timestamp).getTime()<start)});}
    if(outcomeRows.length)await base44.asServiceRole.entities.CandidateOutcomeEvent.bulkCreate(outcomeRows.slice(0,500));
    const clvRows=eligible.filter(order=>Number.isFinite(Number(order.clv??order.simulatedCLV))),averageCLV=clvRows.length?clvRows.reduce((sum,order)=>sum+number(order.clv??order.simulatedCLV),0)/clvRows.length:null;
    const recentExpectancy = recent.length ? recent.reduce((sum, order) => sum + number(order.netProfit), 0) / recent.length : null;
    const critical = reliability.filter(event => event.severity === 'critical'), warnings = reliability.filter(event => event.severity === 'warning');
    const errorBudget = { critical:critical.length, warning:warnings.length, breached:critical.length > 0 || warnings.length > 10 };
    const driftAlerts = [];
    if (recent.length >= 50 && recentExpectancy < 0) driftAlerts.push({ severity:'ROLLBACK', metric:'expectancy', value:recentExpectancy });
    if (clvRows.length >= 50 && averageCLV < 0) driftAlerts.push({ severity:'PAUSE_PROFILE', metric:'CLV', value:averageCLV });
    if (errorBudget.breached) driftAlerts.push({ severity:'PAUSE_PROFILE', metric:'reliability', value:errorBudget });
    const champion = profiles.find(profile => profile.status === 'CHAMPION'), retirement = driftAlerts.some(alert => ['ROLLBACK','PAUSE_PROFILE'].includes(alert.severity));
    if (champion && retirement) await base44.asServiceRole.entities.CalibrationProfile.update(champion.id, { status:'RETIRED', retiredAt:new Date().toISOString(), deactivatedAt:new Date().toISOString(), retirementReason:driftAlerts.map(alert => alert.metric).join(',') });
    if (retirement || errorBudget.breached) {
      const bot = botRows[0];
      if (bot) await base44.asServiceRole.entities.BotSettings.update(bot.id, { botEnabled:false, autoPaperTradingEnabled:false, liveTradingEnabled:false, liveTradingLocked:true });
    }
    const previousAt = previousReports[0]?.generatedAt ? new Date(previousReports[0].generatedAt) : null;
    const newSettledBets = previousAt ? eligible.filter(order => new Date(order.settledAt ?? order.settled_date ?? order.created_date) > previousAt).length : eligible.length;
    const noTradeWins = recentExpectancy != null && recentExpectancy <= 0;
    const evidenceDirection = eligible.length < 100 ? 'INSUFFICIENT_EVIDENCE' : noTradeWins || driftAlerts.length ? 'WEAKENED' : 'STABLE_PENDING_MORE_EVIDENCE';
    const generatedAt = new Date().toISOString();
    const plainLanguageReport = `Paper-only research report. ${newSettledBets} new settled bets. Net P/L is $${netPL.toFixed(2)}. Strike rate is ${(strikeRate*100).toFixed(1)}% versus ${(breakevenStrikeRate*100).toFixed(1)}% breakeven. Average CLV is ${averageCLV == null ? 'not yet available' : averageCLV.toFixed(4)}. Evidence status: ${evidenceDirection}. ${noTradeWins ? 'No-trade currently outperforms the recent strategy sample.' : 'No profit claim is made; uncertainty remains.'}`;
    const report = await base44.asServiceRole.entities.ResearchDailyReport.create({ reportDate:generatedAt.slice(0,10), generatedAt, newSettledBets, netPL, averageCLV, strikeRate, breakevenStrikeRate, championHealth:champion?.shadowMetrics ?? {}, challengerResults:profiles.filter(profile => profile.status === 'CHALLENGER').map(profile => ({ profileId:profile.profileId, metrics:profile.shadowMetrics })), driftAlerts, errorBudget, noTradeBenchmark:{ wins:noTradeWins, expectancy:0 }, parameterChanges:[], evidenceDirection, plainLanguageReport, paperOnly:true, profitGuaranteed:false });
    return Response.json({ status:'completed', reportId:report.id, retiredChampion:retirement && !!champion, pausedPaperOrders:retirement || errorBudget.breached, evidenceDirection });
  } catch (error) {
    return Response.json({ error:error.message }, { status:500 });
  }
});