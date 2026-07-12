import React from 'react';
import { useApp } from '@/lib/AppContext';
import useAuthoritativeTradingState from '@/hooks/useAuthoritativeTradingState';
import { StatusBlock } from '@/components/ui/workstation';
import { fmtAge } from '@/lib/format';
import { Wifi, Radio, Bot, MapPin, ScanLine, ShieldCheck } from 'lucide-react';

export default function SystemStatusStrip() {
  const { apiConnected, betfairConnection, botState, botCycles, markets, statisticalValidation } = useApp();
  const auth = useAuthoritativeTradingState();
  const botRunning = botState.running && !botState.paused;
  const lastCycle = botCycles[0];

  const raceMonitoring = auth.currentRace;
  const raceName = raceMonitoring?.selectedRaceMarketDetails?.[0]?.marketName
    || raceMonitoring?.selectedRaceKey
    || 'None selected';

  const validationStatus = statisticalValidation?.overallStatus || 'INSUFFICIENT_DATA';

  const blocks = [
    {
      label: 'Betfair API',
      value: apiConnected ? 'Connected' : 'Disconnected',
      status: apiConnected ? 'ok' : 'danger',
      icon: Wifi,
    },
    {
      label: 'Price Stream',
      value: auth.priceFeedStatus === 'LIVE' ? `Live · ${auth.priceAgeSeconds}s` : auth.priceFeedStatus,
      status: auth.priceFeedStatus === 'LIVE' ? 'live' : auth.priceFeedStatus === 'STALE' ? 'stale' : 'error',
      icon: Radio,
    },
    {
      label: 'Paper Bot',
      value: botRunning ? 'Running' : botState.paused ? 'Paused' : 'Stopped',
      status: botRunning ? 'ok' : botState.paused ? 'warning' : 'neutral',
      icon: Bot,
    },
    {
      label: 'Current Race',
      value: raceName,
      status: raceMonitoring?.selectedRaceKey ? 'ok' : 'neutral',
      icon: MapPin,
    },
    {
      label: 'Last Scan',
      value: lastCycle ? `#${lastCycle.cycleNumber} · ${fmtAge(lastCycle.finishedAt || lastCycle.startedAt)}` : 'Not run',
      status: lastCycle?.status === 'completed' ? 'ok' : lastCycle?.status === 'failed' ? 'danger' : 'neutral',
      icon: ScanLine,
    },
    {
      label: 'Validation',
      value: validationStatus.replace(/_/g, ' '),
      status: validationStatus === 'VALIDATED' ? 'ok' : validationStatus === 'INSUFFICIENT_DATA' ? 'warning' : 'neutral',
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
      {blocks.map(b => <StatusBlock key={b.label} {...b} />)}
    </div>
  );
}