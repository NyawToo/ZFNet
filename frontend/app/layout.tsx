import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZFNet · explicabilidad para diagnóstico vegetal",
  description:
    "Clasificación de imágenes con ZFNet (ILSVRC 2013) y proyección DeconvNet para ver qué píxeles activan cada neurona.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <nav className="sticky top-0 z-40 border-b border-black/5 bg-[#f6f7f5]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-3 py-2 sm:px-5 sm:py-3">
            <Link href="/" className="mr-auto shrink-0 font-semibold text-ink">ZFNet Agro</Link>
            <Link href="/explore" className="btn-ghost shrink-0 px-3 py-2">Galería</Link>
            <Link href="/predict" className="btn-ghost shrink-0 px-3 py-2">Predecir</Link>
            <Link href="/train" className="btn-primary shrink-0 px-3 py-2">Entrenar</Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
