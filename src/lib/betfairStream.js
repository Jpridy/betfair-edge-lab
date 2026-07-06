/**
 * Betfair Stream API Client (WebSocket)
 *
 * Connects directly from the browser to Betfair's Stream API.
 * WebSockets bypass CORS restrictions and the browser's TLS fingerprint
 * passes Betfair's Cloudflare WAF (which blocks all server-side requests).
 *
 * Protocol:
 * 1. Connect to wss://stream-api.betfair.com:443
 * 2. Send authentication (appKey + session token)
 * 3. Send market subscription (horse racing WIN markets)
 * 4. Receive real-time market change messages (full image + deltas)
 */

export class BetfairStreamClient {
  constructor(appKey, sessionToken, jurisdiction = 'AU') {
    this.appKey = appKey;
    this.sessionToken = sessionToken;
    this.jurisdiction = jurisdiction;
    this.ws = null;
    this.messageId = 1;
    this.markets = new Map();
    this.onMarketsUpdate = null;
    this.onStatusChange = null;
    this.onError = null;
    this.reconnectTimer = null;
    this.shouldReconnect = false;
    this.subscribed = false;
  }

  connect() {
    this.shouldReconnect = true;
    this.subscribed = false;
    const wsUrl = 'wss://stream-api.betfair.com:443';

    try {
      this.ws = new WebSocket(wsUrl);
    } catch (err) {
      if (this.onError) this.onError(`WebSocket creation failed: ${err.message}`);
      if (this.onStatusChange) this.onStatusChange('error');
      return;
    }

    this.ws.onopen = () => this._onOpen();
    this.ws.onmessage = (event) => this._onMessage(event);
    this.ws.onclose = (event) => this._onClose(event);
    this.ws.onerror = () => this._onError();

    if (this.onStatusChange) this.onStatusChange('connecting');
  }

  _onOpen() {
    if (this.onStatusChange) this.onStatusChange('authenticating');
    this._send({
      op: 'authentication',
      id: String(this.messageId++),
      appKey: this.appKey,
      session: this.sessionToken,
    });
  }

  _onMessage(event) {
    let data;
    try { data = JSON.parse(event.data); } catch { return; }

    if (data.op === 'status') {
      this._handleStatus(data);
    } else if (data.op === 'mcm') {
      this._handleMarketChange(data);
    }
  }

  _handleStatus(data) {
    if (data.statusCode === 'SUCCESS') {
      if (!this.subscribed) {
        this.subscribed = true;
        if (this.onStatusChange) this.onStatusChange('connected');
        this._subscribeToMarkets();
      }
    } else if (data.statusCode === 'FAILURE') {
      const errorCode = data.errorCode || '';
      if (this.onError) this.onError(data.errorMessage || errorCode || 'Stream error');

      if (errorCode === 'INVALID_SESSION_INFO' || errorCode === 'NO_SESSION' || errorCode === 'SESSION_EXPIRED') {
        this.shouldReconnect = false;
        if (this.onStatusChange) this.onStatusChange('session_expired');
      }
    }
  }

  _subscribeToMarkets() {
    const now = new Date();
    const fromTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

    this._send({
      op: 'marketSubscription',
      id: String(this.messageId++),
      marketFilter: {
        eventTypeIds: ['7'],
        marketTypes: ['WIN'],
        marketStartTime: { from: fromTime },
      },
      marketDataFilter: {
        ladderLevels: 1,
        fields: ['EX_BEST_OFFERS', 'EX_TRADED_VOL', 'EX_LTP'],
      },
    });
  }

