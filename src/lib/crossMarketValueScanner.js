// ============================================================================
// Cross-Market Value Scanner
//
// Given event clusters, AI probabilities, and market data, generates BACK and
// LAY opportunities for every active runner in every eligible market (WIN,
// PLACE, H2H).
//
// Each opportunity includes full exchange maths: EV, ROI, edge, confidence,
// data quality, spread, liquidity, delay risk, fill probability, exposure,
// and the decision (BET / NO_BET) with reasons and blockers.
// ============================================================================

import { detectMarketType, extractPlaceTerms } from './marketClusterer';
import { calcOverround, calcKellyStake, calcLayKellyStake, applyStakeCaps, buildCalculationResult, calcDelayRiskScore, calcFillProbability } from './exchangeMath';
import { buildProbabilityMap, buildH2HMap, estimatePlaceProbabilities, normalizeWinProbabilities } from './probabilityNormalizer';
import { calculateSpreadTicks } from './tickLadder';
import { countTicksBetween } from './tickLadder';
import { findRunnerResearch, applyExternalAdjustment, applyConfidenceAdjustment, determineDecisionImpact, getMarketOnlyFallbackReason } from './externalSearchIntegration';
import { isPaperProofModeActive, isSoftBlocker, calcProofStake } from './paperProofDefaults';
import { matchRunnerToMarket, matchOrderToMarket, matchSelectionId } from './marketIdMatcher';
import { calculateFavouriteContext, calculateRunnerContextScores, applyFavouriteContextToOpportunity, generateSpecificNoBetReason } from './favouriteValueContext';
import { compareOpportunities, scoreOpportunity } from './opportunityRanking';
import { DECISION_SOURCES, dataSourceForDecisionSource } from './decisionProvenance';
import { ACTIVE_ORDER_STATUSES, exposureBlock, normalizedMarketId } from './raceExposure';
import { resolveCommissionRate } from './commission';
import { validateCompleteMarketBook } from './marketBookValidation';
import { buildNormalizedFavouriteProbabilityField } from './favouriteProbabilityField';

const OPEN_ORDER_STATUSES = ACTIVE_ORDER_STATUSES;

/**
 * Market-type-specific safety gate thresholds.
 */
export const MARKET_TYPE_THRESHOLDS = {
  WIN: {
    minOdds: 1.5,
    maxOdds: 50,
    minLiquidity: 20,
    maxSpreadTicks: 7,
    minEdge: 3,      // percent
    minROI: 1,       // percent
  },
  PLACE: {
    minOdds: 1.2,
    maxOdds: 30,
    minLiquidity: 10,
    maxSpreadTicks: 7,
    minEdge: 2,
    minROI: 1,
  },
  H2H: {
    minOdds: 1.2,
    maxOdds: 15,
    minLiquidity: 10,
    maxSpreadTicks: 5,
    minEdge: 3,
    minROI: 1,
  },
};

/**
 * Resolve thresholds for a market type, merging user settings overrides.
 */
export function resolveMarketTypeThresholds(marketType, featherlessSettings) {
  const defaults = MARKET_TYPE_THRESHOLDS[marketType] || MARKET_TYPE_THRESHOLDS.WIN;
  const prefix = marketType.toLowerCase();

  return {
    minOdds: featherlessSettings?.[`${prefix}MinOdds`] ?? defaults.minOdds,
    maxOdds: featherlessSettings?.[`${prefix}MaxOdds`] ?? defaults.maxOdds,
    minLiquidity: featherlessSettings?.[`${prefix}MinLiquidity`] ?? defaults.minLiquidity,
    maxSpreadTicks: featherlessSettings?.[`${prefix}MaxSpreadTicks`] ?? defaults.maxSpreadTicks,
    minEdge: featherlessSettings?.[`${prefix}MinEdge`] ?? defaults.minEdge,
    minROI: featherlessSettings?.[`${prefix}MinROI`] ?? defaults.minROI,
  };
}

/**
 * Generate all BACK and LAY opportunities for a single event cluster.
 *
 * @param {object} cluster - Event cluster from marketClusterer
 * @param {Array} allRunners - All runners (will be filtered to this cluster's markets)
 * @param {object} aiResult - AI probabilities for this event { runnerProbabilities, h2hProbabilities, dataQuality, raceSummary }
 * @param {object} settings - App settings
 * @param {object} featherlessSettings - Featherless AI settings
 * @param {object} bankrollStats - Current bankroll stats
 * @param {Array} paperOrders - Existing paper orders (for duplicate/exposure checks)
 * @returns {Array} Array of opportunity objects
 */
