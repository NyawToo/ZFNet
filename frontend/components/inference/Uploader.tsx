"use client";

import { useCallback, useRef, useState } from "react";
import { formatBytes, prepareImage } from "@/lib/image";

type Props = {
  onReady: (blob: Blob, previewUrl: string, name: string) => void;
  busy: boolean;
};

export default function Uploader({ onReady, busy }: Props) {
  const [dragging, setDragging] = useState(false);
  const [info, setInfo] = useState<{ name: string; size: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        setInfo(null);
        return;
      }
      const blob = await prepareImage(file);
      const url = URL.createObjectURL(blob);
      setInfo({ name: file.name, size: blob.size });
      onReady(blob, url, file.name);
    },
    [onReady],
  );

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void handle(file);
      }}
      className={`group relative overflow-hidden rounded-[28px] p-[1.5px] transition-all duration-500 ${
        dragging
          ? "bg-gradient-to-br from-lime-300 via-mint-400 to-mango-400 shadow-glow"
          : "bg-gradient-to-br from-white/15 via-white/5 to-white/10"
      }`}
    >
      <div className="relative overflow-hidden rounded-[26px] bg-ink/90 px-5 py-8 text-center sm:px-7 sm:py-10">
        <div className="pointer-events-none absolute inset-0 bg-radial-lime opacity-60" />
        <div
          className={`pointer-events-none absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-lime-400/25 to-transparent ${
            busy ? "animate-scan" : "hidden"
          }`}
        />

        <div className="relative mx-auto mb-5 flex h-24 w-24 items-center justify-center">
          <span className="absolute inset-0 rounded-full border border-lime-400/30 animate-ring" />
          <span className="absolute inset-2 rounded-full border border-dashed border-mint-400/40 animate-spin-slower" />
          <span className="absolute inset-4 rounded-full bg-lime-500/10 blur-md" />
          <svg viewBox="0 0 24 24" className="relative h-9 w-9 text-lime-300" fill="none">
            <path
              d="M12 16V5m0 0L7.8 9.2M12 5l4.2 4.2M4.5 15.5v2.6A2 2 0 0 0 6.5 20h11a2 2 0 0 0 2-1.9v-2.6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <p className="relative text-sm font-semibold text-bone sm:text-base">
          {busy ? "Analizando la imagen…" : dragging ? "Suelta la fruta aquí" : "Arrastra una foto o elige un archivo"}
        </p>
        <p className="relative mx-auto mt-1 max-w-xs text-xs leading-5 text-mist">
          JPG, PNG, WebP o BMP · se redimensiona a 1024 px en tu navegador antes de enviarse.
        </p>

        <div className="relative mt-5 flex flex-wrap items-center justify-center gap-2">
          <button type="button" className="btn-primary px-4 py-2 text-xs" onClick={() => inputRef.current?.click()} disabled={busy}>
            Elegir archivo
          </button>
          {info && (
            <span className="chip max-w-[240px] truncate" title={info.name}>
              <span className="h-1.5 w-1.5 rounded-full bg-mint-400" />
              {info.name} · {formatBytes(info.size)}
            </span>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handle(file);
          }}
        />
      </div>
    </div>
  );
}
