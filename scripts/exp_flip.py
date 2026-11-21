"""¿Qué convención de filtro reconstruye mejor? Criterio objetivo, no estético."""

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
from app.core.zfnet import build_zfnet  # noqa: E402

CKPT = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"


def chain(model, seed, layer, acts, sw, flip):
    h = seed
    for op, name in DECONV_CHAINS[layer]:
        if op == "rect":
            h = h * (acts[name] > 0).float()
        elif op == "unpool":
            h = F.max_unpool2d(h, sw[name], kernel_size=3, stride=2, padding=0)
        else:
            conv = getattr(model, name)
            w = torch.flip(conv.weight, dims=(2, 3)) if flip else conv.weight
            h = F.conv_transpose2d(h, w, stride=conv.stride, padding=conv.padding,
                                   output_padding=_STRIDED_CONVS[name])
    return h


def blur(a, k=9):
    t = torch.from_numpy(a)[None, None].float()
    t = F.avg_pool2d(F.pad(t, (k // 2,) * 4, mode="reflect"), k, 1)
    return t[0, 0].numpy()


def main():
    model = build_zfnet(checkpoint=str(CKPT))
    img = load_image(ROOT / "scripts" / "samples" / "dog.jpg")
    x = preprocess(img)
    base = image_to_rgb01(img, 224).mean(axis=2)
    expl = DeconvExplainer(model)
    acts, sw = expl._forward(x)

    for layer in ("conv3", "conv4", "conv5"):
        for flip in (False, True):
            recon = chain(model, acts[layer], layer, acts, sw, flip)[0]
            rgb = recon.detach().cpu().numpy().transpose(1, 2, 0)[:, :, ::-1]
            lum = np.clip(rgb.mean(axis=2), 0, None)
            r_raw = np.corrcoef(lum.ravel(), base.ravel())[0, 1]
            r_blur = np.corrcoef(blur(lum).ravel(), blur(base).ravel())[0, 1]
            print(f"{layer:<6} flip={flip!s:<5} corr cruda={r_raw:+.3f}  corr suavizada={r_blur:+.3f}")


if __name__ == "__main__":
    main()
