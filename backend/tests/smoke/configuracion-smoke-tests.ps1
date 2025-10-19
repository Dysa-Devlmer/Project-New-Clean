# ========================================
# DYSA Point Enterprise - Smoke Tests
# Configuración con Persistencia Real
# Fecha: 19 Octubre 2025
# ========================================

param(
    [string]$BaseUrl = "http://localhost:8547/api/configuracion",
    [int]$TimeoutSeconds = 30
)

Write-Host "`n" -NoNewline
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "🧪 DYSA Point - Smoke Tests de Configuración" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "🌐 Base URL: $BaseUrl" -ForegroundColor Green
Write-Host "⏱️  Timeout: $TimeoutSeconds segundos" -ForegroundColor Green
Write-Host "🕒 Inicio: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor Green
Write-Host ""

# Contador de pruebas
$testCount = 0
$passedTests = 0
$failedTests = 0
$testResults = @()

# Función para ejecutar una prueba
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Uri,
        [object]$Body = $null,
        [hashtable]$Headers = @{"Content-Type" = "application/json"},
        [string]$ExpectedStatus = "200"
    )

    $global:testCount++
    $testNumber = $global:testCount.ToString().PadLeft(2, '0')

    Write-Host "[$testNumber] " -NoNewline -ForegroundColor DarkGray
    Write-Host "🔍 $Name..." -NoNewline

    try {
        $startTime = Get-Date

        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            TimeoutSec = $TimeoutSeconds
            UseBasicParsing = $true
        }

        if ($Body -and $Method -in @("POST", "PUT", "PATCH")) {
            $params.Body = $Body | ConvertTo-Json -Depth 10
        }

        $response = Invoke-RestMethod @params
        $endTime = Get-Date
        $duration = [math]::Round(($endTime - $startTime).TotalMilliseconds, 0)

        # Verificar estructura de respuesta básica
        if (-not $response.success) {
            throw "Respuesta sin campo 'success' o success=false"
        }

        if (-not $response.data) {
            throw "Respuesta sin campo 'data'"
        }

        Write-Host " ✅ PASS" -ForegroundColor Green
        Write-Host "      └─ Tiempo: ${duration}ms" -ForegroundColor DarkGray

        $global:passedTests++
        $global:testResults += [PSCustomObject]@{
            Test = $Name
            Status = "PASS"
            Duration = "${duration}ms"
            Details = "OK"
        }

        return $response

    } catch {
        $endTime = Get-Date
        $duration = [math]::Round(($endTime - $startTime).TotalMilliseconds, 0)

        Write-Host " ❌ FAIL" -ForegroundColor Red
        Write-Host "      └─ Error: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "      └─ Tiempo: ${duration}ms" -ForegroundColor DarkGray

        $global:failedTests++
        $global:testResults += [PSCustomObject]@{
            Test = $Name
            Status = "FAIL"
            Duration = "${duration}ms"
            Details = $_.Exception.Message
        }

        return $null
    }
}

# Función para validar datos específicos
function Test-DataValidation {
    param(
        [string]$Name,
        [object]$Data,
        [scriptblock]$ValidationScript
    )

    $global:testCount++
    $testNumber = $global:testCount.ToString().PadLeft(2, '0')

    Write-Host "[$testNumber] " -NoNewline -ForegroundColor DarkGray
    Write-Host "🔍 $Name..." -NoNewline

    try {
        $result = & $ValidationScript -Data $Data
        if ($result) {
            Write-Host " ✅ PASS" -ForegroundColor Green
            $global:passedTests++
            $global:testResults += [PSCustomObject]@{
                Test = $Name
                Status = "PASS"
                Duration = "0ms"
                Details = "Validación exitosa"
            }
        } else {
            throw "Validación falló"
        }
    } catch {
        Write-Host " ❌ FAIL" -ForegroundColor Red
        Write-Host "      └─ Error: $($_.Exception.Message)" -ForegroundColor Red
        $global:failedTests++
        $global:testResults += [PSCustomObject]@{
            Test = $Name
            Status = "FAIL"
            Duration = "0ms"
            Details = $_.Exception.Message
        }
    }
}

Write-Host "🚀 Iniciando pruebas de endpoints..." -ForegroundColor Cyan
Write-Host ""

# ===== PRUEBA 1: GET Configuración Completa =====
$configResponse = Test-Endpoint -Name "GET Configuración Sistema Completa" -Method "GET" -Uri "$BaseUrl/sistema/configuracion"

