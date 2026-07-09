import React, { useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { Panel, StatusBadge, PLValue } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FlaskConical, Play, RefreshCw, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { isPaperProofModeActive } from '@/lib/paperProofDefaults';
import { exportToCSV } from '@/lib/csvExport';

export default function PaperProofPanel() {
  const {
    settings, botSettings, featherlessSettings,
    paperOrders, botCycles,
    applyPaperProofDefaults, runProofScan, runSettlementCheckNow,
    addAuditLog,
  } = useApp();

  const [scanRunning, setScanRunning] = useState(false);
  const [settlementRunning, setSettlementRunning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [settlementResult, setSettlementResult] = useState(null);

  const proofActive = isPaperProofModeActive(settings, botSettings, featherlessSettings);
  const latestProofCycle = botCycles.find(c => c.paperProofMode || c.botMode === 'paper_proof');
  const proofOrders = paperOrders.filter(o => o.proofMode || o.dataSource === 'MARKET_ONLY_PROOF');
  const awaitingResult = paperOrders.filter(o => o.status === 'awaiting_result');
  const settledProof = proofOrders.filter(o => o.status === 'settled');
  const resultUnknown = paperOrders.filter(o => o.status === 'awaiting_result' && o.resultConfidence === 'unknown');
  const latestSettled = settledProof[0];
  const latestProofOrder = proofOrders[0];

  const handleApplyDefaults = async () => {
    await applyPaperProofDefaults();
  };

  const handleProofScan = async () => {
    setScanRunning(true);
    setScanResult(null);
    try {
      const result = await runProofScan();
      setScanResult(result);
    } finally {
      setScanRunning(false);
    }
  };

  const handleSettlementCheck = async () => {
    setSettlementRunning(true);
    setSettlementResult(null);
    try {
      const result = await runSettlementCheckNow();
      setSettlementResult(result);
    } finally {
      setSettlementRunning(false);
    }
  };

  const handleExportProofLogs = () => {
    const proofCycles = botCycles.filter(c => c.paperProofMode || c.botMode === 'paper_proof');
    if (proofCycles.length === 0 && proofOrders.length === 0) return;

    if (proofCycles.length > 0) {
      exportToCSV('proof-mode-cycles.csv', proofCycles.map(c => ({
        cycleNumber: c.cycleNumber,
        botMode: c.botMode,
        paperProofMode: c.paperProofMode || false,
        proofDefaultsApplied: c.proofDefaultsApplied || false,
        proofFallbackUsed: c.proofFallbackUsed || false,
        proofReason: c.proofReason || '',
        proofStake: c.proofStake || '',
        proofMaxLiability: c.proofMaxLiability || '',
        proofOrderCreated: c.proofOrderCreated || false,
        proofSettlementStatus: c.proofSettlementStatus || '',
        marketsScanned: c.marketsScanned,
        marketsEligible: c.marketsPassedFilters,
        opportunitiesGenerated: c.runnersAssessed,
        positiveEVOpportunities: c.candidatesPassedEdge,
        selectedMarket: c.selectedMarketName || '',
        selectedRunner: c.bestCandidate?.runnerName || '',
        side: c.bestCandidate?.side || '',
        odds: c.bestCandidate?.odds || '',
        stake: c.bestCandidate?.stake || '',
        liability: c.bestCandidate?.liability || '',
        orderStatus: c.scanSummary?.orderStatus || '',
        settlementStatus: c.scanSummary?.settlementStatus || '',
        noBetReason: c.noBetReason || '',
        startedAt: c.startedAt,
        finishedAt: c.finishedAt,
      })));
    }

    if (proofOrders.length > 0) {
      exportToCSV('proof-mode-orders.csv', proofOrders.map(o => ({
        orderId: o.id || o.customerRef || '',
        market: o.marketName || o.venue || '',
        runner: o.runnerName || '',
        side: o.side,
        odds: o.requestedOdds || o.matchedOdds || '',
        stake: o.requestedStake || '',
        matchedStake: o.matchedStake || '',
        liability: o.liability || '',
        status: o.status,
        settlementStatus: o.settlementStatus || '',
        result: o.result || '',
        netProfit: o.netProfit ?? '',
        resultSource: o.resultSource || '',
        resultConfidence: o.resultConfidence || '',
        proofMode: o.proofMode || false,
        dataSource: o.dataSource || '',
        persistenceType: o.persistenceType || '',
        placedDate: o.placed_date || o.created_date || '',
        settledDate: o.settled_date || '',
      })));
    }

    addAuditLog('Proof Logs Exported', 'system', 'info', `Exported ${proofCycles.length} proof cycles and ${proofOrders.length} proof orders`);
  };

  return (
    <Panel title="Paper Proof Mode" action={
      <StatusBadge status={proofActive ? 'ok' : 'neutral'}>
        {proofActive ? 'PROOF MODE ACTIVE' : 'NOT ACTIVE'}
      </StatusBadge>
    }>
      {/* Warning banner */}
      <div className={cn(
        'px-4 py-2.5 border-b border-border text-xs flex items-start gap-2',
        proofActive ? 'bg-warning/10 text-warning' : 'bg-muted/20 text-muted-foreground'
      )}>
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Paper Proof Mode relaxes value, confidence, spread, liquidity and AI filters to test the app pipeline.
          It may create bad theoretical bets. Do not use these settings for live betting.
        </span>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border">
        <Metric label="Proof Mode" value={proofActive ? 'YES' : 'NO'} tone={proofActive ? 'success' : 'default'} />
        <Metric label="Defaults Applied" value={latestProofCycle?.proofDefaultsApplied ? 'YES' : 'NO'} tone={latestProofCycle?.proofDefaultsApplied ? 'success' : 'default'} />
        <Metric label="Awaiting Result" value={awaitingResult.length} tone={awaitingResult.length > 0 ? 'warning' : 'default'} />
        <Metric label="Settled Proof" value={settledProof.length} tone={settledProof.length > 0 ? 'success' : 'default'} />
        <Metric label="Result Unknown" value={resultUnknown.length} tone={resultUnknown.length > 0 ? 'warning' : 'default'} />
        <Metric label="Latest Result Source" value={latestSettled?.resultSource || '—'} />
        <Metric label="Latest Proof P/L" value={latestSettled ? <PLValue value={latestSettled.netProfit || 0} /> : '—'} />
        <Metric label="Fallback Used" value={latestProofCycle?.proofFallbackUsed ? 'YES' : 'NO'} tone={latestProofCycle?.proofFallbackUsed ? 'warning' : 'default'} />
      </div>

      {/* Last proof order info */}
      {latestProofOrder && (
        <div className="px-4 py-2 border-b border-border text-xs space-y-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase">Last Proof Order</div>
          <div className="flex items-center gap-2">
            <StatusBadge status={latestProofOrder.status === 'matched' ? 'ok' : latestProofOrder.status === 'settled' ? 'ok' : 'warning'}>
              {latestProofOrder.status}
            </StatusBadge>
            <span className="font-bold text-foreground">{latestProofOrder.side} {latestProofOrder.runnerName}</span>
            <span className="text-muted-foreground">@ {latestProofOrder.requestedOdds?.toFixed(2)}</span>
            <span className="text-muted-foreground">× ${latestProofOrder.requestedStake?.toFixed(2)}</span>
            {latestProofOrder.proofMode && <StatusBadge status="info">PROOF</StatusBadge>}
          </div>
        </div>
      )}

      {/* No proof order reason */}
      {!latestProofOrder && latestProofCycle?.noBetReason && (
        <div className="px-4 py-2 border-b border-border text-xs text-danger">
          <span className="font-bold">No proof order created:</span> {latestProofCycle.noBetReason}
        </div>
      )}

      {/* Scan result */}
      {scanResult && !scanResult.error && (
        <div className="px-4 py-2 border-b border-border text-xs bg-success/5">
          <div className="text-[10px] font-bold text-success uppercase mb-1">Proof Scan Result</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            <div>Markets: <span className="font-mono font-bold">{scanResult.marketsLoaded}</span></div>
            <div>Eligible: <span className="font-mono font-bold">{scanResult.marketsEligible}</span></div>
            <div>Opportunities: <span className="font-mono font-bold">{scanResult.opportunitiesGenerated}</span></div>
            <div>Positive-EV: <span className="font-mono font-bold">{scanResult.positiveEVOpportunities}</span></div>
            <div>Fallback: <span className="font-mono font-bold">{scanResult.proofFallbackUsed ? 'YES' : 'NO'}</span></div>
            <div>Order: <span className="font-mono font-bold">{scanResult.paperOrderCreated ? 'YES' : 'NO'}</span></div>
            {scanResult.selectedRunner && <div>Runner: <span className="font-bold">{scanResult.selectedRunner}</span></div>}
            {scanResult.side && <div>Side: <span className="font-bold">{scanResult.side}</span></div>}
            {scanResult.odds && <div>Odds: <span className="font-mono font-bold">{scanResult.odds.toFixed(2)}</span></div>}
            {scanResult.stake && <div>Stake: <span className="font-mono font-bold">${scanResult.stake.toFixed(2)}</span></div>}
          </div>
        </div>
      )}

      {/* Settlement result */}
      {settlementResult && !settlementResult.error && (
        <div className="px-4 py-2 border-b border-border text-xs bg-info/5">
          <div className="text-[10px] font-bold text-info uppercase mb-1">Settlement Check Result</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1">
            <div>Awaiting Before: <span className="font-mono font-bold">{settlementResult.awaitingBefore}</span></div>
            <div>Settled: <span className="font-mono font-bold text-success">{settlementResult.settledThisRun}</span></div>
            <div>Unknown: <span className="font-mono font-bold text-warning">{settlementResult.resultUnknownThisRun}</span></div>
            <div>Still Awaiting: <span className="font-mono font-bold">{settlementResult.stillAwaiting}</span></div>
            {settlementResult.latestResultSource && <div>Source: <span className="font-bold">{settlementResult.latestResultSource}</span></div>}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2 p-3">
        <Button
          size="sm"
          variant={proofActive ? 'outline' : 'default'}
          onClick={handleApplyDefaults}
          className="gap-1.5"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {proofActive ? 'Re-apply Proof Defaults' : 'Apply Paper Proof Defaults'}
        </Button>
        <Button
          size="sm"
          variant="default"
          onClick={handleProofScan}
          disabled={!proofActive || scanRunning}
          className="gap-1.5"
        >
          {scanRunning ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Scanning...</> : <><Play className="h-3.5 w-3.5" /> Run Proof Scan Now</>}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSettlementCheck}
          disabled={settlementRunning}
          className="gap-1.5"
        >
          {settlementRunning ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Checking...</> : <><RefreshCw className="h-3.5 w-3.5" /> Run Settlement Check Now</>}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleExportProofLogs}
          disabled={botCycles.filter(c => c.paperProofMode).length === 0 && proofOrders.length === 0}
          className="gap-1.5"
        >
          <Download className="h-3.5 w-3.5" /> Export Proof Logs
        </Button>
      </div>

      {/* Live betting locked notice */}
      <div className="px-4 py-2 bg-success/5 border-t border-success/20 text-[10px] text-muted-foreground flex items-center gap-2">
        <CheckCircle2 className="h-3 w-3 text-success" />
        Live betting is disabled and locked. All proof orders use LAPSE persistence. No real Betfair orders are placed.
      </div>
    </Panel>
  );
}

function Metric({ label, value, tone }) {
  const tones = { success: 'text-success', warning: 'text-warning', danger: 'text-danger', default: 'text-foreground' };
  return (
    <div className="bg-card p-2.5 text-center">
      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className={cn('text-sm font-bold font-mono mt-0.5', tones[tone || 'default'])}>{value}</div>
    </div>
  );
}