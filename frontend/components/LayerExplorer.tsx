"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ExplainResponse } from "@/lib/types";

type Props = {
  blob: Blob | null;
  previewUrl: string | null;
  layers: string[];
};

const OP_LABEL: Record<string, string> = {
  rect: "rectificar",
  deconv: "deconvolución",
  unpool: "des-pooling",
};

export default function LayerExplorer({ blob, previewUrl, layers }: Props) {
  const [layer, setLayer] = useState(layers[layers.length - 1] ?? "conv5");
  const [channel, setChannel] = useState<string>("");
  const [topK, setTopK] = useState(9);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (targetLayer: string, ch: string, k: number) => {
      if (!blob) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.explain(blob, {
          layer: targetLayer,
          channel: ch === "" ? null : Number(ch),
          topK: k,
        });
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "error inesperado");
        setResult(null);
      } finally {
        setLoading(false);
      }
    },
    [blob],
  );

  useEffect(() => {
    if (blob) void run(layer, channel, topK);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  const stats = result?.layer_stats;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {layers.map((name) => (
          <button
            key={name}
            onClick={() => {
              setLayer(name);
              setChannel("");
              void run(name, "", topK);
            }}
            className={`rounded-xl px-3 py-1.5 text-sm font-medium transition ${
              layer === name
                ? "bg-leaf-700 text-white"
                : "border border-black/10 bg-white text-ink/70 hover:bg-black/[0.02]"
            }`}
          >
            {name}
          </button>
        ))}

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-ink/60">
            canal
            <input
              type="number"
              min={0}
              max={stats ? stats.channels - 1 : 1023}
              value={channel}
              placeholder={stats ? String(stats.top_channel) : "auto"}
              onChange={(e) => setChannel(e.target.value)}
              className="w-20 rounded-lg border border-black/10 bg-white px-2 py-1 font-mono text-xs"
            />
          </label>
          <label className="flex items-center gap-2 text-xs text-ink/60">
            mapas
            <select
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs"
            >
              {[4, 9, 16].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary py-1.5" onClick={() => void run(layer, channel, topK)} disabled={!blob || loading}>
            {loading ? "Calculando…" : "Recalcular"}
          </button>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {loading && !result && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-black/5" />
          ))}
        </div>
      )}

      {result && (
        <div className="space-y-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-sm font-semibold">
                  Reconstrucción DeconvNet · {result.layer} · canal {result.channel}
                </h3>
                <span className="font-mono text-xs text-ink/40">{result.elapsed_ms} ms</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {result.maps.map((m) => (
                  <figure key={`${m.position[0]}-${m.position[1]}`} className="group relative overflow-hidden rounded-xl bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.image}
                      alt={`Reconstrucción en la posición ${m.position.join(",")}`}
                      className="aspect-square w-full object-cover"
                    />
                    <figcaption className="absolute inset-x-0 bottom-0 bg-black/55 px-2 py-1 font-mono text-[10px] text-white/90 opacity-0 transition group-hover:opacity-100">
                      ({m.position[0]}, {m.position[1]}) · {m.activation.toFixed(1)}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Dónde mira la neurona</h3>
              <div className="overflow-hidden rounded-xl border border-black/5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={result.heatmap} alt="Mapa de activación sobre la imagen" className="w-full" />
              </div>
              {previewUrl && (
                <div className="overflow-hidden rounded-xl border border-black/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Imagen original" className="w-full" />
                </div>
              )}
            </div>
          </div>

          {stats && (
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="chip">
                mapa {stats.shape[1]}×{stats.shape[2]}
              </span>
              <span className="chip">{stats.channels} canales</span>
              <span className="chip">canal más activo: {stats.top_channel}</span>
              <span className="chip">activos: {stats.channels - stats.dead_channels}</span>
              <span className="chip">muertos: {stats.dead_channels}</span>
            </div>
          )}

          <details className="rounded-xl border border-black/5 bg-white">
            <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
              Traza del camino inverso ({result.trace.length} pasos)
            </summary>
            <div className="overflow-x-auto px-4 pb-4">
              <table className="w-full text-left text-xs">
                <thead className="font-mono uppercase tracking-wide text-ink/40">
                  <tr>
                    <th className="py-1.5 pr-3">#</th>
                    <th className="py-1.5 pr-3">operación</th>
                    <th className="py-1.5 pr-3">capa</th>
                    <th className="py-1.5 pr-3">forma</th>
                    <th className="py-1.5 pr-3 text-right">máx</th>
                    <th className="py-1.5 text-right">|media|</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {result.trace.map((step, i) => (
                    <tr key={i} className="border-t border-black/5">
                      <td className="py-1.5 pr-3 text-ink/40">{i + 1}</td>
                      <td className="py-1.5 pr-3">{OP_LABEL[step.op] ?? step.op}</td>
                      <td className="py-1.5 pr-3">{step.layer}</td>
                      <td className="py-1.5 pr-3">
                        {step.shape[0]}×{step.shape[1]}
                      </td>
                      <td className="py-1.5 pr-3 text-right">{step.max.toFixed(2)}</td>
                      <td className="py-1.5 text-right">{step.abs_mean.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
