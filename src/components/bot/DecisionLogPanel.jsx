import React, { useState } from 'react';
import { Panel, StatusBadge } from '@/components/ui/Trading';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Download, Trash2, FileText, ListChecks, Globe, TableProperties } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { exportToCSV } from '@/lib/csvExport';

const CYCLE_EXPORT_COLUMNS = [
  { key: 'cycleId', label: 'CycleId' },
  { key: 'timestamp', label: 'Timestamp' },
  { key: 'debugScanMode', label: 'DebugScanMode' },
  { key: 'totalMarketsLoaded', label: 'TotalMarketsLoaded' },
  { key: 'openPreRaceMarkets', label: 'OpenPreRaceMarkets' },
  { key: 'marketsInsideTimeWindow', label: 'MarketsInsideTimeWindow' },
  { key: 'eligibleMarketsAfterRunnerFilter', label: 'EligibleMarketsAfterRunnerFilter' },
  { key: 'eligibleMarketsAfterPriceFilter', label: 'EligibleMarketsAfterPriceFilter' },
  { key: 'marketsSentToExchangeEngine', label: 'MarketsSentToExchangeEngine' },
  { key: 'openMarketsScanned', label: 'OpenMarketsScanned' },
  { key: 'winMarketsFound', label: 'WinMarketsFound' },
  { key: 'placeMarketsFound', label: 'PlaceMarketsFound' },
  { key: 'h2hMarketsFound', label: 'H2HMarketsFound' },
  { key: 'unknownMarketsFound', label: 'UnknownMarketsFound' },
  { key: 'raceClustersCreated', label: 'RaceClustersCreated' },
  { key: 'opportunitiesGenerated', label: 'OpportunitiesGenerated' },
  { key: 'backOpportunities', label: 'BackOpportunities' },
  { key: 'layOpportunities', label: 'LayOpportunities' },
  { key: 'positiveEvOpportunities', label: 'PositiveEvOpportunities' },
  { key: 'rejectedOpportunities', label: 'RejectedOpportunities' },
  { key: 'marketsOpen', label: 'MarketsOpen' },
  { key: 'marketsClosed', label: 'MarketsClosed' },
  { key: 'marketsSuspended', label: 'MarketsSuspended' },
  { key: 'marketsInPlay', label: 'MarketsInPlay' },
  { key: 'marketsNotInPlay', label: 'MarketsNotInPlay' },
  { key: 'marketsWithStartTime', label: 'MarketsWithStartTime' },
  { key: 'marketsWithoutStartTime', label: 'MarketsWithoutStartTime' },
  { key: 'marketsWithRunners', label: 'MarketsWithRunners' },
  { key: 'marketsWithPriceData', label: 'MarketsWithPriceData' },
  { key: 'marketsMissingPriceData', label: 'MarketsMissingPriceData' },
  { key: 'tooEarlyMarkets', label: 'TooEarlyMarkets' },
  { key: 'insideWindowMarkets', label: 'InsideWindowMarkets' },
  { key: 'tooLateMarkets', label: 'TooLateMarkets' },
  { key: 'noStartTimeMarkets', label: 'NoStartTimeMarkets' },
  { key: 'betfairApiConnected', label: 'BetfairApiConnected' },
  { key: 'streamConnected', label: 'StreamConnected' },
  { key: 'lastStreamUpdateAt', label: 'LastStreamUpdateAt' },
  { key: 'lastCatalogueRefreshAt', label: 'LastCatalogueRefreshAt' },
  { key: 'marketCatalogueError', label: 'MarketCatalogueError' },
  { key: 'streamError', label: 'StreamError' },
  { key: 'priceFeedStale', label: 'PriceFeedStale' },
  { key: 'selectedOpportunityId', label: 'SelectedOpportunityId' },
  { key: 'marketId', label: 'MarketId' },
  { key: 'eventName', label: 'EventName' },
  { key: 'marketName', label: 'MarketName' },
  { key: 'marketTypeCode', label: 'MarketTypeCode' },
  { key: 'detectedMarketType', label: 'DetectedMarketType' },
  { key: 'side', label: 'Side' },
  { key: 'runnerName', label: 'RunnerName' },
  { key: 'selectionId', label: 'SelectionId' },
  { key: 'opponentSelectionId', label: 'OpponentSelectionId' },
  { key: 'odds', label: 'Odds' },
  { key: 'availableSize', label: 'AvailableSize' },
  { key: 'modelProbability', label: 'ModelProbability' },
  { key: 'impliedProbability', label: 'ImpliedProbability' },
  { key: 'breakevenProbability', label: 'BreakevenProbability' },
  { key: 'fairOdds', label: 'FairOdds' },
  { key: 'edge', label: 'Edge' },
  { key: 'ev', label: 'EV' },
  { key: 'roi', label: 'ROI' },
  { key: 'commissionRate', label: 'CommissionRate' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'dataQuality', label: 'DataQuality' },
  { key: 'spreadTicks', label: 'SpreadTicks' },
  { key: 'delayRiskScore', label: 'DelayRiskScore' },
  { key: 'fillProbability', label: 'FillProbability' },
  { key: 'stake', label: 'Stake' },
  { key: 'liability', label: 'Liability' },
  { key: 'maxProfit', label: 'MaxProfit' },
  { key: 'maxLoss', label: 'MaxLoss' },
  { key: 'failedGate', label: 'FailedGate' },
  { key: 'blocker', label: 'Blocker' },
  { key: 'decision', label: 'Decision' },
  { key: 'aiCacheHit', label: 'AICacheHit' },
  { key: 'aiCacheMiss', label: 'AICacheMiss' },
  { key: 'aiCallsMade', label: 'AICallsMade' },
  { key: 'orderCreated', label: 'OrderCreated' },
  { key: 'settlementStatus', label: 'SettlementStatus' },
  { key: 'externalSearchUsed', label: 'ExternalSearchUsed' },
  { key: 'externalSearchStatus', label: 'ExternalSearchStatus' },
  { key: 'externalSourceCount', label: 'ExternalSourceCount' },
  { key: 'externalDataQuality', label: 'ExternalDataQuality' },
  { key: 'externalSearchSummary', label: 'SearchSummary' },
  { key: 'preSearchProbability', label: 'PreSearchProbability' },
  { key: 'postSearchProbability', label: 'PostSearchProbability' },
  { key: 'probabilityDelta', label: 'ProbabilityDelta' },
  { key: 'preSearchConfidence', label: 'PreSearchConfidence' },
  { key: 'postSearchConfidence', label: 'PostSearchConfidence' },
  { key: 'confidenceDelta', label: 'ConfidenceDelta' },
  { key: 'decisionImpact', label: 'DecisionImpact' },
  { key: 'marketOnlyFallbackReason', label: 'MarketOnlyFallbackReason' },
  { key: 'extSearchCallsThisCycle', label: 'ExtSearchCallsThisCycle' },
  { key: 'extSearchCacheHits', label: 'ExtSearchCacheHits' },
  { key: 'extSearchCacheMisses', label: 'ExtSearchCacheMisses' },
  { key: 'extSearchTimeouts', label: 'ExtSearchTimeouts' },
  { key: 'extSearchErrors', label: 'ExtSearchErrors' },
  { key: 'extTotalSourcesFound', label: 'ExtTotalSourcesFound' },
  { key: 'extRunnersAffected', label: 'ExtRunnersAffected' },
  { key: 'extDecisionChanges', label: 'ExtDecisionChanges' },
];

