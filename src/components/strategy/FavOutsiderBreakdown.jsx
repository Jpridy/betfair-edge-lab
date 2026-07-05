import React from 'react';
import { Panel, PLValue } from '@/components/ui/Trading';

function BreakdownRow({ label, orders, wins, losses, profit }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-xs text-foreground">{label}</span>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground font-mono">{orders} trades</span>
        <span className="text-xs text-muted-foreground font-mono">{wins}W / {losses}L</span>
        <span className="text-xs"><PLValue value={profit} /></span>
      </div>
    </div>
  );
}

export default function FavOutsiderBreakdown({ breakdown }) {
  if (!breakdown) return null;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-chart-5/30 bg-chart-5/5 p-4">
        <div className="text-sm font-bold text-chart-5">⚠ This strategy is currently underperforming and is locked to paper testing only.</div>
        <div className="text-xs text-muted-foreground mt-1">Negative CLV, profit factor below 1.00, and 6-trade losing streak detected. Review breakdown below before any further development.</div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Panel title="Bet Direction Breakdown">
          <div className="p-4">
            <BreakdownRow label="Favourite Back" orders={breakdown.favBack.orders} wins={breakdown.favBack.wins} losses={breakdown.favBack.losses} profit={breakdown.favBack.profit} />
            <BreakdownRow label="Favourite Lay" orders={breakdown.favLay.orders} wins={breakdown.favLay.wins} losses={breakdown.favLay.losses} profit={breakdown.favLay.profit} />
            <BreakdownRow label="Outsider Back" orders={breakdown.outBack.orders} wins={breakdown.outBack.wins} losses={breakdown.outBack.losses} profit={breakdown.outBack.profit} />
            <BreakdownRow label="Outsider Lay" orders={breakdown.outLay.orders} wins={breakdown.outLay.wins} losses={breakdown.outLay.losses} profit={breakdown.outLay.profit} />
          </div>
        </Panel>

        <Panel title="Field Size Breakdown">
          <div className="p-4">
            <BreakdownRow label="2-Runner Markets" orders={breakdown.twoRunner.orders} wins={breakdown.twoRunner.wins} losses={breakdown.twoRunner.losses} profit={breakdown.twoRunner.profit} />
            <BreakdownRow label="3-Runner Markets" orders={breakdown.threeRunner.orders} wins={breakdown.threeRunner.wins} losses={breakdown.threeRunner.losses} profit={breakdown.threeRunner.profit} />
          </div>
        </Panel>

        <Panel title="By Track">
          <div className="p-4">
            {breakdown.byTrack.map((t, i) => (
              <BreakdownRow key={i} label={t.track} orders={t.orders} wins={0} losses={0} profit={t.profit} />
            ))}
          </div>
        </Panel>

        <Panel title="By Day of Week">
          <div className="p-4">
            {breakdown.byDayOfWeek.map((d, i) => (
              <BreakdownRow key={i} label={d.day} orders={d.orders} wins={0} losses={0} profit={d.profit} />
            ))}
          </div>
        </Panel>

        <Panel title="By Hour of Day">
          <div className="p-4">
            {breakdown.byHour.map((h, i) => (
              <BreakdownRow key={i} label={h.hour} orders={h.orders} wins={0} losses={0} profit={h.profit} />
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}