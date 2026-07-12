import React from 'react';
import NextAction from '@/components/shared/NextAction';
import SafetyBanners from '@/components/controlroom/SafetyBanners';
import SimpleControlBar from '@/components/controls/SimpleControlBar';
import CurrentRaceCard from '@/components/dashboard/CurrentRaceCard';
import BotStatusProgress from '@/components/controls/BotStatusProgress';
import BestOpportunityCard from '@/components/controls/BestOpportunityCard';
import CandidateTable from '@/components/controls/CandidateTable';
import OpenPaperOrders from '@/components/controls/OpenPaperOrders';
import CycleDetails from '@/components/controls/CycleDetails';

export default function Controls() {
  return (
    <div className="space-y-4">
      <SafetyBanners />
      <NextAction />
      <SimpleControlBar />
      <CurrentRaceCard />
      <BotStatusProgress />
      <BestOpportunityCard />
      <CandidateTable />
      <OpenPaperOrders />
      <CycleDetails />
    </div>
  );
}