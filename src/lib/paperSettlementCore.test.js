import { describe, expect, it } from 'vitest';
import { normalizeMarketId, normalizeSelectionId, calculateOrderGross, allocateMarketCommission, settleMarketOrders } from './paperSettlementCore';

const back = { id:'o1', betfairMarketId:1.23, selectionId:10, side:'BACK', matchedOdds:3, matchedStake:2, liability:2, customerRef:'A', normalizedCommissionRate:0.05, result:'pending' };
const lay = { ...back, id:'o2', selectionId:'11', side:'LAY', matchedOdds:4, liability:6, customerRef:'B' };
const closed = { marketId:'1.23', status:'CLOSED', inPlay:false, winnerSelectionIds:['10'] };

describe('paper settlement worker core', () => {
  it('settles without any live markets array', () => expect(settleMarketOrders([back], closed)[0].settlementStatus).toBe('settled'));
  it('matches numeric and string market ids', () => expect(normalizeMarketId(1.23)).toBe(normalizeMarketId('1.23')));
  it('matches numeric and string selection ids', () => expect(normalizeSelectionId(10)).toBe(normalizeSelectionId('10')));
  it('calculates BACK winner profit', () => expect(calculateOrderGross(back, ['10']).grossProfit).toBe(4));
  it('calculates BACK loser as negative stake', () => expect(calculateOrderGross(back, ['99']).grossProfit).toBe(-2));
  it('calculates LAY winner liability loss', () => expect(calculateOrderGross(lay, ['11']).grossProfit).toBe(-6));
  it('calculates LAY loser stake profit', () => expect(calculateOrderGross(lay, ['10']).grossProfit).toBe(2));
  it('charges commission only on positive market gross', () => { expect(allocateMarketCommission([{grossProfit:4},{grossProfit:-2}],0.05).reduce((s,x)=>s+x.commission,0)).toBeCloseTo(.1); expect(allocateMarketCommission([{grossProfit:1},{grossProfit:-2}],0.05).reduce((s,x)=>s+x.commission,0)).toBe(0); });
  it('keeps open markets awaiting', () => expect(settleMarketOrders([back], {...closed,status:'OPEN'})[0].settlementStatus).toBe('awaiting_result'));
  it('settles closed markets', () => expect(settleMarketOrders([back], closed)[0].resultSource).toBe('BETFAIR_MARKET_BOOK'));
  it('voids and refunds void markets', () => expect(settleMarketOrders([back], {...closed,voided:true})[0].netProfit).toBe(0));
  it('is idempotent for already settled orders', () => { const once=settleMarketOrders([back],closed)[0]; expect(settleMarketOrders([once],closed)[0].netProfit).toBe(once.netProfit); });
  it('records missing winner errors', () => expect(settleMarketOrders([back], {...closed,winnerSelectionIds:[]})[0].settlementError).toBe('CLOSED_MARKET_WITHOUT_WINNER'));
  it('does not require a browser lifecycle', () => expect(typeof settleMarketOrders).toBe('function'));
});