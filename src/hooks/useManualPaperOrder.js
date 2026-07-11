import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useApp } from '@/lib/AppContext';
import { authorizeAndCreatePaperOrder } from '@/lib/orderAuthority';
import { buildCalculationResult } from '@/lib/exchangeMath';

export default function useManualPaperOrder() {
  const app = useApp();
  const [form, setForm] = useState({ marketId: '', runnerId: '', side: 'BACK', stake: app.settings.baseStake, persistenceType: 'LAPSE' });
  const [message, setMessage] = useState(null);
  useEffect(() => { if (!form.marketId && app.markets[0]) setForm(p => ({ ...p, marketId: app.markets[0].id })); }, [app.markets, form.marketId]);
  const market = app.markets.find(m => m.id === form.marketId);
  const marketRunners = useMemo(() => app.runners.filter(r => r.marketId === form.marketId || r.marketId === market?.betfairMarketId), [app.runners, form.marketId, market?.betfairMarketId]);
  const runner = marketRunners.find(r => r.id === form.runnerId);
  const submit = async () => {
    if (!market || !runner) return;
    const opportunity = app.exchangeOpportunities.find(item => item.decision === 'BET' && item.side === form.side && String(item.selectionId) === String(runner.betfairSelectionId || runner.selectionId) && String(item.betfairMarketId || item.marketId) === String(market.betfairMarketId || market.id));
    if (!opportunity) { setMessage({ ok: false, text: 'No currently authorized BET opportunity exists for this runner and side.' }); return; }
    const calculationResult = buildCalculationResult({ side:form.side, probability:opportunity.finalProbabilityUsedInEV ?? opportunity.modelProbability, odds:opportunity.odds, normalizedCommissionRate:opportunity.normalizedCommissionRate ?? opportunity.commissionRate, stake:Number(form.stake) });
    const recalculatedOpportunity = { ...opportunity, stake:Number(form.stake), liability:calculationResult.liability, maxLoss:calculationResult.lossIfLose, ev:calculationResult.ev, roi:calculationResult.roi, edge:calculationResult.edge, breakevenProbability:calculationResult.breakevenProbability, calculationResult, mathematicalInvariantsPassed:calculationResult.mathematicalInvariantsPassed };
    const result = await authorizeAndCreatePaperOrder({ opportunity: recalculatedOpportunity, market, runner, marketRunners, settings: app.settings, featherlessSettings: app.featherlessSettings, bankrollStats: app.bankrollStats, existingOrders: app.paperOrders, emergencyStop: app.emergencyStop, apiConnected: app.apiConnected, connectionState: { apiConnected: app.apiConnected, lastActualPriceUpdateAt: app.betfairConnection.lastActualPriceUpdateAt, streamError: app.betfairConnection.streamError }, positiveEvOpportunityCount: app.exchangeOpportunities.filter(item => item.ev > 0).length, strategyRequiresAI: ['FEATHERLESS_AI','CACHE','OPENAI_WEB_ENRICHED'].includes(opportunity.decisionSource), aiResult: ['FEATHERLESS_AI','CACHE','OPENAI_WEB_ENRICHED'].includes(opportunity.decisionSource) ? app.lastExchangeDiagnostics?.aiDecisions?.[0]?.aiResult : null, strategyName: 'Featherless AI Value Decision Engine', source: 'manual', persistenceType: form.persistenceType, selectionDiagnostics: app.lastExchangeDiagnostics?.sideSelectionDiagnostics, entityApi: base44.entities.PaperOrder });
    if (result.authorized) app.addPaperOrder(result.order);
    app.addAuditLog(result.authorized ? 'Paper Order Created' : 'Paper Order Rejected', 'order', result.authorized ? 'info' : 'warning', result.authorized ? `${form.side} ${runner.runnerName} @ ${opportunity.odds}` : result.reason);
    setMessage({ ok: result.authorized, text: result.authorized ? `Paper order created for ${runner.runnerName}` : result.reason });
  };
  return { form, setForm, marketRunners, runner, submit, message, disabled: !runner || form.stake <= 0 || app.emergencyStop };
}