@echo off
chcp 65001 > nul
title 🏗️ DYSA Point v2.0.14 - Constructor de Instalador Profesional
color 0A

echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo ███                                                                          ███
echo ███        🏗️ DYSA POINT v2.0.14 - CONSTRUCTOR DE INSTALADOR PROFESIONAL   ███
echo ███                                                                          ███
echo ████████████████████████████████████████████████████████████████████████████████
echo.

echo 🚀 INICIANDO CONSTRUCCIÓN DEL INSTALADOR PROFESIONAL...
echo ════════════════════════════════════════════════════════════════════════════════
echo.

:: Variables de configuración
set "PROJECT_DIR=%~dp0"
set "BUILD_DIR=%PROJECT_DIR%build"
set "OUTPUT_DIR=%PROJECT_DIR%..\installers"
set "LOG_FILE=%TEMP%\dysa_point_build.log"

echo 📅 Fecha de construcción: %DATE% %TIME% > "%LOG_FILE%"
echo ═══════════════════════════════════════════════════════ >> "%LOG_FILE%"

echo ⏰ Hora de inicio: %TIME%
echo 📁 Directorio del proyecto: %PROJECT_DIR%
echo 📦 Directorio de salida: %OUTPUT_DIR%
echo.

:: PASO 1: Verificar prerequisitos
echo 🔍 PASO 1/8: Verificando prerequisitos...
echo ═══════════════════════════════════════════════════════

:: Verificar Node.js
echo    ✓ Verificando Node.js...
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    ❌ Node.js no está instalado
    echo ❌ Node.js requerido >> "%LOG_FILE%"
    goto :error
)

for /f "tokens=*" %%a in ('node --version') do (
    echo    ✅ Node.js: %%a
    echo ✅ Node.js: %%a >> "%LOG_FILE%"
)

:: Verificar npm
echo    ✓ Verificando npm...
npm --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    ❌ npm no está instalado
    echo ❌ npm requerido >> "%LOG_FILE%"
    goto :error
)

for /f "tokens=*" %%a in ('npm --version') do (
    echo    ✅ npm: v%%a
    echo ✅ npm: v%%a >> "%LOG_FILE%"
)

:: Verificar Electron Builder
echo    ✓ Verificando Electron Builder...
npx electron-builder --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo    ⚠️  Electron Builder no encontrado, instalando...
    npm install electron-builder --save-dev
    if %ERRORLEVEL% NEQ 0 (
        echo    ❌ Error instalando Electron Builder
        goto :error
    )
)

echo    ✅ Electron Builder disponible
echo.

:: PASO 2: Limpiar build anterior
echo 🧹 PASO 2/8: Limpiando construcciones anteriores...
echo ═══════════════════════════════════════════════════════

if exist "%OUTPUT_DIR%" (
    echo    ♻️ Eliminando instaladores anteriores...
    rmdir /s /q "%OUTPUT_DIR%" 2>nul
    echo ♻️ Limpieza anterior >> "%LOG_FILE%"
)

if exist "%PROJECT_DIR%dist" (
    echo    ♻️ Eliminando directorio dist...
    rmdir /s /q "%PROJECT_DIR%dist" 2>nul
)

mkdir "%OUTPUT_DIR%" 2>nul
echo    ✅ Directorios limpiados
echo.

:: PASO 3: Verificar estructura del proyecto
echo 📂 PASO 3/8: Verificando estructura del proyecto...
echo ═══════════════════════════════════════════════════════

:: Verificar archivos principales
if not exist "%PROJECT_DIR%package.json" (
    echo    ❌ package.json no encontrado
    goto :error
)
echo    ✅ package.json encontrado

if not exist "%PROJECT_DIR%main.js" (
    echo    ❌ main.js no encontrado
    goto :error
)
echo    ✅ main.js encontrado

:: Verificar scripts del instalador
if not exist "%BUILD_DIR%\installer.nsh" (
    echo    ❌ installer.nsh no encontrado
    goto :error
)
echo    ✅ installer.nsh encontrado

if not exist "%BUILD_DIR%\restaurant-wizard.nsh" (
    echo    ❌ restaurant-wizard.nsh no encontrado
    goto :error
)
echo    ✅ restaurant-wizard.nsh encontrado

