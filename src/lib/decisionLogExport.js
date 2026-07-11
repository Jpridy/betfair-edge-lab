export const CYCLE_EXPORT_COLUMNS = [
  ['cycleId','CycleId'],['cycleNumber','CycleNumber'],['timestamp','Timestamp'],['selectedRaceKey','SelectedRaceKey'],['selectedRaceName','SelectedRaceName'],['selectedRaceStartTime','SelectedRaceStartTime'],['raceMonitoringStatus','RaceMonitoringStatus'],['opportunitiesGenerated','OpportunitiesGenerated'],['gatePassedOpportunities','GatePassedOpportunities'],['rejectedOpportunities','RejectedOpportunities'],['positiveEvOpportunities','PositiveEvOpportunities'],['decision','Decision'],['failedGate','FailedGate'],['noBetReason','NoBetReason'],['orderCreated','OrderCreated'],['bestRejectedCandidateId','BestRejectedCandidateId'],['bestBetCandidateId','BestBetCandidateId'],['finalSelectedOpportunityId','FinalSelectedOpportunityId'],['bestRejectedRunnerName','BestRejectedRunnerName'],['bestRejectedRunnerNameHydrated','BestRejectedRunnerNameHydrated'],['bestRejectedRunnerNameHydrationSource','BestRejectedRunnerNameHydrationSource'],['bestRejectedSelectionId','BestRejectedSelectionId'],['bestRejectedSide','BestRejectedSide'],['bestRejectedOdds','BestRejectedOdds'],['bestRejectedEV','BestRejectedEV'],['bestRejectedROI','BestRejectedROI'],['bestRejectedEdge','BestRejectedEdge'],['bestRejectedConfidence','BestRejectedConfidence'],['bestRejectedFailedGate','BestRejectedFailedGate'],['bestRejectedBlocker','BestRejectedBlocker'],['candidateSummaryJson','CandidateSummaryJson'],['candidateChangedSincePreviousCycle','CandidateChangedSincePreviousCycle'],['bestRejectedChangedSincePreviousCycle','BestRejectedChangedSincePreviousCycle'],['priceChangedSincePreviousCycle','PriceChangedSincePreviousCycle'],['probabilityChangedSincePreviousCycle','ProbabilityChangedSincePreviousCycle'],
].map(([key,label]) => ({key,label}));

export const OPPORTUNITY_EXPORT_COLUMNS = [
  'cycleId','cycleNumber','rank','opportunityId','raceKey','marketId','marketName','marketType','runnerName','runnerNameHydrated','runnerNameHydrationSource','selectionId','opponentSelectionId','side','odds','availableSize','modelProbability','finalProbabilityUsedInEV','impliedProbability','fairOdds','edge','ev','roi','confidence','dataQuality','decision','gatesPassed','failedGate','blocker','blockers','decisionSource','probabilitySource','externalSearchStatus','aiStatus','riskAdjustedScore','selectedAsBestBet','selectedAsBestRejected','selectedAsFinalCandidate',
].map(key => ({key,label:key.charAt(0).toUpperCase() + key.slice(1)}));

export function cycleToRow(cycle) {
  const summary = cycle.scanSummary || {};
  const rejected = summary.bestRejectedCandidate || null;
  return {
    cycleId:String(cycle.cycleId || cycle.id || ''), cycleNumber:cycle.cycleNumber ?? '', timestamp:cycle.finishedAt || cycle.startedAt || '',
    selectedRaceKey:summary.selectedRaceKey || '', selectedRaceName:summary.selectedRaceName || '', selectedRaceStartTime:summary.selectedRaceStartTime || '',
    raceMonitoringStatus:summary.raceMonitoringStatus || 'NO_VALID_RACE_SELECTED', opportunitiesGenerated:summary.totalOpportunities ?? summary.opportunityLog?.length ?? 0,
    gatePassedOpportunities:summary.gatePassedOpportunities ?? 0, rejectedOpportunities:summary.rejectedOpportunities ?? 0,
    positiveEvOpportunities:summary.positiveEVOpportunities ?? 0, decision:cycle.ordersCreated > 0 ? 'BET' : 'NO_BET',
    failedGate:summary.failedGate || rejected?.failedGate || '', noBetReason:cycle.noBetReason || summary.noBetReason || '', orderCreated:cycle.ordersCreated || 0,
    bestRejectedCandidateId:summary.bestRejectedCandidateId || '', bestBetCandidateId:summary.bestBetCandidateId || '', finalSelectedOpportunityId:summary.finalSelectedOpportunityId || '',
    bestRejectedRunnerName:rejected?.runnerName || '', bestRejectedRunnerNameHydrated:rejected?.runnerNameHydrated ?? '', bestRejectedRunnerNameHydrationSource:rejected?.runnerNameHydrationSource || '', bestRejectedSelectionId:rejected?.selectionId || '', bestRejectedSide:rejected?.side || '', bestRejectedOdds:rejected?.odds ?? '',
    bestRejectedEV:rejected?.ev ?? '', bestRejectedROI:rejected?.roi ?? '', bestRejectedEdge:rejected?.edge ?? '', bestRejectedConfidence:rejected?.confidence ?? '',
    bestRejectedFailedGate:rejected?.failedGate || '', bestRejectedBlocker:rejected?.blocker || '', candidateSummaryJson:summary.candidateSummaryJson || '',
    candidateChangedSincePreviousCycle:summary.candidateChangedSincePreviousCycle ?? false, bestRejectedChangedSincePreviousCycle:summary.bestRejectedChangedSincePreviousCycle ?? false,
    priceChangedSincePreviousCycle:summary.priceChangedSincePreviousCycle ?? false, probabilityChangedSincePreviousCycle:summary.probabilityChangedSincePreviousCycle ?? false,
  };
}

export function opportunitiesToRows(cycles) {
  return cycles.flatMap(cycle => (cycle.scanSummary?.opportunityLog || []).map(row => ({...row,cycleId:String(cycle.cycleId || row.cycleId || cycle.id || ''),cycleNumber:cycle.cycleNumber ?? row.cycleNumber})));
}