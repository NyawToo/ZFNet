"use client";

import Link from "next/link";

const layers = [
  { name: "Entrada", detail: "224 × 224 × 3", formula: "RGB normalizado; media BGR retirada" },
  { name: "conv1", detail: "96 filtros · 7 × 7 · stride 2", formula: "Y = ReLU(X * W + b)" },
  { name: "pool1", detail: "MaxPool 3 × 3 · stride 2", formula: "p = argmax(window); s = índice máximo" },
  { name: "conv2", detail: "256 filtros · 5 × 5 · stride 2", formula: "Y = ReLU(X * W + b)" },
  { name: "pool2", detail: "MaxPool 3 × 3 · stride 2", formula: "LRN → máximo → switches" },
  { name: "conv3–conv5", detail: "512 filtros · 3 × 3", formula: "Extracción progresiva de bordes y texturas" },
  { name: "pool5", detail: "MaxPool 2 × 2 · stride 2", formula: "Mapas 6 × 6 × 512" },
  { name: "fc6–fc7", detail: "4096 → 1024", formula: "h = ReLU(Wx + b)" },
  { name: "fc8", detail: "10 clases agro", formula: "zᵢ = wᵢh + bᵢ; Pᵢ = softmax(z)ᵢ" },
];

export default function HomePage() {
  return (
    <main className="mx-auto max-w-7xl space-y-6 px-5 py-8">
      <section className="grid items-end gap-6 border-b border-black/5 pb-8 md:grid-cols-[1fr_420px]">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-leaf-700">Arquitectura ZFNet · Zeiler & Fergus</p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight">Cómo ZFNet identifica fruta sana o dañada</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-ink/65">
            La imagen pasa por filtros convolucionales que detectan bordes, pigmentos, texturas y lesiones. Las primeras capas conservan detalles locales; las últimas producen una representación global que la cabeza <strong>fc8</strong> convierte en diez probabilidades.
          </p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-ink/50">Clasificador agro</p>
          <div className="mt-2 font-mono text-sm">224 × 224 → 10 logits → 10 probabilidades</div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-black/[0.03] px-2 py-3"><strong className="block text-lg">5</strong>conv</div>
            <div className="rounded-lg bg-black/[0.03] px-2 py-3"><strong className="block text-lg">10</strong>clases</div>
            <div className="rounded-lg bg-black/[0.03] px-2 py-3"><strong className="block text-lg">3</strong>vistas</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">Propagación hacia adelante</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {layers.map((layer, index) => (
            <article key={layer.name} className="card p-4">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-mono text-[11px] text-ink/40">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-xs text-ink/50">{layer.detail}</span>
              </div>
              <h3 className="font-semibold">{layer.name}</h3>
              <code className="mt-3 block rounded-lg bg-black/[0.035] px-3 py-2 text-xs text-ink/70">{layer.formula}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        <article className="card p-5"><h3 className="font-semibold">Softmax</h3><code className="mt-3 block text-sm">Pᵢ = eᶻⁱ / Σⱼ eᶻʲ</code><p className="mt-3 text-sm leading-6 text-ink/60">Convierte los diez logits en una distribución que suma 1.</p></article>
        <article className="card p-5"><h3 className="font-semibold">Cross-entropy</h3><code className="mt-3 block text-sm">L = -Σᵢ yᵢ log(Pᵢ)</code><p className="mt-3 text-sm leading-6 text-ink/60">La clase verdadera recibe un costo alto si ZFNet asigna baja probabilidad.</p></article>
        <article className="card p-5"><h3 className="font-semibold">DeconvNet</h3><code className="mt-3 block text-sm">unpool → desconv → rectificar</code><p className="mt-3 text-sm leading-6 text-ink/60">Los switches recuperan dónde ocurrió cada máximo para reconstruir la región activa.</p></article>
      </section>

      <section className="flex flex-wrap gap-3 border-t border-black/5 pt-6">
        <Link href="/explore" className="btn-primary">Examinar imágenes</Link>
        <Link href="/predict" className="btn-ghost">Probar una imagen propia</Link>
        <Link href="/train" className="btn-ghost">Configurar fine-tuning</Link>
      </section>
    </main>
  );
}
