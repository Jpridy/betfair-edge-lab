const BACKOFF_MS = 15 * 60 * 1000;
let backoff = null;

export const isQuotaOrBillingError = error => /quota|billing|rate.?limit|insufficient_quota|too many requests|\b429\b/i.test(String(error || ''));

export function getOpenAIWebSearchBackoff(now = Date.now()) {
  if (!backoff || new Date(backoff.nextRetryAt).getTime() <= now) { backoff=null; return null; }
  return {...backoff};
}

export function clearOpenAIWebSearchBackoff() { backoff=null; }

export function recordOpenAIWebSearchError(error, now = Date.now()) {
  if (!isQuotaOrBillingError(error)) return null;
  backoff={openAIWebSearchStatus:'error_backoff',nextRetryAt:new Date(now+BACKOFF_MS).toISOString(),openAIWebSearchErrorType:'quota_or_billing',errorMessage:String(error || '')};
  return {...backoff};
}

export async function invokeOpenAIWebSearchWithBackoff(invoke, payload) {
  const active=getOpenAIWebSearchBackoff();
  if (active) return failure(active);
  try {
    const response=await invoke('openAIWebSearch',payload);
    const result=response.data?.externalSearchResult || null;
    const error=response.data?.error || result?.errorMessage;
    const recorded=recordOpenAIWebSearchError(error);
    if (recorded) return failure(recorded);
    if (result?.searchStatus === 'success') clearOpenAIWebSearchBackoff();
    return result;
  } catch (error) {
    const recorded=recordOpenAIWebSearchError(error.message);
    return failure(recorded || {openAIWebSearchStatus:/timeout/i.test(error.message || '')?'timeout':'error',errorMessage:error.message});
  }
}

function failure(details) { return {searchStatus:details.openAIWebSearchStatus || 'error',sourceCount:0,sources:[],runnerResearch:[],raceLevelNotes:'',dataQuality:0,errorMessage:details.errorMessage || null,errorType:details.openAIWebSearchErrorType || null,nextRetryAt:details.nextRetryAt || null,searchQuery:'',searchedAt:new Date().toISOString(),searchProvider:'openai_web_search'}; }