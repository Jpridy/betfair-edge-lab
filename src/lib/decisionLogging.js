const fallbackName = selectionId => `Selection ${selectionId || 'Unknown'}`;
const isHydratedName = name => !!name && !/^Selection\s+\d+$/i.test(name) && name !== 'Unknown' && name !== 'Unknown Runner';
const marketIdOf = item => String(item?.betfairMarketId || item?.marketId || '');
const selectionIdOf = item => String(item?.selectionId || item?.betfairSelectionId || '');

export function hydrateOpportunityRunner(opportunity, runners = []) {
  const selectionId = selectionIdOf(opportunity);
  const marketId = marketIdOf(opportunity);
  const matching = runners.filter(runner => selectionIdOf(runner) === selectionId);
  const catalogueRunner = matching.find(runner => marketIdOf(runner) === marketId && isHydratedName(runner.runnerName)) || matching.find(runner => isHydratedName(runner.runnerName));
  if (catalogueRunner) return { runnerName:catalogueRunner.runnerName, runnerNameHydrated:true, runnerNameHydrationSource:'betfair_catalogue' };
  if (isHydratedName(opportunity?.runnerName)) return { runnerName:opportunity.runnerName, runnerNameHydrated:true, runnerNameHydrationSource:'engine_runner_name' };
  return { runnerName:fallbackName(selectionId), runnerNameHydrated:false, runnerNameHydrationSource:'missing_catalogue_name' };
}

export function toOpportunityLogRow(opportunity, context = {}) {
  const hydrated = hydrateOpportunityRunner(opportunity, context.runners);
  const hasEv = opportunity?.ev !== null && opportunity?.ev !== undefined && opportunity?.ev !== '';
  const nonPositiveEv = hasEv && Number.isFinite(Number(opportunity.ev)) && Number(opportunity.ev) <= 0;
  const decision = nonPositiveEv ? 'NO_BET' : (opportunity?.decision || (opportunity?.gatesPassed === true ? 'BET' : 'NO_BET'));
  const failedGate = nonPositiveEv ? 'NON_POSITIVE_EV' : (opportunity?.failedGate || opportunity?.blockers?.[0] || (decision !== 'BET' ? 'NO_VALID_CANDIDATE' : ''));
  const blockers = nonPositiveEv ? ['NON_POSITIVE_EV', ...(opportunity?.blockers || []).filter(item => item !== 'NON_POSITIVE_EV')] : (opportunity?.blockers || []);
  return {
    cycleId:context.cycleId || '', cycleNumber:context.cycleNumber ?? '', rank:context.rank ?? '',
    opportunityId:opportunity?.opportunityId || '', raceKey:opportunity?.raceKey || context.raceKey || '',
    marketId:marketIdOf(opportunity), marketName:opportunity?.marketName || '', marketType:opportunity?.marketType || opportunity?.detectedMarketType || '',
    ...hydrated, selectionId:selectionIdOf(opportunity), opponentSelectionId:opportunity?.opponentSelectionId || '',
    side:opportunity?.side || '', odds:opportunity?.odds ?? '', availableSize:opportunity?.availableSize ?? '',
    modelProbability:opportunity?.modelProbability ?? '', finalProbabilityUsedInEV:opportunity?.finalProbabilityUsedInEV ?? opportunity?.modelProbability ?? '',
    impliedProbability:opportunity?.impliedProbability ?? '', fairOdds:opportunity?.fairOdds ?? '', edge:opportunity?.edge ?? '', ev:opportunity?.ev ?? '', roi:opportunity?.roi ?? '',
    confidence:opportunity?.confidence ?? '', dataQuality:opportunity?.dataQuality ?? '', decision,
    gatesPassed:nonPositiveEv ? false : (opportunity?.gatesPassed ?? decision === 'BET'), failedGate,
    blocker:failedGate || opportunity?.blocker || '', blockers,
    decisionSource:opportunity?.decisionSource || '', probabilitySource:opportunity?.probabilitySource || opportunity?.dataSource || '',
    externalSearchStatus:opportunity?.externalSearchStatus || 'not_requested', aiStatus:opportunity?.aiStatus || context.aiStatus || 'not_used',
    riskAdjustedScore:opportunity?.riskAdjustedScore ?? '', stake:opportunity?.stake ?? '', liability:opportunity?.liability ?? '', maxProfit:opportunity?.maxProfit ?? '', maxLoss:opportunity?.maxLoss ?? '', normalizedCommissionRate:opportunity?.normalizedCommissionRate ?? opportunity?.commissionRate ?? '', rawCommissionRate:opportunity?.rawCommissionRate ?? '', commissionRate:opportunity?.commissionRate ?? '', breakevenProbability:opportunity?.breakevenProbability ?? '', mathematicalInvariantsPassed:opportunity?.mathematicalInvariantsPassed ?? opportunity?.calculationResult?.mathematicalInvariantsPassed ?? null, calculationResult:opportunity?.calculationResult || null, finalAuthorityRecalculation:opportunity?.finalAuthorityRecalculation || null, bestBackPrice:opportunity?.bestBackPrice ?? '', bestBackSize:opportunity?.bestBackSize ?? '', bestLayPrice:opportunity?.bestLayPrice ?? '', bestLaySize:opportunity?.bestLaySize ?? '', decisionTimestamp:opportunity?.decisionTimestamp ?? '', probabilityComponents:opportunity?.probabilityComponents || {}, componentWeights:opportunity?.componentWeights || {}, ensembleProbability:opportunity?.ensembleProbability ?? '', probabilityLowerBound:opportunity?.probabilityLowerBound ?? '', probabilityPointEstimate:opportunity?.probabilityPointEstimate ?? '', probabilityUpperBound:opportunity?.probabilityUpperBound ?? '', robustEVLowerBound:opportunity?.robustEVLowerBound ?? '', robustROILowerBound:opportunity?.robustROILowerBound ?? '', regimes:opportunity?.regimes || [], dataQualityScore:opportunity?.dataQualityScore ?? '', dataQualityBreakdown:opportunity?.dataQualityBreakdown || {}, dataQualityHardFails:opportunity?.dataQualityHardFails || [], fillRealism:opportunity?.fillRealism || {}, stakingDiagnostics:opportunity?.stakingDiagnostics || {}, selectedAsBestBet:false, selectedAsBestRejected:false, selectedAsFinalCandidate:false,
  };
}

