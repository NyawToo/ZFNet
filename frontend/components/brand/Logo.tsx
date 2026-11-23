"use client";

import { useId } from "react";

export function LogoMark({ className = "h-10 w-10" }: { className?: string }) {
  const id = useId().replace(/[:]/g, "");
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label="ZFNet Agro">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0C1A12" />
          <stop offset="1" stopColor="#040906" />
        </linearGradient>
        <linearGradient id={`${id}-fruit`} x1="16" y1="20" x2="48" y2="54" gradientUnits="userSpaceOnUse">
          <stop stopColor="#D6FF9B" />
          <stop offset="0.55" stopColor="#A3E635" />
          <stop offset="1" stopColor="#2DD4BF" />
        </linearGradient>
        <linearGradient id={`${id}-leaf`} x1="33" y1="18" x2="46" y2="8" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFD98A" />
          <stop offset="1" stopColor="#FFB020" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill={`url(#${id}-bg)`} />
      <rect x="0.6" y="0.6" width="62.8" height="62.8" rx="15.4" fill="none" stroke="#A3E635" strokeOpacity="0.28" />
      <path d="M32.5 19.5c0-5.2 4.4-9.4 10.5-10.2.5 6.3-4 10.2-10.5 10.2Z" fill={`url(#${id}-leaf)`} />
      <circle cx="32" cy="36.5" r="15.5" fill="none" stroke={`url(#${id}-fruit)`} strokeWidth="3" />
      <circle cx="32" cy="36.5" r="15.5" fill="#A3E635" fillOpacity="0.06" />
      <path
        d="M25 31.5h14M25 31.5l7 11.5M39 31.5 32 43"
        stroke="#E9F3EC"
        strokeOpacity="0.5"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="25" cy="31.5" r="2.7" fill="#D6FF9B">
        <animate attributeName="opacity" values="1;.45;1" dur="3.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="39" cy="31.5" r="2.7" fill="#5EEAD4">
        <animate attributeName="opacity" values=".45;1;.45" dur="3.4s" repeatCount="indefinite" />
      </circle>
      <circle cx="32" cy="43" r="2.7" fill="#FFB020">
        <animate attributeName="opacity" values="1;.55;1" dur="4.6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

export default function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative">
        <span className="absolute -inset-1 rounded-2xl bg-lime-500/20 blur-md" aria-hidden />
        <LogoMark className="relative h-9 w-9 sm:h-10 sm:w-10" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="block text-[15px] font-semibold tracking-tight text-bone">
            ZFNet <span className="text-lime-400">Agro</span>
          </span>
          <span className="mt-1 block text-[9px] font-medium uppercase tracking-[0.22em] text-mist">
            neural fruit lab
          </span>
        </span>
      )}
    </span>
  );
}