const OPPORTUNITY_EXPORT_COLUMNS = [
  { key: 'cycleId', label: 'CycleId' },
  { key: 'rank', label: 'Rank' },
  { key: 'opportunityId', label: 'OpportunityId' },
  { key: 'eventName', label: 'EventName' },
  { key: 'marketName', label: 'MarketName' },
  { key: 'marketTypeCode', label: 'MarketTypeCode' },
  { key: 'detectedMarketType', label: 'DetectedMarketType' },
  { key: 'marketStartTime', label: 'MarketStartTime' },
  { key: 'side', label: 'Side' },
  { key: 'runnerName', label: 'RunnerName' },
  { key: 'selectionId', label: 'SelectionId' },
  { key: 'opponentSelectionId', label: 'OpponentSelectionId' },
  { key: 'odds', label: 'Odds' },
  { key: 'availableSize', label: 'AvailableSize' },
  { key: 'bestBackPrice', label: 'BestBackPrice' },
  { key: 'bestLayPrice', label: 'BestLayPrice' },
  { key: 'bestBackSize', label: 'BestBackSize' },
  { key: 'bestLaySize', label: 'BestLaySize' },
  { key: 'spreadTicks', label: 'SpreadTicks' },
  { key: 'modelProbability', label: 'ModelProbability' },
  { key: 'impliedProbability', label: 'ImpliedProbability' },
  { key: 'breakevenProbability', label: 'BreakevenProbability' },
  { key: 'fairOdds', label: 'FairOdds' },
  { key: 'edge', label: 'Edge' },
  { key: 'ev', label: 'EV' },
  { key: 'roi', label: 'ROI' },
  { key: 'commissionRate', label: 'CommissionRate' },
  { key: 'confidence', label: 'Confidence' },
  { key: 'dataQuality', label: 'DataQuality' },
  { key: 'dataSource', label: 'DataSource' },
  { key: 'delayRiskScore', label: 'DelayRiskScore' },
  { key: 'fillProbability', label: 'FillProbability' },
  { key: 'stake', label: 'Stake' },
  { key: 'liability', label: 'Liability' },
  { key: 'maxProfit', label: 'MaxProfit' },
  { key: 'maxLoss', label: 'MaxLoss' },
  { key: 'failedGate', label: 'FailedGate' },
  { key: 'blocker', label: 'Blocker' },
  { key: 'blockers', label: 'Blockers' },
  { key: 'decision', label: 'Decision' },
  { key: 'rejectionCategory', label: 'RejectionCategory' },
  { key: 'externalSearchUsed', label: 'ExternalSearchUsed' },
  { key: 'externalSearchStatus', label: 'ExternalSearchStatus' },
  { key: 'externalSourceCount', label: 'ExternalSourceCount' },
  { key: 'externalDataQuality', label: 'ExternalDataQuality' },
  { key: 'externalSearchSummary', label: 'SearchSummary' },
  { key: 'externalSearchSourceUrls', label: 'SourceUrls' },
  { key: 'preSearchProbability', label: 'PreSearchProbability' },
  { key: 'postSearchProbability', label: 'PostSearchProbability' },
  { key: 'probabilityDelta', label: 'ProbabilityDelta' },
  { key: 'preSearchConfidence', label: 'PreSearchConfidence' },
  { key: 'postSearchConfidence', label: 'PostSearchConfidence' },
  { key: 'confidenceDelta', label: 'ConfidenceDelta' },
  { key: 'decisionImpact', label: 'DecisionImpact' },
  { key: 'marketOnlyFallbackReason', label: 'MarketOnlyFallbackReason' },
];

