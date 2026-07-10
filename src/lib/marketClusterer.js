// ============================================================================
// Market Clusterer — Groups markets by event/race and detects market types
//
// Detects WIN, PLACE, and H2H/AvB markets from Betfair marketTypeCode,
// marketName, and structural heuristics (runner count).
// ============================================================================

const H2H_PATTERNS = [
  /\bv\s|\.v\./i,
  /\bvs\b/i,
  /\bavb\b/i,
  /head\s*to\s*head/i,
  /match\s*betting/i,
  /head-to-head/i,
];

/**
 * Detect market type from market metadata.
 * @returns {'WIN' | 'PLACE' | 'H2H' | 'OTHER'}
 */
export function detectMarketType(market) {
  const mtc = market.marketTypeCode || market.marketType || '';
  const name = market.marketName || '';

  // Betfair marketTypeCode is the most reliable signal
  if (mtc === 'WIN' || mtc === 'WIN_MARKET') return 'WIN';
  if (mtc === 'PLACE' || mtc === 'PLACE_MARKET') return 'PLACE';
  if (mtc === 'MATCH_ODDS' || mtc === 'MATCH_BET' || mtc === 'AVB' || mtc === 'HEAD_TO_HEAD') return 'H2H';

  // Fallback: marketName detection
  const lowerName = name.toLowerCase();
  if (H2H_PATTERNS.some(re => re.test(lowerName))) return 'H2H';

  // "To Be Placed" / "Place" detection
  if (lowerName.includes('place') || lowerName.includes('to be placed')) return 'PLACE';

  // Default: if name contains "Win" or "To Win" or is a standard racing market
  if (lowerName === 'win' || lowerName.includes('to win') || lowerName.includes('winner')) return 'WIN';

  // Structural heuristic: 2-runner market with H2H-style name
  const runnerCount = market.numberOfRunners || market.numberOfActiveRunners || 0;
  if (runnerCount === 2 && H2H_PATTERNS.some(re => re.test(lowerName))) return 'H2H';

  // Default for racing: treat as WIN
  if (market.eventType === 'Horse Racing' || market.eventTypeId === '7' || market.eventTypeId === '4339') {
    if (lowerName === 'win' || lowerName === '' || lowerName.includes('race')) return 'WIN';
    if (runnerCount >= 2 && runnerCount <= 2 && !lowerName.includes('place')) return 'H2H';
    return 'WIN';
  }

  return 'OTHER';
}

/**
 * Extract the place terms from a PLACE market.
 * E.g. "To Be Placed (2)" → 2 places, "Top 3" → 3 places.
 * @returns {number} number of places (default 2 for H2H, 3 for PLACE)
 */
export function extractPlaceTerms(market) {
  const type = detectMarketType(market);
  if (type === 'H2H') return 1; // H2H: beat the opponent = 1 "place"

  const name = (market.marketName || '').toLowerCase();
  // Try to extract a number from "To Be Placed (N)" or "Top N Finish" or "First N"
  // Check this BEFORE the type gate — "Top 2 Finish" may not be detected as PLACE
  // by detectMarketType, but it still carries explicit place terms.
  const match = name.match(/\((\d+)\)|top\s*(\d+)|first\s*(\d+)/i);
  if (match) {
    const n = parseInt(match[1] || match[2] || match[3]);
    if (n > 0) return n;
  }

  if (type !== 'PLACE') return 1;

  // Default based on runner count
  const runnerCount = market.numberOfRunners || market.numberOfActiveRunners || 0;
  if (runnerCount >= 16) return 4;
  if (runnerCount >= 8) return 3;
  return 2;
}

/**
 * Group eligible markets by event/race (eventId).
 * Each cluster contains: eventId, eventName, startTime, venue,
 * winMarkets, placeMarkets, h2hMarkets, otherMarkets.
 *
 * @param {Array} markets - Eligible (OPEN, pre-race) markets
 * @returns {Array} Array of event cluster objects
 */
export function clusterMarketsByEvent(markets) {
  const clusters = new Map();

  for (const market of markets) {
    const eventId = market.eventId || market.betfairEventId || `${market.venue || 'unknown'}_${market.startTime || market.marketStartTime || ''}`;
    if (!clusters.has(eventId)) {
      clusters.set(eventId, {
        eventId,
        eventName: market.eventName || '',
        venue: market.venue || '',
        startTime: market.startTime || market.marketStartTime || null,
        raceNumber: market.raceNumber || 0,
        winMarkets: [],
        placeMarkets: [],
        h2hMarkets: [],
        otherMarkets: [],
      });
    }
    const cluster = clusters.get(eventId);
    cluster.eventName = cluster.eventName || market.eventName || '';
    cluster.venue = cluster.venue || market.venue || '';
    cluster.startTime = cluster.startTime || market.startTime || market.marketStartTime || null;

    const type = detectMarketType(market);
    switch (type) {
      case 'WIN': cluster.winMarkets.push(market); break;
      case 'PLACE': cluster.placeMarkets.push(market); break;
      case 'H2H': cluster.h2hMarkets.push(market); break;
      default: cluster.otherMarkets.push(market); break;
    }
  }

  return Array.from(clusters.values());
}

/**
 * Get the primary market for an event cluster.
 * Prefers WIN (most complete runner list), falls back to any available market.
 */
export function getPrimaryMarket(cluster) {
  if (cluster.winMarkets.length > 0) return cluster.winMarkets[0];
  if (cluster.placeMarkets.length > 0) return cluster.placeMarkets[0];
  if (cluster.h2hMarkets.length > 0) return cluster.h2hMarkets[0];
  if (cluster.otherMarkets.length > 0) return cluster.otherMarkets[0];
  return null;
}

/**
 * Get all markets in a cluster.
 */
export function getAllMarketsInCluster(cluster) {
  return [
    ...cluster.winMarkets,
    ...cluster.placeMarkets,
    ...cluster.h2hMarkets,
    ...cluster.otherMarkets,
  ];
}