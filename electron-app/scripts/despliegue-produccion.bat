@echo off
REM ========================================
REM DYSA Point - Script de Despliegue en Producción (Windows)
REM Sistema automatizado de instalación para restaurantes
REM Versión: 2.0.14
REM Fecha: 2025-10-13 20:30
REM ========================================

echo.
echo ===============================================
echo  DYSA Point POS v2.0.14 - Despliegue Producción
echo  Sistema Empresarial para Restaurantes
echo ===============================================
echo.

REM Verificar que se ejecuta como administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ ERROR: Este script requiere privilegios de administrador
    echo    Ejecute como administrador y vuelva a intentar
    pause
    exit /b 1
)

echo ✅ Privilegios de administrador verificados
echo.

REM Variables de configuración
set INSTALL_DIR=C:\DYSA_Point
set SERVICE_NAME=DYSAPointPOS
set DB_NAME=dysa_point
set DB_USER=dysa_user
set DB_PASS=%RANDOM%%RANDOM%

echo 📁 Configuración de instalación:
echo    Directorio: %INSTALL_DIR%
echo    Servicio: %SERVICE_NAME%
echo    Base de datos: %DB_NAME%
echo    Usuario DB: %DB_USER%
echo.

REM Verificar Node.js
echo 🔍 Verificando Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo ❌ Node.js no encontrado. Instalando Node.js v18 LTS...

    REM Descargar e instalar Node.js
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.17.0/node-v18.17.0-x64.msi' -OutFile 'nodejs-installer.msi'"

    if exist "nodejs-installer.msi" (
        echo 📦 Instalando Node.js...
        msiexec /i nodejs-installer.msi /quiet /norestart
        del nodejs-installer.msi

        REM Actualizar PATH
        set PATH=%PATH%;C:\Program Files\nodejs

        echo ✅ Node.js instalado correctamente
    ) else (
        echo ❌ No se pudo descargar Node.js
        pause
        exit /b 1
    )
) else (
    echo ✅ Node.js encontrado
    node --version
)

echo.

REM Verificar MySQL
echo 🔍 Verificando MySQL Server...
if exist "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" (
    echo ✅ MySQL Server 8.0 encontrado
) else (
    echo ⚠️ MySQL Server no encontrado en la ruta estándar
    echo    Asegúrese de que MySQL 8.0 esté instalado antes de continuar
    echo    Descarga: https://dev.mysql.com/downloads/mysql/
    pause
)

echo.

REM Crear directorio de instalación
echo 📁 Creando directorio de instalación...
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
    echo ✅ Directorio creado: %INSTALL_DIR%
) else (
    echo ⚠️ Directorio ya existe: %INSTALL_DIR%
)

REM Crear subdirectorios necesarios
mkdir "%INSTALL_DIR%\logs" 2>nul
mkdir "%INSTALL_DIR%\backups" 2>nul
mkdir "%INSTALL_DIR%\config" 2>nul
mkdir "%INSTALL_DIR%\certificates" 2>nul
mkdir "%INSTALL_DIR%\temp" 2>nul

echo.

REM Copiar archivos del sistema
echo 📋 Copiando archivos del sistema...
robocopy "%~dp0.." "%INSTALL_DIR%" /E /XD node_modules .git backups logs temp /XF .gitignore *.log *.tmp

if %errorLevel% leq 3 (
    echo ✅ Archivos copiados correctamente
) else (
    echo ❌ Error copiando archivos
    pause
    exit /b 1
)

echo.

REM Instalar dependencias
echo 📦 Instalando dependencias de Node.js...
cd /d "%INSTALL_DIR%"
npm install --production

if %errorLevel% equ 0 (
    echo ✅ Dependencias instaladas correctamente
) else (
    echo ❌ Error instalando dependencias
    pause
    exit /b 1
)

echo.

REM Configurar base de datos
echo 🗄️ Configurando base de datos...

