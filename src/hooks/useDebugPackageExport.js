import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useApp } from '@/lib/AppContext';
import { toast } from '@/components/ui/use-toast';
import { buildDebugPackage, debugPackageFilename, downloadDebugBlob } from '@/lib/debugPackageBuilder';

const localSnapshot = () => Object.fromEntries(Array.from({length:localStorage.length},(_,index) => { const key=localStorage.key(index); return [key,localStorage.getItem(key)]; }));

export default function useDebugPackageExport() {
  const app = useApp();
  const [progress, setProgress] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async minimal => {
    setBusy(true); const errors=[];
    try {
      await showProgress(setProgress, 'Preparing debug package...');
      await showProgress(setProgress, 'Fetching paper orders...'); const paperOrders=await safeFetch('PaperOrder', 500, app.paperOrders, errors);
      await showProgress(setProgress, 'Fetching bot cycles...'); const botCycles=await safeFetch('BotCycle', 500, app.botCycles, errors);
      await showProgress(setProgress, 'Fetching audit logs...'); const auditLogs=await safeFetch('AuditLog', 500, app.auditLogs, errors);
      const settlementWorkerRuns=minimal ? [] : await safeFetch('SettlementWorkerRun', 200, [], errors);
      await showProgress(setProgress, 'Building ZIP...');
      const result=await buildDebugPackage({...app,paperOrders,botCycles,auditLogs,settlementWorkerRuns,currentPage:window.location.pathname,localStorageSnapshot:localSnapshot()},{minimal,exportErrors:errors});
      await showProgress(setProgress, 'Downloading...'); downloadDebugBlob(result.blob,debugPackageFilename());
      toast({title:errors.length ? 'Debug package downloaded with warnings. See /errors/export-errors.json.' : 'Debug package downloaded.'});
      return result;
    } catch (error) {
      toast({variant:'destructive',title:`Debug package export failed: ${error.message}`});
      return {exportErrors:[{section:'package',error:error.message}]};
    } finally { setBusy(false); setProgress(''); }
  };
  return {busy,progress,downloadFull:()=>run(false),downloadMinimal:()=>run(true)};
}

const showProgress = (setProgress, message) => new Promise(resolve => { setProgress(message); requestAnimationFrame(() => resolve()); });

async function safeFetch(entityName, limit, fallback, errors) {
  try { return await base44.entities[entityName].filter({}, '-created_date', limit); }
  catch (error) { errors.push({section:entityName,error:error.message}); return fallback || []; }
}