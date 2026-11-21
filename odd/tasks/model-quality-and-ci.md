# Objective: Re-entrenar el modelo y establecer calidad automatizada
# Branch: feat/model-quality-and-ci · Delivery: ask-on-risk · Test runner: .venv\Scripts\python.exe

## Specs

### S1 — Modelo reentrenado y evaluado
Generar un checkpoint nuevo con el dataset completo usando el pipeline corregido, registrar sus métricas de train/valid/test y evaluar el rendimiento por clase con una matriz de confusión.

Acceptance: el checkpoint contiene `labels` y `label_to_index`; el split es reproducible con seed 42; las métricas y limitaciones quedan documentadas; el checkpoint generado localmente no se versiona automáticamente.

Checks: ejecución del entrenamiento completo; evaluación independiente sobre test; validación del metadata del checkpoint.

### S2 — Pruebas automatizadas del contrato crítico
Agregar pruebas ejecutables para el manifiesto, el orden de etiquetas, la carga segura de checkpoints y el contrato JSON del estado de entrenamiento.

Acceptance: las pruebas fallan ante el desalineamiento de etiquetas, checkpoints incompatibles o serialización de objetos internos; pasan contra el código corregido.

Checks: runner documentado y ejecución completa.

### S3 — Calidad reproducible en CI y documentación
Agregar una configuración mínima de CI para ejecutar pruebas y checks de sintaxis; documentar los comandos de calidad y el resultado del modelo reentrenado.

Acceptance: CI no depende del dataset de 6 GB ni de los pesos privados; la documentación permite reproducir las verificaciones.

Checks: validación local equivalente y build del frontend.

## Tasks

- T1 · S1 · inline · complete · commit TBD — reentrenar y evaluar el checkpoint completo.
- T2 · S2 · inline · complete · `1752e83` — añadir pruebas automatizadas del backend y scripts.
- T3 · S3 · inline · complete · `7b11f38` — añadir CI y actualizar documentación.

## Log

- L1: "fase 2+3 ahora"
- L2: Diagnóstico previo: el checkpoint existente tiene train 17.5% y validación 40%; el dataset local está instalado con 15,692 imágenes, 10 clases y manifiesto 70/15/15 seed 42.
- L3: T2 verificado con 4 pruebas `unittest` y `compileall`; T3 verificado con `npm run build`. El entrenamiento completo de T1 continúa en segundo plano fuera del repositorio.
- L4: El entrenamiento full alcanzó su mejor checkpoint en la época 7 (train 99.99%, validación 99.83%) y abortó en la época 8 por un error de I/O del disco USB externo. La evaluación independiente del checkpoint guardado alcanzó 2360/2363 = 99.87% en test; el checkpoint y los reportes permanecen fuera del repositorio.
