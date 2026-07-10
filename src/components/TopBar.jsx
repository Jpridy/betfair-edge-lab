import React from 'react';
import { Menu } from 'lucide-react';
import { useApp } from '@/lib/AppContext';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function TopBar({ title, subtitle, onMenuClick }) {
  const { jurisdiction, setJurisdiction } = useApp();
  return <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur md:px-6">
    <div className="flex min-w-0 items-center gap-3">
      <button aria-label="Open navigation" onClick={onMenuClick} className="min-h-11 min-w-11 rounded-md text-muted-foreground hover:bg-hover md:hidden"><Menu className="mx-auto h-5 w-5" /></button>
      <div className="min-w-0"><h1 className="truncate font-heading text-xl font-semibold text-foreground">{title}</h1>{subtitle && <p className="truncate text-sm text-muted-foreground">{subtitle}</p>}</div>
    </div>
    <Select value={jurisdiction} onValueChange={setJurisdiction}><SelectTrigger className="hidden h-10 w-44 text-sm sm:flex"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AU">Betfair AU</SelectItem><SelectItem value="UK">Betfair UK</SelectItem><SelectItem value="ES">Betfair ES</SelectItem><SelectItem value="IT">Betfair IT</SelectItem><SelectItem value="RO">Betfair RO</SelectItem></SelectContent></Select>
  </header>;
}