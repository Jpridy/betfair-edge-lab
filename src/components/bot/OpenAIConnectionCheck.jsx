import React, { useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/Trading';
import OpenAIDiagnostics, { getOpenAIDiagnostics } from '@/components/bot/OpenAIDiagnostics';

export default function OpenAIConnectionCheck() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setTesting(true);
    try {
      const response = await base44.functions.invoke('openAIWebSearch', { action: 'web_search_test' });
      const test = response.data?.webSearchTest;
      setResult(test ? { success: test.success, ...getOpenAIDiagnostics(response.data) } : { success: false, errorMessage: response.data?.error || 'No test result returned' });
    } catch (error) {
      setResult({ success: false, errorMessage: error.response?.data?.error || error.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {result && (
        <div className="w-72 rounded-md border border-border bg-muted/20 p-2 leading-tight">
          <div className="mb-2 flex items-center justify-between gap-2">
            <StatusBadge status={result.success ? 'ok' : 'danger'}>{result.success ? 'SEARCH PASSED' : 'FAILED'}</StatusBadge>
            <span className="text-[9px] text-muted-foreground">
              {result.success && result.sourceCount >= 2 ? 'Search works — enough sources for probability adjustment' : result.success && result.sourceCount === 1 ? 'Search works — not enough sources for probability adjustment' : result.success ? 'Search ran successfully' : 'Search failed'}
            </span>
          </div>
          <OpenAIDiagnostics data={result} />
        </div>
      )}
      <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
        {testing ? <Loader2 className="animate-spin" /> : <FlaskConical />}
        Test OpenAI
      </Button>
    </div>
  );
}