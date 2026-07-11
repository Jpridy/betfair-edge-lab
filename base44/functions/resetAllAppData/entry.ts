import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json().catch(() => ({}));
    if (payload.confirmation !== 'RESET ALL DATA') {
      return Response.json({ error: 'Invalid confirmation' }, { status: 400 });
    }

    const entityNames = [
      'PaperOrder', 'BotCycle', 'StrategySignal', 'AuditLog',
      'FeatherlessAIDecision', 'StrategyStats', 'RiskEvent', 'BacktestRun',
      'MarketSnapshot', 'BankrollHistory', 'Market', 'Runner',
      'AppCleanUpAudit', 'AppSettings', 'BotSettings', 'FeatherlessSettings'
    ];

    const results = await Promise.allSettled(entityNames.map(async (name) => {
      await base44.asServiceRole.entities[name].deleteMany({});
      return name;
    }));
    const cleared = results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    const failed = results.flatMap((result, index) => result.status === 'rejected' ? [{ entity: entityNames[index], error: result.reason?.message || 'Delete failed' }] : []);

    if (failed.length) return Response.json({ error: 'Reset incomplete', cleared, failed }, { status: 500 });
    return Response.json({ success: true, cleared });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});