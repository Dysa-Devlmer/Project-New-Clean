# Script para detectar puerto activo del servidor DYSA Point
# Escanea puertos 8547-8555 buscando endpoints de health

$ports = 8547..8555

function Test-Url($url) {
  try {
    (Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200
  } catch {
    $false
  }
}

$found = $null
Write-Host "Escaneando puertos 8547-8555..." -ForegroundColor Yellow

foreach ($p in $ports) {
  Write-Host "  Probando puerto $p..." -ForegroundColor Gray
  if (Test-Url "http://localhost:$p/health" -or Test-Url "http://localhost:$p/api/sistema/health") {
    $found = $p
    break
  }
}

if ($found) {
  Write-Host "Servidor responde en puerto $found" -ForegroundColor Green
  Write-Host "Health: http://localhost:$found/health" -ForegroundColor Cyan
  Write-Host "API Health: http://localhost:$found/api/sistema/health" -ForegroundColor Cyan
} else {
  Write-Host "No se encontro servidor en puertos 8547-8555" -ForegroundColor Red
  Write-Host "Ejecuta: npm run server:restart" -ForegroundColor Yellow
}