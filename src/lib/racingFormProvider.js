// ============================================================================
// RacingFormProvider — Interface for external horse racing form data
//
// This interface defines the contract for external form data providers.
// The app currently uses NoExternalFormProvider (returns null for everything),
// but the architecture supports future implementations:
//
//   - Betfair Timeform API
//   - Racing NSW API
//   - Racing Victoria API
//   - TAB form API
//   - Third-party racing data providers
//
// When a real provider is implemented, create a new class that implements
// this interface and inject it into the bot's data pipeline. The bot will
// automatically upgrade from MARKET_ONLY → FULL_EXTERNAL_FORM analysis.
// ============================================================================

/**
 * @typedef {Object} RaceCard
 * @property {string} venue
 * @property {number} raceNumber
 * @property {string} startTime - ISO timestamp
 * @property {string} countryCode
 * @property {number|null} raceDistance - in metres
 * @property {string|null} raceClass - e.g. "Group 1", "BM70"
 * @property {string|null} trackCondition - e.g. "Good 4", "Soft 5"
 * @property {string|null} raceType - e.g. "Thoroughbred", "Harness"
 */

/**
 * @typedef {Object} RunnerExternalForm
 * @property {string} runnerName
 * @property {number|null} barrier
 * @property {string|null} trackDistanceRecord
 * @property {Array|null} previousStarts
 * @property {number|null} jockeyStrikeRate
 * @property {number|null} trainerStrikeRate
 * @property {number|null} speedRating
 * @property {number|null} formRating
 */

/**
 * @typedef {Object} Scratching
 * @property {string} runnerName
 * @property {string} scratchedAt - ISO timestamp
 * @property {string|null} reason
 */

/**
 * @typedef {Object} TrackCondition
 * @property {string} venue
 * @property {number} raceNumber
 * @property {string} condition - e.g. "Good 4"
 * @property {string|null} railPosition
 * @property {string|null} irrigation
 * @property {string|null} weather
 */

/**
 * @typedef {Object} RaceResult
 * @property {string} venue
 * @property {number} raceNumber
 * @property {Array} placings - [{ position, runnerName, margin, time }]
 * @property {number|null} raceTime
 * @property {string|null} trackCondition
 */

/**
 * RacingFormProvider interface.
 * Every provider must implement all methods.
 * Methods that cannot fulfil a request must return null (never throw or hallucinate).
 */
export class RacingFormProvider {
  /**
   * Get the full race card for a specific race.
   * @param {string} venue
   * @param {number} raceNumber
   * @param {string} startTime - ISO timestamp
   * @param {string} countryCode
   * @returns {Promise<RaceCard|null>}
   */
  async getRaceCard(venue, raceNumber, startTime, countryCode) {
    throw new Error('getRaceCard not implemented');
  }

  /**
   * Get external form data for a specific runner in a specific race.
   * @param {string} runnerName
   * @param {string} venue
   * @param {number} raceNumber
   * @param {string} startTime
   * @returns {Promise<RunnerExternalForm|null>}
   */
  async getRunnerForm(runnerName, venue, raceNumber, startTime) {
    throw new Error('getRunnerForm not implemented');
  }

  /**
   * Get scratchings for a specific race.
   * @param {string} venue
   * @param {number} raceNumber
   * @param {string} startTime
   * @returns {Promise<Array<Scratching>|null>}
   */
  async getScratchings(venue, raceNumber, startTime) {
    throw new Error('getScratchings not implemented');
  }

  /**
   * Get track condition for a specific race.
   * @param {string} venue
   * @param {number} raceNumber
   * @param {string} startTime
   * @returns {Promise<TrackCondition|null>}
   */
  async getTrackCondition(venue, raceNumber, startTime) {
    throw new Error('getTrackCondition not implemented');
  }

  /**
   * Get the result of a completed race.
   * @param {string} venue
   * @param {number} raceNumber
   * @param {string} startTime
   * @returns {Promise<RaceResult|null>}
   */
  async getRaceResult(venue, raceNumber, startTime) {
    throw new Error('getRaceResult not implemented');
  }

  /**
   * Get the provider name for logging.
   * @returns {string}
   */
  getProviderName() {
    return 'Unknown';
  }

  /**
   * Check if the provider is available and configured.
   * @returns {boolean}
   */
  isAvailable() {
    return false;
  }
}

/**
 * NoExternalFormProvider — placeholder provider that returns null for everything.
 *
 * This keeps the architecture ready for a real provider (Timeform, Racing NSW,
 * Racing Victoria, TAB, etc.) without breaking the current trading engine.
 *
 * When no external provider is configured, all runners remain in MARKET_ONLY
 * or PARTIAL_BETFAIR_METADATA mode.
 */
export class NoExternalFormProvider extends RacingFormProvider {
  async getRaceCard(venue, raceNumber, startTime, countryCode) {
    return null;
  }

  async getRunnerForm(runnerName, venue, raceNumber, startTime) {
    return null;
  }

  async getScratchings(venue, raceNumber, startTime) {
    return null;
  }

  async getTrackCondition(venue, raceNumber, startTime) {
    return null;
  }

  async getRaceResult(venue, raceNumber, startTime) {
    return null;
  }

  getProviderName() {
    return 'NoExternalFormProvider';
  }

  isAvailable() {
    return false;
  }
}

/**
 * The currently configured form provider.
 * To add a real provider, replace this with an instance of the new provider class.
 */
export const formProvider = new NoExternalFormProvider();