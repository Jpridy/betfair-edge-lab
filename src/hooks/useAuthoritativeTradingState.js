import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/AppContext';
import { calculatePriceFeedStatus } from '@/lib/marketFreshness';

const TICK_MS = 1000;

export default function useAuthoritativeTradingState() {
  const app = useApp();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return useMemo(() => {
    const lastActualPriceUpdateAt = app.betfairConnection?.lastActualPriceUpdateAt || null;
    const freshnessLimit = app.effectiveSettings?.appSettings?.dataFreshnessLimit ?? 30;
    const feed = calculatePriceFeedStatus(
      lastActualPriceUpdateAt,
      now,
      freshnessLimit,
      Boolean(app.betfairConnection?.streamError),
    );

    const hasMarkets = app.markets.length > 0;
    const streamStatus = app.betfairConnection?.streamConnectionStatus ?? 'UNAVAILABLE';
    const dataSource = feed.priceFeedStatus === 'LIVE'
      ? 'LIVE'
      : feed.priceFeedStatus === 'STALE'
        ? 'STALE'
        : hasMarkets
          ? 'CACHED'
          : 'UNAVAILABLE';

    return Object.freeze({
      apiConnectionStatus: app.apiConnected ? 'CONNECTED' : 'DISCONNECTED',
      streamConnectionStatus: streamStatus,
      catalogueStatus: app.betfairConnection?.catalogueMarketsCount > 0 ? 'AVAILABLE' : 'UNAVAILABLE',
      priceFeedStatus: feed.priceFeedStatus,
      lastActualPriceUpdateAt: feed.authoritativePriceTimestamp,
      priceAgeSeconds: feed.priceAgeSeconds,
      staleThresholdSeconds: feed.staleThresholdSeconds,
      currentRace: app.lastExchangeDiagnostics?.raceMonitoring ?? null,
      currentMarkets: app.markets,
      currentRunners: app.runners,
      currentOpportunities: app.exchangeOpportunities,
      currentOrders: app.paperOrders,
      accounting: app.accounting,
      effectiveSettings: app.effectiveSettings,
      dataSource,
      dataVersion: lastActualPriceUpdateAt ?? app.betfairConnection?.lastCatalogueRefreshAt ?? null,
      generatedAt: new Date(now).toISOString(),
    });
  }, [
    app.apiConnected,
    app.betfairConnection,
    app.markets,
    app.runners,
    app.exchangeOpportunities,
    app.paperOrders,
    app.accounting,
    app.effectiveSettings,
    app.lastExchangeDiagnostics,
    now,
  ]);
}
