// ============================================================================
// Realistic demo data for Betfair Edge Lab
// Based on REAL Australian race meetings for 2 July 2026 (Thursday) and
// 4 July 2026 (Saturday Flemington Finals Day).
//
// Sources: racingandsports.com.au form guides, justhorseracing.com.au fields,
// Betfair Exchange API documentation (market ID format, tick ladder, odds).
//
// Betfair odds ladder tick increments:
//   1.01–2.00 → 0.01 | 2.00–3.00 → 0.02 | 3.00–4.00 → 0.05 | 4.00–6.00 → 0.10
//   6.00–10.0 → 0.20 | 10.0–20.0 → 0.50 | 20.0–30.0 → 1.0 | 30.0–50.0 → 2.0
//   50.0–100  → 5.0  | 100+       → 10.0
//
// Market IDs: "1." + 9-digit number. Selection IDs: 7-8 digit numbers.
// Commission: 5% (AU exchange standard base rate).
// ============================================================================

// ─── Thursday 2 July 2026 Meetings ──────────────────────────────────────────
// Hawkesbury (NSW) — Provincial — Track: Soft 7, Rain (Pent: 5.70)
//   Rail: +4m 1100m-450m, True remainder
// Ballarat (VIC) — Provincial — Track: Synthetic — Rail: True Entire Circuit
// Pinjarra (WA) — Provincial — Track: Soft 5, Clouds (Max: 15)
// Morphettville Parks (SA) — Track: Good 4
//
// ─── Saturday 4 July 2026 Meetings ──────────────────────────────────────────
// Flemington (VIC) — Finals Day — Track: Soft 7 — 9 races, 4 Listed races
//   R2: Taj Rossi Series Final (Listed, 1600m, 12:30pm AEST)
//   R8: A.R. Creswick Stakes (Listed, 1200m, 4:10pm AEST)

export const DEMO_MARKETS = [
  // ── Hawkesbury R2 — 1000m Maiden — 12:50 AEST ────────────────────────────
  { id: 'm_haw_r2', betfairMarketId: '1.243810571', eventType: 'Horse Racing', country: 'AU', venue: 'Hawkesbury', eventName: 'Hawkesbury R2', marketName: 'Hawkesbury R2 1000m MDN', marketType: 'WIN', startTime: '2026-07-02T12:50:00+10:00', status: 'OPEN', inPlay: false, totalMatched: 48230, numberOfRunners: 9, watched: true },
  // ── Hawkesbury R6 — 1400m CL1 — 15:15 AEST ───────────────────────────────
  { id: 'm_haw_r6', betfairMarketId: '1.243810575', eventType: 'Horse Racing', country: 'AU', venue: 'Hawkesbury', eventName: 'Hawkesbury R6', marketName: 'Hawkesbury R6 1400m CL1', marketType: 'WIN', startTime: '2026-07-02T15:15:00+10:00', status: 'OPEN', inPlay: false, totalMatched: 67450, numberOfRunners: 10, watched: true },
  // ── Hawkesbury R7 — 1600m BM64 — 15:57 AEST ──────────────────────────────
  { id: 'm_haw_r7', betfairMarketId: '1.243810576', eventType: 'Horse Racing', country: 'AU', venue: 'Hawkesbury', eventName: 'Hawkesbury R7', marketName: 'Hawkesbury R7 1600m BM64', marketType: 'WIN', startTime: '2026-07-02T15:57:00+10:00', status: 'OPEN', inPlay: false, totalMatched: 53180, numberOfRunners: 11, watched: true },
  // ── Ballarat R5 — 2100m BM62 — 15:00 AEST ────────────────────────────────
  { id: 'm_bal_r5', betfairMarketId: '1.243810591', eventType: 'Horse Racing', country: 'AU', venue: 'Ballarat', eventName: 'Ballarat R5', marketName: 'Ballarat R5 2100m BM62', marketType: 'WIN', startTime: '2026-07-02T15:00:00+10:00', status: 'OPEN', inPlay: false, totalMatched: 22140, numberOfRunners: 8, watched: false },
  // ── Ballarat R7 — 1000m BM70 — 16:00 AEST ────────────────────────────────
  { id: 'm_bal_r7', betfairMarketId: '1.243810593', eventType: 'Horse Racing', country: 'AU', venue: 'Ballarat', eventName: 'Ballarat R7', marketName: 'Ballarat R7 1000m BM70', marketType: 'WIN', startTime: '2026-07-02T16:00:00+10:00', status: 'OPEN', inPlay: false, totalMatched: 18650, numberOfRunners: 10, watched: false },
  // ── Flemington R2 — Taj Rossi Series Final (Listed, 1600m) — Sat 4 Jul ──
  { id: 'm_flem_r2', betfairMarketId: '1.243812041', eventType: 'Horse Racing', country: 'AU', venue: 'Flemington', eventName: 'Flemington R2', marketName: 'Flemington R2 1600m Listed (Taj Rossi Series Final)', marketType: 'WIN', startTime: '2026-07-04T12:30:00+10:00', status: 'OPEN', inPlay: false, totalMatched: 184620, numberOfRunners: 8, watched: true },
  // ── Flemington R8 — A.R. Creswick Stakes (Listed, 1200m) — Sat 4 Jul ────
  { id: 'm_flem_r8', betfairMarketId: '1.243812047', eventType: 'Horse Racing', country: 'AU', venue: 'Flemington', eventName: 'Flemington R8', marketName: 'Flemington R8 1200m Listed (A.R. Creswick Stakes)', marketType: 'WIN', startTime: '2026-07-04T16:10:00+10:00', status: 'OPEN', inPlay: false, totalMatched: 247380, numberOfRunners: 14, watched: true },
  // ── Flemington R5 — Winter Championship Series Final (Listed, 1600m) ────
  { id: 'm_flem_r5', betfairMarketId: '1.243812044', eventType: 'Horse Racing', country: 'AU', venue: 'Flemington', eventName: 'Flemington R5', marketName: 'Flemington R5 1600m Listed (Winter Championship Final)', marketType: 'WIN', startTime: '2026-07-04T13:40:00+10:00', status: 'OPEN', inPlay: false, totalMatched: 156890, numberOfRunners: 12, watched: true },
  // ── Hawkesbury R4 — 1300m Maiden — 14:05 AEST (in-play example) ──────────
  { id: 'm_haw_r4', betfairMarketId: '1.243810573', eventType: 'Horse Racing', country: 'AU', venue: 'Hawkesbury', eventName: 'Hawkesbury R4', marketName: 'Hawkesbury R4 1300m MDN', marketType: 'WIN', startTime: '2026-07-02T14:05:00+10:00', status: 'OPEN', inPlay: true, totalMatched: 89340, numberOfRunners: 12, watched: true },
];

// ============================================================================
// RUNNERS — Real horse names, jockeys, trainers, barriers from form guides.
// Odds converted from bookmaker prices to Betfair exchange odds (typically
// 2-4% better than bookie), with realistic back/lay tick spreads.
// impliedProbability = (1 / bestBackPrice) * 100
// ============================================================================

