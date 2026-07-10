// ============================================================================
// Scan Diagnostics
//
// Runs candidate scoring across all eligible runners in the best eligible
// market, producing a scan summary, best candidate, and "why no bet"
// diagnostics for transparent bot decision reporting.
// ============================================================================

import { scoreRunnerCandidate, resolveThresholds, REJECTION_REASONS, fmtPct } from './candidateScoring';
import { matchRunnerToMarket, matchOrderToMarket, matchSelectionId } from './marketIdMatcher';

const OPEN_ORDER_STATUSES = ['pending', 'executable', 'matched', 'unmatched', 'partially_matched'];
const STRATEGY_NAME = 'Featherless AI Value Decision Engine';

/**
 * Build scan diagnostics for a bot cycle.
 *
 * @param {Array} markets - All markets
 * @param {Array} runners - All runners
 * @param {object} settings - App settings
 * @param {object} aiSettings - Featherless AI settings
 * @param {Array} paperOrders - Existing paper orders (for duplicate check)
 * @param {object} bankrollStats - Current bankroll stats
 * @param {boolean} emergencyStop - Whether emergency stop is active
 * @returns {object} { scanSummary, bestCandidate, assessedRunners, noBetReason, selectedMarket }
 */
export function buildScanDiagnostics(markets, runners, settings, aiSettings, paperOrders, bankrollStats, emergencyStop) {
  if (emergencyStop) {
    return {
      scanSummary: emptyScanSummary(REJECTION_REASONS.EMERGENCY_STOP_ACTIVE),
      bestCandidate: null,
      assessedRunners: [],
      noBetReason: REJECTION_REASONS.EMERGENCY_STOP_ACTIVE,
      selectedMarket: null,
    };
  }

  // Filter eligible markets
  const candidates = markets.filter(m => m.status === 'OPEN' && !m.inPlay);

  // Sort by proximity to trading window
  const windowStart = settings.defaultTimeWindowStartSeconds || 500;
  const windowEnd = settings.defaultTimeWindowEndSeconds || 30;
  const nowMs = Date.now();
  const sorted = candidates
    .map(m => {
      const start = m.startTime ? new Date(m.startTime).getTime() : NaN;
      const secsBefore = isNaN(start) ? null : (start - nowMs) / 1000;
      let distance;
      if (secsBefore === null) distance = Infinity;
      else if (secsBefore >= windowEnd && secsBefore <= windowStart) distance = 0;
      else if (secsBefore > windowStart) distance = secsBefore - windowStart;
      else if (secsBefore > 0) distance = windowEnd - secsBefore;
      else distance = Infinity;
      return { market: m, secsBefore, distance };
    })
    .sort((a, b) => a.distance - b.distance);

  const minOdds = aiSettings?.minOdds ?? settings.minOdds ?? 1.5;
  const maxOdds = aiSettings?.maxOdds ?? settings.maxOdds ?? 20;
  const sizeThreshold = 2;

  let marketsScanned = candidates.length;
  let runnersAssessed = 0;
  let passedLiquidity = 0, passedOddsRange = 0, passedEdge = 0, passedROI = 0, passedConfidence = 0;
  const allAssessedRunners = [];
  let bestCandidate = null;
  let selectedMarket = null;

  for (const { market, secsBefore } of sorted) {
    const marketRunners = runners.filter(r =>
      matchRunnerToMarket(r, market) && r.status === 'ACTIVE'
    );
    if (marketRunners.length === 0) continue;

    // Skip market if strategy already has an open order here
    const hasOpenStrategyOrder = paperOrders.some(o =>
      matchOrderToMarket(o, market) &&
      o.strategyName === STRATEGY_NAME &&
      OPEN_ORDER_STATUSES.includes(o.status)
    );
    if (hasOpenStrategyOrder) continue;

    selectedMarket = market;
    const commissionRate = market.marketBaseRate ?? settings.defaultCommissionRate ?? 0.05;
    const dataSource = determineDataSource(marketRunners);

    for (const runner of marketRunners) {
      if (!runner.bestBackPrice || runner.bestBackPrice <= 0) continue;

      const hasDupOrder = paperOrders.some(o =>
        matchOrderToMarket(o, market) &&
        (matchSelectionId(o.selectionId, runner.betfairSelectionId) || matchSelectionId(o.runnerId, runner.id)) &&
        o.strategyName === STRATEGY_NAME &&
        OPEN_ORDER_STATUSES.includes(o.status)
      );
      if (hasDupOrder) continue;

      runnersAssessed++;

      const scored = scoreRunnerCandidate({
        runner,
        market,
        settings,
        aiSettings,
        marketContext: {
          timeBeforeJump: secsBefore,
          commissionRate,
          inPlay: market.inPlay,
          marketStatus: market.status,
          dataSource,
          totalTradedVolume: market.totalMatched || 0,
        },
      });

      // Track pass counts per gate
      const ft = scored.failedThresholds;
      if (!ft.some(f => f.key === 'LIQUIDITY_TOO_LOW' || f.key === 'NO_AVAILABLE_PRICE')) passedLiquidity++;
      if (!ft.some(f => f.key === 'ODDS_OUTSIDE_RANGE')) passedOddsRange++;
      if (!ft.some(f => f.key === 'EDGE_BELOW_THRESHOLD')) passedEdge++;
      if (!ft.some(f => f.key === 'ROI_BELOW_THRESHOLD')) passedROI++;
      if (!ft.some(f => f.key === 'CONFIDENCE_BELOW_THRESHOLD')) passedConfidence++;

      allAssessedRunners.push({
        runnerName: scored.runnerName,
        selectionId: scored.selectionId,
        odds: scored.bestBack,
        edge: scored.valueEdge,
        expectedROI: scored.expectedROI,
        confidence: scored.confidence,
        liquidity: Math.min(runner.bestBackSize || 0, runner.bestLaySize || 0),
        spread: scored.spread,
        overallScore: scored.overallScore,
        status: scored.passed ? 'pass' : 'fail',
        failedReason: scored.mainBlocker || '',
        dataSource: scored.dataSource,
        marketMovement: scored.marketMovement,
      });

      if (!bestCandidate || scored.overallScore > bestCandidate.overallScore) {
        bestCandidate = {
          runnerName: scored.runnerName,
          selectionId: scored.selectionId,
          runnerId: scored.runnerId,
          marketId: market.id,
          betfairMarketId: market.betfairMarketId,
          marketName: market.venue ? `${market.venue} - ${market.marketName}` : market.marketName,
          odds: scored.bestBack,
          edge: scored.valueEdge,
          expectedROI: scored.expectedROI,
          confidence: scored.confidence,
          liquidity: Math.min(runner.bestBackSize || 0, runner.bestLaySize || 0),
          spread: scored.spread,
          overallScore: scored.overallScore,
          failedThresholds: scored.failedThresholds,
          mainBlocker: scored.mainBlocker,
          passed: scored.passed,
          dataSource: scored.dataSource,
          marketMovement: scored.marketMovement,
          estimatedProbability: scored.estimatedProbability,
          impliedProbability: scored.impliedProbability,
          fairOdds: scored.fairOdds,
        };
      }
    }

    if (allAssessedRunners.length > 0) break;
  }

  const thresholds = resolveThresholds(aiSettings);

  let noBetReason = null;
  if (!bestCandidate) {
    noBetReason = runnersAssessed === 0
      ? 'No eligible runners with prices found in any open market.'
      : 'No candidate identified.';
  } else if (!bestCandidate.passed) {
    const minEdgeDecimal = thresholds.minEdge / 100;
    const minROIDecimal = thresholds.minExpectedROI / 100;
    const minConfDecimal = thresholds.minConfidence / 100;
    noBetReason = `No paper bet: ${bestCandidate.runnerName} was closest, but ${bestCandidate.mainBlocker}. ` +
      `Edge was ${fmtPct(bestCandidate.edge)} (required ${fmtPct(minEdgeDecimal)}), ` +
      `Expected ROI was ${fmtPct(bestCandidate.expectedROI)} (required ${fmtPct(minROIDecimal)}), ` +
      `Confidence was ${fmtPct(bestCandidate.confidence)} (required ${fmtPct(minConfDecimal)}).`;
  }

  const scanSummary = {
    marketsScanned,
    runnersAssessed,
    candidatesPassedLiquidity: passedLiquidity,
    candidatesPassedOddsRange: passedOddsRange,
    candidatesPassedEdge: passedEdge,
    candidatesPassedROI: passedROI,
    candidatesPassedConfidence: passedConfidence,
    paperBetsCreated: bestCandidate?.passed ? 1 : 0,
    noBetReason,
    thresholds,
  };

  return {
    scanSummary,
    bestCandidate,
    assessedRunners: allAssessedRunners.sort((a, b) => b.overallScore - a.overallScore),
    noBetReason,
    selectedMarket,
  };
}

function determineDataSource(marketRunners) {
  const hasFormProfiles = marketRunners.some(r => r.raceFormProfile);
  if (hasFormProfiles) {
    const hasExternal = marketRunners.some(r => r.raceFormProfile?.externalFormData);
    return hasExternal ? 'EXTERNAL_FORM_PLUS_MARKET' : 'BETFAIR_METADATA_PLUS_MARKET';
  }
  return 'MARKET_ONLY';
}

function emptyScanSummary(noBetReason) {
  return {
    marketsScanned: 0,
    runnersAssessed: 0,
    candidatesPassedLiquidity: 0,
    candidatesPassedOddsRange: 0,
    candidatesPassedEdge: 0,
    candidatesPassedROI: 0,
    candidatesPassedConfidence: 0,
    paperBetsCreated: 0,
    noBetReason,
    thresholds: null,
  };
}