"""ZFNet (Zeiler & Fergus, 2014) — implementación PyTorch fiel al modelo ImageNet.

Reproduce la arquitectura del modelo original de Caffe usado en ILSVRC2013
(convertido a ONNX por el ONNX Model Zoo como `zfnet512`), con dos diferencias
respecto del paper que conviene tener presentes:

1. La 4.ª capa convolucional tiene 512 mapas en lugar de 1024 (limitación de
   memoria del modelo publicado, no del paper).
2. La LRN usa size=5, alpha=5e-4, beta=0.75 y k=2.0, tal como quedó en el
   prototxt original; el paper describe size=3, alpha=1e-4.

La clase expone además los ganchos necesarios para el DeconvNet: activaciones
post-ReLU y switches de max-pooling (`indices`).
"""

from __future__ import annotations

from typing import Dict, List, Tuple

import torch
import torch.nn as nn
import torch.nn.functional as F

IMAGENET_MEAN_BGR = (104.0, 117.0, 124.0)
INPUT_SIZE = 224


def lrn(x: torch.Tensor, size: int = 5, alpha: float = 5e-4, beta: float = 0.75, k: float = 2.0) -> torch.Tensor:
    """Local Response Normalization con la misma semántica que ONNX/Caffe."""
    return F.local_response_norm(x, size=size, alpha=alpha, beta=beta, k=k)


class ZFNet(nn.Module):
    """ZFNet para entrada 224x224 RGB (se espera BGR con media restada, ver preprocess).

    Args:
        num_classes: tamaño de la capa de salida.
        dropout: probabilidad de dropout entre capas fully-connected (0.0 = inferencia fiel).
        dropout_fc7: si es distinto de None, usa esa probabilidad solo en fc7.
    """

    def __init__(self, num_classes: int = 1000, dropout: float = 0.0, dropout_fc7: float | None = None):
        super().__init__()
        self.num_classes = num_classes

        # --- bloque convolucional ---
        self.conv1 = nn.Conv2d(3, 96, kernel_size=7, stride=2, padding=0)
        self.conv2 = nn.Conv2d(96, 256, kernel_size=5, stride=2, padding=0)
        self.conv3 = nn.Conv2d(256, 512, kernel_size=3, stride=1, padding=1)
        self.conv4 = nn.Conv2d(512, 512, kernel_size=3, stride=1, padding=1)
        self.conv5 = nn.Conv2d(512, 512, kernel_size=3, stride=1, padding=1)

        self.lrn_params = dict(size=5, alpha=5e-4, beta=0.75, k=2.0)

        # --- clasificador ---
        self.fc6 = nn.Linear(512 * 6 * 6, 4096)
        self.fc7 = nn.Linear(4096, 1024)
        self.fc8 = nn.Linear(1024, num_classes)

        self.dropout = dropout
        self.dropout_fc7 = dropout if dropout_fc7 is None else dropout_fc7

    # ------------------------------------------------------------------ #
    # forward
    # ------------------------------------------------------------------ #
    def forward(self, x: torch.Tensor, return_activations: bool = False):
        """Devuelve logits, o un dict con la traza completa si `return_activations`.

        La traza incluye, por cada capa, la activación post-ReLU y (en las capas
        con pooling) los índices de máximo, que son los "switches" que el
        DeconvNet necesita para deshacer el pooling.
        """
        a: Dict[str, torch.Tensor] = {}
        sw: Dict[str, torch.Tensor] = {}

        h = self.conv1(x)
        h = F.relu(h)
        a["conv1"] = h
        h = lrn(h, **self.lrn_params)
        h, sw["pool1"] = F.max_pool2d(h, kernel_size=3, stride=2, return_indices=True)

        h = self.conv2(h)
        h = F.relu(h)
        a["conv2"] = h
        h = lrn(h, **self.lrn_params)
        h, sw["pool2"] = F.max_pool2d(h, kernel_size=3, stride=2, return_indices=True)

        h = F.relu(self.conv3(h))
        a["conv3"] = h
        h = F.relu(self.conv4(h))
        a["conv4"] = h
        h = F.relu(self.conv5(h))
        a["conv5"] = h

        h, sw["pool5"] = F.max_pool2d(h, kernel_size=2, stride=2, return_indices=True)
        a["pool5"] = h

        h = h.flatten(1)
        h = F.relu(self.fc6(h))
        a["fc6"] = h
        if self.training and self.dropout > 0:
            h = F.dropout(h, self.dropout)
        h = F.relu(self.fc7(h))
        a["fc7"] = h
        if self.training and self.dropout_fc7 > 0:
            h = F.dropout(h, self.dropout_fc7)
        logits = self.fc8(h)
        a["fc8"] = logits

        if return_activations:
            return logits, a, sw
        return logits

    # ------------------------------------------------------------------ #
    # utilidades
    # ------------------------------------------------------------------ #
    def reset_head(self, num_classes: int) -> None:
        """Reemplaza la salida por una cabeza nueva (fine-tuning agronómico)."""
        self.fc8 = nn.Linear(self.fc7.out_features, num_classes)
        self.num_classes = num_classes

    def trainable_parameters(self, mode: str = "full") -> List[nn.Parameter]:
        """`full` entrena todo; `head` congela el tronco convolucional + fc6/fc7."""
        if mode == "full":
            return [p for p in self.parameters() if p.requires_grad]
        if mode == "head":
            return list(self.fc8.parameters())
        if mode == "fc7_up":
            return list(self.fc7.parameters()) + list(self.fc8.parameters())
        raise ValueError(f"modo desconocido: {mode}")


