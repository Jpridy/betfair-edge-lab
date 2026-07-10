// ============================================================================
// Favourite Value Context
//
// A scoring layer that analyses favourite strength, field strength, market
// pressure, and form/context data — then applies small capped adjustments to
// opportunity probability, confidence, and ranking score.
//
// This layer NEVER creates bets. The deterministic EV engine remains the
// final authority. This layer only nudges confidence/dataQuality/probability
// within tight bounds.
//
// Inspired by BFExplorer favourite/value strategy ideas.
// ============================================================================

const FIELD_STRENGTH = {
  DOMINANT: 'DOMINANT',
  STRONG: 'STRONG',
  MODERATE: 'MODERATE',
  VULNERABLE: 'VULNERABLE',
  WEAK: 'WEAK',
};

// ── Default settings (used when featherlessSettings doesn't have them) ──
export const FAVOURITE_CONTEXT_DEFAULTS = {
  favouriteContextEnabled: true,
  favouriteContextMaxProbabilityAdjustment: 0.03,
  favouriteStrongConfidenceBoost: 5,
  favouriteWeakConfidencePenalty: 10,
  requireFavouriteContextForWinMarket: false,
  allowFavouriteLayOnlyWhenVulnerable: true,
};

/**
 * Resolve favourite context settings, merging user overrides with defaults.
 */
export function resolveFavouriteSettings(featherlessSettings) {
  return {
    ...FAVOURITE_CONTEXT_DEFAULTS,
    ...(featherlessSettings || {}),
  };
}

// ── Get a valid price for a runner (back preferred, lay fallback) ──
function getRunnerPrice(runner) {
  if (!runner) return 0;
  if (runner.bestBackPrice && runner.bestBackPrice > 1) return runner.bestBackPrice;
  if (runner.bestLayPrice && runner.bestLayPrice > 1) return runner.bestLayPrice;
  if (runner.lastPriceTraded && runner.lastPriceTraded > 1) return runner.lastPriceTraded;
  return 0;
}

/**
 * Detect the favourite from a list of market runners.
 * Favourite = ACTIVE runner with the lowest valid bestBackPrice.
 * If bestBackPrice is missing, uses bestLayPrice.
 * If no valid price exists, returns null.
 *
 * @param {Array} marketRunners - Runners for a single WIN market
 * @returns {object|null} { selectionId, runnerName, favouriteOdds, favouriteImpliedProbability, favouriteRank }
 */
export function detectFavourite(marketRunners) {
  if (!Array.isArray(marketRunners) || marketRunners.length === 0) return null;

  const activeRunners = marketRunners.filter(r => r.status === 'ACTIVE' || !r.status);
  if (activeRunners.length === 0) return null;

  // Sort by price ascending (lowest price = favourite)
  const sorted = activeRunners
    .map(r => ({
      runner: r,
      selectionId: String(r.betfairSelectionId || r.selectionId || ''),
      runnerName: r.runnerName || '',
      bestBackPrice: r.bestBackPrice || 0,
      bestLayPrice: r.bestLayPrice || 0,
      price: getRunnerPrice(r),
    }))
    .filter(r => r.price > 0)
    .sort((a, b) => a.price - b.price);

  if (sorted.length === 0) return null;

  const fav = sorted[0];
  return {
    selectionId: fav.selectionId,
    runnerName: fav.runnerName,
    favouriteOdds: fav.price,
    favouriteImpliedProbability: 1 / fav.price,
    favouriteRank: 1,
  };
}

/**
 * Calculate favourite + field strength context for a WIN market.
 *
 * @param {Array} marketRunners - Runners for a single WIN market
 * @returns {object|null} Favourite context object, or null if no favourite
 */
