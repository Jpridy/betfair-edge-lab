import { PAPER_VALIDATION_PRESET } from './paperValidationPreset';
import { hasEconomicSettlement, isPerformanceExcluded, normalizedOrderResult, settlementMoney } from './orderState';

const eligible = orders => (orders || [])
  .filter(order => hasEconomicSettlement(order)
    && ['won', 'lost'].includes(normalizedOrderResult(order))
    && !isPerformanceExcluded(order))
  .sort((a, b) => new Date(a.settledAt ?? a.settled_date ?? a.created_date) - new Date(b.settledAt ?? b.settled_date ?? b.created_date));

const risk = order => String(order.side || '').toUpperCase() === 'LAY'
  ? Number(order.matchedCalculation?.liability ?? order.liability ?? 0)
  : Number(order.matchedCalculation?.stake ?? order.matchedStake ?? order.matched_size ?? 0);

const net = order => settlementMoney(order).netProfit ?? 0;

const roi = rows => {
  const capital = rows.reduce((sum, order) => sum + risk(order), 0);
  const netResult = rows.reduce((sum, order) => sum + Number(net(order)), 0);
  return capital > 0 ? netResult / capital : null;
};

const drawdown = rows => {
  let equity = 0;
  let peak = 0;
  let max = 0;
  for (const order of rows) {
    equity += Number(net(order));
    peak = Math.max(peak, equity);
    max = Math.max(max, peak - equity);
  }
  return max;
};

const brier = rows => {
  const valid = rows.filter(order => Number.isFinite(Number(order.modelProbability)));
  return valid.length
    ? valid.reduce((sum, order) => sum + (Number(order.modelProbability) - (normalizedOrderResult(order) === 'won' ? 1 : 0)) ** 2, 0) / valid.length
    : null;
};

const walkForward = rows => {
  const windows = [];
  for (let end = 100; end <= rows.length; end += 100) {
    const sample = rows.slice(Math.max(0, end - 100), end);
    windows.push({
      from: sample[0]?.settledAt ?? sample[0]?.settled_date ?? null,
      to: sample.at(-1)?.settledAt ?? sample.at(-1)?.settled_date ?? null,
      bets: sample.length,
      netROI: roi(sample),
    });
  }
  return windows;
};

function lowerBootstrap(rows, samples = 500) {
  if (rows.length < 2) return null;
  let seed = rows.length * 7919;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const values = [];
  for (let i = 0; i < samples; i += 1) {
    const sample = Array.from({ length: rows.length }, () => rows[Math.floor(random() * rows.length)]);
    values.push(roi(sample) ?? -1);
  }
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length * 0.025)];
}

export function calculateStatisticalValidation(orders, rules = PAPER_VALIDATION_PRESET.validationRules, startingBankroll = 10000) {
  const rows = eligible(orders);
  const trainEnd = Math.floor(rows.length * 0.6);
  const validationEnd = Math.floor(rows.length * 0.8);
  const train = rows.slice(0, trainEnd);
  const validation = rows.slice(trainEnd, validationEnd);
  const test = rows.slice(validationEnd);
  const testROI = roi(test);
  const lower95 = lowerBootstrap(test);
  const score = brier(test);
  const maxDrawdown = drawdown(test);
  const accountingOk = rows.every(order => {
    const money = settlementMoney(order);
    return Number.isFinite(Number(money.grossProfit))
      && Number.isFinite(Number(money.commission))
      && Number.isFinite(Number(money.netProfit));
  });

  let status = 'NOT_ENOUGH_DATA';
  if (rows.length >= rules.minimumSettledBetsOverall) {
    const passed = test.length >= rules.minimumSettledBetsPerSegment
      && testROI > rules.requiredOutOfSampleROI
      && lower95 > rules.requiredBootstrapLower95PctROI
      && (score == null || score <= rules.maximumBrierScore)
      && maxDrawdown / startingBankroll <= rules.maximumDrawdownPercent
      && accountingOk;
    status = passed ? 'VALIDATED_OUT_OF_SAMPLE' : testROI > 0 ? 'POSITIVE_EXPECTANCY_OBSERVED' : 'FAILED_VALIDATION';
  }

  return Object.freeze({
    status,
    settledBets: rows.length,
    trainBets: train.length,
    validationBets: validation.length,
    testBets: test.length,
    trainROI: roi(train),
    validationROI: roi(validation),
    testROI,
    bootstrapLower95ROI: lower95,
    brierScore: score,
    maxDrawdown,
    accountingOk,
    walkForward: walkForward(rows),
    generatedAt: new Date().toISOString(),
  });
}
