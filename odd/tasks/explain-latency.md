# Objective: Reducir latencia de explicación visual sin cambiar resultados
# Branch: perf/explain-latency · Delivery: ask-on-risk · Test runner: .venv\Scripts\python.exe

## Specs

### S1 — Reutilizar el forward de explicación
El endpoint `/api/explain` debe ejecutar una sola pasada forward para obtener activaciones y switches, y reutilizar esos resultados para estadísticas, reconstrucciones y heatmap.

Acceptance: la respuesta conserva capa, canal, mapas, sheet, heatmap y trace; no se altera el modelo ni el preprocesamiento.

Checks: prueba de equivalencia de payload estructural y benchmark local antes/después.

### S2 — Preservar el contrato público
Las rutas existentes y sus respuestas mantienen los mismos campos y validaciones. Un canal o capa inválidos siguen produciendo HTTP 422.

Checks: pruebas automatizadas del servicio y build del frontend.

## Tasks

- T1 · S1-S2 · inline · complete · commit TBD — reutilizar activaciones/switches y verificar equivalencia.

## Log

- L1: "entonces cuando se pueda incia con la fase 4"
- L2: Se seleccionó como primer work unit la optimización de `/api/explain`: actualmente ejecuta tres forwards redundantes en CPU.
- L3: La prueba de contrato pasó con 5 tests. En una medición local sobre CPU, `/api/explain` bajó de 10.9 s a 8.9 s reutilizando activaciones y switches; la respuesta conservó 9 mapas y 12 pasos de trace.