export function generateOpportunitiesForEvent(cluster, allRunners, aiResult, settings, botSettings, featherlessSettings, bankrollStats, paperOrders, externalSearchResult) {
  const opportunities = [];
  const normalizedWinField = normalizeWinProbabilities(aiResult?.runnerProbabilities || []);
  const placeField = estimatePlaceProbabilities(normalizedWinField, Math.max(1, Number(cluster.placeMarkets?.[0]?.numberOfWinners || extractPlaceTerms(cluster.placeMarkets?.[0] || {}) || 2)));
  const probMap = buildProbabilityMap(placeField);
  const h2hMap = buildH2HMap(aiResult?.h2hProbabilities);
  const dataQuality = aiResult?.dataQuality ?? 50;
  const raceSummary = aiResult?.raceSummary || '';
  const extSearchEnabled = featherlessSettings?.externalSearchEnabled === true;
  const extSearchSuccess = externalSearchResult?.searchStatus === 'success';
  const externalQualityOk = (externalSearchResult?.dataQuality || 0) >= (featherlessSettings?.minExternalDataQuality ?? 50) && (externalSearchResult?.sourceCount || 0) >= (featherlessSettings?.minExternalSourceCount ?? 2);
  const externallyAdjustedWinField = normalizeWinProbabilities(normalizedWinField.map(item => {
    const research = extSearchSuccess && externalQualityOk ? findRunnerResearch(externalSearchResult, item.selectionId) : null;
    const adjusted = research ? applyExternalAdjustment(item.pWin, research, featherlessSettings, externalSearchResult.dataQuality) : { postSearchProbability:item.pWin };
    return { ...item, pWin:adjusted.postSearchProbability };
  }));
  const canonicalWinProbabilityMap = new Map(externallyAdjustedWinField.map(item => [String(item.selectionId), item.pWin]));
  const baseDecisionSource = aiResult?.decisionSource || DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY;

  const allMarkets = [
    ...cluster.winMarkets,
    ...cluster.placeMarkets,
    ...cluster.h2hMarkets,
  ];

  for (const market of allMarkets) {
    const marketType = detectMarketType(market);
    if (marketType === 'UNKNOWN') continue;

    const thresholds = resolveMarketTypeThresholds(marketType, featherlessSettings);
    const marketRunners = allRunners.filter(r => matchRunnerToMarket(r, market) && r.status === 'ACTIVE');
    const marketBookValidation = validateCompleteMarketBook(marketRunners, settings.maxBackBookPercentage || 150);
    if (!marketBookValidation.valid) continue;
    const commissionResult = resolveCommissionRate(market, settings);
    if (!commissionResult.valid) continue;
    const commissionRate = commissionResult.normalizedRate;

    // Calculate market overround for diagnostics
    const allBackOdds = marketRunners.map(r => r.bestBackPrice).filter(o => o > 0);
    const overround = calcOverround(allBackOdds);

    for (const runner of marketRunners) {
      const selectionId = String(runner.betfairSelectionId || runner.selectionId || '');
      if (!selectionId) continue;

      // Existing exposure is recorded as an explicit rejection in buildOpportunity;
      // candidates are retained so the scanner cannot silently move to another runner.

      // Get the appropriate probability for this market type
      let modelProbability = 0;
      let opponentSelectionId = null;
      const probData = probMap.get(selectionId);

      if (marketType === 'WIN') {
        modelProbability = probData?.pWin || 0;
      } else if (marketType === 'PLACE') {
        modelProbability = probData?.pPlace || 0;
      } else if (marketType === 'H2H') {
        // Look up H2H probability
        const h2hKey = `${market.id}:${selectionId}`;
        const h2hData = h2hMap.get(h2hKey);
        if (h2hData) {
          modelProbability = h2hData.pBeatsOpponent;
          opponentSelectionId = h2hData.opponentSelectionId;
        } else {
          continue;
        }
      }

      if (modelProbability <= 0 || modelProbability >= 1) continue;

      // ── Apply external search probability adjustment ──
      const preSearchProbability = modelProbability;
      const preSearchConfidence = probData?.confidence || 0;
      let postSearchProbability = preSearchProbability;
      let postSearchConfidence = preSearchConfidence;
      let probabilityDelta = 0;
      let confidenceDelta = 0;
      let decisionImpact = 'no_effect';
      let externalSearchUsed = false;
      let externalSearchStatus = 'not_called';
      let externalSourceCount = 0;
      let externalDataQuality = 0;
      let externalPositiveSignals = [];
      let externalNegativeSignals = [];
      let externalNeutralSignals = [];
      let externalSearchSummary = '';
      let externalSearchSourceUrls = [];
      let marketOnlyFallbackReason = null;

      if (extSearchEnabled) {
        if (extSearchSuccess) {
          const runnerResearch = findRunnerResearch(externalSearchResult, selectionId);
          externalSearchUsed = !!runnerResearch;
          externalSearchStatus = externalSearchResult.searchStatus;
          externalSourceCount = externalSearchResult.sourceCount || 0;
          externalDataQuality = externalSearchResult.dataQuality || 0;

          // ── Data quality gate: check externalSearchResult-level data quality and source count ──
          const minDataQuality = featherlessSettings?.minExternalDataQuality ?? 50;
          const minSourceCount = featherlessSettings?.minExternalSourceCount ?? 2;
          const qualityOk = externalDataQuality >= minDataQuality;
          const sourceCountOk = externalSourceCount >= minSourceCount;

          if (runnerResearch && qualityOk && sourceCountOk) {
            const adjResult = applyExternalAdjustment(preSearchProbability, runnerResearch, featherlessSettings, externalDataQuality);
            postSearchProbability = adjResult.postSearchProbability;
            probabilityDelta = adjResult.probabilityDelta;

            const confResult = applyConfidenceAdjustment(preSearchConfidence, runnerResearch, featherlessSettings);
            postSearchConfidence = confResult.postSearchConfidence;
            confidenceDelta = confResult.confidenceDelta;

            externalPositiveSignals = runnerResearch.positiveSignals || [];
            externalNegativeSignals = runnerResearch.negativeSignals || [];
            externalNeutralSignals = runnerResearch.neutralSignals || [];
            externalSearchSummary = `${externalPositiveSignals.length} positive, ${externalNegativeSignals.length} negative, ${externalNeutralSignals.length} neutral signals`;
            externalSearchSourceUrls = (runnerResearch.sourceUrls || []).slice(0, 10);
          } else if (runnerResearch && (!qualityOk || !sourceCountOk)) {
            // External search succeeded but data quality or source count below threshold
            // Do NOT apply probability adjustment — fall back to market-only probability
            externalSearchUsed = false;
            postSearchProbability = preSearchProbability;
            probabilityDelta = 0;
            decisionImpact = 'blocked_due_to_bad_external_data';
            marketOnlyFallbackReason = `External data quality ${externalDataQuality} < ${minDataQuality} or sources ${externalSourceCount} < ${minSourceCount}`;
            externalSearchSummary = `Blocked: data quality below threshold (${externalDataQuality}/${minDataQuality}, ${externalSourceCount}/${minSourceCount} sources)`;
          }

          if (decisionImpact !== 'blocked_due_to_bad_external_data') {
            decisionImpact = determineDecisionImpact(
              probabilityDelta, confidenceDelta, externalSearchUsed, externalDataQuality, featherlessSettings
            );
          }
        } else {
          // External search enabled but failed/timed out
          externalSearchStatus = externalSearchResult?.searchStatus || 'error';
          externalDataQuality = externalSearchResult?.dataQuality || 0;
          marketOnlyFallbackReason = getMarketOnlyFallbackReason(externalSearchResult);
          decisionImpact = 'fallback_market_only';
        }
      } else {
        externalSearchStatus = 'not_called';
        marketOnlyFallbackReason = 'OPENAI_SEARCH_DISABLED';
        decisionImpact = 'fallback_market_only';
      }

      // Use post-search probability for all EV calculations
      // Clamp to valid range
      const adjustedProbability = marketType === 'WIN'
        ? (canonicalWinProbabilityMap.get(selectionId) || 0)
        : Math.max(0.000001, Math.min(0.999999, postSearchProbability));

      // ── BACK opportunity ──
      if (runner.bestBackPrice > 0 && (runner.bestBackSize || 0) >= 2) {
        const backOpp = buildOpportunity({
          cluster, market, runner, marketType, thresholds, commissionRate, settings, botSettings, featherlessSettings,
          bankrollStats, paperOrders, modelProbability: adjustedProbability, probData, dataQuality, raceSummary, overround,
          side: 'BACK', odds: runner.bestBackPrice, availableSize: runner.bestBackSize || 0,
          opponentSelectionId,
          decisionSource: externalSearchUsed ? DECISION_SOURCES.OPENAI_WEB_ENRICHED : baseDecisionSource,
          externalSearchFields: {
            externalSearchUsed, externalSearchStatus, externalSourceCount, externalDataQuality,
            preSearchProbability, postSearchProbability, probabilityDelta,
            preSearchConfidence, postSearchConfidence, confidenceDelta,
            externalPositiveSignals, externalNegativeSignals, externalNeutralSignals,
            externalSearchSummary, externalSearchSourceUrls, decisionImpact, marketOnlyFallbackReason,
          },
        });
        opportunities.push(backOpp);
      }

      // ── LAY opportunity ──
      if (runner.bestLayPrice > 0 && (runner.bestLaySize || 0) >= 2) {
        const layOpp = buildOpportunity({
          cluster, market, runner, marketType, thresholds, commissionRate, settings, botSettings, featherlessSettings,
          bankrollStats, paperOrders, modelProbability: adjustedProbability, probData, dataQuality, raceSummary, overround,
          side: 'LAY', odds: runner.bestLayPrice, availableSize: runner.bestLaySize || 0,
          opponentSelectionId,
          decisionSource: externalSearchUsed ? DECISION_SOURCES.OPENAI_WEB_ENRICHED : baseDecisionSource,
          externalSearchFields: {
            externalSearchUsed, externalSearchStatus, externalSourceCount, externalDataQuality,
            preSearchProbability, postSearchProbability, probabilityDelta,
            preSearchConfidence, postSearchConfidence, confidenceDelta,
            externalPositiveSignals, externalNegativeSignals, externalNeutralSignals,
            externalSearchSummary, externalSearchSourceUrls, decisionImpact, marketOnlyFallbackReason,
          },
        });
        opportunities.push(layOpp);
      }
    }
  }

  // ── Apply Favourite Value Context and recalculate all probability-dependent maths ──
  const winMarket = allMarkets.find(m => detectMarketType(m) === 'WIN');
  if (winMarket) {
    const winRunners = allRunners.filter(r => matchRunnerToMarket(r, winMarket) && r.status === 'ACTIVE');
    const favouriteContext = calculateFavouriteContext(winRunners);
    const runnerContextScores = calculateRunnerContextScores(winRunners, favouriteContext, externalSearchResult);
    const normalizedFavouriteField = buildNormalizedFavouriteProbabilityField(opportunities, favouriteContext, runnerContextScores, featherlessSettings);

    for (let i = 0; i < opportunities.length; i++) {
      const original = opportunities[i];
      const runnerScore = runnerContextScores.find(s => s.selectionId === original.selectionId);
      const contextAdjusted = applyFavouriteContextToOpportunity(original, favouriteContext, runnerScore, featherlessSettings);
      const normalizedFavourite = normalizedFavouriteField.get(String(original.selectionId));
      const adjusted = original.marketType === 'WIN' && normalizedFavourite
        ? { ...contextAdjusted, favouriteContextAdjustment:normalizedFavourite.adjustment, finalProbabilityUsedInEV:normalizedFavourite.probability }
        : contextAdjusted;
      let finalOpportunity = adjusted;

      if (Math.abs((adjusted.finalProbabilityUsedInEV ?? original.modelProbability) - original.modelProbability) > 0.000001) {
        const market = allMarkets.find(m => String(m.id) === String(original.marketId) || String(m.betfairMarketId) === String(original.betfairMarketId));
        const runner = allRunners.find(r => matchRunnerToMarket(r, market) && String(r.betfairSelectionId || r.selectionId) === String(original.selectionId));
        if (market && runner) {
          const rebuilt = buildOpportunity({ cluster, market, runner, marketType: original.marketType, thresholds: resolveMarketTypeThresholds(original.marketType, featherlessSettings), commissionRate: original.commissionRate, settings, botSettings, featherlessSettings, bankrollStats, paperOrders, modelProbability: adjusted.finalProbabilityUsedInEV, probData: { ...(probMap.get(original.selectionId) || {}), confidence: adjusted.confidence }, dataQuality: adjusted.dataQuality, raceSummary, overround: original.overround, side: original.side, odds: original.odds, availableSize: original.availableSize, opponentSelectionId: original.opponentSelectionId, decisionSource: original.decisionSource, externalSearchFields: { externalSearchUsed: original.externalSearchUsed, externalSearchStatus: original.externalSearchStatus, externalSourceCount: original.externalSourceCount, externalDataQuality: original.externalDataQuality, preSearchProbability: original.preSearchProbability, postSearchProbability: original.postSearchProbability, probabilityDelta: original.probabilityDelta, preSearchConfidence: original.preSearchConfidence, postSearchConfidence: original.postSearchConfidence, confidenceDelta: original.confidenceDelta, externalPositiveSignals: original.externalPositiveSignals, externalNegativeSignals: original.externalNegativeSignals, externalNeutralSignals: original.externalNeutralSignals, externalSearchSummary: original.externalSearchSummary, externalSearchSourceUrls: original.externalSearchSourceUrls, decisionImpact: original.decisionImpact, marketOnlyFallbackReason: original.marketOnlyFallbackReason } });
          finalOpportunity = { ...adjusted, ...rebuilt, favouriteSelectionId: adjusted.favouriteSelectionId, favouriteName: adjusted.favouriteName, isFavourite: adjusted.isFavourite, favouriteOdds: adjusted.favouriteOdds, favouriteDominanceScore: adjusted.favouriteDominanceScore, fieldStrengthCategory: adjusted.fieldStrengthCategory, qualityThreatCount: adjusted.qualityThreatCount, runnerContextScore: adjusted.runnerContextScore, marketScore: adjusted.marketScore, formScore: adjusted.formScore, pressureScore: adjusted.pressureScore, baseProbability: adjusted.baseProbability, favouriteContextAdjustment: adjusted.favouriteContextAdjustment, finalProbabilityUsedInEV: adjusted.finalProbabilityUsedInEV, contextAdjustmentReason: adjusted.contextAdjustmentReason, favouriteValueWarning: adjusted.favouriteValueWarning };
        }
      }
      if (finalOpportunity.favouriteValueWarning?.startsWith('LAY favourite blocked')) finalOpportunity = { ...finalOpportunity, decision: 'NO_BET', blockers: [...finalOpportunity.blockers, finalOpportunity.favouriteValueWarning], failedGate: finalOpportunity.favouriteValueWarning };
      if (finalOpportunity.decision === 'NO_BET') finalOpportunity.specificNoBetReason = generateSpecificNoBetReason(finalOpportunity, favouriteContext, featherlessSettings);
      opportunities[i] = finalOpportunity;
    }
  }

  return opportunities;
}

