import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { createValidatedPaperOrder } from '@/lib/createValidatedPaperOrder';

export default function useManualPaperOrder() {
  const app = useApp();
  const [form, setForm] = useState({ marketId: '', runnerId: '', side: 'BACK', stake: app.settings.baseStake, persistenceType: 'LAPSE' });
  const [message, setMessage] = useState(null);
  useEffect(() => { if (!form.marketId && app.markets[0]) setForm(p => ({ ...p, marketId: app.markets[0].id })); }, [app.markets, form.marketId]);
  const market = app.markets.find(m => m.id === form.marketId);
  const marketRunners = useMemo(() => app.runners.filter(r => r.marketId === form.marketId || r.marketId === market?.betfairMarketId), [app.runners, form.marketId, market?.betfairMarketId]);
  const runner = marketRunners.find(r => r.id === form.runnerId);
  const submit = () => {
    if (!market || !runner) return;
    const odds = form.side === 'BACK' ? runner.bestBackPrice : runner.bestLayPrice;
    const result = createValidatedPaperOrder({ market, runner, side: form.side, stake: form.stake, odds, strategyName: 'Featherless AI Value Decision Engine', source: 'manual', settings: app.settings, bankrollStats: app.bankrollStats, existingOrders: app.paperOrders, emergencyStop: app.emergencyStop, apiConnected: app.apiConnected, persistenceType: form.persistenceType, entryReason: 'Manual paper order from Controls' });
    app.addPaperOrder(result.order);
    app.addAuditLog(result.rejected ? 'Paper Order Rejected' : 'Paper Order Created', 'order', result.rejected ? 'warning' : 'info', result.rejected ? result.reason : `${form.side} ${runner.runnerName} @ ${odds}`);
    setMessage({ ok: !result.rejected, text: result.rejected ? result.reason : `Paper order created for ${runner.runnerName}` });
  };
  return { form, setForm, marketRunners, runner, submit, message, disabled: !runner || form.stake <= 0 || app.emergencyStop };
}