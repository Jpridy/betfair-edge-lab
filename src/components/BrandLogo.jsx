import React from 'react';
import { cn } from '@/lib/utils';

export function BrandIcon({ className, size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id="brand-hex-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C3AED" />
          <stop offset="0.35" stopColor="#A855F7" />
          <stop offset="0.7" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#22C55E" />
        </linearGradient>
        <linearGradient id="brand-arrow-grad" x1="12" y1="32" x2="36" y2="14" gradientUnits="userSpaceOnUse">
          <stop stopColor="#22C55E" />
          <stop offset="0.5" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#A855F7" />
        </linearGradient>
      </defs>
      {/* Hexagon outline */}
      <path
        d="M24 3 L42 13.5 L42 34.5 L24 45 L6 34.5 L6 13.5 Z"
        stroke="url(#brand-hex-grad)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Bar chart bars */}
      <rect x="14" y="28" width="4" height="8" rx="1" fill="url(#brand-hex-grad)" opacity="0.7" />
      <rect x="21" y="24" width="4" height="12" rx="1" fill="url(#brand-hex-grad)" opacity="0.85" />
      <rect x="28" y="20" width="4" height="16" rx="1" fill="url(#brand-hex-grad)" />
      {/* Rising arrow / trend line */}
      <path
        d="M13 30 L21 22 L27 26 L35 16"
        stroke="url(#brand-arrow-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Arrow head */}
      <path
        d="M30 16 L36 14 L34 20"
        stroke="url(#brand-arrow-grad)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {/* Node dots */}
      <circle cx="21" cy="22" r="1.8" fill="#22D3EE" />
      <circle cx="27" cy="26" r="1.8" fill="#A855F7" />
    </svg>
  );
}

export function BrandLogo({ className, showText = true, size = 32 }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandIcon size={size} />
      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-base font-extrabold text-foreground tracking-tight">BETFAIR</span>
          <span className="text-xs font-bold tracking-brand text-gradient-brand">EDGE LAB</span>
        </div>
      )}
    </div>
  );
}

export function BrandTagline({ className }) {
  return (
    <div className={cn('flex flex-col items-center gap-1.5', className)}>
      <span className="text-xs font-bold tracking-brand">
        <span className="text-chart-3">ANALYZE</span>
        <span className="text-muted-foreground"> • </span>
        <span className="text-chart-4">SIMULATE</span>
        <span className="text-muted-foreground"> • </span>
        <span className="text-chart-2">EXECUTE</span>
        <span className="text-muted-foreground"> • </span>
        <span className="text-chart-1">WIN</span>
      </span>
    </div>
  );
}

export default BrandLogo;