const clean = value => String(value ?? '').trim();
const slug = value => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function parseCanonicalRaceNumber(...values) {
  for (const value of values) {
    const explicit = Number(value?.raceNumber ?? value);
    if (Number.isInteger(explicit) && explicit > 0) return explicit;
    const text = typeof value === 'object' ? [value?.marketName, value?.eventName, value?.raceName].join(' ') : String(value || '');
    const match = text.match(/(?:^|\s)R(?:ACE)?\s*(\d+)\b/i);
    if (match) return Number(match[1]);
  }
  return 0;
}

export function canonicalStartTime(value) {
  const source = value?.raceStartTime || value?.marketStartTime || value?.startTime || null;
  const ms = new Date(source || 0).getTime();
  return Number.isFinite(ms) && ms > 0 ? new Date(ms).toISOString() : null;
}

export function compactRaceStart(value) {
  const iso = canonicalStartTime(value);
  return iso ? iso.replace(/[-:]/g, '').replace('.000', '') : 'unknown';
}

export function pairedWinMarket(value, markets = []) {
  const eventId = clean(value?.eventId || value?.betfairEventId);
  const start = canonicalStartTime(value);
  return markets.find(market => {
    const type = clean(market?.marketTypeCode || market?.marketType).toUpperCase();
    return (type === 'WIN' || type === 'WIN_MARKET') && clean(market?.eventId || market?.betfairEventId) === eventId && canonicalStartTime(market) === start && parseCanonicalRaceNumber(market) > 0;
  }) || null;
}

export function canonicalRaceIdentity(value = {}, pairedMarkets = []) {
  const pairedWin = pairedWinMarket(value, pairedMarkets);
  const eventId = clean(value.eventId || value.betfairEventId || pairedWin?.eventId || pairedWin?.betfairEventId);
  const raceNumber = parseCanonicalRaceNumber(value, pairedWin);
  const startTime = canonicalStartTime(value) || canonicalStartTime(pairedWin);
  const venue = clean(value.venue || value.eventName || pairedWin?.venue || pairedWin?.eventName);
  const meetingId = eventId || slug(venue) || 'unknown';
  return {
    eventId,
    betfairEventId: clean(value.betfairEventId || value.eventId || pairedWin?.betfairEventId || pairedWin?.eventId),
    raceNumber,
    startTime,
    raceStartTime: startTime,
    venue,
    canonicalRaceKey: `race:${meetingId}:${raceNumber}:${compactRaceStart({ startTime })}`,
  };
}

export function applyCanonicalRaceIdentity(values = []) {
  return values.map(value => { const identity=canonicalRaceIdentity(value,values); return {...value,...identity,canonicalRaceKey:identity.canonicalRaceKey,raceKey:identity.canonicalRaceKey}; });
}