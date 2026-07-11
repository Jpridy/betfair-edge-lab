export async function createProposedStrategySignal(entityApi, signal) {
  if (!entityApi?.create) throw new Error('STRATEGY_SIGNAL_ENTITY_UNAVAILABLE');
  return entityApi.create({ ...signal, signalStatus: 'proposed' });
}

export async function updateStrategySignal(entityApi, signalId, nextStatus, patch = {}) {
  const allowed = { proposed: ['active','blocked'], active: ['executed','expired','cancelled'] };
  if (!signalId || !entityApi?.update) throw new Error('STRATEGY_SIGNAL_UPDATE_UNAVAILABLE');
  if (!Object.values(allowed).flat().includes(nextStatus)) throw new Error('INVALID_SIGNAL_STATUS');
  return entityApi.update(signalId, { ...patch, signalStatus: nextStatus });
}