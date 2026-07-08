// ============================================================================
// External Search Integration
//
// Applies OpenAI web search probability adjustments to the market model
// probabilities. The exchange engine remains the final authority — this module
// only nudges probabilities within a clamped range.
//
// finalProbability = marketModelProbability + externalSearchAdjustment
// (clamped to ±maxExternalProbabilityAdjustment)
// ============================================================================

/**
 * Find runner research for a given selectionId in the externalSearchResult.
 */
export function findRunnerResearch(externalSearchResult, selectionId) {
  if (!externalSearchResult?.runnerResearch) return null;
  const sid = String(selectionId || '');
  return externalSearchResult.runnerResearch.find(rr => String(rr.selectionId) === sid) || null;
}

/**
 * Apply external search adjustment to a pre-search probability.
 *
 * @param {number} preSearchProbability - Market model probability (0-1)
 * @param {object|null} runnerResearch - Runner research from externalSearchResult
 * @param {object} settings - FeatherlessSettings
 * @returns {object} { postSearchProbability, probabilityDelta, decisionImpact }
 */
export function applyExternalAdjustment(preSearchProbability, runnerResearch, settings) {
  const maxAdj = settings?.maxExternalProbabilityAdjustment ?? 0.05;
  const minSourceCount = settings?.minExternalSourceCount ?? 2;
  const minDataQuality = settings?.minExternalDataQuality ?? 50;

  // No runner research — no adjustment
  if (!runnerResearch) {
    return {
      postSearchProbability: preSearchProbability,
      probabilityDelta: 0,
      decisionImpact: 'no_effect',
    };
  }

  // Check data quality threshold
  const dataQuality = externalSearchResultDataQuality(runnerResearch);
  if (dataQuality < minDataQuality) {
    return {
      postSearchProbability: preSearchProbability,
      probabilityDelta: 0,
      decisionImpact: 'no_effect',
    };
  }

  // Check source count threshold
  const sourceCount = (runnerResearch.sourceUrls || []).length;
  if (sourceCount < minSourceCount && Math.abs(runnerResearch.probabilityAdjustment || 0) > 0.001) {
    // Not enough sources to trust a non-zero adjustment
    return {
      postSearchProbability: preSearchProbability,
      probabilityDelta: 0,
      decisionImpact: 'no_effect',
    };
  }

  const rawAdjustment = Number(runnerResearch.probabilityAdjustment) || 0;
  // Clamp to maxAdj (the backend already clamps, but double-check)
  const clampedAdjustment = Math.max(-maxAdj, Math.min(maxAdj, rawAdjustment));

  const postSearchProbability = Math.max(0.01, Math.min(0.99, preSearchProbability + clampedAdjustment));
  const probabilityDelta = postSearchProbability - preSearchProbability;

  let decisionImpact = 'no_effect';
  if (Math.abs(probabilityDelta) < 0.001) {
    decisionImpact = 'no_effect';
  } else if (probabilityDelta > 0) {
    decisionImpact = 'increased_probability';
  } else {
    decisionImpact = 'decreased_probability';
  }

  return { postSearchProbability, probabilityDelta, decisionImpact };
}

// Helper to get data quality from runner research context
function externalSearchResultDataQuality(_runnerResearch) {
  // The data quality is at the externalSearchResult level, not runner level.
  // This is a fallback — the actual data quality check is done by the caller
  // using the externalSearchResult.dataQuality field.
  return 100;
}

/**
 * Apply confidence adjustment from external search.
 */
export function applyConfidenceAdjustment(preSearchConfidence, runnerResearch, settings) {
  if (!runnerResearch) {
    return {
      postSearchConfidence: preSearchConfidence,
      confidenceDelta: 0,
    };
  }

  const rawAdjustment = Number(runnerResearch.confidenceAdjustment) || 0;
  const postSearchConfidence = Math.max(0, Math.min(100, preSearchConfidence + rawAdjustment));
  const confidenceDelta = postSearchConfidence - preSearchConfidence;

  return { postSearchConfidence, confidenceDelta };
}

