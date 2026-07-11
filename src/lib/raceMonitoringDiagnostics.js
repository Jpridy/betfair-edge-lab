import { detectMarketType, parseRaceNumber, resolveNumberOfWinners } from './marketClusterer';
import { buildRunnerSnapshot } from './runnerSnapshot';
import { ACTIVE_ORDER_STATUSES, activeRaceOrders, normalizedMarketId } from './raceExposure';

const sourceOf = market => String(market?.source || 'unknown').toLowerCase();
const runnerRecordId = market => String(market?.runnerId || market?.selectionId || market?.betfairSelectionId || '');

function duplicateReason(records) {
  const runnerIds = new Set(records.map(runnerRecordId).filter(Boolean));
  if (runnerIds.size > 1) return 'RUNNER_FLATTENED_AS_MARKET';
  const sources = new Set(records.map(sourceOf));
  if (sources.has('catalogue') && sources.has('stream')) return 'CATALOGUE_AND_STREAM_DUPLICATE';
  if (sources.size > 1) return 'SAME_MARKET_DIFFERENT_SOURCE';
  if (sources.size === 1 && !sources.has('unknown')) return 'SAME_MARKET_ID_DUPLICATED';
  return 'UNKNOWN_DUPLICATE_SOURCE';
}

function choosePrimaryWin(markets) {
  const wins = markets.filter(item => item.accepted && item.marketType === 'WIN');
  const sorted = wins.slice().sort((a, b) => {
    const exact = Number(String(b.marketTypeCode).toUpperCase() === 'WIN') - Number(String(a.marketTypeCode).toUpperCase() === 'WIN');
    if (exact) return exact;
    const single = Number(b.numberOfWinners === 1) - Number(a.numberOfWinners === 1);
    if (single) return single;
    if (b.totalMatched !== a.totalMatched) return b.totalMatched - a.totalMatched;
    if (a.catalogueIndex !== b.catalogueIndex) return a.catalogueIndex - b.catalogueIndex;
    return a.normalizedMarketId.localeCompare(b.normalizedMarketId);
  });
  return {
    primaryWinMarketId: sorted[0]?.normalizedMarketId || null,
    secondaryWinMarketIds: sorted.slice(1).map(item => item.normalizedMarketId),
    primaryMarketSelectionReason: sorted.length ? 'WIN_TYPE_THEN_SINGLE_WINNER_THEN_LIQUIDITY_THEN_CATALOGUE_ORDER_THEN_MARKET_ID' : null,
  };
}

