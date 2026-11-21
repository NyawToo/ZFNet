#!/usr/bin/env python
# -*- coding: utf-8 -*-

import argparse
import csv
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def main():
    parser = argparse.ArgumentParser(description="Genera etiquetas y división reproducible del dataset")
    parser.add_argument("--dataset", default="fruits_dataset_synthetic")
    parser.add_argument("--train-percent", type=float, default=70.0)
    parser.add_argument("--valid-percent", type=float, default=15.0)
    parser.add_argument("--test-percent", type=float, default=15.0)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    if abs(args.train_percent + args.valid_percent + args.test_percent - 100.0) > 0.01:
        raise ValueError("Los porcentajes deben sumar 100")

    project = Path(__file__).resolve().parents[1]
    dataset = (project / args.dataset).resolve()
    if not dataset.is_dir():
        raise FileNotFoundError(f"Dataset no encontrado: {dataset}")

    classes = sorted(
        state_dir
        for state_dir in dataset.rglob("*")
        if state_dir.is_dir()
        and any(path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS for path in state_dir.iterdir())
    )
    labels = [state_dir.name for state_dir in classes]
    if len(labels) != 10:
        raise ValueError(f"Se esperaban 10 clases, se encontraron {len(labels)}")

    label_to_index = {label: index for index, label in enumerate(labels)}
    grouped = defaultdict(list)

    for state_dir in classes:
        label = state_dir.name
        fruit = state_dir.parent.name
        for image in sorted(state_dir.iterdir(), key=lambda path: path.name.lower()):
            if image.is_file() and image.suffix.lower() in IMAGE_EXTENSIONS:
                grouped[label].append({
                    "relative_path": image.relative_to(project).as_posix(),
                    "filename": image.name,
                    "fruit": fruit,
                    "fruit_state": "buena" if "buena" in label else "dañada",
                    "label": label,
                    "label_index": label_to_index[label],
                })

    rng = random.Random(args.seed)
    records = []
    split_counts = Counter()

    for label in labels:
        items = grouped[label][:]
        rng.shuffle(items)
        count = len(items)
        train_count = int(count * args.train_percent / 100.0)
        valid_count = int(count * args.valid_percent / 100.0)

        for index, item in enumerate(items):
            if index < train_count:
                split = "train"
            elif index < train_count + valid_count:
                split = "valid"
            else:
                split = "test"
            item["split"] = split
            records.append(item)
            split_counts[split] += 1

    json_path = dataset / "dataset_manifest.json"
    csv_path = dataset / "dataset_manifest.csv"

    manifest = {
        "dataset": args.dataset,
        "seed": args.seed,
        "percentages": {
            "train": args.train_percent,
            "valid": args.valid_percent,
            "test": args.test_percent,
        },
        "labels": labels,
        "label_to_index": label_to_index,
        "total_images": len(records),
        "split_counts": dict(split_counts),
        "images": records,
    }
    json_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    fields = ["relative_path", "filename", "fruit", "fruit_state", "label", "label_index", "split"]
    with csv_path.open("w", newline="", encoding="utf-8") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=fields)
        writer.writeheader()
        for record in records:
            writer.writerow({field: record[field] for field in fields})

    print(f"Manifest JSON: {json_path}")
    print(f"Manifest CSV: {csv_path}")
    print(f"Etiquetas: {len(labels)}")
    print(f"Imágenes: {len(records)}")
    print("Distribución:", dict(split_counts))


if __name__ == "__main__":
    main()
