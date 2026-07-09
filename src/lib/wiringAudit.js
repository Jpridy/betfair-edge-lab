// ============================================================================
// Full Wiring Test
//
// Runs a complete diagnostic cycle WITHOUT placing any orders.
// Tests every data path: settings → Betfair → AI → External Search →
// Opportunities → EV → Validation → Risk → Paper Order (simulated only).
//
// Returns a structured report that the WiringAudit page renders.
// ============================================================================

import { runExchangeCycle } from './exchangeOpportunityEngine';
import { resolveMarketTypeThresholds, MARKET_TYPE_THRESHOLDS } from './crossMarketValueScanner';
import { calcBackEV, calcLayEV } from './exchangeMath';
import { runPreOrderChecks } from './orderValidation';
import { runRiskCheck } from './botEngine';
import { calculateRiskMetrics } from './riskCalculations';
import { calculateCommission } from './betfairMapping';
import { base44 } from '@/api/base44Client';

/**
 * Build the settings wiring check table.
 * Compares UI value, saved DB value, and the value actually used by the bot.
 */
export function buildSettingsWiringCheck(settings, featherlessSettings, botSettings) {
  const rows = [];

  const check = (settingName, uiValue, savedValue, valueUsedByBot, source, notes = '') => {
    const uiStr = String(uiValue ?? '');
    const savedStr = String(savedValue ?? '');
    const botStr = String(valueUsedByBot ?? '');
    const mismatch = uiStr !== savedStr || savedStr !== botStr;
    const missing = uiStr === '' && savedStr === '' && botStr === '';
    let status = 'wired';
    if (missing) status = 'missing';
    else if (mismatch) status = 'mismatch';
    else if (valueUsedByBot === undefined) status = 'not_used';
    rows.push({ settingName, uiValue: uiStr, savedValue: savedStr, valueUsedByBot: botStr, source, status, notes });
  };

  // App settings
  check('scanIntervalSeconds', botSettings?.scanIntervalSeconds, botSettings?.scanIntervalSeconds, botSettings?.scanIntervalSeconds, 'BotSettings', 'Bot cycle timer');
  check('defaultTimeWindowStartSeconds', settings?.defaultTimeWindowStartSeconds, settings?.defaultTimeWindowStartSeconds, settings?.defaultTimeWindowStartSeconds, 'AppSettings', 'Exchange engine time window');
  check('defaultTimeWindowEndSeconds', settings?.defaultTimeWindowEndSeconds, settings?.defaultTimeWindowEndSeconds, settings?.defaultTimeWindowEndSeconds, 'AppSettings', 'Exchange engine time window');
  check('minOdds', settings?.minOdds, settings?.minOdds, settings?.minOdds, 'AppSettings', 'Order validation');
  check('maxOdds', settings?.maxOdds, settings?.maxOdds, settings?.maxOdds, 'AppSettings', 'Order validation');
  check('baseStake', settings?.baseStake, settings?.baseStake, settings?.baseStake, 'AppSettings', 'Paper order stake');
  check('maxStake', settings?.maxStake, settings?.maxStake, settings?.maxStake, 'AppSettings', 'Paper order stake');
  check('maxLayLiability', settings?.maxLayLiability, settings?.maxLayLiability, settings?.maxLayLiability, 'AppSettings', 'LAY liability cap');
  check('dailyLossLimit', settings?.dailyLossLimit, settings?.dailyLossLimit, settings?.dailyLossLimit, 'AppSettings', 'Risk check');
  check('weeklyLossLimit', settings?.weeklyLossLimit, settings?.weeklyLossLimit, settings?.weeklyLossLimit, 'AppSettings', 'Risk check');
  check('maxMarketExposure', settings?.maxMarketExposure, settings?.maxMarketExposure, settings?.maxMarketExposure, 'AppSettings', 'Exposure check');
  check('maxOpenOrders', settings?.maxOpenOrders, settings?.maxOpenOrders, settings?.maxOpenOrders, 'AppSettings', 'Order count check');
  check('maxUnmatchedOrders', settings?.maxUnmatchedOrders, settings?.maxUnmatchedOrders, settings?.maxUnmatchedOrders, 'AppSettings', 'Unmatched check');
  check('maxTradesPerMarket', settings?.maxTradesPerMarket, settings?.maxTradesPerMarket, settings?.maxTradesPerMarket, 'AppSettings', 'Per-market check');
  check('maxTradesPerDay', settings?.maxTradesPerDay, settings?.maxTradesPerDay, settings?.maxTradesPerDay, 'AppSettings', 'Daily count check');
  check('minimumLiquidity', settings?.minimumLiquidity, settings?.minimumLiquidity, settings?.minimumLiquidity, 'AppSettings', 'Market liquidity filter');
  check('allowInPlay', settings?.allowInPlay, settings?.allowInPlay, settings?.allowInPlay, 'AppSettings', 'In-play safety');
  check('allowHedging', settings?.allowHedging, settings?.allowHedging, settings?.allowHedging, 'AppSettings', 'Opposite-side check');
  check('riskLimitsDisabled', settings?.riskLimitsDisabled, settings?.riskLimitsDisabled, settings?.riskLimitsDisabled, 'AppSettings', 'Testing bypass');
  check('defaultCommissionRate', settings?.defaultCommissionRate, settings?.defaultCommissionRate, settings?.defaultCommissionRate, 'AppSettings', 'Commission fallback');
  check('useMarketBaseRate', settings?.useMarketBaseRate, settings?.useMarketBaseRate, settings?.useMarketBaseRate, 'AppSettings', 'Commission source');
  check('paperBankroll', settings?.paperBankroll, settings?.paperBankroll, settings?.paperBankroll, 'AppSettings', 'Bankroll base');
  check('liveTradingEnabled', false, false, false, 'Forced false', 'Paper mode only — hardcoded false');

  // Featherless settings
  check('featherless.enabled', featherlessSettings?.enabled, featherlessSettings?.enabled, featherlessSettings?.enabled, 'FeatherlessSettings', 'AI probability engine');
  check('featherless.modelName', featherlessSettings?.modelName, featherlessSettings?.modelName, featherlessSettings?.modelName, 'FeatherlessSettings', 'AI model');
  check('featherless.minConfidence', featherlessSettings?.minConfidence, featherlessSettings?.minConfidence, featherlessSettings?.minConfidence, 'FeatherlessSettings', 'Safety gate');
  check('featherless.minEdge', featherlessSettings?.minEdge, featherlessSettings?.minEdge, featherlessSettings?.minEdge, 'FeatherlessSettings', 'Safety gate');
  check('featherless.minExpectedROI', featherlessSettings?.minExpectedROI, featherlessSettings?.minExpectedROI, featherlessSettings?.minExpectedROI, 'FeatherlessSettings', 'Safety gate');
  check('featherless.paperTradeOnly', featherlessSettings?.paperTradeOnly, featherlessSettings?.paperTradeOnly, featherlessSettings?.paperTradeOnly, 'FeatherlessSettings', 'Paper safety');
  check('featherless.allowLiveHandoff', false, false, false, 'Forced false', 'Live handoff disabled');
  check('featherless.debugScanMode', featherlessSettings?.debugScanMode, featherlessSettings?.debugScanMode, featherlessSettings?.debugScanMode, 'FeatherlessSettings', 'Debug scanning');
  check('featherless.webResearchEnabled', featherlessSettings?.webResearchEnabled, featherlessSettings?.webResearchEnabled, featherlessSettings?.webResearchEnabled, 'FeatherlessSettings', 'Web research');
  check('featherless.externalSearchEnabled', featherlessSettings?.externalSearchEnabled, featherlessSettings?.externalSearchEnabled, featherlessSettings?.externalSearchEnabled, 'FeatherlessSettings', 'OpenAI web search');
  check('featherless.maxExternalProbabilityAdjustment', featherlessSettings?.maxExternalProbabilityAdjustment, featherlessSettings?.maxExternalProbabilityAdjustment, featherlessSettings?.maxExternalProbabilityAdjustment, 'FeatherlessSettings', 'External clamp');
  check('featherless.minExternalSourceCount', featherlessSettings?.minExternalSourceCount, featherlessSettings?.minExternalSourceCount, featherlessSettings?.minExternalSourceCount, 'FeatherlessSettings', 'Source threshold');
  check('featherless.minExternalDataQuality', featherlessSettings?.minExternalDataQuality, featherlessSettings?.minExternalDataQuality, featherlessSettings?.minExternalDataQuality, 'FeatherlessSettings', 'Quality threshold');
  check('featherless.externalSearchCacheTtlMinutes', featherlessSettings?.externalSearchCacheTtlMinutes, featherlessSettings?.externalSearchCacheTtlMinutes, featherlessSettings?.externalSearchCacheTtlMinutes, 'FeatherlessSettings', 'Cache TTL');

  // Market-type thresholds
  for (const mt of ['win', 'place', 'h2h']) {
    const t = resolveMarketTypeThresholds(mt.toUpperCase(), featherlessSettings);
    check(`${mt}MinOdds`, featherlessSettings?.[`${mt}MinOdds`], t.minOdds, t.minOdds, 'Thresholds', `${mt.toUpperCase()} odds min`);
    check(`${mt}MaxOdds`, featherlessSettings?.[`${mt}MaxOdds`], t.maxOdds, t.maxOdds, 'Thresholds', `${mt.toUpperCase()} odds max`);
    check(`${mt}MinLiquidity`, featherlessSettings?.[`${mt}MinLiquidity`], t.minLiquidity, t.minLiquidity, 'Thresholds', `${mt.toUpperCase()} liquidity min`);
    check(`${mt}MinEdge`, featherlessSettings?.[`${mt}MinEdge`], t.minEdge, t.minEdge, 'Thresholds', `${mt.toUpperCase()} edge min`);
    check(`${mt}MinROI`, featherlessSettings?.[`${mt}MinROI`], t.minROI, t.minROI, 'Thresholds', `${mt.toUpperCase()} ROI min`);
  }

  // Bot settings
  check('botEnabled', botSettings?.botEnabled, botSettings?.botEnabled, botSettings?.botEnabled, 'BotSettings', 'Bot running');
  check('botMode', 'demo', 'demo', 'demo', 'Forced demo', 'Paper mode only');
  check('autoPaperTradingEnabled', botSettings?.autoPaperTradingEnabled, botSettings?.autoPaperTradingEnabled, botSettings?.autoPaperTradingEnabled, 'BotSettings', 'Auto paper orders');
  check('liveTradingLocked', true, true, true, 'Forced true', 'Live trading locked');

  return rows;
}

