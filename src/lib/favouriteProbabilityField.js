import { applyFavouriteContextToOpportunity } from './favouriteValueContext';

const clampProbability = value => Math.max(0.000001, Math.min(0.999999, Number(value)));

export function buildNormalizedFavouriteProbabilityField(opportunities, favouriteContext, runnerContextScores, settings) {
  const representatives = new Map();
  for (const opportunity of opportunities.filter(item => item.marketType === 'WIN')) {
    const key = String(opportunity.selectionId);
    const existing = representatives.get(key);
    if (!existing || opportunity.side === 'BACK') representatives.set(key, opportunity);
  }

  const adjusted = [...representatives.values()].map(opportunity => {
    const score = runnerContextScores.find(item => String(item.selectionId) === String(opportunity.selectionId));
    return applyFavouriteContextToOpportunity(opportunity, favouriteContext, score, settings);
  });
  const total = adjusted.reduce((sum, item) => sum + Number(item.finalProbabilityUsedInEV || 0), 0);
  if (!(total > 0)) return new Map();

  return new Map(adjusted.map(item => {
    const modelProbability = Number(item.modelProbability);
    const rawAdjustment = Number(item.favouriteContextAdjustment || 0);
    const normalizedProbability = clampProbability(Number(item.finalProbabilityUsedInEV) / total);
    const normalizedAdjustment = normalizedProbability - modelProbability;
    const finalAdjustment = Math.abs(normalizedAdjustment) > 1e-9 ? normalizedAdjustment : rawAdjustment;
    const probability = clampProbability(modelProbability + finalAdjustment);
    return [String(item.selectionId), {
      probability,
      adjustment: probability - modelProbability,
      normalizedProbability,
      rawAdjustment,
    }];
  }));
}