  _handleMarketChange(data) {
    if (!data.mc) return;

    const isImage = data.img === true;

    for (const change of data.mc) {
      const marketId = change.id;
      const marketDef = change.marketDefinition;

      // Create market if not exists
      if (!this.markets.has(marketId)) {
        this.markets.set(marketId, {
          id: marketId,
          betfairMarketId: marketId,
          eventType: 'Horse Racing',
          country: this.jurisdiction === 'AU' ? 'AU' : '',
          venue: '',
          eventName: '',
          marketName: '',
          marketType: 'WIN',
          startTime: null,
          status: 'OPEN',
          inPlay: false,
          totalMatched: 0,
          numberOfRunners: 0,
          numberOfActiveRunners: 0,
          betDelay: 0,
          bspMarket: false,
          marketBaseRate: null,
          watched: false,
          runners: new Map(),
        });
      }

      const market = this.markets.get(marketId);

      // Update market definition
      if (marketDef) {
        if (marketDef.venue) market.venue = marketDef.venue;
        if (marketDef.name) market.marketName = marketDef.name;
        if (marketDef.marketType) market.marketType = marketDef.marketType;
        if (marketDef.status) market.status = marketDef.status;
        if (marketDef.inPlay != null) market.inPlay = marketDef.inPlay;
        if (marketDef.marketTime) market.startTime = marketDef.marketTime;
        if (marketDef.betDelay != null) market.betDelay = marketDef.betDelay;
        if (marketDef.numberOfActiveRunners != null) market.numberOfActiveRunners = marketDef.numberOfActiveRunners;
        if (marketDef.numberOfWinners != null) market.numberOfWinners = marketDef.numberOfWinners;
        if (marketDef.bspMarket != null) market.bspMarket = marketDef.bspMarket;
        if (marketDef.baseRate != null) market.marketBaseRate = marketDef.baseRate;
        if (marketDef.eventName) market.eventName = marketDef.eventName;
        if (marketDef.countryCode) market.country = marketDef.countryCode;

        // Construct event name if not provided
        if (!market.eventName && market.venue) {
          market.eventName = market.venue;
        }

        // Process runner definitions
        if (marketDef.runners) {
          market.numberOfRunners = marketDef.runners.length;
          for (const runnerDef of marketDef.runners) {
            const runnerId = String(runnerDef.id);
            if (!market.runners.has(runnerId)) {
              market.runners.set(runnerId, {
                id: `${marketId}_${runnerId}`,
                marketId: marketId,
                betfairSelectionId: runnerId,
                runnerName: runnerDef.name || `Selection ${runnerId}`,
                status: runnerDef.status || 'ACTIVE',
                bestBackPrice: 0,
                bestBackSize: 0,
                bestLayPrice: 0,
                bestLaySize: 0,
                lastTradedPrice: 0,
                tradedVolume: 0,
                impliedProbability: 0,
                favouriteRank: 0,
                isFavourite: false,
                isOutsider: false,
              });
            }
            const runner = market.runners.get(runnerId);
            if (runnerDef.name) runner.runnerName = runnerDef.name;
            if (runnerDef.status) runner.status = runnerDef.status;
            if (runnerDef.adjustmentFactor != null) runner.adjustmentFactor = runnerDef.adjustmentFactor;
          }
        }
      }

      // Process runner price changes
      if (change.rc) {
        let marketTotalMatched = 0;

        for (const rc of change.rc) {
          const runnerId = String(rc.id);
          let runner = market.runners.get(runnerId);
          if (!runner) {
            runner = {
              id: `${marketId}_${runnerId}`,
              marketId: marketId,
              betfairSelectionId: runnerId,
              runnerName: `Selection ${runnerId}`,
              status: 'ACTIVE',
              bestBackPrice: 0,
              bestBackSize: 0,
              bestLayPrice: 0,
              bestLaySize: 0,
              lastTradedPrice: 0,
              tradedVolume: 0,
              impliedProbability: 0,
              favouriteRank: 0,
              isFavourite: false,
              isOutsider: false,
            };
            market.runners.set(runnerId, runner);
          }

          if (rc.ltp != null) runner.lastTradedPrice = rc.ltp;
          if (rc.tv != null) runner.tradedVolume = rc.tv;
          marketTotalMatched += runner.tradedVolume || 0;

          // Best back (atb = available to back)
          if (rc.atb && rc.atb.length > 0) {
            // atb is [[price, size], ...] sorted by price descending (best back = highest)
            runner.bestBackPrice = rc.atb[0][0];
            runner.bestBackSize = rc.atb[0][1];
          }
          // Best lay (atl = available to lay)
          if (rc.atl && rc.atl.length > 0) {
            // atl is [[price, size], ...] sorted by price ascending (best lay = lowest)
            runner.bestLayPrice = rc.atl[0][0];
            runner.bestLaySize = rc.atl[0][1];
          }

          if (runner.bestBackPrice > 0) {
            runner.impliedProbability = (1 / runner.bestBackPrice) * 100;
          }
        }

        if (marketTotalMatched > 0) {
          market.totalMatched = marketTotalMatched;
        }
      }
    }

    // Calculate favourite ranks
    this._updateRanks();

    // Emit update
    if (this.onMarketsUpdate) {
      this.onMarketsUpdate(this._getMarketsArray(), this._getRunnersArray());
    }
  }

  _updateRanks() {
    for (const market of this.markets.values()) {
      const runners = [...market.runners.values()];
      runners.sort((a, b) => (a.bestBackPrice || 9999) - (b.bestBackPrice || 9999));
      runners.forEach((r, idx) => {
        r.favouriteRank = idx + 1;
        r.isFavourite = idx === 0;
        r.isOutsider = idx === runners.length - 1;
      });
    }
  }

  _getMarketsArray() {
    const markets = [];
    for (const m of this.markets.values()) {
      // Skip closed/settled markets
      if (m.status === 'CLOSED' || m.status === 'SETTLED') continue;
      const runnerCount = m.runners.size;
      markets.push({
        id: m.id,
        betfairMarketId: m.betfairMarketId,
        eventType: m.eventType,
        country: m.country,
        venue: m.venue,
        eventName: m.eventName,
        marketName: m.marketName,
        marketType: m.marketType,
        startTime: m.startTime,
        status: m.status,
        inPlay: m.inPlay,
        totalMatched: m.totalMatched,
        numberOfRunners: m.numberOfRunners || runnerCount,
        numberOfActiveRunners: m.numberOfActiveRunners || runnerCount,
        betDelay: m.betDelay,
        bspMarket: m.bspMarket,
        marketBaseRate: m.marketBaseRate,
        watched: m.watched,
      });
    }
    return markets;
  }

  _getRunnersArray() {
    const runners = [];
    for (const m of this.markets.values()) {
      if (m.status === 'CLOSED' || m.status === 'SETTLED') continue;
      for (const r of m.runners.values()) {
        // Skip removed runners
        if (r.status === 'REMOVED') continue;
        runners.push({ ...r });
        delete runners[runners.length - 1].runners; // Prevent circular ref
      }
    }
    return runners;
  }

  _send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  _onClose(event) {
    if (this.onStatusChange) this.onStatusChange('disconnected');
    if (this.shouldReconnect && event.code !== 1000) {
      this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    }
  }

  _onError() {
    if (this.onError) this.onError('WebSocket connection error');
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.onerror = null;
      try { this.ws.close(); } catch (_) {}
      this.ws = null;
    }
    this.markets.clear();
    this.subscribed = false;
  }

  getMarketCount() {
    return this.markets.size;
  }
}