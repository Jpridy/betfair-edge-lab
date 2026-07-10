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
import { matchRunnerToMarket } from './marketIdMatcher';

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
  // ── Only check orders that are genuinely awaiting settlement ──
  // Must be matched or partially_matched, and settlementStatus must be
  // awaiting_result or result_unknown. Do not re-check pending/unmatched orders.
  const awaiting = paperOrders.filter(o =>
    (o.status === 'matched' || o.status === 'partially_matched' || o.status === 'awaiting_result') &&
    (o.settlementStatus === 'awaiting_result' || o.settlementStatus === 'result_unknown' || o.settlementStatus == null) &&
    o.status !== 'settled' &&
    o.status !== 'voided' &&
    o.status !== 'lapsed' &&
    o.status !== 'cancelled' &&
    o.status !== 'rejected'
  );

  const before = awaiting.length;
  if (before === 0) {
    return {
      awaitingBefore: 0,
      settledThisRun: 0,
      resultUnknownThisRun: 0,
      voidedThisRun: 0,
      stillAwaitingRace: 0,
      stillAwaiting: 0,
      latestResultSource: null,
      latestSettlementError: null,
    };
  }

  let settledThisRun = 0;
  let resultUnknownThisRun = 0;
  let voidedThisRun = 0;
  let stillAwaitingRace = 0;
  let latestResultSource = null;
  let latestSettlementError = null;

  for (const order of awaiting) {
    try {
      const orderMarketId = order.betfairMarketId || order.marketId;
      // Use shared string-normalised market matcher (same as exchange engine)
      const market = markets.find(m => matchRunnerToMarket(order, m));

      if (!market) {
        // ── Market pruned from memory — attempt backfill from order metadata ──
        // Reconstruct settlement lookup from stored PaperOrder fields
        // rather than stopping because the market is missing.
        if (order.marketType && order.runnerName && order.marketStartTime) {
          try {
            const opponentSelectionId = order.opponentSelectionId || null;
            const resp = await invokeFunction('openAIWebSearch', {
              action: 'result_lookup',
              eventName: order.eventName || order.marketName || '',
              marketName: order.marketName || '',
              marketStartTime: order.marketStartTime || '',
              runnerName: order.runnerName || '',
              selectionId: String(order.selectionId || ''),
              marketType: order.marketType,
              opponentSelectionId,
              runners: (() => {
                const linked = runners.filter(r => String(r.marketId || '') === String(orderMarketId || ''));
                return linked.length > 0
                  ? linked.map(r => ({ selectionId: String(r.betfairSelectionId || r.selectionId || ''), runnerName: r.runnerName || '' }))
                  : [{ selectionId: String(order.selectionId || ''), runnerName: order.runnerName || '' }];
              })(),
            });

            const lookup = resp?.data?.resultLookup;
            if (lookup && lookup.resultLookupStatus === 'success') {
              const lookupWinners = lookup.winnerSelectionIds || [];
              const lookupPlaced = lookup.placedSelectionIds || [];

              if (lookupWinners.length > 0 || (order.marketType === 'PLACE' && lookupPlaced.length > 0)) {
                const settled = settleOrderWithResult(order, { marketName: order.marketName }, settings, {
                  winners: lookupWinners,
                  placedRunners: lookupPlaced,
                  placeTerms: order.placeTerms || null,
                  resultSource: 'openai_result_lookup_backfill',
                  marketType: order.marketType,
                  marketStatusAtSettlement: 'CLOSED',
                  selectedRunnerFinishPosition: lookup.selectedRunnerFinishPosition,
                  opponentFinishPosition: lookup.opponentFinishPosition,
                });

                if (settled.status === 'settled') {
                  await updateOrder(order.id, settled);
                  settledThisRun++;
                  latestResultSource = 'openai_result_lookup_backfill';
                  addAuditLog('Settlement Backfill', 'order', 'info',
                    `${order.runnerName} settled via OpenAI backfill (market pruned) — ${settled.result} (net $${settled.netProfit?.toFixed(2)})`);
                  continue;
                }
              }
            }
          } catch (backfillErr) {
            latestSettlementError = backfillErr.message;
          }
        }
        // Backfill failed — keep as awaiting
        resultUnknownThisRun++;
        continue;
      }

      // ── Check market status ──
      // If market is still OPEN, race hasn't run yet — NOT result_unknown.
      // This is a normal "still waiting for the race to run" state.
      if (market.status === 'OPEN') {
        stillAwaitingRace++;
        continue;
      }

      // If market is SUSPENDED, race may be in progress — leave as awaiting
      if (market.status === 'SUSPENDED') {
        stillAwaitingRace++;
        continue;
      }

      // ── Market is CLOSED or SETTLED — try to get winner data ──
      // Check runner statuses for WINNER/LOSER/PLACED
      const marketRunners = runners.filter(r =>
        matchRunnerToMarket(r, market) && r.status !== 'HIDDEN'
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
          placeTerms: order.placeTerms || null,
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
          runners: marketRunners.map(r => ({
            selectionId: String(r.betfairSelectionId || r.selectionId || ''),
            runnerName: r.runnerName || '',
          })),
        });

        const lookup = resp?.data?.resultLookup;
        if (lookup && lookup.resultLookupStatus === 'success') {
          const lookupWinners = lookup.winnerSelectionIds || [];
          const lookupPlaced = lookup.placedSelectionIds || [];

          if (lookupWinners.length > 0 || (marketType === 'PLACE' && lookupPlaced.length > 0)) {
            const settled = settleOrderWithResult(order, market, settings, {
              winners: lookupWinners,
              placedRunners: lookupPlaced,
              placeTerms: order.placeTerms || null,
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
    `Checked ${before} awaiting orders — ${settledThisRun} settled, ${voidedThisRun} voided, ${resultUnknownThisRun} result unknown, ${stillAwaitingRace} still awaiting race`);

  return {
    awaitingBefore: before,
    settledThisRun,
    resultUnknownThisRun,
    voidedThisRun,
    stillAwaitingRace,
    stillAwaiting: before - settledThisRun - voidedThisRun,
    latestResultSource,
    latestSettlementError,
  };
}