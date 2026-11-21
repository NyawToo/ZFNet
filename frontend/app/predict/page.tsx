"use client";

import { useEffect, useState } from "react";
import Uploader from "@/components/Uploader";
import PredictionBars from "@/components/PredictionBars";
import LayerExplorer from "@/components/LayerExplorer";
import { api } from "@/lib/api";
import type { Prediction } from "@/lib/types";

export default function PredictPage() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [layers, setLayers] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api.layers()
      .then((layerResult) => setLayers(layerResult.map((layer) => layer.name)))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo cargar ZFNet"));
  }, []);

  useEffect(() => {
    if (!blob) return;
    setBusy(true);
    setError(null);
    void api.predict(blob, 10)
      .then((result) => setPredictions(result.predictions))
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Error al clasificar"))
      .finally(() => setBusy(false));
  }, [blob]);

  const handleImage = (nextBlob: Blob, nextUrl: string, nextName: string) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(nextBlob);
    setPreviewUrl(nextUrl);
    setName(nextName);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-5 py-6">
      <div>
        <p className="text-xs font-medium uppercase text-leaf-700">Inferencia propia</p>
        <h1 className="text-2xl font-semibold">¿Qué fruta es y cómo está?</h1>
      </div>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="card p-5">
          <Uploader onReady={handleImage} busy={busy} />
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Top-k ZFNet</h2>
          {previewUrl ? (
            <div className="grid gap-5 md:grid-cols-[180px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt={name} className="aspect-square w-full rounded-xl object-cover" />
              {predictions.length ? <PredictionBars predictions={predictions} /> : <p className="text-sm text-ink/50">Clasificando...</p>}
            </div>
          ) : (
            <div className="flex min-h-44 items-center justify-center rounded-xl bg-black/[0.025] text-sm text-ink/40">Carga una imagen para iniciar</div>
          )}
        </div>
      </section>

      {blob && (
        <section className="card p-5">
          <h2 className="mb-4 font-semibold">Explicación visual y cálculo inverso</h2>
          <LayerExplorer blob={blob} previewUrl={previewUrl} layers={layers} />
        </section>
      )}
    </main>
  );
}