export function calculateFavouriteContext(marketRunners) {
  const favourite = detectFavourite(marketRunners);
  if (!favourite) return null;

  const activeRunners = (marketRunners || []).filter(r => r.status === 'ACTIVE' || !r.status);
  const pricedRunners = activeRunners
    .map(r => ({ runner: r, price: getRunnerPrice(r) }))
    .filter(r => r.price > 0)
    .sort((a, b) => a.price - b.price);

  const fieldRunnerCount = pricedRunners.length;
  if (fieldRunnerCount === 0) return null;

  const favouriteOdds = favourite.favouriteOdds;
  const favouriteProb = favourite.favouriteImpliedProbability;

  // Field average price (excluding the favourite)
  const nonFavRunners = pricedRunners.slice(1);
  const fieldAveragePrice = nonFavRunners.length > 0
    ? nonFavRunners.reduce((s, r) => s + r.price, 0) / nonFavRunners.length
    : favouriteOdds;

  // Quality threats = runners within 1.5x the favourite's odds AND with implied prob > 0.1
  const qualityThreatCount = nonFavRunners.filter(r => {
    const withinRange = r.price <= favouriteOdds * 1.5;
    const meaningfulProb = (1 / r.price) > 0.1;
    return withinRange && meaningfulProb;
  }).length;

  // Favourite dominance score: how much of the total implied probability the favourite holds
  const totalImpliedProb = pricedRunners.reduce((s, r) => s + (1 / r.price), 0);
  const favouriteDominanceScore = totalImpliedProb > 0
    ? Math.round((favouriteProb / totalImpliedProb) * 100)
    : 0;

  // Determine field strength category
  let fieldStrengthCategory;
  if (favouriteDominanceScore >= 50 && qualityThreatCount <= 1) {
    fieldStrengthCategory = FIELD_STRENGTH.DOMINANT;
  } else if (favouriteDominanceScore >= 35 && qualityThreatCount <= 2) {
    fieldStrengthCategory = FIELD_STRENGTH.STRONG;
  } else if (favouriteDominanceScore >= 25) {
    fieldStrengthCategory = FIELD_STRENGTH.MODERATE;
  } else if (favouriteDominanceScore >= 15) {
    fieldStrengthCategory = FIELD_STRENGTH.VULNERABLE;
  } else {
    fieldStrengthCategory = FIELD_STRENGTH.WEAK;
  }

  const favouriteLooksStrong = fieldStrengthCategory === FIELD_STRENGTH.DOMINANT || fieldStrengthCategory === FIELD_STRENGTH.STRONG;
  const favouriteLooksVulnerable = fieldStrengthCategory === FIELD_STRENGTH.VULNERABLE || fieldStrengthCategory === FIELD_STRENGTH.WEAK;

  return {
    favouriteSelectionId: favourite.selectionId,
    favouriteName: favourite.runnerName,
    favouriteOdds,
    favouriteImpliedProbability: favouriteProb,
    favouriteRank: favourite.favouriteRank,
    fieldAveragePrice,
    fieldRunnerCount,
    qualityThreatCount,
    favouriteDominanceScore,
    fieldStrengthCategory,
    favouriteLooksStrong,
    favouriteLooksVulnerable,
  };
}

/**
 * Calculate per-runner context scores using available data only.
 * Does NOT invent missing data.
 *
 * @param {Array} marketRunners - Runners for a single market
 * @param {object|null} favouriteContext - From calculateFavouriteContext()
 * @param {object|null} externalResearch - Optional external search result
 * @returns {Array} Array of runner context score objects
 */
