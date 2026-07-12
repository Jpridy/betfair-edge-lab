import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SetupWizard from '@/pages/SetupWizard';
import WiringAudit from '@/pages/WiringAudit';
import LogsAudit from '@/pages/LogsAudit';
import RunnerView from '@/pages/RunnerView';
import MockFeatherlessRun from '@/pages/MockFeatherlessRun';
import BetfairDataDiagnostics from '@/components/bot/BetfairDataDiagnostics';
import DebugPackageExport from '@/components/debug/DebugPackageExport';
import AccountingSummary from '@/components/accounting/AccountingSummary';

export default function Debug() {
  return <Tabs defaultValue="health" className="space-y-5">
    <AccountingSummary />
    <DebugPackageExport />
    <TabsList className="flex-wrap h-auto"><TabsTrigger value="health">System Tests</TabsTrigger><TabsTrigger value="wiring">Wiring</TabsTrigger><TabsTrigger value="logs">Logs</TabsTrigger><TabsTrigger value="market">Market Data</TabsTrigger><TabsTrigger value="ai">AI Test</TabsTrigger></TabsList>
    <TabsContent value="health"><SetupWizard /></TabsContent>
    <TabsContent value="wiring"><WiringAudit /></TabsContent>
    <TabsContent value="logs"><LogsAudit /></TabsContent>
    <TabsContent value="market"><div className="space-y-5"><BetfairDataDiagnostics /><RunnerView /></div></TabsContent>
    <TabsContent value="ai"><MockFeatherlessRun /></TabsContent>
  </Tabs>;
}