import { createValidatedPaperOrder } from './createValidatedPaperOrder';
import { calculatePriceFeedStatus } from './marketFreshness';
import { validateCompleteMarketBook } from './marketBookValidation';
import { normalizeCommissionStrict } from './strictCommission';

const fail = (failedGate, reason, details = {}) => ({ authorized: false, persisted: false, order: null, failedGate, reason, ...details });
const close = (a, b, epsilon = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;

export async function authorizeAndCreatePaperOrder(context = {}) {
  const { opportunity = {}, market, runner, marketRunners = [], settings = {}, featherlessSettings = {}, bankrollStats = {}, existingOrders = [], connectionState = {}, entityApi, emergencyStop = false, aiResult = null } = context;
  if (context.debugMode === true) return fail('DEBUG_MODE_READ_ONLY', 'Debug scans cannot persist orders', { wouldCreateOrder: false });
  if (opportunity.decision !== 'BET') return fail('DECISION_NOT_BET', 'Opportunity decision is not BET');
  if (opportunity.gatesPassed !== true) return fail(opportunity.failedGate || 'SAFETY_GATES_NOT_PASSED', 'Opportunity safety gates did not pass');
  if (!(Number(opportunity.ev) > 0)) return fail('NON_POSITIVE_EV', 'Expected value must be positive');
  if (!(Number(opportunity.roi) > 0)) return fail('NON_POSITIVE_ROI', 'ROI must be positive');
  const minEdge = Number(opportunity.minimumEdge ?? featherlessSettings.minEdge ?? 0);
  if (Number(opportunity.edge) * 100 < minEdge) return fail('EDGE_BELOW_MINIMUM', 'Edge is below the configured minimum');
  const minConfidence = Number(featherlessSettings.minConfidence ?? 0);
  if (Number(opportunity.confidence) < minConfidence) return fail('CONFIDENCE_BELOW_MINIMUM', 'Confidence is below the configured minimum');
  if (!(Number(context.positiveEvOpportunityCount) > 0)) return fail('NO_POSITIVE_EV_OPPORTUNITIES', 'No positive-EV opportunities exist in this cycle');
  if (context.apiConnected !== true || connectionState.apiConnected !== true) return fail('BETFAIR_API_DISCONNECTED', 'Betfair API state is not CONNECTED');
  if (!market || market.status !== 'OPEN') return fail('MARKET_NOT_OPEN', 'Market must be OPEN');
  if (market.inPlay === true) return fail('MARKET_IN_PLAY', 'In-play orders are not authorized');

  const freshness = calculatePriceFeedStatus(connectionState.lastActualPriceUpdateAt, Date.now(), settings.dataFreshnessLimit || 30, !!connectionState.streamError);
  if (freshness.priceFeedStatus !== 'LIVE') return fail(freshness.priceFeedStatus === 'STALE' ? 'STALE_PRICE_DATA' : 'PRICE_DATA_UNAVAILABLE', `Price feed is ${freshness.priceFeedStatus}`, freshness);
  if (freshness.priceAgeSeconds > freshness.staleThresholdSeconds) return fail('STALE_PRICE_DATA', 'Actual price age exceeds freshness limit', freshness);

  const marketStartTime = market.marketStartTime || market.startTime;
  const secondsToStart = (new Date(marketStartTime).getTime() - Date.now()) / 1000;
  const windowStart = featherlessSettings.timeWindowStart ?? settings.defaultTimeWindowStartSeconds ?? 500;
  const windowEnd = featherlessSettings.timeWindowEnd ?? settings.defaultTimeWindowEndSeconds ?? 30;
  if (!Number.isFinite(secondsToStart) || secondsToStart <= 0) return fail('MARKET_ALREADY_STARTED', 'Market has already started', { secondsToStart });
  if (secondsToStart > windowStart) return fail('TOO_EARLY_FOR_ORDER', 'Order window has not opened', { secondsToStart });
  if (secondsToStart < windowEnd) return fail('TOO_LATE_FOR_ORDER', 'Order window has closed', { secondsToStart });

  const commission = normalizeCommissionStrict(opportunity.commissionRate ?? market.marketBaseRate ?? settings.manualCommissionRate ?? settings.defaultCommissionRate);
  if (!commission.valid) return fail('INVALID_COMMISSION', commission.error, { commission });
  const book = validateCompleteMarketBook(marketRunners, settings.maxBackBookPercentage || 150);
  if (!book.valid) return fail('INVALID_MARKET_BOOK', book.errors.join('; '), { marketBookDiagnostics: book });

  const stake = Number(opportunity.stake);
  const odds = Number(opportunity.odds);
  const liability = Number(opportunity.liability);
  const maxLoss = Number(opportunity.maxLoss);
  const ev = Number(opportunity.ev);
  const roi = Number(opportunity.roi);
  const mathInputs = { side: opportunity.side, stake, odds, liability, maxLoss, ev, roi, probability: opportunity.modelProbability, commissionRate: commission.rate };
  const mathValid = opportunity.side === 'BACK'
    ? close(maxLoss, stake) && ev >= -stake && roi >= -1
    : close(liability, stake * (odds - 1)) && close(maxLoss, liability) && ev >= -liability;
  if (!mathValid) return fail('MATH_INVARIANT_VIOLATION', 'Exchange mathematical invariant failed', { rawCalculationInputs: mathInputs });
  if (context.strategyRequiresAI === true && !aiResult) return fail('AI_RESULT_REQUIRED', 'Selected strategy requires an AI result');

  const validated = createValidatedPaperOrder({ market, runner, side: opportunity.side, stake, odds, strategyName: context.strategyName, source: context.source || 'bot', settings, bankrollStats, existingOrders, emergencyStop, apiConnected: true, persistenceType: context.persistenceType || 'LAPSE', expectedValue: ev, entryReason: (opportunity.reasons || []).join('; '), dataSource: opportunity.dataSource, botSettings: context.botSettings, featherlessSettings, marketType: opportunity.marketType, marketTypeCode: opportunity.marketTypeCode, eventId: opportunity.eventId, eventName: opportunity.eventName, numberOfWinners: opportunity.numberOfWinners, placeTerms: opportunity.placeTerms, proofMode: opportunity.proofMode || false, proofReason: opportunity.proofReason || null, decisionSource: opportunity.decisionSource, selectionDiagnostics: context.selectionDiagnostics });
  if (validated.rejected) return fail(validated.order.failed_validation_field || 'RISK_CHECK_FAILED', validated.reason, { rejectedOrder: validated.order });
  if (!entityApi?.create) return fail('DATABASE_UPDATE_FAILED', 'PaperOrder entity API is unavailable');
  const order = { ...validated.order, rawCommissionRate: commission.raw, normalizedCommissionRate: commission.rate, commissionNormalizationApplied: commission.normalized, priceFeedStatus: freshness.priceFeedStatus, priceAgeSeconds: freshness.priceAgeSeconds, paperSimulationQuality: freshness.priceFeedStatus === 'LIVE' ? validated.order.paperSimulationQuality : 'Basic' };
  try { const saved = await entityApi.create(order); return { authorized: true, persisted: true, order: saved || order, failedGate: null, reason: null, secondsToStart, marketBookDiagnostics: book, priceFreshness: freshness }; }
  catch (error) { return fail('DATABASE_UPDATE_FAILED', error.message, { attemptedOrder: order }); }
}