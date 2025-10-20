# Script de Cierre de Jornada - DYSA Point Enterprise
# Uso: .\end-day.ps1 "mensaje del commit"
# Fecha: 20 Octubre 2025

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "feat: progreso diario guardado"
)

Write-Host "🔚 CERRANDO JORNADA DYSA POINT ENTERPRISE" -ForegroundColor Red
Write-Host "=========================================" -ForegroundColor Red
Write-Host ""

# Configurar ubicación
$projectPath = "E:\POS SYSME\POS_MISTURA"
$backendPath = "$projectPath\backend"

Write-Host "📁 Ubicándose en proyecto..." -ForegroundColor Yellow
Set-Location $projectPath

# Detener servidor si está corriendo
Write-Host "🛑 Deteniendo servidor backend..." -ForegroundColor Yellow
Set-Location $backendPath
try {
    npm run server:stop
    Write-Host "✅ Servidor detenido" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Servidor ya estaba detenido" -ForegroundColor Yellow
}

# Volver al directorio principal
Set-Location $projectPath

# Verificar estado Git
Write-Host "🔍 Verificando cambios pendientes..." -ForegroundColor Yellow
git status

Write-Host ""
$response = Read-Host "¿Deseas guardar todos los cambios? (S/n)"
if ($response -eq "" -or $response -eq "S" -or $response -eq "s" -or $response -eq "Y" -or $response -eq "y") {

    # Agregar todos los archivos
    Write-Host "📦 Agregando archivos..." -ForegroundColor Yellow
    git add .

    # Generar fecha para el tag
    $dateTag = Get-Date -Format "yyyyMMdd"
    $tagName = "eod-$dateTag"

    # Crear commit
    Write-Host "💾 Creando commit..." -ForegroundColor Yellow
    git commit -m "$CommitMessage

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

    # Crear tag
    Write-Host "🏷️ Creando tag $tagName..." -ForegroundColor Yellow
    git tag -f $tagName

    # Push al remoto
    Write-Host "⬆️ Enviando al repositorio remoto..." -ForegroundColor Yellow
    git push origin master --follow-tags

    Write-Host "✅ Cambios guardados exitosamente" -ForegroundColor Green

} else {
    Write-Host "⏭️ Saltando guardado de cambios" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📊 RESUMEN DE LA JORNADA:" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan

# Obtener último commit
$lastCommit = git log -1 --pretty=format:"%h - %s (%ar)"
Write-Host "Último commit: $lastCommit" -ForegroundColor White

# Obtener último tag
$lastTag = git describe --tags --abbrev=0 2>$null
if ($lastTag) {
    Write-Host "Último tag: $lastTag" -ForegroundColor White
}

# Mostrar archivos modificados hoy
$today = Get-Date -Format "yyyy-MM-dd"
Write-Host ""
Write-Host "📝 Archivos modificados hoy:" -ForegroundColor Yellow
git log --since="$today 00:00:00" --name-only --pretty=format: | Sort-Object | Get-Unique | Where-Object {$_ -ne ""}

Write-Host ""
Write-Host ""
Write-Host "💤 PREPARATIVOS PARA MAÑANA:" -ForegroundColor Magenta
Write-Host "============================" -ForegroundColor Magenta
Write-Host "1. Ejecutar: .\start-day.ps1" -ForegroundColor White
Write-Host "2. Usar el mensaje predefinido para el agente" -ForegroundColor White
Write-Host "3. Continuar desde checkpoint: fase2_tickets_p0_smoke_tests_exitosos" -ForegroundColor White
Write-Host ""

Write-Host "🌙 ¡JORNADA CERRADA EXITOSAMENTE!" -ForegroundColor Green
Write-Host "Que descanses bien. Mañana continuamos desde donde quedamos." -ForegroundColor White
Write-Host ""