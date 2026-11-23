export type Prediction = {
  index: number;
  label: string;
  probability: number;
};

export type LayerInfo = {
  name: string;
  ops: string[];
  steps: number;
};

export type LayerStats = {
  layer: string;
  shape: number[];
  channels: number;
  top_channel: number;
  top_value: number;
  dead_channels: number;
};

export type ActivationMap = {
  position: [number, number];
  activation: number;
  image: string;
};

export type TraceStep = {
  op: string;
  layer: string;
  shape: [number, number];
  max: number;
  abs_mean: number;
};

export type ExplainResponse = {
  predictions: Prediction[];
  layer: string;
  channel: number;
  layer_stats: LayerStats;
  maps: ActivationMap[];
  sheet: string;
  heatmap: string;
  trace: TraceStep[];
  elapsed_ms: number;
};

export type ModelInfo = {
  name: string;
  architecture: string;
  dataset: string;
  num_classes: number;
  params: number;
  input_size: number;
  top1: number | null;
  top5: number | null;
  notes: string;
  checkpoint: string;
};

export type Health = {
  status: string;
  model: string;
  classes: number;
  load_seconds: number;
};

/** Una clase del dataset, tal como la devuelve `/api/datasets`. */
export type DatasetClass = { count: number };

/** Inventario completo del dataset: frutas → clases → conteo. */
export type DatasetInventory = {
  name: string;
  fruits: Record<string, Record<string, DatasetClass>>;
  totals: { images: number; classes: number };
};

/** Elemento individual de una página del dataset. */
export type DatasetItem = {
  filename: string;
  relative_path: string;
  fruit?: string;
  label?: string;
};

/** Página de imágenes de una clase concreta. */
export type DatasetPage = {
  items: DatasetItem[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

/** Mapa de activación media de una capa convolucional. */
export type ConvMap = {
  name: string;
  shape: number[];
  channels: number;
  map: string;
  mean_activation: number;
  max_activation: number;
};
