#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""Evalúa un checkpoint agronómico sobre el split de prueba del manifiesto."""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

import torch
from torch.utils.data import DataLoader

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.core.zfnet import build_zfnet  # noqa: E402
from fine_tune_agro import FruitStateDataset, TransformSubset, get_transforms  # noqa: E402


def evaluate(checkpoint_path: Path, data_dir: Path, output_dir: Path) -> None:
    manifest = json.loads((data_dir / "dataset_manifest.json").read_text(encoding="utf-8"))
    labels = [str(label) for label in manifest["labels"]]
    split_by_path = {
        (ROOT / record["relative_path"]).resolve(): record["split"]
        for record in manifest["images"]
    }

    dataset = FruitStateDataset(str(data_dir), transform=get_transforms(is_training=False))
    test_indices = [
        index
        for index, (image_path, _target) in enumerate(dataset.samples)
        if split_by_path.get(Path(image_path).resolve()) == "test"
    ]
    test_dataset = TransformSubset(dataset, test_indices, get_transforms(is_training=False))
    loader = DataLoader(test_dataset, batch_size=32, shuffle=False, num_workers=0)

    model = build_zfnet(num_classes=len(labels), checkpoint=str(checkpoint_path))
    confusion = [[0 for _ in labels] for _ in labels]
    total = correct = 0
    with torch.no_grad():
        for images, targets in loader:
            predictions = model(images).argmax(dim=1)
            for target, prediction in zip(targets.tolist(), predictions.tolist()):
                confusion[target][prediction] += 1
                total += 1
                correct += int(target == prediction)

    output_dir.mkdir(parents=True, exist_ok=True)
    matrix_path = output_dir / "confusion_matrix.csv"
    with matrix_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["actual/predicted", *labels])
        writer.writerows([[label, *row] for label, row in zip(labels, confusion)])

    report = {
        "checkpoint": str(checkpoint_path),
        "total_test_images": total,
        "correct": correct,
        "accuracy": correct / total if total else 0.0,
        "labels": labels,
        "per_class": {
            label: {
                "total": sum(row),
                "correct": row[index],
                "accuracy": row[index] / sum(row) if sum(row) else 0.0,
            }
            for index, (label, row) in enumerate(zip(labels, confusion))
        },
        "confusion_matrix": confusion,
    }
    report_path = output_dir / "evaluation.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Test: {correct}/{total} = {report['accuracy']:.2%}")
    for label, metrics in report["per_class"].items():
        print(f"  {label}: {metrics['correct']}/{metrics['total']} = {metrics['accuracy']:.2%}")
    print(f"Reporte: {report_path}")
    print(f"Matriz: {matrix_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "fruits_dataset_synthetic")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "reports")
    args = parser.parse_args()
    evaluate(args.checkpoint, args.data_dir, args.output_dir)