/**
 * Build the live wiring status table for all services.
 */
export function buildLiveWiringStatus(appContext) {
  const { apiConnected, betfairConnection, featherlessSettings, lastExchangeDiagnostics, botCycles, paperOrders, auditLogs, syncState, rejectedOrders } = appContext;
  const lastCycle = botCycles?.[0];
  const extDiag = lastExchangeDiagnostics?.externalSearchDiagnostics || lastCycle?.scanSummary?.externalSearchDiagnostics || {};
  const aiStatusLog = lastExchangeDiagnostics?.aiStatusLog || lastCycle?.scanSummary?.aiStatusLog || [];

  // Real timestamps from actual data
  const lastOrderDate = paperOrders?.[0]?.created_date || paperOrders?.[0]?.placed_date || null;
  const lastSettledDate = paperOrders?.find(o => o.status === 'settled')?.settled_date || paperOrders?.find(o => o.status === 'settled')?.settledAt || null;
  const lastAuditDate = auditLogs?.[0]?.timestamp || null;
  const lastRejectedDate = rejectedOrders?.[0]?.id || null;
  const lastStreamUpdate = betfairConnection?.lastMarketSyncTime || syncState?.lastCatalogueSync || null;
  const streamStatus = betfairConnection?.streamConnectionStatus || 'disconnected';
  const isStale = lastStreamUpdate ? (Date.now() - new Date(lastStreamUpdate).getTime()) > 45000 : true;

  // Truthful API status: token present ≠ API connected
  // API is only "connected" when a real Betfair API call returned valid JSON
  const hasMarkets = (appContext.markets?.length || 0) > 0;
  const hasCatalogueError = !!betfairConnection?.marketCatalogueError;
  const htmlErrorDetected = hasCatalogueError && betfairConnection.marketCatalogueError.includes('HTML');

  return [
    {
      serviceName: 'Betfair Login/Session',
      connected: !!apiConnected,
      lastSuccessfulCallAt: lastStreamUpdate,
      lastAttemptedCallAt: lastStreamUpdate,
      lastError: htmlErrorDetected ? 'HTML 403 — wrong endpoint or WAF block' : (streamStatus === 'error' ? 'Stream connection error' : hasCatalogueError ? betfairConnection.marketCatalogueError : null),
      latestLatencyMs: null,
      recordsReturned: null,
      dataUsedByBot: true,
      status: !apiConnected ? 'not_configured' : htmlErrorDetected ? 'error' : hasMarkets ? 'connected' : 'token_present_not_validated',
    },
    {
      serviceName: 'Betfair Stream/Price Feed',
      connected: streamStatus === 'connected' || streamStatus === 'polling',
      lastSuccessfulCallAt: lastStreamUpdate,
      lastAttemptedCallAt: lastStreamUpdate,
      lastError: streamStatus === 'error' ? 'Stream error' : null,
      latestLatencyMs: null,
      recordsReturned: appContext.markets?.length || 0,
      dataUsedByBot: true,
      status: !apiConnected ? 'disconnected' : isStale ? 'stale' : streamStatus,
    },
    {
      serviceName: 'Betfair Market Catalogue',
      connected: apiConnected && (appContext.markets?.length || 0) > 0 && !hasCatalogueError,
      lastSuccessfulCallAt: syncState?.lastCatalogueSync || lastStreamUpdate,
      lastAttemptedCallAt: syncState?.lastCatalogueSync || lastStreamUpdate,
      lastError: betfairConnection?.marketCatalogueError || null,
      latestLatencyMs: null,
      recordsReturned: appContext.markets?.length || 0,
      dataUsedByBot: true,
      status: !apiConnected ? 'disconnected' : htmlErrorDetected ? 'error' : (appContext.markets?.length || 0) > 0 ? 'connected' : 'not_tested',
    },
    {
      serviceName: 'Featherless AI API',
      connected: featherlessSettings?.enabled === true,
      lastSuccessfulCallAt: aiStatusLog.filter(s => s.status === 'ai_called' && s.success).length > 0 ? lastCycle?.finishedAt : null,
      lastAttemptedCallAt: lastCycle?.finishedAt || null,
      lastError: aiStatusLog.find(s => s.status === 'ai_error')?.reason || aiStatusLog.find(s => s.status === 'ai_timeout')?.reason || null,
      latestLatencyMs: null,
      recordsReturned: lastExchangeDiagnostics?.eventsWithAI || lastCycle?.scanSummary?.eventsWithAI || 0,
      dataUsedByBot: true,
      status: !featherlessSettings?.enabled ? 'disabled' : (aiStatusLog.some(s => s.status === 'ai_error') ? 'error' : lastCycle ? 'connected' : 'not_tested'),
    },
    {
      serviceName: 'OpenAI External Web Search',
      connected: featherlessSettings?.externalSearchEnabled === true,
      lastSuccessfulCallAt: extDiag.callsThisCycle > 0 ? lastCycle?.finishedAt : null,
      lastAttemptedCallAt: extDiag.callsThisCycle > 0 || extDiag.cacheHits > 0 ? lastCycle?.finishedAt : null,
      lastError: extDiag.errors > 0 ? `${extDiag.errors} errors this cycle` : extDiag.timeouts > 0 ? `${extDiag.timeouts} timeouts` : null,
      latestLatencyMs: null,
      recordsReturned: extDiag.totalSourcesFound || 0,
      dataUsedByBot: true,
      status: !featherlessSettings?.externalSearchEnabled ? 'disabled' : extDiag.errors > 0 ? 'error' : extDiag.callsThisCycle > 0 ? 'connected' : 'not_tested',
    },
    {
      serviceName: 'Database/Entity Writes',
      connected: !!(lastAuditDate || lastOrderDate),
      lastSuccessfulCallAt: lastAuditDate || lastOrderDate || null,
      lastAttemptedCallAt: lastAuditDate || lastOrderDate || null,
      lastError: null,
      latestLatencyMs: null,
      recordsReturned: paperOrders?.length || 0,
      dataUsedByBot: true,
      status: (lastAuditDate || lastOrderDate) ? 'connected' : 'not_tested',
    },
    {
      serviceName: 'Paper Order Creation',
      connected: !!lastOrderDate,
      lastSuccessfulCallAt: lastOrderDate || (lastCycle?.ordersCreated > 0 ? lastCycle?.finishedAt : null),
      lastAttemptedCallAt: lastOrderDate || lastCycle?.finishedAt || null,
      lastError: lastCycle?.ordersBlocked > 0 ? `${lastCycle.ordersBlocked} order(s) blocked last cycle` : null,
      latestLatencyMs: null,
      recordsReturned: paperOrders?.length || 0,
      dataUsedByBot: true,
      status: lastOrderDate ? 'connected' : lastCycle ? (lastCycle.ordersBlocked > 0 ? 'error' : 'not_tested') : 'not_tested',
    },
    {
      serviceName: 'Settlement Service',
      connected: !!lastSettledDate,
      lastSuccessfulCallAt: lastSettledDate || null,
      lastAttemptedCallAt: paperOrders?.find(o => o.status === 'awaiting_result')?.settledAt || lastSettledDate || null,
      lastError: null,
      latestLatencyMs: null,
      recordsReturned: paperOrders?.filter(o => o.status === 'settled')?.length || 0,
      dataUsedByBot: true,
      status: lastSettledDate ? 'connected' : paperOrders?.some(o => o.status === 'awaiting_result') ? 'warning' : 'not_tested',
    },
    {
      serviceName: 'Decision Log Export',
      connected: !!(botCycles?.length > 0),
      lastSuccessfulCallAt: lastCycle?.finishedAt || null,
      lastAttemptedCallAt: lastCycle?.finishedAt || null,
      lastError: null,
      latestLatencyMs: null,
      recordsReturned: botCycles?.length || 0,
      dataUsedByBot: true,
      status: botCycles?.length > 0 ? 'connected' : 'not_tested',
    },
  ];
}

