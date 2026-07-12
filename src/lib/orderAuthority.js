import { createValidatedPaperOrder } from './createValidatedPaperOrder';
import { calculatePriceFeedStatus } from './marketFreshness';
import { validateCompleteMarketBook } from './marketBookValidation';
import { resolveCommissionRate } from './commission';
import { buildCalculationResult } from './exchangeMath';
import { proofLiabilityLimit } from './paperProofDefaults';
import { normalizeH2HProbabilities, normalizeWinProbabilities } from './probabilityNormalizer';

const fail = (failedGate, reason, details = {}) => ({ authorized: false, persisted: false, order: null, failedGate, reason, ...details });
const close = (a, b, epsilon = 1e-8) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= epsilon;

export async function authorizeAndCreatePaperOrder(context = {}) {
  const { opportunity = {}, market, runner, marketRunners = [], settings = {}, featherlessSettings = {}, bankrollStats = {}, existingOrders = [], connectionState = {}, entityApi, emergencyStop = false, aiResult = null } = context;
  if (context.debugMode === true) return fail('DEBUG_MODE_READ_ONLY', 'Debug scans cannot persist orders', { wouldCreateOrder: false });
  if(opportunity.side!=='BACK'&&opportunity.side!=='LAY')return fail('INVALID_SIDE','Order side must be BACK or LAY');
  const proofOverride=opportunity.decision==='PROOF_OVERRIDE'&&opportunity.decisionSource==='PROOF_OVERRIDE'&&opportunity.proofMode===true;
  if(!proofOverride&&opportunity.decision!=='BET')return fail('DECISION_NOT_BET','Opportunity decision is not BET');
  if(opportunity.gatesPassed!==true)return fail(opportunity.failedGate||'SAFETY_GATES_NOT_PASSED','Opportunity safety gates did not pass');
  if(proofOverride){if(settings.forcedPaperOnlyMode!==true||settings.liveTradingEnabled===true||context.botSettings?.liveTradingEnabled===true)return fail('PROOF_OVERRIDE_NOT_PAPER_ONLY','Proof override must remain paper-only');if(opportunity.marketType==='PLACE')return fail('PLACE_MODEL_NOT_VALIDATED','PLACE proof orders are blocked');if(opportunity.side==='LAY'&&Number(opportunity.liability)>proofLiabilityLimit(settings))return fail('PROOF_LIABILITY_CAP_EXCEEDED','Proof liability exceeds the hard cap');}
  else{if(!(Number(opportunity.ev)>0))return fail('NON_POSITIVE_EV','Expected value must be positive');if(!(Number(opportunity.roi)>0))return fail('NON_POSITIVE_ROI','ROI must be positive');const snapshotFields=['requiredMinEdge','requiredMinROI','requiredMinConfidence','requiredMinLiquidity','requiredMinOdds','requiredMaxOdds'];if(!opportunity.thresholdSource||snapshotFields.some(field=>opportunity[field]==null||!Number.isFinite(Number(opportunity[field]))))return fail('THRESHOLD_SNAPSHOT_MISSING','The ranked opportunity has no complete frozen threshold snapshot');if(Number(opportunity.commissionAdjustedEdge??opportunity.edge)*100<Number(opportunity.requiredMinEdge))return fail('EDGE_BELOW_MINIMUM','Commission-adjusted edge is below the frozen market threshold');if(Number(opportunity.roi)*100<Number(opportunity.requiredMinROI))return fail('ROI_BELOW_MINIMUM','ROI is below the frozen market threshold');if(Number(opportunity.confidence)<Number(opportunity.requiredMinConfidence))return fail('CONFIDENCE_BELOW_MINIMUM','Confidence is below the frozen market threshold');if(!(Number(context.positiveEvOpportunityCount)>0))return fail('NO_POSITIVE_EV_OPPORTUNITIES','No positive-EV opportunities exist in this cycle');}
  const currentAvailableSize=Number(opportunity.side==='BACK'?runner?.bestBackSize:runner?.bestLaySize);
  const requiredLiquidity=proofOverride?2:Number(opportunity.requiredMinLiquidity);
  if(!Number.isFinite(currentAvailableSize)||currentAvailableSize<requiredLiquidity)return fail('LIQUIDITY_BELOW_MINIMUM','Current liquidity is below the required minimum');
  if(!proofOverride&&(Number(opportunity.odds)<Number(opportunity.requiredMinOdds)||Number(opportunity.odds)>Number(opportunity.requiredMaxOdds)))return fail('ODDS_OUTSIDE_MARKET_RANGE','Odds are outside the frozen market range');
  if (context.apiConnected !== true || connectionState.apiConnected !== true) return fail('BETFAIR_API_DISCONNECTED', 'Betfair API state is not CONNECTED');
  if (!market || market.status !== 'OPEN') return fail('MARKET_NOT_OPEN', 'Market must be OPEN');
  if (market.inPlay === true) return fail('MARKET_IN_PLAY', 'In-play orders are not authorized');
  const currentPrice = Number(opportunity.side === 'BACK' ? runner?.bestBackPrice : runner?.bestLayPrice);
  if (!(currentPrice > 1)) return fail('PRICE_DATA_UNAVAILABLE', 'Current executable runner price is unavailable');
  if (!close(currentPrice, Number(opportunity.odds), 1e-9)) return fail('PRICE_MOVED', 'The executable price moved after ranking', { rankedPrice:Number(opportunity.odds), currentPrice });

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

  const commission = resolveCommissionRate(market, settings);
  if (!commission.valid) return fail('INVALID_COMMISSION', commission.error, { commission });
  const book=validateCompleteMarketBook(marketRunners,market,settings.maxBackBookPercentage||150);
  if(!book.valid)return fail('INVALID_MARKET_BOOK',book.errors.join('; '),{marketBookDiagnostics:book});
  if((opportunity.marketType||market.marketTypeCode||market.marketType)==='PLACE')return fail('PLACE_MODEL_NOT_VALIDATED','PLACE ordering is not validated',{marketBookDiagnostics:book});

  const stake = Number(opportunity.stake);
  const odds = currentPrice;
  const liability = Number(opportunity.liability);
  const maxLoss = Number(opportunity.maxLoss);
  const ev = Number(opportunity.ev);
  const roi = Number(opportunity.roi);
  const rankedCalculation = opportunity.calculationResult || {};
  const recomputedCalculation = buildCalculationResult({ side:opportunity.side, probability:opportunity.finalProbabilityUsedInEV ?? opportunity.modelProbability, odds, normalizedCommissionRate:commission.normalizedRate, stake });
  opportunity.finalAuthorityRecalculation = recomputedCalculation;
  opportunity.finalAuthorityReached = true;
  const comparable = ['probability','impliedProbability','odds','normalizedCommissionRate','stake','liability','profitIfWin','lossIfLose','ev','roi','edge','breakevenProbability'];
  const mathMatches = comparable.every(key => close(Number(rankedCalculation[key]), Number(recomputedCalculation[key]), 1e-6));
  const mathValid=recomputedCalculation.mathematicalInvariantsPassed===true&&opportunity.mathematicalInvariantsPassed===true&&mathMatches&&close(maxLoss,recomputedCalculation.lossIfLose,1e-6)&&close(liability,recomputedCalculation.liability,1e-6)&&(!proofOverride?(recomputedCalculation.ev>0&&recomputedCalculation.roi>0):true);
  if (!mathValid) return fail('MATH_INVARIANT_VIOLATION', 'Ranked opportunity maths did not match final recomputation', { rankedCalculation, recomputedCalculation });
  if (context.strategyRequiresAI === true) {
    let aiProbability = null;
    if (opportunity.marketType === 'H2H') {
      const normalizedPairs = normalizeH2HProbabilities(aiResult?.h2hProbabilities || []);
      const pair = normalizedPairs.find(item => String(item.marketId) === String(opportunity.betfairMarketId || opportunity.marketId) && String(item.selectionId) === String(opportunity.selectionId) && String(item.opponentSelectionId) === String(opportunity.opponentSelectionId));
      aiProbability = pair?.pBeatsOpponent;
    } else {
      const normalizedField = normalizeWinProbabilities(aiResult?.runnerProbabilities || []);
      const runnerProbability = normalizedField.find(item => String(item.selectionId) === String(opportunity.selectionId));
      aiProbability = opportunity.marketType === 'PLACE' ? runnerProbability?.pPlace : runnerProbability?.pWin;
    }
    const expectedAiProbability = opportunity.marketType === 'WIN' ? (opportunity.baseProbability ?? opportunity.modelProbability) : opportunity.modelProbability;
    if (!Number.isFinite(Number(aiProbability))) return fail('AI_RESULT_REQUIRED', `Selected ${opportunity.marketType} strategy requires a matching AI probability`);
    if (!close(Number(aiProbability), Number(expectedAiProbability), 1e-6)) return fail('AI_PROBABILITY_MISMATCH', 'Authorized probability differs from the matching AI probability');
  }

  const validated=createValidatedPaperOrder({market,runner,side:opportunity.side,stake,odds:currentPrice,strategyName:context.strategyName,source:context.source||'bot',settings,bankrollStats,existingOrders,emergencyStop,apiConnected:true,persistenceType:context.persistenceType||'LAPSE',expectedValue:ev,entryReason:(opportunity.reasons||[]).join('; '),dataSource:opportunity.dataSource,botSettings:context.botSettings,featherlessSettings,marketType:opportunity.marketType,marketTypeCode:opportunity.marketTypeCode,eventId:opportunity.eventId,eventName:opportunity.eventName,numberOfWinners:opportunity.numberOfWinners,placeTerms:opportunity.placeTerms,proofMode:opportunity.proofMode||false,proofReason:opportunity.proofReason||null,decisionSource:opportunity.decisionSource,selectionDiagnostics:context.selectionDiagnostics,commissionResolution:commission,calculationResult:recomputedCalculation,excludeFromPerformance:proofOverride});
  if(validated.rejected)return fail(validated.order?.failed_validation_field||'RISK_CHECK_FAILED',validated.reason,{rejectedOrder:validated.order});
  if (!entityApi?.create) return fail('DATABASE_UPDATE_FAILED', 'PaperOrder entity API is unavailable');
  const order = { ...validated.order, rawCommissionRate: commission.rawRate, normalizedCommissionRate: commission.normalizedRate, commissionSource: commission.source, commissionNormalizationApplied: commission.normalizationApplied, priceFeedStatus: freshness.priceFeedStatus, priceAgeSeconds: freshness.priceAgeSeconds, paperSimulationQuality: freshness.priceFeedStatus === 'LIVE' ? validated.order.paperSimulationQuality : 'Basic' };
  try { const saved = await entityApi.create(order); return { authorized: true, persisted: true, order: saved || order, failedGate: null, reason: null, secondsToStart, marketBookDiagnostics: book, priceFreshness: freshness }; }
  catch (error) { return fail('DATABASE_UPDATE_FAILED', error.message, { attemptedOrder: order }); }
}