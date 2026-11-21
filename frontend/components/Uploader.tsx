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
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handle(file);
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition ${
        dragging ? "border-leaf-500 bg-leaf-50" : "border-black/10 bg-white/60"
      }`}
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" className="text-leaf-600">
        <path
          d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="space-y-1">
        <p className="text-sm font-medium">Arrastrá una foto o elegí un archivo</p>
        <p className="text-xs text-ink/50">JPG, PNG o WebP. Se redimensiona a 1024 px antes de enviarse.</p>
      </div>

      <button type="button" className="btn-ghost" onClick={() => inputRef.current?.click()} disabled={busy}>
        Elegir archivo
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handle(file);
        }}
      />

      {info && (
        <p className="text-xs text-ink/50">
          {info.name} · {formatBytes(info.size)} enviados
        </p>
      )}
    </div>
  );
}
