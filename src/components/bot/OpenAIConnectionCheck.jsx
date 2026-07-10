import React, { useState } from 'react';
import { FlaskConical, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/Trading';

export default function OpenAIConnectionCheck() {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const runTest = async () => {
    setTesting(true);
    const response = await base44.functions.invoke('openAIWebSearch', { action: 'web_search_test' });
    setResult(response.data?.webSearchTest || { success: false, errorMessage: response.data?.error || 'No test result returned' });
    setTesting(false);
  };

  return (
    <div className="flex items-center gap-2">
      {result && (
        <div className="text-right leading-tight">
          <StatusBadge status={result.success ? 'ok' : 'danger'}>{result.success ? 'CONNECTED' : 'FAILED'}</StatusBadge>
          <div className="mt-0.5 text-[9px] text-muted-foreground" title={result.errorMessage || ''}>
            {result.model || 'Unknown model'} · {result.responseTimeMs || 0}ms · search {result.webSearchActuallyUsed === true ? 'used' : 'not verified'}
          </div>
        </div>
      )}
      <Button size="sm" variant="outline" onClick={runTest} disabled={testing}>
        {testing ? <Loader2 className="animate-spin" /> : <FlaskConical />}
        Test OpenAI
      </Button>
    </div>
  );
}