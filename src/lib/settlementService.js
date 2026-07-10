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
  const placeTerms = result?.placeTerms || order?.placeTerms || 2;
  const resultSource = result?.resultSource || 'betfair_stream';
  const marketStatusAtSettlement = result?.marketStatusAtSettlement || 'CLOSED';
  const settledDate = new Date().toISOString();

  // ── Voided market ──
  if (resultSource === 'market_voided') {
    return {
      ...order,
      result: 'void',
      status: 'voided',
      settlementStatus: 'voided',
      settled_date: settledDate,
      settledAt: settledDate,
      grossProfit: 0,
      commission: 0,
      netProfit: 0,
      closingOdds: null,
      clv: 0,
      exitReason: 'Market voided by Betfair',
      resultSource,
      resultConfidence: 'confirmed',
      marketStatusAtSettlement,
      winnerSelectionIds: winners,
      placedSelectionIds: placedRunners,
      voided: true,
      voidReason: 'market_voided_by_betfair',
    };
  }

  // ── Result unknown: cannot confirm winner/placed from reliable source ──
  // Do NOT guess. Set status to awaiting_result and netProfit to null.
  // Lifecycle: status=awaiting_result, settlementStatus=result_unknown, settledAt=null
  // (settledAt is only set when the order is truly settled)
  const hasWinners = winners.length > 0;
  const hasPlaced = placedRunners.length > 0 || (marketType !== 'PLACE');

  if (!hasWinners && (marketType === 'WIN' || marketType === 'H2H')) {
    return {
      ...order,
      result: 'pending',
      status: 'awaiting_result',
      settlementStatus: 'result_unknown',
      settledAt: null,
      netProfit: null,
      grossProfit: null,
      commission: null,
      closingOdds: null,
      clv: null,
      exitReason: 'Result unknown — no winner data from reliable source',
      resultSource,
      resultConfidence: 'unknown',
      marketStatusAtSettlement,
      winnerSelectionIds: winners,
      placedSelectionIds: placedRunners,
      voided: false,
      voidReason: null,
      marketType,
    };
  }

  if (marketType === 'PLACE' && !hasPlaced && !hasWinners) {
    return {
      ...order,
      result: 'pending',
      status: 'awaiting_result',
      settlementStatus: 'result_unknown',
      settledAt: null,
      netProfit: null,
      grossProfit: null,
      commission: null,
      closingOdds: null,
      clv: null,
      exitReason: 'Result unknown — no place terms data from reliable source',
      resultSource,
      resultConfidence: 'unknown',
      marketStatusAtSettlement,
      winnerSelectionIds: winners,
      placedSelectionIds: placedRunners,
      voided: false,
      voidReason: null,
      marketType,
    };
  }

  // ── Determine selection outcome based on market type ──
  let selectionWon = false;
  let selectionPlaced = false;
  let selectedRunnerFinishPosition = null;
  let opponentFinishPosition = null;

  if (marketType === 'WIN') {
    selectionWon = winners.includes(orderSelectionId);
    selectionPlaced = selectionWon;
    selectedRunnerFinishPosition = winners.indexOf(orderSelectionId) >= 0 ? winners.indexOf(orderSelectionId) + 1 : null;
  } else if (marketType === 'PLACE') {
    selectionPlaced = placedRunners.includes(orderSelectionId) || winners.includes(orderSelectionId);
    selectionWon = selectionPlaced;
  } else if (marketType === 'H2H') {
    selectionWon = winners.includes(orderSelectionId);
    selectionPlaced = selectionWon;
    // For H2H, opponent is the other runner in the market
    if (order.opponentSelectionId) {
      opponentFinishPosition = winners.includes(String(order.opponentSelectionId)) ? 1 : null;
    }
  } else {
    selectionWon = winners.includes(orderSelectionId);
    selectionPlaced = selectionWon;
  }

  // ── Determine bet outcome based on side and market type ──
  let betWon;
  if (order.side === 'BACK') {
    betWon = marketType === 'PLACE' ? selectionPlaced : selectionWon;
  } else {
    // LAY: bet wins when selection does NOT win/place
    betWon = marketType === 'PLACE' ? !selectionPlaced : !selectionWon;
  }

  // ── Calculate commission ──
  const commResult = calculateCommission(
    betWon ? (order.side === 'BACK' ? (order.matchedOdds - 1) * order.matchedStake : order.matchedStake) : 0,
    market,
    settings
  );
  const commissionRate = commResult.rate;
  const commissionSource = commResult.source;

  // ── CLV: only calculate if real closingOdds provided — never random ──
  const closingOdds = result?.closingOdds || null;
  const clv = closingOdds ? (((order.matchedOdds - closingOdds) / closingOdds) * 100) * (order.side === 'LAY' ? -1 : 1) : 0;

  // ── Calculate P/L ──
  let grossProfit, netProfit, commission;

  if (betWon) {
    if (order.side === 'BACK') {
      grossProfit = (order.matchedOdds - 1) * order.matchedStake;
      commission = grossProfit * commissionRate;
      netProfit = grossProfit - commission;
    } else {
      grossProfit = order.matchedStake;
      commission = grossProfit * commissionRate;
      netProfit = grossProfit - commission;
    }
  } else {
    if (order.side === 'BACK') {
      grossProfit = -order.matchedStake;
    } else {
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
    settlementStatus: 'settled',
    settled_date: settledDate,
    settledAt: settledDate,
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
    resultConfidence: 'confirmed',
    marketStatusAtSettlement,
    winnerSelectionIds: winners,
    placedSelectionIds: placedRunners,
    selectedRunnerFinishPosition,
    opponentFinishPosition,
    voided: false,
    voidReason: null,
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
  const now = new Date().toISOString();
  return {
    ...order,
    status: 'lapsed',
    result: 'void',
    settlementStatus: 'voided',
    lapse_reason: reason,
    settled_date: now,
    settledAt: now,
    remaining_size: 0,
    netProfit: 0,
    grossProfit: 0,
    commission: 0,
    voided: true,
    voidReason: 'unmatched_order_lapsed',
    resultSource: 'market_closed',
    exitReason: reason,
  };
}