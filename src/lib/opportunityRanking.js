import { normalizedMarketId } from './raceExposure';

export function scoreOpportunity(opportunity) {
  const confidence = Math.max(0, Math.min(1, (opportunity.confidence || 0) / 100));
  const quality = Math.max(0, Math.min(1, (opportunity.dataQuality || 0) / 100));
  const fill = Math.max(0, Math.min(1, opportunity.fillProbability ?? 0));
  const liquidity = Math.max(0, Math.min(1, opportunity.liquidityScore ?? 0));
  const freshness = Math.max(0, Math.min(1, opportunity.priceFreshnessScore ?? 1));
  const spread = 1 / (1 + Math.max(0, opportunity.spreadTicks || 0) / 10);
  const delay = 1 - Math.max(0, Math.min(1, opportunity.delayRiskScore || 0));
  return (opportunity.roi || 0) * confidence * quality * fill * liquidity * freshness * spread * delay;
}

export function compareOpportunities(a, b) {
  if (a.decision === 'BET' && b.decision !== 'BET') return -1;
  if (a.decision !== 'BET' && b.decision === 'BET') return 1;
  const scoreDiff = (b.riskAdjustedScore ?? scoreOpportunity(b)) - (a.riskAdjustedScore ?? scoreOpportunity(a));
  if (Math.abs(scoreDiff) > 1e-12) return scoreDiff;
  if ((b.ev || 0) !== (a.ev || 0)) return (b.ev || 0) - (a.ev || 0);
  if ((b.availableSize || 0) !== (a.availableSize || 0)) return (b.availableSize || 0) - (a.availableSize || 0);
  const market = normalizedMarketId(a).localeCompare(normalizedMarketId(b));
  if (market) return market;
  const selection = String(a.normalizedSelectionId || a.selectionId || '').localeCompare(String(b.normalizedSelectionId || b.selectionId || ''));
  return selection || String(a.side || '').localeCompare(String(b.side || ''));
}

export function buildSideSelectionDiagnostics(opportunities, selected) {
  const valid = opportunities.filter(item => item.decision === 'BET');
  const back = valid.filter(item => item.side === 'BACK').sort(compareOpportunities)[0] || null;
  const lay = valid.filter(item => item.side === 'LAY').sort(compareOpportunities)[0] || null;
  return {
    bestBackOpportunityId: back?.opportunityId || null,
    bestLayOpportunityId: lay?.opportunityId || null,
    selectedOpportunityId: selected?.opportunityId || null,
    selectedSideReason: selected ? `${selected.side} ${selected.marketType} selected by risk-adjusted score ${(selected.riskAdjustedScore || 0).toFixed(6)}; EV ${selected.ev.toFixed(2)}; liquidity ${selected.availableSize.toFixed(2)}` : 'No candidate passed all gates',
    backRejectedReason: back ? (selected?.side === 'BACK' ? null : `Lower score than ${selected?.opportunityId || 'no selection'}`) : opportunities.find(item => item.side === 'BACK')?.failedGate || 'No BACK candidate',
    layRejectedReason: lay ? (selected?.side === 'LAY' ? null : `Lower score than ${selected?.opportunityId || 'no selection'}`) : opportunities.find(item => item.side === 'LAY')?.failedGate || 'No LAY candidate',
  };
}