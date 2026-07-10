import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ControlActions from '@/components/controls/ControlActions';
import ManualPaperOrder from '@/components/controls/ManualPaperOrder';
import BetfairConnection from '@/components/settings/BetfairConnection';
import RiskOrdersPanel from '@/components/controlroom/RiskOrdersPanel';
import PaperProofPanel from '@/components/controlroom/PaperProofPanel';

export default function Controls() {
  return <Tabs defaultValue="operations" className="space-y-5">
    <TabsList><TabsTrigger value="operations">Operations</TabsTrigger><TabsTrigger value="connection">Connection</TabsTrigger><TabsTrigger value="proof">Paper Proof</TabsTrigger></TabsList>
    <TabsContent value="operations" className="space-y-5"><ControlActions /><ManualPaperOrder /><RiskOrdersPanel /></TabsContent>
    <TabsContent value="connection"><BetfairConnection /></TabsContent>
    <TabsContent value="proof"><PaperProofPanel /></TabsContent>
  </Tabs>;
}