"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ExplainResponse, LayerInfo } from "@/lib/types";

type Props = {
  blob: Blob | null;
  previewUrl: string | null;
  layers: LayerInfo[];
};

const OP_LABEL: Record<string, string> = {
  rect: "rectificar",
  deconv: "deconvolución",
  unpool: "des-pooling",
};

const OP_COLOR: Record<string, string> = {
  rect: "bg-mango-400",
  deconv: "bg-mint-400",
  unpool: "bg-lime-400",
};

export default function LayerExplorer({ blob, previewUrl, layers }: Props) {
  const initialLayer = layers[layers.length - 1]?.name ?? "conv5";
  const [layer, setLayer] = useState(initialLayer);
  const [channel, setChannel] = useState<number>(-1);
  const [topK, setTopK] = useState(9);
  const [blend, setBlend] = useState(85);
  const [result, setResult] = useState<ExplainResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (targetLayer: string, ch: number, k: number) => {
      if (!blob) return;
      setLoading(true);
      setError(null);
      try {
        const res = await api.explain(blob, {
          layer: targetLayer,
          channel: ch >= 0 ? ch : null,
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
    if (blob) void run(initialLayer, -1, topK);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blob]);

  const stats = result?.layer_stats;
  const maxChannel = stats ? Math.max(0, stats.channels - 1) : 511;
  const channelValue = channel >= 0 ? Math.min(channel, maxChannel) : stats?.top_channel ?? 0;

  return (
    <div className="space-y-6">
      <div className="card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-white/[0.06] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-xs mr-1">capa</span>
            {layers.map((info, index) => {
              const active = layer === info.name;
              return (
                <button
                  key={info.name}
                  type="button"
                  onClick={() => {
                    setLayer(info.name);
                    setChannel(-1);
                    void run(info.name, -1, topK);
                  }}
                  className={`group relative overflow-hidden rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-300 ${
                    active
                      ? "text-ink shadow-glow"
                      : "border border-white/10 bg-white/[0.03] text-bone/70 hover:-translate-y-0.5 hover:border-lime-500/30 hover:text-bone"
                  }`}
                  style={
                    active
                      ? { backgroundImage: "linear-gradient(120deg,#D6FF9B,#A3E635 55%,#5EEAD4)" }
                      : undefined
                  }
                >
                  <span className="relative z-10 font-mono">{info.name}</span>
                  <span className={`relative z-10 ml-1.5 text-[9px] ${active ? "text-ink/60" : "text-mist"}`}>
                    {info.steps} pasos
                  </span>
                  {!active && (
                    <span className="absolute inset-x-0 bottom-0 h-px scale-x-0 bg-gradient-to-r from-transparent via-lime-400/60 to-transparent transition-transform duration-300 group-hover:scale-x-100" />
                  )}
                  <span className="sr-only">{index + 1}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-xs">
                <span className="label-xs">canal de la neurona</span>
                <span className="font-mono text-[11px] text-lime-300">
                  {channel >= 0 ? channel : `auto · ${stats?.top_channel ?? "—"}`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={maxChannel}
                  value={channelValue}
                  onChange={(event) => setChannel(Number(event.target.value))}
                  onPointerUp={() => void run(layer, channel, topK)}
                  onKeyUp={(event) => {
                    if (event.key === "Enter") void run(layer, channel, topK);
                  }}
                  aria-label="Canal de la neurona"
                />
                <button
                  type="button"
                  onClick={() => {
                    setChannel(-1);
                    void run(layer, -1, topK);
                  }}
                  className={`shrink-0 rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition ${
                    channel < 0
                      ? "border-lime-500/40 bg-lime-500/15 text-lime-300"
                      : "border-white/10 bg-white/[0.03] text-mist hover:text-bone"
                  }`}
                >
                  auto
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div>
                <p className="label-xs mb-1.5">mapas</p>
                <div className="seg">
                  {[4, 9, 16].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => {
                        setTopK(n);
                        void run(layer, channel, n);
                      }}
                      className={`seg-item ${topK === n ? "seg-item-active" : ""}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="btn-primary mt-4 px-4 py-2 text-xs"
                onClick={() => void run(layer, channel, topK)}
                disabled={!blob || loading}
              >
                {loading ? "Calculando…" : "Recalcular"}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          {error && (
            <p className="rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-300">
              {error}
            </p>
          )}

          {loading && !result && (
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-shimmer rounded-xl border border-white/5 bg-[linear-gradient(110deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04))] bg-[length:200%_100%]"
                  style={{ animationDelay: `${i * 90}ms` }}
                />
              ))}
            </div>
          )}

          {result && (
            <div className={`space-y-6 transition-opacity duration-300 ${loading ? "opacity-40" : "opacity-100"}`}>
              <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
                <div>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="text-sm font-semibold">
                      Reconstrucción DeconvNet
                      <span className="ml-2 font-mono text-xs text-mint-300">{result.layer}</span>
                      <span className="ml-1 font-mono text-xs text-mist">· canal {result.channel}</span>
                    </h3>
                    <span className="chip">
                      <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
                      {result.elapsed_ms} ms
                    </span>
                  </div>
                  <div
                    key={`${result.layer}-${result.channel}-${result.maps.length}`}
                    className="grid grid-cols-2 gap-2.5 sm:grid-cols-3"
                  >
                    {result.maps.map((map, index) => (
                      <figure
                        key={`${map.position[0]}-${map.position[1]}`}
                        className="group relative overflow-hidden rounded-xl border border-white/10 bg-black"
                        style={{ animation: "pop .5s cubic-bezier(.22,.68,0,1) both", animationDelay: `${index * 45}ms` }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={map.image}
                          alt={`Reconstrucción en la posición ${map.position.join(",")}`}
                          className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                        <figcaption className="absolute inset-x-0 bottom-0 translate-y-2 bg-gradient-to-t from-black/90 to-transparent px-2 pb-1.5 pt-6 font-mono text-[10px] text-white/90 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                          ({map.position[0]}, {map.position[1]}) · act {map.activation.toFixed(1)}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Dónde mira la neurona</h3>
                    {result.sheet && (
                      <a
                        href={result.sheet}
                        download={`deconv-${result.layer}-${result.channel}.png`}
                        className="text-[11px] font-medium text-mint-300 transition hover:text-mint-400"
                      >
                        descargar hoja ↓
                      </a>
                    )}
                  </div>
                  <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl ?? result.heatmap}
                      alt="Imagen original"
                      className="aspect-square w-full object-cover"
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.heatmap}
                      alt="Mapa de activación sobre la imagen"
                      className="absolute inset-0 aspect-square w-full object-cover transition-opacity duration-200"
                      style={{ opacity: blend / 100 }}
                    />
                    <div className="absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 backdrop-blur">
                      <span className="text-[10px] uppercase tracking-wider text-white/60">calor</span>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={blend}
                        onChange={(event) => setBlend(Number(event.target.value))}
                        aria-label="Opacidad del mapa de calor"
                        className="h-1"
                      />
                      <span className="w-8 text-right font-mono text-[10px] text-white/80">{blend}%</span>
                    </div>
                  </div>

                  {stats && (
                    <div className="grid grid-cols-2 gap-2">
                      <Stat label="mapa" value={`${stats.shape[1]}×${stats.shape[2]}`} />
                      <Stat label="canales" value={String(stats.channels)} />
                      <Stat label="canal top" value={String(stats.top_channel)} />
                      <Stat label="muertos" value={String(stats.dead_channels)} />
                    </div>
                  )}
                </div>
              </div>

              <details className="group rounded-2xl border border-white/[0.07] bg-black/20" open>
                <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium">
                  <span>
                    Camino inverso <span className="text-mist">({result.trace.length} pasos)</span>
                  </span>
                  <span className="text-xs text-mist transition-transform duration-300 group-open:rotate-180">▾</span>
                </summary>
                <ol
                  key={`${result.layer}-${result.channel}`}
                  className="relative space-y-0 px-4 pb-4"
                >
                  {result.trace.map((step, index) => (
                    <li
                      key={index}
                      className="relative flex items-center gap-3 border-l border-white/10 py-1.5 pl-4 text-xs"
                      style={{ animation: "rise .45s ease both", animationDelay: `${index * 40}ms` }}
                    >
                      <span
                        className={`absolute -left-[4.5px] h-2 w-2 rounded-full ${OP_COLOR[step.op] ?? "bg-bone"}`}
                      />
                      <span className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-wider text-mist">
                        {OP_LABEL[step.op] ?? step.op}
                      </span>
                      <span className="w-14 shrink-0 font-mono text-[11px] text-bone/80">{step.layer}</span>
                      <span className="font-mono text-[10px] text-mist">
                        {step.shape[0]}×{step.shape[1]}
                      </span>
                      <span className="ml-auto font-mono text-[10px] text-lime-300/80">máx {step.max.toFixed(1)}</span>
                      <span className="w-16 text-right font-mono text-[10px] text-mist">
                        |μ| {step.abs_mean.toFixed(3)}
                      </span>
                    </li>
                  ))}
                </ol>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <p className="text-[9px] uppercase tracking-widest text-mist">{label}</p>
      <p className="mt-0.5 font-mono text-sm text-bone">{value}</p>
    </div>
  );
}
