#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Fine-tuning de ZFNet para clasificación agronómica.

El script vive en `scripts/`, pero importa `backend.app.core.zfnet`. Por eso la
raíz del proyecto se agrega a `sys.path` derivándola de la ubicación de este
archivo: el repo funciona clonado en cualquier carpeta, sin rutas absolutas.
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.core.zfnet import ZFNet, build_zfnet  # noqa: E402

import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.optim import lr_scheduler
from torch.utils.data import DataLoader
from PIL import Image

# Checkpoint ImageNet que aporta el tronco pre-entrenado.
_CKPT_DEFAULT = str(ROOT / "models" / "weights" / "zfnet512_imagenet.pt")
_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


# ------------------------------------------------------------------ #
# Dataset jerárquico: fruta/estado/clase
# ------------------------------------------------------------------ #
class FruitStateDataset(torch.utils.data.Dataset):
    def __init__(self, root: str, transform=None):
        root_path = Path(root)
        class_dirs = sorted(
            directory for directory in root_path.rglob("*")
            if directory.is_dir()
            and any(file.suffix.lower() in _IMAGE_EXTENSIONS
                    for file in directory.iterdir() if file.is_file())
        )
        self.classes = [directory.name for directory in class_dirs]
        class_to_index = {name: index for index, name in enumerate(self.classes)}
        self.samples = []
        self.targets = []
        for directory in class_dirs:
            class_index = class_to_index[directory.name]
            for image_path in sorted(directory.iterdir(), key=lambda path: path.name):
                if image_path.is_file() and image_path.suffix.lower() in _IMAGE_EXTENSIONS:
                    self.samples.append((str(image_path), class_index))
                    self.targets.append(class_index)
        self.transform = transform

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, index):
        path, target = self.samples[index]
        image = Image.open(path).convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, target


# ------------------------------------------------------------------ #
# Transformaciones
# ------------------------------------------------------------------ #
class CaffeTransform:
    def __init__(self, input_size: int = 224, is_training: bool = True):
        self.input_size = input_size
        self.is_training = is_training

    def __call__(self, image: Image.Image) -> torch.Tensor:
        if self.is_training:
            width, height = image.size
            scale = int(self.input_size * 8 / 7)
            if width <= height:
                new_width, new_height = scale, int(round(height * scale / width))
            else:
                new_height, new_width = scale, int(round(width * scale / height))
            image = image.resize((new_width, new_height), Image.Resampling.BICUBIC)
            left = np.random.randint(0, max(1, new_width - self.input_size + 1))
            top = np.random.randint(0, max(1, new_height - self.input_size + 1))
            image = image.crop((left, top, left + self.input_size, top + self.input_size))
            if np.random.rand() < 0.5:
                image = image.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        else:
            width, height = image.size
            scale = int(self.input_size * 8 / 7)
            if width <= height:
                new_width, new_height = scale, int(round(height * scale / width))
            else:
                new_height, new_width = scale, int(round(width * scale / height))
            image = image.resize((new_width, new_height), Image.Resampling.BICUBIC)
            left = (new_width - self.input_size) // 2
            top = (new_height - self.input_size) // 2
            image = image.crop((left, top, left + self.input_size, top + self.input_size))

        rgb = np.asarray(image, dtype=np.float32)
        bgr = rgb[:, :, ::-1] - np.array((104.0, 117.0, 124.0), dtype=np.float32)
        return torch.from_numpy(np.ascontiguousarray(bgr.transpose(2, 0, 1)))


def get_transforms(input_size: int = 224, is_training: bool = True):
    return CaffeTransform(input_size=input_size, is_training=is_training)


# ------------------------------------------------------------------ #
# Helper: crear DataLoaders
# ------------------------------------------------------------------ #
class TransformSubset(torch.utils.data.Dataset):
    """Vista de `dataset` con su propio `transform`.

    `torch.utils.data.Subset` comparte el dataset subyacente, así que hacer
    `subset.dataset.transform = ...` cambia el transform de *todas* las
    particiones. Esa mutación hacía que el entrenamiento usara el transform de
    validación (sin random crop ni flip). Esta clase aísla cada partición.
    """

    def __init__(self, dataset: FruitStateDataset, indices, transform):
        self.samples = [dataset.samples[index] for index in indices]
        self.transform = transform

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, index):
        path, target = self.samples[index]
        image = Image.open(path).convert("RGB")
        if self.transform:
            image = self.transform(image)
        return image, target


