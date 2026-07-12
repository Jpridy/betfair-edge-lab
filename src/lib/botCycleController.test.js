import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBotCycleController, createCycleRunKey } from './botCycleController';

const store=new Map();
beforeEach(()=>{store.clear();vi.stubGlobal('window',{localStorage:{getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value),removeItem:key=>store.delete(key)}});vi.stubGlobal('BroadcastChannel',class{postMessage(){} close(){}});});

describe('single-flight bot cycle controller',()=>{
  it('allows only one of two simultaneous runs',async()=>{const controller=createBotCycleController({browserTabId:'a'});const [a,b]=await Promise.all([controller.acquire({selectedRaceKey:'race:a:1:x',scanIntervalSeconds:30}),controller.acquire({selectedRaceKey:'race:a:1:x',scanIntervalSeconds:30})]);expect([a.acquired,b.acquired].filter(Boolean)).toHaveLength(1);});
  it('prevents duplicate browser intervals',async()=>{const first=createBotCycleController({browserTabId:'a'});const second=createBotCycleController({browserTabId:'b'});expect((await first.acquire({selectedRaceKey:'race:a:1:x',scanIntervalSeconds:30})).acquired).toBe(true);expect((await second.acquire({selectedRaceKey:'race:a:1:x',scanIntervalSeconds:30})).acquired).toBe(false);});
  it('uses a deterministic idempotency run key',()=>{expect(createCycleRunKey('race:a:1:x',30,60001)).toBe(createCycleRunKey('race:a:1:x',30,89999));});
});