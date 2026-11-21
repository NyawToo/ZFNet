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