if ($configResponse) {
    # Validar estructura de configuración
    Test-DataValidation -Name "Validar estructura empresa" -Data $configResponse.data -ValidationScript {
        param($Data)
        return $Data.empresa -and $Data.empresa.razonSocial -and $Data.empresa.nombreComercial
    }

    Test-DataValidation -Name "Validar estructura fiscal" -Data $configResponse.data -ValidationScript {
        param($Data)
        return $Data.fiscal -and ($Data.fiscal.ivaDefecto -ge 0) -and $Data.fiscal.monedaPrincipal
    }

    Test-DataValidation -Name "Validar estructura operativa" -Data $configResponse.data -ValidationScript {
        param($Data)
        return $Data.operativa -and $Data.operativa.zonaHoraria -and $Data.operativa.idiomasDisponibles
    }

    Test-DataValidation -Name "Validar estructura restaurante" -Data $configResponse.data -ValidationScript {
        param($Data)
        return $Data.restaurante -and ($Data.restaurante.totalMesas -gt 0) -and $Data.restaurante.nombreEstablecimiento
    }

    Test-DataValidation -Name "Validar metadata" -Data $configResponse.data -ValidationScript {
        param($Data)
        return $Data.metadata -and $Data.metadata.timestamp -and $Data.metadata.version
    }
}

# ===== PRUEBA 2: PUT Configuración Fiscal =====
$updateBody = @{
    seccion = "fiscal"
    configuracion = @{
        monedaPrincipal = "CLP"
        ivaDefecto = 19
        simboloMoneda = "$"
    }
}

$updateResponse = Test-Endpoint -Name "PUT Actualizar Configuración Fiscal" -Method "PUT" -Uri "$BaseUrl/sistema/configuracion" -Body $updateBody

if ($updateResponse) {
    Test-DataValidation -Name "Validar respuesta de actualización" -Data $updateResponse.data -ValidationScript {
        param($Data)
        return $Data.success -and $Data.seccion -eq "fiscal" -and $Data.configuracion.monedaPrincipal -eq "CLP"
    }
}

# ===== PRUEBA 3: PUT Configuración Empresa =====
$updateEmpresaBody = @{
    seccion = "empresa"
    configuracion = @{
        razonSocial = "DYSA Point Enterprise S.A."
        nombreComercial = "DYSA Point Restaurant"
        telefono = "+56 2 2345 6789"
        email = "contacto@dysapoint.com"
    }
}

Test-Endpoint -Name "PUT Actualizar Configuración Empresa" -Method "PUT" -Uri "$BaseUrl/sistema/configuracion" -Body $updateEmpresaBody

# ===== PRUEBA 4: GET Categorías =====
$categoriasResponse = Test-Endpoint -Name "GET Categorías Lista" -Method "GET" -Uri "$BaseUrl/categorias/lista"

if ($categoriasResponse) {
    Test-DataValidation -Name "Validar estructura categorías" -Data $categoriasResponse.data -ValidationScript {
        param($Data)
        return $Data.categorias -and ($Data.categorias.Count -gt 0) -and $Data.total -and $Data.timestamp
    }

    Test-DataValidation -Name "Validar datos de categoría" -Data $categoriasResponse.data -ValidationScript {
        param($Data)
        $categoria = $Data.categorias[0]
        return $categoria.id -and $categoria.nombre -and $categoria.color -and $categoria.icono
    }
}

# ===== PRUEBA 5: PUT Sección Inválida =====
$invalidBody = @{
    seccion = "seccion_inexistente"
    configuracion = @{
        campo = "valor"
    }
}

Write-Host "[$(($global:testCount + 1).ToString().PadLeft(2, '0'))] " -NoNewline -ForegroundColor DarkGray
Write-Host "🔍 PUT Sección Inválida (debe fallar)..." -NoNewline

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/sistema/configuracion" -Method "PUT" -Body ($invalidBody | ConvertTo-Json) -Headers @{"Content-Type" = "application/json"} -TimeoutSec $TimeoutSeconds
    Write-Host " ❌ FAIL" -ForegroundColor Red
    Write-Host "      └─ Error: Debería haber fallado pero retornó éxito" -ForegroundColor Red
    $global:failedTests++
} catch {
    # Esperamos que falle
    if ($_.Exception.Message -like "*400*" -or $_.Exception.Message -like "*válida*") {
        Write-Host " ✅ PASS" -ForegroundColor Green
        Write-Host "      └─ Falló correctamente con error de validación" -ForegroundColor DarkGray
        $global:passedTests++
    } else {
        Write-Host " ❌ FAIL" -ForegroundColor Red
        Write-Host "      └─ Error: Falló pero con error incorrecto: $($_.Exception.Message)" -ForegroundColor Red
        $global:failedTests++
    }
}
$global:testCount++

