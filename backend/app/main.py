"""API HTTP del proyecto ZFNet.

Endpoints:
    GET  /api/health          estado del servicio
    GET  /api/model           ficha técnica del modelo cargado
    GET  /api/layers          capas disponibles para explicar
    GET  /api/classes         etiquetas del clasificador
    POST /api/predict         imagen -> top-k
    POST /api/explain         imagen -> predicción + DeconvNet + mapa de activación
    POST /api/compare         dos imágenes -> predicciones (para la vista de comparación)
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import base64
import io
import numpy as np
import torch
from PIL import Image
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .core.preprocess import load_image, preprocess
from .core.registry import get_service
from .schemas import (
    CompareResponse,
    ExplainResponse,
    HealthResponse,
    LayersResponse,
    ModelInfoResponse,
    PredictionResponse,
)

MAX_BYTES = 12 * 1024 * 1024
ALLOWED = {"image/jpeg", "image/png", "image/webp", "image/bmp"}
ROOT = Path(__file__).resolve().parents[2]
TRAINING_JOBS: dict[str, dict] = {}


def _dataset_class_count(dataset_dir: Path) -> int:
    """Clases del dataset: las del manifiesto si existe, si no las carpetas fruta/estado.

    El entrenamiento antes recibía `--classes 10` fijo, así que cualquier dataset
    con otro número de clases fallaba con "se esperaban 10 clases".
    """
    manifest_path = dataset_dir / "dataset_manifest.json"
    if manifest_path.is_file():
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        labels = data.get("labels")
        if isinstance(labels, list) and labels:
            return len(labels)
    return sum(
        1
        for fruit_dir in dataset_dir.iterdir()
        if fruit_dir.is_dir()
        for class_dir in fruit_dir.iterdir()
        if class_dir.is_dir()
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_service()  # carga el modelo al arrancar, no en la primera request
    yield


app = FastAPI(
    title="ZFNet Agro API",
    version="0.1.0",
    description="Clasificación con ZFNet y explicabilidad por DeconvNet.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


async def _read_image(file: UploadFile):
    if file.content_type and file.content_type not in ALLOWED:
        raise HTTPException(415, f"formato no soportado: {file.content_type}")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"la imagen supera {MAX_BYTES // (1024 * 1024)} MB")
    if not data:
        raise HTTPException(400, "archivo vacío")
    try:
        return load_image(data)
    except Exception as exc:  # PIL levanta varios tipos según el formato
        raise HTTPException(400, f"no se pudo leer la imagen: {exc}") from exc


@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    svc = get_service()
    return HealthResponse(
        status="ok",
        model=svc.meta.name,
        classes=svc.meta.num_classes,
        load_seconds=svc.load_seconds,
    )


@app.get("/api/model", response_model=ModelInfoResponse)
def model_info() -> ModelInfoResponse:
    svc = get_service()
    meta = svc.meta
    return ModelInfoResponse(
        name=meta.name,
        architecture=meta.architecture,
        dataset=meta.dataset,
        num_classes=meta.num_classes,
        params=meta.params,
        input_size=meta.input_size,
        top1=meta.top1,
        top5=meta.top5,
        notes=meta.notes,
        checkpoint=svc.extras.get("checkpoint", ""),
    )


@app.get("/api/layers", response_model=LayersResponse)
def layers() -> LayersResponse:
    return LayersResponse(layers=get_service().layers())


@app.get("/api/classes")
def classes(limit: int = 1000) -> dict:
    svc = get_service()
    return {"total": len(svc.labels), "labels": svc.labels[:limit]}


@app.post("/api/predict", response_model=PredictionResponse)
async def predict(file: UploadFile = File(...), top_k: int = Form(5)) -> PredictionResponse:
    svc = get_service()
    img = await _read_image(file)
    preds = svc.predict(img, top_k=max(1, min(top_k, 20)))
    return PredictionResponse(predictions=preds, model=svc.meta.name)


@app.post("/api/explain", response_model=ExplainResponse)
async def explain(
    file: UploadFile = File(...),
    layer: str = Form("conv5"),
    channel: int | None = Form(None),
    top_k: int = Form(9),
    with_prediction: bool = Form(True),
) -> ExplainResponse:
    svc = get_service()
    img = await _read_image(file)
    try:
        payload = svc.explain(img, layer=layer, channel=channel, top_k=max(1, min(top_k, 16)))
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    preds = svc.predict(img, top_k=5) if with_prediction else []
    return ExplainResponse(predictions=preds, **payload)


@app.get("/api/datasets")
def datasets(dataset: str = "fruits_dataset_synthetic"):
    base = (ROOT / dataset).resolve()
    if not base.is_relative_to(ROOT) or not base.is_dir():
        raise HTTPException(404, "dataset no encontrado")

    manifest_path = base / "dataset_manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        fruit_classes = {}
        all_labels = set()
        for record in manifest["images"]:
            fruit = record["fruit"]
            label = record["label"]
            fruit_classes.setdefault(fruit, {})
            fruit_classes[fruit].setdefault(label, 0)
            fruit_classes[fruit][label] += 1
            all_labels.add(label)
        total = manifest["total_images"]
        fruit_payload = {
            fruit: {label: {"count": count} for label, count in sorted(classes.items())}
            for fruit, classes in sorted(fruit_classes.items())
        }
    else:
        fruit_payload = {}
        all_labels = set()
        total = 0
        for fruit_dir in sorted((path for path in base.iterdir() if path.is_dir()), key=lambda path: path.name):
            fruit_payload[fruit_dir.name] = {}
            for class_dir in sorted((path for path in fruit_dir.iterdir() if path.is_dir()), key=lambda path: path.name):
                count = sum(1 for path in class_dir.iterdir() if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"})
                fruit_payload[fruit_dir.name][class_dir.name] = {"count": count}
                all_labels.add(class_dir.name)
                total += count

    return {
        "name": dataset,
        "fruits": fruit_payload,
        "totals": {"images": total, "classes": len(all_labels)},
    }


@app.get("/api/dataset-page/{dataset}")
def dataset_page(dataset: str, fruit: str, label: str, page: int = 1, page_size: int = 24):
    base = (ROOT / dataset).resolve()
    if not base.is_relative_to(ROOT) or not base.is_dir():
        raise HTTPException(404, "dataset no encontrado")
    if page < 1 or page_size < 1 or page_size > 100:
        raise HTTPException(422, "página o tamaño no válido")

    manifest_path = base / "dataset_manifest.json"
    if manifest_path.is_file():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        names = [
            record
            for record in manifest["images"]
            if record["fruit"] == fruit and record["label"] == label
        ]
    else:
        class_dir = base / fruit / label
        names = []
        if class_dir.is_dir():
            names = [{"filename": path.name, "relative_path": path.relative_to(ROOT).as_posix(), "label": label, "fruit": fruit}
                     for path in sorted(class_dir.iterdir(), key=lambda item: item.name)
                     if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".bmp"}]

    total = len(names)
    start = (page - 1) * page_size
    items = names[start:start + page_size]
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, (total + page_size - 1) // page_size),
    }


@app.get("/api/dataset-image/{dataset}/{fruit}/{class_name}/{filename}")
def dataset_image(dataset: str, fruit: str, class_name: str, filename: str):
    base = (ROOT / dataset).resolve()
    path = (base / fruit / class_name / filename).resolve()
    if not base.is_relative_to(ROOT) or not path.is_relative_to(base) or not path.is_file():
        raise HTTPException(404, "imagen no encontrada")
    return FileResponse(path)


@app.get("/api/dataset-manifest/{dataset}")
def dataset_manifest(dataset: str):
    manifest_path = (ROOT / dataset / "dataset_manifest.json").resolve()
    if not manifest_path.is_relative_to(ROOT) or not manifest_path.is_file():
        raise HTTPException(404, "manifiesto no encontrado")
    return json.loads(manifest_path.read_text(encoding="utf-8"))


@app.post("/api/training/start")
def start_training(
    dataset: str = Form("fruits_dataset_synthetic"),
    epochs: int = Form(5),
    batch_size: int = Form(32),
    learning_rate: float = Form(0.01),
    train_percent: float = Form(70.0),
    valid_percent: float = Form(15.0),
    test_percent: float = Form(15.0),
    seed: int = Form(42),
    mode: str = Form("head-only"),
    step_size: int = Form(7),
    gamma: float = Form(0.1),
    patience: int = Form(10),
):
    if epochs < 1 or epochs > 15000:
        raise HTTPException(422, "epochs debe estar entre 1 y 15000")
    if learning_rate <= 0:
        raise HTTPException(422, "learning_rate debe ser mayor que cero")
    if mode not in {"head-only", "full"}:
        raise HTTPException(422, "modo no válido")

    if abs(train_percent + valid_percent + test_percent - 100.0) > 0.01:
        raise HTTPException(422, "train, validación y prueba deben sumar 100%")

    dataset_dir = (ROOT / dataset).resolve()
    if not dataset_dir.is_relative_to(ROOT) or not dataset_dir.is_dir():
        raise HTTPException(404, "dataset no válido")

    job_id = f"job-{int(time.time()*1000)}"
    output = ROOT / "models" / "weights" / f"zfnet_{dataset}_{job_id}.pt"
    log_path = ROOT / "models" / "weights" / f"{job_id}.log"
    num_classes = _dataset_class_count(dataset_dir)
    if num_classes < 2:
        raise HTTPException(422, f"el dataset {dataset} no tiene clases suficientes")
    command = [
        sys.executable, str(ROOT / "scripts" / "fine_tune_agro.py"),
        "--data-dir", str(dataset_dir), "--classes", str(num_classes),
        "--mode", mode, "--epochs", str(epochs), "--batch-size", str(batch_size),
        "--lr", str(learning_rate), "--step-size", str(step_size), "--gamma", str(gamma), "--patience", str(patience),
        "--output", str(output),
    ]
    command += [
        "--train-percent", str(train_percent),
        "--valid-percent", str(valid_percent),
        "--test-percent", str(test_percent),
        "--seed", str(seed),
    ]

    job = {"id": job_id, "status": "running", "output": str(output), "log": str(log_path), "lines": [], "returncode": None}
    TRAINING_JOBS[job_id] = job

    def run_job():
        log_path.parent.mkdir(parents=True, exist_ok=True)
        with log_path.open("w", encoding="utf-8") as log:
            process = subprocess.Popen(command, cwd=str(ROOT), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
            job["process"] = process
            for line in process.stdout:
                clean = line.rstrip()
                log.write(line)
                job["lines"] = (job["lines"] + [clean])[-500:]
            process.wait()
            job.pop("process", None)
            job["returncode"] = process.returncode
            if job["status"] != "cancelled":
                job["status"] = "completed" if process.returncode == 0 else "failed"
            if process.returncode == 0:
                os.environ["ZFNET_CUSTOM_CHECKPOINT"] = str(output)
                get_service.cache_clear()

    threading.Thread(target=run_job, daemon=True).start()
    return {"job_id": job_id, "command": command}


@app.post("/api/training/cancel/{job_id}")
def cancel_training(job_id: str):
    job = TRAINING_JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job no encontrado")
    process = job.get("process")
    if job["status"] != "running" or process is None:
        return {"id": job_id, "status": job["status"]}
    process.terminate()
    job["status"] = "cancelled"
    job["lines"] = (job["lines"] + ["Entrenamiento cancelado por el usuario."])[-500:]
    return {"id": job_id, "status": "cancelled"}


@app.get("/api/training/status/{job_id}")
def training_status(job_id: str):
    job = TRAINING_JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job no encontrado")
    # `process` es un objeto Popen y no forma parte del contrato JSON. Mientras
    # el entrenamiento corre, incluirlo provocaba HTTP 500 en cada polling del
    # frontend (`Object of type Popen is not JSON serializable`).
    return {k: v for k, v in job.items() if k not in {"log", "output", "process"}} | {
        "checkpoint": job["output"] if job["status"] == "completed" else None
    }


@app.post("/api/convolutions")
async def convolutions(file: UploadFile = File(...)):
    img = await _read_image(file)
    svc = get_service()
    x = preprocess(img)
    logits, activations, _ = svc.model(x, return_activations=True)

    maps = []
    for name in ("conv1", "conv2", "conv3", "conv4", "conv5"):
        tensor = activations[name][0]
        mean_map = tensor.mean(dim=0).detach().cpu().numpy()
        mean_map = (mean_map - mean_map.min()) / (mean_map.max() - mean_map.min() + 1e-8)
        heat = Image.fromarray(np.uint8(mean_map * 255), mode="L").resize((224, 224), Image.Resampling.BILINEAR)
        buffer = io.BytesIO()
        heat.save(buffer, format="PNG")
        uri = "data:image/png;base64," + base64.b64encode(buffer.getvalue()).decode("ascii")
        maps.append({
            "name": name,
            "shape": list(tensor.shape),
            "channels": int(tensor.shape[0]),
            "map": uri,
            "mean_activation": float(tensor.mean().item()),
            "max_activation": float(tensor.max().item()),
        })

    probabilities = torch.softmax(logits, dim=1)[0]
    return {"maps": maps, "shape_out": list(logits.shape), "probabilities": probabilities.detach().cpu().tolist()}


@app.post("/api/compare", response_model=CompareResponse)
async def compare(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    top_k: int = Form(3),
) -> CompareResponse:
    svc = get_service()
    img_a, img_b = await _read_image(file_a), await _read_image(file_b)
    return CompareResponse(
        a=svc.predict(img_a, top_k=top_k),
        b=svc.predict(img_b, top_k=top_k),
        model=svc.meta.name,
    )
