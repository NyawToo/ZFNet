"""Carga del modelo y de las etiquetas, y servicio de inferencia + explicación.

Un único `ModelService` vive durante toda la vida del proceso (el arranque de
FastAPI), así el checkpoint de 350 MB se lee una sola vez.

Resolución del checkpoint, en orden:

1. `ZFNET_CUSTOM_CHECKPOINT`, si está definida.
2. `models/weights/zfnet_frutos10_full.pt`, si existe.
3. `models/weights/zfnet512_imagenet.pt` (sólo sirve para probar el port: sus
   etiquetas son de ImageNet, no de frutas, y se rechaza explícitamente).

Las etiquetas se toman del propio checkpoint (`meta.labels`), que las guarda
`scripts/fine_tune_agro.py` en el momento del entrenamiento. Si el checkpoint
es viejo y no las trae, se usa `labels` del `dataset_manifest.json` del dataset.
Nunca se adivinan: un modelo sin etiquetas consistente no arranca.
"""

from __future__ import annotations

import json
import os
import time
import warnings
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
FRUIT_CHECKPOINT = ROOT / "models" / "weights" / "zfnet_frutos10_full.pt"
DEFAULT_DATASET = os.getenv("ZFNET_DATASET", "fruits_dataset_synthetic")


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
def _resolve_checkpoint() -> Tuple[Path, bool]:
    """Devuelve (ruta, es_custom). Ver el orden documentado en el módulo."""
    raw = os.getenv("ZFNET_CUSTOM_CHECKPOINT")
    if raw:
        return Path(raw).expanduser(), True
    if FRUIT_CHECKPOINT.is_file():
        return FRUIT_CHECKPOINT, False
    return DEFAULT_CHECKPOINT, False


def _labels_from_manifest(dataset: str) -> List[str]:
    """Etiquetas declaradas por el manifiesto del dataset, en el orden del entrenamiento."""
    manifest_path = ROOT / dataset / "dataset_manifest.json"
    if not manifest_path.is_file():
        return []
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    labels = data.get("labels")
    if not isinstance(labels, list) or not labels:
        return []
    return [str(label) for label in labels]


def _notes_from_meta(meta_raw: Dict[str, object]) -> str:
    """Resumen legible del entrenamiento que produjo el checkpoint."""
    parts: List[str] = []
    epoch = meta_raw.get("epoch")
    if isinstance(epoch, int):
        parts.append(f"época {epoch + 1}")
    for key, label in (("train_acc", "train"), ("valid_acc", "validación")):
        value = meta_raw.get(key)
        if isinstance(value, (int, float)):
            parts.append(f"{label} {float(value):.2%}")
    notes = meta_raw.get("notes")
    if isinstance(notes, str) and notes:
        parts.append(notes)
    return " · ".join(parts)


# ---------------------------------------------------------------------- #
@lru_cache(maxsize=1)
def get_service() -> ModelService:
    t0 = time.perf_counter()
    checkpoint, is_custom = _resolve_checkpoint()
    if not checkpoint.exists():
        raise FileNotFoundError(
            f"no se encontró el checkpoint {checkpoint}. "
            "Entrená uno con scripts/fine_tune_agro.py o apuntá "
            "ZFNET_CUSTOM_CHECKPOINT a otro archivo."
        )

    payload = torch.load(checkpoint, map_location="cpu", weights_only=False)
    meta_raw: Dict[str, object] = payload.get("meta", {}) if isinstance(payload, dict) else {}
    state: Dict[str, torch.Tensor] = payload.get("state_dict", payload) if isinstance(payload, dict) else {}

    dataset_name = os.getenv("ZFNET_DATASET", DEFAULT_DATASET)
    labels = [str(label) for label in meta_raw.get("labels", []) or []]
    labels_from_manifest = False
    if not labels:
        labels = _labels_from_manifest(dataset_name)
        labels_from_manifest = bool(labels)
    if not labels:
        raise RuntimeError(
            f"el checkpoint {checkpoint.name} no declara etiquetas y no hay manifiesto en "
            f"{ROOT / dataset_name}. Entrená con scripts/fine_tune_agro.py: el checkpoint "
            "guarda las etiquetas y la API nunca las adivina."
        )

    num_classes = len(labels)
    fc8_weight = state.get("fc8.weight")
    if fc8_weight is not None and int(fc8_weight.shape[0]) != num_classes:
        raise RuntimeError(
            f"el checkpoint {checkpoint.name} tiene {int(fc8_weight.shape[0])} clases en fc8 "
            f"pero las etiquetas declaran {num_classes}. Usá un checkpoint entrenado para "
            "este dataset (o reentrená con scripts/fine_tune_agro.py)."
        )

    model = build_zfnet(num_classes=num_classes, checkpoint=str(checkpoint))

    if labels_from_manifest:
        warnings.warn(
            f"el checkpoint {checkpoint.name} no guarda etiquetas; se usan las del "
            f"manifiesto de {dataset_name}. Reentrená para que el checkpoint las incluya.",
            stacklevel=2,
        )

    meta = ModelMeta(
        name=str(meta_raw.get("architecture", "ZFNet")),
        architecture="ZFNet (Zeiler & Fergus, ECCV 2014) - Fine-tuned frutas",
        dataset=str(meta_raw.get("dataset", dataset_name)),
        num_classes=num_classes,
        params=sum(p.numel() for p in model.parameters()),
        input_size=224,
        top1=meta_raw.get("top1"),
        top5=meta_raw.get("top5"),
        notes=_notes_from_meta(meta_raw),
    )
    return ModelService(
        model=model,
        explainer=DeconvExplainer(model),
        labels=labels,
        meta=meta,
        load_seconds=round(time.perf_counter() - t0, 2),
        extras={"checkpoint": str(checkpoint), "custom": is_custom},
    )