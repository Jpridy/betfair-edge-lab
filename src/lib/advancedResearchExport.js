import { rowsToCSV } from './csvExport';
import {
  benchmarkResults, detectDrift, errorBudget, plDecomposition,
  probabilityEnsemble, replayAt, researchSummary, simulatePaperFill,
  survivalMonteCarlo, validateFeatureRegistry,
} from './edgeDiscovery';

const json = value => JSON.stringify(value, null, 2);
const columns = rows => (rows[0] ? Object.keys(rows[0]) : ['status']).map(key => ({ key, label: key }));

export const ADVANCED_RESEARCH_PATHS = [
  'replay/replay-integrity.json', 'replay/counterfactual-opportunities.csv',
  'benchmarks/benchmark-results.json', 'clv/clv-summary.json', 'clv/clv-by-segment.csv',
  'fills/fill-simulation.json', 'fills/adverse-selection.csv',
  'ensemble/ensemble-weights.json', 'ensemble/component-calibration.json',
  'uncertainty/robust-ev-analysis.json', 'regimes/regime-performance.csv',
  'drift/drift-report.json', 'holdout/holdout-status.json',
  'system/feature-leakage-report.json', 'accounting/pl-decomposition.json',
  'risk/monte-carlo-survival.json', 'reliability/error-budget.json',
  'research/daily-research-report.txt',
];

export function buildAdvancedResearchExports(state) {
  const events = state.marketEvents || [];
  const candidates = state.counterfactualCandidates || [];
  const outcomes = state.candidateOutcomeEvents || [];
  const orders = state.paperOrders || [];
  const opportunities = state.exchangeOpportunities || [];
  const profiles = state.calibrationProfiles || [];
  const reliability = state.reliabilityEvents || [];
  const latestEventTime=events.reduce((latest,event)=>new Date(event.timestamp)>new Date(latest)?event.timestamp:latest,'1970-01-01T00:00:00Z');
  const replay = replayAt(events, events.length ? latestEventTime : new Date().toISOString());
  const benchmarks = benchmarkResults(orders, profiles);
  const clvRows = orders.map(order => ({ side:order.side, odds:order.matchedOdds ?? order.requestedOdds, clv:order.clv ?? order.simulatedCLV ?? null, modelVersion:order.modelVersion ?? null, settingsVersion:order.settingsProfileId ?? null, netPL:order.netProfit ?? null }));
  const fills = opportunities.map(opportunity => ({ opportunityId:opportunity.opportunityId, OPTIMISTIC:simulatePaperFill(opportunity, 'OPTIMISTIC'), BASE:simulatePaperFill(opportunity, 'BASE'), CONSERVATIVE:simulatePaperFill(opportunity, 'CONSERVATIVE') }));
  const ensemble = opportunities[0] ? { componentProbabilities:opportunities[0].probabilityComponents, componentWeights:opportunities[0].componentWeights, ensembleVersion:opportunities[0].ensembleVersion } : probabilityEnsemble({ marketImplied:.5 }, { marketImplied:1 }, 0);
  const features = opportunities.flatMap(opportunity => Object.keys(opportunity.probabilityComponents || {}).map(featureName => ({ featureName, source:opportunity.dataSource, timestampAvailable:opportunity.decisionTimestamp ?? opportunity.created_date ?? null, validAtDecisionTime:!!(opportunity.decisionTimestamp ?? opportunity.created_date), usesResultData:false, usesFuturePrice:false, leakageStatus:(opportunity.decisionTimestamp ?? opportunity.created_date) ? 'CLEAR' : 'UNPROVEN' })));
  const regimeRows = opportunities.map(opportunity => ({ opportunityId:opportunity.opportunityId, regimes:(opportunity.regimes || []).join('|'), qualityScore:opportunity.dataQualityScore, decision:opportunity.decision, robustEVLowerBound:opportunity.robustEVLowerBound }));
  const summary = researchSummary({ orders, opportunities, reliabilityEvents:reliability, profiles });
  const replayIntegrity = { ...replay, snapshots:undefined };
  const adverseRows = outcomes.map(outcome => ({ candidateId:outcome.candidateId, movement5Seconds:outcome.movement5Seconds, movement15Seconds:outcome.movement15Seconds, movement30Seconds:outcome.movement30Seconds, movementToClose:outcome.movementToClose, immediateAdverseMovementRate:outcome.immediateAdverseMovementRate, averageAdverseTicks:outcome.averageAdverseTicks, adverseSelectionCost:outcome.adverseSelectionCost, integrityPassed:outcome.integrityPassed }));
  return {
    'replay/replay-integrity.json':json(replayIntegrity),
    'replay/counterfactual-opportunities.csv':rowsToCSV(candidates, columns(candidates)),
    'benchmarks/benchmark-results.json':json(benchmarks),
    'clv/clv-summary.json':json({ averageCLV:summary.averageCLV, warning:summary.averageCLV < 0 ? 'Persistent negative CLV may indicate luck-driven P/L.' : null }),
    'clv/clv-by-segment.csv':rowsToCSV(clvRows, columns(clvRows)),
    'fills/fill-simulation.json':json(fills),
    'fills/adverse-selection.csv':rowsToCSV(adverseRows, columns(adverseRows)),
    'ensemble/ensemble-weights.json':json(ensemble),
    'ensemble/component-calibration.json':json({ status:'Requires settled out-of-sample component predictions', components:ensemble.componentProbabilities || {} }),
    'uncertainty/robust-ev-analysis.json':json(opportunities.map(opportunity => ({ opportunityId:opportunity.opportunityId, lower:opportunity.probabilityLowerBound, point:opportunity.probabilityPointEstimate, upper:opportunity.probabilityUpperBound, robustEVLowerBound:opportunity.robustEVLowerBound, robustROILowerBound:opportunity.robustROILowerBound, decision:opportunity.decision }))),
    'regimes/regime-performance.csv':rowsToCSV(regimeRows, columns(regimeRows)),
    'drift/drift-report.json':json(detectDrift(orders.slice(0, 50), orders.slice(50, 150))),
    'holdout/holdout-status.json':json(state.holdoutVaults || []),
    'system/feature-leakage-report.json':json(validateFeatureRegistry(features)),
    'accounting/pl-decomposition.json':json(plDecomposition(orders)),
    'risk/monte-carlo-survival.json':json(survivalMonteCarlo(orders)),
    'reliability/error-budget.json':json(errorBudget(reliability)),
    'research/daily-research-report.txt':`BETFAIR EDGE LAB DAILY RESEARCH REPORT\nGenerated: ${summary.generatedAt}\nPaper only: Yes\nProfit guaranteed: No\nEvidence: ${summary.evidence}\nSettled bets: ${orders.length}\nAverage CLV: ${summary.averageCLV ?? 'unavailable'}\nNo-trade benchmark wins: ${benchmarks.noTradeWins ? 'Yes' : 'No'}\nError budget breached: ${summary.errorBudget.breached ? 'Yes' : 'No'}\n`,
  };
}