function num(v) {
  return v === null || v === undefined || v === '' ? '' : v;
}

function cycleToRow(c) {
  const ss = c.scanSummary || {};
  const bc = c.bestCandidate || {};
  const mfd = ss.marketFeedDiagnostics || {};
  const twf = ss.timeWindowFunnel || {};
  const cd = ss.connectionDiagnostics || {};

  return {
    cycleId: c.cycleNumber,
    timestamp: c.finishedAt || c.startedAt || '',
    debugScanMode: ss.debugScanMode ? 'TRUE' : 'FALSE',
    totalMarketsLoaded: ss.totalMarketsLoaded ?? mfd.marketsInMemory ?? c.marketsScanned ?? 0,
    openPreRaceMarkets: ss.openPreRaceMarkets ?? 0,
    marketsInsideTimeWindow: ss.marketsInsideTimeWindow ?? 0,
    eligibleMarketsAfterRunnerFilter: ss.eligibleMarketsAfterRunnerFilter ?? 0,
    eligibleMarketsAfterPriceFilter: ss.eligibleMarketsAfterPriceFilter ?? 0,
    marketsSentToExchangeEngine: ss.marketsSentToExchangeEngine ?? 0,
    openMarketsScanned: ss.marketsScanned ?? c.marketsScanned ?? 0,
    winMarketsFound: ss.winMarketsFound ?? 0,
    placeMarketsFound: ss.placeMarketsFound ?? 0,
    h2hMarketsFound: ss.h2hMarketsFound ?? 0,
    unknownMarketsFound: ss.unknownMarketsFound ?? 0,
    raceClustersCreated: ss.raceClustersCreated ?? ss.eventsScanned ?? 0,
    opportunitiesGenerated: ss.totalOpportunities ?? 0,
    backOpportunities: ss.backOpportunities ?? 0,
    layOpportunities: ss.layOpportunities ?? 0,
    positiveEvOpportunities: ss.positiveEVOpportunities ?? 0,
    rejectedOpportunities: ss.rejectedOpportunities ?? 0,
    marketsOpen: mfd.marketsOpen ?? 0,
    marketsClosed: mfd.marketsClosed ?? 0,
    marketsSuspended: mfd.marketsSuspended ?? 0,
    marketsInPlay: mfd.marketsInPlay ?? 0,
    marketsNotInPlay: mfd.marketsNotInPlay ?? 0,
    marketsWithStartTime: mfd.marketsWithStartTime ?? 0,
    marketsWithoutStartTime: mfd.marketsWithoutStartTime ?? 0,
    marketsWithRunners: mfd.marketsWithRunners ?? 0,
    marketsWithPriceData: mfd.marketsWithPriceData ?? 0,
    marketsMissingPriceData: mfd.marketsMissingPriceData ?? 0,
    tooEarlyMarkets: twf.tooEarlyMarkets ?? 0,
    insideWindowMarkets: twf.insideWindowMarkets ?? 0,
    tooLateMarkets: twf.tooLateMarkets ?? 0,
    noStartTimeMarkets: twf.noStartTimeMarkets ?? 0,
    betfairApiConnected: cd.betfairApiConnected ? 'TRUE' : 'FALSE',
    streamConnected: cd.streamConnected ? 'TRUE' : 'FALSE',
    lastStreamUpdateAt: cd.lastStreamUpdateAt || '',
    lastCatalogueRefreshAt: cd.lastCatalogueRefreshAt || '',
    marketCatalogueError: cd.marketCatalogueError || '',
    streamError: cd.streamError || '',
    priceFeedStale: cd.priceFeedStale ? 'TRUE' : 'FALSE',
    selectedOpportunityId: bc.opportunityId || '',
    marketId: bc.betfairMarketId || bc.marketId || '',
    eventName: bc.eventName || '',
    marketName: bc.marketName || c.selectedMarketName || '',
    marketTypeCode: bc.marketTypeCode || '',
    detectedMarketType: bc.marketType || bc.detectedMarketType || '',
    side: bc.side || '',
    runnerName: bc.runnerName || '',
    selectionId: bc.selectionId || '',
    opponentSelectionId: bc.opponentSelectionId || '',
    odds: num(bc.odds),
    availableSize: num(bc.liquidity ?? bc.availableSize),
    modelProbability: num(bc.estimatedProbability ?? bc.modelProbability),
    impliedProbability: num(bc.impliedProbability),
    breakevenProbability: num(bc.breakevenProbability),
    fairOdds: num(bc.fairOdds),
    edge: num(bc.edge),
    ev: num(bc.ev),
    roi: num(bc.expectedROI ?? bc.roi),
    commissionRate: num(bc.commissionRate),
    confidence: num(bc.confidence),
    dataQuality: num(bc.dataQuality),
    spreadTicks: num(bc.spread ?? bc.spreadTicks),
    delayRiskScore: num(bc.delayRiskScore),
    fillProbability: num(bc.fillProbability),
    stake: num(bc.stake),
    liability: num(bc.liability),
    maxProfit: num(bc.maxProfit),
    maxLoss: num(bc.maxLoss),
    failedGate: bc.failedGate || bc.mainBlocker || '',
    blocker: bc.mainBlocker || bc.failedGate || c.noBetReason || '',
    decision: c.ordersCreated > 0 ? 'BET' : 'NO_BET',
    aiCacheHit: ss.aiCacheHits ?? ss.cacheHits ?? 0,
    aiCacheMiss: ss.aiCallsMade ?? ss.eventsWithAI ?? 0,
    aiCallsMade: ss.aiCallsMade ?? ss.eventsWithAI ?? 0,
    orderCreated: c.ordersCreated ?? 0,
    settlementStatus: c.status || '',
    externalSearchUsed: bc.externalSearchUsed ? 'TRUE' : 'FALSE',
    externalSearchStatus: bc.externalSearchStatus || 'not_called',
    externalSourceCount: bc.externalSourceCount ?? 0,
    externalDataQuality: bc.externalDataQuality ?? 0,
    externalSearchSummary: bc.externalSearchSummary || '',
    preSearchProbability: num(bc.preSearchProbability),
    postSearchProbability: num(bc.postSearchProbability),
    probabilityDelta: num(bc.probabilityDelta),
    preSearchConfidence: num(bc.preSearchConfidence),
    postSearchConfidence: num(bc.postSearchConfidence),
    confidenceDelta: num(bc.confidenceDelta),
    decisionImpact: bc.decisionImpact || 'no_effect',
    marketOnlyFallbackReason: bc.marketOnlyFallbackReason || '',
    extSearchCallsThisCycle: ss.externalSearchDiagnostics?.callsThisCycle ?? 0,
    extSearchCacheHits: ss.externalSearchDiagnostics?.cacheHits ?? 0,
    extSearchCacheMisses: ss.externalSearchDiagnostics?.cacheMisses ?? 0,
    extSearchTimeouts: ss.externalSearchDiagnostics?.timeouts ?? 0,
    extSearchErrors: ss.externalSearchDiagnostics?.errors ?? 0,
    extTotalSourcesFound: ss.externalSearchDiagnostics?.totalSourcesFound ?? 0,
    extRunnersAffected: ss.externalSearchDiagnostics?.runnersAffected ?? 0,
    extDecisionChanges: (ss.externalSearchDiagnostics?.decisionChanges || []).length,
  };
}

