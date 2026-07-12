import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AnalyticsOverview from '@/components/analytics/AnalyticsOverview';
import PerformanceAnalytics from '@/pages/PerformanceAnalytics';
import CalibrationTab from '@/components/analytics/CalibrationTab';
import SelfCalibrationPanel from '@/components/calibration/SelfCalibrationPanel';
import ValidationResearchPanel from '@/components/validation/ValidationResearchPanel';
import Orders from '@/pages/Orders';

export default function Analytics() {
  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="calibration">Calibration</TabsTrigger>
        <TabsTrigger value="self-calibration">Self-Calibration</TabsTrigger>
        <TabsTrigger value="replay">Replay & Research</TabsTrigger>
        <TabsTrigger value="orders">Orders</TabsTrigger>
      </TabsList>
      <TabsContent value="overview"><AnalyticsOverview /></TabsContent>
      <TabsContent value="performance"><PerformanceAnalytics /></TabsContent>
      <TabsContent value="calibration"><CalibrationTab /></TabsContent>
      <TabsContent value="self-calibration"><SelfCalibrationPanel /></TabsContent>
      <TabsContent value="replay"><ValidationResearchPanel /></TabsContent>
      <TabsContent value="orders"><Orders /></TabsContent>
    </Tabs>
  );
}