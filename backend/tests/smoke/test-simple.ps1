# DYSA Point - Smoke Tests Simplificados
param(
    [string]$BaseUrl = "http://localhost:8547/api/configuracion"
)

Write-Host "==== DYSA Point - Smoke Tests de Configuracion ====" -ForegroundColor Cyan
Write-Host "Base URL: $BaseUrl" -ForegroundColor Green
Write-Host ""

$passed = 0
$failed = 0

function Test-Api {
    param($name, $uri, $method = "GET", $body = $null)

    Write-Host "Probando: $name..." -NoNewline

    try {
        $params = @{
            Uri = $uri
            Method = $method
            ContentType = "application/json"
            TimeoutSec = 10
        }

        if ($body) {
            $params.Body = $body | ConvertTo-Json
        }

        $response = Invoke-RestMethod @params

        if ($response.success) {
            Write-Host " PASS" -ForegroundColor Green
            $script:passed++
            return $response
        } else {
            Write-Host " FAIL - No success" -ForegroundColor Red
            $script:failed++
        }
    } catch {
        Write-Host " FAIL - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
    }
}

# Test 1: GET Configuracion
$config = Test-Api "GET Configuracion Sistema" "$BaseUrl/sistema/configuracion"

# Test 2: PUT Configuracion
$updateData = @{
    seccion = "fiscal"
    configuracion = @{
        monedaPrincipal = "CLP"
        ivaDefecto = 19
        simboloMoneda = "$"
    }
}
Test-Api "PUT Configuracion Fiscal" "$BaseUrl/sistema/configuracion" "PUT" $updateData

# Test 3: GET Categorias
Test-Api "GET Categorias" "$BaseUrl/categorias/lista"

# Test 4: GET Estado Sistema
Test-Api "GET Estado Sistema" "$BaseUrl/sistema/estado"

Write-Host ""
Write-Host "=== RESULTADOS ===" -ForegroundColor Cyan
Write-Host "Exitosos: $passed" -ForegroundColor Green
Write-Host "Fallidos: $failed" -ForegroundColor Red

if ($failed -eq 0) {
    Write-Host "TODAS LAS PRUEBAS PASARON!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Hay pruebas fallidas." -ForegroundColor Yellow
    exit 1
}