"""Convierte los pesos del ONNX oficial de ZFNet-512 a un checkpoint PyTorch."""

from __future__ import annotations

import sys
from pathlib import Path

import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.zfnet import ZFNet, state_dict_from_onnx  # noqa: E402

ONNX_PATH = ROOT / "models" / "onnx" / "zfnet512-12.onnx"
OUT_PATH = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"


def main() -> None:
    state = state_dict_from_onnx(str(ONNX_PATH))
    model = ZFNet(num_classes=1000)
    model.load_state_dict(state, strict=True)

    total = sum(p.numel() for p in model.parameters())
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "meta": {
                "architecture": "ZFNet",
                "source": "onnxmodelzoo/zfnet512-12 (Caffe ZFNet-512 -> ONNX)",
                "input": "1x3x224x224 BGR, media restada (104,117,124), rango 0-255",
                "num_classes": 1000,
                "params": total,
                "imagenet_top1": 55.97,
                "imagenet_top5": 79.41,
                "notes": "conv4 y conv5 con 512 mapas (el paper propone 1024)",
            },
        },
        OUT_PATH,
    )
    size_mb = OUT_PATH.stat().st_size / 1e6
    print(f"OK -> {OUT_PATH}  ({size_mb:.1f} MB, {total:,} parámetros)")


if __name__ == "__main__":
    main()
