import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearOpenAIWebSearchBackoff, getOpenAIWebSearchBackoff, invokeOpenAIWebSearchWithBackoff, isQuotaOrBillingError, recordOpenAIWebSearchError } from './openAIWebSearchBackoff';

describe('OpenAI web search quota backoff',()=>{
  beforeEach(()=>clearOpenAIWebSearchBackoff());
  it('classifies quota, billing and rate-limit failures',()=>{expect(isQuotaOrBillingError('insufficient_quota billing limit')).toBe(true);expect(isQuotaOrBillingError('429 rate limit')).toBe(true);expect(isQuotaOrBillingError('network error')).toBe(false);});
  it('returns error_backoff and skips repeated API calls',async()=>{const invoke=vi.fn().mockResolvedValue({data:{externalSearchResult:{searchStatus:'error',errorMessage:'quota exceeded'}}});const first=await invokeOpenAIWebSearchWithBackoff(invoke,{});const second=await invokeOpenAIWebSearchWithBackoff(invoke,{});expect(first).toMatchObject({searchStatus:'error_backoff',openAIWebSearchStatus:'error_backoff',errorType:'quota_or_billing',openAIWebSearchErrorType:'quota_or_billing'});expect(second).toMatchObject({searchStatus:'error_backoff',errorType:'quota_or_billing'});expect(second.nextRetryAt).toBeTruthy();expect(second.backoffSeconds).toBeGreaterThanOrEqual(300);expect(invoke).toHaveBeenCalledTimes(1);});
  it('records a future retry timestamp',()=>{recordOpenAIWebSearchError('billing quota exhausted',1000);expect(new Date(getOpenAIWebSearchBackoff(1000).nextRetryAt).getTime()).toBeGreaterThan(1000);});
});