if not exist "%BUILD_DIR%\system-integration.nsh" (
    echo    ❌ system-integration.nsh no encontrado
    goto :error
)
echo    ✅ system-integration.nsh encontrado

if not exist "%BUILD_DIR%\professional-uninstaller.nsh" (
    echo    ❌ professional-uninstaller.nsh no encontrado
    goto :error
)
echo    ✅ professional-uninstaller.nsh encontrado

:: Contar servicios y rutas
set SERVICE_COUNT=0
for %%f in ("%PROJECT_DIR%server\services\*.js") do set /a SERVICE_COUNT+=1
echo    ✅ %SERVICE_COUNT% servicios encontrados

set ROUTE_COUNT=0
for %%f in ("%PROJECT_DIR%server\routes\*.js") do set /a ROUTE_COUNT+=1
echo    ✅ %ROUTE_COUNT% rutas de API encontradas

echo ✅ Estructura del proyecto verificada >> "%LOG_FILE%"
echo.

:: PASO 4: Actualizar dependencias
echo 📦 PASO 4/8: Verificando e instalando dependencias...
echo ═══════════════════════════════════════════════════════

echo    🔄 Ejecutando npm install...
npm install --production=false
if %ERRORLEVEL% NEQ 0 (
    echo    ❌ Error instalando dependencias
    echo ❌ Error npm install >> "%LOG_FILE%"
    goto :error
)

echo    ✅ Dependencias instaladas correctamente
echo ✅ Dependencias OK >> "%LOG_FILE%"
echo.

:: PASO 5: Crear archivos de assets faltantes
echo 🎨 PASO 5/8: Creando assets del instalador...
echo ═══════════════════════════════════════════════════════

:: Crear icono básico si no existe
if not exist "%BUILD_DIR%\icon.ico" (
    echo    ⚠️  Icono principal no encontrado, usando predeterminado
    echo ⚠️ Icono faltante >> "%LOG_FILE%"
)

:: Crear archivo de licencia
if not exist "%PROJECT_DIR%LICENSE.txt" (
    echo    📄 Creando archivo de licencia...
    (
        echo LICENCIA DE SOFTWARE COMERCIAL - DYSA POINT v2.0.14
        echo ══════════════════════════════════════════════════════
        echo.
        echo Copyright ^(c^) 2025 DYSA Solutions SpA
        echo Todos los derechos reservados.
        echo.
        echo Este software es propietario y está protegido por leyes de derechos de autor.
        echo El uso de este software está sujeto a los términos y condiciones del
        echo Acuerdo de Licencia de Usuario Final ^(EULA^).
        echo.
        echo Para más información, visite: https://dysa.cl/licencia
        echo Soporte técnico: soporte@dysa.cl
    ) > "%PROJECT_DIR%LICENSE.txt"
    echo    ✅ LICENSE.txt creado
)

echo    ✅ Assets del instalador preparados
echo.

:: PASO 6: Preparar configuración de build
echo ⚙️ PASO 6/8: Preparando configuración de build...
echo ═══════════════════════════════════════════════════════

:: Crear configuración temporal específica para el build
echo    🔧 Configurando parámetros de build...

:: Verificar que todas las configuraciones estén en package.json
findstr /C:"electron-builder" "%PROJECT_DIR%package.json" >nul
if %ERRORLEVEL% NEQ 0 (
    echo    ❌ Configuración de electron-builder no encontrada en package.json
    goto :error
)

echo    ✅ Configuración de build verificada
echo.

:: PASO 7: Construir el instalador
echo 🏗️ PASO 7/8: Construyendo instalador profesional...
echo ═══════════════════════════════════════════════════════

echo    🚀 Iniciando construcción con Electron Builder...
echo    ⏱️ Este proceso puede tomar 5-10 minutos...
echo.

:: Mostrar progreso mientras se construye
echo    📦 Empaquetando aplicación Electron...
echo    🗜️ Comprimiendo archivos...
echo    📝 Generando scripts NSIS...
echo    🔧 Compilando instalador...

:: Ejecutar Electron Builder
npx electron-builder --win --x64 --publish=never
if %ERRORLEVEL% NEQ 0 (
    echo    ❌ Error durante la construcción del instalador
    echo ❌ Error en electron-builder >> "%LOG_FILE%"
    goto :error
)