export function calculateRunnerContextScores(marketRunners, favouriteContext, externalResearch) {
  if (!Array.isArray(marketRunners)) return [];

  return marketRunners
    .filter(r => r.status === 'ACTIVE' || !r.status)
    .map(runner => {
      const selectionId = String(runner.betfairSelectionId || runner.selectionId || '');
      const bestBack = runner.bestBackPrice || 0;
      const bestLay = runner.bestLayPrice || 0;
      const backSize = runner.bestBackSize || 0;
      const laySize = runner.bestLaySize || 0;
      const tradedVol = runner.tradedVolumeAmount || runner.totalMatched || 0;
      const missingDataFields = [];

      // ── Market score (0-100): based on liquidity, spread, traded volume ──
      let marketScore = 30; // baseline
      const totalLiquidity = backSize + laySize;
      if (totalLiquidity > 200) marketScore += 25;
      else if (totalLiquidity > 50) marketScore += 15;
      else if (totalLiquidity > 0) marketScore += 5;

      if (tradedVol > 5000) marketScore += 20;
      else if (tradedVol > 1000) marketScore += 10;

      if (bestBack > 0 && bestLay > 0) {
        const spreadPct = Math.abs(bestLay - bestBack) / Math.max(bestBack, 0.01);
        if (spreadPct < 0.02) marketScore += 15;
        else if (spreadPct < 0.05) marketScore += 8;
        else if (spreadPct > 0.15) marketScore -= 10;
      } else {
        missingDataFields.push('spread');
      }
      marketScore = Math.max(0, Math.min(100, marketScore));

      // ── Form score (0-100): from Betfair metadata if available ──
      let formScore = 0;
      const formProfile = runner.raceFormProfile || null;
      if (formProfile) {
        let formComponents = 0;
        if (formProfile.jockeyName) { formScore += 20; formComponents++; }
        if (formProfile.trainerName) { formScore += 20; formComponents++; }
        if (formProfile.recentForm || formProfile.externalFormData?.previousStarts) { formScore += 25; formComponents++; }
        if (formProfile.weightValue != null) { formScore += 10; formComponents++; }
        if (formProfile.stallDraw != null) { formScore += 10; formComponents++; }
        if (formProfile.age != null) { formScore += 5; formComponents++; }
        if (formComponents === 0) missingDataFields.push('form_data');
      } else {
        missingDataFields.push('form_data');
      }
      formScore = Math.min(100, formScore);

      // ── Connections score (jockey/trainer quality — 0 if unknown) ──
      let connectionsScore = 0;
      if (formProfile?.jockeyName) connectionsScore += 15;
      if (formProfile?.trainerName) connectionsScore += 15;
      connectionsScore = Math.min(30, connectionsScore);

      // ── Pressure score (0-100): order book imbalance ──
      let pressureScore = 50; // neutral baseline
      if (backSize > 0 && laySize > 0) {
        const imbalance = (backSize - laySize) / (backSize + laySize);
        // Positive imbalance = more back pressure (money thinks price will shorten)
        pressureScore = 50 + Math.round(imbalance * 30);
        pressureScore = Math.max(0, Math.min(100, pressureScore));
      } else {
        missingDataFields.push('order_book_imbalance');
      }

      // ── Suitability score (how well this runner fits the favourite-value context) ──
      let suitabilityScore = 50;
      const isFavourite = favouriteContext && selectionId === favouriteContext.favouriteSelectionId;
      if (isFavourite) {
        if (favouriteContext.favouriteLooksStrong) suitabilityScore += 25;
        else if (favouriteContext.favouriteLooksVulnerable) suitabilityScore -= 15;
      }
      suitabilityScore = Math.max(0, Math.min(100, suitabilityScore));

      // ── External research score ──
      if (externalResearch && Array.isArray(externalResearch.runnerResearch)) {
        const research = externalResearch.runnerResearch.find(rr => String(rr.selectionId) === selectionId);
        if (research) {
          const pos = (research.positiveSignals || []).length;
          const neg = (research.negativeSignals || []).length;
          if (pos > neg) formScore = Math.min(100, formScore + 10);
          else if (neg > pos) formScore = Math.max(0, formScore - 10);
        } else {
          missingDataFields.push('external_research');
        }
      }

      // ── Total context score (weighted average) ──
      const totalContextScore = Math.round(
        marketScore * 0.30 +
        formScore * 0.25 +
        suitabilityScore * 0.20 +
        pressureScore * 0.15 +
        connectionsScore * 0.10
      );

      // ── Data quality: how many data sources were present ──
      const dataSourcesAvailable = 4 - missingDataFields.length;
      const dataQuality = Math.max(10, Math.min(100, Math.round((dataSourcesAvailable / 4) * 100)));

      return {
        selectionId,
        runnerName: runner.runnerName || '',
        marketScore,
        formScore,
        suitabilityScore,
        connectionsScore,
        pressureScore,
        totalContextScore,
        missingDataFields,
        dataQuality,
        isFavourite: isFavourite || false,
      };
    });
}

