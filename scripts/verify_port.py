"""Verifica que el port a PyTorch reproduce exactamente las salidas del ONNX original."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.preprocess import load_image, preprocess  # noqa: E402
from app.core.zfnet import build_zfnet  # noqa: E402

ONNX_PATH = ROOT / "models" / "onnx" / "zfnet512-12.onnx"
CKPT = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"
IMG = ROOT / "scripts" / "samples" / "dog.jpg"
LABELS = ROOT / "configs" / "labels" / "imagenet_classes.txt"


def main() -> None:
    labels = [l.strip() for l in LABELS.read_text(encoding="utf-8").splitlines() if l.strip()]
    x = preprocess(load_image(IMG))

    sess = ort.InferenceSession(str(ONNX_PATH), providers=["CPUExecutionProvider"])
    ort_out = sess.run(None, {sess.get_inputs()[0].name: x.numpy()})[0]

    model = build_zfnet(checkpoint=str(CKPT))
    with torch.no_grad():
        torch_logits = model(x)
    torch_probs = torch.softmax(torch_logits, dim=1).numpy()

    max_diff = float(np.max(np.abs(torch_probs - ort_out)))
    print(f"Diferencia máxima de probabilidad torch vs onnx: {max_diff:.3e}")

    for name, probs in (("ONNX", ort_out[0]), ("PyTorch", torch_probs[0])):
        top = np.argsort(-probs)[:5]
        print(f"\n{name} top-5:")
        for idx in top:
            print(f"  {labels[idx]:<35} {probs[idx]*100:6.2f}%")

    assert max_diff < 1e-4, "el port NO coincide con el modelo original"
    print("\nPort verificado.")


if __name__ == "__main__":
    main()
