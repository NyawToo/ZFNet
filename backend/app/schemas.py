"""Modelos de datos de la API (Pydantic v2)."""

from __future__ import annotations

from typing import List, Optional, Tuple

from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    model: str
    classes: int
    load_seconds: float


class ModelInfoResponse(BaseModel):
    name: str
    architecture: str
    dataset: str
    num_classes: int
    params: int
    input_size: int
    top1: Optional[float] = None
    top5: Optional[float] = None
    notes: str = ""
    checkpoint: str


class Prediction(BaseModel):
    index: int
    label: str
    probability: float = Field(ge=0, le=1)


class PredictionResponse(BaseModel):
    predictions: List[Prediction]
    model: str


class LayerInfo(BaseModel):
    name: str
    ops: List[str]
    steps: int


class LayersResponse(BaseModel):
    layers: List[LayerInfo]


class LayerStats(BaseModel):
    layer: str
    shape: List[int]
    channels: int
    top_channel: int
    top_value: float
    dead_channels: int


class ActivationMap(BaseModel):
    position: Tuple[int, int]
    activation: float
    image: str  # data URI JPEG


class TraceStep(BaseModel):
    op: str
    layer: str
    shape: Tuple[int, int]
    max: float
    abs_mean: float


class ExplainResponse(BaseModel):
    predictions: List[Prediction]
    layer: str
    channel: int
    layer_stats: LayerStats
    maps: List[ActivationMap]
    sheet: str
    heatmap: str
    trace: List[TraceStep]
    elapsed_ms: float


class CompareResponse(BaseModel):
    a: List[Prediction]
    b: List[Prediction]
    model: str
