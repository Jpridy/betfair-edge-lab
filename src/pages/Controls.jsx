import React from 'react';
import { Activity, FlaskConical, Link2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ControlActions from '@/components/controls/ControlActions';
import RaceDayPanel from '@/components/controls/RaceDayPanel';
import ManualPaperOrder from '@/components/controls/ManualPaperOrder';
import BetfairConnection from '@/components/settings/BetfairConnection';
import RiskOrdersPanel from '@/components/controlroom/RiskOrdersPanel';
import PaperProofPanel from '@/components/controlroom/PaperProofPanel';

export default function Controls() {
  return <div className="space-y-6">
    <header>
      <p className="text-xs font-semibold uppercase tracking-label text-primary">Operations</p>
      <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight-brand text-foreground">Control Centre</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Connect market data, control the paper-trading bot, and review risk before placing an order.</p>
    </header>

    <Tabs defaultValue="operations" className="space-y-5">
      <TabsList className="grid h-auto w-full grid-cols-1 gap-1 p-1 sm:grid-cols-3">
        <TabsTrigger value="operations" className="h-auto justify-start gap-3 px-4 py-3 text-left">
          <Activity className="h-4 w-4 shrink-0" /><span><span className="block">Operations</span><span className="block text-[10px] font-normal text-muted-foreground">Run, scan and order</span></span>
        </TabsTrigger>
        <TabsTrigger value="connection" className="h-auto justify-start gap-3 px-4 py-3 text-left">
          <Link2 className="h-4 w-4 shrink-0" /><span><span className="block">Connection</span><span className="block text-[10px] font-normal text-muted-foreground">Validate Betfair access</span></span>
        </TabsTrigger>
        <TabsTrigger value="proof" className="h-auto justify-start gap-3 px-4 py-3 text-left">
          <FlaskConical className="h-4 w-4 shrink-0" /><span><span className="block">Paper Proof</span><span className="block text-[10px] font-normal text-muted-foreground">Test the full pipeline</span></span>
        </TabsTrigger>
      </TabsList>
      <TabsContent value="operations" className="space-y-5"><RaceDayPanel /><ControlActions /><ManualPaperOrder /><RiskOrdersPanel /></TabsContent>
      <TabsContent value="connection"><BetfairConnection /></TabsContent>
      <TabsContent value="proof"><PaperProofPanel /></TabsContent>
    </Tabs>
  </div>;
}