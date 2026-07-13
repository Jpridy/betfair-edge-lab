import { PAPER_VALIDATION_PRESET } from './paperValidationPreset';

const MONEY_KEYS = new Set([
  'bankroll', 'paperBankroll', 'baseStake', 'maxStake', 'maxLayLiability',
  'dailyLossLimit', 'weeklyLossLimit', 'maxMarketExposure', 'minimumLiquidity',
  'minimumTradedVolume', 'maxDrawdownLimit', 'winMinLiquidity', 'placeMinLiquidity',
  'h2hMinLiquidity',
]);

const PERCENT_KEYS = new Set([
  'maxStakePercent', 'minConfidence', 'minEdge', 'minExpectedROI', 'winMinEdge',
  'winMinROI', 'placeMinEdge', 'placeMinROI', 'h2hMinEdge', 'h2hMinROI',
  'minExternalDataQuality',
]);

const DECIMAL_KEYS = new Set([
  'kellyMultiplier', 'defaultCommissionRate', 'commissionRate', 'manualCommissionRate',
  'maxExternalProbabilityAdjustment', 'favouriteContextMaxProbabilityAdjustment',
]);

const OWNERS = {
  appSettings: 'riskCalculations',
  botSettings: 'botCycleController',
  featherlessSettings: 'exchangeOpportunityEngine',
};

const CONSUMERS = {
  appSettings: ['exchangeMath', 'marketEligibility', 'riskCalculations', 'authorizeAndCreatePaperOrder', 'portfolioAccounting'],
  botSettings: ['botCycleController', 'authorizeAndCreatePaperOrder'],
  featherlessSettings: ['exchangeOpportunityEngine', 'crossMarketValueScanner', 'featherlessAI'],
};

const UI_CONSUMERS = {
  appSettings: ['Dashboard', 'Controls', 'Settings', 'Debug'],
  botSettings: ['Dashboard', 'Controls', 'Settings', 'Debug'],
  featherlessSettings: ['Controls', 'Analytics', 'Settings', 'Debug'],
};

const RANGE_OVERRIDES = {
  defaultCommissionRate: [0, 0.2],
  commissionRate: [0, 0.2],
  manualCommissionRate: [0, 0.2],
  kellyMultiplier: [0, 1],
  favouriteContextMaxProbabilityAdjustment: [0, 0.02],
  maxExternalProbabilityAdjustment: [0, 0.05],
  maxStakePercent: [0, 5],
  minConfidence: [0, 100],
  dataFreshnessLimit: [5, 300],
  scanIntervalSeconds: [5, 300],
  winMinOdds: [1.01, 1000],
  winMaxOdds: [1.01, 1000],
  placeMinOdds: [1.01, 1000],
  placeMaxOdds: [1.01, 1000],
  h2hMinOdds: [1.01, 1000],
  h2hMaxOdds: [1.01, 1000],
};

const unitFor = key => {
  if (MONEY_KEYS.has(key)) return 'AUD';
  if (PERCENT_KEYS.has(key)) return 'percent';
  if (DECIMAL_KEYS.has(key)) return 'decimal';
  if (key.toLowerCase().includes('seconds') || key.toLowerCase().includes('timeout')) return 'seconds';
  if (key.toLowerCase().includes('odds')) return 'odds';
  if (key.toLowerCase().includes('spread') || key.toLowerCase().includes('ticks')) return 'ticks';
  return 'value';
};

const rangeFor = (key, value) => {
  if (RANGE_OVERRIDES[key]) return RANGE_OVERRIDES[key];
  if (typeof value === 'number') return [0, null];
  return [null, null];
};

export const SETTINGS_REGISTRY = Object.freeze(
  Object.entries(PAPER_VALIDATION_PRESET)
    .filter(([section]) => section !== 'validationRules')
    .flatMap(([section, values]) => Object.entries(values).map(([settingKey, defaultValue]) => {
      const [minimum, maximum] = rangeFor(settingKey, defaultValue);
      return Object.freeze({
        settingKey,
        displayName: settingKey.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase()),
        type: Array.isArray(defaultValue) ? 'array' : defaultValue === null ? 'nullable' : typeof defaultValue,
        minimum,
        maximum,
        defaultValue,
        unit: unitFor(settingKey),
        source: section,
        ownerModule: OWNERS[section],
        engineConsumers: CONSUMERS[section],
        UIConsumers: UI_CONSUMERS[section],
        deprecated: settingKey === 'commissionRate',
      });
    })),
);

export function resolveEffectiveSettings({ appSettings = {}, botSettings = {}, featherlessSettings = {}, riskSettings = {} } = {}) {
  const input = {
    appSettings: { ...appSettings, ...riskSettings },
    botSettings,
    featherlessSettings,
  };

  const now = new Date().toISOString();
  const linkage = SETTINGS_REGISTRY.map(definition => {
    const stored = input[definition.source]?.[definition.settingKey];
    const effective = stored ?? definition.defaultValue;
    let validationError = null;

    if (typeof effective === 'number' && !Number.isFinite(effective)) validationError = 'NON_FINITE';
    else if (definition.minimum != null && effective < definition.minimum) validationError = 'BELOW_MINIMUM';
    else if (definition.maximum != null && effective > definition.maximum) validationError = 'ABOVE_MAXIMUM';

    return {
      ...definition,
      storedValue: stored ?? null,
      effectiveValue: effective,
      lastReadAt: now,
      linked: definition.engineConsumers.length > 0,
      conflict: false,
      validationError,
    };
  });

  const bySection = { appSettings: {}, botSettings: {}, featherlessSettings: {} };
  for (const item of linkage) {
    bySection[item.source][item.settingKey] = item.validationError ? item.defaultValue : item.effectiveValue;
  }

  // Hard safety enforcement. Stored values may never override these.
  Object.assign(bySection.appSettings, {
    forcedPaperOnlyMode: true,
    liveTradingEnabled: false,
    allowInPlay: false,
  });
  Object.assign(bySection.botSettings, {
    botMode: 'paper',
    liveTradingLocked: true,
    liveTradingEnabled: false,
  });
  Object.assign(bySection.featherlessSettings, {
    paperTradeOnly: true,
    allowLiveHandoff: false,
    allowDeterministicFallback: false,
    allowMarketOnlyFallbackInNormalMode: false,
    placeOrdersEnabled: false,
    h2hOrdersEnabled: false,
    autoApplyChampion: false,
  });

  return Object.freeze({
    appSettings: Object.freeze(bySection.appSettings),
    botSettings: Object.freeze(bySection.botSettings),
    featherlessSettings: Object.freeze(bySection.featherlessSettings),
    linkage: Object.freeze(linkage),
    generatedAt: now,
  });
}
