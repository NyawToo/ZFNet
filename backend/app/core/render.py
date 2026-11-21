"""Composición de imágenes para el frontend: grillas, mapas de calor y PNG en bytes.

Se usa PIL + numpy y no matplotlib a propósito: el backend corre en contenedores
chicos y matplotlib suma decenas de MB sin aportar nada.
"""

from __future__ import annotations

import base64
import io
from typing import Iterable, Sequence

import numpy as np
from PIL import Image

_RESAMPLE = Image.Resampling.BICUBIC

# paleta "magma" simplificada: negro -> violeta -> naranja -> amarillo claro
_MAGMA = np.array(
    [
        [0.001, 0.000, 0.014],
        [0.113, 0.065, 0.277],
        [0.317, 0.071, 0.485],
        [0.549, 0.161, 0.506],
        [0.771, 0.267, 0.400],
        [0.929, 0.463, 0.228],
        [0.994, 0.718, 0.163],
        [0.988, 0.998, 0.645],
    ],
    dtype=np.float32,
)

# paleta "viridis" para el mapa de activación
_VIRIDIS = np.array(
    [
        [0.267, 0.005, 0.329],
        [0.283, 0.141, 0.458],
        [0.254, 0.265, 0.530],
        [0.207, 0.372, 0.553],
        [0.164, 0.471, 0.558],
        [0.128, 0.567, 0.551],
        [0.135, 0.659, 0.518],
        [0.267, 0.749, 0.441],
        [0.478, 0.821, 0.318],
        [0.741, 0.873, 0.150],
        [0.993, 0.906, 0.144],
    ],
    dtype=np.float32,
)


def apply_colormap(arr01: np.ndarray, palette: str = "magma") -> np.ndarray:
    """Convierte un mapa [0,1] en una imagen RGB con la paleta indicada."""
    lut = _MAGMA if palette == "magma" else _VIRIDIS
    x = np.clip(arr01.astype(np.float32), 0.0, 1.0) * (len(lut) - 1)
    lo = np.floor(x).astype(int)
    hi = np.minimum(lo + 1, len(lut) - 1)
    frac = (x - lo)[..., None]
    rgb = lut[lo] * (1 - frac) + lut[hi] * frac
    return rgb.astype(np.float32)


def upsample(arr01: np.ndarray, size: int) -> np.ndarray:
    img = Image.fromarray((np.clip(arr01, 0, 1) * 255).astype(np.uint8), mode="L")
    img = img.resize((size, size), _RESAMPLE)
    return np.asarray(img, dtype=np.float32) / 255.0


def overlay_heatmap(
    base01: np.ndarray, heat01: np.ndarray, alpha: float = 0.55, palette: str = "magma"
) -> np.ndarray:
    """Superpone un mapa de calor sobre la foto original."""
    rgb = apply_colormap(heat01, palette)
    out = (1 - alpha) * base01 + alpha * rgb
    return np.clip(out, 0.0, 1.0).astype(np.float32)


def grid(images: Sequence[np.ndarray], cols: int = 3, gap: int = 6, bg: float = 0.08) -> np.ndarray:
    """Arma una grilla cuadrada con todas las imágenes."""
    if not images:
        raise ValueError("no hay imágenes para componer")
    h, w = images[0].shape[:2]
    rows = (len(images) + cols - 1) // cols
    canvas = np.full((rows * h + (rows - 1) * gap, cols * w + (cols - 1) * gap, 3), bg, dtype=np.float32)
    for i, img in enumerate(images):
        if img.shape[:2] != (h, w):
            img = np.asarray(Image.fromarray((img * 255).astype(np.uint8)).resize((w, h), _RESAMPLE), np.float32) / 255.0
        r, c = divmod(i, cols)
        y, x = r * (h + gap), c * (w + gap)
        canvas[y : y + h, x : x + w] = img
    return canvas


def label_strip(images: Iterable[np.ndarray], labels: Sequence[str], strip_h: int = 18) -> np.ndarray:
    """Agrega una franja de texto simple debajo de cada imagen (sin fuentes externas)."""
    images = list(images)
    h, w = images[0].shape[:2]
    canvas = np.full((h + strip_h, w * len(images), 3), 0.08, dtype=np.float32)
    for i, img in enumerate(images):
        canvas[:h, i * w : (i + 1) * w] = img
    return canvas


def to_pil(arr01: np.ndarray) -> Image.Image:
    return Image.fromarray((np.clip(arr01, 0, 1) * 255).astype(np.uint8), mode="RGB")


def to_png_bytes(arr01: np.ndarray) -> bytes:
    buf = io.BytesIO()
    to_pil(arr01).save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def to_jpeg_bytes(arr01: np.ndarray, quality: int = 90) -> bytes:
    """Las reconstrucciones tienen mucho detalle fino: JPEG pesa 10x menos que PNG."""
    buf = io.BytesIO()
    to_pil(arr01).save(buf, format="JPEG", quality=quality, subsampling=0)
    return buf.getvalue()


def to_data_uri(arr01: np.ndarray, fmt: str = "jpeg", quality: int = 90) -> str:
    if fmt == "png":
        return "data:image/png;base64," + base64.b64encode(to_png_bytes(arr01)).decode("ascii")
    return "data:image/jpeg;base64," + base64.b64encode(to_jpeg_bytes(arr01, quality)).decode("ascii")
