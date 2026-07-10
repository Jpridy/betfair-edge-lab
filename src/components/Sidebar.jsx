import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, SlidersHorizontal, BarChart3, Settings, Bug, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BrandLogo } from '@/components/BrandLogo';

const navigation = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Controls', path: '/controls', icon: SlidersHorizontal },
  { label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { label: 'Settings', path: '/settings', icon: Settings },
  { label: 'Debug', path: '/debug', icon: Bug },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const location = useLocation();
  return <>
    {mobileOpen && <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-background/80 md:hidden" onClick={onClose} />}
    <aside className={cn('fixed left-0 top-0 z-40 flex h-screen w-56 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 md:translate-x-0', mobileOpen ? 'translate-x-0' : '-translate-x-full')}>
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4"><BrandLogo size={28} /><button aria-label="Close menu" onClick={onClose} className="min-h-11 min-w-11 text-muted-foreground md:hidden"><X className="mx-auto h-5 w-5" /></button></div>
      <nav className="flex-1 space-y-1 p-3">{navigation.map(item => { const Icon = item.icon; const active = location.pathname === item.path; return <Link key={item.path} to={item.path} onClick={onClose} className={cn('flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors', active ? 'bg-sidebar-accent text-sidebar-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground')}><Icon className={cn('h-4 w-4', active && 'text-primary')} />{item.label}</Link>; })}</nav>
      <div className="border-t border-sidebar-border p-4 text-xs leading-relaxed text-muted-foreground">Paper trading platform<br />No real bets are placed.</div>
    </aside>
  </>;
}