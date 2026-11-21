# ZFNet Agro

Aplicación de clasificación para identificar cinco frutas en estado bueno o dañada mediante ZFNet fine-tuneado. El proyecto incluye una API FastAPI, un frontend Next.js y visualización DeconvNet de las convoluciones.
##Dataset
Este se encuentra accediendo al enlace:
https://storage.googleapis.com/kaggle-data-sets/13536696/22537983/bundle/archive.zip?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=gcp-kaggle-com%40kaggle-161607.iam.gserviceaccount.com%2F20261121%2Fauto%2Fstorage%2Fgoog4_request&X-Goog-Date=20261121T054942Z&X-Goog-Expires=259200&X-Goog-SignedHeaders=host&X-Goog-Signature=a12ec70a8e713e50d51490a8a1d71271cc904078b69b79dd77db3e6d2d5dbb67c1fcef34260ba33b5e55fa37403e6890a91e7ad2320e78f0b8aae7f93df0cacd03c2ce17900e39b5b5f74b30c613353e3ff3df7b306e89f4efc6a6d33fc2a18f19e85fa10dbb8523af8e4e91554a7ba2ffa77954c6a14839511bd71607cfbf3e22f5ae6a41ea56aba5299124d5b895e651c992b1844dc367ef67e30a2224d83c18858abba7ae61c00765ae08b3e42d524b280fc485252ad468bbab29eac6daf7a8b4cfd1a0bffa9ae4168b4623c46787572a6224136850354e5bd1bcde39769933ca4790e2b05e9ec0085e0559a4cbf3ebe0f5088bbc90e0c18399041f26fda4

Tambien puede ser usado su origen raiz: https://www.kaggle.com/datasets/nyawtoo/fruits-dataset-synthetic-p-m-n-b-m/data
## Tecnologías

- ZFNet y PyTorch
- FastAPI y Uvicorn
- Next.js 15 y React 19
- Pillow y NumPy
- DeconvNet para reconstrucción de activaciones

## Dataset

La fuente única está organizada por fruta y estado:

```text
fruits_dataset_synthetic/
├── bananas/
│   ├── banana_buena/
│   └── banana_dañada/
├── mangos/
│   ├── mango_buena/
│   └── mango_dañado/
├── manzanas/
│   ├── manzana_buena/
│   └── manzana_dañada/
├── naranjas/
│   ├── naranja_buena/
│   └── naranja_dañada/
└── papayas/
    ├── papaya_buena/
    └── papaya_dañada/
```

No es necesario crear carpetas `train`, `valid` o `test`. El entrenamiento selecciona aleatoriamente las imágenes dentro de cada clase.

La división predeterminada es reproducible:

- 70% entrenamiento
- 15% validación
- 15% prueba
- Semilla: `42`

La división se realiza por clase, no sobre una mezcla global. Así cada una de las diez etiquetas conserva representación en las tres particiones.

## Etiquetas

Desde la raíz del proyecto, ejecuta:

```powershell
python scripts\build_dataset_manifest.py --dataset fruits_dataset_synthetic --train-percent 70 --valid-percent 15 --test-percent 15 --seed 42
```

Esto crea:

- `fruits_dataset_synthetic/dataset_manifest.json`
- `fruits_dataset_synthetic/dataset_manifest.csv`

El manifiesto contiene para cada imagen:

- Ruta relativa
- Nombre de archivo
- Fruta
- Estado bueno/dañada
- Etiqueta ZFNet
- Índice numérico
- Partición asignada

Ejecuta el generador nuevamente después de agregar o eliminar imágenes.

## Preparación de Python

Desde PowerShell, en la raíz del proyecto:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
python -m pip install torchvision
```

El modelo requiere PyTorch. Verifica el entorno:

```powershell
python -c "import torch, torchvision; print(torch.__version__)"
```

## Reentrenamiento

Primero genera el manifiesto:

```powershell
python scripts\build_dataset_manifest.py --dataset fruits_dataset_synthetic --train-percent 70 --valid-percent 15 --test-percent 15 --seed 42
```

Entrenamiento completo de ZFNet:

```powershell
python scripts\fine_tune_agro.py --data-dir fruits_dataset_synthetic --classes 10 --mode full --epochs 20 --batch-size 8 --lr 0.001 --step-size 7 --gamma 0.5 --train-percent 70 --valid-percent 15 --test-percent 15 --seed 42 --output models\weights\zfnet_frutos10_reentrenado.pt
```

Entrenamiento solo de la cabeza `fc8`:

```powershell
python scripts\fine_tune_agro.py --data-dir fruits_dataset_synthetic --classes 10 --mode head-only --epochs 10 --batch-size 32 --lr 0.01 --train-percent 70 --valid-percent 15 --test-percent 15 --seed 42 --output models\weights\zfnet_frutos10_cabeza.pt
```

Parámetros principales:

- `--epochs`: número de épocas; el frontend permite hasta 15,000.
- `--batch-size`: imágenes por lote.
- `--lr`: learning rate inicial.
- `--mode head-only`: solo entrena `fc8`; el tronco ZFNet queda congelado.
- `--mode full`: entrena todo ZFNet.
- `--train-percent`: porcentaje de entrenamiento.
- `--valid-percent`: porcentaje de validación.
- `--test-percent`: porcentaje de prueba.
- `--seed`: semilla aleatoria para reproducir el split.
- `--step-size`: épocas entre reducciones del learning rate.
- `--gamma`: factor de reducción del learning rate.
- `--checkpoint`: pesos iniciales ZFNet ImageNet.
- `--output`: archivo `.pt` producido.
- `--patience`: épocas sin mejora antes de activar early stopping.

Los porcentajes deben sumar 100. Si existe el manifiesto correcto, el reentrenamiento lo utiliza automáticamente.

## Backend

Desde la raíz, en PowerShell:

```powershell
cd backend
$env:ZFNET_CUSTOM_CHECKPOINT="C:\Users\Nyaw\Downloads\Inteligencia Artificial\models\weights\zfnet_frutos10_reentrenado.pt"
$env:ZFNET_DATASET="fruits_dataset_synthetic"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Para usar el checkpoint actualmente disponible:

