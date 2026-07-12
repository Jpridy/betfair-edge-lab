import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PerformanceAnalytics from '@/pages/PerformanceAnalytics';
import Orders from '@/pages/Orders';
import DecisionLogPanel from '@/components/bot/DecisionLogPanel';
import AccountingSummary from '@/components/accounting/AccountingSummary';
import ValidationStatus from '@/components/validation/ValidationStatus';

export default function Analytics() {
  return <Tabs defaultValue="performance" className="space-y-5">
    <AccountingSummary />
    <ValidationStatus />
    <TabsList><TabsTrigger value="performance">Performance</TabsTrigger><TabsTrigger value="orders">Orders</TabsTrigger><TabsTrigger value="decisions">Decisions</TabsTrigger></TabsList>
    <TabsContent value="performance"><PerformanceAnalytics /></TabsContent>
    <TabsContent value="orders"><Orders /></TabsContent>
    <TabsContent value="decisions"><DecisionLogPanel /></TabsContent>
  </Tabs>;
}