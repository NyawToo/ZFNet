"use client";

import { useEffect, useState } from "react";

type Dataset = {
  name: string;
  fruits: Record<string, Record<string, string[]>>;
  classes: Record<string, string[]>;
  totals: Record<string, number>;
};

export default function TrainPage() {
  const [datasets, setDatasets] = useState<string[]>(["fruits_dataset_synthetic"]);
  const [selectedDataset, setSelectedDataset] = useState("fruits_dataset_synthetic");
  const [inventory, setInventory] = useState<Dataset | null>(null);
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
  const [job, setJob] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void fetch(`/api/backend/datasets?dataset=${selectedDataset}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      })
      .then(setInventory)
      .catch((cause) => setError(cause instanceof Error ? cause.message : "No se pudo leer el dataset"));
  }, [selectedDataset]);

  useEffect(() => {
    if (!jobId) return;
    const timer = window.setInterval(() => {
      void fetch(`/api/backend/training/status/${jobId}`, { cache: "no-store" })
        .then((response) => response.json())
        .then((result) => {
          setJob(result);
          if (result.status !== "running") window.clearInterval(timer);
        });
    }, 1200);
    return () => window.clearInterval(timer);
  }, [jobId]);

  const startTraining = async () => {
    setError(null);
    setStarting(true);
    if (trainPercent + validPercent + testPercent !== 100) {
      setError("Entrenamiento, validación y prueba deben sumar 100%");
      setStarting(false);
      return;
    }
    setJob(null);
    const form = new FormData();
    form.set("dataset", selectedDataset);
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
    const response = await fetch("/api/backend/training/start", { method: "POST", body: form });
    const payload = await response.json();
    setStarting(false);
    if (!response.ok) {
      setError(payload.detail ?? "No se pudo iniciar el entrenamiento");
      return;
    }
    setJobId(payload.job_id);
  };

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-5 py-6">
      <div>
        <p className="text-xs font-medium uppercase text-leaf-700">Fine-tuning ZFNet</p>
        <h1 className="text-2xl font-semibold">Configurar entrenamiento</h1>
      </div>

      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <div className="card space-y-5 p-5">
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Dataset</span>
            <select value={selectedDataset} onChange={(event) => setSelectedDataset(event.target.value)} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2">
              {datasets.map((dataset) => <option key={dataset}>{dataset}</option>)}
            </select>
          </label>

          {inventory && (
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-xl bg-black/[0.035] px-3 py-3 text-center">
                <strong className="block text-lg">{inventory.totals.images}</strong>
                <span className="text-xs text-ink/50">imágenes</span>
              </div>
              <div className="rounded-xl bg-black/[0.035] px-3 py-3 text-center">
                <strong className="block text-lg">{inventory.totals.classes}</strong>
                <span className="text-xs text-ink/50">clases</span>
              </div>
              <div className="rounded-xl bg-black/[0.035] px-3 py-3 text-center">
                <strong className="block text-lg">{Object.keys(inventory.fruits).length}</strong>
                <span className="text-xs text-ink/50">frutas</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <NumberField label="Épocas" value={epochs} onChange={setEpochs} min={1} max={15000} />
            <NumberField label="Batch size" value={batchSize} onChange={setBatchSize} min={1} max={128} />
            <NumberField label="Learning rate" value={learningRate} onChange={setLearningRate} min={0.00001} step={0.0001} />
            <NumberField label="Entrenamiento %" value={trainPercent} onChange={setTrainPercent} min={0} max={100} />
            <NumberField label="Validación %" value={validPercent} onChange={setValidPercent} min={0} max={100} />
            <NumberField label="Prueba %" value={testPercent} onChange={setTestPercent} min={0} max={100} />
            <NumberField label="Semilla aleatoria" value={seed} onChange={setSeed} min={0} max={999999} />
            <NumberField label="Paciencia early stop" value={patience} onChange={setPatience} min={1} max={1000} />
            <NumberField label="Step LR" value={stepSize} onChange={setStepSize} min={1} />
            <NumberField label="Gamma LR" value={gamma} onChange={setGamma} min={0.0001} max={1} step={0.01} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            {["head-only", "full"].map((option) => (
              <button key={option} type="button" onClick={() => setMode(option)} className={`rounded-lg px-3 py-2 text-sm ${mode === option ? "bg-leaf-700 text-white" : "border border-black/10 bg-white"}`}>
                {option === "head-only" ? "Solo cabeza fc8" : "Todas las capas"}
              </button>
            ))}
          </div>

          {job?.status === "running" ? (
            <button
              type="button"
              onClick={() => void fetch(`/api/backend/training/cancel/${jobId}`, { method: "POST" }).then((response) => response.json()).then(setJob)}
              className="btn-ghost w-full border-red-200 text-red-700"
            >
              Cancelar entrenamiento
            </button>
          ) : (
            <button type="button" onClick={() => void startTraining()} disabled={starting} className="btn-primary w-full">
              {starting ? "Iniciando proceso..." : "Iniciar entrenamiento"}
            </button>
          )}
        </div>

        <div className="card p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="font-semibold">Salida del proceso</h2>
            {job && <span className="chip">{job.status}</span>}
          </div>
          {job ? (
            <div className="space-y-4">
              {job.checkpoint && <p className="rounded-xl border border-leaf-200 bg-leaf-50 px-4 py-3 text-sm text-leaf-800">Checkpoint activo: {job.checkpoint}</p>}
              <pre className="max-h-[520px] overflow-auto rounded-xl bg-[#101511] p-4 font-mono text-xs leading-6 text-green-100">
                {job.lines?.join("\n") || "Esperando salida..."}
              </pre>
            </div>
          ) : (
            <div className="rounded-xl border border-black/5 bg-black/[0.02] px-5 py-12 text-center text-sm text-ink/50">
              Selecciona el dataset y los hiperparámetros, luego inicia el entrenamiento.
            </div>
          )}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-semibold">Qué ocurre matemáticamente</h2>
        <div className="grid gap-3 md:grid-cols-3 text-sm text-ink/70">
          <FormulaCard title="Convolución" text="y[i,j,k] = Σₐ Σₘ Σₙ x[i+s·m,j+s·n,a] W[m,n,a,k] + b[k]" />
          <FormulaCard title="Pérdida" text="L = -Σᵢ yᵢ log(softmax(z)ᵢ)" />
          <FormulaCard title="Descenso SGD" text="θₜ₊₁ = θₜ - η · ∇θL(θₜ)" />
        </div>
      </section>
    </main>
  );
}

function NumberField({ label, value, onChange, min, max, step }: { label: string; value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <label className="space-y-1 text-xs text-ink/60">
      <span>{label}</span>
      <input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} className="w-full rounded-lg border border-black/10 bg-white px-3 py-2 font-mono text-sm text-ink" />
    </label>
  );
}

function FormulaCard({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border border-black/5 bg-white p-4"><strong className="block mb-1">{title}</strong><code className="break-words text-xs">{text}</code></div>;
}