const changed = (current, previous, fields) => fields.some(field => current?.[field] !== previous?.[field]);
const candidateKey = row => `${row.marketId}|${row.selectionId}|${row.opponentSelectionId}|${row.side}`;

export function buildDecisionLogging({ opportunities = [], runners = [], cycleId, cycleNumber, raceKey, aiStatus, finalSelectedOpportunity = null, previousCycle = null }) {
  const rows = opportunities.map((opportunity, index) => toOpportunityLogRow(opportunity, { runners, cycleId, cycleNumber, raceKey, aiStatus, rank:index + 1 }));
  const bestGatePassed = rows.find(row => row.gatesPassed) || null;
  const bestRejected = rows.find(row => !row.gatesPassed) || null;
  const finalId = finalSelectedOpportunity?.opportunityId || null;
  const finalSelected = rows.find(row => row.opportunityId === finalId) || null;
  if (bestGatePassed) bestGatePassed.selectedAsBestBet = true;
  if (bestRejected) bestRejected.selectedAsBestRejected = true;
  if (finalSelected) finalSelected.selectedAsFinalCandidate = true;

  const byMarketType = {}, bySide = {}, byFailedGate = {};
  for (const row of rows) {
    byMarketType[row.marketType || 'UNKNOWN'] = (byMarketType[row.marketType || 'UNKNOWN'] || 0) + 1;
    bySide[row.side || 'UNKNOWN'] = (bySide[row.side || 'UNKNOWN'] || 0) + 1;
    if (!row.gatesPassed) byFailedGate[row.failedGate || 'UNKNOWN'] = (byFailedGate[row.failedGate || 'UNKNOWN'] || 0) + 1;
  }
  const candidateSummary = { total:rows.length, byMarketType, bySide, byFailedGate, topFiveRejected:rows.filter(row => !row.gatesPassed).slice(0, 5).map(({opportunityId,runnerName,side,odds,ev,roi,edge,confidence,failedGate}) => ({opportunityId,runnerName,side,odds,ev,roi,edge,confidence,failedGate})) };

  const previous = previousCycle?.scanSummary || {};
  const previousRows = previous.opportunityLog || [];
  const sameRace = !!raceKey && raceKey === previous.selectedRaceKey;
  const previousByKey = new Map(previousRows.map(row => [candidateKey(row), row]));
  const comparable = sameRace && previousRows.length > 0;
  const candidateChangedSincePreviousCycle = comparable ? rows.length !== previousRows.length || rows.some(row => !previousByKey.has(candidateKey(row)) || changed(row, previousByKey.get(candidateKey(row)), ['rank','decision','failedGate','riskAdjustedScore','confidence','ev','roi','edge'])) : false;
  const priceChangedSincePreviousCycle = comparable ? rows.some(row => previousByKey.has(candidateKey(row)) && changed(row, previousByKey.get(candidateKey(row)), ['odds','availableSize'])) : false;
  const probabilityChangedSincePreviousCycle = comparable ? rows.some(row => previousByKey.has(candidateKey(row)) && changed(row, previousByKey.get(candidateKey(row)), ['modelProbability','finalProbabilityUsedInEV'])) : false;

  return {
    topRankedOpportunity:rows[0] || null, bestGatePassedOpportunity:bestGatePassed, bestRejectedCandidate:bestRejected, finalSelectedOpportunity:finalSelected,
    topRankedOpportunityId:rows[0]?.opportunityId || null, bestBetCandidateId:bestGatePassed?.opportunityId || null,
    bestRejectedCandidateId:bestRejected?.opportunityId || null, finalSelectedOpportunityId:finalSelected?.opportunityId || null,
    gatePassedOpportunities:rows.filter(row => row.gatesPassed).length, rejectedOpportunities:rows.length-rows.filter(row => row.gatesPassed).length, rejectionCountsByGate:byFailedGate, candidateSummary, candidateSummaryJson:JSON.stringify(candidateSummary), opportunityLog:rows, allOpportunitiesSnapshot:rows, opportunityLogCompleteness:'full_canonical_snapshot',
    candidateChangedSincePreviousCycle, bestRejectedChangedSincePreviousCycle:comparable ? (bestRejected?.opportunityId || null) !== (previous.bestRejectedCandidateId || null) : false,
    priceChangedSincePreviousCycle, probabilityChangedSincePreviousCycle,
  };
}

export function bestRejectedNoBetReason(candidate, fallback = '') {
  if (!candidate) return fallback;
  return `${candidate.runnerName} was the best rejected candidate (${candidate.opportunityId}), blocked by ${candidate.blocker || candidate.failedGate || 'an unknown gate'}.`;
}