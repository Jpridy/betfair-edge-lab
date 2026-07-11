import { applyFavouriteContextToOpportunity } from './favouriteValueContext';

export function buildNormalizedFavouriteProbabilityField(opportunities, favouriteContext, runnerContextScores, settings) {
  const representatives = new Map();
  for (const opportunity of opportunities.filter(item => item.marketType === 'WIN')) {
    const existing = representatives.get(String(opportunity.selectionId));
    if (!existing || opportunity.side === 'BACK') representatives.set(String(opportunity.selectionId), opportunity);
  }

  const adjusted = [...representatives.values()].map(opportunity => {
    const score = runnerContextScores.find(item => String(item.selectionId) === String(opportunity.selectionId));
    return applyFavouriteContextToOpportunity(opportunity, favouriteContext, score, settings);
  });
  const total = adjusted.reduce((sum, item) => sum + Number(item.finalProbabilityUsedInEV || 0), 0);
  if (!(total > 0)) return new Map();

  return new Map(adjusted.map(item => {
    const probability = Number(item.finalProbabilityUsedInEV) / total;
    return [String(item.selectionId), {
      probability,
      adjustment: probability - Number(item.modelProbability),
    }];
  }));
}