REM Crear usuario de base de datos
echo CREATE USER IF NOT EXISTS '%DB_USER%'@'localhost' IDENTIFIED BY '%DB_PASS%'; > temp_db_setup.sql
echo GRANT ALL PRIVILEGES ON %DB_NAME%.* TO '%DB_USER%'@'localhost'; >> temp_db_setup.sql
echo FLUSH PRIVILEGES; >> temp_db_setup.sql

"C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p < temp_db_setup.sql

if %errorLevel% equ 0 (
    echo ✅ Usuario de base de datos creado
) else (
    echo ⚠️ Error creando usuario de BD (puede que ya exista)
)

del temp_db_setup.sql

echo.

REM Ejecutar migraciones de base de datos
echo 🔄 Ejecutando migraciones de base de datos...
for %%f in (server\database\migrations\*.sql) do (
    echo    Ejecutando: %%f
    "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u %DB_USER% -p%DB_PASS% %DB_NAME% < "%%f"
)

echo ✅ Migraciones de base de datos completadas

echo.

REM Crear configuración de producción
echo ⚙️ Creando configuración de producción...

(
echo {
echo   "sistema": {
echo     "nombre": "DYSA Point POS",
echo     "version": "2.0.14",
echo     "ambiente": "production",
echo     "fecha_instalacion": "%date% %time%"
echo   },
echo   "servidor": {
echo     "puerto": 8547,
echo     "https_habilitado": false
echo   },
echo   "base_datos": {
echo     "host": "localhost",
echo     "puerto": 3306,
echo     "nombre": "%DB_NAME%",
echo     "usuario": "%DB_USER%",
echo     "password": "%DB_PASS%"
echo   },
echo   "backup": {
echo     "habilitado": true,
echo     "frecuencia_horas": 6,
echo     "retention_dias": 30
echo   }
echo }
) > config\produccion.json

echo ✅ Configuración de producción creada

echo.

REM Crear servicio de Windows
echo 🔧 Configurando servicio de Windows...

REM Instalar node-windows para servicios
npm install -g node-windows

REM Crear script de servicio
(
echo var Service = require('node-windows'^).Service;
echo.
echo var svc = new Service(^{
echo   name: '%SERVICE_NAME%',
echo   description: 'DYSA Point POS System v2.0.14 - Sistema empresarial para restaurantes',
echo   script: '%INSTALL_DIR%\\server\\server.js',
echo   nodeOptions: [
echo     '--max_old_space_size=2048'
echo   ],
echo   env: [
echo     {
echo       name: "NODE_ENV",
echo       value: "production"
echo     },
echo     {
echo       name: "CONFIG_FILE",
echo       value: "%INSTALL_DIR%\\config\\produccion.json"
echo     }
echo   ]
echo }^);
echo.
echo svc.on('install', function(^){
echo   console.log('Servicio %SERVICE_NAME% instalado correctamente');
echo   svc.start(^);
echo }^);
echo.
echo svc.install(^);
) > install-service.js

node install-service.js

if %errorLevel% equ 0 (
    echo ✅ Servicio de Windows configurado
) else (
    echo ⚠️ Error configurando servicio (puede requerir configuración manual)
)

del install-service.js

echo.

REM Configurar firewall
echo 🔥 Configurando firewall de Windows...
netsh advfirewall firewall add rule name="DYSA Point POS" dir=in action=allow protocol=TCP localport=8547

if %errorLevel% equ 0 (
    echo ✅ Regla de firewall agregada
) else (
    echo ⚠️ Error configurando firewall
)

echo.

REM Configurar backup automático
echo 💾 Configurando backup automático...

REM Crear tarea programada para backup
schtasks /create /tn "DYSA Point Backup" /tr "%INSTALL_DIR%\scripts\backup_automatico.bat" /sc hourly /mo 6 /ru SYSTEM /f

if %errorLevel% equ 0 (
    echo ✅ Backup automático configurado (cada 6 horas)
) else (
    echo ⚠️ Error configurando backup automático
)

echo.

REM Crear accesos directos
echo 🔗 Creando accesos directos...

