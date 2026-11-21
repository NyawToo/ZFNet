"""Preprocesamiento estilo Caffe, el que espera el ZFNet original.

El modelo se entrenó con imágenes BGR en rango 0-255 y media restada
(104, 117, 124). Escalar a [0, 1] o normalizar con std de ImageNet degrada
las predicciones de forma notable en este modelo.
"""

from __future__ import annotations

import io
from typing import Tuple

import numpy as np
import torch
from PIL import Image

from .zfnet import IMAGENET_MEAN_BGR, INPUT_SIZE

_RESAMPLE = Image.Resampling.BICUBIC


def load_image(source) -> Image.Image:
    """Acepta ruta, bytes o file-like y devuelve una imagen RGB."""
    if isinstance(source, Image.Image):
        return source.convert("RGB")
    if isinstance(source, (bytes, bytearray)):
        return Image.open(io.BytesIO(source)).convert("RGB")
    if hasattr(source, "read"):
        return Image.open(source).convert("RGB")
    return Image.open(source).convert("RGB")


def resize_and_crop(img: Image.Image, size: int = INPUT_SIZE) -> Image.Image:
    """Resize del lado corto a size*8/7 y recorte central (protocolo de evaluación Caffe)."""
    w, h = img.size
    scale = (size * 8) // 7  # 256 para 224
    if w <= h:
        new_w, new_h = scale, int(round(h * scale / w))
    else:
        new_h, new_w = scale, int(round(w * scale / h))
    img = img.resize((new_w, new_h), _RESAMPLE)
    left = (new_w - size) // 2
    top = (new_h - size) // 2
    return img.crop((left, top, left + size, top + size))


def to_caffe_tensor(img: Image.Image) -> torch.Tensor:
    """PIL RGB -> tensor [1, 3, H, W] en BGR con media restada."""
    arr = np.asarray(img, dtype=np.float32)  # HWC, RGB, 0-255
    arr = arr[:, :, ::-1]  # RGB -> BGR
    arr = arr - np.array(IMAGENET_MEAN_BGR, dtype=np.float32)
    tensor = torch.from_numpy(np.ascontiguousarray(arr.transpose(2, 0, 1)))
    return tensor.unsqueeze(0)


def preprocess(img: Image.Image, size: int = INPUT_SIZE, mode: str = "crop") -> torch.Tensor:
    """Pipeline completo. `mode="crop"` reproduce Caffe; `"squash"` deforma a cuadrado."""
    if mode == "squash":
        img = img.resize((size, size), _RESAMPLE)
    else:
        img = resize_and_crop(img, size)
    return to_caffe_tensor(img)


def image_to_rgb01(img: Image.Image, size: int = INPUT_SIZE) -> np.ndarray:
    """Versión float32 [0,1] para usar como fondo de los mapas de calor."""
    img = load_image(img)
    arr = np.asarray(img.resize((size, size), _RESAMPLE), dtype=np.float32) / 255.0
    return arr


def tensor_to_rgb01(tensor: torch.Tensor) -> np.ndarray:
    """Deshace el preprocesamiento Caffe para volver a una imagen visualizable."""
    arr = tensor.detach().cpu().numpy()
    if arr.ndim == 4:
        arr = arr[0]
    arr = arr.transpose(1, 2, 0)[:, :, ::-1]  # BGR -> RGB
    arr = arr + np.array(IMAGENET_MEAN_BGR, dtype=np.float32)
    return np.clip(arr / 255.0, 0.0, 1.0)


def fit_square(img: Image.Image, size: int = INPUT_SIZE) -> Tuple[Image.Image, Tuple[int, int, int, int]]:
    """Redimensiona conservando aspecto y devuelve la caja usada (para mapear visualizaciones)."""
    w, h = img.size
    side = max(w, h)
    canvas = Image.new("RGB", (side, side), (0, 0, 0))
    canvas.paste(img, ((side - w) // 2, (side - h) // 2))
    return canvas.resize((size, size), _RESAMPLE), ((side - w) // 2, (side - h) // 2, w, h)
