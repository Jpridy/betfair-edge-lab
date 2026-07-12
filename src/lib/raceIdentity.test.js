import { describe, expect, it } from 'vitest';
import { applyCanonicalRaceIdentity, canonicalRaceIdentity } from './raceIdentity';

describe('canonical race identity',()=>{
  it('keeps Grafton R2 and R4 distinct',()=>{const base={eventId:'3580',eventName:'Grafton',marketStartTime:'2026-07-12T04:00:00Z'};expect(canonicalRaceIdentity({...base,raceNumber:2}).canonicalRaceKey).not.toBe(canonicalRaceIdentity({...base,raceNumber:4}).canonicalRaceKey);});
  it('joins Narrandera WIN and PLACE when PLACE race number is zero',()=>{const markets=[{eventId:'35807338',raceNumber:5,marketTypeCode:'WIN',marketStartTime:'2026-07-12T04:35:00Z',eventName:'Narrandera'},{eventId:'35807338',raceNumber:0,marketTypeCode:'PLACE',marketStartTime:'2026-07-12T04:35:00Z',eventName:'Narrandera'}];const rows=applyCanonicalRaceIdentity(markets);expect(rows[0].canonicalRaceKey).toBe('race:35807338:5:20260712T043500Z');expect(rows[1].canonicalRaceKey).toBe(rows[0].canonicalRaceKey);});
});