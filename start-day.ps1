# Script de Arranque Automático - DYSA Point Enterprise
# Uso: .\start-day.ps1
# Fecha: 20 Octubre 2025

Write-Host "🚀 INICIANDO JORNADA DYSA POINT ENTERPRISE" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""

# Configurar ubicación
$projectPath = "E:\POS SYSME\POS_MISTURA"
$backendPath = "$projectPath\backend"

Write-Host "📁 Ubicándose en proyecto..." -ForegroundColor Yellow
Set-Location $projectPath

# Verificar estado Git
Write-Host "🔍 Verificando estado del repositorio..." -ForegroundColor Yellow
git status
Write-Host ""

Write-Host "⬇️ Sincronizando con repositorio remoto..." -ForegroundColor Yellow
git pull origin master
Write-Host ""

# Cambiar al directorio backend
Write-Host "🔧 Cambiando a directorio backend..." -ForegroundColor Yellow
Set-Location $backendPath

# Iniciar servidor backend
Write-Host "🌐 Iniciando servidor backend..." -ForegroundColor Yellow
npm run server:start

# Esperar 3 segundos
Start-Sleep -Seconds 3

# Verificar que el servidor esté funcionando
Write-Host "🔍 Verificando servidor..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8547/api/sistema/health" -Method Get -ErrorAction Stop
    Write-Host "✅ Servidor operativo en puerto 8547" -ForegroundColor Green
    Write-Host "   Estado: $($response.data.status)" -ForegroundColor White
    Write-Host "   Uptime: $($response.data.uptime) segundos" -ForegroundColor White
    Write-Host "   BD: $($response.data.database)" -ForegroundColor White
} catch {
    Write-Host "⚠️ Servidor no responde - verificar manualmente" -ForegroundColor Red
}

Write-Host ""
Write-Host "🎯 CHECKPOINT ACTUAL: fase2_tickets_p0_smoke_tests_exitosos" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 TAREAS PARA HOY:" -ForegroundColor Yellow
Write-Host "1. Migrar a BD real (eliminar archivos 'simple')" -ForegroundColor White
Write-Host "2. Probar split/merge de tickets" -ForegroundColor White
Write-Host "3. Iniciar módulo Caja/Pagos (Fase 3 P0)" -ForegroundColor White
Write-Host "4. Verificar sync Electron + Web" -ForegroundColor White
Write-Host "5. Documentar en español y guardar en GitHub" -ForegroundColor White
Write-Host ""

Write-Host "💬 MENSAJE PARA EL AGENTE:" -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

$mensaje = @"
Perfecto. Continúa exactamente desde donde quedamos, sin repetir pasos previos,
siguiendo todas las instrucciones del PROMPT_MAESTRO.md.

1) Migrar completamente a base de datos real (tickets, ítems, modificadores).
2) Eliminar archivos temporales 'simple' usados para las pruebas.
3) Iniciar Fase 3 P0: Caja/Pagos with persistencia real y SSE.
4) Documentar en docs/reports/ (español). Rama: master.
"@

Write-Host $mensaje -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Magenta
Write-Host ""

Write-Host "🔗 ENLACES ÚTILES:" -ForegroundColor Cyan
Write-Host "• Servidor: http://localhost:8547" -ForegroundColor White
Write-Host "• Setup: http://localhost:8547/setup" -ForegroundColor White
Write-Host "• Config Red: http://localhost:8547/config/red" -ForegroundColor White
Write-Host "• Health: http://localhost:8547/api/sistema/health" -ForegroundColor White
Write-Host "• Tickets: http://localhost:8547/api/pos/tickets/estadisticas" -ForegroundColor White
Write-Host ""

Write-Host "✅ ENTORNO LISTO - ¡A TRABAJAR!" -ForegroundColor Green
Write-Host ""