echo    ✅ Instalador construido exitosamente
echo ✅ Build exitoso >> "%LOG_FILE%"
echo.

:: PASO 8: Verificar resultado y mostrar información
echo ✅ PASO 8/8: Verificación final y resumen...
echo ═══════════════════════════════════════════════════════

:: Buscar el archivo del instalador generado
set "INSTALLER_FILE="
for %%f in ("%OUTPUT_DIR%\*.exe") do (
    set "INSTALLER_FILE=%%f"
    echo    📦 Instalador generado: %%~nxf
)

if "%INSTALLER_FILE%"=="" (
    echo    ❌ No se encontró el archivo del instalador
    goto :error
)

:: Mostrar información del archivo
for %%f in ("%INSTALLER_FILE%") do (
    set /a SIZE_MB=%%~zf/1024/1024
    echo    📏 Tamaño: !SIZE_MB! MB
    echo    📅 Fecha: %%~tf
)

echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo ███                                                                          ███
echo ███                    🎉 ¡CONSTRUCCIÓN COMPLETADA EXITOSAMENTE!            ███
echo ███                                                                          ███
echo ████████████████████████████████████████████████████████████████████████████████
echo.

echo 🏆 RESUMEN DE CONSTRUCCIÓN:
echo ═══════════════════════════════
echo.
echo ✅ Sistema: DYSA Point v2.0.14 - Sistema POS Empresarial
echo ✅ Tipo: Instalador Profesional Tipo PhotoShop/VSCode
echo ✅ Características: %SERVICE_COUNT% servicios + %ROUTE_COUNT% APIs REST
echo ✅ Instalador: %INSTALLER_FILE%
echo ✅ Tamaño: !SIZE_MB! MB
echo ✅ Plataforma: Windows 10/11 (x64)
echo.

echo 🚀 CARACTERÍSTICAS DEL INSTALADOR:
echo ═══════════════════════════════════
echo ✅ Wizard de configuración del restaurante
echo ✅ Instalación automática de MySQL (opcional)
echo ✅ Configuración automática de base de datos
echo ✅ Registro completo en sistema Windows
echo ✅ Servicios de Windows automáticos
echo ✅ Firewall configurado automáticamente
echo ✅ Shortcuts profesionales en menú inicio
echo ✅ Desinstalador completo con preservación de datos
echo ✅ Backup automático antes de desinstalar
echo ✅ Integración completa con Windows
echo.

echo 📋 PRÓXIMOS PASOS:
echo ═══════════════════
echo.
echo 1. 🧪 Probar el instalador en un sistema limpio
echo 2. ✅ Verificar que el wizard de restaurante funcione
echo 3. 🗄️ Confirmar que la base de datos se configure automáticamente
echo 4. 🔗 Verificar que todos los shortcuts funcionen
echo 5. 🗑️ Probar el desinstalador completo
echo 6. 📦 Distribuir a restaurantes para instalación
echo.

echo 📞 SOPORTE:
echo ═══════════
echo 🌐 Portal: http://localhost:8547/support ^(después de instalar^)
echo 📧 Email: soporte@dysa.cl
echo 📚 Docs: Incluidas en el instalador
echo.

echo ⏰ Construcción completada: %TIME%
echo 📄 Log completo: %LOG_FILE%
echo.

:: Preguntar si abrir la carpeta de salida
choice /C YN /M "¿Desea abrir la carpeta con el instalador generado (Y/N)?"
if errorlevel 2 goto :end
explorer "%OUTPUT_DIR%"

goto :end

:error
echo.
echo ████████████████████████████████████████████████████████████████████████████████
echo ███                                                                          ███
echo ███                         ❌ ERROR EN LA CONSTRUCCIÓN                     ███
echo ███                                                                          ███
echo ████████████████████████████████████████████████████████████████████████████████
echo.
echo ❌ La construcción del instalador falló
echo 📄 Revise el log completo en: %LOG_FILE%
echo 🔧 Verifique que todos los prerequisitos estén instalados
echo 📞 Si el problema persiste, contacte soporte: soporte@dysa.cl
echo.
echo ❌ Error en construcción >> "%LOG_FILE%"
pause
exit /b 1

:end
echo ✅ Construcción completada exitosamente >> "%LOG_FILE%"
echo.
echo ⏰ Presiona cualquier tecla para finalizar...
pause >nul
exit /b 0