import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const finite = value => Number.isFinite(Number(value));
const dateOf = order => order.settledAt ?? order.settled_date ?? order.created_date;
const odds = order => Number(order.matchedOdds ?? order.matched_price);
const risk = order => order.side === 'LAY'
  ? Number(order.matchedCalculation?.liability ?? order.liability)
  : Number(order.matchedStake ?? order.matched_size);
const probability = order => Number(order.finalProbabilityUsedInEV ?? order.modelProbability);
const reconciled = order => finite(order.grossProfit) && finite(order.commission) && finite(order.netProfit)
  && Math.abs(Number(order.grossProfit) - Number(order.commission) - Number(order.netProfit)) < 0.01;
const eligible = order => order.status === 'settled' && order.settlementStatus === 'settled'
  && ['won', 'lost', 'void'].includes(order.result) && order.proofMode !== true
  && order.excludeFromPerformance !== true && order.invalidTestRecord !== true
  && order.manuallyEdited !== true && order.mathematicalInvariantsPassed === true
  && ['BACK', 'LAY'].includes(order.side) && probability(order) > 0 && probability(order) < 1
  && odds(order) > 1 && risk(order) > 0 && finite(order.commission) && !!order.decisionSource && reconciled(order);

function maximumDrawdown(rows) {
  let equity = 0, peak = 0, maximum = 0;
  for (const order of rows) { equity += Number(order.netProfit); peak = Math.max(peak, equity); maximum = Math.max(maximum, peak - equity); }
  return maximum;
}
function bootstrapLower(rows) {
  if (rows.length < 2) return null;
  let seed = rows.length * 65537;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const values = [];
  for (let index = 0; index < 400; index++) {
    let total = 0;
    for (let sample = 0; sample < rows.length; sample++) total += Number(rows[Math.floor(random() * rows.length)].netProfit);
    values.push(total / rows.length);
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.025)];
}
function metrics(rows) {
  const wins = rows.filter(order => order.result === 'won').length;
  const grossWins = rows.reduce((sum, order) => sum + Math.max(0, Number(order.grossProfit)), 0);
  const grossLoss = Math.abs(rows.reduce((sum, order) => sum + Math.min(0, Number(order.grossProfit)), 0));
  const netProfit = rows.reduce((sum, order) => sum + Number(order.netProfit), 0);
  const capital = rows.reduce((sum, order) => sum + risk(order), 0);
  const breakeven = rows.length ? rows.reduce((sum, order) => {
    const rate = Number(order.normalizedCommissionRate ?? order.commissionRateUsed);
    const price = odds(order);
    return sum + (order.side === 'LAY' ? (1 - rate) / (price - rate) : 1 / (1 + (price - 1) * (1 - rate)));
  }, 0) / rows.length : 0;
  return { sampleSize: rows.length, netProfit, netROI: capital ? netProfit / capital : null,
    strikeRate: rows.length ? wins / rows.length : 0, strikeRateMargin: rows.length ? wins / rows.length - breakeven : 0,
    profitFactor: grossLoss ? grossWins / grossLoss : grossWins > 0 ? 999999 : null,
    maxDrawdown: maximumDrawdown(rows), lower95Expectancy: bootstrapLower(rows), accountingReconciliationPassed: rows.every(reconciled) };
}
const matches = (order, settings) => {
  const confidence = Number(order.confidencePercent ?? order.confidence ?? 0);
  const edge = Number(order.commissionAdjustedEdge ?? order.edge ?? 0) * 100;
  const roi = Number(order.expectedROI ?? order.calculationResult?.roi ?? 0) * 100;
  const liquidity = Number(order.selectionDiagnostics?.availableSize ?? order.matchedStake ?? order.matched_size ?? 0);
  const spread = Number(order.selectionDiagnostics?.spreadTicks ?? 0);
  return odds(order) >= settings.minOdds && odds(order) <= settings.maxOdds && confidence >= settings.minConfidence
    && edge >= settings.minEdge && roi >= settings.minROI && liquidity >= settings.minLiquidity && spread <= settings.maxSpreadTicks;
};
const passes = (value, maxDrawdown) => value.sampleSize >= 100 && value.netProfit > 0 && value.netROI > 0
  && value.lower95Expectancy >= 0 && value.profitFactor >= 1.1 && value.maxDrawdown <= maxDrawdown
  && value.accountingReconciliationPassed;
const sampleState = count => count < 100 ? 'NOT_ENOUGH_DATA' : count < 300 ? 'LEARNING' : count < 500 ? 'PAPER_VALIDATION' : 'ELIGIBLE_FOR_CHAMPION_SELECTION';