/**
 * Build a single opportunity object with full exchange maths and safety gate.
 */
function buildOpportunity({
  cluster, market, runner, marketType, thresholds, commissionRate, settings, botSettings, featherlessSettings,
  bankrollStats, paperOrders, modelProbability, probData, dataQuality, raceSummary, overround,
  side, odds, availableSize, opponentSelectionId, decisionSource, externalSearchFields,
}) {
  const selectionId = String(runner.betfairSelectionId || runner.selectionId || '');
  const startTime = market.startTime || market.marketStartTime;
  const timeBeforeJump = startTime ? Math.round((new Date(startTime).getTime() - Date.now()) / 1000) : null;
  const spreadTicks = calculateSpreadTicks(runner.bestBackPrice, runner.bestLayPrice);
  const impliedProbability = odds > 0 ? 1 / odds : 0;
  const fairOdds = modelProbability > 0 ? 1 / modelProbability : 0;
  const isLiveMode = settings.liveTradingEnabled === true;
  const delayRiskScore = calcDelayRiskScore(timeBeforeJump, spreadTicks, isLiveMode);
  const confidence = probData?.confidence || 0;

  // ── Paper Proof Mode detection ──
  const paperProofMode = isPaperProofModeActive(settings, botSettings, featherlessSettings);

  // Calculate stake using Kelly (or flat proof stake in proof mode)
  const bankroll = bankrollStats?.bankroll || settings.paperBankroll || settings.bankroll || 10000;
  let stake, calculationResult;

  if (paperProofMode) {
    stake = calcProofStake(side, odds, settings);
  } else {
    const kelly = side === 'BACK'
      ? calcKellyStake(modelProbability, odds, bankroll, confidence / 100, .25, commissionRate)
      : calcLayKellyStake(modelProbability, odds, bankroll, confidence / 100, .25, commissionRate);
    stake = applyStakeCaps(kelly.stake, bankroll, settings);
  }
  calculationResult = buildCalculationResult({ side, probability:modelProbability, odds, normalizedCommissionRate:commissionRate, stake });
  const { liability = 0, ev = 0, roi = 0, edge = 0, breakevenProbability = 0, profitIfWin: maxProfit = 0, lossIfLose: maxLoss = 0 } = calculationResult;

  const fillProbability = calcFillProbability(availableSize, stake, spreadTicks, timeBeforeJump);

  // ── Safety gate ──
  const blockers = [];
  const reasons = [];

  // Edge check (minEdge is in percent, edge is decimal) — soft in proof mode
  if (edge * 100 < thresholds.minEdge) {
    const msg = `Edge ${(edge * 100).toFixed(2)}% below ${thresholds.minEdge}% minimum`;
    if (!paperProofMode) blockers.push(msg);
  }

  // ROI check (minROI is in percent, roi is decimal) — soft in proof mode
  if (roi * 100 < thresholds.minROI) {
    const msg = `ROI ${(roi * 100).toFixed(2)}% below ${thresholds.minROI}% minimum`;
    if (!paperProofMode) blockers.push(msg);
  }

  // Odds range check — still enforced but with relaxed thresholds in proof mode
  if (odds < thresholds.minOdds) {
    blockers.push(`Odds ${odds.toFixed(2)} below ${thresholds.minOdds} minimum`);
  }
  if (odds > thresholds.maxOdds) {
    blockers.push(`Odds ${odds.toFixed(2)} above ${thresholds.maxOdds} maximum`);
  }

  // Liquidity check — soft in proof mode (only require available size >= 2)
  if (availableSize < thresholds.minLiquidity) {
    const msg = `Liquidity $${availableSize.toFixed(2)} below $${thresholds.minLiquidity} minimum`;
    if (!paperProofMode || availableSize < 2) blockers.push(msg);
  }

  // Spread/price check — soft in proof mode
  const hasBack = !!(runner.bestBackPrice && runner.bestBackPrice > 0);
  const hasLay = !!(runner.bestLayPrice && runner.bestLayPrice > 0);
  if (!hasLay && side === 'BACK') {
    blockers.push('Missing lay price — cannot assess spread');
  } else if (!hasBack && side === 'LAY') {
    blockers.push('Missing back price — cannot assess spread');
  } else if (hasBack && hasLay && spreadTicks > thresholds.maxSpreadTicks) {
    const backStr = runner.bestBackPrice.toFixed(2);
    const layStr = runner.bestLayPrice.toFixed(2);
    if (spreadTicks > 50 || runner.bestLayPrice > 100 || runner.bestLayPrice > runner.bestBackPrice * 5) {
      const msg = `Stale/wide spread — ${spreadTicks} ticks (back ${backStr}, lay ${layStr}), max ${thresholds.maxSpreadTicks}`;
      if (!paperProofMode) blockers.push(msg);
    } else {
      const msg = `Spread too wide — ${spreadTicks} ticks (back ${backStr}, lay ${layStr}), max ${thresholds.maxSpreadTicks}`;
      if (!paperProofMode) blockers.push(msg);
    }
  }

  // Time window check — relaxed in proof mode (allow 1s to 86400s)
  const windowStart = featherlessSettings?.timeWindowStart ?? settings.defaultTimeWindowStartSeconds ?? 500;
  const windowEnd = featherlessSettings?.timeWindowEnd ?? settings.defaultTimeWindowEndSeconds ?? 30;
  if (timeBeforeJump != null) {
    if (timeBeforeJump <= 0) {
      blockers.push('Race has already jumped');
    } else if (paperProofMode) {
      // In proof mode, only block if race is outside 24h window
      if (timeBeforeJump > 86400) {
        blockers.push(`Race starts in ${timeBeforeJump}s — outside 24h proof window`);
      }
    } else {
      if (timeBeforeJump > windowStart) {
        blockers.push(`Race starts in ${timeBeforeJump}s — outside ${windowStart}s window`);
      }
      if (timeBeforeJump < windowEnd && timeBeforeJump > 0) {
        blockers.push(`Race starts in ${timeBeforeJump}s — inside ${windowEnd}s cutoff`);
      }
    }
  }

  // Delay risk — soft in proof mode
  if (!isLiveMode && delayRiskScore > 0.7) {
    const msg = `Delay risk ${delayRiskScore.toFixed(2)} too high for delayed API mode`;
    if (!paperProofMode) blockers.push(msg);
  }
  if (!isLiveMode && edge * 100 < 5 && timeBeforeJump != null && timeBeforeJump < 120) {
    const msg = 'Delayed API: minimum 5% edge required within 2 minutes of jump';
    if (!paperProofMode) blockers.push(msg);
  }

  // Kelly and minimum Betfair stake are hard calculation gates.
  if (!paperProofMode && stake < 2) blockers.push('KELLY_BELOW_BETFAIR_MINIMUM');
  if (!calculationResult.mathematicalInvariantsPassed) blockers.push('MATH_INVARIANT_VIOLATION');
  if (marketType === 'PLACE') blockers.push('PLACE_MODEL_NOT_VALIDATED');

  // Confidence check — soft in proof mode
  const minConfidence = featherlessSettings?.minConfidence ?? 50;
  if (confidence < minConfidence) {
    const msg = `Confidence ${confidence.toFixed(0)} below ${minConfidence}`;
    if (!paperProofMode) blockers.push(msg);
  }

  // Data quality check — soft in proof mode
  if (dataQuality < 40) {
    const msg = `Data quality ${dataQuality} below 40`;
    if (!paperProofMode) blockers.push(msg);
  }

  // Liability check (LAY) — ALWAYS enforced
  if (side === 'LAY') {
    const maxLiability = settings.maxLayLiability || 1500;
    if (liability > maxLiability) {
      blockers.push(`Lay liability $${liability.toFixed(2)} exceeds max $${maxLiability}`);
    }
  }

  // Bankroll check — ALWAYS enforced
  const requiredFunds = side === 'BACK' ? stake : liability;
  if (bankrollStats && bankrollStats.available < requiredFunds) {
    blockers.push(`Insufficient bankroll ($${bankrollStats.available?.toFixed(2)} available, $${requiredFunds.toFixed(2)} required)`);
  }

  // Daily loss limit — soft in proof mode (limits are 999999 anyway)
  if (bankrollStats?.todayPL < -(settings.dailyLossLimit || 500)) {
    const msg = 'Daily loss limit reached';
    if (!paperProofMode) blockers.push(msg);
  }

  const duplicateExposure = exposureBlock(paperOrders, { ...market, eventId: cluster.eventId, raceNumber: cluster.raceNumber, venue: cluster.venue, startTime: cluster.startTime }, settings);
  if (duplicateExposure) blockers.unshift(duplicateExposure);

  // Max open orders — ALWAYS enforced (but limit is 50 in proof mode)
  const openOrders = paperOrders.filter(o => OPEN_ORDER_STATUSES.includes(o.status) || OPEN_ORDER_STATUSES.includes(o.settlementStatus));
  if (openOrders.length >= (settings.maxOpenOrders || 10)) {
    blockers.push('Max open orders reached');
  }

  // Duplicate opposite-side position check (unless hedging) — ALWAYS enforced
  const oppositeSide = side === 'BACK' ? 'LAY' : 'BACK';
  const hasOpposite = paperOrders.some(o =>
    matchOrderToMarket(o, market) &&
    (matchSelectionId(o.selectionId, selectionId) || matchSelectionId(o.runnerId, runner.id)) &&
    o.side === oppositeSide &&
    OPEN_ORDER_STATUSES.includes(o.status)
  );
  if (hasOpposite && !settings.allowHedging) {
    blockers.push(`Conflicting ${oppositeSide} position exists (hedging not enabled)`);
  }

  // Event exposure check — ALWAYS enforced (but limit is 500 in proof mode)
  const eventExposure = paperOrders
    .filter(o => {
      const om = o.betfairMarketId || o.marketId;
      return allClusterMarketIds(cluster).includes(om) && OPEN_ORDER_STATUSES.includes(o.status);
    })
    .reduce((sum, o) => {
      const stake = o.matchedStake || o.requestedStake || 0;
      const odds = o.matchedOdds || o.matched_price || o.requestedOdds || o.requested_price || 0;
      if ((o.side || '').toUpperCase() === 'LAY' && odds > 1) return sum + stake * (odds - 1);
      return sum + stake;
    }, 0);
  if (eventExposure + requiredFunds > (settings.maxMarketExposure || 1000) * 2) {
    blockers.push('Event exposure limit breached');
  }

  const exposureAfterBet = (bankrollStats?.openPaperExposure || 0) + requiredFunds;
  const liquidityScore = Math.min(1, availableSize / Math.max(thresholds.minLiquidity * 5, 1));

  const decision = duplicateExposure ? 'REJECT' : blockers.length === 0 ? 'BET' : 'NO_BET';
  const marketNameParts = [];
  if (market.venue) marketNameParts.push(market.venue);
  if (market.raceNumber) marketNameParts.push(`R${market.raceNumber}`);
  if (market.marketName) marketNameParts.push(market.marketName);
  else if (marketType) marketNameParts.push(marketType);
  const marketDisplayName = marketNameParts.join(' - ') || 'Unknown Market';

  if (decision === 'BET') {
    reasons.push(`${marketType} ${side} ${runner.runnerName} @ ${odds.toFixed(2)} — EV $${ev.toFixed(2)}, ROI ${(roi * 100).toFixed(2)}%, edge ${(edge * 100).toFixed(2)}%`);
  }
  if (raceSummary && decisionSource !== DECISION_SOURCES.DETERMINISTIC_MARKET_ONLY) reasons.push(`AI: ${raceSummary}`);
  if (probData?.reasons?.length) reasons.push(...probData.reasons.slice(0, 2));

  const opportunity = {
    opportunityId: `opp_${cluster.eventId}_${normalizedMarketId(market)}_${selectionId}_${side}`,
    eventId: cluster.eventId,
    eventName: cluster.eventName || market.eventName || '',
    marketId: normalizedMarketId(market),
    normalizedMarketId: normalizedMarketId(market),
    betfairMarketId: normalizedMarketId(market),
    marketType,
    marketTypeCode: market.marketTypeCode || market.marketType || '',
    detectedMarketType: marketType,
    marketName: marketDisplayName,
    marketStartTime: market.startTime || market.marketStartTime || null,
    selectionId,
    runnerName: runner.runnerName || 'Unknown',
    opponentSelectionId,
    side,
    odds,
    availableSize,
    bestBackPrice: runner.bestBackPrice || null,
    bestLayPrice: runner.bestLayPrice || null,
    bestBackSize: runner.bestBackSize || null,
    bestLaySize: runner.bestLaySize || null,
    stake,
    liability,
    maxProfit,
    maxLoss,
    modelProbability,
    impliedProbability,
    breakevenProbability,
    fairOdds,
    commissionRate,
    normalizedCommissionRate: commissionRate,
    calculationResult,
    mathematicalInvariantsPassed: calculationResult.mathematicalInvariantsPassed === true,
    ev,
    roi,
    edge,
    confidence,
    dataQuality,
    decisionSource,
    dataSource: dataSourceForDecisionSource(decisionSource),
    spreadTicks,
    liquidityScore,
    delayRiskScore,
    fillProbability,
    exposureAfterBet,
    overround,
    timeBeforeJump,
    decision,
    gatesPassed: decision === 'BET' && blockers.length === 0,
    failedGate: blockers[0] || null,
    reasons,
    blockers,
    // ── External search decision-impact fields ──
    externalSearchUsed: externalSearchFields?.externalSearchUsed || false,
    externalSearchStatus: externalSearchFields?.externalSearchStatus || 'not_called',
    externalSourceCount: externalSearchFields?.externalSourceCount || 0,
    externalDataQuality: externalSearchFields?.externalDataQuality || 0,
    preSearchProbability: externalSearchFields?.preSearchProbability ?? modelProbability,
    postSearchProbability: externalSearchFields?.postSearchProbability ?? modelProbability,
    probabilityDelta: externalSearchFields?.probabilityDelta || 0,
    preSearchConfidence: externalSearchFields?.preSearchConfidence ?? confidence,
    postSearchConfidence: externalSearchFields?.postSearchConfidence ?? confidence,
    confidenceDelta: externalSearchFields?.confidenceDelta || 0,
    externalPositiveSignals: externalSearchFields?.externalPositiveSignals || [],
    externalNegativeSignals: externalSearchFields?.externalNegativeSignals || [],
    externalNeutralSignals: externalSearchFields?.externalNeutralSignals || [],
    externalSearchSummary: externalSearchFields?.externalSearchSummary || '',
    externalSearchSourceUrls: externalSearchFields?.externalSearchSourceUrls || [],
    decisionImpact: externalSearchFields?.decisionImpact || 'no_effect',
    marketOnlyFallbackReason: externalSearchFields?.marketOnlyFallbackReason || null,
    // ── Probability traceability ──
    marketOnlyProbability: externalSearchFields?.preSearchProbability ?? modelProbability,
    openAIProbabilityAdjustment: externalSearchFields?.probabilityDelta ?? 0,
    finalProbabilityUsedInEV: modelProbability, // This is the probability actually used in EV maths (post-adjustment, clamped)
    requiredMinEdge: thresholds.minEdge,
    requiredMinROI: thresholds.minROI,
    requiredMinConfidence: featherlessSettings?.minConfidence ?? 50,
    requiredMinLiquidity: thresholds.minLiquidity,
    requiredMinOdds: thresholds.minOdds,
    requiredMaxOdds: thresholds.maxOdds,
    thresholdSource: `${marketType}_MARKET_SETTINGS`,
    // ── Favourite Value Context (populated by post-processing in generateOpportunitiesForEvent) ──
    favouriteSelectionId: null,
    favouriteName: null,
    isFavourite: false,
    favouriteOdds: null,
    favouriteDominanceScore: null,
    fieldStrengthCategory: null,
    qualityThreatCount: null,
    runnerContextScore: null,
    marketScore: null,
    formScore: null,
    pressureScore: null,
    baseProbability: modelProbability,
    favouriteContextAdjustment: 0,
    contextAdjustmentReason: 'Favourite context not yet applied',
    favouriteValueWarning: null,
    specificNoBetReason: null,
  };
  opportunity.priceFreshnessScore = market.priceFeedStale ? 0 : market.source === 'cached' ? 0.4 : 1;
  opportunity.riskAdjustedScore = scoreOpportunity(opportunity);
  return opportunity;
}

function allClusterMarketIds(cluster) {
  return [
    ...cluster.winMarkets.map(m => m.betfairMarketId || m.id),
    ...cluster.placeMarkets.map(m => m.betfairMarketId || m.id),
    ...cluster.h2hMarkets.map(m => m.betfairMarketId || m.id),
    ...cluster.otherMarkets.map(m => m.betfairMarketId || m.id),
  ];
}

/**
 * Rank all opportunities by EV (descending).
 * Only positive-EV opportunities with decision='BET' are candidates.
 */
export function rankOpportunities(opportunities) {
  return opportunities.slice().sort(compareOpportunities);
}

/**
 * Get the best opportunity for each category (BACK/LAY × WIN/PLACE/H2H).
 */
export function getBestByCategory(opportunities) {
  const categories = ['BACK_WIN', 'LAY_WIN', 'BACK_PLACE', 'LAY_PLACE', 'BACK_H2H', 'LAY_H2H'];
  const result = {};
  for (const cat of categories) {
    const [side, type] = cat.split('_');
    result[cat] = opportunities
      .filter(o => o.side === side && o.marketType === type && o.decision === 'BET')
      .sort(compareOpportunities)[0] || null;
  }
  return result;
}