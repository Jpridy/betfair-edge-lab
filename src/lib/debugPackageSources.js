import { buildDecisionLogging, bestRejectedNoBetReason, toOpportunityLogRow } from '@/lib/decisionLogging';
import { buildRunnerSnapshot } from '@/lib/runnerSnapshot';
import { parseRaceNumber, resolveNumberOfWinners } from '@/lib/marketClusterer';

const asArray = value => Array.isArray(value) ? value : [];
const keyOf = (item, index) => item?.opportunityId || `${item?.marketId || item?.betfairMarketId || 'market'}|${item?.selectionId || index}|${item?.side || ''}`;

export function resolveLatestOpportunitySnapshot(state, latest, summary) {
  const sources = [
    ['complete_cycle_snapshot', summary.allOpportunitiesSnapshot],
    ['assessed_runners_fallback', latest.assessedRunners],
    ['partial_top_only', dedupe([...asArray(summary.topOpportunities), ...asArray(summary.topRejected)] )],
    ['current_state_fallback', state.exchangeOpportunities],
    ['legacy_opportunity_log', summary.opportunityLog],
  ];
  const sourceIndex = sources.findIndex(([, value]) => asArray(value).length);
  const completeness = sourceIndex >= 0 ? sources[sourceIndex][0] : 'missing';
  const raw = sourceIndex >= 0 ? [...asArray(sources[sourceIndex][1])] : [];
  const expected = Number(summary.totalOpportunities ?? summary.opportunitiesGenerated ?? raw.length);
  if (raw.length < expected && sourceIndex >= 0) { const existing=new Set(raw.map(keyOf)); for (let index=sourceIndex+1;index<sources.length && raw.length<expected;index++) for (const item of asArray(sources[index][1])) { const key=keyOf(item,raw.length); if (!existing.has(key)) { existing.add(key); raw.push(item); if (raw.length >= expected) break; } } }
  const context = {cycleId:latest.cycleId || latest.id || '',cycleNumber:latest.cycleNumber ?? '',raceKey:summary.selectedRaceKey || ''};
  const rows = raw.map((item,index) => { const row=toOpportunityLogRow(item,{...context,rank:index+1,aiStatus:summary.aiStatus}); return {...row,...calculationFields(item),runnerNameHydrated:item?.runnerNameHydrated ?? row.runnerNameHydrated,runnerNameHydrationSource:item?.runnerNameHydrationSource || row.runnerNameHydrationSource,opportunityLogCompleteness:completeness}; });
  while (rows.length < expected) rows.push(missingRow(rows.length + 1, context, completeness));
  return { opportunities:rows.slice(0, Math.max(expected, rows.length)), opportunityLogCompleteness:completeness, expectedCount:expected };
}

export function enrichLatestCycleForExport(cycles, snapshot) {
  if (!cycles.length) return [];
  const [latest, ...rest] = cycles;
  const summary = latest.scanSummary || {};
  const logging = buildDecisionLogging({ opportunities:snapshot.opportunities, cycleId:latest.cycleId || latest.id, cycleNumber:latest.cycleNumber, raceKey:summary.selectedRaceKey, aiStatus:summary.aiStatus, finalSelectedOpportunity:summary.finalSelectedOpportunity });
  const generated = Number(summary.totalOpportunities ?? snapshot.expectedCount ?? snapshot.opportunities.length);
  const passed = logging.gatePassedOpportunities;
  const enrichedSummary = {...summary,...logging,allOpportunitiesSnapshot:logging.opportunityLog,topOpportunities:logging.opportunityLog.slice(0,20),topRejected:logging.opportunityLog.filter(item=>item.gatesPassed!==true).slice(0,10),opportunityLogCompleteness:snapshot.opportunityLogCompleteness,totalOpportunities:generated,gatePassedOpportunities:passed,rejectedOpportunities:Math.max(0,generated-passed),rejectionCountsByGate:logging.rejectionCountsByGate,failedGate:logging.bestRejectedCandidate?.failedGate || summary.failedGate || (generated ? 'NO_VALID_CANDIDATE' : summary.failedGate)};
  const noBetReason = latest.ordersCreated > 0 ? null : bestRejectedNoBetReason(logging.bestRejectedCandidate, latest.noBetReason || summary.noBetReason || 'No valid candidate');
  return [{...latest,noBetReason,scanSummary:enrichedSummary},...rest];
}

export function resolveMarketAndRunnerSnapshots(state, latest, summary) {
  const selectedDetails=asArray(summary.selectedRaceMarketDetails || summary.raceMonitoring?.selectedRaceMarketDetails);
  const loaded=asArray(summary.loadedMarketsTable);
  const marketSource=asArray(state.markets).length ? state.markets : (selectedDetails.length ? selectedDetails : loaded);
  const markets=marketSource.map(market => ({...market,raceNumber:market.raceNumber || parseRaceNumber(market.marketName,market.eventName) || 0,...resolveNumberOfWinners(market)}));
  const marketIds=selectedDetails.map(item => item.marketId || item.normalizedMarketId).filter(Boolean);
  const runnerSource=asArray(state.runners).length ? state.runners : asArray(summary.selectedRaceRunnerSnapshot);
  const runners=buildRunnerSnapshot(runnerSource, marketIds);
  return {markets,runners,loadedMarkets:loaded,selectedDetails};
}

function dedupe(items) { const seen=new Set(); return items.filter((item,index)=>{const key=keyOf(item,index);if(seen.has(key))return false;seen.add(key);return true;}); }
function calculationFields(item) { return {stake:item?.stake,liability:item?.liability,maxProfit:item?.maxProfit, maxLoss:item?.maxLoss,normalizedCommissionRate:item?.normalizedCommissionRate ?? item?.commissionRate,rawCommissionRate:item?.rawCommissionRate,commissionRate:item?.commissionRate,breakevenProbability:item?.breakevenProbability,mathematicalInvariantsPassed:item?.mathematicalInvariantsPassed,calculationResult:item?.calculationResult,finalAuthorityRecalculation:item?.finalAuthorityRecalculation,bestBackPrice:item?.bestBackPrice,bestBackSize:item?.bestBackSize,bestLayPrice:item?.bestLayPrice,bestLaySize:item?.bestLaySize}; }
function missingRow(rank, context, completeness) { return {...context,rank,opportunityId:`snapshot_unavailable_${rank}`,runnerName:'Snapshot unavailable',runnerNameHydrated:false,runnerNameHydrationSource:'snapshot_missing',side:'UNKNOWN',odds:'UNKNOWN',ev:'UNKNOWN',roi:'UNKNOWN',decision:'NO_BET',gatesPassed:false,failedGate:'OPPORTUNITY_SNAPSHOT_NOT_AVAILABLE',blocker:'OPPORTUNITY_SNAPSHOT_NOT_AVAILABLE',blockers:['OPPORTUNITY_SNAPSHOT_NOT_AVAILABLE'],opportunityLogCompleteness:completeness}; }