import React, { useState } from 'react';
import BotStatusCard from '@/components/bot/BotStatusCard';
import BotControls from '@/components/bot/BotControls';
import BotLoopDisplay from '@/components/bot/BotLoopDisplay';
import BotRulesPanel from '@/components/bot/BotRulesPanel';
import LiveBotLockPanel from '@/components/bot/LiveBotLockPanel';
import BotScanStats from '@/components/bot/BotScanStats';
import BotSyncControls from '@/components/bot/BotSyncControls';
import StrategyControlPanel from '@/components/bot/StrategyControlPanel';
import WhyNoBetPanel from '@/components/bot/WhyNoBetPanel';
import BestCandidatePanel from '@/components/bot/BestCandidatePanel';
import ScanSummaryPanel from '@/components/bot/ScanSummaryPanel';
import CalibrationPanel from '@/components/bot/CalibrationPanel';
import DecisionLogPanel from '@/components/bot/DecisionLogPanel';
import { Panel } from '@/components/ui/Trading';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useApp } from '@/lib/AppContext';

export default function BotControlCentre() {
  const [showAdmin, setShowAdmin] = useState(false);
  const { lastScanDiagnostics } = useApp();

  return (
    <div className="space-y-5">
      <BotControls />
      <StrategyControlPanel />
      <BotSyncControls />
      <ScanSummaryPanel scanSummary={lastScanDiagnostics?.scanSummary} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BestCandidatePanel bestCandidate={lastScanDiagnostics?.bestCandidate} />
        <CalibrationPanel />
      </div>
      <DecisionLogPanel />
      <BotScanStats />
      <BotStatusCard />
      <BotLoopDisplay />
      {lastScanDiagnostics?.noBetReason && <WhyNoBetPanel diagnostics={lastScanDiagnostics} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <BotRulesPanel />
      </div>

      {/* Admin/Advanced — collapsed by default */}
      <Panel>
        <button
          onClick={() => setShowAdmin(!showAdmin)}
          className="w-full flex items-center gap-2 px-4 py-3 text-xs font-bold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
        >
          {showAdmin ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Admin / Advanced (Future Live Review — Disabled)
        </button>
        {showAdmin && (
          <div className="p-4 pt-0">
            <LiveBotLockPanel />
          </div>
        )}
      </Panel>
    </div>
  );
}