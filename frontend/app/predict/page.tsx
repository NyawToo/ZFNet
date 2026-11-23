"use client";

import { useEffect, useState } from "react";
import Uploader from "@/components/inference/Uploader";
import PredictionBars from "@/components/inference/PredictionBars";
import LayerExplorer from "@/components/inference/LayerExplorer";
import FruitIcon from "@/components/brand/FruitIcon";
import Reveal from "@/components/motion/Reveal";
import { api } from "@/lib/api";
import { randomSample } from "@/lib/datasets";
import type { LayerInfo, ModelInfo, Prediction } from "@/lib/types";
import { FRUITS } from "@/lib/fruit";

export default function PredictPage() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [layers, setLayers] = useState<LayerInfo[]>([]);
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [sampling, setSampling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.layers().then(setLayers).catch((cause) =>
      setError(cause instanceof Error ? cause.message : "No se pudo cargar ZFNet"),
    );
    void api.model().then(setModel).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!blob) return;
    setBusy(true);
    setError(null);
    void api
      .predict(blob, 10)
      .then((result) => setPredictions(result.predictions))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Error al clasificar"))
      .finally(() => setBusy(false));
  }, [blob]);

  const handleImage = (nextBlob: Blob, nextUrl: string, nextName: string) => {
    if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    setBlob(nextBlob);
    setPreviewUrl(nextUrl);
    setName(nextName);
    setPredictions([]);
  };

  const loadSample = async () => {
    setSampling(true);
    setError(null);
    try {
      const sample = await randomSample();
      if (!sample) throw new Error("no hay imágenes disponibles");
      handleImage(sample.blob, sample.url, sample.item.filename);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo cargar una muestra");
    } finally {
      setSampling(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">inferencia propia</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">
            ¿Qué fruta es y <span className="text-gradient">cómo está</span>?
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-bone/60">
            Sube una foto o prueba una muestra del dataset. Después baja para ver la reconstrucción
            DeconvNet de cualquier capa convolucional.
          </p>
        </div>
        <button type="button" onClick={() => void loadSample()} disabled={sampling} className="btn-ghost px-4 py-2 text-xs">
          {sampling ? "buscando…" : "🎲 probar una muestra"}
        </button>
      </header>

      {error && (
        <p className="mt-5 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-300">
          {error}
        </p>
      )}

      <section className="mt-6 grid gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Uploader onReady={handleImage} busy={busy} />

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <p className="label-xs">modelo activo</p>
              <span className="flex items-center gap-1.5 text-[10px] text-mint-300">
                <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
                listo
              </span>
            </div>
            <div className="mt-3 space-y-2.5 text-xs">
              <Row label="arquitectura" value={model?.name ?? "ZFNet-agro"} />
              <Row label="parámetros" value={model ? `${(model.params / 1e6).toFixed(1)} M` : "86.2 M"} />
              <Row label="entrada" value={`${model?.input_size ?? 224} × ${model?.input_size ?? 224}`} />
              <Row label="clases" value={String(model?.num_classes ?? 10)} />
              {model?.notes && (
                <p className="rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2 text-[10px] leading-4 text-mist">
                  {model.notes}
                </p>
              )}
            </div>
          </div>

          <div className="card p-4">
            <p className="label-xs">cómo leer el resultado</p>
            <ul className="mt-3 space-y-2 text-[11px] leading-5 text-mist">
              <li className="flex gap-2">
                <span className="text-lime-400">01</span> La barra superior es la clase ganadora; el resto
                son las probabilidades que descartó.
              </li>
              <li className="flex gap-2">
                <span className="text-mint-400">02</span> Una confianza baja no siempre es error: puede ser
                una foto fuera del dataset.
              </li>
              <li className="flex gap-2">
                <span className="text-mango-400">03</span> DeconvNet muestra qué zona de la imagen empujó la
                decisión.
              </li>
            </ul>
          </div>
        </div>

        <div className="card relative overflow-hidden p-4 sm:p-5">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-lime-500/10 blur-[80px]" />
          <div className="relative flex items-center justify-between">
            <h2 className="text-sm font-semibold">Top-10 ZFNet</h2>
            {previewUrl && <span className="chip max-w-[50%] truncate font-mono">{name}</span>}
          </div>

          {!previewUrl && (
            <div className="relative flex min-h-[320px] flex-col items-center justify-center gap-6 text-center">
              <div className="relative h-40 w-40">
                <span className="absolute inset-0 rounded-full border border-white/10" />
                <span className="absolute inset-4 rounded-full border border-dashed border-lime-400/25 animate-spin-slower" />
                <span className="absolute inset-10 rounded-full bg-lime-500/10 blur-xl animate-pulse-glow" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-lime-300">
                    <FruitIcon fruit="manzanas" className="h-8 w-8" />
                  </div>
                </div>
                {FRUITS.slice(0, 4).map((fruit, index) => {
                  const angle = ((index * 90 - 90) * Math.PI) / 180;
                  return (
                    <span
                      key={fruit.key}
                      className="absolute animate-float"
                      style={{
                        left: `${50 + 46 * Math.cos(angle)}%`,
                        top: `${50 + 46 * Math.sin(angle)}%`,
                        transform: "translate(-50%,-50%)",
                        color: fruit.color,
                        animationDelay: `${index * -0.8}s`,
                      }}
                    >
                      <FruitIcon fruit={fruit.key} className="h-5 w-5" />
                    </span>
                  );
                })}
              </div>
              <p className="max-w-xs text-sm text-mist">
                Carga una imagen para iniciar la clasificación y la explicación visual.
              </p>
            </div>
          )}

          {previewUrl && (
            <div className="relative mt-4 grid gap-5 md:grid-cols-[200px_minmax(0,1fr)]">
              <div className="relative self-start overflow-hidden rounded-2xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewUrl} alt={name} className="aspect-square w-full object-cover" />
                {busy && (
                  <>
                    <span className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" />
                    <span className="absolute inset-x-0 h-16 animate-scan bg-gradient-to-b from-transparent via-lime-400/40 to-transparent" />
                  </>
                )}
              </div>
              <div>
                {predictions.length ? (
                  <PredictionBars predictions={predictions} />
                ) : (
                  <div className="flex h-full min-h-[180px] items-center justify-center text-sm text-mist">
                    {busy ? "Clasificando…" : "Esperando resultado"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      {blob && (
        <Reveal className="mt-8">
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="label-xs">explicabilidad</p>
                <h2 className="mt-1 text-xl font-semibold sm:text-2xl">
                  Explicación visual y <span className="text-gradient">cálculo inverso</span>
                </h2>
              </div>
              <span className="chip">unpool → deconv → ReLU</span>
            </div>
            <LayerExplorer blob={blob} previewUrl={previewUrl} layers={layers} />
          </section>
        </Reveal>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
      <span className="text-mist">{label}</span>
      <span className="font-mono text-bone/85">{value}</span>
    </div>
  );
}