# ---------------------------------------------------------------------- #
# carga de pesos desde el ONNX original
# ---------------------------------------------------------------------- #
ONNX_TO_MODULE: Dict[str, Tuple[str, str]] = {
    # nombre en el ONNX            (módulo,  atributo)
    "gpu_0/conv1_w_0": ("conv1", "weight"),
    "gpu_0/conv1_b_0": ("conv1", "bias"),
    "gpu_0/conv2_w_0": ("conv2", "weight"),
    "gpu_0/conv2_b_0": ("conv2", "bias"),
    "gpu_0/conv3_w_0": ("conv3", "weight"),
    "gpu_0/conv3_b_0": ("conv3", "bias"),
    "gpu_0/conv4_w_0": ("conv4", "weight"),
    "gpu_0/conv4_b_0": ("conv4", "bias"),
    "gpu_0/conv5_w_0": ("conv5", "weight"),
    "gpu_0/conv5_b_0": ("conv5", "bias"),
    "gpu_0/fc6_w_0": ("fc6", "weight"),
    "gpu_0/fc6_b_0": ("fc6", "bias"),
    "gpu_0/fc7_w_0": ("fc7", "weight"),
    "gpu_0/fc7_b_0": ("fc7", "bias"),
    "gpu_0/fc8_w_0": ("fc8", "weight"),
    "gpu_0/fc8_b_0": ("fc8", "bias"),
}


def state_dict_from_onnx(onnx_path: str, num_classes: int = 1000) -> Dict[str, torch.Tensor]:
    """Extrae los tensores del .onnx y los reordena al state_dict de `ZFNet`."""
    import onnx
    from onnx import numpy_helper

    model = onnx.load(onnx_path, load_external_data=True)
    blobs = {t.name: numpy_helper.to_array(t) for t in model.graph.initializer}

    state: Dict[str, torch.Tensor] = {}
    for onnx_name, (module, attr) in ONNX_TO_MODULE.items():
        if onnx_name not in blobs:
            raise KeyError(f"falta el tensor {onnx_name} en {onnx_path}")
        arr = blobs[onnx_name]
        if module == "fc8" and arr.shape[0] != num_classes:
            continue
        state[f"{module}.{attr}"] = torch.from_numpy(arr.copy()).float()
    return state


def build_zfnet(num_classes: int = 1000, checkpoint: str | None = None, dropout: float = 0.0) -> ZFNet:
    """Crea el modelo y, si se indica, carga un checkpoint (.pt) propio."""
    model = ZFNet(num_classes=num_classes, dropout=dropout)
    if checkpoint:
        payload = torch.load(checkpoint, map_location="cpu", weights_only=False)
        state = payload.get("state_dict", payload)
        # tolera cabezas con distinto número de clases
        state = {k: v for k, v in state.items() if not k.startswith("fc8.") or v.shape[0] == num_classes}
        missing, unexpected = model.load_state_dict(state, strict=False)
        if any(not m.startswith("fc8.") for m in missing):
            raise RuntimeError(f"checkpoint incompleto, faltan: {[m for m in missing if not m.startswith('fc8.')]}")
        if unexpected:
            raise RuntimeError(f"tensores inesperados en el checkpoint: {unexpected}")
    model.eval()
    return model
