"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Logo from "../brand/Logo";

const LINKS = [
  { href: "/", label: "Inicio", hint: "Arquitectura" },
  { href: "/explore", label: "Galería", hint: "Dataset" },
  { href: "/predict", label: "Predecir", hint: "Inferencia" },
  { href: "/train", label: "Entrenar", hint: "Fine-tuning" },
];

type Status = "loading" | "ok" | "off";

export default function NavBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    const onScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(height > 0 ? Math.min(1, window.scrollY / height) : 0);
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    let alive = true;
    fetch("/api/backend/health", { cache: "no-store" })
      .then((res) => (res.ok ? setStatus("ok") : setStatus("off")))
      .catch(() => alive && setStatus("off"));
    return () => {
      alive = false;
    };
  }, []);

  const statusLabel = status === "ok" ? "backend activo" : status === "off" ? "backend desconectado" : "conectando";
  const statusColor = status === "ok" ? "bg-lime-500" : status === "off" ? "bg-coral-500" : "bg-mango-500";

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled ? "border-b border-white/[0.07] bg-ink/80 backdrop-blur-xl" : "bg-transparent"
      }`}
    >
      <div
        className="absolute left-0 top-0 h-[2px] bg-gradient-to-r from-lime-400 via-mint-400 to-mango-400 transition-[width] duration-150"
        style={{ width: `${progress * 100}%` }}
        aria-hidden
      />
      <nav className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 sm:px-6">
        <Link href="/" className="mr-auto shrink-0" aria-label="ZFNet Agro, inicio">
          <Logo />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link group ${active ? "nav-link-active" : ""}`}
              >
                <span className="relative z-10">{link.label}</span>
                {!active && (
                  <span className="pointer-events-none absolute inset-x-2 -bottom-0.5 h-px scale-x-0 bg-gradient-to-r from-transparent via-lime-400/70 to-transparent transition-transform duration-300 group-hover:scale-x-100" />
                )}
              </Link>
            );
          })}
        </div>

        <span
          className="ml-2 hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] text-mist lg:flex"
          title={statusLabel}
        >
          <span className={`relative flex h-2 w-2`}>
            <span className={`absolute inset-0 rounded-full ${statusColor} ${status === "ok" ? "animate-ping" : ""} opacity-60`} />
            <span className={`relative h-2 w-2 rounded-full ${statusColor}`} />
          </span>
          {statusLabel}
        </span>

        <Link href="/predict" className="btn-primary hidden px-4 py-2 text-xs sm:inline-flex md:hidden lg:inline-flex">
          Probar modelo
        </Link>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ml-1 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-bone md:hidden"
          aria-label="Abrir menú"
          aria-expanded={open}
        >
          <span className="relative block h-3.5 w-4">
            <span
              className={`absolute left-0 h-[2px] w-4 rounded bg-current transition-all duration-300 ${
                open ? "top-1.5 rotate-45" : "top-0"
              }`}
            />
            <span
              className={`absolute left-0 top-1.5 h-[2px] w-4 rounded bg-current transition-all duration-300 ${
                open ? "opacity-0" : "opacity-100"
              }`}
            />
            <span
              className={`absolute left-0 h-[2px] w-4 rounded bg-current transition-all duration-300 ${
                open ? "top-1.5 -rotate-45" : "top-3"
              }`}
            />
          </span>
        </button>
      </nav>

      <div
        className={`overflow-hidden border-t border-white/[0.06] bg-ink/95 backdrop-blur-xl transition-all duration-300 md:hidden ${
          open ? "max-h-80 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="space-y-1 px-4 py-3">
          {LINKS.map((link, index) => {
            const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{ transitionDelay: `${index * 40}ms` }}
                className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm transition ${
                  active ? "bg-lime-500/15 text-lime-300" : "text-bone/75 hover:bg-white/5"
                }`}
              >
                <span>{link.label}</span>
                <span className="text-[10px] uppercase tracking-widest text-mist">{link.hint}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}
