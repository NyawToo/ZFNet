import type { ExplainResponse, Health, LayerInfo, ModelInfo, Prediction } from "./types";

/** Todas las llamadas van al proxy interno, así el navegador nunca ve la URL del backend. */
const BASE = "/api/backend";

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { cache: "no-store", ...init });
  if (!res.ok) {
    let detail = `error ${res.status}`;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      /* la respuesta no era JSON */
    }
    throw new ApiError(detail, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  health: () => request<Health>("/health"),
  model: () => request<ModelInfo>("/model"),
  layers: () => request<{ layers: LayerInfo[] }>("/layers").then((r) => r.layers),

  predict: (file: Blob, topK = 5) => {
    const form = new FormData();
    form.append("file", file, "imagen.jpg");
    form.append("top_k", String(topK));
    return request<{ predictions: Prediction[]; model: string }>("/predict", { method: "POST", body: form });
  },

  explain: (file: Blob, opts: { layer: string; channel?: number | null; topK?: number }) => {
    const form = new FormData();
    form.append("file", file, "imagen.jpg");
    form.append("layer", opts.layer);
    form.append("top_k", String(opts.topK ?? 9));
    if (opts.channel != null) form.append("channel", String(opts.channel));
    return request<ExplainResponse>("/explain", { method: "POST", body: form });
  },
};