function opportunitiesToRows(cycle) {
  const ss = cycle.scanSummary || {};
  const topOpps = ss.topOpportunities || [];
  const topRejected = ss.topRejected || [];
  const rows = [];

  topOpps.forEach((opp, i) => {
    rows.push({
      cycleId: cycle.cycleNumber,
      rank: i + 1,
      opportunityId: opp.opportunityId || '',
      eventName: opp.eventName || '',
      marketName: opp.marketName || '',
      marketTypeCode: opp.marketTypeCode || '',
      detectedMarketType: opp.detectedMarketType || opp.marketType || '',
      marketStartTime: opp.marketStartTime || '',
      side: opp.side || '',
      runnerName: opp.runnerName || '',
      selectionId: opp.selectionId || '',
      opponentSelectionId: opp.opponentSelectionId || '',
      odds: num(opp.odds),
      availableSize: num(opp.availableSize),
      bestBackPrice: num(opp.bestBackPrice),
      bestLayPrice: num(opp.bestLayPrice),
      bestBackSize: num(opp.bestBackSize),
      bestLaySize: num(opp.bestLaySize),
      spreadTicks: num(opp.spreadTicks),
      modelProbability: num(opp.modelProbability),
      impliedProbability: num(opp.impliedProbability),
      breakevenProbability: num(opp.breakevenProbability),
      fairOdds: num(opp.fairOdds),
      edge: num(opp.edge),
      ev: num(opp.ev),
      roi: num(opp.roi),
      commissionRate: num(opp.commissionRate),
      confidence: num(opp.confidence),
      dataQuality: num(opp.dataQuality),
      dataSource: opp.dataSource || '',
      delayRiskScore: num(opp.delayRiskScore),
      fillProbability: num(opp.fillProbability),
      stake: num(opp.stake),
      liability: num(opp.liability),
      maxProfit: num(opp.maxProfit),
      maxLoss: num(opp.maxLoss),
      failedGate: opp.failedGate || opp.blocker || '',
      blocker: opp.blocker || opp.failedGate || '',
      blockers: (opp.blockers || []).join('; '),
      decision: opp.decision || '',
      rejectionCategory: opp.decision === 'NO_BET' ? 'rejected' : 'accepted',
      externalSearchUsed: opp.externalSearchUsed ? 'TRUE' : 'FALSE',
      externalSearchStatus: opp.externalSearchStatus || 'not_called',
      externalSourceCount: opp.externalSourceCount ?? 0,
      externalDataQuality: opp.externalDataQuality ?? 0,
      externalSearchSummary: opp.externalSearchSummary || '',
      externalSearchSourceUrls: (opp.externalSearchSourceUrls || []).join('; '),
      preSearchProbability: num(opp.preSearchProbability),
      postSearchProbability: num(opp.postSearchProbability),
      probabilityDelta: num(opp.probabilityDelta),
      preSearchConfidence: num(opp.preSearchConfidence),
      postSearchConfidence: num(opp.postSearchConfidence),
      confidenceDelta: num(opp.confidenceDelta),
      decisionImpact: opp.decisionImpact || 'no_effect',
      marketOnlyFallbackReason: opp.marketOnlyFallbackReason || '',
    });
  });

  topRejected.forEach((opp, i) => {
    if (rows.some(r => r.opportunityId === opp.opportunityId)) return;
    rows.push({
      cycleId: cycle.cycleNumber,
      rank: topOpps.length + i + 1,
      opportunityId: opp.opportunityId || `rejected_${i}`,
      eventName: opp.eventName || '',
      marketName: opp.marketName || '',
      marketTypeCode: opp.marketTypeCode || '',
      detectedMarketType: opp.detectedMarketType || opp.marketType || '',
      marketStartTime: opp.marketStartTime || '',
      side: opp.side || '',
      runnerName: opp.runnerName || '',
      selectionId: opp.selectionId || '',
      opponentSelectionId: opp.opponentSelectionId || '',
      odds: num(opp.odds),
      availableSize: num(opp.availableSize),
      bestBackPrice: num(opp.bestBackPrice),
      bestLayPrice: num(opp.bestLayPrice),
      bestBackSize: num(opp.bestBackSize),
      bestLaySize: num(opp.bestLaySize),
      spreadTicks: num(opp.spreadTicks),
      modelProbability: num(opp.modelProbability),
      impliedProbability: num(opp.impliedProbability),
      breakevenProbability: num(opp.breakevenProbability),
      fairOdds: num(opp.fairOdds),
      edge: num(opp.edge),
      ev: num(opp.ev),
      roi: num(opp.roi),
      commissionRate: num(opp.commissionRate),
      confidence: num(opp.confidence),
      dataQuality: num(opp.dataQuality),
      dataSource: opp.dataSource || '',
      delayRiskScore: num(opp.delayRiskScore),
      fillProbability: num(opp.fillProbability),
      stake: num(opp.stake),
      liability: num(opp.liability),
      maxProfit: num(opp.maxProfit),
      maxLoss: num(opp.maxLoss),
      failedGate: opp.failedGate || opp.blocker || '',
      blocker: opp.blocker || opp.failedGate || '',
      blockers: (opp.blockers || []).join('; '),
      decision: 'NO_BET',
      rejectionCategory: 'rejected',
      externalSearchUsed: opp.externalSearchUsed ? 'TRUE' : 'FALSE',
      externalSearchStatus: opp.externalSearchStatus || 'not_called',
      externalSourceCount: opp.externalSourceCount ?? 0,
      externalDataQuality: opp.externalDataQuality ?? 0,
      externalSearchSummary: opp.externalSearchSummary || '',
      externalSearchSourceUrls: (opp.externalSearchSourceUrls || []).join('; '),
      preSearchProbability: num(opp.preSearchProbability),
      postSearchProbability: num(opp.postSearchProbability),
      probabilityDelta: num(opp.probabilityDelta),
      preSearchConfidence: num(opp.preSearchConfidence),
      postSearchConfidence: num(opp.postSearchConfidence),
      confidenceDelta: num(opp.confidenceDelta),
      decisionImpact: opp.decisionImpact || 'no_effect',
      marketOnlyFallbackReason: opp.marketOnlyFallbackReason || '',
    });
  });

  return rows;
}