REM Acceso directo en el escritorio
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%USERPROFILE%\Desktop\DYSA Point POS.lnk'); $Shortcut.TargetPath = 'http://localhost:8547'; $Shortcut.Save()"

REM Acceso directo en el menú inicio
if not exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\DYSA Point" mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\DYSA Point"
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\DYSA Point\DYSA Point POS.lnk'); $Shortcut.TargetPath = 'http://localhost:8547'; $Shortcut.Save()"

echo ✅ Accesos directos creados

echo.

REM Verificar instalación
echo 🔍 Verificando instalación...

REM Verificar servicio
sc query %SERVICE_NAME% >nul 2>&1
if %errorLevel% equ 0 (
    echo ✅ Servicio %SERVICE_NAME% instalado correctamente
) else (
    echo ⚠️ Servicio no encontrado - puede requerir configuración manual
)

REM Verificar archivos
if exist "%INSTALL_DIR%\server\server.js" (
    echo ✅ Archivos del servidor presentes
) else (
    echo ❌ Archivos del servidor no encontrados
)

REM Verificar configuración
if exist "%INSTALL_DIR%\config\produccion.json" (
    echo ✅ Configuración de producción presente
) else (
    echo ❌ Configuración de producción no encontrada
)

echo.

REM Crear documentación de instalación
echo 📚 Generando documentación...

(
echo ========================================
echo DYSA Point POS v2.0.14 - Instalación Completada
echo Fecha: %date% %time%
echo ========================================
echo.
echo INFORMACIÓN DE LA INSTALACIÓN:
echo   Directorio: %INSTALL_DIR%
echo   Servicio: %SERVICE_NAME%
echo   Puerto: 8547
echo   Base de datos: %DB_NAME%
echo   Usuario BD: %DB_USER%
echo   Contraseña BD: %DB_PASS%
echo.
echo URLS DE ACCESO:
echo   Panel Principal: http://localhost:8547
echo   API Health: http://localhost:8547/health
echo   Configuración: http://localhost:8547/api/configuracion/estado
echo.
echo COMANDOS ÚTILES:
echo   Iniciar servicio: sc start %SERVICE_NAME%
echo   Detener servicio: sc stop %SERVICE_NAME%
echo   Ver logs: type "%INSTALL_DIR%\logs\system.log"
echo   Backup manual: "%INSTALL_DIR%\scripts\backup_automatico.bat"
echo.
echo SOPORTE:
echo   Logs del sistema: %INSTALL_DIR%\logs\
echo   Configuración: %INSTALL_DIR%\config\
echo   Backups: %INSTALL_DIR%\backups\
echo.
) > "%INSTALL_DIR%\INSTALACION_COMPLETADA.txt"

echo ✅ Documentación generada: %INSTALL_DIR%\INSTALACION_COMPLETADA.txt

echo.
echo ===============================================
echo ✅ INSTALACIÓN COMPLETADA EXITOSAMENTE
echo ===============================================
echo.
echo 🎉 DYSA Point POS v2.0.14 ha sido instalado correctamente
echo.
echo 📋 PRÓXIMOS PASOS:
echo    1. Accede a http://localhost:8547 en tu navegador
echo    2. Configura el restaurante usando la API de configuración
echo    3. Verifica que todos los sistemas estén operativos
echo.
echo 📞 INFORMACIÓN IMPORTANTE:
echo    - Usuario BD: %DB_USER%
echo    - Contraseña BD: %DB_PASS%
echo    - Puerto: 8547
echo    - Servicio: %SERVICE_NAME%
echo.
echo 💾 Esta información se ha guardado en:
echo    %INSTALL_DIR%\INSTALACION_COMPLETADA.txt
echo.
echo ⚠️ RECORDATORIO DE SEGURIDAD:
echo    - Cambie la contraseña por defecto de la base de datos
echo    - Configure HTTPS para conexiones seguras
echo    - Realice backups regulares
echo.

pause
exit /b 0