export const CYCLE_EXPORT_COLUMNS = [
  ['cycleId','CycleId'],['cycleNumber','CycleNumber'],['timestamp','Timestamp'],['legacyIncomplete','LegacyIncomplete'],['missingCandidateSnapshot','MissingCandidateSnapshot'],['selectedRaceKey','SelectedRaceKey'],['selectedRaceName','SelectedRaceName'],['selectedRaceNumber','SelectedRaceNumber'],['selectedRaceStartTime','SelectedRaceStartTime'],['secondsToStart','SecondsToStart'],['raceMonitoringStatus','RaceMonitoringStatus'],['windowStartSeconds','WindowStartSeconds'],['windowEndSeconds','WindowEndSeconds'],['selectedRaceWindowOpensAt','SelectedRaceWindowOpensAt'],['selectedRaceWindowClosesAt','SelectedRaceWindowClosesAt'],['priceFeedStatus','PriceFeedStatus'],['apiConnected','ApiConnected'],['streamConnected','StreamConnected'],['opportunitiesGenerated','OpportunitiesGenerated'],['gatePassedOpportunities','GatePassedOpportunities'],['rejectedOpportunities','RejectedOpportunities'],['positiveEvOpportunities','PositiveEvOpportunities'],['decision','Decision'],['failedGate','FailedGate'],['noBetReason','NoBetReason'],['orderCreated','OrderCreated'],['bestRejectedCandidateId','BestRejectedCandidateId'],['rejectionCountsByGate','RejectionCountsByGate'],['bestBetCandidateId','BestBetCandidateId'],['finalSelectedOpportunityId','FinalSelectedOpportunityId'],['bestRejectedRunnerName','BestRejectedRunnerName'],['bestRejectedRunnerNameHydrated','BestRejectedRunnerNameHydrated'],['bestRejectedRunnerNameHydrationSource','BestRejectedRunnerNameHydrationSource'],['bestRejectedSelectionId','BestRejectedSelectionId'],['bestRejectedSide','BestRejectedSide'],['bestRejectedOdds','BestRejectedOdds'],['bestRejectedEV','BestRejectedEV'],['bestRejectedROI','BestRejectedROI'],['bestRejectedEdge','BestRejectedEdge'],['bestRejectedConfidence','BestRejectedConfidence'],['bestRejectedFailedGate','BestRejectedFailedGate'],['bestRejectedBlocker','BestRejectedBlocker'],['candidateSummaryJson','CandidateSummaryJson'],['candidateChangedSincePreviousCycle','CandidateChangedSincePreviousCycle'],['bestRejectedChangedSincePreviousCycle','BestRejectedChangedSincePreviousCycle'],['priceChangedSincePreviousCycle','PriceChangedSincePreviousCycle'],['probabilityChangedSincePreviousCycle','ProbabilityChangedSincePreviousCycle'],
].map(([key,label]) => ({key,label}));

export const OPPORTUNITY_EXPORT_COLUMNS = [
  'cycleId','cycleNumber','rank','opportunityLogCompleteness','opportunityId','raceKey','marketId','marketName','marketType','runnerName','runnerNameHydrated','runnerNameHydrationSource','selectionId','opponentSelectionId','side','odds','availableSize','modelProbability','finalProbabilityUsedInEV','impliedProbability','fairOdds','edge','ev','roi','confidence','dataQuality','decision','gatesPassed','failedGate','blocker','blockers','decisionSource','probabilitySource','externalSearchStatus','aiStatus','riskAdjustedScore','selectedAsBestBet','selectedAsBestRejected','selectedAsFinalCandidate',
].map(key => ({key,label:key.charAt(0).toUpperCase() + key.slice(1)}));