def make_dataloaders(
    data_dir: str,
    batch_size: int = 32,
    num_classes: int | None = None,
    train_percent: float = 70.0,
    valid_percent: float = 15.0,
    test_percent: float = 15.0,
    seed: int = 42,
):
    percentages = (train_percent, valid_percent, test_percent)
    if any(value < 0 for value in percentages) or abs(sum(percentages) - 100.0) > 0.01:
        raise ValueError("Los porcentajes de train, validación y prueba deben sumar 100")

    full_dataset = FruitStateDataset(data_dir, transform=get_transforms(is_training=False))

    if num_classes is not None and len(full_dataset.classes) != num_classes:
        raise ValueError(
            f"El dataset tiene {len(full_dataset.classes)} clases pero se esperaban {num_classes}"
        )

    manifest_path = Path(data_dir) / "dataset_manifest.json"
    train_indices, valid_indices, test_indices = [], [], []
    split_source = "aleatoria"

    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest_split = manifest.get("percentages", {})
        manifest_seed = manifest.get("seed")
        expected_split = {
            "train": float(train_percent),
            "valid": float(valid_percent),
            "test": float(test_percent),
        }
        if manifest_seed == seed and all(abs(float(manifest_split.get(key, -1)) - value) <= 0.01 for key, value in expected_split.items()):
            split_by_path = {
                (ROOT / record["relative_path"]).resolve(): record["split"]
                for record in manifest.get("images", [])
            }
            for index, (image_path, _target) in enumerate(full_dataset.samples):
                relative = Path(image_path).resolve()
                split = split_by_path.get(relative)
                if split == "train":
                    train_indices.append(index)
                elif split == "valid":
                    valid_indices.append(index)
                elif split == "test":
                    test_indices.append(index)
            if train_indices:
                split_source = "manifiesto"

    if not train_indices:
        rng = np.random.default_rng(seed)
        train_indices, valid_indices, test_indices = [], [], []

        for class_index in range(len(full_dataset.classes)):
            class_indices = [index for index, target in enumerate(full_dataset.targets) if target == class_index]
            rng.shuffle(class_indices)
            count = len(class_indices)
            train_count = int(count * train_percent / 100.0)
            valid_count = int(count * valid_percent / 100.0)

            train_indices.extend(class_indices[:train_count])
            valid_indices.extend(class_indices[train_count:train_count + valid_count])
            test_indices.extend(class_indices[train_count + valid_count:])

    if not train_indices:
        raise ValueError("El porcentaje de entrenamiento produjo una partición vacía")

    train_subset = TransformSubset(full_dataset, train_indices, get_transforms(is_training=True))
    valid_subset = TransformSubset(full_dataset, valid_indices, get_transforms(is_training=False))

    class_counts = np.bincount([full_dataset.targets[index] for index in train_indices], minlength=len(full_dataset.classes))
    class_weights = np.where(class_counts > 0, 1.0 / class_counts, 0.0)
    sample_weights = [class_weights[target] for target in [full_dataset.targets[index] for index in train_indices]]
    sampler = torch.utils.data.WeightedRandomSampler(sample_weights, num_samples=len(sample_weights), replacement=True)

    train_loader = DataLoader(train_subset, batch_size=batch_size, sampler=sampler, num_workers=0, pin_memory=torch.cuda.is_available())
    valid_loader = DataLoader(valid_subset, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=torch.cuda.is_available())

    test_loader = None
    if test_indices:
        test_subset = TransformSubset(full_dataset, test_indices, get_transforms(is_training=False))
        test_loader = DataLoader(test_subset, batch_size=batch_size, shuffle=False, num_workers=0, pin_memory=torch.cuda.is_available())

    print(
        f"Particiones ({split_source}): train={len(train_indices)}, validación={len(valid_indices)}, "
        f"prueba={len(test_indices)} | semilla={seed}",
        flush=True,
    )
    return train_loader, valid_loader, list(full_dataset.classes), test_loader