/**
 * Apply favourite context adjustments to an opportunity.
 * Only adjusts confidence, dataQuality, ranking, and a small capped probability nudge.
 * The deterministic EV engine remains the final authority.
 *
 * @param {object} opportunity - The opportunity object (mutated copy returned)
 * @param {object|null} favouriteContext - From calculateFavouriteContext()
 * @param {object|null} runnerContextScore - Runner's context score
 * @param {object} featherlessSettings - Settings with favourite context toggles
 * @returns {object} Updated opportunity with favourite context fields
 */
export function applyFavouriteContextToOpportunity(opportunity, favouriteContext, runnerContextScore, featherlessSettings) {
  if (!opportunity) return opportunity;

  const fcSettings = resolveFavouriteSettings(featherlessSettings);
  const enabled = fcSettings.favouriteContextEnabled !== false;

  // Base values — no change if context missing or disabled
  const baseProbability = opportunity.modelProbability;
  let favouriteContextAdjustment = 0;
  let finalProbabilityUsedInEV = opportunity.finalProbabilityUsedInEV ?? opportunity.modelProbability;
  let confidence = opportunity.confidence;
  let dataQuality = opportunity.dataQuality;
  let contextAdjustmentReason = 'No favourite context applied';
  let favouriteValueWarning = null;

  // If favourite context is disabled or missing, just record the base
  if (!enabled || !favouriteContext) {
    return {
      ...opportunity,
      favouriteSelectionId: favouriteContext?.favouriteSelectionId ?? null,
      favouriteName: favouriteContext?.favouriteName ?? null,
      isFavourite: false,
      favouriteOdds: favouriteContext?.favouriteOdds ?? null,
      favouriteDominanceScore: favouriteContext?.favouriteDominanceScore ?? null,
      fieldStrengthCategory: favouriteContext?.fieldStrengthCategory ?? null,
      qualityThreatCount: favouriteContext?.qualityThreatCount ?? null,
      runnerContextScore: runnerContextScore?.totalContextScore ?? null,
      marketScore: runnerContextScore?.marketScore ?? null,
      formScore: runnerContextScore?.formScore ?? null,
      pressureScore: runnerContextScore?.pressureScore ?? null,
      baseProbability,
      favouriteContextAdjustment: 0,
      finalProbabilityUsedInEV,
      contextAdjustmentReason: enabled ? 'Favourite context not available for this market' : 'Favourite context disabled in settings',
      favouriteValueWarning: null,
    };
  }

  const isFavourite = String(opportunity.selectionId) === String(favouriteContext.favouriteSelectionId);
  const maxAdj = fcSettings.favouriteContextMaxProbabilityAdjustment ?? 0.03;
  const strongBoost = fcSettings.favouriteStrongConfidenceBoost ?? 5;
  const weakPenalty = fcSettings.favouriteWeakConfidencePenalty ?? 10;

  // ── FAVOURITE BIAS RULE (WIN markets only) ──
  if (opportunity.marketType === 'WIN' && isFavourite) {
    if (favouriteContext.favouriteLooksStrong) {
      // Strong/Dominant favourite: small confidence + probability boost
      favouriteContextAdjustment = Math.min(maxAdj, maxAdj * 0.7);
      confidence = Math.min(100, (confidence || 0) + strongBoost);
      contextAdjustmentReason = `Favourite is ${favouriteContext.fieldStrengthCategory} (dominance ${favouriteContext.favouriteDominanceScore}%) — confidence +${strongBoost}, probability +${(favouriteContextAdjustment * 100).toFixed(1)}%`;
    } else if (favouriteContext.favouriteLooksVulnerable) {
      // Vulnerable/Weak favourite:
      // - For BACK: reduce confidence, add warning (risky to back a weak favourite)
      // - For LAY: this is a positive signal (laying a weak favourite is good)
      if (opportunity.side === 'BACK') {
        favouriteContextAdjustment = -Math.min(maxAdj, maxAdj * 0.5);
        confidence = Math.max(0, (confidence || 0) - weakPenalty);
        favouriteValueWarning = `Favourite looks ${favouriteContext.fieldStrengthCategory} (dominance ${favouriteContext.favouriteDominanceScore}%, ${favouriteContext.qualityThreatCount} threats) — require stronger EV/edge`;
        contextAdjustmentReason = `Favourite is ${favouriteContext.fieldStrengthCategory} — BACK confidence -${weakPenalty}, probability ${(favouriteContextAdjustment * 100).toFixed(1)}%`;
      } else {
        // LAY on vulnerable favourite: small probability nudge in our favour (lower fav win prob)
        favouriteContextAdjustment = -Math.min(maxAdj * 0.5, maxAdj * 0.5);
        contextAdjustmentReason = `Favourite is ${favouriteContext.fieldStrengthCategory} — LAY favoured, probability adjustment ${(favouriteContextAdjustment * 100).toFixed(1)}%`;
      }
    } else {
      contextAdjustmentReason = `Favourite is ${favouriteContext.fieldStrengthCategory} — no adjustment`;
    }
  } else if (opportunity.marketType === 'WIN' && !isFavourite) {
    // Non-favourite in a WIN market: small context nudge based on field strength
    if (favouriteContext.favouriteLooksVulnerable) {
      // Favourite is weak — non-favourites get tiny boost
      favouriteContextAdjustment = Math.min(maxAdj * 0.3, maxAdj * 0.3);
      contextAdjustmentReason = `Favourite is ${favouriteContext.fieldStrengthCategory} — non-favourite probability +${(favouriteContextAdjustment * 100).toFixed(1)}%`;
    } else if (favouriteContext.favouriteLooksStrong) {
      // Favourite is strong — non-favourites get tiny penalty
      favouriteContextAdjustment = -Math.min(maxAdj * 0.3, maxAdj * 0.3);
      contextAdjustmentReason = `Favourite is ${favouriteContext.fieldStrengthCategory} — non-favourite probability ${(favouriteContextAdjustment * 100).toFixed(1)}%`;
    } else {
      contextAdjustmentReason = `Favourite is ${favouriteContext.fieldStrengthCategory} — non-favourite, no adjustment`;
    }
  } else {
    contextAdjustmentReason = `${opportunity.marketType} market — favourite context not applied`;
  }

  // ── Apply capped probability adjustment ──
  // The base probability used in EV is the existing (post-external-search) probability.
  // We only add a small nudge on top.
  const existingProb = opportunity.finalProbabilityUsedInEV ?? opportunity.modelProbability;
  finalProbabilityUsedInEV = Math.max(0.01, Math.min(0.99, existingProb + favouriteContextAdjustment));

  // ── LAY SAFETY GUARD ──
  // A LAY favourite opportunity must only pass if the favourite is VULNERABLE or WEAK
  if (opportunity.side === 'LAY' && isFavourite && opportunity.marketType === 'WIN') {
    if (fcSettings.allowFavouriteLayOnlyWhenVulnerable && !favouriteContext.favouriteLooksVulnerable) {
      favouriteValueWarning = `LAY favourite blocked — favourite is ${favouriteContext.fieldStrengthCategory} (must be VULNERABLE or WEAK)`;
      // Revert probability adjustment — don't help a LAY favourite that isn't weak
      finalProbabilityUsedInEV = existingProb;
      favouriteContextAdjustment = 0;
      contextAdjustmentReason = `LAY favourite blocked — favourite is ${favouriteContext.fieldStrengthCategory}, not vulnerable/weak`;
    }
  }

  // ── Adjust data quality based on runner context ──
  if (runnerContextScore) {
    // Blend: weight existing dataQuality 70%, context dataQuality 30%
    const contextDQ = runnerContextScore.dataQuality || 0;
    dataQuality = Math.round((dataQuality * 0.7) + (contextDQ * 0.3));
  }

  return {
    ...opportunity,
    favouriteSelectionId: favouriteContext.favouriteSelectionId,
    favouriteName: favouriteContext.favouriteName,
    isFavourite,
    favouriteOdds: favouriteContext.favouriteOdds,
    favouriteDominanceScore: favouriteContext.favouriteDominanceScore,
    fieldStrengthCategory: favouriteContext.fieldStrengthCategory,
    qualityThreatCount: favouriteContext.qualityThreatCount,
    runnerContextScore: runnerContextScore?.totalContextScore ?? null,
    marketScore: runnerContextScore?.marketScore ?? null,
    formScore: runnerContextScore?.formScore ?? null,
    pressureScore: runnerContextScore?.pressureScore ?? null,
    baseProbability,
    favouriteContextAdjustment,
    finalProbabilityUsedInEV,
    contextAdjustmentReason,
    favouriteValueWarning,
    confidence,
    dataQuality,
  };
}

