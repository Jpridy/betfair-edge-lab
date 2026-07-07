// ============================================================================
// RaceFormProfile — Runner metadata and form data layer
//
// This module separates Betfair market microstructure data (prices, volume,
// spreads) from real horse racing form data (jockey, trainer, barrier, weight,
// ratings, previous starts).
//
// Data sources (in order of completeness):
// 1. MARKET_ONLY — only Betfair exchange prices/volume available
// 2. PARTIAL_BETFAIR_METADATA — some RUNNER_METADATA fields from Betfair
// 3. FULL_EXTERNAL_FORM — external provider (Timeform, Racing NSW, etc.)
//
// The bot must never mislabel market-derived inference as horse form.
// ============================================================================

// Fields that represent "useful" Betfair runner metadata
const USEFUL_METADATA_FIELDS = [
  'age', 'sex', 'jockeyName', 'trainerName', 'stallDraw', 'weightValue',
  'officialRating', 'adjustedRating', 'recentForm', 'daysSinceLastRun',
  'wearing', 'sireName', 'damName', 'bredCountry', 'colourType', 'jockeyClaim',
  'ownerName', 'clothNumber', 'sortPriority',
];

// Fields that represent full external form
const EXTERNAL_FORM_FIELDS = [
  'raceDistance', 'raceClass', 'trackCondition', 'barrier',
  'trackDistanceRecord', 'previousStarts', 'jockeyStrikeRate',
  'trainerStrikeRate', 'speedRating', 'formRating',
];

/**
 * Extract a RaceFormProfile from Betfair RUNNER_METADATA.
 * Returns null if no metadata is available.
 *
 * @param {object} runnerMetadata - The `metadata` field from Betfair's
 *   listMarketCatalogue RUNNER_METADATA projection.
 * @param {string} runnerName - The runner name from RUNNER_DESCRIPTION.
 * @param {string} selectionId - The Betfair selection ID.
 * @returns {object|null} RaceFormProfile or null
 */
export function extractRaceFormProfile(runnerMetadata, runnerName, selectionId) {
  if (!runnerMetadata || typeof runnerMetadata !== 'object') {
    return null;
  }

  const profile = {
    runnerName: runnerName || null,
    selectionId: String(selectionId || ''),
    // Betfair RUNNER_METADATA fields (all optional)
    clothNumber: runnerMetadata.CLOTH_NUMBER ?? runnerMetadata.clothNumber ?? null,
    sortPriority: runnerMetadata.SORT_PRIORITY ?? runnerMetadata.sortPriority ?? null,
    age: runnerMetadata.AGE ?? runnerMetadata.age ?? null,
    sex: runnerMetadata.SEX_TYPE ?? runnerMetadata.sex ?? null,
    jockeyName: runnerMetadata.JOCKEY_NAME ?? runnerMetadata.jockeyName ?? null,
    trainerName: runnerMetadata.TRAINER_NAME ?? runnerMetadata.trainerName ?? null,
    stallDraw: runnerMetadata.STALL_DRAW ?? runnerMetadata.stallDraw ?? null,
    weightValue: runnerMetadata.WEIGHT_VALUE ?? runnerMetadata.weightValue ?? null,
    weightUnits: runnerMetadata.WEIGHT_UNITS ?? runnerMetadata.weightUnits ?? null,
    officialRating: runnerMetadata.OFFICIAL_RATING ?? runnerMetadata.officialRating ?? null,
    adjustedRating: runnerMetadata.ADJUSTED_RATING ?? runnerMetadata.adjustedRating ?? null,
    recentForm: runnerMetadata.RECENT_FORM ?? runnerMetadata.recentForm ?? null,
    daysSinceLastRun: runnerMetadata.DAYS_SINCE_LAST_RUN ?? runnerMetadata.daysSinceLastRun ?? null,
    wearing: runnerMetadata.WEARING ?? runnerMetadata.wearing ?? null,
    ownerName: runnerMetadata.OWNER_NAME ?? runnerMetadata.ownerName ?? null,
    sireName: runnerMetadata.SIRE_NAME ?? runnerMetadata.sireName ?? null,
    damName: runnerMetadata.DAM_NAME ?? runnerMetadata.damName ?? null,
    bredCountry: runnerMetadata.BRED_COUNTRY ?? runnerMetadata.bredCountry ?? null,
    colourType: runnerMetadata.COLOUR_TYPE ?? runnerMetadata.colourType ?? null,
    jockeyClaim: runnerMetadata.JOCKEY_CLAIM ?? runnerMetadata.jockeyClaim ?? null,
    forecastPriceNumerator: runnerMetadata.FORECAST_PRICE_NUMERATOR ?? runnerMetadata.forecastPriceNumerator ?? null,
    forecastPriceDenominator: runnerMetadata.FORECAST_PRICE_DENOMINATOR ?? runnerMetadata.forecastPriceDenominator ?? null,
    coloursDescription: runnerMetadata.COLOURS_DESCRIPTION ?? runnerMetadata.coloursDescription ?? null,
    coloursFilename: runnerMetadata.COLOURS_FILENAME ?? runnerMetadata.coloursFilename ?? null,
    // External form data (populated by RacingFormProvider, not Betfair)
    externalFormData: null,
  };

  // Check if any useful metadata was actually found
  const hasAnyMetadata = USEFUL_METADATA_FIELDS.some(field => profile[field] != null);
  if (!hasAnyMetadata) {
    return null;
  }

  return profile;
}

