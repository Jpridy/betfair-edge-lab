// ============================================================================
// Auto-Calibration From Paper Results
//
// Tracks predicted probability vs actual results after at least 50 settled
// paper bets. Shows overconfidence/underconfidence, ROI by odds/confidence/
// edge band.
// ============================================================================

const MIN_CALIBRATION_SAMPLES = 50;

/**
 * Compute calibration metrics from settled paper orders.
 *
 * @param {Array} settledOrders - Paper orders with status 'settled'
 * @returns {object} Calibration metrics
 */
export function computeCalibration(settledOrders) {
  const settled = (settledOrders || []).filter(o => o.status === 'settled' && o.result && o.matchedOdds);
  const sampleSize = settled.length;
  const isCalibrated = sampleSize >= MIN_CALIBRATION_SAMPLES;

  if (sampleSize === 0) {
    return {
      sampleSize: 0,
      isCalibrated: false,
      warning: 'AI confidence is not calibrated yet — need at least 50 settled paper bets.',
      predictedWinRate: 0,
      actualWinRate: 0,
      overconfidence: 0,
      roiByOddsBand: [],
      roiByConfidenceBand: [],
      roiByEdgeBand: [],
    };
  }

  // Overall calibration
  const predictedWinRate = settled.reduce((s, o) => {
    const selectionWinProbability = Number(o.modelProbability ?? o.finalProbabilityUsedInEV);
    const predictedBetWinProbability = o.side === 'LAY' ? 1 - selectionWinProbability : selectionWinProbability;
    return s + predictedBetWinProbability;
  }, 0) / sampleSize;
  const actualWins = settled.filter(o => o.result === 'won').length;
  const actualWinRate = actualWins / sampleSize;
  const overconfidence = predictedWinRate - actualWinRate;

  // ROI by odds band
  const oddsBands = [
    { label: '1.5–3.0', min: 1.5, max: 3.0 },
    { label: '3.0–6.0', min: 3.0, max: 6.0 },
    { label: '6.0–10.0', min: 6.0, max: 10.0 },
    { label: '10.0+', min: 10.0, max: Infinity },
  ];
  const roiByOddsBand = oddsBands.map(band => {
    const inBand = settled.filter(o => o.matchedOdds >= band.min && o.matchedOdds < band.max);
    return computeBandStats(inBand, band.label);
  }).filter(b => b.count > 0);

  // ROI by confidence band
  const confBands = [
    { label: '<60%', min: 0, max: 0.6 },
    { label: '60–70%', min: 0.6, max: 0.7 },
    { label: '70–80%', min: 0.7, max: 0.8 },
    { label: '80%+', min: 0.8, max: 1.01 },
  ];
  const roiByConfidenceBand = confBands.map(band => {
    const inBand = settled.filter(o => {
      const conf = o.confidence || o.modelProbability || 0;
      return conf >= band.min && conf < band.max;
    });
    return computeBandStats(inBand, band.label);
  }).filter(b => b.count > 0);

  // ROI by edge band
  const edgeBands = [
    { label: '<2%', min: -Infinity, max: 0.02 },
    { label: '2–5%', min: 0.02, max: 0.05 },
    { label: '5–10%', min: 0.05, max: 0.10 },
    { label: '10%+', min: 0.10, max: Infinity },
  ];
  const roiByEdgeBand = edgeBands.map(band => {
    const inBand = settled.filter(o => {
      const implied = 1 / (o.matchedOdds || 3);
      const model = Number(o.modelProbability ?? o.finalProbabilityUsedInEV ?? 0);
      const edge = o.side === 'LAY' ? implied - model : model - implied;
      return edge >= band.min && edge < band.max;
    });
    return computeBandStats(inBand, band.label);
  }).filter(b => b.count > 0);

  return {
    sampleSize,
    isCalibrated,
    warning: isCalibrated ? null : `AI confidence is not calibrated yet — ${sampleSize}/${MIN_CALIBRATION_SAMPLES} settled paper bets.`,
    predictedWinRate,
    actualWinRate,
    overconfidence,
    roiByOddsBand,
    roiByConfidenceBand,
    roiByEdgeBand,
  };
}

function computeBandStats(orders, label) {
  const count = orders.length;
  if (count === 0) return { label, count: 0, roi: 0, winRate: 0 };
  const wins = orders.filter(o => o.result === 'won').length;
  const capitalAtRisk = orders.reduce((s, o) => s + (o.side === 'LAY' ? Number(o.liability || 0) : Number(o.matchedStake || o.matched_size || 0)), 0);
  const netProfit = orders.reduce((s, o) => s + (o.netProfit || 0), 0);
  const roi = capitalAtRisk > 0 ? (netProfit / capitalAtRisk) : 0;
  const winRate = wins / count;
  return { label, count, roi, winRate };
}