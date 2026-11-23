"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import PredictionBars from "@/components/inference/PredictionBars";
import FruitIcon from "@/components/brand/FruitIcon";
import Reveal from "@/components/motion/Reveal";
import { FRUITS, prettyFruitState, prettyLabel } from "@/lib/fruit";
import { DATASET, PAGE_SIZE, datasetImageUrl, fetchDatasetPage, fetchInventory, randomSample } from "@/lib/datasets";
import type { ConvMap, DatasetInventory, DatasetItem, Prediction } from "@/lib/types";

export default function ExplorePage() {
  const [inventory, setInventory] = useState<DatasetInventory | null>(null);
  const [fruit, setFruit] = useState("");
  const [label, setLabel] = useState("");
  const [page, setPage] = useState(1);
  const [files, setFiles] = useState<DatasetItem[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<DatasetItem | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [convMaps, setConvMaps] = useState<ConvMap[]>([]);
  const [busy, setBusy] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetchInventory(DATASET)
      .then((result) => {
        setInventory(result);
        const firstFruit = Object.keys(result.fruits)[0] ?? "";
        setFruit(firstFruit);
        setLabel(Object.keys(result.fruits[firstFruit] ?? {})[0] ?? "");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo leer el dataset"));
  }, []);

  const fruits = inventory ? Object.keys(inventory.fruits) : [];
  const classes = inventory && fruit ? Object.keys(inventory.fruits[fruit] ?? {}) : [];
  const activeFruit = fruit && fruits.includes(fruit) ? fruit : fruits[0] ?? "";
  const activeLabel = label && classes.includes(label) ? label : classes[0] ?? "";
  const listKey = `${activeFruit}|${activeLabel}|${page}`;
  const visibleFiles = loadedKey === listKey ? files : [];

  useEffect(() => {
    if (!activeFruit || !activeLabel) return;
    setLoadingPage(true);
    void fetchDatasetPage(activeFruit, activeLabel, page, PAGE_SIZE, DATASET)
      .then((result) => {
        setFiles(result.items);
        setPages(result.pages);
        setTotal(result.total);
        setLoadedKey(`${activeFruit}|${activeLabel}|${page}`);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudieron cargar las imágenes"))
      .finally(() => setLoadingPage(false));
  }, [activeFruit, activeLabel, page]);

  const imageUrl = useCallback(
    (item: DatasetItem) => datasetImageUrl(activeFruit, activeLabel, item.filename, DATASET),
    [activeFruit, activeLabel],
  );

  const analyzeBlob = useCallback(async (blob: Blob) => {
    const [predictionResult, convMaps] = await Promise.all([api.predict(blob, 10), api.convolutions(blob)]);
    setPredictions(predictionResult.predictions);
    setConvMaps(convMaps);
  }, []);

  const analyze = useCallback(
    async (item: DatasetItem) => {
      const url = imageUrl(item);
      setSelected(item);
      setBusy(true);
      setError(null);
      setPredictions([]);
      setConvMaps([]);
      try {
        const blob = await (await fetch(url)).blob();
        await analyzeBlob(blob);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Error al analizar la imagen");
      } finally {
        setBusy(false);
      }
    },
    [imageUrl, analyzeBlob],
  );

  const surprise = useCallback(async () => {
    setBusy(true);
    setError(null);
    setPredictions([]);
    setConvMaps([]);
    try {
      const sample = await randomSample(DATASET);
      if (!sample) return;
      setFruit(sample.fruit);
      setLabel(sample.label);
      setPage(1);
      setSelected(sample.item);
      await analyzeBlob(sample.blob);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Error al analizar la imagen");
    } finally {
      setBusy(false);
    }
  }, [analyzeBlob]);

  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    const start = Math.max(1, Math.min(page - 2, pages - windowSize + 1));
    const end = Math.min(pages, start + windowSize - 1);
    return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
  }, [page, pages]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">dataset sintético</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">
            Galería <span className="text-gradient">viva</span> del dataset
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-bone/60">
            Elige una fruta y un estado, pulsa una imagen y observa la predicción junto a los mapas de
            activación de conv1 a conv5.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip font-mono">
            {inventory ? inventory.totals.images.toLocaleString("es-ES") : "—"} imágenes
          </span>
          <span className="chip font-mono">{inventory?.totals.classes ?? "—"} clases</span>
          <button type="button" onClick={() => void surprise()} className="btn-soft px-4 py-2 text-xs">
            🎲 sorpréndeme
          </button>
        </div>
      </header>

      {error && (
        <p className="mt-5 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-300">
          {error}
        </p>
      )}

      <Reveal className="mt-6">
        <div className="card space-y-3 p-3 sm:p-4">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {FRUITS.map((item) => {
              const active = item.key === activeFruit;
              const available = fruits.includes(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    setFruit(item.key);
                    setLabel("");
                    setPage(1);
                    setSelected(null);
                    setPredictions([]);
                    setConvMaps([]);
                  }}
                  className={`group flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-sm transition-all duration-300 disabled:opacity-40 ${
                    active ? "border-transparent" : "border-white/10 bg-white/[0.03] hover:-translate-y-0.5 hover:bg-white/[0.06]"
                  }`}
                  style={
                    active
                      ? {
                          background: `linear-gradient(135deg, ${item.color}26, ${item.color}0d)`,
                          boxShadow: `0 0 0 1px ${item.color}55, 0 16px 36px -22px ${item.color}`,
                          color: item.color,
                        }
                      : undefined
                  }
                >
                  <FruitIcon fruit={item.key} className={`h-5 w-5 ${active ? "" : "text-bone/50 group-hover:text-bone/80"}`} />
                  <span className={active ? "font-semibold" : "text-bone/70"}>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
            <span className="label-xs mr-1">estado</span>
            {classes.map((className) => {
              const active = className === activeLabel;
              const damaged = /da[nñ]ad/i.test(className);
              return (
                <button
                  key={className}
                  type="button"
                  onClick={() => {
                    setLabel(className);
                    setPage(1);
                    setSelected(null);
                    setPredictions([]);
                    setConvMaps([]);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition-all duration-300 ${
                    active
                      ? damaged
                        ? "bg-coral-500/20 text-coral-300 ring-1 ring-coral-500/40"
                        : "bg-mint-400/15 text-mint-300 ring-1 ring-mint-400/40"
                      : "bg-white/[0.03] text-mist hover:bg-white/[0.07] hover:text-bone"
                  }`}
                >
                  {prettyFruitState(className)}
                </button>
              );
            })}
            <span className="ml-auto font-mono text-[11px] text-mist">
              {total.toLocaleString("es-ES")} imágenes · {pages} páginas
            </span>
          </div>
        </div>
      </Reveal>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_400px] xl:grid-cols-[minmax(0,1fr)_440px]">
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <FruitIcon fruit={activeFruit} className="h-4 w-4" />
              <span className="capitalize">{prettyLabel(activeLabel)}</span>
            </h2>
            <span className="font-mono text-[11px] text-mist">pág. {page}</span>
          </div>

          <div
            key={listKey}
            className={`grid grid-cols-2 gap-2 p-3 transition-opacity duration-300 sm:grid-cols-3 sm:gap-3 sm:p-4 xl:grid-cols-4 ${loadingPage ? "opacity-40" : "opacity-100"}`}
          >
            {visibleFiles.map((item, index) => {
              const url = imageUrl(item);
              const isSelected = selected?.filename === item.filename;
              return (
                <button
                  key={item.filename}
                  type="button"
                  onClick={() => void analyze(item)}
                  className={`group relative aspect-square overflow-hidden rounded-xl border transition-all duration-300 ${
                    isSelected
                      ? "border-lime-400/70 ring-2 ring-lime-400/40"
                      : "border-white/[0.07] hover:-translate-y-0.5 hover:border-lime-400/30"
                  }`}
                  style={{ animation: "pop .5s cubic-bezier(.22,.68,0,1) both", animationDelay: `${Math.min(index, 12) * 30}ms` }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={item.filename}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 font-mono text-[9px] text-white/80 opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
                    analizar ↗
                  </span>
                  {isSelected && (
                    <span className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-lime-400 text-[10px] font-bold text-ink">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
            {loadingPage &&
              !visibleFiles.length &&
              Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={`skeleton-${index}`}
                  className="aspect-square animate-shimmer rounded-xl border border-white/5 bg-[linear-gradient(110deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04))] bg-[length:200%_100%]"
                  style={{ animationDelay: `${index * 60}ms` }}
                />
              ))}
            {!visibleFiles.length && !loadingPage && (
              <p className="col-span-full py-16 text-center text-sm text-mist">
                No hay imágenes para esta clase.
              </p>
            )}
          </div>

          {pages > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-1.5 border-t border-white/[0.06] px-3 py-3">
              <button
                type="button"
                className="btn-soft px-3 py-1.5 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                ←
              </button>
              {pageNumbers.map((number) => (
                <button
                  key={number}
                  type="button"
                  onClick={() => setPage(number)}
                  className={`h-8 w-8 rounded-full font-mono text-xs transition-all duration-300 ${
                    number === page
                      ? "bg-lime-500 font-semibold text-ink shadow-glow"
                      : "bg-white/[0.04] text-mist hover:bg-white/[0.09] hover:text-bone"
                  }`}
                >
                  {number}
                </button>
              ))}
              <button
                type="button"
                className="btn-soft px-3 py-1.5 text-xs"
                disabled={page >= pages}
                onClick={() => setPage((value) => Math.min(pages, value + 1))}
              >
                →
              </button>
            </div>
          )}
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <h2 className="text-sm font-semibold">Análisis de la imagen</h2>
              {busy && (
                <span className="flex items-center gap-2 text-[11px] text-mint-300">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-mint-400" />
                  calculando
                </span>
              )}
            </div>

            <div className="p-4">
              {!selected && (
                <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                    <FruitIcon fruit={activeFruit} className="h-8 w-8" />
                    <span className="absolute inset-0 rounded-2xl border border-lime-400/30 animate-ring" />
                  </div>
                  <p className="max-w-[220px] text-sm text-mist">
                    Pulsa una imagen de la galería para ver qué opina ZFNet.
                  </p>
                </div>
              )}

              {selected && (
                <div className="space-y-4">
                  <div className="relative overflow-hidden rounded-2xl border border-white/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={imageUrl(selected)} alt={selected.filename} className="aspect-square w-full object-cover" />
                    {busy && <span className="absolute inset-0 bg-ink/40 backdrop-blur-[1px]" />}
                    <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-md bg-black/60 px-2 py-1 font-mono text-[9px] text-white/70 backdrop-blur">
                      {selected.filename}
                    </span>
                  </div>

                  {busy && !predictions.length && (
                    <div className="space-y-2">
                      {Array.from({ length: 4 }).map((_, index) => (
                        <div
                          key={index}
                          className="h-3 animate-shimmer rounded-full bg-[linear-gradient(110deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04))] bg-[length:200%_100%]"
                        />
                      ))}
                    </div>
                  )}

                  {predictions.length > 0 && <PredictionBars predictions={predictions} compact />}

                  {convMaps.length > 0 && (
                    <div>
                      <p className="label-xs mb-2">activaciones conv1–conv5</p>
                      <div key={selected?.filename} className="grid grid-cols-5 gap-1.5">
                        {convMaps.map((conv, index) => (
                          <figure
                            key={conv.name}
                            className="group relative overflow-hidden rounded-lg border border-white/[0.07]"
                            style={{ animation: "pop .5s ease both", animationDelay: `${index * 60}ms` }}
                            title={`${conv.name} · ${conv.channels} canales · media ${conv.mean_activation.toFixed(3)}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={conv.map}
                              alt={`Mapa promedio de ${conv.name}`}
                              className="aspect-square w-full object-cover grayscale transition-all duration-500 group-hover:scale-110 group-hover:grayscale-0"
                            />
                            <span className="absolute inset-x-0 bottom-0 bg-black/65 py-0.5 text-center font-mono text-[8px] text-lime-300">
                              {conv.name}
                            </span>
                          </figure>
                        ))}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-1.5">
                        {convMaps.map((conv) => (
                          <div key={`${conv.name}-stat`} className="rounded-lg bg-white/[0.03] px-2 py-1.5">
                            <p className="font-mono text-[9px] text-mist">
                              {conv.name} · {conv.shape.join("×")}
                            </p>
                            <p className="font-mono text-[9px] text-bone/70">
                              μ {conv.mean_activation.toFixed(2)} · máx {conv.max_activation.toFixed(1)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
