// ============================================================================
// Betfair Exchange Tick Ladder
// 
// Betfair odds are NOT continuous decimal increments — they follow a
// specific tick ladder with varying increments at different price ranges.
// This module provides all tick-level calculations needed for scalping,
// stop-loss, spread analysis, and price validation.
//
// Tick increments by price range:
//   1.01–2.00 → 0.01
//   2.00–3.00 → 0.02
//   3.00–4.00 → 0.05
//   4.00–6.00 → 0.10
//   6.00–10.0 → 0.20
//   10.0–20.0 → 0.50
//   20.0–30.0 → 1.0
//   30.0–50.0 → 2.0
//   50.0–100  → 5.0
//   100+      → 10.0
// ============================================================================

const TICK_RANGES = [
  { min: 1.01, max: 2.00, step: 0.01 },
  { min: 2.00, max: 3.00, step: 0.02 },
  { min: 3.00, max: 4.00, step: 0.05 },
  { min: 4.00, max: 6.00, step: 0.10 },
  { min: 6.00, max: 10.00, step: 0.20 },
  { min: 10.00, max: 20.00, step: 0.50 },
  { min: 20.00, max: 30.00, step: 1.00 },
  { min: 30.00, max: 50.00, step: 2.00 },
  { min: 50.00, max: 100.00, step: 5.00 },
  { min: 100.00, max: 1000.00, step: 10.00 },
];

export const MIN_ODDS = 1.01;
export const MAX_ODDS = 1000;

/**
 * Get the tick increment for a given price.
 */
export function getTickSize(price) {
  for (const range of TICK_RANGES) {
    if (price >= range.min && price < range.max) return range.step;
  }
  if (price >= 100) return 10;
  return 0.01;
}

/**
 * Get the next valid tick price above the given price.
 */
export function getNextTickUp(price) {
  if (price < MIN_ODDS) return MIN_ODDS;
  if (price >= MAX_ODDS) return MAX_ODDS;

  const step = getTickSize(price);
  let nextPrice = price + step;

  // Round to avoid floating point issues
  nextPrice = Math.round(nextPrice * 100) / 100;

  // If we've crossed into a new range, the step might change
  const newStep = getTickSize(nextPrice);
  if (newStep !== step) {
    // Adjust to the boundary of the new range
    nextPrice = Math.round(nextPrice * 100) / 100;
  }

  return Math.min(nextPrice, MAX_ODDS);
}

/**
 * Get the next valid tick price below the given price.
 */
export function getNextTickDown(price) {
  if (price <= MIN_ODDS) return MIN_ODDS;
  if (price > MAX_ODDS) return MAX_ODDS;

  const step = getTickSize(price - 0.001); // Use the step of the range below
  let nextPrice = price - step;

  // Round to avoid floating point issues
  nextPrice = Math.round(nextPrice * 100) / 100;

  return Math.max(nextPrice, MIN_ODDS);
}

/**
 * Count the number of ticks between two prices.
 * Returns a positive number regardless of order.
 */
export function countTicksBetween(priceA, priceB) {
  let low = Math.min(priceA, priceB);
  let high = Math.max(priceA, priceB);
  let ticks = 0;
  let current = low;

  while (current < high - 0.001 && ticks < 10000) {
    current = getNextTickUp(current);
    ticks++;
  }

  return ticks;
}

/**
 * Validate that a price is on the Betfair tick ladder.
 */
export function isValidTickPrice(price) {
  if (price < MIN_ODDS || price > MAX_ODDS) return false;
  const step = getTickSize(price);
  const remainder = (price / step) % 1;
  // Allow tiny floating point tolerance
  return remainder < 0.001 || remainder > 0.999;
}

/**
 * Round an invalid price to the nearest valid tick on the ladder.
 */
