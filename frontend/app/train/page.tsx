"use client";

import { useEffect, useRef, useState } from "react";
import Reveal from "@/components/motion/Reveal";
import CountUp from "@/components/motion/CountUp";
import { DATASET, fetchInventory } from "@/lib/datasets";
import type { DatasetInventory } from "@/lib/types";

type Job = {
  id?: string;
  status: "running" | "completed" | "failed" | "cancelled" | string;
  lines?: string[];
  checkpoint?: string | null;
  returncode?: number | null;
};

const PRESETS = [
  {
    name: "Rápido",
    hint: "solo fc8 · 10 épocas",
    values: { mode: "head-only", epochs: 10, batchSize: 32, learningRate: 0.01, patience: 10, stepSize: 7, gamma: 0.1 },
  },
  {
    name: "Equilibrado",
    hint: "solo fc8 · 20 épocas",
    values: { mode: "head-only", epochs: 20, batchSize: 16, learningRate: 0.005, patience: 8, stepSize: 7, gamma: 0.3 },
  },
  {
    name: "Profundo",
    hint: "todas las capas · 20 épocas",
    values: { mode: "full", epochs: 20, batchSize: 8, learningRate: 0.001, patience: 6, stepSize: 7, gamma: 0.5 },
  },
];

export default function TrainPage() {
  const [dataset] = useState(DATASET);
  const [inventory, setInventory] = useState<DatasetInventory | null>(null);
  const [epochs, setEpochs] = useState(10);
  const [patience, setPatience] = useState(10);
  const [batchSize, setBatchSize] = useState(32);
  const [learningRate, setLearningRate] = useState(0.01);
  const [trainPercent, setTrainPercent] = useState(70);
  const [validPercent, setValidPercent] = useState(15);
  const [testPercent, setTestPercent] = useState(15);
  const [seed, setSeed] = useState(42);
  const [mode, setMode] = useState("head-only");
  const [stepSize, setStepSize] = useState(7);
  const [gamma, setGamma] = useState(0.1);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [activePreset, setActivePreset] = useState("Rápido");
  const logRef = useRef<HTMLPreElement>(null);

  const percentSum = Number((trainPercent + validPercent + testPercent).toFixed(2));
  const percentOk = Math.abs(percentSum - 100) < 0.01;

  useEffect(() => {
    void fetchInventory(dataset)
      .then(setInventory)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo leer el dataset"));
  }, [dataset]);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/backend/training/status/${jobId}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((result: Job) => {
          setJob(result);
          if (result.status !== "running") window.clearInterval(timer);
        })
        .catch(() => undefined);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [jobId]);

  useEffect(() => {
    const node = logRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [job?.lines]);

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setActivePreset(preset.name);
    setMode(preset.values.mode);
    setEpochs(preset.values.epochs);
    setBatchSize(preset.values.batchSize);
    setLearningRate(preset.values.learningRate);
    setPatience(preset.values.patience);
    setStepSize(preset.values.stepSize);
    setGamma(preset.values.gamma);
  };

  const startTraining = async () => {
    setError(null);
    if (!percentOk) {
      setError("Entrenamiento, validación y prueba deben sumar 100 %");
      return;
    }
    setStarting(true);
    setJob(null);
    const form = new FormData();
    form.set("dataset", dataset);
    form.set("epochs", String(epochs));
    form.set("batch_size", String(batchSize));
    form.set("learning_rate", String(learningRate));
    form.set("train_percent", String(trainPercent));
    form.set("valid_percent", String(validPercent));
    form.set("test_percent", String(testPercent));
    form.set("seed", String(seed));
    form.set("mode", mode);
    form.set("step_size", String(stepSize));
    form.set("gamma", String(gamma));
    form.set("patience", String(patience));
    try {
      const response = await fetch("/api/backend/training/start", { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) {
        setError(payload.detail ?? "No se pudo iniciar el entrenamiento");
        return;
      }
      setJobId(payload.job_id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar el entrenamiento");
    } finally {
      setStarting(false);
    }
  };

  const cancelTraining = () => {
    if (!jobId) return;
    void fetch(`/api/backend/training/cancel/${jobId}`, { method: "POST" })
      .then((response) => response.json())
      .then((result: Job) => setJob((current) => ({ ...(current ?? { status: "running" }), ...result })))
      .catch(() => undefined);
  };

  const statusStyle: Record<string, string> = {
    running: "bg-mango-500/15 text-mango-300 ring-mango-500/40",
    completed: "bg-lime-500/15 text-lime-300 ring-lime-500/40",
    failed: "bg-coral-500/15 text-coral-300 ring-coral-500/40",
    cancelled: "bg-white/10 text-mist ring-white/20",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-xs">fine-tuning ZFNet</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-4xl">
            Laboratorio de <span className="text-gradient">entrenamiento</span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-bone/60">
            Ajusta hiperparámetros, lanza el proceso y sigue la salida en vivo. El checkpoint publicado ya
            alcanza <span className="text-lime-300">99.87 %</span> en test: reentrenar es opcional.
          </p>
        </div>
        <span className="chip font-mono">{dataset}</span>
      </header>

      {error && (
        <p className="mt-5 rounded-xl border border-coral-500/30 bg-coral-500/10 px-4 py-3 text-sm text-coral-300">
          {error}
        </p>
      )}

      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: "imágenes", value: inventory?.totals.images ?? 0, decimals: 0, accent: "text-lime-300" },
          { label: "clases", value: inventory?.totals.classes ?? 0, decimals: 0, accent: "text-mint-300" },
          { label: "frutas", value: inventory ? Object.keys(inventory.fruits).length : 0, decimals: 0, accent: "text-mango-300" },
        ].map((stat) => (
          <div key={stat.label} className="card card-hover p-3 sm:p-4">
            <p className={`font-mono text-lg font-semibold sm:text-2xl ${stat.accent}`}>
              <CountUp value={stat.value} />
            </p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-mist sm:text-[10px]">{stat.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-5 grid gap-5 lg:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="card p-4">
            <p className="label-xs">recetas rápidas</p>
            <div className="mt-2 grid gap-2">
              {PRESETS.map((preset) => {
                const active = activePreset === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-all duration-300 ${
                      active
                        ? "border-lime-500/40 bg-lime-500/[0.1] text-lime-200"
                        : "border-white/[0.07] bg-white/[0.02] text-bone/70 hover:-translate-y-0.5 hover:bg-white/[0.05]"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{preset.name}</span>
                      <span className="text-[10px] text-mist">{preset.hint}</span>
                    </span>
                    <span className={`h-2 w-2 rounded-full ${active ? "bg-lime-400 shadow-glow" : "bg-white/15"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="card p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="label-xs">modo</p>
              <span className="font-mono text-[10px] text-mist">{mode === "full" ? "backprop total" : "tronco congelado"}</span>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { key: "head-only", title: "Solo fc8", desc: "rápido y estable" },
                { key: "full", title: "Todas", desc: "ajusta todo ZFNet" },
              ].map((option) => {
                const active = mode === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setMode(option.key);
                      setActivePreset("");
                    }}
                    className={`rounded-xl border p-3 text-left transition-all duration-300 ${
                      active
                        ? "border-mint-400/40 bg-mint-400/[0.1]"
                        : "border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05]"
                    }`}
                  >
                    <span className={`block text-sm font-semibold ${active ? "text-mint-300" : "text-bone/80"}`}>
                      {option.title}
                    </span>
                    <span className="text-[10px] text-mist">{option.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 space-y-4">
              <Slider label="Épocas" value={epochs} min={1} max={200} step={1} onChange={setEpochs} hint={`máx. 15 000`} />
              <Slider label="Batch size" value={batchSize} min={1} max={128} step={1} onChange={setBatchSize} />
              <Slider
                label="Learning rate"
                value={learningRate}
                min={0.0001}
                max={0.05}
                step={0.0001}
                decimals={4}
                onChange={setLearningRate}
              />
              <Slider label="Paciencia" value={patience} min={1} max={50} step={1} onChange={setPatience} hint="early stopping" />
              <Slider label="Step LR" value={stepSize} min={1} max={30} step={1} onChange={setStepSize} hint="épocas por caída" />
              <Slider label="Gamma" value={gamma} min={0.01} max={1} step={0.01} decimals={2} onChange={setGamma} hint="factor de caída" />
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <p className="label-xs">reparto del dataset</p>
                <span className={`font-mono text-[11px] ${percentOk ? "text-mint-300" : "text-coral-400"}`}>
                  {percentSum} %
                </span>
              </div>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <span className="bg-lime-500 transition-all duration-500" style={{ width: `${trainPercent}%` }} />
                <span className="bg-mint-400 transition-all duration-500" style={{ width: `${validPercent}%` }} />
                <span className="bg-mango-500 transition-all duration-500" style={{ width: `${testPercent}%` }} />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniSlider label="train" value={trainPercent} onChange={setTrainPercent} accent="text-lime-300" />
                <MiniSlider label="valid" value={validPercent} onChange={setValidPercent} accent="text-mint-300" />
                <MiniSlider label="test" value={testPercent} onChange={setTestPercent} accent="text-mango-300" />
              </div>
              <button
                type="button"
                onClick={() => {
                  setTrainPercent(70);
                  setValidPercent(15);
                  setTestPercent(15);
                }}
                className="mt-2 w-full rounded-lg border border-white/[0.07] py-1.5 text-[10px] uppercase tracking-widest text-mist transition hover:bg-white/[0.05] hover:text-bone"
              >
                balancear 70 / 15 / 15
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-[11px] text-mist">
                semilla
                <input
                  type="number"
                  value={seed}
                  min={0}
                  onChange={(event) => setSeed(Number(event.target.value))}
                  className="field w-20 px-2 py-1 text-xs"
                />
              </label>
              {job?.status === "running" ? (
                <button type="button" onClick={cancelTraining} className="btn-ghost border-coral-500/30 px-4 py-2 text-xs text-coral-300">
                  Cancelar
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void startTraining()}
                  disabled={starting || !percentOk}
                  className="btn-primary px-4 py-2 text-xs"
                >
                  {starting ? "Iniciando…" : "Iniciar entrenamiento ▶"}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="card flex min-h-[420px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-coral-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-mango-500/70" />
                <span className="h-2.5 w-2.5 rounded-full bg-lime-500/70" />
              </span>
              <h2 className="ml-2 text-sm font-semibold">Salida del proceso</h2>
            </div>
            {job ? (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ${
                  statusStyle[job.status] ?? "bg-white/10 text-mist ring-white/20"
                }`}
              >
                {job.status}
              </span>
            ) : (
              <span className="chip">inactivo</span>
            )}
          </div>

          {job?.checkpoint && (
            <p className="mx-4 mt-3 rounded-xl border border-lime-500/25 bg-lime-500/[0.08] px-3 py-2 text-xs text-lime-200">
              Checkpoint activo: <span className="font-mono">{job.checkpoint}</span>
            </p>
          )}

          <pre
            ref={logRef}
            className="scroll-thin m-4 flex-1 overflow-auto rounded-xl border border-white/[0.06] bg-[#040806] p-4 font-mono text-[11px] leading-6 text-lime-100/90"
          >
            {job?.lines?.length ? (
              <>
                {job.lines.join("\n")}
                {job.status === "running" && <span className="ml-1 inline-block h-3 w-1.5 animate-blink bg-lime-300 align-middle" />}
              </>
            ) : (
              <span className="text-mist">
                {job ? "Esperando salida…" : "› Selecciona una receta, ajusta los hiperparámetros y pulsa Iniciar entrenamiento."}
              </span>
            )}
          </pre>

          <div className="grid gap-2 border-t border-white/[0.06] px-4 py-3 text-[11px] text-mist sm:grid-cols-3">
            <span>modo <b className="font-mono text-bone/80">{mode}</b></span>
            <span>épocas <b className="font-mono text-bone/80">{epochs}</b></span>
            <span>lr <b className="font-mono text-bone/80">{learningRate}</b></span>
          </div>
        </div>
      </section>

      <Reveal className="mt-10">
        <section className="grid gap-3 md:grid-cols-3">
          {[
            { title: "Convolución", text: "y[i,j,k] = Σ x[i+s·m, j+s·n, a] · W[m,n,a,k] + b[k]" },
            { title: "Pérdida", text: "L = −Σ yᵢ log softmax(z)ᵢ" },
            { title: "Descenso", text: "θₜ₊₁ = θₜ − η · ∇θ L(θₜ)" },
          ].map((item) => (
            <article key={item.title} className="card card-hover p-4">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <code className="mt-2 block break-words rounded-lg bg-black/35 px-2.5 py-2 font-mono text-[11px] text-lime-200">
                {item.text}
              </code>
            </article>
          ))}
        </section>
      </Reveal>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  decimals = 0,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  decimals?: number;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-bone/70">
          {label}
          {hint && <span className="ml-1 text-[10px] text-mist">· {hint}</span>}
        </span>
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
          className="field w-24 px-2 py-1 text-right text-xs"
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
        className="mt-2"
      />
      <span className="sr-only">{value.toFixed(decimals)}</span>
    </div>
  );
}

function MiniSlider({
  label,
  value,
  onChange,
  accent,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  accent: string;
}) {
  return (
    <label className="block rounded-lg bg-white/[0.03] px-2 py-1.5">
      <span className={`flex items-center justify-between text-[10px] uppercase tracking-wider ${accent}`}>
        {label}
        <span className="font-mono">{value}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1.5"
        aria-label={label}
      />
    </label>
  );
}
