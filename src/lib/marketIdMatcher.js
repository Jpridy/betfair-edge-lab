/**
 * Match a runner to a market using string-normalised IDs.
 *
 * Betfair market/runner IDs can arrive as numbers (from stream) or strings
 * (from REST catalogue). Strict equality (===) silently fails when types
 * differ, causing the engine to see "0 runners" even when thousands exist.
 *
 * This helper checks ALL possible ID fields on both objects, normalised to
 * strings, so joins never fail due to type mismatches.
 *
 * @param {object} runner - Runner object (has marketId, betfairMarketId, market_id)
 * @param {object} market - Market object (has id, marketId, betfairMarketId)
 * @returns {boolean} true if the runner belongs to the market
 */
export function matchRunnerToMarket(runner, market) {
  if (!runner || !market) return false;

  const runnerMarketIds = [
    runner.marketId,
    runner.betfairMarketId,
    runner.market_id,
  ].filter(Boolean).map(String);

  const marketIds = [
    market.id,
    market.marketId,
    market.betfairMarketId,
  ].filter(Boolean).map(String);

  if (runnerMarketIds.length === 0 || marketIds.length === 0) return false;

  return runnerMarketIds.some(id => marketIds.includes(id));
}

/**
 * Check if a paper order belongs to a given market (string-normalised).
 * Used in duplicate-order checks where order.marketId / order.betfairMarketId
 * must be compared against market.id / market.betfairMarketId.
 */
export function matchOrderToMarket(order, market) {
  if (!order || !market) return false;

  const orderMarketIds = [
    order.marketId,
    order.betfairMarketId,
  ].filter(Boolean).map(String);

  const marketIds = [
    market.id,
    market.marketId,
    market.betfairMarketId,
  ].filter(Boolean).map(String);

  if (orderMarketIds.length === 0 || marketIds.length === 0) return false;

  return orderMarketIds.some(id => marketIds.includes(id));
}

/**
 * Check if two selection IDs match (string-normalised).
 */
export function matchSelectionId(idA, idB) {
  return String(idA || '') === String(idB || '') && String(idA || '') !== '';
}