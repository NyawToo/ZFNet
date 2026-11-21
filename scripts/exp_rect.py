"""Compara modos de rectificación y normalización para el DeconvNet de conv5."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.deconvnet import DECONV_CHAINS, DeconvExplainer, _STRIDED_CONVS  # noqa: E402
from app.core.preprocess import image_to_rgb01, load_image, preprocess  # noqa: E402
from app.core.render import grid, to_pil  # noqa: E402
from app.core.zfnet import IMAGENET_MEAN_BGR, build_zfnet  # noqa: E402

CKPT = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"
MEAN = np.array(IMAGENET_MEAN_BGR, np.float32) / 255.0


def chain(seed, layer, acts, sw, mode):
    h = seed
    for op, name in DECONV_CHAINS[layer]:
        if op == "rect":
            h = h * (acts[name] > 0).float() if mode == "mask" else torch.clamp(h, min=0)
        elif op == "unpool":
            h = F.max_unpool2d(h, sw[name], kernel_size=3, stride=2, padding=0)
        else:
            conv = getattr(conv_mod, name)
            h = F.conv_transpose2d(h, conv.weight, stride=conv.stride,
                                   padding=conv.padding, output_padding=_STRIDED_CONVS[name])
    return h[0].detach().cpu().numpy().transpose(1, 2, 0)[:, :, ::-1]


def norm_rgb(a, p):
    hi = np.percentile(a, p)
    lo = np.percentile(a, 100 - p) if p else a.min()
    return np.clip((a - max(lo, 0)) / (hi - max(lo, 0) + 1e-9), 0, 1)


def main():
    global conv_mod
    conv_mod = build_zfnet(checkpoint=str(CKPT))
    img = load_image(ROOT / "scripts" / "samples" / "dog.jpg")
    base = image_to_rgb01(img, 224)
    expl = DeconvExplainer(conv_mod)
    acts, sw = expl._forward(preprocess(img))

    rows = []
    for layer in ("conv4", "conv5"):
        ch = int(expl.channel_stats(preprocess(img), layer)["top_channel"])
        pos = [p for p, _ in expl.top_activations(acts[layer], ch, 4)]
        for mode in ("mask", "relu"):
            imgs = []
            for (r, c) in pos:
                seed = torch.zeros_like(acts[layer])
                seed[0, ch, r, c] = acts[layer][0, ch, r, c]
                a = chain(seed, layer, acts, sw, mode)
                for p, mid in ((0, "minmax"), (99, "p99")):
                    rgb = np.clip(norm_rgb(a, p) + MEAN, 0, 1) if mid == "p99" else np.clip(norm_rgb(a, 0), 0, 1)
                    imgs.append(rgb)
            rows.extend(imgs)
        rows.append(base)

    to_pil(grid(rows, cols=4)).save(ROOT / "docs" / "figuras" / "exp_rect.png")
    print("filas: conv4 mask/minmax, conv4 mask/p99+mean, conv4 relu/minmax, conv4 relu/p99+mean, ...")


if __name__ == "__main__":
    main()
