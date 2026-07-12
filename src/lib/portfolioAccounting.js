import { isActiveExposureOrder, orderExposure } from './riskExposure';

const round=value=>Math.round((value+Number.EPSILON)*100)/100;
const numberOrNull=value=>value==null||!Number.isFinite(Number(value))?null:Number(value);
const isExcluded=order=>order?.proofMode===true||order?.excludeFromPerformance===true||order?.invalidTestRecord===true;

export function calculatePortfolioAccounting(orders=[],startingBankroll=0){
  const included=(orders||[]).filter(order=>!isExcluded(order));
  const reconciliationErrors=[];
  const inconsistentOrders=included.filter(order=>['won','lost'].includes(order.result)&&(order.status!=='settled'||order.settlementStatus!=='settled'));
  if(inconsistentOrders.length)reconciliationErrors.push(`RESULT_STATE_MISMATCH:${inconsistentOrders.map(order=>order.id||order.runnerName||'unknown').join(',')}`);
  const settled=included.filter(order=>(order.status==='settled'&&order.settlementStatus==='settled'&&['won','lost'].includes(order.result))||(['void','voided'].includes(order.result)&&['voided','settled'].includes(order.status)&&['voided','settled'].includes(order.settlementStatus)));
  let grossWinnings=0,grossLosses=0,commissionPaid=0,totalSettledCapitalAtRisk=0,wonOrderCount=0,lostOrderCount=0,voidOrderCount=0;
  for(const order of settled){
    const gross=numberOrNull(order.grossProfit),commission=numberOrNull(order.commission),net=numberOrNull(order.netProfit);
    if(gross==null||commission==null||net==null){reconciliationErrors.push(`MISSING_SETTLEMENT_MONEY:${order.id||order.runnerName||'unknown'}`);continue;}
    if(order.result==='won'){wonOrderCount++;if(gross>0)grossWinnings+=gross;else if(gross<0)reconciliationErrors.push(`WINNING_ORDER_NEGATIVE_GROSS:${order.id||order.runnerName||'unknown'}`);}
    else if(order.result==='lost'){lostOrderCount++;if(gross<0)grossLosses+=gross;else if(gross>0)reconciliationErrors.push(`LOSING_ORDER_POSITIVE_GROSS:${order.id||order.runnerName||'unknown'}`);if(commission!==0)reconciliationErrors.push(`LOSING_ORDER_COMMISSION:${order.id||order.runnerName||'unknown'}`);}
    else voidOrderCount++;
    if(Math.abs((gross-commission)-net)>.005)reconciliationErrors.push(`ORDER_NET_MISMATCH:${order.id||order.runnerName||'unknown'}`);
    const stake=numberOrNull(order.matchedStake??order.matched_size)??0;
    const odds=numberOrNull(order.matchedOdds??order.matched_price)??0;
    totalSettledCapitalAtRisk+=order.side==='LAY'?(numberOrNull(order.matchedCalculation?.liability)??stake*Math.max(0,odds-1)):stake;
    commissionPaid+=commission;
  }
  grossWinnings=round(grossWinnings);grossLosses=round(grossLosses);commissionPaid=round(commissionPaid);
  const absoluteGrossLosses=round(Math.abs(grossLosses));
  const grossRealisedPL=round(grossWinnings+grossLosses);
  const netRealisedPL=round(grossRealisedPL-commissionPaid);
  const bankroll=round(Number(startingBankroll));
  const currentEquity=round(bankroll+netRealisedPL);
  let matchedBackExposure=0,matchedLayLiability=0,unmatchedReservedExposure=0,pendingPotentialProfit=0;
  const active=included.filter(isActiveExposureOrder);
  for(const order of active){const exposure=orderExposure(order);if(order.side==='LAY')matchedLayLiability+=exposure.matchedExposure;else matchedBackExposure+=exposure.matchedExposure;unmatchedReservedExposure+=exposure.unmatchedReservedExposure;const stake=numberOrNull(order.matchedStake??order.matched_size)??0,odds=numberOrNull(order.matchedOdds??order.requestedOdds)??0;pendingPotentialProfit+=order.side==='LAY'?stake:stake*Math.max(0,odds-1);}
  matchedBackExposure=round(matchedBackExposure);matchedLayLiability=round(matchedLayLiability);unmatchedReservedExposure=round(unmatchedReservedExposure);
  const totalOpenExposure=round(matchedBackExposure+matchedLayLiability+unmatchedReservedExposure);
  const availableBankroll=round(currentEquity-totalOpenExposure);
  if(round(grossWinnings+grossLosses)!==grossRealisedPL)reconciliationErrors.push('GROSS_PL_RECONCILIATION_FAILED');
  if(round(grossRealisedPL-commissionPaid)!==netRealisedPL)reconciliationErrors.push('NET_PL_RECONCILIATION_FAILED');
  if(round(bankroll+netRealisedPL)!==currentEquity)reconciliationErrors.push('EQUITY_RECONCILIATION_FAILED');
  const profitFactor=absoluteGrossLosses>0?grossWinnings/absoluteGrossLosses:null;
  const netROI=totalSettledCapitalAtRisk>0?netRealisedPL/totalSettledCapitalAtRisk:null;
  return Object.freeze({startingBankroll:bankroll,settledOrderCount:settled.length,unresolvedOrderCount:active.length,wonOrderCount,lostOrderCount,voidOrderCount,grossWinnings,grossLosses,absoluteGrossLosses,grossRealisedPL,commissionPaid,netRealisedPL,currentEquity,matchedBackExposure,matchedLayLiability,unmatchedReservedExposure,totalOpenExposure,availableBankroll,pendingPotentialProfit:round(pendingPotentialProfit),totalSettledCapitalAtRisk:round(totalSettledCapitalAtRisk),profitFactor,netROI,netROIOnCapitalAtRisk:netROI,accountingDataInconsistent:reconciliationErrors.length>0,accountingReconciliationPassed:reconciliationErrors.length===0,reconciliationErrors,inconsistentOrderIds:inconsistentOrders.map(order=>order.id).filter(Boolean),generatedAt:new Date().toISOString()});
}