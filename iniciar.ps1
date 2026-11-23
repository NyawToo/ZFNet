# Arranca ZFNet Agro: backend FastAPI (puerto 8000) + frontend Next.js (puerto 3000)
# Uso: clic derecho -> "Ejecutar con PowerShell", o en PowerShell:  .\iniciar.ps1

$raiz = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $raiz ".venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "No existe .venv. Crea el entorno con:" -ForegroundColor Yellow
    Write-Host "  python -m venv .venv"
    Write-Host "  .\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt"
    Write-Host "  .\.venv\Scripts\python.exe -m pip install torchvision"
    exit 1
}

if (-not (Test-Path (Join-Path $raiz "frontend\node_modules"))) {
    Write-Host "Instalando dependencias del frontend..." -ForegroundColor Cyan
    Push-Location (Join-Path $raiz "frontend")
    npm install
    Pop-Location
}

Write-Host "Arrancando backend en http://127.0.0.1:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "`$env:ZFNET_CUSTOM_CHECKPOINT='..\models\weights\zfnet_frutos10_phase2.pt'; `$env:ZFNET_DATASET='fruits_dataset_synthetic'; & '$python' -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
) -WorkingDirectory (Join-Path $raiz "backend")

Start-Sleep -Seconds 3

Write-Host "Arrancando frontend en http://localhost:3000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList @("-NoExit", "-Command", "npm run dev") -WorkingDirectory (Join-Path $raiz "frontend")

Start-Sleep -Seconds 6
Start-Process "http://localhost:3000"
Write-Host "Listo. Si el frontend muestra 'backend desconectado', espera unos segundos y recarga." -ForegroundColor Green