Deno.serve(async req => {
  let base44, lock;
  try {
    base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && !String(user.id ?? '').startsWith('service_')) return Response.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const triggerMode = body.triggerMode === 'settled_count' ? 'settled_count' : 'nightly';
    const latestRuns=await base44.asServiceRole.entities.CalibrationRun.list('-created_date',1);
    if(latestRuns[0]?.resultCode==='CALIBRATION_PAUSED')return Response.json({status:'paused',resultCode:'CALIBRATION_PAUSED'});
    const active=await base44.asServiceRole.entities.CalibrationRun.filter({status:'running'},'-created_date',1);
    if(active.some(run=>Date.now()-new Date(run.startedAt).getTime()<1800000)) return Response.json({ status: 'blocked', resultCode: 'CALIBRATION_SINGLE_FLIGHT_LOCKED' });
    const [cycles, settlements] = await Promise.all([
      base44.asServiceRole.entities.BotCycle.filter({ status: 'running' }, '-created_date', 1),
      base44.asServiceRole.entities.SettlementWorkerRun.filter({ status: 'running' }, '-created_date', 1)
    ]);
    if (cycles.length || settlements.length) return Response.json({ status: 'blocked', resultCode: 'BOT_OR_SETTLEMENT_ACTIVE' });
    const startedAt = new Date().toISOString();
    lock = await base44.asServiceRole.entities.CalibrationRun.create({ runId: crypto.randomUUID(), triggerMode, status: 'running', calibrationState: 'BLOCKED', objectiveMode: 'STRIKE_RATE_WITH_PROFIT', startedAt, eligibleSettledBets: 0, resultCode: 'CALIBRATION_RUNNING' });
    const orders = (await base44.asServiceRole.entities.PaperOrder.filter({ status: 'settled' }, 'settled_date', 2000)).filter(eligible).sort((a, b) => new Date(dateOf(a)) - new Date(dateOf(b)));
    const previous = await base44.asServiceRole.entities.CalibrationRun.filter({ status: 'completed' }, '-completedAt', 1);
    const newSettledBets = Math.max(0, orders.length - Number(previous[0]?.eligibleSettledBets ?? 0));
    const due = triggerMode === 'nightly' ? newSettledBets >= 25 : newSettledBets >= 100;
    if (!due) {
      await base44.asServiceRole.entities.CalibrationRun.update(lock.id, { status: 'completed', calibrationState: sampleState(orders.length), completedAt: new Date().toISOString(), eligibleSettledBets: orders.length, newSettledBets, resultCode: 'CALIBRATION_NOT_DUE' });
      return Response.json({ status: 'completed', resultCode: 'CALIBRATION_NOT_DUE', eligibleSettledBets: orders.length, newSettledBets });
    }
    const [appRows, modelRows, botRows] = await Promise.all([
      base44.asServiceRole.entities.AppSettings.list('-created_date', 1),
      base44.asServiceRole.entities.FeatherlessSettings.list('-created_date', 1),
      base44.asServiceRole.entities.BotSettings.list('-created_date', 1)
    ]);
    const app = appRows[0] ?? {}, model = modelRows[0] ?? {}, bot = botRows[0] ?? {};
    const current = { minOdds: Number(model.winMinOdds ?? 1.6), maxOdds: Number(model.winMaxOdds ?? 15), minConfidence: Number(model.minConfidence ?? 65), minEdge: Number(model.winMinEdge ?? 3), minROI: Number(model.winMinROI ?? 2), minLiquidity: Number(model.winMinLiquidity ?? 50), maxSpreadTicks: Number(model.winMaxSpreadTicks ?? 5), maxStake: Number(app.maxStake ?? 25), maxStakePercent: Number(app.maxStakePercent ?? 0.25), maxLayLiability: Number(app.maxLayLiability ?? 50), kellyMultiplier: Number(model.kellyMultiplier ?? 0.1) };
    const trainEnd = Math.floor(orders.length * 0.6), validationEnd = Math.floor(orders.length * 0.8);
    const training = orders.slice(0, trainEnd), validation = orders.slice(trainEnd, validationEnd), test = orders.slice(validationEnd);
    const maximumAllowedDrawdown = Number(bot.maxDrawdownLimit ?? 300), candidates = [];
    for (const minConfidence of [current.minConfidence, Math.min(85, current.minConfidence + 5), Math.min(85, current.minConfidence + 10)]) {
      for (const minEdge of [current.minEdge, Math.min(8, current.minEdge + 1), Math.min(8, current.minEdge + 2)]) {
        for (const minROI of [current.minROI, Math.min(8, current.minROI + 1)]) {
          const settings = { ...current, minConfidence, minEdge, minROI };
          const trainingMetrics = metrics(training.filter(order => matches(order, settings)));
          const validationMetrics = metrics(validation.filter(order => matches(order, settings)));
          if (!passes(validationMetrics, maximumAllowedDrawdown)) continue;
          const testMetrics = metrics(test.filter(order => matches(order, settings)));
          if (passes(testMetrics, maximumAllowedDrawdown)) candidates.push({ settings, trainingMetrics, validationMetrics, testMetrics, score: testMetrics.strikeRateMargin + (testMetrics.lower95Expectancy ?? 0) - Object.keys(settings).filter(key => settings[key] !== current[key]).length * 0.0001 });
        }
      }
    }
    candidates.sort((a, b) => b.score - a.score || b.testMetrics.lower95Expectancy - a.testMetrics.lower95Expectancy || b.testMetrics.netROI - a.testMetrics.netROI || a.testMetrics.maxDrawdown - b.testMetrics.maxDrawdown);
    let champion = (await base44.asServiceRole.entities.CalibrationProfile.filter({ status: 'CHAMPION' }, '-created_date', 1))[0];
    if (!champion) champion = await base44.asServiceRole.entities.CalibrationProfile.create({ profileId: crypto.randomUUID(), version: 1, name: 'Current safe champion', status: 'CHAMPION', objectiveMode: 'STRIKE_RATE_WITH_PROFIT', segment: 'WIN_BACK_LAY_REPORTED_SEPARATELY', settingsSnapshot: current, calculationVersion: 'canonical-exchange-v1', modelVersion: model.modelName ?? 'unknown', activatedAt: startedAt, trainingMetrics: metrics(training.filter(order => matches(order, current))), validationMetrics: metrics(validation.filter(order => matches(order, current))), testMetrics: metrics(test.filter(order => matches(order, current))) });
    let recommended = null;
    if (candidates[0] && !(await base44.asServiceRole.entities.CalibrationProfile.filter({ status: 'PENDING_APPROVAL' }, '-created_date', 1)).length) {
      recommended = await base44.asServiceRole.entities.CalibrationProfile.create({ profileId: crypto.randomUUID(), version: Number(champion.version ?? 1) + 1, name: 'Scheduled challenger', status: 'PENDING_APPROVAL', parentProfileId: champion.profileId, objectiveMode: 'STRIKE_RATE_WITH_PROFIT', segment: 'WIN_BACK_LAY_REPORTED_SEPARATELY', settingsSnapshot: candidates[0].settings, calculationVersion: 'canonical-exchange-v1', modelVersion: model.modelName ?? 'unknown', trainingMetrics: candidates[0].trainingMetrics, validationMetrics: candidates[0].validationMetrics, testMetrics: candidates[0].testMetrics, shadowMetrics: { decisions: 0, settledBets: 0 }, confidenceIntervals: { lower95Expectancy: candidates[0].testMetrics.lower95Expectancy }, promotionReason: 'Passed scheduled out-of-sample profitability filter; shadow validation required.', activatedAt: startedAt });
    }
    const resultCode = recommended ? 'PROFITABLE_CONFIGURATION_FOUND' : 'NO_PROFITABLE_CONFIGURATION_FOUND';
    const calibrationState = recommended ? 'CHAMPION_PENDING_APPROVAL' : orders.length < 500 ? sampleState(orders.length) : 'NO_PROFITABLE_CONFIGURATION_FOUND';
    await base44.asServiceRole.entities.CalibrationRun.update(lock.id, { status: 'completed', calibrationState, completedAt: new Date().toISOString(), eligibleSettledBets: orders.length, newSettledBets, currentChampionId: champion.profileId, recommendedChampionId: recommended?.profileId ?? null, candidateCount: candidates.length, resultCode, trainValidationTestResults: { training: recommended?.trainingMetrics ?? champion.trainingMetrics, validation: recommended?.validationMetrics ?? champion.validationMetrics, test: recommended?.testMetrics ?? champion.testMetrics }, details: { autoApplyChampion: false, noTradeBaselineEnabled: true, profitGuaranteeClaimed: false, hardSafetySettingsLocked: true } });
    return Response.json({ status: 'completed', resultCode, calibrationState, eligibleSettledBets: orders.length, recommendedChampionId: recommended?.profileId ?? null });
  } catch (error) {
    if (base44 && lock?.id) await base44.asServiceRole.entities.CalibrationRun.update(lock.id, { status: 'failed', calibrationState: 'BLOCKED', completedAt: new Date().toISOString(), resultCode: 'CALIBRATION_FAILED', error: error.message }).catch(() => {});
    return Response.json({ error: error.message }, { status: 500 });
  }
});