```powershell
$env:ZFNET_CUSTOM_CHECKPOINT="C:\Users\Nyaw\Downloads\Inteligencia Artificial\models\weights\zfnet_frutos10_full.pt"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

API activa:

- Documentación: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health
- Dataset: http://127.0.0.1:8000/api/datasets?dataset=fruits_dataset_synthetic
- Manifiesto: http://127.0.0.1:8000/api/dataset-manifest/fruits_dataset_synthetic

La variable `ZFNET_CUSTOM_CHECKPOINT` debe apuntar a un `.pt` generado por el script de fine-tuning.
Los checkpoints generados por el script guardan también `labels` y `label_to_index`
en `meta`; la API usa ese mapeo para evitar que el orden de clases del modelo y
el de inferencia se desalineen. Un checkpoint antiguo sin ese metadata usa, como
compatibilidad temporal, las etiquetas de `dataset_manifest.json` y emite una
advertencia al arrancar. Un checkpoint de ImageNet no puede usarse como modelo
de frutas: debe configurarse un checkpoint de fine-tuning mediante
`ZFNET_CUSTOM_CHECKPOINT`.

## Frontend

Instala dependencias desde la carpeta del frontend:

```powershell
cd frontend
npm install
npm run dev
```

Abre http://localhost:3000.

Vistas disponibles:

- `/`: explicación de ZFNet, fórmulas y pipeline.
- `/explore`: imágenes paginadas por fruta y estado, predicción y activaciones conv1–conv5.
- `/predict`: carga manual de una imagen propia.
- `/train`: selección de dataset, hasta 15,000 épocas, batch, learning rate, porcentajes, early stopping y cancelación de proceso.

El frontend usa `/api/backend`; el proxy redirige las llamadas al backend FastAPI en `127.0.0.1:8000`. La galería carga el dataset por páginas de 24 imágenes para evitar enviar miles de rutas al navegador.

## Inicio rápido completo

Terminal 1:

```powershell
cd "C:\Users\Nyaw\Downloads\Inteligencia Artificial\backend"
$env:ZFNET_CUSTOM_CHECKPOINT="C:\Users\Nyaw\Downloads\Inteligencia Artificial\models\weights\zfnet_frutos10_full.pt"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Terminal 2:

```powershell
cd "C:\Users\Nyaw\Downloads\Inteligencia Artificial\frontend"
npm run dev
```

## Construcción de producción

Frontend:

```powershell
cd frontend
npm run build
npm run start
```

Backend:

```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Verificaciones de calidad

El proyecto ejecuta estas comprobaciones localmente y en GitHub Actions:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
.\.venv\Scripts\python.exe -m compileall -q backend scripts tests
cd frontend
npm ci
npm run build
```

Las pruebas no descargan el dataset ni los checkpoints grandes: cubren el
contrato crítico de etiquetas, la validación de checkpoints, el conteo de
clases y la serialización segura de los jobs de entrenamiento.

Para evaluar un checkpoint entrenado sobre el split de prueba y generar una
matriz de confusión:

```powershell
python scripts\evaluate_agro.py `
  --checkpoint D:\_zfnet-download\zfnet_frutos10_phase2.pt `
  --data-dir fruits_dataset_synthetic `
  --output-dir D:\_zfnet-download\phase2-report
```

La primera corrida completa produjo `2360/2363 = 99.87%` en test. Este
resultado corresponde al dataset sintético y no garantiza el mismo rendimiento
con fotografías reales; la matriz mostró únicamente tres errores, todos entre
las clases de manzana buena/dañada.

## Prueba manual recomendada

1. Abre `/predict`.
2. Carga una naranja dañada real.
3. Comprueba que el resultado principal sea `naranja_dañada`.
4. Repite con cada fruta buena y dañada.
5. Abre `/explore` para comparar imágenes reales con sus mapas y activaciones.

## Solución de problemas

### Puerto 8000 ocupado

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8000
Stop-Process -Id <PID> -Force
```

### Puerto 3000 ocupado

```powershell
Get-NetTCPConnection -State Listen -LocalPort 3000
Stop-Process -Id <PID> -Force
```

### El frontend muestra backend desconectado

Confirma que el backend escucha en `127.0.0.1:8000` y abre:

```text
http://127.0.0.1:8000/api/health
```

### El modelo devuelve clases incorrectas

- Ejecuta el generador de manifiesto después de modificar el dataset.
- Usa muchas imágenes reales por clase.
- Mantén iluminación, ángulos y fondos variados.
- Entrena con `mode full` si la cabeza sola no converge.
- Verifica las carpetas: no mezcles buen estado con daños, ni una fruta dentro de otra clase.

### La precisión es baja

ZFNet debe tener suficientes muestras representativas. Aumenta imágenes reales, épocas y variación de fondo; no uses únicamente el dataset sintético pequeño para garantizar generalización.
