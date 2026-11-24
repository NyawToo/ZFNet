"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LogoMark } from "@/components/brand/Logo";
import FruitIcon from "@/components/brand/FruitIcon";
import Reveal from "@/components/motion/Reveal";
import CountUp from "@/components/motion/CountUp";
import SoftmaxPlayground from "@/components/home/SoftmaxPlayground";
import { FRUITS } from "@/lib/fruit";

type Layer = {
  name: string;
  shape: string;
  detail: string;
  formula: string;
  text: string;
  accent: string;
  resolution: number;
};

const LAYERS: Layer[] = [
  {
    name: "Entrada",
    shape: "224×224×3",
    detail: "imagen RGB",
    formula: "x ∈ ℝ²²⁴ˣ²²⁴ˣ³",
    text: "La foto se recorta y normaliza. Cada píxel entra como tres números: rojo, verde y azul.",
    accent: "#8FA69A",
    resolution: 100,
  },
  {
    name: "conv1",
    shape: "109×109×96",
    detail: "96 filtros · 7×7 · stride 2",
    formula: "Y = ReLU(X ∗ W + b)",
    text: "Detecta bordes, manchas y transiciones de color. Es la capa que más resolución conserva.",
    accent: "#A3E635",
    resolution: 92,
  },
  {
    name: "pool1",
    shape: "54×54×96",
    detail: "max-pool 3×3 · stride 2",
    formula: "p = argmax(ventana)",
    text: "Reduce el mapa a la mitad y guarda los switches: dónde estaba el máximo. DeconvNet los reutiliza.",
    accent: "#5EEAD4",
    resolution: 78,
  },
  {
    name: "conv2",
    shape: "25×25×256",
    detail: "256 filtros · 5×5 · stride 2",
    formula: "Y = ReLU(X ∗ W + b)",
    text: "Combina bordes en texturas: la piel de la fruta, el brillo, las grietas incipientes.",
    accent: "#FFB020",
    resolution: 64,
  },
  {
    name: "pool2",
    shape: "12×12×256",
    detail: "max-pool 3×3 · stride 2",
    formula: "LRN → máximo → switch",
    text: "Segunda compresión. La red empieza a hablar de regiones, no de píxeles.",
    accent: "#FF9F1C",
    resolution: 54,
  },
  {
    name: "conv3",
    shape: "12×12×512",
    detail: "512 filtros · 3×3",
    formula: "Y = ReLU(X ∗ W + b)",
    text: "Aparecen patrones de manchas y decoloración: señales directas de daño.",
    accent: "#FF7A59",
    resolution: 46,
  },
  {
    name: "conv4",
    shape: "12×12×512",
    detail: "512 filtros · 3×3",
    formula: "Y = ReLU(X ∗ W + b)",
    text: "Mezcla texturas en conceptos: “zona oscura y blanda”, “borde marrón”.",
    accent: "#FF5C7A",
    resolution: 40,
  },
  {
    name: "conv5",
    shape: "12×12×512",
    detail: "512 filtros · 3×3",
    formula: "Y = ReLU(X ∗ W + b)",
    text: "La representación más abstracta de la fruta. Aquí se decide buena o dañada.",
    accent: "#D6FF9B",
    resolution: 34,
  },
  {
    name: "pool5",
    shape: "6×6×512",
    detail: "max-pool 2×2 · stride 2",
    formula: "6×6×512 = 18 432",
    text: "Última rejilla espacial: 18 432 números resumen toda la imagen.",
    accent: "#8FF7E4",
    resolution: 26,
  },
  {
    name: "fc6",
    shape: "4096",
    detail: "densa + ReLU",
    formula: "h = ReLU(Wx + b)",
    text: "Cada neurona combina toda la rejilla. Aquí viven los detectores de “fruta sana”.",
    accent: "#BFF77E",
    resolution: 16,
  },
  {
    name: "fc7",
    shape: "1024",
    detail: "densa + ReLU",
    formula: "h = ReLU(Wx + b)",
    text: "Compresión final: 1024 números con la esencia de la imagen.",
    accent: "#EAFFC4",
    resolution: 10,
  },
  {
    name: "fc8",
    shape: "10",
    detail: "10 clases agro",
    formula: "Pᵢ = softmax(z)ᵢ",
    text: "Una probabilidad por clase: cinco frutas, cada una buena o dañada.",
    accent: "#FFD98A",
    resolution: 4,
  },
];