/**
 * Classify the form data status for a runner.
 *
 * @param {object|null} formProfile - RaceFormProfile or null
 * @returns {{ status: string, completeness: number, dataSource: string }}
 */
export function classifyFormData(formProfile) {
  if (!formProfile) {
    return {
      status: 'MARKET_ONLY',
      completeness: 0,
      dataSource: 'MARKET_ONLY',
    };
  }

  // Count populated metadata fields
  const metadataCount = USEFUL_METADATA_FIELDS.filter(f => formProfile[f] != null).length;
  const metadataCompleteness = Math.round((metadataCount / USEFUL_METADATA_FIELDS.length) * 100);

  // Check for external form data
  if (formProfile.externalFormData) {
    const externalCount = EXTERNAL_FORM_FIELDS.filter(f => formProfile.externalFormData[f] != null).length;
    const externalCompleteness = Math.round((externalCount / EXTERNAL_FORM_FIELDS.length) * 100);

    if (externalCount > 0) {
      return {
        status: 'FULL_EXTERNAL_FORM',
        completeness: Math.max(metadataCompleteness, externalCompleteness),
        dataSource: 'EXTERNAL_FORM_PLUS_MARKET',
      };
    }
  }

  if (metadataCount > 0) {
    return {
      status: 'PARTIAL_BETFAIR_METADATA',
      completeness: metadataCompleteness,
      dataSource: 'BETFAIR_METADATA_PLUS_MARKET',
    };
  }

  return {
    status: 'MARKET_ONLY',
    completeness: 0,
    dataSource: 'MARKET_ONLY',
  };
}

/**
 * Get the appropriate probability label based on data source.
 *
 * @param {string} dataSource - MARKET_ONLY | BETFAIR_METADATA_PLUS_MARKET | EXTERNAL_FORM_PLUS_MARKET
 * @returns {string}
 */
export function getProbabilityLabel(dataSource) {
  switch (dataSource) {
    case 'EXTERNAL_FORM_PLUS_MARKET':
      return 'formAdjustedProbability';
    case 'BETFAIR_METADATA_PLUS_MARKET':
      return 'metadataAdjustedProbability';
    case 'MARKET_ONLY':
    default:
      return 'marketDerivedProbability';
  }
}

/**
 * Generate the "no form available" disclaimer text.
 */
export function getNoFormDisclaimer() {
  return 'Full racing form unavailable. This decision is based on Betfair market behaviour and available runner metadata only.';
}

/**
 * Aggregate form data coverage across all runners in a market.
 *
 * @param {Array} runners - Array of runner objects with formDataStatus
 * @returns {object} Coverage statistics
 */
export function calculateFormDataCoverage(runners) {
  const total = runners.length;
  if (total === 0) {
    return {
      totalRunners: 0,
      marketOnly: 0,
      partialMetadata: 0,
      fullExternalForm: 0,
      withJockey: 0,
      withTrainer: 0,
      withRecentForm: 0,
      withOfficialRating: 0,
      withStallDraw: 0,
      marketOnlyPercent: 0,
    };
  }

  let marketOnly = 0, partialMetadata = 0, fullExternalForm = 0;
  let withJockey = 0, withTrainer = 0, withRecentForm = 0, withOfficialRating = 0, withStallDraw = 0;

  for (const r of runners) {
    const status = r.formDataStatus || 'MARKET_ONLY';
    if (status === 'MARKET_ONLY') marketOnly++;
    else if (status === 'PARTIAL_BETFAIR_METADATA') partialMetadata++;
    else if (status === 'FULL_EXTERNAL_FORM') fullExternalForm++;

    if (r.raceFormProfile?.jockeyName) withJockey++;
    if (r.raceFormProfile?.trainerName) withTrainer++;
    if (r.raceFormProfile?.recentForm) withRecentForm++;
    if (r.raceFormProfile?.officialRating != null) withOfficialRating++;
    if (r.raceFormProfile?.stallDraw != null) withStallDraw++;
  }

  return {
    totalRunners: total,
    marketOnly,
    partialMetadata,
    fullExternalForm,
    withJockey,
    withTrainer,
    withRecentForm,
    withOfficialRating,
    withStallDraw,
    marketOnlyPercent: Math.round((marketOnly / total) * 100),
  };
}