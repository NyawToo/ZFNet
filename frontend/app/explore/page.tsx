"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PredictionBars from "@/components/PredictionBars";
import type { Prediction } from "@/lib/types";

const DATASET = "fruits_dataset_synthetic";

type Inventory = {
  fruits: Record<string, Record<string, string[]>>;
  classes: Record<string, string[]>;
  totals: Record<string, number>;
};

type ConvMap = {
  name: string;
  shape: number[];
  channels: number;
  map: string;
  mean_activation: number;
  max_activation: number;
};

export default function ExplorePage() {
  const [inventory, setInventory] = useState<Inventory | null>(null);
  const [selectedFruit, setSelectedFruit] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [selectedUrl, setSelectedUrl] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [convMaps, setConvMaps] = useState<ConvMap[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeFiles, setActiveFiles] = useState<Array<{ filename: string; relative_path: string }>>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageSize] = useState(24);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`/api/backend/datasets?dataset=${DATASET}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((result) => {
        setInventory(result);
        const firstFruit = Object.keys(result.fruits)[0] ?? "";
        const firstClass = firstFruit ? Object.keys(result.fruits[firstFruit])[0] ?? "" : "";
        setSelectedFruit(firstFruit);
        setSelectedClass(firstClass);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo leer el dataset"));
  }, []);

  const fruits = inventory ? Object.keys(inventory.fruits) : [];
  const activeFruit = selectedFruit && fruits.includes(selectedFruit) ? selectedFruit : fruits[0] ?? "";
  const classes = activeFruit && inventory ? Object.keys(inventory.fruits[activeFruit]) : [];
  const activeClass = selectedClass && classes.includes(selectedClass) ? selectedClass : classes[0] ?? "";
  useEffect(() => {
    if (!activeFruit || !activeClass) return;
    void fetch(`/api/backend/dataset-page/${DATASET}?fruit=${encodeURIComponent(activeFruit)}&label=${encodeURIComponent(activeClass)}&page=${page}&page_size=${pageSize}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
      .then((result) => {
        setActiveFiles(result.items);
        setPages(result.pages);
        setTotal(result.total);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar las imágenes"));
  }, [activeFruit, activeClass, page, pageSize]);

  const analyzeUrl = async (url: string) => {
    setSelectedUrl(url);
    setBusy(true);
    setError(null);
    setPredictions([]);
    setConvMaps([]);
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const [predictionResult, convResponse] = await Promise.all([
        api.predict(blob, 10),
        (async () => {
          const form = new FormData();
          form.set("file", blob, "validacion.jpg");
          const result = await fetch("/api/backend/convolutions", { method: "POST", body: form });
          if (!result.ok) throw new Error(await result.text());
          return result.json();
        })(),
      ]);
      setPredictions(predictionResult.predictions);
      setConvMaps(convResponse.maps);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al analizar la imagen");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-5 py-6">
      <div>
        <p className="text-xs font-medium uppercase text-leaf-700">Dataset sintético</p>
        <h1 className="text-2xl font-semibold">Galería de imágenes y activaciones</h1>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          {fruits.map((fruit) => (
            <button
              key={fruit}
              onClick={() => {
                setSelectedFruit(fruit);
                setSelectedClass("");
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm ${activeFruit === fruit ? "bg-leaf-700 text-white" : "border border-black/10 bg-white"}`}
            >
              {fruit}
            </button>
          ))}
          {classes.map((className) => (
            <button key={className} onClick={() => { setSelectedClass(className); setPage(1); }} className={`rounded-lg px-3 py-2 text-sm ${activeClass === className ? "bg-ink text-white" : "border border-black/10 bg-white"}`}>
              {className.replaceAll("_", " ")}
            </button>
          ))}
        </div>
      </div>

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="card p-4">
          <h2 className="mb-3 text-sm font-semibold">Imágenes · {activeClass.replaceAll("_", " ")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {activeFiles.map((item) => {
              const filename = item.filename;
              const url = `/api/backend/dataset-image/${DATASET}/${activeFruit}/${activeClass}/${filename}`;
              return (
                <button key={filename} onClick={() => void analyzeUrl(url)} className={`overflow-hidden rounded-lg border-2 ${selectedUrl === url ? "border-leaf-600" : "border-transparent"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={filename} className="aspect-square w-full object-cover" />
                </button>
              );
            })}
          </div>
          {total > pageSize && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <button type="button" className="btn-ghost px-3" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
              <span className="font-mono text-xs text-ink/50">{page} / {pages} · {total} imágenes</span>
              <button type="button" className="btn-ghost px-3" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
            </div>
          )}
        </div>

        <div className="card min-h-96 p-5">
          {selectedUrl ? (
            <div className="grid gap-5 md:grid-cols-[220px_1fr]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={selectedUrl} alt="Imagen seleccionada" className="aspect-square w-full rounded-xl object-cover" />
              <div>
                <h2 className="mb-3 text-sm font-semibold">Predicción ZFNet</h2>
                {busy ? <p className="text-sm text-ink/50">Calculando logits y activaciones...</p> : <PredictionBars predictions={predictions} />}
              </div>
            </div>
          ) : (
            <div className="flex min-h-80 items-center justify-center text-sm text-ink/40">Selecciona una imagen de almacenamiento</div>
          )}

          {convMaps.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-3 font-semibold">Convoluciones observadas</h2>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                {convMaps.map((conv) => (
                  <article key={conv.name} className="rounded-xl border border-black/5 p-3">
                    <div className="mb-2 flex items-baseline justify-between"><strong>{conv.name}</strong><span className="font-mono text-[10px] text-ink/40">{conv.shape.join("×")}</span></div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={conv.map} alt={`Mapa promedio de ${conv.name}`} className="mb-2 aspect-square w-full rounded-lg object-cover grayscale" />
                    <p className="text-xs text-ink/60">{conv.channels} canales</p>
                    <p className="font-mono text-[10px] text-ink/50">media {conv.mean_activation.toFixed(3)}</p>
                    <p className="font-mono text-[10px] text-ink/50">máximo {conv.max_activation.toFixed(3)}</p>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