# ------------------------------------------------------------------ #
# Entrenamiento
# ------------------------------------------------------------------ #
def train_epoch(model, loader, optimizer, criterion, device):
    model.train()
    running_loss = 0.0
    running_corrects = 0

    for inputs, labels in loader:
        inputs = inputs.to(device)
        labels = labels.to(device)

        optimizer.zero_grad()
        with torch.set_grad_enabled(True):
            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

        running_loss += loss.item() * inputs.size(0)
        running_corrects += torch.sum(preds == labels.data).item()

    epoch_loss = running_loss / len(loader.dataset)
    epoch_acc = running_corrects / len(loader.dataset)
    return epoch_loss, epoch_acc


def validate_epoch(model, loader, device, criterion):
    model.eval()
    running_loss = 0.0
    running_corrects = 0

    with torch.no_grad():
        for inputs, labels in loader:
            inputs = inputs.to(device)
            labels = labels.to(device)
            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            loss = criterion(outputs, labels)

            running_loss += loss.item() * inputs.size(0)
            running_corrects += torch.sum(preds == labels.data).item()

        epoch_loss = running_loss / len(loader.dataset)
        epoch_acc = running_corrects / len(loader.dataset)
    return epoch_loss, epoch_acc


# ------------------------------------------------------------------ #
# main
# ------------------------------------------------------------------ #
def main(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Usando dispositivo: {device}", flush=True)

    # 1) Cargar modelo
    model = build_zfnet(num_classes=args.classes, checkpoint=None)
    print(f"Modelo creado con {args.classes} clases", flush=True)

    # 2) Cargar pesos ImageNet (todo menos fc8)
    ckpt_path = args.checkpoint or _CKPT_DEFAULT
    if not Path(ckpt_path).exists():
        raise FileNotFoundError(f"Checkpoint no encontrado: {ckpt_path}")

    payload = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    state = payload.get("state_dict", {})
    # Quitamos fc8 para poder cargar el resto
    state = {k: v for k, v in state.items() if not k.startswith("fc8.")}
    missing, unexpected = model.load_state_dict(state, strict=False)
    if any(not m.startswith("fc8.") for m in missing):
        print(f"⚠ Faltan pesos del tronco (puede ser OK): {[m for m in missing if not m.startswith('fc8.')]}", flush=True)

    # 3) Modo head-only: congelar todo menos fc8
    if args.mode == "head-only":
        for name, param in model.named_parameters():
            if not name.startswith("fc8."):
                param.requires_grad = False
        print("Modo: head-only (solo fc8 entrenable)", flush=True)

    # 4) Modo full: todo entrenable
    elif args.mode == "full":
        for name, param in model.named_parameters():
            param.requires_grad = True
        print("Modo: full (todo entrenable)", flush=True)

    model = model.to(device)

    # 5) DataLoaders
    train_loader, valid_loader, valid_classes, test_loader = make_dataloaders(
        args.data_dir,
        batch_size=args.batch_size,
        num_classes=args.classes,
        train_percent=args.train_percent,
        valid_percent=args.valid_percent,
        test_percent=args.test_percent,
        seed=args.seed,
    )
    print(f"Clases detectadas: {valid_classes}", flush=True)
    actual_classes = len(valid_classes)

    # Ajustar fc8 si la cantidad de clases cambió
    if actual_classes != args.classes:
        print(f"Ajustando cabeza: {args.classes} -> {actual_classes} clases", flush=True)
        in_f = model.fc8.in_features
        model.fc8 = nn.Linear(in_f, actual_classes)
        model = model.to(device)

    # 6) Optimizador + scheduler
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)

    if args.mode == "head-only":
        params_to_opt = [p for p in model.parameters() if p.requires_grad]
        print(f"Parámetros entrenables: {sum(p.numel() for p in params_to_opt):,}", flush=True)
        optimizer = optim.AdamW(params_to_opt, lr=args.lr, weight_decay=1e-4)
    else:
        optimizer = optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)

    # El README y la UI de /train exponen `--step-size` y `--gamma`, así que el
    # scheduler es StepLR: baja el LR cada `step_size` épocas por un factor
    # `gamma`. Antes se aceptaban ambos flags y se ignoraban (CosineAnnealing).
    lr_scheduler_step = lr_scheduler.StepLR(optimizer, step_size=args.step_size, gamma=args.gamma)

    # 7) Loop
    best_acc = 0.0
    stale_epochs = 0
    since = time.time()

    for epoch in range(args.epochs):
        print(f"\nÉpoca {epoch + 1}/{args.epochs}", flush=True)
        print("-" * 10, flush=True)

        train_loss, train_acc = train_epoch(model, train_loader, optimizer, criterion, device)
        valid_loss, valid_acc = validate_epoch(model, valid_loader, device, criterion)

        print(f"Train: loss={train_loss:.4f} acc={train_acc:.4f} | "
              f"Valid: loss={valid_loss:.4f} acc={valid_acc:.4f}", flush=True)

        if valid_acc > best_acc:
            best_acc = valid_acc
            stale_epochs = 0
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            torch.save(
                {
                    "state_dict": model.state_dict(),
                    "meta": {
                        "architecture": "ZFNet-agro",
                        "num_classes": actual_classes,
                        "epoch": epoch,
                        "train_acc": train_acc,
                        "valid_acc": valid_acc,
                        # Las etiquetas viajan con el checkpoint: quien infiere no
                        # puede inventar ni reordenar el mapeo índice -> clase.
                        "labels": list(valid_classes),
                        "label_to_index": {name: index for index, name in enumerate(valid_classes)},
                    },
                },
                str(out_path),
            )
            print(f"Guardado -> {args.output} (acc {best_acc:.4f})", flush=True)
        else:
            stale_epochs += 1

        lr_scheduler_step.step()
        if stale_epochs >= args.patience:
            print(f"Early stopping: sin mejorar {args.patience} épocas", flush=True)
            break

    # La partición de prueba se evalúa con el MEJOR checkpoint, no con los pesos
    # de la última época (que pueden estar peores por sobreajuste).
    best_path = Path(args.output)
    if test_loader is not None and best_path.is_file():
        best_payload = torch.load(best_path, map_location=device, weights_only=False)
        model.load_state_dict(best_payload["state_dict"])
        model = model.to(device)
        test_loss, test_acc = validate_epoch(model, test_loader, device, criterion)
        print(f"Prueba final: loss={test_loss:.4f} acc={test_acc:.4f}", flush=True)

    time_elapsed = time.time() - since
    print(f"\nEntrenamiento completado en {time_elapsed // 60:.0f}m {time_elapsed % 60:.0f}s", flush=True)
    print(f"Mejor precisión validación: {best_acc:.2%}", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fine-tuning ZFNet para clasificación agronómica")
    parser.add_argument("--data-dir", type=str, required=True,
                        help="Directorio del dataset con estructura fruta/estado (por ejemplo fruits_dataset_synthetic)")
    parser.add_argument("--classes", type=int, required=True,
                        help="Número de clases del dataset agronómico")
    parser.add_argument("--mode", type=str, required=True, choices=["head-only", "full"],
                        help="Modo de fine-tuning")
    parser.add_argument("--epochs", type=int, default=10, help="Número de épocas")
    parser.add_argument("--patience", type=int, default=10, help="Épocas sin mejora antes de detener")
    parser.add_argument("--batch-size", type=int, default=32, help="Tamaño de lote")
    parser.add_argument("--train-percent", type=float, default=70.0, help="Porcentaje de imágenes para entrenamiento")
    parser.add_argument("--valid-percent", type=float, default=15.0, help="Porcentaje de imágenes para validación")
    parser.add_argument("--test-percent", type=float, default=15.0, help="Porcentaje de imágenes para prueba")
    parser.add_argument("--seed", type=int, default=42, help="Semilla para dividir aleatoriamente")
    parser.add_argument("--lr", type=float, default=0.01, help="Learning rate inicial")
    parser.add_argument("--step-size", type=int, default=7, help="Step size para StepLR")
    parser.add_argument("--gamma", type=float, default=0.1, help="Factor gamma para StepLR")
    parser.add_argument("--output", type=str,
                        default="models/weights/zfnet_agro.pt",
                        help="Donde guardar el checkpoint entrenado")
    parser.add_argument("--checkpoint", type=str,
                        default=_CKPT_DEFAULT,
                        help="Ruta al checkpoint ImageNet pre-entrenado")

    args = parser.parse_args()
    main(args)