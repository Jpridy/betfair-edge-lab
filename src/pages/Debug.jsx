import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SetupWizard from '@/pages/SetupWizard';
import WiringAudit from '@/pages/WiringAudit';
import LogsAudit from '@/pages/LogsAudit';
import RunnerView from '@/pages/RunnerView';
import MockFeatherlessRun from '@/pages/MockFeatherlessRun';

export default function Debug() {
  return <Tabs defaultValue="health" className="space-y-5">
    <TabsList className="flex-wrap h-auto"><TabsTrigger value="health">System Tests</TabsTrigger><TabsTrigger value="wiring">Wiring</TabsTrigger><TabsTrigger value="logs">Logs</TabsTrigger><TabsTrigger value="market">Market Data</TabsTrigger><TabsTrigger value="ai">AI Test</TabsTrigger></TabsList>
    <TabsContent value="health"><SetupWizard /></TabsContent>
    <TabsContent value="wiring"><WiringAudit /></TabsContent>
    <TabsContent value="logs"><LogsAudit /></TabsContent>
    <TabsContent value="market"><RunnerView /></TabsContent>
    <TabsContent value="ai"><MockFeatherlessRun /></TabsContent>
  </Tabs>;
}