const LOADED_MARKETS_COLUMNS = [
  { key: 'marketId', label: 'MarketId' },
  { key: 'eventName', label: 'EventName' },
  { key: 'marketName', label: 'MarketName' },
  { key: 'marketTypeCode', label: 'MarketTypeCode' },
  { key: 'detectedMarketType', label: 'DetectedMarketType' },
  { key: 'status', label: 'Status' },
  { key: 'inPlay', label: 'InPlay' },
  { key: 'marketStartTime', label: 'MarketStartTime' },
  { key: 'secondsToJump', label: 'SecondsToJump' },
  { key: 'runnerCount', label: 'RunnerCount' },
  { key: 'hasPriceData', label: 'HasPriceData' },
  { key: 'totalMatched', label: 'TotalMatched' },
];

const NEAREST_MARKETS_COLUMNS = [
  { key: 'marketId', label: 'MarketId' },
  { key: 'eventName', label: 'EventName' },
  { key: 'marketName', label: 'MarketName' },
  { key: 'marketTypeCode', label: 'MarketTypeCode' },
  { key: 'status', label: 'Status' },
  { key: 'inPlay', label: 'InPlay' },
  { key: 'marketStartTime', label: 'MarketStartTime' },
  { key: 'secondsToJump', label: 'SecondsToJump' },
  { key: 'timeWindowCategory', label: 'TimeWindowCategory' },
];

