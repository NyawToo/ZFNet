"""Inspecciona el grafo ONNX de ZFNet: nodos, atributos y formas de los pesos."""

from __future__ import annotations

import sys
from pathlib import Path

import onnx


def fmt_attrs(attrs) -> str:
    parts = []
    for a in attrs:
        if a.type == onnx.AttributeProto.INTS:
            val = list(a.ints)
        elif a.type == onnx.AttributeProto.INT:
            val = a.i
        elif a.type == onnx.AttributeProto.FLOATS:
            val = [round(v, 4) for v in a.floats]
        elif a.type == onnx.AttributeProto.FLOAT:
            val = round(a.f, 4)
        elif a.type == onnx.AttributeProto.STRING:
            val = a.s.decode("utf-8", "replace")
        else:
            val = a.type
        parts.append(f"{a.name}={val}")
    return " ".join(parts)


def main(path: str) -> None:
    model = onnx.load(path, load_external_data=True)
    graph = model.graph
    init_shapes = {i.name: list(i.dims) for i in graph.initializer}

    print(f"== {Path(path).name} ==")
    print(f"opset: {[(o.domain or 'ai.onnx', o.version) for o in model.opset_import]}")
    print(f"ir_version: {model.ir_version}")
    print("\n-- entradas --")
    for inp in graph.input:
        dims = [d.dim_value or d.dim_param for d in inp.type.tensor_type.shape.dim]
        print(f"  {inp.name}: {dims}")
    print("\n-- salidas --")
    for out in graph.output:
        dims = [d.dim_value or d.dim_param for d in out.type.tensor_type.shape.dim]
        print(f"  {out.name}: {dims}")

    print(f"\n-- nodos ({len(graph.node)}) --")
    for i, node in enumerate(graph.node):
        shapes = {k: v for k, v in init_shapes.items() if k in node.input}
        extra = f"  weights={shapes}" if shapes else ""
        print(f"[{i:02d}] {node.op_type:<18} {list(node.input)} -> {list(node.output)}  {fmt_attrs(node.attribute)}{extra}")

    print("\n-- inicializadores --")
    total = 0
    for i in graph.initializer:
        n = 1
        for d in i.dims:
            n *= d
        total += n
        print(f"  {i.name:<40} {list(i.dims)} dtype={i.data_type} params={n:,}")
    print(f"\nTOTAL parámetros: {total:,}")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "models/onnx/zfnet512-12.onnx")