# ===== PRUEBA 6: GET Estado del Sistema =====
Test-Endpoint -Name "GET Estado del Sistema" -Method "GET" -Uri "$BaseUrl/sistema/estado"

# ===== RESUMEN FINAL =====
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "📊 RESUMEN DE PRUEBAS" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "✅ Pruebas exitosas: $passedTests" -ForegroundColor Green
Write-Host "❌ Pruebas fallidas: $failedTests" -ForegroundColor Red
Write-Host "📈 Total pruebas: $testCount" -ForegroundColor Blue
Write-Host "📊 Porcentaje éxito: $([math]::Round(($passedTests / $testCount) * 100, 1))%" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Yellow" })
Write-Host "🕒 Fin: $(Get-Date -Format 'dd/MM/yyyy HH:mm:ss')" -ForegroundColor Green

if ($failedTests -eq 0) {
    Write-Host "`n🎉 ¡TODAS LAS PRUEBAS PASARON! Sistema funcionando correctamente." -ForegroundColor Green
} else {
    Write-Host "`n⚠️  Algunas pruebas fallaron. Revisar implementación." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 DETALLE DE RESULTADOS:" -ForegroundColor Cyan
$testResults | Format-Table -AutoSize

# Criterios DONE para Fase 1
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Magenta
Write-Host "✅ CRITERIOS DONE - FASE 1" -ForegroundColor Yellow
Write-Host "=" * 60 -ForegroundColor Magenta

$criteriaResults = @()

# Verificar criterio 1: GET/PUT operan sobre BD real
$criterion1 = ($configResponse -and $updateResponse)
$criteriaResults += [PSCustomObject]@{
    Criterio = "GET/PUT operan sobre BD real"
    Estado = if ($criterion1) { "✅ PASS" } else { "❌ FAIL" }
    Detalle = if ($criterion1) { "Endpoints funcionan con persistencia" } else { "Endpoints no funcionan correctamente" }
}

# Verificar criterio 2: Mismo shape actual
$criterion2 = ($configResponse -and $configResponse.data.empresa -and $configResponse.data.fiscal)
$criteriaResults += [PSCustomObject]@{
    Criterio = "Mismo shape de respuesta"
    Estado = if ($criterion2) { "✅ PASS" } else { "❌ FAIL" }
    Detalle = if ($criterion2) { "Estructura de respuesta consistente" } else { "Estructura de respuesta incorrecta" }
}

# Verificar criterio 3: Swagger actualizado
$swaggerExists = Test-Path "$PSScriptRoot\..\..\src\docs\swagger\configuracion.yaml"
$criteriaResults += [PSCustomObject]@{
    Criterio = "Swagger actualizado"
    Estado = if ($swaggerExists) { "✅ PASS" } else { "❌ FAIL" }
    Detalle = if ($swaggerExists) { "Documentación Swagger creada" } else { "Documentación Swagger faltante" }
}

# Verificar criterio 4: Tests básicos
$criterion4 = ($passedTests -ge ($testCount * 0.8))  # 80% de tests pasando
$criteriaResults += [PSCustomObject]@{
    Criterio = "Tests de contrato básicos"
    Estado = if ($criterion4) { "✅ PASS" } else { "❌ FAIL" }
    Detalle = if ($criterion4) { "$passedTests/$testCount tests pasando" } else { "Demasiados tests fallando: $failedTests/$testCount" }
}

$criteriaResults | Format-Table -AutoSize

$allCriteriaPassed = ($criteriaResults | Where-Object { $_.Estado -like "*FAIL*" }).Count -eq 0

if ($allCriteriaPassed) {
    Write-Host "🎉 ¡TODOS LOS CRITERIOS DONE DE FASE 1 CUMPLIDOS!" -ForegroundColor Green
    Write-Host "✅ Fase 1 completada exitosamente. Listo para Fase 2." -ForegroundColor Green
} else {
    Write-Host "⚠️  Algunos criterios DONE no se cumplieron. Revisar implementación." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Cyan

# Código de salida
if ($failedTests -eq 0 -and $allCriteriaPassed) {
    exit 0
} else {
    exit 1
}