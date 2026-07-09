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
  constructor(appKey, sessionToken, jurisdiction = 'AU', wsProxyUrl = null) {
    this.appKey = appKey;
    this.sessionToken = sessionToken;
    this.jurisdiction = jurisdiction;
    this.wsProxyUrl = wsProxyUrl;
    this.ws = null;
    this.messageId = 1;
    this.markets = new Map();
    this.onMarketsUpdate = null;
    this.onStatusChange = null;
    this.onError = null;
    this.onMarketSettled = null;
    this.reconnectTimer = null;
    this.shouldReconnect = false;
    this.subscribed = false;
    this.onHeartbeat = null;
    this.lastMessageAt = 0;
    this.watchdogTimer = null;
  }

  connect(isReconnect = false) {
    this.shouldReconnect = true;
    this.subscribed = false;
    // Only reset attempt counter on manual connect, not on auto-reconnect
    if (!isReconnect) {
      this._reconnectAttempts = 0;
    }

    // Connect through the Cloudflare Worker WebSocket-to-TCP bridge.
    // Betfair's Stream API is a raw TCP server (not WebSocket), so the browser
    // cannot connect directly. The worker accepts a WebSocket from the browser
    // and bridges it to a raw TLS TCP socket to stream-api.betfair.com:443.
    if (!this.wsProxyUrl) {
      if (this.onError) this.onError('No proxy URL configured. Set BETFAIR_PROXY_URL to your deployed Cloudflare Worker URL.');
      if (this.onStatusChange) this.onStatusChange('error');
      return;
    }

    const wsUrl = this.wsProxyUrl
      .replace(/^https:\/\//, 'wss://')
      .replace(/^http:\/\//, 'ws://');
    this._wsUrl = wsUrl;

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

    // Watchdog: check every 15s if the connection is truly alive.
    // Betfair sends heartbeats every ~5s, so no message in 60s = dead connection.
    this.lastMessageAt = Date.now();
    this.watchdogTimer = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      const silentMs = Date.now() - this.lastMessageAt;
      if (silentMs > 60000) {
        if (this.onError) this.onError(`No heartbeat from Betfair for ${Math.round(silentMs / 1000)}s — forcing reconnect`);
        try { this.ws.close(); } catch (_) {}
        // _onClose will handle reconnection
      }
    }, 15000);
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

    this.lastMessageAt = Date.now();

    if (data.op === 'status') {
      this._handleStatus(data);
    } else if (data.op === 'mcm') {
      this._handleMarketChange(data);
    } else if (data.op === 'diag') {
      // Diagnostic message from the Cloudflare Worker — surface it for debugging
      this._lastDiag = data.message;
      if (this.onError) this.onError(`[worker] ${data.message}`);
    }
  }

  _handleStatus(data) {
    if (data.statusCode === 'SUCCESS') {
      if (!this.subscribed) {
        this.subscribed = true;
        if (this.onStatusChange) this.onStatusChange('connected');
        this._subscribeToMarkets();
      } else {
        // Heartbeat — Betfair sends these every ~5s when no market changes occur.
        // Fire callback so AppContext can keep lastMarketSyncTime fresh.
        if (this.onHeartbeat) this.onHeartbeat();
      }
    } else if (data.statusCode === 'FAILURE') {
      const errorCode = data.errorCode || '';
      const errorMsg = data.errorMessage || errorCode || 'Stream error';

      // If we exceeded the 200-market subscription limit, fall back to a narrower filter
      if (errorCode === 'SUBSCRIPTION_LIMIT_EXCEEDED' || errorCode === 'TOO_MANY_MARKETS') {
        const nextLevel = (this._subscriptionFilterLevel || 0) + 1;
        if (nextLevel <= 4) {
          if (this.onError) this.onError(`Market filter too broad (${errorCode}). Falling back to narrower filter (level ${nextLevel})...`);
          this._subscribeToMarkets(nextLevel);
          return;
        }
      }

      if (this.onError) this.onError(errorMsg);

      // Stop reconnecting on auth failures — the token/key is invalid
      this.shouldReconnect = false;

      if (errorCode === 'INVALID_SESSION_INFO' || errorCode === 'NO_SESSION' || errorCode === 'SESSION_EXPIRED') {
        if (this.onStatusChange) this.onStatusChange('session_expired');
      } else {
        // App key invalid, no permissions, etc.
        if (this.onStatusChange) this.onStatusChange('error');
      }
    }
  }

  _subscribeToMarkets(filterLevel = 0) {
    // Betfair Stream API MarketFilter only supports: countryCodes, marketTypes,
    // eventTypeIds, eventIds, marketIds, venues, bettingTypes, bspMarket, raceTypes.
    // Max 200 markets per subscription. We try broad filters first and fall back
    // to narrower ones if Betfair rejects for exceeding the limit.
    // Horse racing only (eventType 7 — no greyhounds).
    // Filters go broad → narrow so we get the most data possible while
    // staying under Betfair's 200-market-per-subscription limit.
    const filters = [
      // Level 0 — global horse racing (broadest)
      { eventTypeIds: ['7'], marketTypes: ['WIN'] },
      // Level 1 — AU + GB + IE horse racing
      { eventTypeIds: ['7'], marketTypes: ['WIN'], countryCodes: ['AU', 'GB', 'IE'] },
      // Level 2 — AU + GB horse racing
      { eventTypeIds: ['7'], marketTypes: ['WIN'], countryCodes: ['AU', 'GB'] },
      // Level 3 — AU only horse racing
      { eventTypeIds: ['7'], marketTypes: ['WIN'], countryCodes: ['AU'] },
      // Level 4 — AU BSP markets only (narrowest)
      { eventTypeIds: ['7'], marketTypes: ['WIN'], countryCodes: ['AU'], bspMarket: true },
    ];
    const filter = filters[Math.min(filterLevel, filters.length - 1)];
    this._subscriptionFilterLevel = filterLevel;

    this._send({
      op: 'marketSubscription',
      id: String(this.messageId++),
      marketFilter: filter,
      marketDataFilter: {
        ladderLevels: 3,
        fields: ['EX_BEST_OFFERS', 'EX_ALL_OFFERS', 'EX_TRADED_VOL', 'EX_LTP', 'EX_MARKET_DEF'],
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
          marketStartTime: null,
          raceNumber: 0,
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
        if (marketDef.marketTime) { market.startTime = marketDef.marketTime; market.marketStartTime = marketDef.marketTime; }
        if (marketDef.betDelay != null) market.betDelay = marketDef.betDelay;
        if (marketDef.numberOfActiveRunners != null) market.numberOfActiveRunners = marketDef.numberOfActiveRunners;
        if (marketDef.numberOfWinners != null) market.numberOfWinners = marketDef.numberOfWinners;
        if (marketDef.bspMarket != null) market.bspMarket = marketDef.bspMarket;
        if (marketDef.baseRate != null) market.marketBaseRate = marketDef.baseRate;
        if (marketDef.eventName) market.eventName = marketDef.eventName;
        if (marketDef.countryCode) market.country = marketDef.countryCode;

        // Parse race number from market name (e.g. "R1 1200m") or event name
        const rn = this._parseRaceNumber(market.marketName, market.eventName);
        if (rn) market.raceNumber = rn;

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
                horseNumber: runnerDef.sortPriority || 0,
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
                availableToBackLadder: [],
                availableToLayLadder: [],
                tradedVolumeByPrice: [],
                midPrice: 0,
                weightedMidPrice: 0,
                microPrice: 0,
                bookPercentage: 0,
                liquidityRank: 0,
                priceMovementShortTerm: 0,
                priceMovementMediumTerm: 0,
                tradedVolumeDelta: 0,
                backPressure: 0,
                layPressure: 0,
                orderBookImbalance: 0,
                bspNearPrice: 0,
                bspFarPrice: 0,
                spAvailable: 0,
                spTraded: 0,
                formDataStatus: 'MARKET_ONLY',
                formDataCompleteness: 0,
                raceFormProfile: null,
                _priceHistory: [],
                _lastTradedVolume: 0,
              });
            }
            const runner = market.runners.get(runnerId);
            if (runnerDef.name) runner.runnerName = runnerDef.name;
            if (runnerDef.sortPriority != null) runner.horseNumber = runnerDef.sortPriority;
            if (runnerDef.status) runner.status = runnerDef.status;
            if (runnerDef.adjustmentFactor != null) runner.adjustmentFactor = runnerDef.adjustmentFactor;
          }
        }

        // Detect market settlement — closed with winners declared by the exchange
        if (marketDef.status === 'CLOSED' && !market._settledNotified) {
          market._settledNotified = true;
          const winners = (marketDef.runners || [])
            .filter(r => r.status === 'WINNER')
            .map(r => String(r.id));
          if (this.onMarketSettled && winners.length > 0) {
            this.onMarketSettled({ marketId, winners, venue: market.venue, marketName: market.marketName });
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
              horseNumber: 0,
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
              availableToBackLadder: [],
              availableToLayLadder: [],
              tradedVolumeByPrice: [],
              midPrice: 0,
              weightedMidPrice: 0,
              microPrice: 0,
              bookPercentage: 0,
              liquidityRank: 0,
              priceMovementShortTerm: 0,
              priceMovementMediumTerm: 0,
              tradedVolumeDelta: 0,
              backPressure: 0,
              layPressure: 0,
              orderBookImbalance: 0,
              bspNearPrice: 0,
              bspFarPrice: 0,
              spAvailable: 0,
              spTraded: 0,
              formDataStatus: 'MARKET_ONLY',
              formDataCompleteness: 0,
              raceFormProfile: null,
              _priceHistory: [],
              _lastTradedVolume: 0,
            };
            market.runners.set(runnerId, runner);
          }

          if (rc.ltp != null) runner.lastTradedPrice = rc.ltp;
          if (rc.tv != null) runner.tradedVolume = rc.tv;
          marketTotalMatched += runner.tradedVolume || 0;

          // Best back — EX_BEST_OFFERS returns batb: [[level, price, size], ...]
          // EX_ALL_OFFERS returns atb: [[price, size], ...]
          if (rc.batb && rc.batb.length > 0) {
            const best = rc.batb.find(([lvl, p, s]) => s > 0);
            if (best) { runner.bestBackPrice = best[1]; runner.bestBackSize = best[2]; }
            else { runner.bestBackPrice = 0; runner.bestBackSize = 0; }
          } else if (rc.atb && rc.atb.length > 0) {
            const best = rc.atb.find(([p, s]) => s > 0);
            if (best) { runner.bestBackPrice = best[0]; runner.bestBackSize = best[1]; }
            else { runner.bestBackPrice = 0; runner.bestBackSize = 0; }
          }
          // Best lay
          if (rc.batl && rc.batl.length > 0) {
            const best = rc.batl.find(([lvl, p, s]) => s > 0);
            if (best) { runner.bestLayPrice = best[1]; runner.bestLaySize = best[2]; }
            else { runner.bestLayPrice = 0; runner.bestLaySize = 0; }
          } else if (rc.atl && rc.atl.length > 0) {
            const best = rc.atl.find(([p, s]) => s > 0);
            if (best) { runner.bestLayPrice = best[0]; runner.bestLaySize = best[1]; }
            else { runner.bestLayPrice = 0; runner.bestLaySize = 0; }
          }

          if (runner.bestBackPrice > 0) {
            runner.impliedProbability = (1 / runner.bestBackPrice) * 100;
          }

          // Store full ladders from EX_ALL_OFFERS (atb/atl) or EX_BEST_OFFERS (batb/batl)
          if (rc.atb && rc.atb.length > 0) {
            runner.availableToBackLadder = rc.atb
              .filter(([p, s]) => s > 0)
              .map(([price, size]) => ({ price, size }))
              .sort((a, b) => b.price - a.price); // descending (best back first)
          } else if (rc.batb && rc.batb.length > 0) {
            runner.availableToBackLadder = rc.batb
              .filter(([lvl, p, s]) => s > 0)
              .map(([level, price, size]) => ({ price, size }))
              .sort((a, b) => b.price - a.price);
          }
          if (rc.atl && rc.atl.length > 0) {
            runner.availableToLayLadder = rc.atl
              .filter(([p, s]) => s > 0)
              .map(([price, size]) => ({ price, size }))
              .sort((a, b) => a.price - b.price); // ascending (best lay first)
          } else if (rc.batl && rc.batl.length > 0) {
            runner.availableToLayLadder = rc.batl
              .filter(([lvl, p, s]) => s > 0)
              .map(([level, price, size]) => ({ price, size }))
              .sort((a, b) => a.price - b.price);
          }

          // Traded volume by price
          if (rc.trd && rc.trd.length > 0) {
            runner.tradedVolumeByPrice = rc.trd.map(([price, size]) => ({ price, size }));
          }

          // BSP data (if available on BSP markets)
          if (rc.spn != null) runner.bspNearPrice = rc.spn;
          if (rc.spf != null) runner.bspFarPrice = rc.spf;
          if (rc.spb != null) runner.spAvailable = rc.spb;
          if (rc.spl != null) runner.spTraded = rc.spl;

          // Calculate market microstructure metrics
          const bbp = runner.bestBackPrice || 0;
          const blp = runner.bestLayPrice || 0;
          const bbs = runner.bestBackSize || 0;
          const bls = runner.bestLaySize || 0;

          // Mid price = (best back + best lay) / 2
          if (bbp > 0 && blp > 0) {
            runner.midPrice = (bbp + blp) / 2;
          }

          // Weighted mid price = (back * laySize + lay * backSize) / (backSize + laySize)
          if (bbp > 0 && blp > 0 && (bbs + bls) > 0) {
            runner.weightedMidPrice = (bbp * bls + blp * bbs) / (bbs + bls);
            // Micro price (same formula as weighted mid for best prices)
            runner.microPrice = runner.weightedMidPrice;
          }

          // Back/lay pressure and order book imbalance
          const totalBackSize = runner.availableToBackLadder?.reduce((s, l) => s + l.size, 0) || bbs;
          const totalLaySize = runner.availableToLayLadder?.reduce((s, l) => s + l.size, 0) || bls;
          runner.backPressure = totalBackSize;
          runner.layPressure = totalLaySize;
          if (totalBackSize + totalLaySize > 0) {
            runner.orderBookImbalance = (totalBackSize - totalLaySize) / (totalBackSize + totalLaySize);
          }

          // Traded volume delta (change since last update)
          if (runner._lastTradedVolume > 0) {
            runner.tradedVolumeDelta = (runner.tradedVolume || 0) - runner._lastTradedVolume;
          }
          runner._lastTradedVolume = runner.tradedVolume || 0;

          // Price movement tracking (short term = last tick, medium term = last 30 ticks)
          if (rc.ltp != null) {
            if (!runner._priceHistory) runner._priceHistory = [];
            runner._priceHistory.push(rc.ltp);
            if (runner._priceHistory.length > 30) runner._priceHistory.shift();

            if (runner._priceHistory.length >= 2) {
              const hist = runner._priceHistory;
              const prev = hist[hist.length - 2];
              runner.priceMovementShortTerm = rc.ltp - prev;
            }
            if (runner._priceHistory.length >= 10) {
              const hist = runner._priceHistory;
              const earlier = hist[hist.length - 10];
              runner.priceMovementMediumTerm = ((rc.ltp - earlier) / earlier) * 100;
            }
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

  _parseRaceNumber(marketName, eventName) {
    const text = `${marketName || ''} ${eventName || ''}`;
    const match = text.match(/\bR(\d+)\b/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  _updateRanks() {
    for (const market of this.markets.values()) {
      const runners = [...market.runners.values()];
      // Favourite rank — sorted by best back price (lowest = favourite)
      runners.sort((a, b) => (a.bestBackPrice || 9999) - (b.bestBackPrice || 9999));
      runners.forEach((r, idx) => {
        r.favouriteRank = idx + 1;
        r.isFavourite = idx === 0;
        r.isOutsider = idx === runners.length - 1;
      });
      // Liquidity rank — sorted by total traded volume (highest = most liquid)
      const byLiquidity = [...runners].sort((a, b) => (b.tradedVolume || 0) - (a.tradedVolume || 0));
      byLiquidity.forEach((r, idx) => {
        r.liquidityRank = idx + 1;
      });
      // Book percentage — sum of implied probabilities across all runners
      const bookPct = runners.reduce((sum, r) => {
        return sum + (r.bestBackPrice > 0 ? (1 / r.bestBackPrice) * 100 : 0);
      }, 0);
      runners.forEach(r => {
        r.bookPercentage = bookPct;
      });
    }
  }

  _getActiveMarkets() {
    const now = Date.now();
    const markets = [];
    for (const m of this.markets.values()) {
      if (m.status === 'CLOSED' || m.status === 'SETTLED') continue;
      // Today's markets only — skip races that aren't today
      if (m.startTime) {
        const start = new Date(m.startTime).getTime();
        if (!isNaN(start)) {
          // Skip markets that jumped more than 30 min ago (in-play/settling, not tradeable pre-off)
          if (start < now - 30 * 60 * 1000) continue;
          // Skip markets more than 24h away (tomorrow+, not today)
          if (start > now + 24 * 60 * 60 * 1000) continue;
        }
      }
      markets.push(m);
    }
    // Sort by next to jump (earliest start time first)
    markets.sort((a, b) => {
      const aTime = a.startTime ? new Date(a.startTime).getTime() : Infinity;
      const bTime = b.startTime ? new Date(b.startTime).getTime() : Infinity;
      return aTime - bTime;
    });
    return markets;
  }

  _getMarketsArray() {
    return this._getActiveMarkets().map(m => {
      const runnerCount = m.runners.size;
      return {
        id: m.id,
        betfairMarketId: m.betfairMarketId,
        eventType: m.eventType,
        country: m.country,
        venue: m.venue,
        eventName: m.eventName,
        marketName: m.marketName,
        marketType: m.marketType,
        startTime: m.startTime,
        marketStartTime: m.marketStartTime || m.startTime,
        raceNumber: m.raceNumber || 0,
        status: m.status,
        inPlay: m.inPlay,
        totalMatched: m.totalMatched,
        numberOfRunners: m.numberOfRunners || runnerCount,
        numberOfActiveRunners: m.numberOfActiveRunners || runnerCount,
        betDelay: m.betDelay,
        bspMarket: m.bspMarket,
        marketBaseRate: m.marketBaseRate,
        watched: m.watched,
      };
    });
  }

  _getRunnersArray() {
    const runners = [];
    for (const m of this._getActiveMarkets()) {
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
    if (this.watchdogTimer) { clearInterval(this.watchdogTimer); this.watchdogTimer = null; }
    if (this.onStatusChange) this.onStatusChange('disconnected');
    if (!this.shouldReconnect) return;

    const neverConnected = !this.subscribed;
    const shouldRetry = event.code !== 1000 || neverConnected;

    if (shouldRetry) {
      this._reconnectAttempts = (this._reconnectAttempts || 0) + 1;
      if (this._reconnectAttempts <= 3) {
        if (this.onError) this.onError(`WebSocket closed (code ${event.code}${event.reason ? ': ' + event.reason : ''}). Reconnect attempt ${this._reconnectAttempts}/3...`);
        this.reconnectTimer = setTimeout(() => this.connect(true), 5000);
      } else {
        if (this.onError) this.onError(`Stream failed after 3 attempts. Last close code: ${event.code}. Check your Betfair session token and app key are valid.`);
        if (this.onStatusChange) this.onStatusChange('error');
      }
    }
  }

  _onError() {
    // Browser WebSocket onerror events carry no useful detail (no message/code/reason).
    // The actionable info comes from onclose (code + reason), which always fires after onerror.
    // So we skip logging here to avoid duplicate, uninformative error entries.
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.watchdogTimer) {
      clearInterval(this.watchdogTimer);
      this.watchdogTimer = null;
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