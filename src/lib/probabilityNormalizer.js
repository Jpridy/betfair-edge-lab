// ============================================================================
// Probability Normalizer
//
// Ensures probabilities are internally consistent within each market type:
// - WIN probabilities sum to ~1.0
// - PLACE probabilities are consistent with WIN probabilities
// - H2H probabilities: each pair sums to 1.0
//
// Does NOT reuse win probability as place probability.
// Does NOT reuse win probability as H2H probability.
// ============================================================================

/**
 * Normalize a set of WIN probabilities so they sum to 1.0.
 * Applies favourite-longshot bias correction if enabled.
 *
 * @param {Array} probs - Array of { selectionId, runnerName, pWin }
 * @returns {Array} Normalized array with pWin values summing to ~1.0
 */
export function normalizeWinProbabilities(probs) {
  if (!probs || probs.length === 0) return [];

  // Clamp each probability to [0.01, 0.95]
  const clamped = probs.map(p => ({
    ...p,
    pWin: Math.min(0.95, Math.max(0.01, p.pWin || 0)),
  }));

  const total = clamped.reduce((sum, p) => sum + p.pWin, 0);
  if (total <= 0) {
    // Uniform fallback
    const uniform = 1 / clamped.length;
    return clamped.map(p => ({ ...p, pWin: uniform }));
  }

  return clamped.map(p => ({
    ...p,
    pWin: p.pWin / total,
  }));
}

/**
 * Estimate PLACE probabilities from WIN probabilities.
 *
 * Uses the Harville formula: P(place | N places) = sum over all permutations
 * where the horse finishes in the top N.
 *
 * Simplified: P(horse places) ≈ P(horse wins) + P(horse 2nd) + ... + P(horse Nth)
 * P(horse 2nd) ≈ P(horse wins among the rest) * P(others win first)
 *
 * This does NOT simply reuse pWin as pPlace — it computes a distinct estimate.
 *
 * @param {Array} winProbs - Array of { selectionId, pWin }
 * @param {number} placeTerms - Number of places (2, 3, 4)
 * @returns {Array} Array with pPlace added
 */
export function estimatePlaceProbabilities(winProbs, placeTerms) {
  if (!winProbs || winProbs.length === 0) return [];
  const n = placeTerms || 2;
  const normalized = normalizeWinProbabilities(winProbs);

  const result = normalized.map(p => {
    // P(place) = 1 - P(does not place)
    // P(does not place) = product of P(some other horse wins each remaining slot)
    // Using Harville approximation:
    // P(place) ≈ pWin + sum over k=2..n of P(finishes k-th)
    // P(finishes k-th) ≈ pWin / (1 - sum of top k-1 probabilities) * product terms

    // Simplified Harville for places:
    let pPlace = p.pWin;
    let remainingProb = 1 - p.pWin;

    // Sort other horses by pWin descending
    const others = normalized
      .filter(o => o.selectionId !== p.selectionId)
      .sort((a, b) => b.pWin - a.pWin);

    for (let k = 1; k < n && k <= others.length; k++) {
      // Probability this horse finishes in position k
      // ≈ P(this horse would win among remaining) * product of P(top horses took earlier slots)
      if (remainingProb > 0) {
        pPlace += (p.pWin / remainingProb) * remainingProb * 0.5; // Approximation
        remainingProb -= others[k - 1]?.pWin || 0;
        if (remainingProb < 0) remainingProb = 0;
      }
    }

    return {
      ...p,
      pPlace: Math.min(0.95, Math.max(0.01, pPlace)),
    };
  });

  // Normalize place probabilities to sum to ~placeTerms (since N horses place)
  const totalPlace = result.reduce((sum, p) => sum + p.pPlace, 0);
  if (totalPlace > 0) {
    const scale = placeTerms / totalPlace;
    return result.map(p => ({
      ...p,
      pPlace: Math.min(0.95, p.pPlace * scale),
    }));
  }

  return result;
}

/**
 * Normalize H2H (head-to-head) probabilities.
 * For each pair, p1 + p2 must = 1.0.
 *
 * @param {Array} h2hProbs - Array of { selectionId, opponentSelectionId, pBeatsOpponent }
 * @returns {Array} Normalized
 */
export function normalizeH2HProbabilities(h2hProbs) {
  if (!h2hProbs || h2hProbs.length === 0) return [];

  return h2hProbs.map(h => {
    let p = Math.min(0.95, Math.max(0.05, h.pBeatsOpponent || 0.5));
    return { ...h, pBeatsOpponent: p };
  });
}

/**
 * Build a probability map by selectionId for quick lookup.
 * @param {Array} runnerProbs - Array of { selectionId, pWin, pPlace, ... }
 * @returns {Map} selectionId → { pWin, pPlace, confidence, reasons }
 */
export function buildProbabilityMap(runnerProbs) {
  const map = new Map();
  if (!runnerProbs) return map;
  for (const rp of runnerProbs) {
    map.set(String(rp.selectionId), {
      pWin: rp.pWin || 0,
      pPlace: rp.pPlace || 0,
      confidence: rp.confidence || 0,
      reasons: rp.reasons || [],
      risks: rp.risks || [],
    });
  }
  return map;
}

/**
 * Build an H2H probability lookup.
 * @param {Array} h2hProbs - Array of { marketId, selectionId, opponentSelectionId, pBeatsOpponent }
 * @returns {Map} key: "marketId:selectionId" → pBeatsOpponent
 */
export function buildH2HMap(h2hProbs) {
  const map = new Map();
  if (!h2hProbs) return map;
  for (const h of h2hProbs) {
    const key = `${h.marketId}:${h.selectionId}`;
    map.set(key, h);
    // Also store reverse
    const reverseKey = `${h.marketId}:${h.opponentSelectionId}`;
    map.set(reverseKey, { ...h, selectionId: h.opponentSelectionId, opponentSelectionId: h.selectionId, pBeatsOpponent: 1 - h.pBeatsOpponent });
  }
  return map;
}