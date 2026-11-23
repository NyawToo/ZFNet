import Link from "next/link";
import Logo from "../brand/Logo";

export default function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-white/[0.07]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-sm text-sm leading-6 text-mist">
            ZFNet fine-tuneado para clasificar cinco frutas en estado bueno o dañado, con
            reconstrucción DeconvNet para ver qué mira cada neurona.
          </p>
          <div className="flex flex-wrap gap-2">
            {["PyTorch", "FastAPI", "Next.js", "DeconvNet"].map((tech) => (
              <span key={tech} className="chip">
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="label-xs">Aplicación</p>
          <ul className="space-y-2 text-sm text-bone/70">
            <li><Link href="/" className="transition hover:text-lime-300">Arquitectura</Link></li>
            <li><Link href="/explore" className="transition hover:text-lime-300">Galería del dataset</Link></li>
            <li><Link href="/predict" className="transition hover:text-lime-300">Predecir una imagen</Link></li>
            <li><Link href="/train" className="transition hover:text-lime-300">Configurar entrenamiento</Link></li>
          </ul>
        </div>

        <div className="space-y-3">
          <p className="label-xs">API</p>
          <ul className="space-y-2 text-sm text-bone/70">
            <li>
              <a href="http://127.0.0.1:8000/docs" target="_blank" rel="noreferrer" className="transition hover:text-lime-300">
                Documentación interactiva ↗
              </a>
            </li>
            <li>
              <a href="http://127.0.0.1:8000/api/health" target="_blank" rel="noreferrer" className="transition hover:text-lime-300">
                Health check ↗
              </a>
            </li>
            <li>
              <a href="http://127.0.0.1:8000/api/model" target="_blank" rel="noreferrer" className="transition hover:text-lime-300">
                Ficha del modelo ↗
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/[0.06] px-4 py-5 text-center text-[11px] text-mist sm:px-6">
        Proyecto Final IA · ZFNet (Zeiler &amp; Fergus, ECCV 2014) · hecho para mirar la fruta con otros ojos
      </div>
    </footer>
  );
}
