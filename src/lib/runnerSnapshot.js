const marketIdOf = item => String(item?.betfairMarketId || item?.marketId || '');
const selectionIdOf = item => String(item?.betfairSelectionId || item?.selectionId || '');
const hydratedName = name => !!name && !/^Selection\s+\d+$/i.test(name) && !['Unknown','Unknown Runner'].includes(name);

export function buildRunnerSnapshot(runners = [], marketIds = []) {
  const allowed = new Set(marketIds.map(String).filter(Boolean));
  const seen = new Set();
  return runners.flatMap(runner => {
    const marketId = marketIdOf(runner);
    const selectionId = selectionIdOf(runner);
    const key = `${marketId}|${selectionId}`;
    if (!marketId || !selectionId || seen.has(key) || (allowed.size && !allowed.has(marketId))) return [];
    seen.add(key);
    const isHydrated = hydratedName(runner.runnerName);
    return [{
      marketId, selectionId, runnerName:runner.runnerName || `Selection ${selectionId}`,
      status:runner.status || 'ACTIVE', bestBackPrice:runner.bestBackPrice ?? null,
      bestBackSize:runner.bestBackSize ?? null, bestLayPrice:runner.bestLayPrice ?? null,
      bestLaySize:runner.bestLaySize ?? null, lastPriceTraded:runner.lastPriceTraded ?? runner.lastTradedPrice ?? null,
      totalMatched:runner.totalMatched ?? runner.tradedVolumeAmount ?? null,
      runnerNameHydrated:runner.runnerNameHydrated ?? isHydrated,
      runnerNameHydrationSource:runner.runnerNameHydrationSource || (isHydrated ? 'betfair_catalogue' : 'missing_catalogue_name'),
    }];
  });
}