export function roundToNearestTick(price) {
  if (price <= MIN_ODDS) return MIN_ODDS;
  if (price >= MAX_ODDS) return MAX_ODDS;

  // Walk up from 1.01 until we bracket the price
  let below = MIN_ODDS;
  let above = getNextTickUp(below);

  while (above < price && above < MAX_ODDS) {
    below = above;
    above = getNextTickUp(above);
  }

  // Pick the closer one
  const distBelow = price - below;
  const distAbove = above - price;
  return distBelow <= distAbove ? below : above;
}

/**
 * Calculate the spread in ticks between a back price and a lay price.
 * In Betfair, the spread is the gap between best available back and lay.
 */
export function calculateSpreadTicks(bestBackPrice, bestLayPrice) {
  if (!bestBackPrice || !bestLayPrice || bestBackPrice <= 0 || bestLayPrice <= 0) return 0;
  return countTicksBetween(bestBackPrice, bestLayPrice);
}

/**
 * Calculate a stop-loss price N ticks away from the entry price.
 * For a BACK bet, stop loss is below entry (price goes down = loss).
 * For a LAY bet, stop loss is above entry (price goes up = loss).
 */
export function calculateStopLossPrice(entryPrice, ticks, side) {
  if (side === 'BACK') {
    let price = entryPrice;
    for (let i = 0; i < ticks; i++) price = getNextTickDown(price);
    return price;
  } else {
    let price = entryPrice;
    for (let i = 0; i < ticks; i++) price = getNextTickUp(price);
    return price;
  }
}

/**
 * Calculate a scalp profit target price N ticks away from entry.
 * For a BACK bet, target is above entry (price goes up = profit).
 * For a LAY bet, target is below entry (price goes down = profit).
 */
export function calculateScalpTargetPrice(entryPrice, ticks, side) {
  if (side === 'BACK') {
    let price = entryPrice;
    for (let i = 0; i < ticks; i++) price = getNextTickUp(price);
    return price;
  } else {
    let price = entryPrice;
    for (let i = 0; i < ticks; i++) price = getNextTickDown(price);
    return price;
  }
}

/**
 * Calculate the profit from a scalp trade (back then lay, or lay then back).
 * For BACK then LAY: profit = (backStake * backPrice) - (layStake * layPrice)
 * Simplified: if you back at price P1 with stake S, then lay at P2 (< P1) 
 * with stake S*P1/P2, profit = S*(P1-P2)/P2 per tick movement.
 */
export function calculateScalpProfit(entryPrice, exitPrice, stake, side) {
  if (side === 'BACK') {
    // Back at entryPrice, lay at exitPrice (lower)
    const layStake = (stake * entryPrice) / exitPrice;
    const profit = stake * entryPrice - layStake * exitPrice;
    return Math.round(profit * 100) / 100;
  } else {
    // Lay at entryPrice, back at exitPrice (higher)
    const backStake = (stake * entryPrice) / exitPrice;
    const profit = backStake * exitPrice - stake * entryPrice;
    return Math.round(profit * 100) / 100;
  }
}

/**
 * Get a human-readable description of the spread quality.
 */
export function getSpreadQuality(spreadTicks) {
  if (spreadTicks <= 1) return { label: 'Very Tight', status: 'ok' };
  if (spreadTicks <= 2) return { label: 'Tight', status: 'ok' };
  if (spreadTicks <= 3) return { label: 'Normal', status: 'info' };
  if (spreadTicks <= 5) return { label: 'Wide', status: 'warning' };
  return { label: 'Very Wide', status: 'danger' };
}

/**
 * Generate a price ladder (available prices) for a runner.
 * Returns an array of { price, isBack, isLay } objects.
 */
export function generatePriceLadder(bestBackPrice, bestLayPrice, depth = 5) {
  const ladder = [];
  
  // Generate lay prices above best lay
  let price = bestLayPrice;
  for (let i = 0; i < depth; i++) {
    ladder.push({ price, type: 'lay', level: i });
    price = getNextTickUp(price);
  }

  // Generate back prices below best back
  price = bestBackPrice;
  for (let i = 0; i < depth; i++) {
    ladder.unshift({ price, type: 'back', level: i });
    if (price > MIN_ODDS) price = getNextTickDown(price);
  }

  return ladder;
}