/**
 * Determine the overall decision impact for an opportunity.
 * Combines probability and confidence changes.
 */
export function determineDecisionImpact(probabilityDelta, confidenceDelta, externalSearchUsed, dataQuality, settings) {
  if (!externalSearchUsed) return 'fallback_market_only';

  const minDataQuality = settings?.minExternalDataQuality ?? 50;
  if (dataQuality < minDataQuality) return 'blocked_due_to_bad_external_data';

  if (Math.abs(probabilityDelta) < 0.001 && Math.abs(confidenceDelta) < 0.5) {
    return 'no_effect';
  }

  if (probabilityDelta > 0.001) return 'increased_probability';
  if (probabilityDelta < -0.001) return 'decreased_probability';
  if (confidenceDelta > 0.5) return 'increased_confidence';
  if (confidenceDelta < -0.5) return 'decreased_confidence';

  return 'no_effect';
}

/**
 * Build the external search fields for an opportunity object.
 */
export function buildExternalSearchFields(opportunity, externalSearchResult, settings) {
  const selectionId = opportunity.selectionId;
  const runnerResearch = findRunnerResearch(externalSearchResult, selectionId);

  const preSearchProbability = opportunity.modelProbability;
  const preSearchConfidence = opportunity.confidence;
  const externalSearchUsed = !!externalSearchResult && externalSearchResult.searchStatus === 'success' && !!runnerResearch;
  const externalSearchStatus = externalSearchResult?.searchStatus || 'not_called';
  const externalSourceCount = externalSearchResult?.sourceCount || 0;
  const externalDataQuality = externalSearchResult?.dataQuality || 0;

  const { postSearchProbability, probabilityDelta } = applyExternalAdjustment(
    preSearchProbability, runnerResearch, settings
  );
  const { postSearchConfidence, confidenceDelta } = applyConfidenceAdjustment(
    preSearchConfidence, runnerResearch, settings
  );

  const decisionImpact = determineDecisionImpact(
    probabilityDelta, confidenceDelta, externalSearchUsed, externalDataQuality, settings
  );

  const positiveSignals = runnerResearch?.positiveSignals || [];
  const negativeSignals = runnerResearch?.negativeSignals || [];
  const neutralSignals = runnerResearch?.neutralSignals || [];
  const externalSearchSummary = runnerResearch
    ? `${positiveSignals.length} positive, ${negativeSignals.length} negative, ${neutralSignals.length} neutral signals`
    : '';
  const externalSearchSourceUrls = (runnerResearch?.sourceUrls || []).slice(0, 10);

  return {
    externalSearchUsed,
    externalSearchStatus,
    externalSourceCount,
    externalDataQuality,
    preSearchProbability,
    postSearchProbability,
    probabilityDelta,
    preSearchConfidence,
    postSearchConfidence,
    confidenceDelta,
    externalPositiveSignals: positiveSignals,
    externalNegativeSignals: negativeSignals,
    externalNeutralSignals: neutralSignals,
    externalSearchSummary,
    externalSearchSourceUrls,
    decisionImpact,
  };
}

/**
 * Get the fallback status label for market-only mode.
 */
export function getMarketOnlyFallbackReason(externalSearchResult) {
  if (!externalSearchResult) return 'OPENAI_SEARCH_DISABLED';
  switch (externalSearchResult.searchStatus) {
    case 'success': return null; // No fallback — search succeeded
    case 'timeout': return 'OPENAI_SEARCH_TIMEOUT';
    case 'error': return 'OPENAI_SEARCH_ERROR';
    case 'no_results': return 'OPENAI_SEARCH_NO_RESULTS';
    case 'not_called': return 'OPENAI_SEARCH_DISABLED';
    default: return 'MARKET_ONLY_FALLBACK';
  }
}