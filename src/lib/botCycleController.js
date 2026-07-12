const LEASE_KEY = 'betfair-edge-bot-lease';
const RUN_KEY_PREFIX = 'betfair-edge-cycle:';
const memory = { runInProgress:false, activeRunKey:null, skipped:[], listeners:new Set() };
const storage = () => typeof window !== 'undefined' ? window.localStorage : null;
const id = prefix => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

export function createCycleRunKey(selectedRaceKey, scanIntervalSeconds, timestamp = Date.now()) {
  const interval = Math.max(1, Number(scanIntervalSeconds) || 10);
  return `${selectedRaceKey || 'no-race'}:${Math.floor(timestamp / (interval * 1000))}`;
}

export function createBotCycleController(options = {}) {
  const browserTabId = options.browserTabId || id('tab');
  const schedulerInstanceId = options.schedulerInstanceId || id('scheduler');
  const leaseMs = options.leaseMs || 30000;
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('betfair-edge-bot-cycle') : null;
  const readLease = () => { try { return JSON.parse(storage()?.getItem(LEASE_KEY) || 'null'); } catch { return null; } };
  const writeLease = lease => { storage()?.setItem(LEASE_KEY, JSON.stringify(lease)); channel?.postMessage(lease); };
  const diagnostic = (reason, input, cycleRunKey) => ({ type:'DUPLICATE_CYCLE_SKIPPED', reason, skippedDuplicateRun:true, schedulerInstanceId, browserTabId, triggerSource:input.triggerSource, cycleRunKey, startedBy:input.startedBy || browserTabId, at:new Date().toISOString() });

  async function acquire(input = {}) {
    const now = input.timestamp || Date.now();
    const cycleRunKey = createCycleRunKey(input.selectedRaceKey, input.scanIntervalSeconds, now);
    const lease = readLease();
    let reason = null;
    if (memory.runInProgress) reason = 'RUN_IN_PROGRESS';
    else if (storage()?.getItem(RUN_KEY_PREFIX + cycleRunKey)) reason = 'CYCLE_RUN_KEY_ALREADY_USED';
    else if (lease && lease.browserTabId !== browserTabId && Number(lease.expiresAt) > now) reason = 'ANOTHER_BROWSER_TAB_OWNS_LEASE';
    else if (input.hasPersistedRun && await input.hasPersistedRun(cycleRunKey)) reason = 'PERSISTED_CYCLE_RUN_KEY_EXISTS';
    if (reason) { const skipped=diagnostic(reason,input,cycleRunKey); memory.skipped.unshift(skipped); memory.skipped=memory.skipped.slice(0,100); return { acquired:false, ...skipped }; }
    memory.runInProgress = true;
    memory.activeRunKey = cycleRunKey;
    storage()?.setItem(RUN_KEY_PREFIX + cycleRunKey, String(now));
    writeLease({ browserTabId, schedulerInstanceId, cycleRunKey, expiresAt:now+leaseMs, updatedAt:now });
    return { acquired:true, runInProgress:true, skippedDuplicateRun:false, schedulerInstanceId, browserTabId, triggerSource:input.triggerSource, cycleRunKey, startedBy:input.startedBy || browserTabId };
  }

  function release(cycleRunKey) {
    if (!cycleRunKey || memory.activeRunKey === cycleRunKey) { memory.runInProgress=false; memory.activeRunKey=null; }
    const lease=readLease();
    if (lease?.browserTabId === browserTabId) storage()?.removeItem(LEASE_KEY);
  }

  function diagnostics() { return { schedulerInstanceId, browserTabId, runInProgress:memory.runInProgress, activeCycleRunKey:memory.activeRunKey, skippedDuplicateRuns:[...memory.skipped] }; }
  return { acquire, release, diagnostics, schedulerInstanceId, browserTabId };
}