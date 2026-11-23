"use client";

import { useEffect, useState } from "react";
import type { Prediction } from "@/lib/types";
import { classAccent, prettyLabel } from "@/lib/fruit";
import FruitIcon from "../brand/FruitIcon";

export default function PredictionBars({
  predictions,
  compact = false,
}: {
  predictions: Prediction[];
  compact?: boolean;
}) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(false);
    const frame = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(frame);
  }, [predictions]);

  if (!predictions.length) return null;

  const [top, ...rest] = predictions;
  const topAccent = classAccent(top.label);
  const topPercent = top.probability * 100;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const max = predictions[0].probability || 1;

  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.07] to-transparent p-4">
        <div
          className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full blur-3xl transition-opacity duration-700"
          style={{ background: topAccent.base, opacity: ready ? 0.22 : 0 }}
        />
        <div className="relative flex items-center gap-4">
          <div className="relative h-[86px] w-[86px] shrink-0">
            <svg viewBox="0 0 86 86" className="h-full w-full -rotate-90">
              <circle cx="43" cy="43" r={radius} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="7" />
              <circle
                cx="43"
                cy="43"
                r={radius}
                fill="none"
                stroke={topAccent.base}
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={ready ? circumference * (1 - top.probability) : circumference}
                style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(.22,.68,0,1)" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-lg font-semibold leading-none text-bone">
                {topPercent.toFixed(1)}
                <span className="text-[10px] text-mist">%</span>
              </span>
              <span className="mt-0.5 text-[9px] uppercase tracking-widest text-mist">confianza</span>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mist">clase ganadora</p>
            <div className="mt-1 flex items-center gap-2">
              <FruitIcon label={top.label} className="h-5 w-5 shrink-0" />
              <h3 className="truncate text-lg font-semibold capitalize text-bone">
                {prettyLabel(top.label)}
              </h3>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  background: topAccent.damaged ? "rgba(255,107,107,.14)" : "rgba(94,234,212,.14)",
                  color: topAccent.damaged ? "#FF8A80" : "#5EEAD4",
                }}
              >
                {topAccent.damaged ? "dañada" : "buena"}
              </span>
              <span className="font-mono text-[11px] text-mist">índice {top.index}</span>
            </div>
          </div>
        </div>
      </div>

      <ul className={compact ? "space-y-2" : "space-y-3"}>
        {rest.map((prediction, index) => {
          const accent = classAccent(prediction.label);
          const percent = (prediction.probability / max) * 100;
          return (
            <li
              key={prediction.index}
              className="group rounded-xl px-2 py-1.5 transition-colors duration-300 hover:bg-white/[0.04]"
              style={{ animation: `rise .5s cubic-bezier(.22,.68,0,1) both`, animationDelay: `${80 + index * 55}ms` }}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-[10px] text-mist">{String(index + 2).padStart(2, "0")}</span>
                  <FruitIcon label={prediction.label} className="h-3.5 w-3.5 shrink-0 opacity-80" />
                  <span className="truncate capitalize text-bone/75 transition-colors group-hover:text-bone">
                    {prettyLabel(prediction.label)}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[11px] text-mist">
                  {(prediction.probability * 100).toFixed(2)}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: ready ? `${Math.max(1.5, percent)}%` : "0%",
                    background: `linear-gradient(90deg, ${accent.base}, ${accent.tip})`,
                    transition: `width 1s cubic-bezier(.22,.68,0,1) ${index * 60}ms`,
                    opacity: accent.damaged ? 0.85 : 1,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