export function buildRaceMonitoringDiagnostics({ selectedRace = null, runners = [], orders = [], acceptedMarketIds = [], now = Date.now(), windowStart = 500, windowEnd = 30 } = {}) {
  if (!selectedRace) return {
    selectedRaceKey:null, selectedRaceEventId:null, selectedRaceVenue:null, selectedRaceNumber:null, selectedRaceName:null, selectedRaceStartTime:null, secondsToStart:null,
    raceMonitoringStatus:'NO_VALID_RACE_SELECTED', cyclesScannedOnThisRace:0, firstCycleSeenForRace:null, latestCycleSeenForRace:null, raceLocked:false, raceLockReason:null,
    activeOrderExistsForRace:false, activeOrderIdsForRace:[], reasonStillScanningRace:'No valid race is currently selected.', selectedRaceMarketDetails:[], selectedRaceUniqueMarketCount:0,
    selectedRaceWinMarketCount:0, selectedRacePlaceMarketCount:0, selectedRaceH2HMarketCount:0, selectedRaceUnknownMarketCount:0, selectedRaceDuplicateMarketCount:0,
    duplicateMarketRecordDetected:false, diagnosticError:null, primaryWinMarketId:null, secondaryWinMarketIds:[], primaryMarketSelectionReason:null,
    windowStartSeconds:Number(windowStart), windowEndSeconds:Number(windowEnd), selectedRaceWindowOpensAt:null, selectedRaceWindowClosesAt:null, selectedRaceRunnerSnapshot:[],
  };

  const startTime = selectedRace.startTime || selectedRace.marketStartTime || null;
  const startMs = new Date(startTime || 0).getTime();
  const secondsToStart = Number.isFinite(startMs) ? Math.round((startMs - now) / 1000) : null;
  const windowStartSeconds=Number(windowStart);
  const windowEndSeconds=Number(windowEnd);
  const selectedRaceWindowOpensAt=Number.isFinite(startMs) ? new Date(startMs-windowStartSeconds*1000).toISOString() : null;
  const selectedRaceWindowClosesAt=Number.isFinite(startMs) ? new Date(startMs-windowEndSeconds*1000).toISOString() : null;
  const activeOrders = activeRaceOrders(orders, selectedRace);
  const accepted = new Set(acceptedMarketIds.map(String));
  const grouped = new Map();
  (selectedRace.markets || []).forEach((market, index) => {
    const id = normalizedMarketId(market);
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push({ market, index });
  });

  let diagnosticError = null;
  const details = [];
  for (const [id, records] of grouped) {
    const reason = records.length > 1 ? duplicateReason(records.map(item => item.market)) : null;
    if (reason === 'RUNNER_FLATTENED_AS_MARKET') diagnosticError = 'RUNNERS_COUNTED_AS_MARKETS';
    records.forEach(({ market, index }, duplicateIndex) => {
      const marketRunners = runners.filter(runner => normalizedMarketId(runner) === id);
      const type = detectMarketType(market);
      const rejectionReason = duplicateIndex > 0 ? reason : (!accepted.has(id) ? (type === 'UNKNOWN' ? 'UNSUPPORTED_MARKET_TYPE' : 'NOT_ACCEPTED_BY_ENGINE_FILTERS') : null);
      const winnerMetadata=resolveNumberOfWinners(market);
      details.push({ marketId:market.betfairMarketId || market.marketId || market.id || null, normalizedMarketId:id, eventId:market.eventId || market.betfairEventId || null, marketName:market.marketName || '', marketType:type, marketTypeCode:market.marketTypeCode || market.marketType || '', ...winnerMetadata, runnerCount:marketRunners.length, activeRunnerCount:marketRunners.filter(r => r.status === 'ACTIVE').length, pricedRunnerCount:marketRunners.filter(r => Number(r.bestBackPrice) > 0 || Number(r.bestLayPrice) > 0).length, totalMatched:Number(market.totalMatched || 0), marketStartTime:market.marketStartTime || market.startTime || null, source:market.source || 'unknown', accepted:duplicateIndex === 0 && accepted.has(id), acceptanceReason:duplicateIndex === 0 && accepted.has(id) ? 'ELIGIBLE_UNIQUE_MARKET' : null, rejectionReason, duplicateReason:reason, catalogueIndex:index });
    });
  }

  const unique = [...new Map(details.map(item => [item.normalizedMarketId, item])).values()];
  const count = type => unique.filter(item => item.marketType === type).length;
  const hasOpenMarket = (selectedRace.markets || []).some(market => market.status === 'OPEN');
  let raceMonitoringStatus = 'INSIDE_ACTIVE_WINDOW';
  if (activeOrders.length) raceMonitoringStatus = 'RACE_LOCKED_BY_EXISTING_ORDER';
  else if (!hasOpenMarket) raceMonitoringStatus = 'RACE_CLOSED';
  else if (secondsToStart != null && secondsToStart <= 0) raceMonitoringStatus = 'RACE_STARTED';
  else if (secondsToStart == null || secondsToStart > windowStart) raceMonitoringStatus = 'WAITING_FOR_WINDOW';
  else if (secondsToStart <= windowEnd) raceMonitoringStatus = 'INSIDE_ACTIVE_WINDOW';

  const cycles = Number(selectedRace.cyclesScannedOnThisRace || 0);
  const reasonStillScanningRace = activeOrders.length
    ? 'Scanning same race for diagnostics; an active order locks further orders on this race.'
    : cycles > 1
      ? 'Scanning same race because it is still the active selected race. The scanner will rescan it every scan interval until the race starts, an order is created, or a nearer valid race replaces it.'
      : 'Current selected race is inside the active monitoring window.';
  const primary = choosePrimaryWin(unique);

  return {
    selectedRaceKey:selectedRace.raceKey || null, selectedRaceEventId:selectedRace.eventId || null, selectedRaceVenue:selectedRace.venue || '', selectedRaceNumber:selectedRace.raceNumber || parseRaceNumber(selectedRace.eventName, selectedRace.markets?.[0]?.marketName) || 0,
    selectedRaceName:selectedRace.eventName || '', selectedRaceStartTime:startTime, secondsToStart, raceMonitoringStatus, cyclesScannedOnThisRace:cycles,
    windowStartSeconds, windowEndSeconds, selectedRaceWindowOpensAt, selectedRaceWindowClosesAt,
    selectedRaceRunnerSnapshot:buildRunnerSnapshot(runners, [...grouped.keys()]),
    firstCycleSeenForRace:selectedRace.firstCycleSeenForRace ?? null, latestCycleSeenForRace:selectedRace.latestCycleSeenForRace ?? null,
    raceLocked:activeOrders.length > 0, raceLockReason:activeOrders.length ? 'ACTIVE_ORDER_EXISTS_FOR_RACE' : null, activeOrderExistsForRace:activeOrders.length > 0,
    activeOrderIdsForRace:activeOrders.map(order => String(order.id || order.customerRef || order.betfairBetId || '')).filter(Boolean), reasonStillScanningRace,
    selectedRaceMarketDetails:details.map(({ catalogueIndex, ...item }) => item), selectedRaceUniqueMarketCount:unique.length, selectedRaceWinMarketCount:count('WIN'),
    selectedRacePlaceMarketCount:count('PLACE'), selectedRaceH2HMarketCount:count('H2H'), selectedRaceUnknownMarketCount:count('UNKNOWN'),
    selectedRaceDuplicateMarketCount:[...grouped.values()].reduce((sum, records) => sum + Math.max(0, records.length - 1), 0),
    duplicateMarketRecordDetected:[...grouped.values()].some(records => records.length > 1), diagnosticError, ...primary,
  };
}

export function applyRaceOrderLock(opportunities, raceMonitoring) {
  if (!raceMonitoring?.raceLocked) return opportunities;
  for (const opportunity of opportunities) {
    opportunity.decision = 'NO_BET';
    opportunity.gatesPassed = false;
    opportunity.failedGate = 'DUPLICATE_RACE_EXPOSURE';
    opportunity.blockers = ['DUPLICATE_RACE_EXPOSURE', ...(opportunity.blockers || []).filter(item => item !== 'DUPLICATE_RACE_EXPOSURE')];
  }
  return opportunities;
}

export function isActiveOrderStatus(order) {
  return ACTIVE_ORDER_STATUSES.includes(order?.status) || ACTIVE_ORDER_STATUSES.includes(order?.settlementStatus);
}