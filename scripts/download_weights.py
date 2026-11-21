"""Descarga los pesos ZFNet originales y los convierte a un checkpoint PyTorch.

Se usa en el build del contenedor: así la imagen es reproducible y no hace falta
versionar un archivo de 350 MB. También sirve en local:

    python scripts/download_weights.py
"""

from __future__ import annotations

import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ONNX_URL = "https://huggingface.co/onnxmodelzoo/zfnet512-12/resolve/main/zfnet512-12.onnx"
ONNX_PATH = ROOT / "models" / "onnx" / "zfnet512-12.onnx"
PT_PATH = ROOT / "models" / "weights" / "zfnet512_imagenet.pt"


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(url) as resp, tmp.open("wb") as fh:
        total = int(resp.headers.get("content-length", 0))
        leido = 0
        next_mark = 10
        while chunk := resp.read(1 << 20):
            fh.write(chunk)
            leido += len(chunk)
            if total:
                pct = leido * 100 / total
                if pct >= next_mark:
                    print(f"  {pct:3.0f}%  ({leido / 1e6:.0f} MB de {total / 1e6:.0f} MB)")
                    next_mark += 10
    tmp.replace(dest)


def main() -> None:
    if PT_PATH.exists():
        print(f"checkpoint ya presente: {PT_PATH}")
        return
    if not ONNX_PATH.exists():
        print(f"descargando {ONNX_URL}")
        download(ONNX_URL, ONNX_PATH)
    print("convirtiendo a PyTorch...")
    sys.path.insert(0, str(ROOT / "scripts"))
    from convert_onnx_to_pt import main as convert

    convert()


if __name__ == "__main__":
    main()
