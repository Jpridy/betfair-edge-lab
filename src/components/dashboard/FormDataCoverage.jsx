import React, { useMemo } from 'react';
import { Panel } from '@/components/ui/Trading';
import { useApp } from '@/lib/AppContext';
import { Database, User, Users, FileText, Star, Grid3x3, BarChart3 } from 'lucide-react';

export default function FormDataCoverage() {
  const { markets, runners } = useApp();

  const coverage = useMemo(() => {
    const totalMarkets = markets.length;
    const activeRunners = runners.filter(r => r.status === 'ACTIVE');

    let marketOnly = 0;
    let partialMetadata = 0;
    let fullExternalForm = 0;
    let withJockey = 0;
    let withTrainer = 0;
    let withRecentForm = 0;
    let withOfficialRating = 0;
    let withStallDraw = 0;

    for (const r of activeRunners) {
      const status = r.formDataStatus || 'MARKET_ONLY';
      if (status === 'MARKET_ONLY') marketOnly++;
      else if (status === 'PARTIAL_BETFAIR_METADATA') partialMetadata++;
      else if (status === 'FULL_EXTERNAL_FORM') fullExternalForm++;

      if (r.raceFormProfile?.jockeyName) withJockey++;
      if (r.raceFormProfile?.trainerName) withTrainer++;
      if (r.raceFormProfile?.recentForm) withRecentForm++;
      if (r.raceFormProfile?.officialRating != null) withOfficialRating++;
      if (r.raceFormProfile?.stallDraw != null) withStallDraw++;
    }

    const total = activeRunners.length;
    const marketOnlyPct = total > 0 ? Math.round((marketOnly / total) * 100) : 0;

    return {
      totalMarkets,
      totalRunners: total,
      marketOnly,
      partialMetadata,
      fullExternalForm,
      withJockey,
      withTrainer,
      withRecentForm,
      withOfficialRating,
      withStallDraw,
      marketOnlyPct,
    };
  }, [markets, runners]);

  const stats = [
    { label: 'Markets Scanned', value: coverage.totalMarkets, icon: Database },
    { label: 'Runners with Metadata', value: coverage.partialMetadata + coverage.fullExternalForm, icon: Grid3x3 },
    { label: 'With Jockey Name', value: coverage.withJockey, icon: User },
    { label: 'With Trainer Name', value: coverage.withTrainer, icon: Users },
    { label: 'With Recent Form', value: coverage.withRecentForm, icon: FileText },
    { label: 'With Official Rating', value: coverage.withOfficialRating, icon: Star },
    { label: 'With Stall Draw', value: coverage.withStallDraw, icon: Grid3x3 },
    { label: 'Full External Form', value: coverage.fullExternalForm, icon: BarChart3 },
  ];

  return (
    <Panel title="Form Data Coverage" action={
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
        coverage.marketOnlyPct === 100
          ? 'bg-chart-4/10 text-chart-4 border-chart-4/30'
          : coverage.marketOnlyPct > 80
            ? 'bg-chart-4/10 text-chart-4 border-chart-4/30'
            : 'bg-chart-1/10 text-chart-1 border-chart-1/30'
      }`}>
        {coverage.marketOnlyPct}% Market Only
      </span>
    }>
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {stats.map((stat, i) => (
            <div key={i} className="bg-muted/30 border border-border rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</span>
                <stat.icon className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="text-lg font-bold font-mono text-foreground">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Data Source Breakdown */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Data Source Breakdown</div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden flex">
              <div className="bg-chart-4/60 h-full flex items-center justify-center text-[9px] font-bold"
                   style={{ width: `${coverage.totalRunners > 0 ? (coverage.marketOnly / coverage.totalRunners) * 100 : 0}%` }}>
                {coverage.marketOnly > 0 && `${coverage.marketOnly}`}
              </div>
              <div className="bg-chart-3/60 h-full flex items-center justify-center text-[9px] font-bold"
                   style={{ width: `${coverage.totalRunners > 0 ? (coverage.partialMetadata / coverage.totalRunners) * 100 : 0}%` }}>
                {coverage.partialMetadata > 0 && `${coverage.partialMetadata}`}
              </div>
              <div className="bg-chart-1/60 h-full flex items-center justify-center text-[9px] font-bold"
                   style={{ width: `${coverage.totalRunners > 0 ? (coverage.fullExternalForm / coverage.totalRunners) * 100 : 0}%` }}>
                {coverage.fullExternalForm > 0 && `${coverage.fullExternalForm}`}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-4/60"></span> Market Only</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-3/60"></span> Betfair Metadata</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-chart-1/60"></span> Full Form</span>
          </div>
        </div>

        {coverage.marketOnlyPct === 100 && coverage.totalRunners > 0 && (
          <div className="mt-3 text-[10px] text-chart-4 bg-chart-4/10 border border-chart-4/30 rounded p-2">
            All runners are using market-only analysis. No Betfair runner metadata or external form data is available.
            Probability estimates are derived from Betfair exchange prices, volume, and order book microstructure — not horse racing form.
          </div>
        )}
      </div>
    </Panel>
  );
}