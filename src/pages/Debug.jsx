import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DebugSystem from '@/components/debug/DebugSystem';
import DebugLiveData from '@/components/debug/DebugLiveData';
import DebugCalculations from '@/components/debug/DebugCalculations';
import DebugAccounting from '@/components/debug/DebugAccounting';
import DebugSettlement from '@/components/debug/DebugSettlement';
import EffectiveSettingsTable from '@/components/settings/EffectiveSettingsTable';
import SelectedRaceMonitoring from '@/components/controlroom/SelectedRaceMonitoring';
import DebugPackageExport from '@/components/debug/DebugPackageExport';
import CalibrationDiagnostics from '@/components/calibration/CalibrationDiagnostics';
import useCalibrationManager from '@/hooks/useCalibrationManager';
import { Panel } from '@/components/ui/workstation';

function DebugRaceIdentity() {
  return <SelectedRaceMonitoring />;
}

function DebugSettingsLinkage() {
  return <Panel title="Settings Linkage" subtitle="Stored vs effective values and engine consumers"><EffectiveSettingsTable /></Panel>;
}

function DebugCalibration() {
  const manager = useCalibrationManager();
  return <CalibrationDiagnostics manager={manager} />;
}

export default function Debug() {
  return (
    <Tabs defaultValue="system" className="space-y-4">
      <TabsList className="flex-wrap h-auto">
        <TabsTrigger value="system">System</TabsTrigger>
        <TabsTrigger value="linkage">Settings Linkage</TabsTrigger>
        <TabsTrigger value="race">Race Identity</TabsTrigger>
        <TabsTrigger value="data">Live Data</TabsTrigger>
        <TabsTrigger value="calculations">Calculations</TabsTrigger>
        <TabsTrigger value="accounting">Accounting</TabsTrigger>
        <TabsTrigger value="settlement">Settlement</TabsTrigger>
        <TabsTrigger value="calibration">Calibration</TabsTrigger>
        <TabsTrigger value="export">Export</TabsTrigger>
      </TabsList>
      <TabsContent value="system"><DebugSystem /></TabsContent>
      <TabsContent value="linkage"><DebugSettingsLinkage /></TabsContent>
      <TabsContent value="race"><DebugRaceIdentity /></TabsContent>
      <TabsContent value="data"><DebugLiveData /></TabsContent>
      <TabsContent value="calculations"><DebugCalculations /></TabsContent>
      <TabsContent value="accounting"><DebugAccounting /></TabsContent>
      <TabsContent value="settlement"><DebugSettlement /></TabsContent>
      <TabsContent value="calibration"><DebugCalibration /></TabsContent>
      <TabsContent value="export"><DebugPackageExport /></TabsContent>
    </Tabs>
  );
}