export function cycleToRow(cycle) {
  const summary = cycle.scanSummary || {};
  const rejected = summary.bestRejectedCandidate || null;
  return {
    cycleId:String(cycle.cycleId || cycle.id || ''), cycleNumber:cycle.cycleNumber ?? '', timestamp:cycle.finishedAt || cycle.startedAt || '',
    ...legacyFields(cycle), selectedRaceKey:summary.selectedRaceKey || '', selectedRaceName:summary.selectedRaceName || '', selectedRaceNumber:summary.selectedRaceNumber ?? '', selectedRaceStartTime:summary.selectedRaceStartTime || '', secondsToStart:summary.secondsToStart ?? '',
    raceMonitoringStatus:summary.raceMonitoringStatus || 'NO_VALID_RACE_SELECTED', windowStartSeconds:summary.windowStartSeconds ?? '', windowEndSeconds:summary.windowEndSeconds ?? '', selectedRaceWindowOpensAt:summary.selectedRaceWindowOpensAt || '', selectedRaceWindowClosesAt:summary.selectedRaceWindowClosesAt || '',
    priceFeedStatus:summary.connectionDiagnostics?.priceFeedStatus || summary.priceFeedStatus || '', apiConnected:summary.connectionDiagnostics?.betfairApiConnected ?? '', streamConnected:summary.connectionDiagnostics?.streamConnected ?? '', opportunitiesGenerated:summary.totalOpportunities ?? summary.opportunityLog?.length ?? 0,
    gatePassedOpportunities:summary.gatePassedOpportunities ?? 0, rejectedOpportunities:Math.max(0,(summary.totalOpportunities ?? summary.opportunityLog?.length ?? 0)-(summary.gatePassedOpportunities ?? 0)), rejectionCountsByGate:summary.rejectionCountsByGate || summary.candidateSummary?.byFailedGate || {},
    positiveEvOpportunities:summary.positiveEVOpportunities ?? 0, decision:cycle.ordersCreated > 0 ? 'BET' : 'NO_BET',
    failedGate:rejected?.failedGate || summary.failedGate || (cycle.ordersCreated > 0 ? '' : 'NO_VALID_CANDIDATE'), noBetReason:cycle.noBetReason || summary.noBetReason || '', orderCreated:cycle.ordersCreated || 0,
    bestRejectedCandidateId:summary.bestRejectedCandidateId || '', bestBetCandidateId:summary.bestBetCandidateId || '', finalSelectedOpportunityId:summary.finalSelectedOpportunityId || '',
    bestRejectedRunnerName:rejected?.runnerName || '', bestRejectedRunnerNameHydrated:rejected?.runnerNameHydrated ?? '', bestRejectedRunnerNameHydrationSource:rejected?.runnerNameHydrationSource || '', bestRejectedSelectionId:rejected?.selectionId || '', bestRejectedSide:rejected?.side || '', bestRejectedOdds:rejected?.odds ?? '',
    bestRejectedEV:rejected?.ev ?? '', bestRejectedROI:rejected?.roi ?? '', bestRejectedEdge:rejected?.edge ?? '', bestRejectedConfidence:rejected?.confidence ?? '',
    bestRejectedFailedGate:rejected?.failedGate || '', bestRejectedBlocker:rejected?.blocker || '', candidateSummaryJson:summary.candidateSummaryJson || JSON.stringify({bestBetCandidate:summary.bestBetCandidate || null,bestRejectedCandidate:rejected,finalSelectedOpportunity:summary.finalSelectedOpportunity || null}),
    candidateChangedSincePreviousCycle:summary.candidateChangedSincePreviousCycle ?? false, bestRejectedChangedSincePreviousCycle:summary.bestRejectedChangedSincePreviousCycle ?? false,
    priceChangedSincePreviousCycle:summary.priceChangedSincePreviousCycle ?? false, probabilityChangedSincePreviousCycle:summary.probabilityChangedSincePreviousCycle ?? false,
  };
}

function legacyFields(cycle) {
  const summary=cycle.scanSummary || {};
  const expected=Number(summary.totalOpportunities ?? summary.opportunitiesGenerated ?? 0);
  const snapshot=Array.isArray(summary.allOpportunitiesSnapshot) ? summary.allOpportunitiesSnapshot : [];
  const missingCandidateSnapshot=expected > 0 && (snapshot.length < expected || summary.opportunityLogCompleteness !== 'complete_cycle_snapshot');
  const candidate=summary.bestRejectedCandidate || summary.bestGatePassedOpportunity || summary.finalSelectedOpportunity;
  const candidateIncomplete=expected > 0 && (!candidate?.opportunityId || !candidate?.decision || candidate?.gatesPassed == null);
  return {legacyIncomplete:missingCandidateSnapshot || candidateIncomplete,missingCandidateSnapshot};
}

export function toTextSafeId(value) {
  if (value == null || value === '') return '';
  const text = String(value).replaceAll('"', '""');
  return `="${text}"`;
}

export function opportunitiesToRows(cycles) {
  return cycles.flatMap(cycle => (cycle.scanSummary?.opportunityLog || []).map(row => ({...row,cycleId:String(cycle.cycleId || row.cycleId || cycle.id || ''),cycleNumber:cycle.cycleNumber ?? row.cycleNumber,marketId:toTextSafeId(row.marketId),selectionId:toTextSafeId(row.selectionId),opponentSelectionId:toTextSafeId(row.opponentSelectionId)})));
}