/**
 * Generate a specific, human-readable NO BET reason for an opportunity.
 * Replaces generic "No positive EV opportunity" with specific blockers.
 *
 * @param {object} opportunity - The rejected opportunity
 * @param {object|null} favouriteContext - Favourite context for this market
 * @param {object} featherlessSettings - Settings
 * @returns {string} Specific NO BET reason
 */
export function generateSpecificNoBetReason(opportunity, favouriteContext, featherlessSettings) {
  if (!opportunity) return 'No opportunity available';

  const blockers = opportunity.blockers || [];
  const fcSettings = resolveFavouriteSettings(featherlessSettings);

  // ── Check favourite-specific scenarios first ──
  if (favouriteContext && opportunity.marketType === 'WIN') {
    const isFavourite = String(opportunity.selectionId) === String(favouriteContext.favouriteSelectionId);

    if (isFavourite && opportunity.side === 'BACK') {
      if (favouriteContext.favouriteLooksStrong && opportunity.odds < 2.0) {
        return 'Favourite strong but odds too short for value';
      }
      if (opportunity.ev <= 0) {
        return 'Favourite detected but no value — EV not positive at current odds';
      }
    }

    if (isFavourite && opportunity.side === 'LAY') {
      if (fcSettings.allowFavouriteLayOnlyWhenVulnerable && !favouriteContext.favouriteLooksVulnerable) {
        return 'LAY favourite blocked — favourite not vulnerable/weak enough';
      }
      if (opportunity.edge * 100 < (fcSettings.minEdge || 3)) {
        return 'Favourite vulnerable but lay edge not strong enough';
      }
    }

    if (!isFavourite && favouriteContext.favouriteLooksStrong) {
      if (opportunity.ev <= 0) {
        return 'Favourite is dominant — non-favourite has no value at current odds';
      }
    }

    if (favouriteContext.qualityThreatCount >= 3 && opportunity.ev <= 0) {
      return 'Field too competitive — multiple quality threats, no clear value';
    }
  }

  // ── Check specific blocker types ──
  for (const blocker of blockers) {
    const lower = (blocker || '').toLowerCase();

    if (lower.includes('liquidity')) return 'Liquidity too thin for safe entry';
    if (lower.includes('spread')) return 'Price spread too wide for reliable fill';
    if (lower.includes('confidence')) return 'EV positive but confidence too low';
    if (lower.includes('data quality')) return 'Data quality too low for reliable decision';
    if (lower.includes('liability')) return 'LAY liability too high for current risk limits';
    if (lower.includes('duplicate')) return 'Duplicate open order already exists for this selection';
    if (lower.includes('time') || lower.includes('window') || lower.includes('jump')) return 'Time window failed — race outside scanning window';
    if (lower.includes('odds') && lower.includes('below')) return 'Odds below minimum threshold for this market type';
    if (lower.includes('odds') && lower.includes('above')) return 'Odds above maximum threshold for this market type';
    if (lower.includes('edge')) return `Edge below minimum threshold (${fcSettings.minEdge || 3}%)`;
    if (lower.includes('roi')) return 'ROI below minimum threshold after commission';
    if (lower.includes('bankroll')) return 'Insufficient bankroll for this stake/liability';
    if (lower.includes('exposure')) return 'Market or event exposure limit would be breached';
    if (lower.includes('conflicting')) return 'Conflicting opposite-side position exists (hedging not enabled)';
    if (lower.includes('kelly')) return 'No positive Kelly stake — probability below breakeven';
    if (lower.includes('delay')) return 'Delay risk too high for delayed API mode';
  }

  // ── External search / data availability ──
  if (opportunity.externalSearchStatus === 'not_called' && fcSettings.externalSearchEnabled) {
    return 'External data unavailable — search not called';
  }
  if (opportunity.marketOnlyFallbackReason === 'OPENAI_SEARCH_DISABLED') {
    return 'OpenAI search disabled — using market-only probabilities';
  }

  // ── Market pressure vs form conflict ──
  if (favouriteContext && opportunity.marketType === 'WIN') {
    const isFavourite = String(opportunity.selectionId) === String(favouriteContext.favouriteSelectionId);
    if (isFavourite && favouriteContext.favouriteLooksVulnerable && opportunity.side === 'BACK' && opportunity.ev > 0) {
      return 'Market pressure conflicted with form — favourite looks vulnerable despite positive EV';
    }
  }

  // ── Generic fallback ──
  if (opportunity.ev <= 0) {
    return 'No positive EV opportunity at current odds and probability';
  }

  return blockers[0] || 'Opportunity blocked by safety gate';
}

