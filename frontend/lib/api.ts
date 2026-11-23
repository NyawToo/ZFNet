import type { ConvMap, ExplainResponse, Health, LayerInfo, ModelInfo, Prediction } from "./types";

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

function imageForm(file: Blob, extra?: Record<string, string>): FormData {
  const form = new FormData();
  form.append("file", file, "imagen.jpg");
  for (const [key, value] of Object.entries(extra ?? {})) form.append(key, value);
  return form;
}

export const api = {
  health: () => request<Health>("/health"),
  model: () => request<ModelInfo>("/model"),
  layers: () => request<{ layers: LayerInfo[] }>("/layers").then((r) => r.layers),

  predict: (file: Blob, topK = 5) =>
    request<{ predictions: Prediction[]; model: string }>("/predict", {
      method: "POST",
      body: imageForm(file, { top_k: String(topK) }),
    }),

  explain: (file: Blob, opts: { layer: string; channel?: number | null; topK?: number }) =>
    request<ExplainResponse>("/explain", {
      method: "POST",
      body: imageForm(file, {
        layer: opts.layer,
        top_k: String(opts.topK ?? 9),
        ...(opts.channel != null ? { channel: String(opts.channel) } : {}),
      }),
    }),

  convolutions: (file: Blob) =>
    request<{ maps: ConvMap[] }>("/convolutions", {
      method: "POST",
      body: imageForm(file),
    }).then((r) => r.maps),
};

export { ApiError };
