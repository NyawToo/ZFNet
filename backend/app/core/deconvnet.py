"""DeconvNet: proyección de activaciones al espacio de píxeles (Zeiler & Fergus, 2014).

El DeconvNet es la red que "deshace" el camino de una activación hasta la imagen.
Cada paso del camino inverso es una de tres operaciones:

* **unpool** — deshace el max-pooling colocando cada valor en la posición exacta
  que ganó en el forward (el *switch* que guarda `F.max_pool2d`).
* **rect** — multiplica por la máscara de la ReLU del forward. Solo pasan las
  señales que efectivamente activaron la neurona.
* **deconv** — convolución traspuesta con el filtro transpuesto espacialmente
  (rotado 180°), que es lo que el paper llama "the transpose of the filters".

Se ignoran las capas LRN, igual que en el paper: no aportan estructura espacial
y no tienen inversa definida.

Este módulo no usa autograd: ejecuta el camino inverso a mano, paso por paso,
para que la reconstrucción sea auditable y para poder mostrar cada etapa.

Sobre la orientación del filtro: el valor por defecto (`flip_filters=False`) usa el
adjunto exacto de la convolución stride-2, que es lo que hace un `Deconvolution` de
Caffe. Se verificó con la prueba de reactivación (`scripts/exp_fidelidad.py`): al
reinyectar la reconstrucción en la red, la neurona vuelve a activarse en la misma
posición (270% en conv1, 156% en conv2). Con el filtro rotado 180° la reactivación
da 0% y el pico aparece desplazado dos celdas, así que esa convención queda solo
como comparación.

Sobre la rectificación: `rect_mode="relu"` recorta la reconstrucción a valores no
negativos, que es la lectura literal del paper ("rectification ... passing only
positive values"). `rect_mode="mask"` multiplica por la máscara de la ReLU del
forward.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Sequence, Tuple

import numpy as np
import torch
import torch.nn.functional as F

from .zfnet import IMAGENET_MEAN_BGR, ZFNet

DEFAULT_FLIP_FILTERS = False  # adjunto exacto: verificado por reactivación de la neurona
DEFAULT_RECT_MODE = "relu"  # "relu" recorta a >=0; "mask" usa la máscara de la ReLU del forward
DISPLAY_PERCENTILE = 99.0
_MEAN01 = np.array(IMAGENET_MEAN_BGR, dtype=np.float32) / 255.0

# (operación, capa). El orden es el del camino inverso: de la activación a la imagen.
# `deconv_i` sale de la salida de la capa i y aterriza en su entrada;
# `unpool_j` deshace el pooling j. Las capas con stride 2 (conv1, conv2) necesitan
# output_padding=1 para recuperar el tamaño exacto (224 y 54).
DECONV_CHAINS: Dict[str, Sequence[Tuple[str, str]]] = {
    "conv1": (("rect", "conv1"), ("deconv", "conv1")),
    "conv2": (
        ("rect", "conv2"), ("deconv", "conv2"),
        ("unpool", "pool1"), ("rect", "conv1"), ("deconv", "conv1"),
    ),
    "conv3": (
        ("rect", "conv3"), ("deconv", "conv3"),
        ("unpool", "pool2"), ("rect", "conv2"), ("deconv", "conv2"),
        ("unpool", "pool1"), ("rect", "conv1"), ("deconv", "conv1"),
    ),
    "conv4": (
        ("rect", "conv4"), ("deconv", "conv4"),
        ("rect", "conv3"), ("deconv", "conv3"),
        ("unpool", "pool2"), ("rect", "conv2"), ("deconv", "conv2"),
        ("unpool", "pool1"), ("rect", "conv1"), ("deconv", "conv1"),
    ),
    "conv5": (
        ("rect", "conv5"), ("deconv", "conv5"),
        ("rect", "conv4"), ("deconv", "conv4"),
        ("rect", "conv3"), ("deconv", "conv3"),
        ("unpool", "pool2"), ("rect", "conv2"), ("deconv", "conv2"),
        ("unpool", "pool1"), ("rect", "conv1"), ("deconv", "conv1"),
    ),
}

LAYERS = tuple(DECONV_CHAINS)
_STRIDED_CONVS = {"conv1": 1, "conv2": 1, "conv3": 0, "conv4": 0, "conv5": 0}


@dataclass
class Reconstruction:
    """Una activación proyectada al espacio de píxeles."""

    layer: str
    channel: int
    position: Tuple[int, int]
    activation: float
    image: np.ndarray  # [H, W, 3] float32 en [0, 1], listo para mostrar
    luminance: np.ndarray  # [H, W] float32, versión en grises
    steps: List[Dict[str, object]] = field(default_factory=list)


def _deconv(t: torch.Tensor, conv, output_padding: int, flip_filters: bool) -> torch.Tensor:
    weight = torch.flip(conv.weight, dims=(2, 3)) if flip_filters else conv.weight
    return F.conv_transpose2d(
        t,
        weight,
        bias=None,
        stride=conv.stride,
        padding=conv.padding,
        output_padding=output_padding,
    )


class DeconvExplainer:
    """Genera reconstrucciones DeconvNet para un modelo ZFNet y una imagen."""

    def __init__(
        self,
        model: ZFNet,
        flip_filters: bool = DEFAULT_FLIP_FILTERS,
        rect_mode: str = DEFAULT_RECT_MODE,
    ):
        if rect_mode not in ("relu", "mask"):
            raise ValueError("rect_mode debe ser 'relu' o 'mask'")
        self.model = model
        self.model.eval()
        self.flip_filters = flip_filters
        self.rect_mode = rect_mode

    # ------------------------------------------------------------------ #
    @torch.no_grad()
    def _forward(self, x: torch.Tensor) -> Tuple[Dict[str, torch.Tensor], Dict[str, torch.Tensor]]:
        _, acts, switches = self.model(x, return_activations=True)
        return acts, switches

    def _run_chain(
        self,
        seed: torch.Tensor,
        layer: str,
        acts: Dict[str, torch.Tensor],
        switches: Dict[str, torch.Tensor],
        trace: bool = False,
    ) -> Tuple[torch.Tensor, List[Dict[str, object]]]:
        """Aplica el camino inverso completo a `seed` (1, C, H, W)."""
        h = seed
        steps: List[Dict[str, object]] = []

        for op, name in DECONV_CHAINS[layer]:
            if op == "rect":
                if self.rect_mode == "mask":
                    mask = (acts[name] > 0).float()
                    if mask.shape[1] != h.shape[1]:  # por si el seed trae menos canales
                        mask = mask[:, : h.shape[1]]
                    h = h * mask
                else:
                    h = torch.clamp(h, min=0)
            elif op == "unpool":
                h = F.max_unpool2d(
                    h, switches[name][:, : h.shape[1]], kernel_size=3, stride=2, padding=0
                )
            elif op == "deconv":
                conv = getattr(self.model, name)
                h = _deconv(h, conv, _STRIDED_CONVS[name], self.flip_filters)
            else:  # pragma: no cover
                raise ValueError(f"operación desconocida: {op}")

            if trace:
                steps.append(
                    {
                        "op": op,
                        "layer": name,
                        "shape": tuple(int(v) for v in h.shape[2:]),
                        "max": round(float(h.max()), 4),
                        "abs_mean": round(float(h.abs().mean()), 4),
                    }
                )
        return h, steps

    # ------------------------------------------------------------------ #
    def top_activations(
        self, activations: torch.Tensor, channel: int, top_k: int = 9
    ) -> List[Tuple[Tuple[int, int], float]]:
        """Posiciones (fila, columna) con mayor activación dentro de un canal."""
        fmap = activations[0, channel]
        values, indices = torch.topk(fmap.flatten(), k=min(top_k, fmap.numel()))
        w = fmap.shape[1]
        return [((int(i) // w, int(i) % w), float(v)) for i, v in zip(indices, values)]

    @torch.no_grad()
    def reconstruct(
        self,
        x: torch.Tensor,
        layer: str,
        channel: int,
        positions: Sequence[Tuple[int, int]] | None = None,
        top_k: int = 9,
        trace: bool = False,
    ) -> List[Reconstruction]:
        """Reconstruye una activación por cada posición pedida (por defecto, el top-k)."""
        if layer not in DECONV_CHAINS:
            raise ValueError(f"capa no soportada: {layer}. Opciones: {LAYERS}")

        acts, switches = self._forward(x)
        amap = acts[layer]
        if not 0 <= channel < amap.shape[1]:
            raise ValueError(f"canal {channel} fuera de rango (0..{amap.shape[1] - 1}) para {layer}")

        if positions is None:
            positions = [p for p, _ in self.top_activations(amap, channel, top_k)]

        results: List[Reconstruction] = []
        for r, c in positions:
            value = float(amap[0, channel, r, c])
            seed = torch.zeros_like(amap)
            seed[0, channel, r, c] = value
            recon, steps = self._run_chain(seed, layer, acts, switches, trace)
            img, lum = self._to_rgb01(recon[0])
            results.append(
                Reconstruction(
                    layer=layer,
                    channel=channel,
                    position=(int(r), int(c)),
                    activation=value,
                    image=img,
                    luminance=lum,
                    steps=steps,
                )
            )
        return results

    # ------------------------------------------------------------------ #
    @staticmethod
    def _to_rgb01(t: torch.Tensor) -> Tuple[np.ndarray, np.ndarray]:
        """Pasa la reconstrucción a imagen visible.

        La reconstrucción vive en el espacio de píxeles con la media restada, así
        que se escala por un percentil (robusto a picos) y se vuelve a sumar la
        media BGR de Caffe. Sin eso, el fondo queda gris y el ruido de alta
        frecuencia se amplifica hasta tapar la estructura.
        """
        arr = t.detach().cpu().numpy().transpose(1, 2, 0)[:, :, ::-1]  # BGR -> RGB
        scale = float(np.percentile(np.abs(arr), DISPLAY_PERCENTILE))
        if scale < 1e-9:
            scale = float(np.abs(arr).max()) or 1.0
        arr = np.clip(arr / scale, -1.0, 1.0)
        rgb = np.clip(arr + _MEAN01, 0.0, 1.0).astype(np.float32)
        return rgb, rgb.mean(axis=2).astype(np.float32)

    @torch.no_grad()
    def activation_heatmap(
        self, x: torch.Tensor, layer: str = "conv5", channel: int | None = None
    ) -> np.ndarray:
        """Mapa 2D normalizado a [0,1]: la activación del canal pedido.

        Si `channel` es None, toma el máximo absoluto entre canales, que sirve
        como vista general de "dónde hay energía" en la capa.
        """
        acts, _ = self._forward(x)
        fmap = acts[layer][0]
        arr = fmap[channel].detach().cpu().numpy() if channel is not None else fmap.abs().max(dim=0).values.detach().cpu().numpy()
        lo, hi = float(arr.min()), float(arr.max())
        return ((arr - lo) / (hi - lo + 1e-9)).astype(np.float32)

    @staticmethod
    def _stats(acts: Dict[str, torch.Tensor], layer: str) -> Dict[str, object]:
        fmap = acts[layer][0]
        per_channel = fmap.amax(dim=(1, 2))
        best = int(per_channel.argmax())
        return {
            "layer": layer,
            "shape": [int(fmap.shape[0]), int(fmap.shape[1]), int(fmap.shape[2])],
            "channels": int(fmap.shape[0]),
            "top_channel": best,
            "top_value": float(per_channel[best]),
            "dead_channels": int((per_channel <= 1e-6).sum()),
        }

    @torch.no_grad()
    def channel_stats(self, x: torch.Tensor, layer: str) -> Dict[str, object]:
        """Resumen de la capa: forma, canal más activo y cuántos canales están muertos."""
        acts, _ = self._forward(x)
        return self._stats(acts, layer)

    @torch.no_grad()
    def layer_overview(self, x: torch.Tensor) -> List[Dict[str, object]]:
        acts, _ = self._forward(x)
        return [self._stats(acts, layer) for layer in LAYERS if layer in acts]
