"""Compara variantes de normalización y dirección del filtro en el DeconvNet."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.deconvnet import DeconvExplainer  # noqa: E402
from app.core.preprocess import image_to_rgb01, load_image, preprocess  # noqa: E402
from app.core.render import grid, to_pil  # noqa: E402
from app.core.zfnet import build_zfnet  # noqa: E402

CKPT = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"
OUT = ROOT / "docs" / "figuras" / "experimento_norm.png"


def normalize(arr: np.ndarray, p_lo: float, p_hi: float) -> np.ndarray:
    lo, hi = np.percentile(arr, p_lo), np.percentile(arr, p_hi)
    if hi - lo < 1e-9:
        return np.zeros_like(arr)
    return np.clip((arr - lo) / (hi - lo), 0, 1)


def to_rgb(t: torch.Tensor) -> np.ndarray:
    return t[0].detach().cpu().numpy().transpose(1, 2, 0)[:, :, ::-1]


def main() -> None:
    model = build_zfnet(checkpoint=str(CKPT))
    x = preprocess(load_image(ROOT / "scripts" / "samples" / "dog.jpg"))
    base = image_to_rgb01(ROOT / "scripts" / "samples" / "dog.jpg", 224)
    expl = DeconvExplainer(model)
    acts, sw = expl._forward(x)

    layer, ch = "conv5", int(expl.channel_stats(x, "conv5")["top_channel"])
    pos = [p for p, _ in expl.top_activations(acts[layer], ch, 4)]

    # variante explícita con filtro invertido 180 grados
    def run(flip: bool):
        imgs = []
        for (r, c) in pos:
            seed = torch.zeros_like(acts[layer])
            seed[0, ch, r, c] = acts[layer][0, ch, r, c]
            h = seed
            for op, name in [("rect", "conv5"), ("deconv", "conv5"), ("rect", "conv4"),
                             ("deconv", "conv4"), ("rect", "conv3"), ("deconv", "conv3"),
                             ("unpool", "pool2"), ("rect", "conv2"), ("deconv", "conv2"),
                             ("unpool", "pool1"), ("rect", "conv1"), ("deconv", "conv1")]:
                if op == "rect":
                    h = h * (acts[name] > 0).float()
                elif op == "unpool":
                    h = F.max_unpool2d(h, sw[name], kernel_size=3, stride=2, padding=0)
                else:
                    conv = getattr(model, name)
                    w = torch.flip(conv.weight, dims=(2, 3)) if flip else conv.weight
                    op_pad = 1 if name in ("conv1", "conv2") else 0
                    h = F.conv_transpose2d(h, w, stride=conv.stride, padding=conv.padding, output_padding=op_pad)
            imgs.append(to_rgb(h))
        return imgs

    rows = []
    for flip in (False, True):
        raws = run(flip)
        tag = "flip" if flip else "normal"
        for p_lo, p_hi in ((0, 100), (1, 99), (2, 98)):
            norm = [normalize(np.maximum(r, 0), p_lo, p_hi) for r in raws]
            rows.extend(norm)
            print(f"{tag} p{p_lo}-{p_hi}: min={min(r.min() for r in norm):.3f} max={max(r.max() for r in norm):.3f}")

    canvas = grid(rows + [base], cols=4)
    to_pil(canvas).save(OUT)
    print("->", OUT)


if __name__ == "__main__":
    main()
