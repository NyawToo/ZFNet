"""Carga del modelo y de las etiquetas, y servicio de inferencia + explicación.

Un único `ModelService` vive durante toda la vida del proceso (el arranque de
FastAPI), así el checkpoint de 350 MB se lee una sola vez.

Soporta checkpoints personalizados mediante la variable de entorno
`ZFNET_CUSTOM_CHECKPOINT`. Si no está definida, se usa el checkpoint ImageNet
por defecto (`zfnet512_imagenet.pt`).
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Dict, List, Sequence, Tuple

import numpy as np
import torch
from PIL import Image

from .deconvnet import DECONV_CHAINS, DeconvExplainer, LAYERS
from .preprocess import image_to_rgb01, preprocess
from .render import grid, overlay_heatmap, to_data_uri, upsample
from .zfnet import ZFNet, build_zfnet

ROOT = Path(__file__).resolve().parents[3]

DEFAULT_CHECKPOINT = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"
DEFAULT_LABELS = ROOT / "configs" / "labels" / "imagenet_classes.txt"


def _env_path(name: str, default: Path) -> Path:
    raw = os.getenv(name)
    if raw:
        return Path(raw).expanduser()
    return default


# --- ETIQUETAS FIJAS PARA EL TASK DE 10 FRUTAS ---
FRUTAS_10_LABELS = [
    "banana_buena",
    "banana_dañada",
    "naranja_buena",
    "naranja_dañada",
    "manzana_buena",
    "manzana_dañada",
    "mango_buena",
    "mango_dañado",
    "papaya_buena",
    "papaya_dañada",
]


@dataclass
class ModelMeta:
    name: str
    architecture: str
    dataset: str
    num_classes: int
    params: int
    input_size: int
    top1: float | None = None
    top5: float | None = None
    notes: str = ""


@dataclass
class ModelService:
    model: ZFNet
    explainer: DeconvExplainer
    labels: List[str]
    meta: ModelMeta
    load_seconds: float = 0.0
    extras: Dict[str, object] = field(default_factory=dict)

    # ------------------------------------------------------------------ #
    def predict(self, img: Image.Image, top_k: int = 5) -> List[Dict[str, object]]:
        x = preprocess(img)
        with torch.no_grad():
            probs = torch.softmax(self.model(x), dim=1)[0].numpy()
        order = np.argsort(-probs)[:top_k]
        return [
            {
                "index": int(i),
                "label": self.labels[int(i)] if int(i) < len(self.labels) else f"clase_{i}",
                "probability": float(probs[i]),
            }
            for i in order
        ]

    # ------------------------------------------------------------------ #
    def explain(
        self,
        img: Image.Image,
        layer: str = "conv5",
        channel: int | None = None,
        top_k: int = 9,
    ) -> Dict[str, object]:
        t0 = time.perf_counter()
        x = preprocess(img)
        acts, switches = self.explainer._forward(x)

        stats = self.explainer._stats(acts, layer)
        ch = int(stats["top_channel"]) if channel is None else int(channel)
        if not 0 <= ch < int(stats["channels"]):
            raise ValueError(f"canal {ch} fuera de rango para {layer} (0..{stats['channels'] - 1})")

        recs = self.explainer.reconstruct(x, layer, ch, top_k=top_k, trace=True)
        heat = self.explainer.activation_heatmap(x, layer, ch)
        base = image_to_rgb01(img, 224)

        maps = [{"position": list(r.position), "activation": r.activation, "image": to_data_uri(r.image)} for r in recs]
        sheet = grid([r.image for r in recs], cols=min(3, len(recs)))
        overlay = overlay_heatmap(base, upsample(heat, 224), palette="viridis")

        return {
            "layer": layer,
            "channel": ch,
            "layer_stats": stats,
            "maps": maps,
            "sheet": to_data_uri(sheet),
            "heatmap": to_data_uri(overlay),
            "trace": recs[0].steps if recs else [],
            "elapsed_ms": round((time.perf_counter() - t0) * 1000, 1),
        }

    def layers(self) -> List[Dict[str, object]]:
        return [
            {
                "name": layer,
                "ops": [f"{op}:{name}" for op, name in DECONV_CHAINS[layer]],
                "steps": len(DECONV_CHAINS[layer]),
            }
            for layer in LAYERS
        ]


# ---------------------------------------------------------------------- #
def _load_labels(path: Path) -> List[str]:
    if path.suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            data = data.get("labels", data.get("classes"))
        return [str(x) for x in data]
    return [line.strip() for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


# ---------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def get_service() -> ModelService:
    t0 = time.perf_counter()
    # Soporte para checkpoint personalizado (fine-tuning)
    custom_ckpt = os.getenv("ZFNET_CUSTOM_CHECKPOINT")
    if custom_ckpt and Path(custom_ckpt).exists():
        checkpoint = Path(custom_ckpt)
        ckpt_for_meta = checkpoint
    else:
        checkpoint = DEFAULT_CHECKPOINT
        ckpt_for_meta = checkpoint

    if not checkpoint.exists():
        raise FileNotFoundError(
            f"no se encontró el checkpoint {checkpoint}. "
            "Corré scripts/convert_onnx_to_pt.py o apuntá ZFNET_CHECKPOINT a otro archivo."
        )

    payload = torch.load(checkpoint, map_location="cpu", weights_only=False)
    meta_raw: Dict[str, object] = payload.get("meta", {}) if isinstance(payload, dict) else {}

    # Siempre construimos con el número de clases correspondiente al checkpoint.
    # Si es el checkpoint de frutas de 10 clases, usamos 10; si es el original
    # ImageNet, reconstruimos la cabeza.
    model = build_zfnet(num_classes=10, checkpoint=str(checkpoint))

    meta = ModelMeta(
        name=meta_raw.get("architecture", "ZFNet"),
        architecture="ZFNet (Zeiler & Fergus, ECCV 2014) - Fine-tuned 10 frutas",
        dataset=str(os.getenv("ZFNET_DATASET", meta_raw.get("dataset", "10 frutas dañadas/buenas"))),
        num_classes=10,
        params=sum(p.numel() for p in model.parameters()),
        input_size=224,
        top1=meta_raw.get("top1"),
        top5=meta_raw.get("top5"),
        notes=str(meta_raw.get("notes", "")),
    )
    return ModelService(
        model=model,
        explainer=DeconvExplainer(model),
        labels=FRUTAS_10_LABELS,
        meta=meta,
        load_seconds=round(time.perf_counter() - t0, 2),
        extras={"checkpoint": str(checkpoint), "custom": bool(custom_ckpt)},
    )