export default function HomePage() {
  const [active, setActive] = useState(1);
  const [playing, setPlaying] = useState(false);
  const layer = LAYERS[active];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % LAYERS.length);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
      {/* ---------------- HERO ---------------- */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="animate-rise">
          <div className="flex flex-wrap items-center gap-3">
            <img
              src="/UDEC.png"
              alt="Logo UDEC"
              width={200}
              height={150}
              className="h-[200px] w-[150px] object-contain"
            />

            <span className="inline-flex items-center gap-2 rounded-full border border-lime-500/25 bg-lime-500/[0.08] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-lime-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-lime-400" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-lime-400" />
              </span>
              ZFNet · ILSVRC 2013 · fine-tuned
            </span>
          </div>

          <h1 className="mt-5 text-[2.15rem] font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            La red neuronal que
            <br className="hidden sm:block" />{" "}
            <span className="text-gradient animate-gradient-move">mira la fruta</span> por dentro.
          </h1>

          <p className="mt-5 max-w-xl text-sm leading-6 text-bone/65 sm:text-base sm:leading-7">
            Clasifica cinco frutas en estado <span className="text-mint-300">bueno</span> o{" "}
            <span className="text-coral-400">dañado</span> y reconstruye con DeconvNet exactamente qué
            zona de la imagen activó cada neurona.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/predict" className="btn-primary group">
              Probar una imagen
              <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <Link href="/explore" className="btn-ghost">
              Explorar el dataset
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap gap-2">
            {["10 clases", "224 × 224 px", "DeconvNet", "CPU friendly"].map((item) => (
              <span key={item} className="chip">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="relative mx-auto aspect-square w-full max-w-[440px]">
          <div className="absolute inset-0 rounded-full border border-white/[0.07]" />
          <div className="absolute inset-[8%] rounded-full border border-dashed border-lime-400/25 animate-spin-slower" />
          <div className="absolute inset-[20%] rounded-full border border-white/[0.06]" />
          <div className="absolute inset-[20%] rounded-full border border-dashed border-mint-400/20 animate-spin-slow [animation-direction:reverse]" />
          <div className="absolute inset-[30%] rounded-full bg-lime-500/[0.09] blur-2xl animate-pulse-glow" />
          <div className="absolute inset-[38%] rounded-full bg-mango-500/[0.08] blur-2xl animate-pulse-glow [animation-delay:-2.5s]" />

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="relative flex h-28 w-28 items-center justify-center rounded-[34px] border border-white/10 bg-ink/80 shadow-glow backdrop-blur sm:h-32 sm:w-32">
              <LogoMark className="h-16 w-16 sm:h-20 sm:w-20" />
              <span className="absolute inset-0 rounded-[34px] ring-1 ring-inset ring-white/5" />
            </div>
          </div>

          {FRUITS.map((fruit, index) => {
            const angle = ((index * 72 - 90) * Math.PI) / 180;
            const x = 50 + 44 * Math.cos(angle);
            const y = 50 + 44 * Math.sin(angle);
            return (
              <div
                key={fruit.key}
                className="group absolute"
                style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%,-50%)" }}
              >
                <div className="animate-float" style={{ animationDelay: `${index * -1.3}s` }}>
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] backdrop-blur transition-all duration-300 group-hover:-translate-y-1 group-hover:scale-110"
                    style={{ color: fruit.color, boxShadow: `0 14px 34px -18px ${fruit.color}` }}
                  >
                    <FruitIcon fruit={fruit.key} className="h-6 w-6" />
                  </div>
                  <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-2 py-0.5 text-[9px] uppercase tracking-widest text-bone/80 opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100">
                    {fruit.singular}
                  </span>
                </div>
              </div>
            );
          })}

          {[
            { top: "12%", left: "24%" },
            { top: "76%", left: "14%" },
            { top: "68%", left: "86%" },
            { top: "24%", left: "82%" },
          ].map((dot, index) => (
            <span
              key={index}
              className="absolute h-1.5 w-1.5 rounded-full bg-mint-400/70 animate-pulse-glow"
              style={{ ...dot, animationDelay: `${index * 0.8}s` }}
            />
          ))}
        </div>
      </section>

      {/* ---------------- STATS ---------------- */}
      <Reveal className="mt-14">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "imágenes", value: 15692, decimals: 0, suffix: "", accent: "text-lime-300" },
            { label: "clases", value: 10, decimals: 0, suffix: "", accent: "text-mint-300" },
            { label: "exactitud test", value: 99.87, decimals: 2, suffix: " %", accent: "text-mango-300" },
            { label: "parámetros", value: 86.2, decimals: 1, suffix: " M", accent: "text-coral-300" },
          ].map((stat) => (
            <div key={stat.label} className="card card-hover p-4 sm:p-5">
              <p className={`stat-value ${stat.accent}`}>
                <CountUp value={stat.value} decimals={stat.decimals} suffix={stat.suffix} />
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-mist">{stat.label}</p>
            </div>
          ))}
        </div>
      </Reveal>

      {/* ---------------- PIPELINE ---------------- */}
      <Reveal className="mt-16">
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/[0.06] p-5 sm:p-6">
            <div>
              <p className="label-xs">propagación hacia adelante</p>
              <h2 className="mt-1 text-xl font-semibold sm:text-2xl">Recorre la red capa por capa</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((value) => !value)}
                className={`btn-soft px-4 py-2 text-xs ${playing ? "border-lime-500/40 text-lime-300" : ""}`}
              >
                {playing ? "❚❚ pausar" : "▶ recorrer"}
              </button>
              <span className="chip font-mono">
                {String(active + 1).padStart(2, "0")} / {LAYERS.length}
              </span>
            </div>
          </div>

          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 py-4 sm:px-6">
            {LAYERS.map((item, index) => {
              const isActive = index === active;
              const isPast = index < active;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    setActive(index);
                    setPlaying(false);
                  }}
                  className={`relative shrink-0 rounded-xl border px-3 py-2 text-left transition-all duration-300 ${
                    isActive
                      ? "border-transparent bg-white/[0.08] shadow-glow"
                      : "border-white/[0.07] bg-white/[0.02] hover:-translate-y-0.5 hover:bg-white/[0.05]"
                  }`}
                  style={isActive ? { boxShadow: `0 0 0 1px ${item.accent}55, 0 16px 40px -22px ${item.accent}` } : undefined}
                >
                  <span
                    className="mb-1 block h-1 w-8 rounded-full transition-all duration-300"
                    style={{ background: isActive || isPast ? item.accent : "rgba(255,255,255,.12)" }}
                  />
                  <span className={`block font-mono text-[11px] ${isActive ? "text-bone" : "text-bone/60"}`}>
                    {item.name}
                  </span>
                  <span className="block text-[9px] text-mist">{item.shape}</span>
                </button>
              );
            })}
          </div>

          <div key={layer.name} className="grid animate-pop gap-6 border-t border-white/[0.06] p-5 sm:p-6 md:grid-cols-[1.1fr_0.9fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-mono text-2xl font-semibold" style={{ color: layer.accent }}>
                  {layer.name}
                </h3>
                <span className="chip font-mono">{layer.shape}</span>
                <span className="chip">{layer.detail}</span>
              </div>
              <p className="mt-3 max-w-xl text-sm leading-6 text-bone/65">{layer.text}</p>
              <code className="mt-4 inline-block rounded-xl border border-white/[0.07] bg-black/40 px-3 py-2 font-mono text-xs text-lime-200">
                {layer.formula}
              </code>
            </div>

            <div className="space-y-3">
              <div>
                <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-mist">
                  <span>resolución espacial</span>
                  <span>{layer.resolution}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${layer.resolution}%`,
                      background: `linear-gradient(90deg, ${layer.accent}, #5EEAD4)`,
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex justify-between text-[10px] uppercase tracking-widest text-mist">
                  <span>profundidad semántica</span>
                  <span>{100 - layer.resolution}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${100 - layer.resolution}%`,
                      background: "linear-gradient(90deg, #FFB020, #FF6B6B)",
                    }}
                  />
                </div>
              </div>
              <p className="text-[11px] leading-5 text-mist">
                Las primeras capas ven píxeles; las últimas ven conceptos. Ese viaje es lo que hace
                explicable a ZFNet.
              </p>
            </div>
          </div>
        </section>
      </Reveal>

      {/* ---------------- MATH + SOFTMAX ---------------- */}
      <div className="mt-16 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Reveal>
          <SoftmaxPlayground />
        </Reveal>

        <Reveal delay={120} className="grid gap-3 sm:grid-cols-2">
          {[
            {
              title: "Convolución",
              formula: "y = Σ x·w + b",
              text: "Cada filtro recorre la imagen buscando un patrón.",
              accent: "from-lime-500/20",
            },
            {
              title: "ReLU",
              formula: "f(x) = max(0, x)",
              text: "Apaga lo negativo y deja pasar lo relevante.",
              accent: "from-mint-400/20",
            },
            {
              title: "Entropía cruzada",
              formula: "L = −Σ y·log P",
              text: "Castiga fuerte cuando la clase correcta tiene poca probabilidad.",
              accent: "from-mango-500/20",
            },
            {
              title: "DeconvNet",
              formula: "unpool → deconv → ReLU",
              text: "Deshace el camino para mostrar qué píxel encendió la neurona.",
              accent: "from-coral-500/20",
            },
          ].map((item) => (
            <article
              key={item.title}
              className={`card card-hover group overflow-hidden bg-gradient-to-br ${item.accent} to-transparent p-4`}
            >
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <code className="mt-2 block break-words rounded-lg bg-black/35 px-2.5 py-1.5 font-mono text-[11px] text-lime-200">
                {item.formula}
              </code>
              <p className="mt-2 text-[11px] leading-5 text-mist">{item.text}</p>
              <span className="mt-3 block h-px w-full origin-left scale-x-0 bg-gradient-to-r from-lime-400/70 to-transparent transition-transform duration-500 group-hover:scale-x-100" />
            </article>
          ))}
        </Reveal>
      </div>

      {/* ---------------- CTA ---------------- */}
      <Reveal className="mt-16">
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] p-8 sm:p-12">
          <div className="absolute inset-0 bg-gradient-to-br from-lime-500/[0.14] via-transparent to-mango-500/[0.12]" />
          <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-lime-500/20 blur-[90px] animate-pulse-glow" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.3fr_0.7fr]">
            <div>
              <p className="label-xs">siguiente paso</p>
              <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-3xl">
                Sube una fruta y mira <span className="text-gradient-warm">qué neuronas se encienden</span>.
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-bone/60">
                Inferencia en segundos, mapa de calor sobre tu foto y reconstrucción capa por capa.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/predict" className="btn-primary">Analizar mi fruta →</Link>
                <Link href="/train" className="btn-ghost">Ver el entrenamiento</Link>
              </div>
            </div>
            <div className="flex justify-center gap-3">
              {FRUITS.slice(0, 5).map((fruit, index) => (
                <span
                  key={fruit.key}
                  className="animate-float"
                  style={{ color: fruit.color, animationDelay: `${index * -0.9}s` }}
                >
                  <FruitIcon fruit={fruit.key} className="h-9 w-9 drop-shadow-[0_6px_18px_currentColor]" />
                </span>
              ))}
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
