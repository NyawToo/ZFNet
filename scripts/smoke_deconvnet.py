"""Prueba de humo del DeconvNet: corre todas las capas, verifica formas y guarda una grilla."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.deconvnet import DECONV_CHAINS, DeconvExplainer  # noqa: E402
from app.core.preprocess import image_to_rgb01, load_image, preprocess  # noqa: E402
from app.core.render import grid, overlay_heatmap, to_pil, upsample  # noqa: E402
from app.core.zfnet import build_zfnet  # noqa: E402

CKPT = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"
IMG = ROOT / "scripts" / "samples" / "dog.jpg"
OUT = ROOT / "docs" / "figuras"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    model = build_zfnet(checkpoint=str(CKPT))
    img = load_image(IMG)
    x = preprocess(img)
    base = image_to_rgb01(img, 224)

    expl = DeconvExplainer(model)

    print("== formas por capa ==")
    for layer in DECONV_CHAINS:
        stats = expl.channel_stats(x, layer)
        print(f"  {layer}: canales={stats['channels']:>3} mapa={stats['shape'][1]}x{stats['shape'][2]}"
              f" canal_top={stats['top_channel']} muertos={stats['dead_channels']}")

    print("\n== reconstrucciones ==")
    t0 = time.perf_counter()
    for layer in DECONV_CHAINS:
        stats = expl.channel_stats(x, layer)
        ch = int(stats["top_channel"])
        recs = expl.reconstruct(x, layer, ch, top_k=9, trace=(layer == "conv5"))
        shapes = {r.image.shape for r in recs}
        assert shapes == {(224, 224, 3)}, f"{layer}: forma inesperada {shapes}"
        assert all(0.0 <= r.image.min() and r.image.max() <= 1.0 for r in recs)
        if layer == "conv5":
            print("  traza conv5:")
            for st in recs[0].steps:
                print(f"    {st['op']:<7} {st['layer']:<6} -> {st['shape']} max={st['max']:.2f}")
        canvas = grid([r.image for r in recs] + [base], cols=4)
        to_pil(canvas).save(OUT / f"deconv_{layer}.png")
        print(f"  {layer}: 9 mapas + original -> docs/figuras/deconv_{layer}.png ({recs[0].activation:.2f})")

    heat = expl.activation_heatmap(x, "conv5")
    to_pil(overlay_heatmap(base, upsample(heat, 224))).save(OUT / "heatmap_conv5.png")
    print(f"\nlisto en {time.perf_counter() - t0:.1f}s")


if __name__ == "__main__":
    main()
