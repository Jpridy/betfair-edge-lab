import { describe, expect, it, vi } from 'vitest';
import { settlementDueStatus } from './settlementDue';

describe('settlement due gate',()=>{
  it('does not call settlement APIs for future races',async()=>{const invoke=vi.fn();const due=settlementDueStatus({marketStartTime:'2030-01-01T00:00:00Z'},Date.parse('2026-07-12T00:00:00Z'),90);if(due.due) await invoke();expect(invoke).not.toHaveBeenCalled();});
  it('does not increment attempts for future races',()=>{const order={marketStartTime:'2030-01-01T00:00:00Z',settlementAttempts:4};expect(settlementDueStatus(order,Date.parse('2026-07-12T00:00:00Z'),90)).toMatchObject({due:false,settlementCheckStatus:'NOT_DUE'});expect(order.settlementAttempts).toBe(4);});
});