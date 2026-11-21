import type { Prediction } from "@/lib/types";

export default function PredictionBars({ predictions }: { predictions: Prediction[] }) {
  if (!predictions.length) return null;
  const top = predictions[0].probability || 1;

  return (
    <ul className="space-y-3">
      {predictions.map((p, i) => (
        <li key={p.index} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className={i === 0 ? "font-semibold" : "text-ink/70"}>
              <span className="mr-2 font-mono text-xs text-ink/40">{String(i + 1).padStart(2, "0")}</span>
              {p.label}
            </span>
            <span className={`font-mono text-xs ${i === 0 ? "text-leaf-700" : "text-ink/50"}`}>
              {(p.probability * 100).toFixed(2)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.06]">
            <div
              className={`h-full rounded-full ${i === 0 ? "bg-leaf-600" : "bg-leaf-300"}`}
              style={{ width: `${Math.max(2, (p.probability / top) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
