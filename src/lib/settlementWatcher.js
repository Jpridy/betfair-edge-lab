// ============================================================================
// Settlement Watcher — Active Result Detection for Paper Orders
//
// Runs periodically to check awaiting_result paper orders and attempt
// settlement using:
//   1. Betfair stream/catalogue market status + winner data
//   2. OpenAI web search result_lookup (if available)
//
// Never guesses. Never uses Math.random. If no result is found, the order
// stays as awaiting_result.
// ============================================================================

import { settleOrderWithResult, lapseUnmatchedOrder } from './settlementService';
import { detectMarketType } from './marketClusterer';

/**
 * Run a settlement check on all awaiting_result paper orders.
 *
 * @param {object} params
 * @param {Array} params.paperOrders - All paper orders
 * @param {Array} params.markets - All markets (for status checks)
 * @param {Array} params.runners - All runners (for winner detection)
 * @param {object} params.settings - App settings
 * @param {Function} params.updateOrder - async (orderId, settledOrder) => void
 * @param {Function} params.invokeFunction - async (functionName, payload) => response
 * @param {Function} params.addAuditLog - (action, category, severity, details) => void
 * @returns {object} Settlement check results
 */
export async function runSettlementCheck({
  paperOrders,
  markets,
  runners,
  settings,
  updateOrder,
  invokeFunction,
  addAuditLog,
}) {
  const awaiting = paperOrders.filter(o =>
    o.status === 'awaiting_result' ||
    (o.result === 'pending' && o.status !== 'settled' && o.status !== 'voided' && o.status !== 'lapsed' && o.status !== 'cancelled' && o.status !== 'rejected')
  );

  const before = awaiting.length;
  if (before === 0) {
    return {
      awaitingBefore: 0,
      settledThisRun: 0,
      resultUnknownThisRun: 0,
      stillAwaiting: 0,
      latestResultSource: null,
      latestSettlementError: null,
    };
  }

  let settledThisRun = 0;
  let resultUnknownThisRun = 0;
  let latestResultSource = null;
  let latestSettlementError = null;

  for (const order of awaiting) {
    try {
      const orderMarketId = order.betfairMarketId || order.marketId;
      const market = markets.find(m =>
        m.betfairMarketId === orderMarketId || m.id === orderMarketId
      );

      if (!market) {
        // Market not in memory — can't check. Leave as awaiting.
        resultUnknownThisRun++;
        continue;
      }

      // ── Check market status ──
      // If market is still OPEN, race hasn't run yet — leave as awaiting
      if (market.status === 'OPEN') {
        resultUnknownThisRun++;
        continue;
      }

      // If market is SUSPENDED, race may be in progress — leave as awaiting
      if (market.status === 'SUSPENDED') {
        resultUnknownThisRun++;
        continue;
      }

      // ── Market is CLOSED or SETTLED — try to get winner data ──
      // Check runner statuses for WINNER/LOSER/PLACED
      const marketRunners = runners.filter(r =>
        (r.marketId === market.id || r.marketId === market.betfairMarketId) &&
        r.status !== 'HIDDEN'
      );

      const winners = marketRunners
        .filter(r => r.status === 'WINNER')
        .map(r => String(r.betfairSelectionId || r.selectionId));

      const placedRunners = marketRunners
        .filter(r => r.status === 'PLACED' || r.status === 'WINNER')
        .map(r => String(r.betfairSelectionId || r.selectionId));

      const orderSelectionId = String(order.selectionId || '');
      const marketType = order.marketType || detectMarketType(market);

      // ── Attempt 1: Settle from runner status data ──
      if (winners.length > 0 || (marketType === 'PLACE' && placedRunners.length > 0)) {
        const settled = settleOrderWithResult(order, market, settings, {
          winners,
          placedRunners,
          placeTerms: null,
          resultSource: 'betfair_market_status',
          marketType,
          marketStatusAtSettlement: market.status,
        });

        if (settled.status === 'settled') {
          await updateOrder(order.id, settled);
          settledThisRun++;
          latestResultSource = 'betfair_market_status';
          addAuditLog('Proof Settlement', 'order', 'info',
            `${order.runnerName} settled via market status — ${settled.result} (net $${settled.netProfit?.toFixed(2)})`);
          continue;
        }
      }

      // ── Attempt 2: OpenAI web search result_lookup ──
      // Only if OpenAI is available (check via the function invocation)
      try {
        const opponentSelectionId = order.opponentSelectionId || null;
        const resp = await invokeFunction('openAIWebSearch', {
          action: 'result_lookup',
          eventName: market.eventName || order.marketName || '',
          marketName: market.marketName || order.marketName || '',
          marketStartTime: market.startTime || market.marketStartTime || order.marketStartTime || '',
          runnerName: order.runnerName || '',
          selectionId: orderSelectionId,
          marketType,
          opponentSelectionId,
        });

        const lookup = resp?.data?.resultLookup;
        if (lookup && lookup.resultLookupStatus === 'success') {
          const lookupWinners = lookup.winnerSelectionIds || [];
          const lookupPlaced = lookup.placedSelectionIds || [];

          if (lookupWinners.length > 0 || (marketType === 'PLACE' && lookupPlaced.length > 0)) {
            const settled = settleOrderWithResult(order, market, settings, {
              winners: lookupWinners,
              placedRunners: lookupPlaced,
              placeTerms: null,
              resultSource: 'openai_result_lookup',
              marketType,
              marketStatusAtSettlement: market.status,
              selectedRunnerFinishPosition: lookup.selectedRunnerFinishPosition,
              opponentFinishPosition: lookup.opponentFinishPosition,
            });

            if (settled.status === 'settled') {
              await updateOrder(order.id, settled);
              settledThisRun++;
              latestResultSource = 'openai_result_lookup';
              addAuditLog('Proof Settlement', 'order', 'info',
                `${order.runnerName} settled via OpenAI result lookup — ${settled.result} (net $${settled.netProfit?.toFixed(2)})`);
              continue;
            }
          }
        }
      } catch (lookupErr) {
        latestSettlementError = lookupErr.message;
        // Fall through to result_unknown
      }

      // ── No result found — keep as awaiting_result ──
      resultUnknownThisRun++;
    } catch (err) {
      latestSettlementError = err.message;
      resultUnknownThisRun++;
    }
  }

  addAuditLog('Settlement Check Run', 'system', 'info',
    `Checked ${before} awaiting orders — ${settledThisRun} settled, ${resultUnknownThisRun} still unknown`);

  return {
    awaitingBefore: before,
    settledThisRun,
    resultUnknownThisRun,
    stillAwaiting: before - settledThisRun,
    latestResultSource,
    latestSettlementError,
  };
}