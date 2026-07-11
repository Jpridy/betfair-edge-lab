import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SelectedRaceMonitoringView } from './SelectedRaceMonitoring';

const data = {
  selectedRaceKey:'e1', raceMonitoringStatus:'RACE_LOCKED_BY_EXISTING_ORDER', cyclesScannedOnThisRace:3,
  reasonStillScanningRace:'Scanning same race for diagnostics.', raceLocked:true, raceLockReason:'ACTIVE_ORDER_EXISTS_FOR_RACE',
  activeOrderExistsForRace:true, activeOrderIdsForRace:['o1'], selectedRaceUniqueMarketCount:1, selectedRaceDuplicateMarketCount:1,
  duplicateMarketRecordDetected:true, diagnosticError:'RUNNERS_COUNTED_AS_MARKETS', primaryWinMarketId:'1.100', secondaryWinMarketIds:['1.101'],
  selectedRaceMarketDetails:[{marketId:'1.100',normalizedMarketId:'1.100',marketName:'Win',marketType:'WIN',runnerCount:8,accepted:true,acceptanceReason:'ELIGIBLE_UNIQUE_MARKET'}],
};

describe('SelectedRaceMonitoringView', () => {
  it('renders race lock and duplicate-market diagnostics', () => { const html=renderToStaticMarkup(<SelectedRaceMonitoringView data={data} />); for (const text of ['RACE LOCKED BY EXISTING ORDER','Monitoring status','Cycles scanned','Scanning same race for diagnostics.','Race locked','ACTIVE_ORDER_EXISTS_FOR_RACE','Active order','o1','Unique markets','Duplicate markets','Duplicate detected','RUNNERS_COUNTED_AS_MARKETS','1.100','1.101','Accepted — ELIGIBLE_UNIQUE_MARKET']) expect(html).toContain(text); });
});