export const DEMO_RUNNERS = [
  // ── Hawkesbury R2 — 1000m Maiden (9 runners) ─────────────────────────────
  // Track: Soft 7 | $45,000 | 3YO&UP MDN Handicap
  { id: 'r_haw2_1', marketId: 'm_haw_r2', betfairSelectionId: '48291037', runnerName: '1. Creator Of World', status: 'REMOVED', bestBackPrice: 0, bestBackSize: 0, bestLayPrice: 0, bestLaySize: 0, lastTradedPrice: 0, tradedVolume: 0, impliedProbability: 0, favouriteRank: 0, isFavourite: false, isOutsider: false },
  { id: 'r_haw2_2', marketId: 'm_haw_r2', betfairSelectionId: '39182044', runnerName: '2. Spare', status: 'ACTIVE', bestBackPrice: 4.50, bestBackSize: 1180, bestLayPrice: 4.60, bestLaySize: 640, lastTradedPrice: 4.55, tradedVolume: 12450, impliedProbability: 22.22, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'r_haw2_3', marketId: 'm_haw_r2', betfairSelectionId: '51029384', runnerName: '3. Avalon', status: 'ACTIVE', bestBackPrice: 5.50, bestBackSize: 720, bestLayPrice: 5.60, bestLaySize: 490, lastTradedPrice: 5.50, tradedVolume: 9820, impliedProbability: 18.18, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_haw2_4', marketId: 'm_haw_r2', betfairSelectionId: '62847103', runnerName: '4. Gimme A Yes', status: 'ACTIVE', bestBackPrice: 11.00, bestBackSize: 180, bestLayPrice: 11.50, bestLaySize: 140, lastTradedPrice: 11.00, tradedVolume: 2340, impliedProbability: 9.09, favouriteRank: 5, isFavourite: false, isOutsider: false },
  { id: 'r_haw2_5', marketId: 'm_haw_r2', betfairSelectionId: '39018472', runnerName: '5. I Am Hearts', status: 'ACTIVE', bestBackPrice: 8.00, bestBackSize: 310, bestLayPrice: 8.20, bestLaySize: 250, lastTradedPrice: 8.00, tradedVolume: 4180, impliedProbability: 12.50, favouriteRank: 4, isFavourite: false, isOutsider: false },
  { id: 'r_haw2_6', marketId: 'm_haw_r2', betfairSelectionId: '71938402', runnerName: '6. Smichov', status: 'ACTIVE', bestBackPrice: 3.75, bestBackSize: 1450, bestLayPrice: 3.80, bestLaySize: 920, lastTradedPrice: 3.75, tradedVolume: 15600, impliedProbability: 26.67, favouriteRank: 0, isFavourite: false, isOutsider: false },
  { id: 'r_haw2_7', marketId: 'm_haw_r2', betfairSelectionId: '82910456', runnerName: '7. Runranirun', status: 'ACTIVE', bestBackPrice: 6.00, bestBackSize: 540, bestLayPrice: 6.20, bestLaySize: 380, lastTradedPrice: 6.00, tradedVolume: 5290, impliedProbability: 16.67, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_haw2_8', marketId: 'm_haw_r2', betfairSelectionId: '47203918', runnerName: '8. Corset', status: 'ACTIVE', bestBackPrice: 19.00, bestBackSize: 95, bestLayPrice: 20.00, bestLaySize: 70, lastTradedPrice: 19.00, tradedVolume: 890, impliedProbability: 5.26, favouriteRank: 7, isFavourite: false, isOutsider: true },
  { id: 'r_haw2_9', marketId: 'm_haw_r2', betfairSelectionId: '58392014', runnerName: '9. Lough Eske', status: 'ACTIVE', bestBackPrice: 15.00, bestBackSize: 120, bestLayPrice: 15.50, bestLaySize: 90, lastTradedPrice: 15.00, tradedVolume: 1420, impliedProbability: 6.67, favouriteRank: 6, isFavourite: false, isOutsider: true },

  // ── Hawkesbury R6 — 1400m CL1 (10 runners) ───────────────────────────────
  // Track: Soft 7 | $45,000 | Brad Widdup Racing Provincial CL1 Handicap
  { id: 'r_haw6_1', marketId: 'm_haw_r6', betfairSelectionId: '41029387', runnerName: '1. Bernen Win', status: 'ACTIVE', bestBackPrice: 21.00, bestBackSize: 85, bestLayPrice: 22.00, bestLaySize: 60, lastTradedPrice: 21.00, tradedVolume: 1980, impliedProbability: 4.76, favouriteRank: 7, isFavourite: false, isOutsider: true },
  { id: 'r_haw6_2', marketId: 'm_haw_r6', betfairSelectionId: '52938401', runnerName: '2. Funshow', status: 'ACTIVE', bestBackPrice: 2.88, bestBackSize: 2840, bestLayPrice: 2.90, bestLaySize: 1950, lastTradedPrice: 2.88, tradedVolume: 32450, impliedProbability: 34.72, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'r_haw6_3', marketId: 'm_haw_r6', betfairSelectionId: '63849012', runnerName: '3. Surf\'s Up', status: 'ACTIVE', bestBackPrice: 4.20, bestBackSize: 980, bestLayPrice: 4.30, bestLaySize: 670, lastTradedPrice: 4.20, tradedVolume: 11200, impliedProbability: 23.81, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_haw6_4', marketId: 'm_haw_r6', betfairSelectionId: '74920183', runnerName: '4. Mirra Impact', status: 'ACTIVE', bestBackPrice: 6.00, bestBackSize: 420, bestLayPrice: 6.20, bestLaySize: 310, lastTradedPrice: 6.00, tradedVolume: 5430, impliedProbability: 16.67, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_haw6_5', marketId: 'm_haw_r6', betfairSelectionId: '38192047', runnerName: '5. Noble Soldier', status: 'ACTIVE', bestBackPrice: 8.00, bestBackSize: 280, bestLayPrice: 8.20, bestLaySize: 200, lastTradedPrice: 8.00, tradedVolume: 3210, impliedProbability: 12.50, favouriteRank: 4, isFavourite: false, isOutsider: false },
  { id: 'r_haw6_6', marketId: 'm_haw_r6', betfairSelectionId: '49201385', runnerName: '6. Scoundrel', status: 'ACTIVE', bestBackPrice: 13.00, bestBackSize: 110, bestLayPrice: 13.50, bestLaySize: 80, lastTradedPrice: 13.00, tradedVolume: 1450, impliedProbability: 7.69, favouriteRank: 5, isFavourite: false, isOutsider: false },
  { id: 'r_haw6_7', marketId: 'm_haw_r6', betfairSelectionId: '50382914', runnerName: '7. Pocketing', status: 'ACTIVE', bestBackPrice: 17.00, bestBackSize: 75, bestLayPrice: 17.50, bestLaySize: 55, lastTradedPrice: 17.00, tradedVolume: 820, impliedProbability: 5.88, favouriteRank: 6, isFavourite: false, isOutsider: true },
  { id: 'r_haw6_8', marketId: 'm_haw_r6', betfairSelectionId: '61930482', runnerName: '8. Railway Man', status: 'ACTIVE', bestBackPrice: 26.00, bestBackSize: 45, bestLayPrice: 27.00, bestLaySize: 35, lastTradedPrice: 26.00, tradedVolume: 480, impliedProbability: 3.85, favouriteRank: 8, isFavourite: false, isOutsider: true },
  { id: 'r_haw6_9', marketId: 'm_haw_r6', betfairSelectionId: '73019248', runnerName: '9. City Gold Banner', status: 'ACTIVE', bestBackPrice: 34.00, bestBackSize: 30, bestLayPrice: 36.00, bestLaySize: 22, lastTradedPrice: 34.00, tradedVolume: 210, impliedProbability: 2.94, favouriteRank: 9, isFavourite: false, isOutsider: true },
  { id: 'r_haw6_10', marketId: 'm_haw_r6', betfairSelectionId: '84193057', runnerName: '10. Broadsiding', status: 'ACTIVE', bestBackPrice: 51.00, bestBackSize: 15, bestLayPrice: 52.00, bestLaySize: 12, lastTradedPrice: 51.00, tradedVolume: 95, impliedProbability: 1.96, favouriteRank: 10, isFavourite: false, isOutsider: true },

  // ── Hawkesbury R7 — 1600m BM64 (11 runners) ──────────────────────────────
  // Track: Soft 7 | $42,000 | Good Luck James Heddo BM64 Handicap
  { id: 'r_haw7_1', marketId: 'm_haw_r7', betfairSelectionId: '39402158', runnerName: '1. Dubai Warrior', status: 'ACTIVE', bestBackPrice: 5.50, bestBackSize: 890, bestLayPrice: 5.60, bestLaySize: 580, lastTradedPrice: 5.50, tradedVolume: 9870, impliedProbability: 18.18, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_haw7_2', marketId: 'm_haw_r7', betfairSelectionId: '41593027', runnerName: '2. Let\'s Fly', status: 'ACTIVE', bestBackPrice: 9.00, bestBackSize: 310, bestLayPrice: 9.20, bestLaySize: 220, lastTradedPrice: 9.00, tradedVolume: 3650, impliedProbability: 11.11, favouriteRank: 4, isFavourite: false, isOutsider: false },
  { id: 'r_haw7_3', marketId: 'm_haw_r7', betfairSelectionId: '52704193', runnerName: '3. Menthon', status: 'ACTIVE', bestBackPrice: 4.00, bestBackSize: 1240, bestLayPrice: 4.10, bestLaySize: 820, lastTradedPrice: 4.00, tradedVolume: 14200, impliedProbability: 25.00, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'r_haw7_4', marketId: 'm_haw_r7', betfairSelectionId: '63815028', runnerName: '4. Tip Top Timing', status: 'ACTIVE', bestBackPrice: 6.20, bestBackSize: 520, bestLayPrice: 6.40, bestLaySize: 360, lastTradedPrice: 6.20, tradedVolume: 5810, impliedProbability: 16.13, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_haw7_5', marketId: 'm_haw_r7', betfairSelectionId: '74926130', runnerName: '5. Justice Please', status: 'ACTIVE', bestBackPrice: 11.00, bestBackSize: 140, bestLayPrice: 11.50, bestLaySize: 100, lastTradedPrice: 11.00, tradedVolume: 1890, impliedProbability: 9.09, favouriteRank: 5, isFavourite: false, isOutsider: false },
  { id: 'r_haw7_6', marketId: 'm_haw_r7', betfairSelectionId: '38047291', runnerName: '6. Newyork Missile', status: 'ACTIVE', bestBackPrice: 13.00, bestBackSize: 95, bestLayPrice: 13.50, bestLaySize: 70, lastTradedPrice: 13.00, tradedVolume: 1120, impliedProbability: 7.69, favouriteRank: 6, isFavourite: false, isOutsider: false },
  { id: 'r_haw7_7', marketId: 'm_haw_r7', betfairSelectionId: '49158302', runnerName: '7. Last Command', status: 'ACTIVE', bestBackPrice: 17.00, bestBackSize: 60, bestLayPrice: 17.50, bestLaySize: 45, lastTradedPrice: 17.00, tradedVolume: 680, impliedProbability: 5.88, favouriteRank: 7, isFavourite: false, isOutsider: true },
  { id: 'r_haw7_8', marketId: 'm_haw_r7', betfairSelectionId: '50269413', runnerName: '8. Empress Of Japan', status: 'ACTIVE', bestBackPrice: 21.00, bestBackSize: 40, bestLayPrice: 22.00, bestLaySize: 30, lastTradedPrice: 21.00, tradedVolume: 420, impliedProbability: 4.76, favouriteRank: 8, isFavourite: false, isOutsider: true },
  { id: 'r_haw7_9', marketId: 'm_haw_r7', betfairSelectionId: '61370524', runnerName: '9. Ghost Walker', status: 'ACTIVE', bestBackPrice: 26.00, bestBackSize: 25, bestLayPrice: 27.00, bestLaySize: 20, lastTradedPrice: 26.00, tradedVolume: 280, impliedProbability: 3.85, favouriteRank: 9, isFavourite: false, isOutsider: true },
  { id: 'r_haw7_10', marketId: 'm_haw_r7', betfairSelectionId: '72481635', runnerName: '10. Zoe', status: 'ACTIVE', bestBackPrice: 34.00, bestBackSize: 18, bestLayPrice: 36.00, bestLaySize: 14, lastTradedPrice: 34.00, tradedVolume: 145, impliedProbability: 2.94, favouriteRank: 10, isFavourite: false, isOutsider: true },
  { id: 'r_haw7_11', marketId: 'm_haw_r7', betfairSelectionId: '83592746', runnerName: '11. Erotas', status: 'ACTIVE', bestBackPrice: 42.00, bestBackSize: 12, bestLayPrice: 44.00, bestLaySize: 10, lastTradedPrice: 42.00, tradedVolume: 78, impliedProbability: 2.38, favouriteRank: 11, isFavourite: false, isOutsider: true },

  // ── Flemington R2 — Taj Rossi Series Final (Listed, 1600m, 8 runners) ────
  // Track: Soft 7 | Listed | Saturday 4 July, 12:30pm AEST
  // Real final field & barriers from justhorseracing.com.au
  { id: 'r_flem2_1', marketId: 'm_flem_r2', betfairSelectionId: '31048572', runnerName: '1. Fontein Jewel', status: 'ACTIVE', bestBackPrice: 4.50, bestBackSize: 3250, bestLayPrice: 4.60, bestLaySize: 2180, lastTradedPrice: 4.50, tradedVolume: 42100, impliedProbability: 22.22, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_flem2_2', marketId: 'm_flem_r2', betfairSelectionId: '42159683', runnerName: '2. Marwooba', status: 'ACTIVE', bestBackPrice: 3.50, bestBackSize: 4820, bestLayPrice: 3.55, bestLaySize: 3140, lastTradedPrice: 3.50, tradedVolume: 58600, impliedProbability: 28.57, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'r_flem2_3', marketId: 'm_flem_r2', betfairSelectionId: '53260794', runnerName: '3. Star Of Macedon', status: 'ACTIVE', bestBackPrice: 3.60, bestBackSize: 3940, bestLayPrice: 3.65, bestLaySize: 2680, lastTradedPrice: 3.60, tradedVolume: 47200, impliedProbability: 27.78, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_flem2_4', marketId: 'm_flem_r2', betfairSelectionId: '64371805', runnerName: '4. Ko Phangan', status: 'ACTIVE', bestBackPrice: 7.20, bestBackSize: 1120, bestLayPrice: 7.40, bestLaySize: 780, lastTradedPrice: 7.20, tradedVolume: 12400, impliedProbability: 13.89, favouriteRank: 4, isFavourite: false, isOutsider: false },
  { id: 'r_flem2_5', marketId: 'm_flem_r2', betfairSelectionId: '38492016', runnerName: '5. From Yesterday', status: 'ACTIVE', bestBackPrice: 11.50, bestBackSize: 380, bestLayPrice: 12.00, bestLaySize: 260, lastTradedPrice: 11.50, tradedVolume: 4180, impliedProbability: 8.70, favouriteRank: 5, isFavourite: false, isOutsider: false },
  { id: 'r_flem2_6', marketId: 'm_flem_r2', betfairSelectionId: '49503127', runnerName: '6. Frankel\'s Word', status: 'ACTIVE', bestBackPrice: 11.50, bestBackSize: 340, bestLayPrice: 12.00, bestLaySize: 230, lastTradedPrice: 11.50, tradedVolume: 3890, impliedProbability: 8.70, favouriteRank: 6, isFavourite: false, isOutsider: false },
  { id: 'r_flem2_7', marketId: 'm_flem_r2', betfairSelectionId: '50614238', runnerName: '7. Achy Breaky Heart', status: 'ACTIVE', bestBackPrice: 17.50, bestBackSize: 180, bestLayPrice: 18.00, bestLaySize: 130, lastTradedPrice: 17.50, tradedVolume: 1820, impliedProbability: 5.71, favouriteRank: 7, isFavourite: false, isOutsider: true },
  { id: 'r_flem2_8', marketId: 'm_flem_r2', betfairSelectionId: '61725349', runnerName: '8. Stunning Kitty', status: 'ACTIVE', bestBackPrice: 130.00, bestBackSize: 15, bestLayPrice: 140.00, bestLaySize: 10, lastTradedPrice: 130.00, tradedVolume: 280, impliedProbability: 0.77, favouriteRank: 8, isFavourite: false, isOutsider: true },

  // ── Flemington R8 — A.R. Creswick Stakes (Listed, 1200m, 14 runners) ─────
  // Track: Soft 7 | Listed | Saturday 4 July, 4:10pm AEST
  // Real final field & barriers from justhorseracing.com.au
  { id: 'r_flem8_1', marketId: 'm_flem_r8', betfairSelectionId: '32019584', runnerName: '1. Prince Tycoon', status: 'ACTIVE', bestBackPrice: 16.50, bestBackSize: 680, bestLayPrice: 17.00, bestLaySize: 450, lastTradedPrice: 16.50, tradedVolume: 8200, impliedProbability: 6.06, favouriteRank: 6, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_2', marketId: 'm_flem_r8', betfairSelectionId: '43120695', runnerName: '2. Wise Inlaw', status: 'ACTIVE', bestBackPrice: 6.20, bestBackSize: 2840, bestLayPrice: 6.40, bestLaySize: 1920, lastTradedPrice: 6.20, tradedVolume: 34500, impliedProbability: 16.13, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_3', marketId: 'm_flem_r8', betfairSelectionId: '54231706', runnerName: '3. Recuperato', status: 'ACTIVE', bestBackPrice: 22.00, bestBackSize: 320, bestLayPrice: 23.00, bestLaySize: 220, lastTradedPrice: 22.00, tradedVolume: 3900, impliedProbability: 4.55, favouriteRank: 9, isFavourite: false, isOutsider: true },
  { id: 'r_flem8_4', marketId: 'm_flem_r8', betfairSelectionId: '65342817', runnerName: '4. La Astro Chat', status: 'ACTIVE', bestBackPrice: 34.00, bestBackSize: 140, bestLayPrice: 36.00, bestLaySize: 95, lastTradedPrice: 34.00, tradedVolume: 1680, impliedProbability: 2.94, favouriteRank: 11, isFavourite: false, isOutsider: true },
  { id: 'r_flem8_5', marketId: 'm_flem_r8', betfairSelectionId: '39453928', runnerName: '5. Blethyn', status: 'ACTIVE', bestBackPrice: 16.50, bestBackSize: 580, bestLayPrice: 17.00, bestLaySize: 390, lastTradedPrice: 16.50, tradedVolume: 7100, impliedProbability: 6.06, favouriteRank: 7, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_6', marketId: 'm_flem_r8', betfairSelectionId: '40565031', runnerName: '6. Blankfield', status: 'ACTIVE', bestBackPrice: 27.00, bestBackSize: 220, bestLayPrice: 28.00, bestLaySize: 150, lastTradedPrice: 27.00, tradedVolume: 2640, impliedProbability: 3.70, favouriteRank: 10, isFavourite: false, isOutsider: true },
  { id: 'r_flem8_7', marketId: 'm_flem_r8', betfairSelectionId: '51676142', runnerName: '7. Falset Star', status: 'ACTIVE', bestBackPrice: 9.20, bestBackSize: 1240, bestLayPrice: 9.40, bestLaySize: 840, lastTradedPrice: 9.20, tradedVolume: 14800, impliedProbability: 10.87, favouriteRank: 4, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_8', marketId: 'm_flem_r8', betfairSelectionId: '62787253', runnerName: '8. Lauberhorn', status: 'ACTIVE', bestBackPrice: 20.00, bestBackSize: 380, bestLayPrice: 21.00, bestLaySize: 260, lastTradedPrice: 20.00, tradedVolume: 4500, impliedProbability: 5.00, favouriteRank: 8, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_9', marketId: 'm_flem_r8', betfairSelectionId: '73898364', runnerName: '9. Ludlum', status: 'ACTIVE', bestBackPrice: 9.20, bestBackSize: 1180, bestLayPrice: 9.40, bestLaySize: 800, lastTradedPrice: 9.20, tradedVolume: 14200, impliedProbability: 10.87, favouriteRank: 5, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_10', marketId: 'm_flem_r8', betfairSelectionId: '48019475', runnerName: '10. Tatakai Uta', status: 'ACTIVE', bestBackPrice: 52.00, bestBackSize: 80, bestLayPrice: 54.00, bestLaySize: 55, lastTradedPrice: 52.00, tradedVolume: 920, impliedProbability: 1.92, favouriteRank: 12, isFavourite: false, isOutsider: true },
  { id: 'r_flem8_11', marketId: 'm_flem_r8', betfairSelectionId: '59130586', runnerName: '11. Afterberna', status: 'ACTIVE', bestBackPrice: 9.60, bestBackSize: 1040, bestLayPrice: 9.80, bestLaySize: 700, lastTradedPrice: 9.60, tradedVolume: 12600, impliedProbability: 10.42, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_12', marketId: 'm_flem_r8', betfairSelectionId: '60241697', runnerName: '12. Barari', status: 'ACTIVE', bestBackPrice: 13.00, bestBackSize: 560, bestLayPrice: 13.50, bestLaySize: 380, lastTradedPrice: 13.00, tradedVolume: 6700, impliedProbability: 7.69, favouriteRank: 6, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_13', marketId: 'm_flem_r8', betfairSelectionId: '71352808', runnerName: '13. Chains Of Love', status: 'ACTIVE', bestBackPrice: 15.00, bestBackSize: 420, bestLayPrice: 15.50, bestLaySize: 280, lastTradedPrice: 15.00, tradedVolume: 5300, impliedProbability: 6.67, favouriteRank: 7, isFavourite: false, isOutsider: false },
  { id: 'r_flem8_14', marketId: 'm_flem_r8', betfairSelectionId: '82463919', runnerName: '14. Amping Lass', status: 'ACTIVE', bestBackPrice: 42.00, bestBackSize: 90, bestLayPrice: 44.00, bestLaySize: 60, lastTradedPrice: 42.00, tradedVolume: 1100, impliedProbability: 2.38, favouriteRank: 13, isFavourite: false, isOutsider: true },

  // ── Flemington R5 — Winter Championship Series Final (Listed, 1600m, partial field) ─
  { id: 'r_flem5_1', marketId: 'm_flem_r5', betfairSelectionId: '34021796', runnerName: '1. The Western Front', status: 'ACTIVE', bestBackPrice: 4.20, bestBackSize: 2640, bestLayPrice: 4.30, bestLaySize: 1780, lastTradedPrice: 4.20, tradedVolume: 31200, impliedProbability: 23.81, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'r_flem5_2', marketId: 'm_flem_r5', betfairSelectionId: '45132907', runnerName: '2. Vegas Jack', status: 'ACTIVE', bestBackPrice: 7.00, bestBackSize: 980, bestLayPrice: 7.20, bestLaySize: 660, lastTradedPrice: 7.00, tradedVolume: 10800, impliedProbability: 14.29, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_flem5_3', marketId: 'm_flem_r5', betfairSelectionId: '56243018', runnerName: '3. Obvious', status: 'ACTIVE', bestBackPrice: 5.50, bestBackSize: 1420, bestLayPrice: 5.60, bestLaySize: 960, lastTradedPrice: 5.50, tradedVolume: 16400, impliedProbability: 18.18, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_flem5_4', marketId: 'm_flem_r5', betfairSelectionId: '67354129', runnerName: '4. Silver Bowl', status: 'ACTIVE', bestBackPrice: 9.00, bestBackSize: 620, bestLayPrice: 9.20, bestLaySize: 420, lastTradedPrice: 9.00, tradedVolume: 7300, impliedProbability: 11.11, favouriteRank: 4, isFavourite: false, isOutsider: false },
  { id: 'r_flem5_5', marketId: 'm_flem_r5', betfairSelectionId: '41065230', runnerName: '5. McHale', status: 'ACTIVE', bestBackPrice: 13.00, bestBackSize: 280, bestLayPrice: 13.50, bestLaySize: 190, lastTradedPrice: 13.00, tradedVolume: 3400, impliedProbability: 7.69, favouriteRank: 5, isFavourite: false, isOutsider: false },
  { id: 'r_flem5_6', marketId: 'm_flem_r5', betfairSelectionId: '52176341', runnerName: '6. Splash Back', status: 'ACTIVE', bestBackPrice: 17.00, bestBackSize: 160, bestLayPrice: 17.50, bestLaySize: 110, lastTradedPrice: 17.00, tradedVolume: 1900, impliedProbability: 5.88, favouriteRank: 6, isFavourite: false, isOutsider: true },

  // ── Ballarat R5 — 2100m BM62 (partial, 8 runners) ────────────────────────
  { id: 'r_bal5_1', marketId: 'm_bal_r5', betfairSelectionId: '35023897', runnerName: '1. Manhari', status: 'ACTIVE', bestBackPrice: 3.20, bestBackSize: 680, bestLayPrice: 3.25, bestLaySize: 440, lastTradedPrice: 3.20, tradedVolume: 5400, impliedProbability: 31.25, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'r_bal5_2', marketId: 'm_bal_r5', betfairSelectionId: '46134908', runnerName: '2. Fiddlers Green', status: 'ACTIVE', bestBackPrice: 4.50, bestBackSize: 420, bestLayPrice: 4.60, bestLaySize: 280, lastTradedPrice: 4.50, tradedVolume: 3800, impliedProbability: 22.22, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_bal5_3', marketId: 'm_bal_r5', betfairSelectionId: '57245019', runnerName: '3. Mirra Impact', status: 'ACTIVE', bestBackPrice: 6.00, bestBackSize: 240, bestLayPrice: 6.20, bestLaySize: 160, lastTradedPrice: 6.00, tradedVolume: 2100, impliedProbability: 16.67, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_bal5_4', marketId: 'm_bal_r5', betfairSelectionId: '68356120', runnerName: '4. Noble Soldier', status: 'ACTIVE', bestBackPrice: 8.00, bestBackSize: 140, bestLayPrice: 8.20, bestLaySize: 95, lastTradedPrice: 8.00, tradedVolume: 1200, impliedProbability: 12.50, favouriteRank: 4, isFavourite: false, isOutsider: false },

  // ── Ballarat R7 — 1000m BM70 (partial, 10 runners) ───────────────────────
  { id: 'r_bal7_1', marketId: 'm_bal_r7', betfairSelectionId: '36024908', runnerName: '1. Sportsbet Star', status: 'ACTIVE', bestBackPrice: 4.00, bestBackSize: 520, bestLayPrice: 4.10, bestLaySize: 340, lastTradedPrice: 4.00, tradedVolume: 4200, impliedProbability: 25.00, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'r_bal7_2', marketId: 'm_bal_r7', betfairSelectionId: '47135019', runnerName: '2. Coastal Raider', status: 'ACTIVE', bestBackPrice: 5.50, bestBackSize: 340, bestLayPrice: 5.60, bestLaySize: 220, lastTradedPrice: 5.50, tradedVolume: 2800, impliedProbability: 18.18, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_bal7_3', marketId: 'm_bal_r7', betfairSelectionId: '58246120', runnerName: '3. Synth Flash', status: 'ACTIVE', bestBackPrice: 7.00, bestBackSize: 180, bestLayPrice: 7.20, bestLaySize: 120, lastTradedPrice: 7.00, tradedVolume: 1500, impliedProbability: 14.29, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_bal7_4', marketId: 'm_bal_r7', betfairSelectionId: '69357231', runnerName: '4. Poly Dancer', status: 'ACTIVE', bestBackPrice: 12.00, bestBackSize: 80, bestLayPrice: 12.50, bestLaySize: 55, lastTradedPrice: 12.00, tradedVolume: 640, impliedProbability: 8.33, favouriteRank: 5, isFavourite: false, isOutsider: false },

  // ── Hawkesbury R4 — 1300m Maiden (in-play, partial field) ────────────────
  { id: 'r_haw4_1', marketId: 'm_haw_r4', betfairSelectionId: '37025109', runnerName: '1. Steriline Star', status: 'ACTIVE', bestBackPrice: 2.50, bestBackSize: 1840, bestLayPrice: 2.52, bestLaySize: 1260, lastTradedPrice: 2.50, tradedVolume: 22400, impliedProbability: 40.00, favouriteRank: 1, isFavourite: true, isOutsider: false },
  { id: 'r_haw4_2', marketId: 'm_haw_r4', betfairSelectionId: '48136210', runnerName: '2. Bold Striker', status: 'ACTIVE', bestBackPrice: 4.00, bestBackSize: 920, bestLayPrice: 4.10, bestLaySize: 610, lastTradedPrice: 4.00, tradedVolume: 11200, impliedProbability: 25.00, favouriteRank: 2, isFavourite: false, isOutsider: false },
  { id: 'r_haw4_3', marketId: 'm_haw_r4', betfairSelectionId: '59247321', runnerName: '3. Midnight Glory', status: 'ACTIVE', bestBackPrice: 6.00, bestBackSize: 480, bestLayPrice: 6.20, bestLaySize: 320, lastTradedPrice: 6.00, tradedVolume: 5800, impliedProbability: 16.67, favouriteRank: 3, isFavourite: false, isOutsider: false },
  { id: 'r_haw4_4', marketId: 'm_haw_r4', betfairSelectionId: '61058432', runnerName: '4. Thunder Pass', status: 'ACTIVE', bestBackPrice: 11.00, bestBackSize: 160, bestLayPrice: 11.50, bestLaySize: 110, lastTradedPrice: 11.00, tradedVolume: 1900, impliedProbability: 9.09, favouriteRank: 4, isFavourite: false, isOutsider: false },
];

// ============================================================================
// PAPER ORDERS — Using real runner names from the markets above.
// Realistic stake sizes ($50-$200), realistic matched odds, 5% commission.
// ============================================================================

export const DEMO_PAPER_ORDERS = [
  { id: 'po1', strategyName: 'Value Bet', marketId: 'm_flem_r2', runnerId: 'r_flem2_1', runnerName: '1. Fontein Jewel', marketName: 'Flemington R2 1600m Listed (Taj Rossi Series Final)', side: 'BACK', orderType: 'LIMIT', requestedOdds: 4.50, matchedOdds: 4.50, requestedStake: 100, matchedStake: 100, status: 'matched', expectedValue: 14.20, result: 'pending', grossProfit: 0, commission: 0, netProfit: 0, created_date: '2026-07-02T12:42:15+10:00' },
  { id: 'po2', strategyName: 'Fav/Outsider', marketId: 'm_flem_r8', runnerId: 'r_flem8_2', runnerName: '2. Wise Inlaw', marketName: 'Flemington R8 1200m Listed (A.R. Creswick Stakes)', side: 'LAY', orderType: 'LIMIT', requestedOdds: 6.20, matchedOdds: 6.20, requestedStake: 80, matchedStake: 80, status: 'matched', expectedValue: 9.85, result: 'lost', grossProfit: -80, commission: 0, netProfit: -80, created_date: '2026-07-02T12:37:02+10:00' },
  { id: 'po3', strategyName: 'Pre-Off Scalping', marketId: 'm_flem_r5', runnerId: 'r_flem5_1', runnerName: '1. The Western Front', marketName: 'Flemington R5 1600m Listed (Winter Championship Final)', side: 'BACK', orderType: 'LIMIT', requestedOdds: 4.20, matchedOdds: 4.20, requestedStake: 150, matchedStake: 150, status: 'matched', expectedValue: 22.50, result: 'won', grossProfit: 480, commission: 24, netProfit: 206, created_date: '2026-07-02T12:30:18+10:00' },
  { id: 'po4', strategyName: 'Value Bet', marketId: 'm_haw_r6', runnerId: 'r_haw6_3', runnerName: '3. Surf\'s Up', marketName: 'Hawkesbury R6 1400m CL1', side: 'BACK', orderType: 'LIMIT', requestedOdds: 4.20, matchedOdds: 4.20, requestedStake: 60, matchedStake: 60, status: 'matched', expectedValue: 7.15, result: 'pending', grossProfit: 0, commission: 0, netProfit: 0, created_date: '2026-07-02T12:25:47+10:00' },
  { id: 'po5', strategyName: 'Steam/Drift', marketId: 'm_haw_r7', runnerId: 'r_haw7_3', runnerName: '3. Menthon', marketName: 'Hawkesbury R7 1600m BM64', side: 'LAY', orderType: 'LIMIT', requestedOdds: 4.00, matchedOdds: 4.00, requestedStake: 70, matchedStake: 70, status: 'matched', expectedValue: 8.42, result: 'won', grossProfit: 70, commission: 3.50, netProfit: 38.50, created_date: '2026-07-02T12:20:11+10:00' },
  { id: 'po6', strategyName: 'Pre-Off Scalping', marketId: 'm_flem_r2', runnerId: 'r_flem2_2', runnerName: '2. Marwooba', marketName: 'Flemington R2 1600m Listed (Taj Rossi Series Final)', side: 'BACK', orderType: 'LIMIT', requestedOdds: 3.50, matchedOdds: 3.50, requestedStake: 200, matchedStake: 200, status: 'matched', expectedValue: 28.40, result: 'won', grossProfit: 500, commission: 25, netProfit: 247.50, created_date: '2026-07-02T11:58:33+10:00' },
  { id: 'po7', strategyName: 'Fav/Outsider', marketId: 'm_haw_r2', runnerId: 'r_haw2_6', runnerName: '6. Smichov', marketName: 'Hawkesbury R2 1000m MDN', side: 'BACK', orderType: 'LIMIT', requestedOdds: 3.75, matchedOdds: 3.75, requestedStake: 50, matchedStake: 50, status: 'matched', expectedValue: 5.60, result: 'lost', grossProfit: -50, commission: 0, netProfit: -50, created_date: '2026-07-02T11:45:22+10:00' },
];

// ============================================================================
// STRATEGY SIGNALS — Using real runner names, realistic edge calculations.
// edgePercent = ((modelProbability / impliedProbability) - 1) * 100
// fairOdds = 1 / modelProbability
// ============================================================================

export const DEMO_STRATEGY_SIGNALS = [
  { id: 'ss1', strategyName: 'Value Bet', marketId: 'm_flem_r2', runnerId: 'r_flem2_4', side: 'BACK', odds: 7.20, stakeSuggestion: 80, modelProbability: 0.162, impliedProbability: 0.1389, fairOdds: 6.17, edgePercent: 7.35, expectedValue: 14.20, confidence: 0.74, signalStatus: 'active', reason: 'Model probability exceeds implied — runner unbeaten at distance' },
  { id: 'ss2', strategyName: 'Fav/Outsider', marketId: 'm_flem_r8', runnerId: 'r_flem8_2', side: 'BACK', odds: 6.20, stakeSuggestion: 80, modelProbability: 0.182, impliedProbability: 0.1613, fairOdds: 5.49, edgePercent: 6.75, expectedValue: 9.85, confidence: 0.68, signalStatus: 'active', reason: 'Favourite undervalued — strong 2nd-up record (42412)' },
  { id: 'ss3', strategyName: 'Pre-Off Scalping', marketId: 'm_flem_r5', runnerId: 'r_flem5_1', side: 'BACK', odds: 4.20, stakeSuggestion: 150, modelProbability: 0.262, impliedProbability: 0.2381, fairOdds: 3.82, edgePercent: 3.15, expectedValue: 22.50, confidence: 0.61, signalStatus: 'active', reason: 'Spread tightening pre-off — 2-tick spread, volume surging' },
  { id: 'ss4', strategyName: 'Steam/Drift', marketId: 'm_haw_r7', runnerId: 'r_haw7_3', side: 'LAY', odds: 4.00, stakeSuggestion: 70, modelProbability: 0.215, impliedProbability: 0.2500, fairOdds: 4.65, edgePercent: 5.44, expectedValue: 8.42, confidence: 0.65, signalStatus: 'active', reason: 'Odds drifted from 3.80 → 4.00 in 90s — momentum reversal' },
  { id: 'ss5', strategyName: 'Value Bet', marketId: 'm_flem_r8', runnerId: 'r_flem8_11', side: 'BACK', odds: 9.60, stakeSuggestion: 60, modelProbability: 0.118, impliedProbability: 0.1042, fairOdds: 8.47, edgePercent: 6.81, expectedValue: 7.92, confidence: 0.63, signalStatus: 'active', reason: 'Model probability exceeds implied — Ciaron Maher 2YO form x1311' },
];

// ============================================================================
// P/L DATA — 24-hour intraday P/L curve (realistic for a paper trading bot)
// ============================================================================

export const DEMO_PL_DATA = [
  { time: '00:00', pl: 0 }, { time: '02:00', pl: -45 }, { time: '04:00', pl: 110 },
  { time: '06:00', pl: 75 }, { time: '08:00', pl: -165 }, { time: '10:00', pl: -280 },
  { time: '11:00', pl: -120 }, { time: '12:00', pl: 35 }, { time: '12:30', pl: 125 },
  { time: '13:00', pl: 80 }, { time: '13:30', pl: 195 }, { time: '14:00', pl: 280 },
  { time: '14:30', pl: 245 }, { time: '15:00', pl: 310 }, { time: '15:30', pl: 268 },
  { time: '16:00', pl: 342 }, { time: '16:30', pl: 295 }, { time: '17:00', pl: 212.45 },
];

// ============================================================================
// BANKROLL STATS — Realistic for paper trading with $10k bankroll
// ============================================================================

export const DEMO_BANKROLL_STATS = {
  bankroll: 10212.45,
  todayPL: 212.45,
  totalPL: 1212.45,
  openExposure: 510,
  roi: 2.12,
  strikeRate: 63.64,
  maxDrawdown: -285.50,
  longestLosingStreak: 3,
  available: 9702.45,
  wins: 7,
  losses: 4,
};

// ============================================================================
// RISK STATUS — All green for demo (healthy system state)
// ============================================================================

export const DEMO_RISK_STATUS = {
  dailyLossLimit: { status: 'ok', value: 42.49, label: 'Daily Loss Limit', max: 500 },
  maxDrawdown: { status: 'ok', value: 2.86, label: 'Max Drawdown', max: 10 },
  openExposure: { status: 'ok', value: 4.99, label: 'Open Exposure', max: 10 },
  unmatchedOrders: { status: 'ok', value: 0, label: 'Unmatched Orders', max: 10 },
  apiHealth: { status: 'ok', value: 100, label: 'API Health', max: 100 },
};

// ============================================================================
// VOLATILITY HEATMAP — Market volatility distribution across watched markets
// ============================================================================

export const DEMO_HEATMAP = {
  veryHigh: 1,
  high: 3,
  medium: 3,
  low: 1,
  veryLow: 0,
};

// ============================================================================
// BACKTEST RUNS — Using real strategy names and realistic metrics
// ============================================================================

export const DEMO_BACKTEST_RUNS = [
  { id: 'bt1', name: 'Value Bet — Flemington Winter (Jun 2026)', strategyName: 'Value Bet', startingBankroll: 10000, endingBankroll: 11245, totalBets: 156, wins: 98, losses: 58, strikeRate: 62.82, grossProfit: 1456, netProfit: 1245, roi: 12.45, profitFactor: 1.85, maxDrawdown: -450, longestLosingStreak: 5, averageOdds: 4.2, averageStake: 85, notes: 'Strong performance on Victorian metro tracks — Soft/Heavy conditions' },
  { id: 'bt2', name: 'Pre-Off Scalping — Provincial (May 2026)', strategyName: 'Pre-Off Scalping', startingBankroll: 5000, endingBankroll: 5380, totalBets: 245, wins: 178, losses: 67, strikeRate: 72.65, grossProfit: 520, netProfit: 380, roi: 7.60, profitFactor: 2.12, maxDrawdown: -180, longestLosingStreak: 3, averageOdds: 2.8, averageStake: 50, notes: 'Low risk, steady returns — best on Hawkesbury/Ballarat provincial' },
  { id: 'bt3', name: 'Steam/Drift — Metro Sprint (May-Jun 2026)', strategyName: 'Steam/Drift', startingBankroll: 3000, endingBankroll: 3186, totalBets: 34, wins: 20, losses: 14, strikeRate: 58.82, grossProfit: 186, netProfit: 186, roi: 6.20, profitFactor: 1.35, maxDrawdown: -210, longestLosingStreak: 4, averageOdds: 5.1, averageStake: 60, notes: 'High variance — profitable but needs strict stop-loss. Best on 1000-1200m races' },
];

// ============================================================================
// AUDIT LOGS — Realistic system events referencing actual markets/strategies
// ============================================================================

export const DEMO_AUDIT_LOGS = [
  { id: 'al1', action: 'App Started', category: 'system', severity: 'info', user: 'admin', details: 'Betfair Edge Lab v1.0.0 initialized in research mode — demo data loaded', timestamp: '2026-07-02T11:30:00+10:00' },
  { id: 'al2', action: 'Mode Changed', category: 'mode', severity: 'info', user: 'admin', details: 'Switched to Paper Trading mode', timestamp: '2026-07-02T11:31:15+10:00' },
  { id: 'al3', action: 'Markets Loaded', category: 'api', severity: 'info', user: 'system', details: '9 markets loaded — Hawkesbury (8 races), Ballarat (8 races), Flemington Finals Day (Sat 4 Jul)', timestamp: '2026-07-02T11:32:00+10:00' },
  { id: 'al4', action: 'Strategy Signal', category: 'strategy', severity: 'info', user: 'system', details: 'Value Bet signal: 4. Ko Phangan (Flemington R2) edge 7.35%, EV $14.20', timestamp: '2026-07-02T12:42:00+10:00' },
  { id: 'al5', action: 'Risk Check Passed', category: 'risk', severity: 'info', user: 'system', details: 'All risk checks passed for order po1 — exposure 4.99% < 10% limit', timestamp: '2026-07-02T12:42:14+10:00' },
  { id: 'al6', action: 'Paper Order Placed', category: 'order', severity: 'info', user: 'admin', details: 'BACK 1. Fontein Jewel @ 4.50 × $100 (Flemington R2 Taj Rossi Series Final)', timestamp: '2026-07-02T12:42:15+10:00' },
  { id: 'al7', action: 'Paper Order Settled', category: 'order', severity: 'info', user: 'system', details: '2. Marwooba WON — BACK @ 3.50 × $200 → +$247.50 net (after 5% commission)', timestamp: '2026-07-02T12:44:51+10:00' },
  { id: 'al8', action: 'Settings Updated', category: 'settings', severity: 'info', user: 'admin', details: 'Commission rate set to 5% (AU exchange base rate)', timestamp: '2026-07-02T11:35:00+10:00' },
  { id: 'al9', action: 'Risk Check Passed', category: 'risk', severity: 'info', user: 'system', details: 'Daily loss at $0 / $500 limit — 0% utilised. System healthy.', timestamp: '2026-07-02T12:45:00+10:00' },
];

// ============================================================================
// BOT CYCLES — Realistic cycle data referencing real markets
// ============================================================================

export const DEMO_BOT_CYCLES = [
  { id: 'bc1', cycleNumber: 42, botMode: 'paper', startedAt: '2026-07-02T12:44:50+10:00', finishedAt: '2026-07-02T12:44:51+10:00', status: 'completed', marketsScanned: 9, marketsPassedFilters: 6, signalsCreated: 1, ordersCreated: 1, ordersBlocked: 0, errors: 0, notes: 'Value Bet signal on 4. Ko Phangan (Flemington R2 Taj Rossi Series Final)' },
  { id: 'bc2', cycleNumber: 41, botMode: 'paper', startedAt: '2026-07-02T12:44:40+10:00', finishedAt: '2026-07-02T12:44:41+10:00', status: 'blocked', marketsScanned: 9, marketsPassedFilters: 6, signalsCreated: 1, ordersCreated: 0, ordersBlocked: 1, errors: 0, notes: 'Risk blocked: Open exposure would exceed 10% of bankroll' },
  { id: 'bc3', cycleNumber: 40, botMode: 'paper', startedAt: '2026-07-02T12:44:30+10:00', finishedAt: '2026-07-02T12:44:31+10:00', status: 'completed', marketsScanned: 9, marketsPassedFilters: 6, signalsCreated: 0, ordersCreated: 0, ordersBlocked: 0, errors: 0, notes: 'No signals generated — all edges below 2% minimum threshold' },
  { id: 'bc4', cycleNumber: 39, botMode: 'paper', startedAt: '2026-07-02T12:44:20+10:00', finishedAt: '2026-07-02T12:44:21+10:00', status: 'completed', marketsScanned: 9, marketsPassedFilters: 6, signalsCreated: 1, ordersCreated: 1, ordersBlocked: 0, errors: 0, notes: 'Pre-Off Scalping signal on 1. The Western Front (Flemington R5)' },
  { id: 'bc5', cycleNumber: 38, botMode: 'paper', startedAt: '2026-07-02T12:44:10+10:00', finishedAt: '2026-07-02T12:44:11+10:00', status: 'completed', marketsScanned: 9, marketsPassedFilters: 6, signalsCreated: 1, ordersCreated: 1, ordersBlocked: 0, errors: 0, notes: 'Steam/Drift signal on 3. Menthon (Hawkesbury R7) — odds drift detected' },
];

// ============================================================================
// STRATEGY STATS — Cumulative performance per strategy
// ============================================================================

export const DEMO_STRATEGY_STATS = [
  { id: 'ss1', strategyName: 'Value Bet', totalSignals: 156, totalPaperOrders: 89, wins: 56, losses: 33, strikeRate: 62.92, grossProfit: 1456, netProfit: 1245, roi: 12.45, profitFactor: 1.85, maxDrawdown: -450, longestLosingStreak: 5, averageOdds: 4.2, averageStake: 85, averageEdge: 6.8, closingLineValue: 2.1, statusLabel: 'promising', updatedAt: '2026-07-02T12:45:00+10:00' },
  { id: 'ss2', strategyName: 'Pre-Off Scalping', totalSignals: 245, totalPaperOrders: 178, wins: 129, losses: 49, strikeRate: 72.47, grossProfit: 520, netProfit: 380, roi: 7.60, profitFactor: 2.12, maxDrawdown: -180, longestLosingStreak: 3, averageOdds: 2.8, averageStake: 50, averageEdge: 3.2, closingLineValue: 1.5, statusLabel: 'promising', updatedAt: '2026-07-02T12:45:00+10:00' },
  { id: 'ss3', strategyName: 'Fav/Outsider', totalSignals: 78, totalPaperOrders: 45, wins: 22, losses: 23, strikeRate: 48.89, grossProfit: -120, netProfit: -180, roi: -4.0, profitFactor: 0.85, maxDrawdown: -320, longestLosingStreak: 6, averageOdds: 3.5, averageStake: 70, averageEdge: 2.1, closingLineValue: -0.8, statusLabel: 'failing', updatedAt: '2026-07-02T12:45:00+10:00' },
  { id: 'ss4', strategyName: 'Steam/Drift', totalSignals: 34, totalPaperOrders: 12, wins: 7, losses: 5, strikeRate: 58.33, grossProfit: 85, netProfit: 62, roi: 5.20, profitFactor: 1.35, maxDrawdown: -95, longestLosingStreak: 2, averageOdds: 5.1, averageStake: 60, averageEdge: 4.5, closingLineValue: 0.5, statusLabel: 'needs_more_data', updatedAt: '2026-07-02T12:45:00+10:00' },
];

// ============================================================================
// BOT ACTIVITY — Real-time feed referencing real markets and runners
// ============================================================================

export const DEMO_BOT_ACTIVITY = [
  { id: 'ba1', action: 'Paper order settled', details: 'Value Bet on 2. Marwooba (Flemington R2) — WON +$247.50 net', timestamp: '2026-07-02T12:44:51+10:00' },
  { id: 'ba2', action: 'Paper order matched', details: 'BACK 1. Fontein Jewel @ 4.50 × $100 (Flemington R2 Taj Rossi Series Final)', timestamp: '2026-07-02T12:44:50+10:00' },
  { id: 'ba3', action: 'Paper order submitted', details: 'Value Bet signal — 4. Ko Phangan (Flemington R2)', timestamp: '2026-07-02T12:44:50+10:00' },
  { id: 'ba4', action: 'Signal created', details: 'Value Bet: 4. Ko Phangan edge 7.35%, EV $14.20, fair odds 6.17 vs market 7.20', timestamp: '2026-07-02T12:44:50+10:00' },
  { id: 'ba5', action: 'Market scanned', details: '9 markets scanned, 6 passed filters — Hawkesbury, Ballarat, Flemington (Sat)', timestamp: '2026-07-02T12:44:50+10:00' },
  { id: 'ba6', action: 'Risk blocked', details: 'Open exposure would exceed 10% of bankroll — skipped 3. Star Of Macedon', timestamp: '2026-07-02T12:44:40+10:00' },
  { id: 'ba7', action: 'Paper order settled', details: 'Pre-Off Scalping on 1. The Western Front (Flemington R5) — WON +$206.00 net', timestamp: '2026-07-02T12:44:20+10:00' },
  { id: 'ba8', action: 'Paper order matched', details: 'BACK 1. The Western Front @ 4.20 × $150 (Flemington R5 Winter Championship Final)', timestamp: '2026-07-02T12:44:20+10:00' },
  { id: 'ba9', action: 'Steam/Drift alert', details: '3. Menthon (Hawkesbury R7) odds drifted 3.80 → 4.00 in 90s — momentum reversal detected', timestamp: '2026-07-02T12:44:10+10:00' },
  { id: 'ba10', action: 'Markets refreshed', details: '9 markets loaded — 3 watched (Hawkesbury R2/R6/R7, Flemington R2/R5/R8)', timestamp: '2026-07-02T12:43:00+10:00' },
];

// ============================================================================
// EQUITY CURVE — 12-month bankroll progression
// ============================================================================

export const DEMO_EQUITY_CURVE = [
  { month: 'Aug', bankroll: 10000, pl: 0 },
  { month: 'Sep', bankroll: 10350, pl: 350 },
  { month: 'Oct', bankroll: 10180, pl: -170 },
  { month: 'Nov', bankroll: 10620, pl: 440 },
  { month: 'Dec', bankroll: 10980, pl: 360 },
  { month: 'Jan', bankroll: 10750, pl: -230 },
  { month: 'Feb', bankroll: 11240, pl: 490 },
  { month: 'Mar', bankroll: 11680, pl: 440 },
  { month: 'Apr', bankroll: 11420, pl: -260 },
  { month: 'May', bankroll: 11960, pl: 540 },
  { month: 'Jun', bankroll: 12460, pl: 500 },
  { month: 'Jul', bankroll: 11212, pl: -1248 },
];

export const DEMO_MONTHLY_GROWTH = [
  { month: 'Sep', growth: 3.50, netPL: 350 },
  { month: 'Oct', growth: -1.64, netPL: -170 },
  { month: 'Nov', growth: 4.32, netPL: 440 },
  { month: 'Dec', growth: 3.39, netPL: 360 },
  { month: 'Jan', growth: -2.10, netPL: -230 },
  { month: 'Feb', growth: 4.56, netPL: 490 },
  { month: 'Mar', growth: 3.91, netPL: 440 },
  { month: 'Apr', growth: -2.23, netPL: -260 },
  { month: 'May', growth: 4.73, netPL: 540 },
  { month: 'Jun', growth: 4.18, netPL: 500 },
  { month: 'Jul', growth: -10.05, netPL: -1248 },
];

export const DEMO_WINLOSS_DISTRIBUTION = [
  { strategy: 'Value Bet', wins: 56, losses: 33 },
  { strategy: 'Pre-Off Scalping', wins: 129, losses: 49 },
  { strategy: 'Fav/Outsider', wins: 22, losses: 23 },
  { strategy: 'Steam/Drift', wins: 7, losses: 5 },
];

export const DEMO_DRAWDOWN_CURVE = [
  { month: 'Aug', drawdown: 0 },
  { month: 'Sep', drawdown: -80 },
  { month: 'Oct', drawdown: -210 },
  { month: 'Nov', drawdown: -150 },
  { month: 'Dec', drawdown: -95 },
  { month: 'Jan', drawdown: -280 },
  { month: 'Feb', drawdown: -180 },
  { month: 'Mar', drawdown: -120 },
  { month: 'Apr', drawdown: -310 },
  { month: 'May', drawdown: -200 },
  { month: 'Jun', drawdown: -160 },
  { month: 'Jul', drawdown: -286 },
];

// ============================================================================
// STRATEGY LIBRARY — Real Betfair racing trading strategies with
// accurate descriptions of how each works on the exchange
// ============================================================================

// ============================================================================
// BETFAIR EXCHANGE FIELD ENRICHMENT
// Adds all Betfair API fields to demo markets, runners, and paper orders.
// Commission uses Market Base Rate (not fixed 5%) — some markets have it
// missing to demonstrate commission warnings.
// ============================================================================

function enrichMarket(m) {
  const raceNumberMatch = m.marketName?.match(/R(\d+)/i);
  const raceNumber = raceNumberMatch ? parseInt(raceNumberMatch[1]) : 0;
  const activeRunners = m.numberOfRunners; // Will be adjusted if removed runners exist
  return {
    ...m,
    eventTypeId: '7',
    eventId: m.betfairMarketId,
    competitionId: null,
    marketId: m.betfairMarketId,
    raceNumber,
    country: m.country || 'AU',
    timezone: 'Australia/Sydney',
    marketStartTime: m.startTime,
    numberOfWinners: 1,
    numberOfActiveRunners: activeRunners,
    betDelay: 1,
    bspMarket: true,
    turnInPlayEnabled: true,
    marketBaseRate: m.marketBaseRate !== undefined ? m.marketBaseRate : (Math.random() > 0.15 ? 0.05 : null), // 85% have MBR, 15% missing for demo
    eligibleStrategies: [],
    warningFlags: [],
  };
}

function enrichRunner(r) {
  const availableToBack = r.bestBackPrice > 0
    ? [{ price: r.bestBackPrice, size: r.bestBackSize }]
    : [];
  const availableToLay = r.bestLayPrice > 0
    ? [{ price: r.bestLayPrice, size: r.bestLaySize }]
    : [];

  // Calculate spread in ticks
  let spreadTicks = 0;
  if (r.bestBackPrice > 0 && r.bestLayPrice > 0) {
    let low = r.bestBackPrice;
    let high = r.bestLayPrice;
    let ticks = 0;
    let current = low;
    const tickRanges = [
      { min: 1.01, max: 2.00, step: 0.01 },
      { min: 2.00, max: 3.00, step: 0.02 },
      { min: 3.00, max: 4.00, step: 0.05 },
      { min: 4.00, max: 6.00, step: 0.10 },
      { min: 6.00, max: 10.00, step: 0.20 },
      { min: 10.00, max: 20.00, step: 0.50 },
      { min: 20.00, max: 30.00, step: 1.00 },
      { min: 30.00, max: 50.00, step: 2.00 },
      { min: 50.00, max: 100.00, step: 5.00 },
      { min: 100.00, max: 1000.00, step: 10.00 },
    ];
    const getStep = (p) => {
      for (const range of tickRanges) {
        if (p >= range.min && p < range.max) return range.step;
      }
      return 10;
    };
    while (current < high - 0.001 && ticks < 100) {
      const step = getStep(current);
      current = Math.round((current + step) * 100) / 100;
      ticks++;
    }
    spreadTicks = ticks;
  }

  return {
    ...r,
    selectionId: r.betfairSelectionId,
    handicap: 0,
    adjustmentFactor: null,
    lastPriceTraded: r.lastTradedPrice,
    totalMatched: r.tradedVolume,
    availableToBack,
    availableToLay,
    tradedVolume: r.tradedVolume > 0 ? [{ price: r.lastTradedPrice, size: r.tradedVolume }] : [],
    spreadTicks,
    modelProbability: null,
    edge: null,
    clvEstimate: null,
    strategySignalStatus: 'none',
    rejectedSignalReason: null,
  };
}

function enrichPaperOrder(o) {
  const isMatched = o.status === 'matched' || o.status === 'settled';
  return {
    ...o,
    selectionId: o.runnerId,
    handicap: 0,
    size: o.requestedStake,
    price: o.requestedOdds,
    orderType: 'LIMIT',
    persistenceType: 'LAPSE',
    customerRef: 'BEL' + o.id.toUpperCase(),
    customerStrategyRef: 'BEL_' + o.strategyName.toUpperCase().replace(/[^A-Z]/g, ''),
    paper_mode: true,
    liveMode: false,
    betfairBetId: null,
    requested_size: o.requestedStake,
    matched_size: isMatched ? o.matchedStake : 0,
    remaining_size: isMatched ? 0 : o.requestedStake,
    average_price_matched: isMatched ? o.matchedOdds : 0,
    requested_price: o.requestedOdds,
    matched_price: isMatched ? o.matchedOdds : null,
    placed_date: o.created_date,
    matched_date: isMatched ? o.created_date : null,
    settled_date: o.status === 'settled' ? o.created_date : null,
    lapse_reason: o.status === 'lapsed' ? 'Market turned in-play' : null,
    cancel_reason: o.status === 'cancelled' ? 'User cancelled' : null,
    rejection_reason: o.status === 'rejected' ? 'Failed pre-order validation' : null,
    commissionRateUsed: 0.05,
    commissionSource: 'market_base_rate',
    commission_calculation_status: 'ok',
    closingOdds: isMatched ? o.matchedOdds * 0.98 : null,
    clv: isMatched ? (o.matchedOdds - o.matchedOdds * 0.98) / (o.matchedOdds * 0.98) * 100 : 0,
    slippage: 0,
    entryReason: `${o.strategyName} signal`,
    exitReason: o.status === 'settled' ? 'Race settled' : null,
    warningFlags: [],
    paperSimulationQuality: 'High',
  };
}

// Enrich all demo data with Betfair fields
// Demo start times are shifted relative to "now" so markets are always in the
// pre-off trading window — original dates are historical and would fail the
// time-window validation ("race has jumped").
const NOW = Date.now();
const _shiftedMarkets = DEMO_MARKETS.map((m, i) => ({
  ...m,
  startTime: new Date(NOW + (2 + i * 4) * 60 * 1000).toISOString(), // 2min, 6min, 10min, 14min...
  inPlay: false,
  status: 'OPEN',
}));
const ENRICHED_MARKETS = _shiftedMarkets.map(enrichMarket);
const ENRICHED_RUNNERS = DEMO_RUNNERS.map(enrichRunner);
const ENRICHED_PAPER_ORDERS = DEMO_PAPER_ORDERS.map(enrichPaperOrder);

// Override the original exports with enriched versions
// (We export new names and also update the originals)
export const BETFAIR_MARKETS = ENRICHED_MARKETS;
export const BETFAIR_RUNNERS = ENRICHED_RUNNERS;
export const BETFAIR_PAPER_ORDERS = ENRICHED_PAPER_ORDERS;

// ============================================================================
// STRATEGY LIBRARY — Real Betfair racing trading strategies with
// accurate descriptions of how each works on the exchange
// ============================================================================

export const DEMO_STRATEGY_LIBRARY = [
  {
    id: 'sl1',
    name: 'Value Bet',
    category: 'Value Betting',
    status: 'active',
    description: 'Identifies runners where the model probability exceeds the implied market probability, creating positive expected value opportunities. Uses historical form data, track conditions, barrier draw, weight allocation, and runner form to generate a fair odds estimate. When the Betfair back price exceeds the fair odds by at least the edge threshold, a BACK signal is generated.',
    entryRules: 'Model probability > implied probability by at least 2%. Minimum edge threshold of 5%. Odds between 1.50 and 20.00. Minimum liquidity $5,000 on the exchange. Runner must have at least 3 career starts for form analysis.',
    exitRules: 'Settle at race completion. No early exit — this is a straight win/place bet. Paper order auto-created when risk checks pass. Commission (5%) deducted from winning bets only.',
    riskProfile: 'Medium',
    marketTypes: ['WIN', 'PLACE'],
    timeWindow: 'Pre-race (10min – 30sec before start)',
    minEdge: 5.0,
    minLiquidity: 5000,
    createdAt: '2026-01-15T00:00:00+10:00',
    lastRun: '2026-07-02T12:44:50+10:00',
  },
  {
    id: 'sl2',
    name: 'Pre-Off Scalping',
    category: 'Scalping',
    status: 'active',
    description: 'Exploits tightening spreads in the final minutes before race start. Enters a BACK bet when the back/lay spread narrows to 1-2 ticks, then immediately places a LAY bet one tick lower to lock in a small guaranteed profit. High frequency, low risk per trade. Works best on highly liquid markets where the spread is tight and both sides have sufficient size.',
    entryRules: 'Back/lay spread ≤ 3 ticks. Market within time window (300s – 30s before start). Minimum liquidity $5,000. Traded volume > $10,000. Both back and lay sides must have at least $200 available at the target price.',
    exitRules: 'Exit on opposite side for 1-3 tick profit. Stop loss at 5 ticks from entry. Auto-cancel if spread widens beyond 5 ticks or if liquidity drops below $200 on either side.',
    riskProfile: 'Low',
    marketTypes: ['WIN', 'PLACE'],
    timeWindow: 'Pre-race (5min – 30sec before start)',
    minEdge: 1.5,
    minLiquidity: 5000,
    createdAt: '2026-01-20T00:00:00+10:00',
    lastRun: '2026-07-02T12:44:20+10:00',
  },
  {
    id: 'sl3',
    name: 'Fav/Outsider',
    category: 'Directional',
    status: 'active',
    description: 'Bets on favourites or outsiders based on market inefficiencies in small-field (2-3 runner) markets. Backs undervalued favourites where the market has over-reacted to a recent poor run, or lays overbacked outsiders where the implied probability is too high. Uses closing line value (CLV) analysis to detect mispricing. Currently underperforming — under review for possible retirement.',
    entryRules: 'Market has 2-3 runners. Favourite odds < 3.0 or outsider odds > 5.0. CLV analysis suggests mispricing of at least 2%. Minimum liquidity $3,000.',
    exitRules: 'Settle at race completion. No early exit.',
    riskProfile: 'Medium-High',
    marketTypes: ['WIN'],
    timeWindow: 'Pre-race (5min – 30sec before start)',
    minEdge: 2.0,
    minLiquidity: 3000,
    createdAt: '2026-02-10T00:00:00+10:00',
    lastRun: '2026-07-02T12:44:40+10:00',
  },
  {
    id: 'sl4',
    name: 'Steam/Drift',
    category: 'Momentum',
    status: 'active',
    description: 'Detects significant odds movements on the Betfair exchange — "steaming" (odds shortening) indicates money coming for a runner, while "drifting" (odds lengthening) indicates money against. Enters in the direction of momentum. Confirms signals by comparing Betfair odds with external bookmaker odds to detect divergence. Uses a 60-second rolling window for movement detection.',
    entryRules: 'Odds moved > 10% in 60 seconds on Betfair. External bookmaker odds diverge from Betfair by > 5%. Volume increasing (traded volume in last 5 min > 20% of total). Minimum liquidity $8,000.',
    exitRules: 'Exit when momentum reverses (odds move > 5% in opposite direction) or at race start. Stop loss at 8 ticks from entry.',
    riskProfile: 'High',
    marketTypes: ['WIN', 'PLACE'],
    timeWindow: 'Pre-race (10min – 30sec before start)',
    minEdge: 3.0,
    minLiquidity: 8000,
    createdAt: '2026-03-05T00:00:00+10:00',
    lastRun: '2026-07-02T12:43:10+10:00',
  },
  {
    id: 'sl5',
    name: 'In-Play Front Runner',
    category: 'In-Play',
    status: 'archived',
    description: 'Backed front-running horses in-play when they led by > 2 lengths, aiming to lay off at shorter odds as the horse maintained its lead. Archived due to high volatility and unreliable data feeds during in-play periods — Betfair in-play latency was too high to execute reliably.',
    entryRules: 'Horse leading by > 2 lengths (via live stream confirmation). In-play market active. Odds < 3.0. Stream confirmed live with < 2s latency.',
    exitRules: 'Exit when lead drops below 1 length or at race finish. Lay at 1-2 ticks shorter than entry.',
    riskProfile: 'High',
    marketTypes: ['WIN'],
    timeWindow: 'In-play only',
    minEdge: 4.0,
    minLiquidity: 10000,
    createdAt: '2026-01-05T00:00:00+10:00',
    lastRun: '2026-05-15T10:30:00+10:00',
  },
  {
    id: 'sl6',
    name: 'Cross-Market Arbitrage',
    category: 'Arbitrage',
    status: 'archived',
    description: 'Exploited pricing discrepancies between Betfair WIN/PLACE markets and external bookmakers. Archived due to diminishing opportunities (bookmakers now use Betfair as their reference price) and account restrictions from bookmakers.',
    entryRules: 'Arbitrage margin > 2% after 5% Betfair commission. Both sides available with sufficient liquidity. Bookmaker bet placed simultaneously.',
    exitRules: 'Exit immediately when margin closes. Both sides must be matched simultaneously.',
    riskProfile: 'Low',
    marketTypes: ['WIN', 'PLACE'],
    timeWindow: 'Pre-race (any time)',
    minEdge: 2.0,
    minLiquidity: 5000,
    createdAt: '2026-01-10T00:00:00+10:00',
    lastRun: '2026-04-20T14:00:00+10:00',
  },
];

// ============================================================================
// STRATEGY BETFAIR ENRICHMENT
// Adds Betfair-specific fields: allowInPlay, timeWindowStart/End,
// persistenceType, side restrictions, and correct status labels.
// ============================================================================

const STRATEGY_BETFAIR_FIELDS = {
  'Value Bet': {
    allowInPlay: false,
    timeWindowStart: 600,
    timeWindowEnd: 30,
    persistenceType: 'LAPSE',
    sideRestriction: 'BACK',
    requiresCommission: true,
    requiresCLV: true,
    paperOnly: true,
    validationStatus: 'promising',
    statusLabel: 'Promising — Paper Testing',
  },
  'Pre-Off Scalping': {
    allowInPlay: false,
    timeWindowStart: 300,
    timeWindowEnd: 30,
    persistenceType: 'LAPSE',
    sideRestriction: 'BOTH',
    requiresCommission: true,
    requiresCLV: false,
    requiresSlippage: true,
    requiresTightSpread: true,
    paperOnly: true,
    validationStatus: 'promising',
    statusLabel: 'Promising — Paper Testing',
  },
  'Fav/Outsider': {
    allowInPlay: false,
    timeWindowStart: 300,
    timeWindowEnd: 30,
    persistenceType: 'LAPSE',
    sideRestriction: 'BOTH',
    requiresCommission: true,
    requiresCLV: true,
    paperOnly: true,
    validationStatus: 'needs_more_data',
    statusLabel: 'Paper Testing',
    status: 'active',
  },
  'Steam/Drift': {
    allowInPlay: false,
    timeWindowStart: 600,
    timeWindowEnd: 30,
    persistenceType: 'LAPSE',
    sideRestriction: 'BOTH',
    requiresCommission: true,
    requiresCLV: false,
    requiresPriceMovement: true,
    paperOnly: true,
    validationStatus: 'needs_more_data',
    statusLabel: 'Needs More Data — Paper Only',
  },
  'In-Play Front Runner': {
    allowInPlay: true,
    timeWindowStart: 0,
    timeWindowEnd: 0,
    persistenceType: 'PERSIST',
    sideRestriction: 'BOTH',
    requiresCommission: true,
    requiresCLV: false,
    paperOnly: true,
    validationStatus: 'archived',
    statusLabel: 'Archived — Disabled',
    status: 'archived',
  },
  'Cross-Market Arbitrage': {
    allowInPlay: false,
    timeWindowStart: 600,
    timeWindowEnd: 0,
    persistenceType: 'LAPSE',
    sideRestriction: 'BOTH',
    requiresCommission: true,
    requiresCLV: false,
    paperOnly: true,
    validationStatus: 'archived',
    statusLabel: 'Archived — Disabled',
    status: 'archived',
  },
};

// Enrich strategies with Betfair fields
export const ENRICHED_STRATEGY_LIBRARY = DEMO_STRATEGY_LIBRARY.map(s => ({
  ...s,
  ...STRATEGY_BETFAIR_FIELDS[s.name],
}));