import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { MOCK_RACE_PACK, MOCK_FEATHERLESS_RESPONSE } from '@/lib/mockFeatherlessData';
import { Panel, StatusBadge, SideBadge } from '@/components/ui/Trading';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Brain, Send, ArrowRight, CheckCircle, AlertTriangle, TrendingUp, Zap, FileJson, Loader2, Sparkles } from 'lucide-react';

function JsonViewer({ data, maxHeight = '400px' }) {
  return (
    <pre className="text-xs font-mono text-muted-foreground bg-background/50 border border-border-subtle rounded-md p-3 overflow-auto" style={{ maxHeight }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function RacePackSummary({ racePack }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Panel
      title="Step 1: Race Pack Sent to Featherless"
      subtitle="Full race context — markets, runners, prices, bot state"
      action={<Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Collapse' : 'Expand JSON'}</Button>}
    >
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-label text-muted-foreground">Event</div>
            <div className="text-sm font-semibold mt-1">{racePack.eventName}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-label text-muted-foreground">Runners</div>
            <div className="text-sm font-semibold mt-1">{racePack.numberOfRunners}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-label text-muted-foreground">Total Matched</div>
            <div className="text-sm font-semibold mt-1 font-mono">${racePack.marketSummary.totalMatched.toLocaleString()}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-label text-muted-foreground">Seconds to Jump</div>
            <div className="text-sm font-semibold mt-1 font-mono">{racePack.secondsToJump}s</div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {racePack.marketSummary.winMarket && <StatusBadge status="info">WIN Market</StatusBadge>}
          {racePack.marketSummary.placeMarket && <StatusBadge status="ok">PLACE Market</StatusBadge>}
          {racePack.marketSummary.h2hMarkets?.map(h => <StatusBadge key={h.marketId} status="warning">H2H: {h.marketName}</StatusBadge>)}
          <StatusBadge status="neutral">Commission {(racePack.botContext.commissionRate * 100).toFixed(1)}%</StatusBadge>
          <StatusBadge status={racePack.botContext.dataFreshness === 'live' ? 'ok' : 'warning'}>Feed: {racePack.botContext.dataFreshness}</StatusBadge>
        </div>

        {expanded && (
          <div className="mt-2">
            <JsonViewer data={racePack} maxHeight="500px" />
          </div>
        )}
      </div>
    </Panel>
  );
}

function FeatherlessResponse({ response, isLive = false }) {
  const [tab, setTab] = useState('summary');
  const [jsonExpanded, setJsonExpanded] = useState(false);

  const tabs = [
    { key: 'summary', label: 'Race View' },
    { key: 'runners', label: `Runners (${response.runnerProbabilities.length})` },
    { key: 'opps', label: `Opportunities (${response.recommendedOpportunities.length})` },
    { key: 'json', label: 'Raw JSON' },
  ];

  return (
    <Panel
      title="Step 2: Featherless AI Response"
      subtitle={`Model: DeepSeek-V4-Pro · Prompt v4.0-race-assessment · Data Quality: ${response.dataQuality}/100`}
      action={
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <StatusBadge status="ok">LIVE</StatusBadge>
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </>
          ) : (
            <>
              <StatusBadge status="neutral">mock</StatusBadge>
            </>
          )}
        </div>
      }
    >
      <div className="p-4 space-y-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border-subtle">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'summary' && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Brain className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <div className="text-sm font-semibold mb-1">Race Summary</div>
                  <p className="text-sm text-muted-foreground">{response.raceSummary}</p>
                </div>
              </div>
            </div>

            <div className="bg-muted/30 rounded-lg p-4">
              <div className="text-sm font-semibold mb-1">Market Read</div>
              <p className="text-sm text-muted-foreground">{response.marketRead}</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-label text-muted-foreground">Data Quality</div>
                <div className="text-lg font-heading font-bold mt-1">{response.dataQuality}<span className="text-xs text-muted-foreground">/100</span></div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-label text-muted-foreground">Confidence</div>
                <div className="text-lg font-heading font-bold mt-1">{response.confidence}<span className="text-xs text-muted-foreground">/100</span></div>
              </div>
              <div className="bg-muted/30 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-label text-muted-foreground">Should Bet?</div>
                <div className="text-lg font-heading font-bold mt-1 text-success">{response.finalRaceView.shouldBetThisRace ? 'YES' : 'NO'}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-success/5 border border-success/20 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-label text-success">Best Back Candidate</div>
                <div className="text-sm font-semibold mt-1">{response.finalRaceView.bestBackCandidate}</div>
                <div className="text-xs text-muted-foreground mt-1">{response.finalRaceView.summaryReason}</div>
              </div>
              <div className="bg-danger/5 border border-danger/20 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-label text-danger">Best Lay Candidate</div>
                <div className="text-sm font-semibold mt-1">{response.finalRaceView.bestLayCandidate}</div>
                <div className="text-xs text-muted-foreground mt-1">{response.finalRaceView.mostUnderpricedRunner} is underpriced</div>
              </div>
            </div>

            {response.keyRisks.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-label mb-2">Key Risks</div>
                <ul className="space-y-1">
                  {response.keyRisks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {tab === 'runners' && (
          <div className="space-y-2 animate-fade-in">
            {response.runnerProbabilities.map((rp, i) => {
              const marketRunner = MOCK_RACE_PACK.markets[0].runners.find(r => r.selectionId === rp.selectionId);
              const betfairOdds = marketRunner?.bestBackPrice || 0;
              const impliedProb = betfairOdds > 0 ? (1 / betfairOdds) : 0;
              const edge = ((rp.pWin - impliedProb) / impliedProb * 100);
              return (
                <div key={rp.selectionId} className="border border-border-subtle rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground">{i + 1}.</span>
                      <span className="text-sm font-semibold">{rp.runnerName}</span>
                      {rp.runnerName === response.finalRaceView.bestRunner && <StatusBadge status="ok">Best</StatusBadge>}
                      {rp.runnerName === response.finalRaceView.mostOverpricedRunner && <StatusBadge status="info">Overpriced</StatusBadge>}
                      {rp.runnerName === response.finalRaceView.mostUnderpricedRunner && <StatusBadge status="danger">Underpriced</StatusBadge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground">Betfair: <span className="font-mono text-foreground">{betfairOdds.toFixed(2)}</span></span>
                      <span className="text-muted-foreground">Fair: <span className="font-mono text-foreground">{rp.fairWinOdds.toFixed(2)}</span></span>
                      <span className={`font-mono font-semibold ${edge > 0 ? 'text-success' : edge < 0 ? 'text-danger' : 'text-muted-foreground'}`}>
                        {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                    <div><span className="text-muted-foreground">pWin:</span> <span className="font-mono">{(rp.pWin * 100).toFixed(1)}%</span></div>
                    <div><span className="text-muted-foreground">pPlace:</span> <span className="font-mono">{(rp.pPlace * 100).toFixed(1)}%</span></div>
                    <div><span className="text-muted-foreground">Conf:</span> <span className="font-mono">{rp.confidence}</span></div>
                    <div><span className="text-muted-foreground">DQ:</span> <span className="font-mono">{rp.dataQuality}</span></div>
                  </div>
                  {rp.positiveSignals.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1">
                      {rp.positiveSignals.map((s, j) => <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-success/10 text-success border border-success/20">{s}</span>)}
                    </div>
                  )}
                  {rp.negativeSignals.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rp.negativeSignals.map((s, j) => <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20">{s}</span>)}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-2 italic">{rp.reasoning}</p>
                </div>
              );
            })}
          </div>
        )}

        {tab === 'opps' && (
          <div className="space-y-3 animate-fade-in">
            <div className="bg-info/5 border border-info/20 rounded-lg p-3 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 inline mr-1 text-info" />
              These are Featherless's recommendations. The local exchange engine independently verifies each one with its own EV maths and safety gates.
            </div>
            {response.recommendedOpportunities.map((opp, i) => (
              <div key={i} className="border border-border-subtle rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <SideBadge side={opp.side} />
                    <StatusBadge status={opp.marketType === 'WIN' ? 'info' : opp.marketType === 'PLACE' ? 'ok' : 'warning'}>{opp.marketType}</StatusBadge>
                    <span className="text-sm font-semibold">{opp.runnerName}</span>
                  </div>
                  <div className="text-xs font-mono text-success">Edge: +{opp.estimatedEdge.toFixed(1)}%</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs mb-2">
                  <div><span className="text-muted-foreground">Model Prob:</span> <span className="font-mono">{(opp.modelProbability * 100).toFixed(1)}%</span></div>
                  <div><span className="text-muted-foreground">Fair Odds:</span> <span className="font-mono">{opp.fairOdds.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Betfair:</span> <span className="font-mono">{opp.betfairOdds.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Est ROI:</span> <span className="font-mono text-success">+{opp.estimatedROI.toFixed(1)}%</span></div>
                </div>
                <p className="text-xs text-muted-foreground italic">{opp.reasoning}</p>
                {opp.risks.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {opp.risks.map((r, j) => <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-warning/10 text-warning border border-warning/20">{r}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'json' && (
          <div className="animate-fade-in">
            <Button variant="ghost" size="sm" onClick={() => setJsonExpanded(!jsonExpanded)} className="mb-2">
              <FileJson className="h-3.5 w-3.5" />
              {jsonExpanded ? 'Collapse' : 'Expand full JSON'}
            </Button>
            <JsonViewer data={response} maxHeight={jsonExpanded ? '700px' : '300px'} />
          </div>
        )}
      </div>
    </Panel>
  );
}

function LocalEngineResult({ response, racePack }) {
  const [expanded, setExpanded] = useState(false);

  // Simulate what the local engine would produce from the Featherless probabilities
  const opportunities = response.recommendedOpportunities.map(opp => {
    const marketRunner = opp.marketType === 'WIN'
      ? racePack.markets[0].runners.find(r => r.selectionId === opp.selectionId)
      : racePack.markets[1].runners.find(r => r.selectionId === opp.selectionId);
    const odds = opp.side === 'BACK' ? (marketRunner?.bestBackPrice || opp.betfairOdds) : (marketRunner?.bestLayPrice || opp.betfairOdds);
    const availableSize = opp.side === 'BACK' ? (marketRunner?.bestBackSize || 0) : (marketRunner?.bestLaySize || 0);
    const modelProb = opp.modelProbability;
    const impliedProb = 1 / odds;
    const edge = modelProb - impliedProb;
    const commissionRate = 0.05;
    const grossEV = opp.side === 'BACK'
      ? (modelProb * (odds - 1)) - (1 - modelProb)
      : ((1 - modelProb) * 1) - (modelProb * (odds - 1));
    const commission = opp.side === 'BACK' ? Math.max(0, grossEV) * commissionRate : 0;
    const netEV = grossEV - commission;
    const stake = Math.min(100 * (modelProb / impliedProb), 500);
    const liability = opp.side === 'BACK' ? stake : stake * (odds - 1);

    // Safety gates
    const blockers = [];
    if (odds < 1.5) blockers.push('Odds below minimum (1.5)');
    if (odds > 50) blockers.push('Odds above maximum (50)');
    if (availableSize < 20) blockers.push(`Insufficient liquidity ($${availableSize.toFixed(0)} < $20 min)`);
    if (opp.confidence < 50) blockers.push(`Confidence too low (${opp.confidence} < 50)`);
    if (edge * 100 < 3) blockers.push(`Edge below minimum (${(edge * 100).toFixed(1)}% < 3%)`);
    if (liability > 1500) blockers.push(`Liability exceeds max ($${liability.toFixed(0)} > $1500)`);

    return {
      ...opp,
      odds,
      availableSize,
      edge,
      netEV,
      stake: Math.round(stake * 100) / 100,
      liability: Math.round(liability * 100) / 100,
      commissionRate,
      blockers,
      decision: blockers.length === 0 ? 'BET' : 'NO_BET',
    };
  });

  const approved = opportunities.filter(o => o.decision === 'BET');
  const blocked = opportunities.filter(o => o.decision === 'NO_BET');

  return (
    <Panel
      title="Step 3: Local Exchange Engine — Independent Verification"
      subtitle="The local engine re-calculates EV, applies Kelly staking, and runs safety gates"
      action={<Button variant="ghost" size="sm" onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide Details' : 'Show Details'}</Button>}
    >
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-label text-muted-foreground">Opportunities from AI</div>
            <div className="text-lg font-heading font-bold mt-1">{opportunities.length}</div>
          </div>
          <div className="bg-success/5 rounded-lg p-3 border border-success/20">
            <div className="text-[10px] uppercase tracking-label text-success">Gate Approved</div>
            <div className="text-lg font-heading font-bold mt-1 text-success">{approved.length}</div>
          </div>
          <div className="bg-danger/5 rounded-lg p-3 border border-danger/20">
            <div className="text-[10px] uppercase tracking-label text-danger">Gate Blocked</div>
            <div className="text-lg font-heading font-bold mt-1 text-danger">{blocked.length}</div>
          </div>
          <div className="bg-muted/30 rounded-lg p-3">
            <div className="text-[10px] uppercase tracking-label text-muted-foreground">Best EV</div>
            <div className="text-lg font-heading font-bold mt-1 font-mono text-success">
              ${Math.max(...opportunities.map(o => o.netEV)).toFixed(2)}
            </div>
          </div>
        </div>

        {approved.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-success uppercase tracking-label mb-2 flex items-center gap-1">
              <CheckCircle className="h-3.5 w-3.5" /> Approved by Safety Gates
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Runner</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Odds</TableHead>
                  <TableHead className="text-right">Model</TableHead>
                  <TableHead className="text-right">Implied</TableHead>
                  <TableHead className="text-right">Edge</TableHead>
                  <TableHead className="text-right">Net EV</TableHead>
                  <TableHead className="text-right">Stake</TableHead>
                  <TableHead className="text-right">Liability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approved.map((opp, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{opp.runnerName}</TableCell>
                    <TableCell><SideBadge side={opp.side} /></TableCell>
                    <TableCell className="text-xs">{opp.marketType}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{opp.odds.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{(opp.modelProbability * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs">{(1 / opp.odds * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-xs text-success">+{(opp.edge * 100).toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono text-sm text-success">${opp.netEV.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">${opp.stake.toFixed(0)}</TableCell>
                    <TableCell className="text-right font-mono text-xs">${opp.liability.toFixed(0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {blocked.length > 0 && expanded && (
          <div>
            <div className="text-xs font-semibold text-danger uppercase tracking-label mb-2 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> Blocked by Safety Gates
            </div>
            <div className="space-y-2">
              {blocked.map((opp, i) => (
                <div key={i} className="border border-danger/20 bg-danger/5 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <SideBadge side={opp.side} />
                      <span className="text-sm font-medium">{opp.runnerName}</span>
                      <span className="text-xs text-muted-foreground">{opp.marketType} @ {opp.odds.toFixed(2)}</span>
                    </div>
                    <span className="text-xs font-mono text-danger">EV: ${opp.netEV.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {opp.blockers.map((b, j) => (
                      <span key={j} className="text-[10px] px-1.5 py-0.5 rounded bg-danger/10 text-danger border border-danger/20">{b}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {approved.length > 0 && (
          <div className="bg-success/5 border border-success/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold text-success">Final Decision: BET</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The local engine confirms <strong className="text-foreground">{approved[0].runnerName}</strong> BACK at <strong className="text-foreground font-mono">{approved[0].odds.toFixed(2)}</strong> —
              edge <strong className="text-success font-mono">+{(approved[0].edge * 100).toFixed(1)}%</strong>,
              net EV <strong className="text-success font-mono">${approved[0].netEV.toFixed(2)}</strong>,
              stake <strong className="text-foreground font-mono">${approved[0].stake.toFixed(0)}</strong>.
              Paper order will be created and saved to the database.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

export default function MockFeatherlessRun() {
  const [liveResponse, setLiveResponse] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [calling, setCalling] = useState(false);
  const [elapsed, setElapsed] = useState(null);
  const [useLive, setUseLive] = useState(false);

  const activeResponse = useLive && liveResponse ? liveResponse : MOCK_FEATHERLESS_RESPONSE;

  const handleLiveCall = async () => {
    setCalling(true);
    setLiveError(null);
    setLiveResponse(null);
    const start = Date.now();
    try {
      const resp = await base44.functions.invoke('featherlessAI', {
        racePack: MOCK_RACE_PACK,
        settings: { mode: 'demo', defaultCommissionRate: 0.05, bankroll: 10000, maxStake: 500, maxLayLiability: 1500 },
        strategySettings: {
          modelName: 'deepseek-ai/DeepSeek-V4-Pro',
          temperature: 0.1,
          maxTokens: 4000,
          timeoutSeconds: 120,
          featherlessTimeoutMs: 120000,
        },
      });
      const ms = Date.now() - start;
      setElapsed(ms);
      if (resp.data?.aiResult) {
        setLiveResponse(resp.data.aiResult);
        setUseLive(true);
      } else {
        setLiveError(resp.data?.error || 'No AI result returned');
      }
    } catch (err) {
      setLiveError(err.message || 'Failed to call Featherless AI');
    } finally {
      setCalling(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold font-heading">Featherless AI Run</h1>
            <p className="text-sm text-muted-foreground mt-1">Full end-to-end flow: Race Pack → AI Assessment → Local Engine Verification</p>
          </div>
        </div>
        <div className="flex gap-2">
          {useLive && (
            <Button variant="outline" onClick={() => setUseLive(false)}>
              Show Mock Data
            </Button>
          )}
          <Button onClick={handleLiveCall} disabled={calling}>
            {calling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {calling ? 'Calling Featherless...' : 'Run Live AI'}
          </Button>
        </div>
      </div>

      {/* Status bar */}
      {calling && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-primary animate-spin" />
          <div>
            <div className="text-sm font-semibold text-primary">Calling Featherless AI...</div>
            <div className="text-xs text-muted-foreground">Sending race pack to DeepSeek-V4-Pro — this takes 60-120 seconds for a full 8-runner assessment</div>
          </div>
        </div>
      )}
      {liveError && !calling && (
        <div className="bg-danger/5 border border-danger/20 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-danger" />
          <div>
            <div className="text-sm font-semibold text-danger">AI Call Failed</div>
            <div className="text-xs text-muted-foreground">{liveError}</div>
          </div>
        </div>
      )}
      {liveResponse && !calling && (
        <div className="bg-success/5 border border-success/20 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-success" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-success">Live AI Response Received</div>
            <div className="text-xs text-muted-foreground">
              {(elapsed / 1000).toFixed(1)}s · {liveResponse.runnerProbabilities?.length || 0} runners assessed ·
              Data Quality: {liveResponse.dataQuality}/100 · Confidence: {liveResponse.confidence}/100
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Send className="h-3.5 w-3.5" />
        <span>Race Pack</span>
        <ArrowRight className="h-3 w-3" />
        <Brain className="h-3.5 w-3.5 text-primary" />
        <span>Featherless AI {useLive && liveResponse ? '(LIVE)' : '(mock)'}</span>
        <ArrowRight className="h-3 w-3" />
        <CheckCircle className="h-3.5 w-3.5 text-success" />
        <span>Local Engine</span>
        <ArrowRight className="h-3 w-3" />
        <TrendingUp className="h-3.5 w-3.5 text-success" />
        <span>Paper Order</span>
      </div>

      <RacePackSummary racePack={MOCK_RACE_PACK} />

      <div className="flex justify-center">
        <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
      </div>

      <FeatherlessResponse response={activeResponse} isLive={useLive && !!liveResponse} />

      <div className="flex justify-center">
        <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
      </div>

      <LocalEngineResult response={activeResponse} racePack={MOCK_RACE_PACK} />
    </div>
  );
}