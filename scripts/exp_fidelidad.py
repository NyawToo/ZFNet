"""Prueba de fidelidad: ¿la reconstrucción reactiva la misma neurona al volver a entrar?

Se proyecta una activación al espacio de píxeles y se vuelve a pasar por la red.
Si el DeconvNet es fiel, en la capa y posición original debe reaparecer la señal.
Se comparan las dos convenciones de filtro (adjunto vs. filtro rotado 180°).
"""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import torch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core.deconvnet import DeconvExplainer  # noqa: E402
from app.core.preprocess import load_image, preprocess  # noqa: E402
from app.core.zfnet import build_zfnet  # noqa: E402

CKPT = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"


def main():
    model = build_zfnet(checkpoint=str(CKPT))
    x = preprocess(load_image(ROOT / "scripts" / "samples" / "dog.jpg"))
    base = DeconvExplainer(model)
    acts, sw = base._forward(x)

    for flip in (True, False):
        expl = DeconvExplainer(model, flip_filters=flip)
        print(f"\nflip_filters={flip}")
        for layer in ("conv1", "conv2", "conv3", "conv4", "conv5"):
            ch = int(base.channel_stats(x, layer)["top_channel"])
            (r, c), val = base.top_activations(acts[layer], ch, 1)[0]
            seed = torch.zeros_like(acts[layer])
            seed[0, ch, r, c] = val
            recon, _ = expl._run_chain(seed, layer, acts, sw)

            with torch.no_grad():
                acts2 = model(recon, return_activations=True)[1]
            original = acts[layer][0, ch]
            repeat = acts2[layer][0, ch]
            ratio = float(repeat[r, c] / original[r, c]) if original[r, c] else 0.0
            peak = int(repeat.argmax())
            py, px = divmod(peak, repeat.shape[1])
            print(
                f"  {layer:<6} canal={ch:<4} pos=({r:>2},{c:>2}) "
                f"reactivación={ratio:7.2%}  pico=({py},{px})"
            )


if __name__ == "__main__":
    main()
