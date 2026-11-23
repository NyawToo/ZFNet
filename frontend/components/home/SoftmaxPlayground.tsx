"use client";

import { useState } from "react";
import { prettyLabel } from "@/lib/fruit";
import FruitIcon from "../brand/FruitIcon";

const CLASSES = [
  { label: "banana_buena", color: "#FFD84D", init: 6.4 },
  { label: "manzana_dañada", color: "#FF5C7A", init: 2.6 },
  { label: "naranja_buena", color: "#FF9F1C", init: 1.2 },
];

export default function SoftmaxPlayground() {
  const [logits, setLogits] = useState(CLASSES.map((item) => item.init));

  const max = Math.max(...logits);
  const exps = logits.map((value) => Math.exp(value - max));
  const sum = exps.reduce((acc, value) => acc + value, 0);
  const probs = exps.map((value) => value / sum);
  const winner = probs.indexOf(Math.max(...probs));

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
        <div>
          <h3 className="text-sm font-semibold">Juega con la softmax</h3>
          <p className="mt-0.5 text-[11px] text-mist">Mueve los logits y mira cómo cambia la confianza.</p>
        </div>
        <span className="chip font-mono">Σ = 1.00</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {CLASSES.map((item, index) => (
          <div key={item.label} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-bone/80">
                <FruitIcon label={item.label} className="h-3.5 w-3.5" />
                <span className="capitalize">{prettyLabel(item.label)}</span>
              </span>
              <span className="font-mono text-[11px] text-mist">
                z = {logits[index].toFixed(1)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-4}
                max={10}
                step={0.1}
                value={logits[index]}
                onChange={(event) => {
                  const next = [...logits];
                  next[index] = Number(event.target.value);
                  setLogits(next);
                }}
                aria-label={`Logit de ${item.label}`}
                className="flex-1"
              />
              <div className="w-28 shrink-0">
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className="h-full rounded-full transition-[width] duration-200"
                    style={{
                      width: `${Math.max(1, probs[index] * 100)}%`,
                      background: `linear-gradient(90deg, ${item.color}, ${index === winner ? "#5EEAD4" : item.color}aa)`,
                    }}
                  />
                </div>
              </div>
              <span
                className={`w-14 shrink-0 text-right font-mono text-[11px] ${
                  index === winner ? "text-lime-300" : "text-mist"
                }`}
              >
                {(probs[index] * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        ))}

        <div className="rounded-xl border border-white/[0.06] bg-black/30 px-3 py-2.5 font-mono text-[11px] text-mist">
          P<sub>i</sub> = e<sup>z<sub>i</sub> − max(z)</sup> / Σ<sub>j</sub> e<sup>z<sub>j</sub> − max(z)</sup>
          <span className="ml-2 text-lime-300/80">→ la suma siempre da 1</span>
        </div>
      </div>
    </div>
  );
}