export default function DecisionLogPanel() {
  const { botCycles, clearBotCycles, featherlessSettings, updateFeatherlessSettings } = useApp();
  const [showDebugTable, setShowDebugTable] = useState(false);

  const handleExportCycles = () => {
    if (botCycles.length === 0) return;
    exportToCSV(
      `decision-log-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      botCycles.map(cycleToRow),
      CYCLE_EXPORT_COLUMNS
    );
  };

  const handleExportOpportunities = () => {
    if (botCycles.length === 0) return;
    const rows = botCycles.flatMap(opportunitiesToRows);
    if (rows.length === 0) return;
    exportToCSV(
      `opportunities-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      rows,
      OPPORTUNITY_EXPORT_COLUMNS
    );
  };

  const handleExportLoadedMarkets = () => {
    if (botCycles.length === 0) return;
    const latest = botCycles[0];
    const table = latest.scanSummary?.loadedMarketsTable || [];
    if (table.length === 0) return;
    exportToCSV(
      `loaded-markets-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      table,
      LOADED_MARKETS_COLUMNS
    );
  };

  const handleExportNearestMarkets = () => {
    if (botCycles.length === 0) return;
    const latest = botCycles[0];
    const funnel = latest.scanSummary?.timeWindowFunnel || {};
    const nearest = funnel.nearestMarkets || [];
    if (nearest.length === 0) return;
    exportToCSV(
      `nearest-markets-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`,
      nearest,
      NEAREST_MARKETS_COLUMNS
    );
  };

  const debugScanMode = featherlessSettings?.debugScanMode === true;
  const latestCycle = botCycles[0];
  const latestSS = latestCycle?.scanSummary || {};
  const loadedMarkets = latestSS.loadedMarketsTable || [];
  const nearestMarkets = latestSS.timeWindowFunnel?.nearestMarkets || [];

  return (
    <Panel
      title={`Decision Log (${botCycles.length})`}
      action={
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/50">
            <Switch
              checked={debugScanMode}
              onCheckedChange={(checked) => updateFeatherlessSettings({ debugScanMode: checked })}
              className="scale-75"
            />
            <span className="text-[10px] font-medium text-muted-foreground">Debug Scan</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setShowDebugTable(!showDebugTable)} disabled={botCycles.length === 0}>
            <TableProperties className="h-3.5 w-3.5" />
            {showDebugTable ? 'Hide' : 'Show'} Markets
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportNearestMarkets} disabled={botCycles.length === 0}>
            <Globe className="h-3.5 w-3.5" />
            Nearest
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportLoadedMarkets} disabled={botCycles.length === 0}>
            <TableProperties className="h-3.5 w-3.5" />
            Loaded
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportOpportunities} disabled={botCycles.length === 0}>
            <ListChecks className="h-3.5 w-3.5" />
            Opportunities
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCycles} disabled={botCycles.length === 0}>
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
          <Button size="sm" variant="destructive" onClick={clearBotCycles} disabled={botCycles.length === 0}>
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      }
    >
      {debugScanMode && (
        <div className="px-4 py-2 bg-chart-4/10 border-b border-chart-4/30 text-[10px] text-chart-4 font-medium">
          DEBUG SCAN MODE ACTIVE — Time window ignored, NO orders will be placed. Diagnostic opportunities only.
        </div>
      )}
      {showDebugTable && loadedMarkets.length > 0 && (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
            Loaded Markets ({loadedMarkets.length} shown · nearest first)
          </div>
          <div className="max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] h-7 px-2">Market</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Type</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Status</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Secs</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Runners</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Prices</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadedMarkets.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[10px] px-2 py-1 truncate max-w-[160px]">{m.marketName || m.eventName || m.marketId}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">{m.detectedMarketType || '—'}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">{m.status}{m.inPlay ? ' (IP)' : ''}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{m.secondsToJump ?? '—'}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{m.runnerCount}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">{m.hasPriceData ? '✓' : '✗'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {showDebugTable && nearestMarkets.length > 0 && (
        <div className="border-b border-border">
          <div className="px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/30">
            Time-Window Funnel — Nearest 20 Markets
          </div>
          <div className="max-h-48 overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[9px] h-7 px-2">Market</TableHead>
                  <TableHead className="text-[9px] h-7 px-2 text-right">Secs</TableHead>
                  <TableHead className="text-[9px] h-7 px-2">Window</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {nearestMarkets.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-[10px] px-2 py-1 truncate max-w-[200px]">{m.marketName || m.eventName || m.marketId}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1 text-right font-mono">{m.secondsToJump ?? '—'}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1">
                      <StatusBadge status={
                        m.timeWindowCategory === 'inside_window' ? 'ok' :
                        m.timeWindowCategory === 'too_early' ? 'info' :
                        m.timeWindowCategory === 'too_late' ? 'warning' : 'neutral'
                      }>
                        {m.timeWindowCategory?.replace('_', ' ')}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {botCycles.length === 0 ? (
        <div className="p-8 flex flex-col items-center justify-center text-center">
          <FileText className="h-8 w-8 text-muted-foreground mb-2" />
          <div className="text-sm font-medium text-muted-foreground">No decisions logged yet</div>
          <div className="text-xs text-muted-foreground mt-1">Run the bot to start logging every cycle decision.</div>
        </div>
      ) : (
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-[10px] h-8 px-2">#</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Time</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Loaded</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">W/P/H</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Opps</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Decision</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Market</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Runner</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">Odds</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">EV</TableHead>
                <TableHead className="text-[10px] h-8 px-2 text-right">AI</TableHead>
                <TableHead className="text-[10px] h-8 px-2">Blocker / Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {botCycles.map((c) => {
                const ss = c.scanSummary || {};
                const bc = c.bestCandidate || {};
                const isBet = c.ordersCreated > 0;
                const time = c.finishedAt || c.startedAt;
                const aiHits = ss.aiCacheHits ?? ss.cacheHits ?? 0;
                const aiCalls = ss.aiCallsMade ?? ss.eventsWithAI ?? 0;
                const aiLabel = ss.aiDisabled ? 'OFF' : (aiHits > 0 ? `${aiHits}H` : `${aiCalls}C`);
                const loaded = ss.totalMarketsLoaded ?? c.marketsScanned ?? 0;
                return (
                  <TableRow key={c.id || c.cycleNumber}>
                    <TableCell className="text-xs px-2 py-1.5 font-mono font-bold">{c.cycleNumber}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {time ? new Date(time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{loaded}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-right font-mono text-muted-foreground">
                      {ss.winMarketsFound ?? 0}/{ss.placeMarketsFound ?? 0}/{ss.h2hMarketsFound ?? 0}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{ss.totalOpportunities ?? 0}</TableCell>
                    <TableCell className="text-xs px-2 py-1.5">
                      <StatusBadge status={isBet ? 'ok' : 'danger'}>{isBet ? 'BET' : 'NO BET'}</StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 truncate max-w-[140px]">
                      {bc.marketName || c.selectedMarketName || '—'}
                      {bc.marketType && <span className="text-muted-foreground ml-1">({bc.marketType})</span>}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 truncate max-w-[120px] font-medium">
                      {bc.side && <span className="text-muted-foreground mr-1">{bc.side}</span>}
                      {bc.runnerName || '—'}
                    </TableCell>
                    <TableCell className="text-xs px-2 py-1.5 text-right font-mono">{bc.odds != null ? bc.odds.toFixed(2) : '—'}</TableCell>
                    <TableCell className={`text-xs px-2 py-1.5 text-right font-mono ${bc.ev > 0 ? 'text-chart-1' : 'text-chart-5'}`}>
                      {bc.ev != null ? `$${bc.ev.toFixed(2)}` : '—'}
                    </TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-right font-mono text-muted-foreground">{aiLabel}</TableCell>
                    <TableCell className="text-[10px] px-2 py-1.5 text-muted-foreground truncate max-w-[180px]">
                      {bc.mainBlocker || c.noBetReason || (isBet ? 'Bet placed' : '—')}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}