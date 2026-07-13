import { describe, expect, it } from 'vitest';
import { applyRaceOrderLock, buildRaceMonitoringDiagnostics } from './raceMonitoringDiagnostics';
import { exposureBlock } from './raceExposure';
import { clusterMarketsByEvent, getPrimaryMarket } from './marketClusterer';
import { clearRaceDayCache, loadRaceDayCache, markRaceScanned } from './raceDayCache';
import { CYCLE_EXPORT_COLUMNS, cycleToRow } from '@/components/bot/DecisionLogPanel';

const start = new Date(Date.now() + 120000).toISOString();
const market = (id, extra = {}) => ({ id, betfairMarketId: id, eventId: 'e1', eventName: 'Eagle Farm R3', venue: 'Eagle Farm', raceNumber: 3, marketName: 'Win', marketTypeCode: 'WIN', numberOfWinners: 1, totalMatched: 100, status: 'OPEN', startTime: start, marketStartTime: start, source: 'catalogue', ...extra });
const runners = id => Array.from({ length: 8 }, (_, index) => ({ marketId: id, selectionId: String(index + 1), status: 'ACTIVE', bestBackPrice: 2 + index, bestLayPrice: 2.02 + index }));

function recordThree(markets, orders = []) {
  clearRaceDayCache();
  const allRunners = markets.flatMap(item => runners(item.betfairMarketId));
  const cache = loadRaceDayCache({ markets, runners: allRunners, fetchedAt: new Date().toISOString() });
  const race = [...cache.racesByRaceKey.values()][0];
  if (!race) throw new Error('TEST_RACE_NOT_GROUPED');
  markRaceScanned(race.raceKey, Date.now(), '', 11);
  markRaceScanned(race.raceKey, Date.now(), '', 12);
  markRaceScanned(race.raceKey, Date.now(), '', 13);
  const tracked = cache.racesByRaceKey.get(race.raceKey);
  return buildRaceMonitoringDiagnostics({
    selectedRace: tracked,
    runners: allRunners,
    orders,
    acceptedMarketIds: markets.filter(item => item.status === 'OPEN').map(item => item.betfairMarketId),
  });
}

describe('selected race monitoring diagnostics', () => {
  it('marks repeated scans inside the active window and increments cycles', () => {
    const report = recordThree([market('1.100')]);
    expect(report).toMatchObject({ raceMonitoringStatus: 'INSIDE_ACTIVE_WINDOW', cyclesScannedOnThisRace: 3, firstCycleSeenForRace: 11, latestCycleSeenForRace: 13, diagnosticError: null });
    expect(report.reasonStillScanningRace).toContain('still the active selected race');
  });

  it('locks a race with one active order', () => {
    const report = recordThree([market('1.100')], [{ id: 'o1', eventId: 'e1', status: 'awaiting_result' }]);
    expect(report).toMatchObject({ raceLocked: true, raceLockReason: 'ACTIVE_ORDER_EXISTS_FOR_RACE', raceMonitoringStatus: 'RACE_LOCKED_BY_EXISTING_ORDER', activeOrderIdsForRace: ['o1'] });
    expect(exposureBlock([{ id: 'o1', eventId: 'e1', marketId: 'other', status: 'awaiting_result' }], market('1.100'))).toBe('DUPLICATE_RACE_EXPOSURE');
    const opportunities = applyRaceOrderLock([{ decision: 'BET', gatesPassed: true, blockers: [] }], report);
    expect(opportunities[0]).toMatchObject({ decision: 'NO_BET', failedGate: 'DUPLICATE_RACE_EXPOSURE' });
  });

  it('counts one WIN market with eight runners once', () => {
    const report = recordThree([market('1.100')]);
    expect(report.selectedRaceWinMarketCount).toBe(1);
    expect(report.selectedRaceMarketDetails[0].runnerCount).toBe(8);
  });

  it('lists duplicate IDs but counts each normalized market once', () => {
    const report = recordThree([market('1.100'), market('1.100', { source: 'stream' })]);
    expect(report).toMatchObject({ selectedRaceUniqueMarketCount: 1, selectedRaceDuplicateMarketCount: 1, duplicateMarketRecordDetected: true });
    expect(report.selectedRaceMarketDetails).toHaveLength(2);
    expect(report.selectedRaceMarketDetails[1].rejectionReason).toBe('CATALOGUE_AND_STREAM_DUPLICATE');
  });

  it('flags runner flattening as a diagnostic error', () => {
    const report = recordThree([market('1.100', { runnerId: 'r1' }), market('1.100', { runnerId: 'r2' })]);
    expect(report.diagnosticError).toBe('RUNNERS_COUNTED_AS_MARKETS');
  });

  it('shows two real WIN markets and selects the primary deterministically', () => {
    const markets = [market('1.200', { totalMatched: 500 }), market('1.100', { totalMatched: 100 })];
    const report = recordThree(markets);
    expect(report.selectedRaceMarketDetails).toHaveLength(2);
    expect(report.primaryWinMarketId).toBe('1.200');
    expect(report.secondaryWinMarketIds).toEqual(['1.100']);
    expect(getPrimaryMarket(clusterMarketsByEvent(markets)[0]).betfairMarketId).toBe('1.200');
    const priority = [market('1.300', { marketTypeCode: 'WIN_MARKET', totalMatched: 1000 }), market('1.400', { marketTypeCode: 'WIN', numberOfWinners: 2, totalMatched: 10 })];
    expect(getPrimaryMarket(clusterMarketsByEvent(priority)[0]).betfairMarketId).toBe('1.400');
  });

  it('exports every market and race monitoring CSV column', () => {
    const report = recordThree([market('1.100'), market('1.200', { status: 'SUSPENDED' })]);
    const row = cycleToRow({ cycleId: 'c1', cycleNumber: 13, finishedAt: new Date().toISOString(), scanSummary: report });
    const exportedMarkets = JSON.parse(row.selectedRaceMarketDetailsJson);
    expect(exportedMarkets).toHaveLength(2);
    expect(exportedMarkets.map(item => item.accepted)).toEqual([true, false]);
    const labels = CYCLE_EXPORT_COLUMNS.map(item => item.label);
    expect(labels).toEqual(expect.arrayContaining(['RaceMonitoringStatus', 'CyclesScannedOnThisRace', 'RaceLocked', 'RaceLockReason', 'ActiveOrderExistsForRace', 'ReasonStillScanningRace', 'SelectedRaceUniqueMarketCount', 'SelectedRaceWinMarketCount', 'SelectedRacePlaceMarketCount', 'SelectedRaceH2HMarketCount', 'SelectedRaceDuplicateMarketCount', 'DuplicateMarketRecordDetected', 'PrimaryWinMarketId', 'SecondaryWinMarketIds', 'PrimaryMarketSelectionReason', 'SelectedRaceMarketDetailsJson']));
  });
});
