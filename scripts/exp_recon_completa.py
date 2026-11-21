"""Diagnóstico: reconstruye el mapa COMPLETO de cada capa.

Si el camino inverso está bien, la reconstrucción del mapa entero tiene que
parecerse a la imagen original (borrosa, pero reconocible).
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.deconvnet import DeconvExplainer  # noqa: E402
from app.core.preprocess import image_to_rgb01, load_image, preprocess  # noqa: E402
from app.core.render import grid, to_pil  # noqa: E402
from app.core.zfnet import IMAGENET_MEAN_BGR, build_zfnet  # noqa: E402

CKPT = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"


def with_mean(arr01: np.ndarray) -> np.ndarray:
    """Suma la media BGR de Caffe y recorta: así se ve el espacio de píxeles real."""
    mean = np.array(IMAGENET_MEAN_BGR, dtype=np.float32) / 255.0
    return np.clip(arr01 + mean, 0, 1)


def main() -> None:
    model = build_zfnet(checkpoint=str(CKPT))
    img = load_image(ROOT / "scripts" / "samples" / "dog.jpg")
    x = preprocess(img)
    base = image_to_rgb01(img, 224)
    expl = DeconvExplainer(model)
    acts, sw = expl._forward(x)

    filas = []
    for layer in ("conv1", "conv3", "conv5"):
        full = acts[layer] * (acts[layer] > 0).float()
        recon, _ = expl._run_chain(full, layer, acts, sw, trace=False)
        rgb = expl._to_rgb01(recon[0])  # normalizado min-max
        filas.append(rgb)
        filas.append(with_mean(rgb))
        r = np.corrcoef(rgb.mean(axis=2).ravel(), base.mean(axis=2).ravel())[0, 1]
        print(f"{layer}: correlación con la imagen = {r:+.3f}, rango crudo = [{recon.min():.2f}, {recon.max():.2f}]")

    to_pil(grid(filas + [base], cols=2)).save(ROOT / "docs" / "figuras" / "recon_full.png")
    print("-> docs/figuras/recon_full.png")


if __name__ == "__main__":
    main()