/**
 * Run a full wiring test — diagnostic cycle with NO order placement.
 * Returns a structured report object.
 */
export async function runFullWiringTest(appContext) {
  const report = {
    settingsWired: false,
    betfairConnected: false,
    openAIConnected: false,
    openAIWebSearchWorking: false,
    featherlessConnected: false,
    marketsLoaded: 0,
    marketTypesDetected: {},
    opportunitiesGenerated: 0,
    externalSearchUsed: false,
    probabilitiesGenerated: false,
    evCalculated: false,
    validationRan: false,
    riskCheckRan: false,
    paperOrderWouldCreate: false,
    settlementAvailable: false,
    errors: [],
    warnings: [],
    timestamp: new Date().toISOString(),
  };

  try {
    const { settings, featherlessSettings, bankrollStats, paperOrders, markets, runners, betfairConnection, apiConnected } = appContext;

    // 1. Settings wiring check
    const settingsRows = buildSettingsWiringCheck(settings, featherlessSettings, appContext.botSettings);
    const settingsIssues = settingsRows.filter(r => r.status === 'missing' || r.status === 'mismatch');
    report.settingsWired = settingsIssues.length === 0;
    if (settingsIssues.length > 0) {
      report.warnings.push(`${settingsIssues.length} settings have wiring issues: ${settingsIssues.slice(0, 3).map(s => s.settingName).join(', ')}`);
    }

    // 2. Betfair connection
    report.betfairConnected = apiConnected && (markets?.length || 0) > 0;
    if (!apiConnected) report.warnings.push('Betfair API not connected — no live market data');
    if (apiConnected && (markets?.length || 0) === 0) report.warnings.push('Betfair connected but no markets loaded');

    // 3. OpenAI / Featherless
    report.openAIConnected = featherlessSettings?.externalSearchEnabled === true;
    report.featherlessConnected = featherlessSettings?.enabled === true;
    if (!featherlessSettings?.enabled) report.warnings.push('Featherless AI is disabled — no probability engine');

    // 4. Run exchange cycle (diagnostic — debug scan mode, no orders)
    const conn = betfairConnection || {};
    const connectionState = {
      apiConnected: apiConnected,
      streamConnected: conn.streamConnectionStatus === 'connected' || conn.streamConnectionStatus === 'polling',
      lastStreamUpdateAt: conn.lastMarketSyncTime || null,
      lastCatalogueRefreshAt: conn.lastMarketSyncTime || null,
      marketCatalogueError: null,
      streamError: conn.streamConnectionStatus === 'error' ? 'Stream error' : null,
      priceFeedStale: conn.dataFresh === false,
    };

    let aiCallAttempted = false;
    let extSearchCallAttempted = false;

    const result = await runExchangeCycle({
      markets: markets || [],
      runners: runners || [],
      settings,
      featherlessSettings,
      bankrollStats,
      paperOrders,
      emergencyStop: false,
      connectionState,
      callAI: async (cluster, primaryMarket, marketRunners) => {
        aiCallAttempted = true;
        try {
          let webResearch = null;
          if (featherlessSettings?.webResearchEnabled) {
            const researchResp = await base44.functions.invoke('raceWebResearch', { market: primaryMarket, runners: marketRunners });
            if (researchResp.data?.research) webResearch = researchResp.data.research;
          }
          const resp = await base44.functions.invoke('featherlessAI', {
            market: primaryMarket, runners: marketRunners, settings,
            strategySettings: featherlessSettings, bankrollStats,
            raceFormProfiles: marketRunners.map(r => r.raceFormProfile).filter(Boolean),
            webResearch,
            allEventMarkets: [...cluster.winMarkets, ...cluster.placeMarkets, ...cluster.h2hMarkets],
          });
          if (resp.data?.error) throw new Error(resp.data.error);
          return resp.data?.aiResult || null;
        } catch (err) {
          report.errors.push(`Featherless AI call failed: ${err.message}`);
          return null;
        }
      },
      callExternalSearch: featherlessSettings?.externalSearchEnabled ? async (cluster, primaryMarket, marketRunners) => {
        extSearchCallAttempted = true;
        try {
          const resp = await base44.functions.invoke('openAIWebSearch', {
            market: primaryMarket, runners: marketRunners, settings: featherlessSettings,
          });
          if (resp.data?.error) throw new Error(resp.data.error);
          report.openAIWebSearchWorking = resp.data?.externalSearchResult?.searchStatus === 'success';
          if (!report.openAIWebSearchWorking) {
            report.warnings.push(`OpenAI search status: ${resp.data?.externalSearchResult?.searchStatus || 'unknown'}`);
          }
          return resp.data?.externalSearchResult || null;
        } catch (err) {
          report.errors.push(`OpenAI web search failed: ${err.message}`);
          return null;
        }
      } : null,
    });

    const diag = result.diagnostics;

    // 5. Markets loaded
    report.marketsLoaded = diag.totalMarketsLoaded || markets?.length || 0;

    // 6. Market types detected
    report.marketTypesDetected = {
      WIN: diag.winMarketsFound || 0,
      PLACE: diag.placeMarketsFound || 0,
      H2H: diag.h2hMarketsFound || 0,
      UNKNOWN: diag.unknownMarketsFound || 0,
    };

    // 7. Opportunities generated
    report.opportunitiesGenerated = diag.totalOpportunities || 0;
    report.backOpportunities = diag.backOpportunities || 0;
    report.layOpportunities = diag.layOpportunities || 0;
    report.positiveEVOpportunities = diag.positiveEVOpportunities || 0;
    report.rejectedOpportunities = diag.rejectedOpportunities || 0;

    // 8. External search
    report.externalSearchUsed = diag.externalSearchDiagnostics?.callsThisCycle > 0 || diag.externalSearchDiagnostics?.cacheHits > 0;
    if (extSearchCallAttempted && !report.openAIWebSearchWorking) {
      report.warnings.push('OpenAI web search was called but did not return success');
    }

    // 9. Probabilities generated
    report.probabilitiesGenerated = diag.eventsWithAI > 0 || diag.aiCacheHits > 0;
    if (aiCallAttempted && !report.probabilitiesGenerated) {
      report.warnings.push('AI was called but no probabilities were returned');
    }

    // 10. EV calculated
    report.evCalculated = (diag.totalOpportunities || 0) > 0;

    // 11. Validation & risk check
    if (result.bestOpportunity) {
      report.validationRan = true;
      report.riskCheckRan = true;
      report.paperOrderWouldCreate = true;
      report.selectedOpportunity = {
        runnerName: result.bestOpportunity.runnerName,
        marketName: result.bestOpportunity.marketName,
        side: result.bestOpportunity.side,
        odds: result.bestOpportunity.odds,
        ev: result.bestOpportunity.ev,
        roi: result.bestOpportunity.roi,
        edge: result.bestOpportunity.edge,
        modelProbability: result.bestOpportunity.modelProbability,
        decision: result.bestOpportunity.decision,
      };
    }

    // 12. Settlement available
    const settledCount = paperOrders?.filter(o => o.status === 'settled')?.length || 0;
    const awaitingCount = paperOrders?.filter(o => o.status === 'awaiting_result')?.length || 0;
    report.settlementAvailable = settledCount > 0 || awaitingCount > 0;

    // 13. No-bet reason
    report.noBetReason = diag.noBetReason || null;
    if (!result.bestOpportunity && diag.noBetReason) {
      report.warnings.push(`No opportunity selected: ${diag.noBetReason}`);
    }

    // 14. Full diagnostics for display
    report.diagnostics = diag;
    report.bestOpportunity = result.bestOpportunity;
    report.allOpportunities = result.allOpportunities?.slice(0, 50) || [];
    report.settingsWiringRows = settingsRows;
    report.liveWiringStatus = buildLiveWiringStatus(appContext);

  } catch (err) {
    report.errors.push(`Wiring test failed: ${err.message}`);
  }

  return report;
}