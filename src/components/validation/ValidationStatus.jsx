import React from'react';
import{useApp}from'@/lib/AppContext';
import{StatusBadge}from'@/components/ui/Trading';
const tone=status=>status==='VALIDATED_OUT_OF_SAMPLE'?'ok':status==='FAILED_VALIDATION'?'danger':status==='POSITIVE_EXPECTANCY_OBSERVED'?'warning':'info';
export default function ValidationStatus(){const{statisticalValidation:v}=useApp();return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"><div><div className="text-xs font-semibold text-foreground">Statistical validation</div><div className="mt-1 text-[11px] text-muted-foreground">{v.settledBets}/500 eligible settled bets · test set {v.testBets}/100 · paper-only</div></div><StatusBadge status={tone(v.status)}>{v.status.replaceAll('_',' ')}</StatusBadge></div>}