/**
 * Build favourite context diagnostics for debug scan reporting.
 *
 * @param {Array} allOpportunities - All opportunities from the cycle
 * @param {Array} favouritesDetected - Array of favourite context objects per market
 * @returns {object} Debug scan favourite context diagnostics
 */
export function buildFavouriteValueDiagnostics(allOpportunities, favouritesDetected) {
  const opps = Array.isArray(allOpportunities) ? allOpportunities : [];
  const favs = Array.isArray(favouritesDetected) ? favouritesDetected.filter(Boolean) : [];

  const dominant = favs.filter(f => f.fieldStrengthCategory === FIELD_STRENGTH.DOMINANT).length;
  const strong = favs.filter(f => f.fieldStrengthCategory === FIELD_STRENGTH.STRONG).length;
  const vulnerable = favs.filter(f => f.fieldStrengthCategory === FIELD_STRENGTH.VULNERABLE).length;
  const weak = favs.filter(f => f.fieldStrengthCategory === FIELD_STRENGTH.WEAK).length;

  const oppsWithContext = opps.filter(o => o.favouriteSelectionId != null);
  const oppsBeforeContext = opps.length;
  const oppsAfterContext = oppsWithContext.length;

  const probAdjustments = opps.filter(o => Math.abs(o.favouriteContextAdjustment || 0) > 0.001);
  const confAdjustments = opps.filter(o => o.favouriteValueWarning != null || (o.isFavourite && o.marketType === 'WIN'));

  const bestBefore = oppsBeforeContext > 0
    ? opps.slice().sort((a, b) => (b.ev || 0) - (a.ev || 0))[0]
    : null;
  const bestAfter = oppsAfterContext > 0
    ? oppsWithContext.slice().sort((a, b) => (b.ev || 0) - (a.ev || 0))[0]
    : null;

  return {
    favouritesDetected: favs.length,
    dominantFavourites: dominant,
    strongFavourites: strong,
    vulnerableFavourites: vulnerable,
    weakFavourites: weak,
    opportunitiesBeforeFavouriteContext: oppsBeforeContext,
    opportunitiesAfterFavouriteContext: oppsAfterContext,
    probabilityAdjustmentsApplied: probAdjustments.length,
    confidenceAdjustmentsApplied: confAdjustments.length,
    bestOpportunityBeforeContext: bestBefore ? {
      runnerName: bestBefore.runnerName,
      selectionId: bestBefore.selectionId,
      side: bestBefore.side,
      ev: bestBefore.ev,
      modelProbability: bestBefore.modelProbability,
    } : null,
    bestOpportunityAfterContext: bestAfter ? {
      runnerName: bestAfter.runnerName,
      selectionId: bestAfter.selectionId,
      side: bestAfter.side,
      ev: bestAfter.ev,
      baseProbability: bestAfter.baseProbability,
      finalProbabilityUsedInEV: bestAfter.finalProbabilityUsedInEV,
      favouriteContextAdjustment: bestAfter.favouriteContextAdjustment,
      fieldStrengthCategory: bestAfter.fieldStrengthCategory,
      isFavourite: bestAfter.isFavourite,
    } : null,
  };
}

export { FIELD_STRENGTH };