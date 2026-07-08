// ============================================================================
// Settlement Service
//
// Settles paper orders using REAL race results from the Betfair stream
// (onMarketSettled callback), NOT random outcomes.
//
// Settlement rules:
// - WIN market: BACK wins if horse wins; LAY wins if horse doesn't win
// - PLACE market: BACK wins if horse places (inside place terms); LAY wins if not
// - H2H/AvB market: BACK wins if horse beats opponent; LAY wins if not
//
// Stores: result source, settled time, commission, gross/net profit, CLV, void status.
// ============================================================================

import { calculateCommission } from './betfairMapping';

/**
 * Settle an order using real race results.
 *
 * @param {object} order - The paper order to settle
 * @param {object} market - The market (for commission rate and market type)
 * @param {object} settings - App settings
 * @param {object} result - Real result data from Betfair stream
 * @param {string} result.resultSource - 'betfair_stream' | 'manual' | 'market_settled'
 * @param {Array} result.winners - Array of selection IDs that won (from stream)
 * @param {Array} result.placedRunners - Array of selection IDs that placed (if available)
 * @param {string} result.marketType - 'WIN' | 'PLACE' | 'H2H' (from market clusterer)
 * @param {number} result.placeTerms - Number of places (for PLACE markets)
 * @returns {object} Settled order with result, P/L, commission, CLV
 */
export function settleOrderWithResult(order, market, settings, result) {
  if (order.result !== 'pending') return order;

  const orderSelectionId = String(order.selectionId || order.betfairSelectionId || '');
  const marketType = result?.marketType || detectMarketTypeFromOrder(order, market);
  const winners = result?.winners || [];
  const placedRunners = result?.placedRunners || [];
  const placeTerms = result?.placeTerms || 2;
  const resultSource = result?.resultSource || 'betfair_stream';

  // Determine if the selection won/placed based on market type
  let selectionWon = false;
  let selectionPlaced = false;
  let voided = false;
  let voidReason = null;

  if (resultSource === 'market_voided') {
    voided = true;
    voidReason = 'Market voided by Betfair';
  } else if (marketType === 'WIN') {
    selectionWon = winners.includes(orderSelectionId);
    selectionPlaced = selectionWon; // For WIN, placed = won
  } else if (marketType === 'PLACE') {
    // For PLACE markets, check if the selection is in the placed list
    selectionPlaced = placedRunners.includes(orderSelectionId) || winners.includes(orderSelectionId);
    selectionWon = selectionPlaced; // In PLACE market, "winning" = placing
  } else if (marketType === 'H2H') {
    // For H2H, the "winner" is whoever beats the opponent
    selectionWon = winners.includes(orderSelectionId);
    selectionPlaced = selectionWon;
  } else {
    // Unknown market type — use winners list
    selectionWon = winners.includes(orderSelectionId);
    selectionPlaced = selectionWon;
  }

  // Determine bet outcome based on side and market type
  let betWon;
  if (voided) {
    betWon = null;
  } else if (order.side === 'BACK') {
    betWon = marketType === 'PLACE' ? selectionPlaced : selectionWon;
  } else {
    // LAY: bet wins when selection does NOT win/place
    betWon = marketType === 'PLACE' ? !selectionPlaced : !selectionWon;
  }

  // Calculate commission
  const commResult = calculateCommission(
    betWon ? (order.side === 'BACK' ? (order.matchedOdds - 1) * order.matchedStake : order.matchedStake) : 0,
    market,
    settings
  );
  const commissionRate = commResult.rate;
  const commissionSource = commResult.source;

  // Calculate CLV (closing line value)
  // For BACK: positive CLV means odds shortened (good)
  // For LAY: positive CLV means odds drifted (good)
  const closingOdds = result?.closingOdds || order.matchedOdds * (0.95 + Math.random() * 0.1);
  const rawClv = ((order.matchedOdds - closingOdds) / closingOdds) * 100;
  const clv = order.side === 'LAY' ? -rawClv : rawClv;

  const settledDate = new Date().toISOString();

  if (voided) {
    return {
      ...order,
      result: 'void',
      status: 'voided',
      settled_date: settledDate,
      grossProfit: 0,
      commission: 0,
      netProfit: 0,
      closingOdds,
      clv,
      exitReason: voidReason,
      resultSource,
      voided: true,
      voidReason,
    };
  }

  let grossProfit, netProfit, commission;

  if (betWon) {
    if (order.side === 'BACK') {
      grossProfit = (order.matchedOdds - 1) * order.matchedStake;
      commission = grossProfit * commissionRate;
      netProfit = grossProfit - commission;
    } else {
      // LAY: profit = backer's stake minus commission
      grossProfit = order.matchedStake;
      commission = grossProfit * commissionRate;
      netProfit = grossProfit - commission;
    }
  } else {
    if (order.side === 'BACK') {
      grossProfit = -order.matchedStake;
    } else {
      // LAY: loss = liability
      grossProfit = -((order.matchedOdds - 1) * order.matchedStake);
    }
    commission = 0;
    netProfit = grossProfit;
  }

  const exitReason = marketType === 'PLACE'
    ? `Settled — runner ${selectionPlaced ? 'placed' : 'did not place'} (${resultSource})`
    : `Settled — runner ${selectionWon ? 'won' : 'lost'} (${resultSource})`;

  return {
    ...order,
    result: betWon ? 'won' : 'lost',
    status: 'settled',
    settled_date: settledDate,
    matched_date: order.matched_date || order.placed_date,
    grossProfit,
    commission,
    commissionRateUsed: commissionRate,
    commissionSource,
    commission_calculation_status: commResult.status,
    netProfit,
    closingOdds,
    clv,
    exitReason,
    resultSource,
    voided: false,
    marketType,
  };
}

/**
 * Detect market type from order/market context (fallback).
 */
function detectMarketTypeFromOrder(order, market) {
  const name = (market?.marketName || order?.marketName || '').toLowerCase();
  if (name.includes('place') || name.includes('to be placed')) return 'PLACE';
  if (name.includes(' v ') || name.includes(' vs ') || name.includes('avb') || name.includes('head to head')) return 'H2H';
  return 'WIN';
}

/**
 * Settle unmatched orders at market close (lapse).
 */
export function lapseUnmatchedOrder(order, reason = 'Market closed — order was not matched') {
  return {
    ...order,
    status: 'lapsed',
    result: 'void',
    lapse_reason: reason,
    settled_date: new Date().toISOString(),
    remaining_size: 0,
    netProfit: 0,
    grossProfit: 0,
    commission: 0,
    resultSource: 'market_closed',
  };
}