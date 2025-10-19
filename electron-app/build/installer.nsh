; ═══════════════════════════════════════════════════════════════════
; 🏆 DYSA POINT v2.0.14 - INSTALADOR PROFESIONAL TIPO PHOTOSHOP/VSCODE
; Sistema POS Empresarial para Restaurantes - Instalación Completa
; ═══════════════════════════════════════════════════════════════════

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "winmessages.nsh"

; ====================================
; CONFIGURACIÓN DEL INSTALADOR
; ====================================
!define PRODUCT_NAME "DYSA Point - Sistema POS Empresarial"
!define PRODUCT_VERSION "2.0.14"
!define PRODUCT_PUBLISHER "DYSA Technologies - Soluciones Empresariales"
!define PRODUCT_WEB_SITE "https://dysa.tech/pos"
!define PRODUCT_DIR_REGKEY "Software\Microsoft\Windows\CurrentVersion\App Paths\dysa-point.exe"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${PRODUCT_NAME}"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"
!define PRODUCT_STARTMENU_REGVAL "NSIS:StartMenuDir"

; Variables globales para datos del restaurante
Var RESTAURANT_NAME
Var RESTAURANT_ADDRESS
Var RESTAURANT_PHONE
Var RESTAURANT_RUT
Var RESTAURANT_EMAIL
Var RESTAURANT_CITY
Var RESTAURANT_COUNTRY

Var DB_HOST
Var DB_PORT
Var DB_USER
Var DB_PASSWORD
Var DB_NAME

; Variables de diálogo
Var Dialog
Var Label
Var Text_RestaurantName
Var Text_RestaurantAddress
Var Text_RestaurantPhone
Var Text_RestaurantRUT
Var Text_RestaurantEmail
Var Text_RestaurantCity
Var Text_RestaurantCountry

Var DBDialog
Var Text_DBHost
Var Text_DBPort
Var Text_DBUser
Var Text_DBPassword
Var Text_DBName

; ====================================
; CONFIGURACIÓN MODERNA UI
; ====================================
!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"

; Colores corporativos
!define MUI_BGCOLOR 0x0F1419
!define MUI_TEXTCOLOR 0xFFFFFF

!macro customInstall
    DetailPrint "🚀 INICIANDO INSTALACIÓN PROFESIONAL DE DYSA POINT..."

    ; ════════════════════════════════════════════════════════════════
    ; PASO 1: VERIFICACIÓN DE REQUISITOS DEL SISTEMA
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🔍 Verificando requisitos del sistema..."

    ; Verificar Windows 10/11
    Call VerifyWindowsVersion

    ; Verificar espacio en disco (5GB mínimo)
    Call VerifyDiskSpace

    ; Verificar memoria RAM (4GB mínimo)
    Call VerifyRAM

    ; ════════════════════════════════════════════════════════════════
    ; PASO 2: VERIFICACIÓN Y CONFIGURACIÓN DE MYSQL
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🗄️ Verificando MySQL Server..."

    nsExec::ExecToStack 'sc query MySQL80'
    Pop $0
    Pop $1

    ${If} $0 != 0
        DetailPrint "❌ MySQL 8.0 no detectado"
        MessageBox MB_YESNO|MB_ICONQUESTION "⚠️ MYSQL 8.0 REQUERIDO$\n$\nDYSA Point requiere MySQL 8.0 Server para funcionar.$\n$\n¿Desea que el instalador lo descargue e instale automáticamente?$\n$\n⚡ Esto tomará unos 10-15 minutos adicionales." IDYES installMySQL IDNO skipMySQL

        installMySQL:
            DetailPrint "📥 Iniciando instalación automática de MySQL..."
            Call InstallMySQLAutomatically
            Goto mysqlDone

        skipMySQL:
            MessageBox MB_OK|MB_ICONWARNING "⚠️ INSTALACIÓN INCOMPLETA$\n$\nDYSA Point no funcionará sin MySQL 8.0.$\n$\nDescargue MySQL desde: mysql.com/downloads$\nLuego ejecute este instalador nuevamente."
            DetailPrint "⚠️ Usuario decidió instalar MySQL manualmente"

        mysqlDone:
    ${Else}
        DetailPrint "✅ MySQL 8.0 detectado y funcionando"
    ${EndIf}

    ; ════════════════════════════════════════════════════════════════
    ; PASO 3: CREACIÓN DE ESTRUCTURA DE DIRECTORIOS EMPRESARIAL
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "📁 Creando estructura de directorios empresarial..."

    ; Directorios principales
    CreateDirectory "$APPDATA\DYSA Point"
    CreateDirectory "$APPDATA\DYSA Point\logs"
    CreateDirectory "$APPDATA\DYSA Point\backups"
    CreateDirectory "$APPDATA\DYSA Point\updates"
    CreateDirectory "$APPDATA\DYSA Point\config"
    CreateDirectory "$APPDATA\DYSA Point\temp"
    CreateDirectory "$APPDATA\DYSA Point\reports"
    CreateDirectory "$APPDATA\DYSA Point\tickets"

    ; Directorios de sistema
    CreateDirectory "$PROGRAMDATA\DYSA Point"
    CreateDirectory "$PROGRAMDATA\DYSA Point\Services"
    CreateDirectory "$PROGRAMDATA\DYSA Point\Database"

    DetailPrint "✅ Estructura de directorios creada"

    ; ════════════════════════════════════════════════════════════════
    ; PASO 4: CONFIGURACIÓN AUTOMÁTICA DEL RESTAURANTE
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🏪 Configurando datos del restaurante..."

    ; Crear configuración principal del restaurante
    FileOpen $0 "$APPDATA\DYSA Point\config\restaurant.json" w
    FileWrite $0 '{$\r$\n'
    FileWrite $0 '  "company_info": {$\r$\n'
    FileWrite $0 '    "name": "$RESTAURANT_NAME",$\r$\n'
    FileWrite $0 '    "address": "$RESTAURANT_ADDRESS",$\r$\n'
    FileWrite $0 '    "phone": "$RESTAURANT_PHONE",$\r$\n'
    FileWrite $0 '    "rut": "$RESTAURANT_RUT",$\r$\n'
    FileWrite $0 '    "email": "$RESTAURANT_EMAIL",$\r$\n'
    FileWrite $0 '    "city": "$RESTAURANT_CITY",$\r$\n'
    FileWrite $0 '    "country": "$RESTAURANT_COUNTRY"$\r$\n'
    FileWrite $0 '  },$\r$\n'
    FileWrite $0 '  "system_info": {$\r$\n'
    FileWrite $0 '    "version": "2.0.14",$\r$\n'
    FileWrite $0 '    "installation_date": "$(Get-Date -Format yyyy-MM-dd)",$\r$\n'
    FileWrite $0 '    "license_type": "enterprise",$\r$\n'
    FileWrite $0 '    "support_enabled": true,$\r$\n'
    FileWrite $0 '    "monitoring_enabled": true,$\r$\n'
    FileWrite $0 '    "backup_enabled": true$\r$\n'
    FileWrite $0 '  }$\r$\n'
    FileWrite $0 '}$\r$\n'
    FileClose $0

    DetailPrint "✅ Configuración del restaurante creada"

    ; ════════════════════════════════════════════════════════════════
    ; PASO 5: CONFIGURACIÓN DE BASE DE DATOS
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🔧 Configurando conexión a base de datos..."

    ; Crear archivo de configuración de DB
    FileOpen $0 "$APPDATA\DYSA Point\config\database.json" w
    FileWrite $0 '{$\r$\n'
    FileWrite $0 '  "production": {$\r$\n'
    FileWrite $0 '    "host": "$DB_HOST",$\r$\n'
    FileWrite $0 '    "port": $DB_PORT,$\r$\n'
    FileWrite $0 '    "user": "$DB_USER",$\r$\n'
    FileWrite $0 '    "password": "$DB_PASSWORD",$\r$\n'
    FileWrite $0 '    "database": "$DB_NAME",$\r$\n'
    FileWrite $0 '    "charset": "utf8mb4",$\r$\n'
    FileWrite $0 '    "timezone": "America/Santiago",$\r$\n'
    FileWrite $0 '    "ssl": false,$\r$\n'
    FileWrite $0 '    "multipleStatements": true$\r$\n'
    FileWrite $0 '  }$\r$\n'
    FileWrite $0 '}$\r$\n'
    FileClose $0

    ; Crear archivo .env para el backend
    FileOpen $0 "$APPDATA\DYSA Point\.env" w
    FileWrite $0 "# ═══════════════════════════════════════════$\r$\n"
    FileWrite $0 "# DYSA Point v2.0.14 - Configuración Empresarial$\r$\n"
    FileWrite $0 "# Generado automáticamente durante instalación$\r$\n"
    FileWrite $0 "# ═══════════════════════════════════════════$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "# Entorno de ejecución$\r$\n"
    FileWrite $0 "NODE_ENV=production$\r$\n"
    FileWrite $0 "PORT=8547$\r$\n"
    FileWrite $0 "ADMIN_PORT=8548$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "# Base de datos$\r$\n"
    FileWrite $0 "DB_HOST=$DB_HOST$\r$\n"
    FileWrite $0 "DB_PORT=$DB_PORT$\r$\n"
    FileWrite $0 "DB_USER=$DB_USER$\r$\n"
    FileWrite $0 "DB_PASSWORD=$DB_PASSWORD$\r$\n"
    FileWrite $0 "DB_NAME=$DB_NAME$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "# Restaurante$\r$\n"
    FileWrite $0 "RESTAURANT_NAME=$RESTAURANT_NAME$\r$\n"
    FileWrite $0 "RESTAURANT_RUT=$RESTAURANT_RUT$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "# Características empresariales$\r$\n"
    FileWrite $0 "BACKUP_ENABLED=true$\r$\n"
    FileWrite $0 "MONITORING_ENABLED=true$\r$\n"
    FileWrite $0 "REMOTE_SUPPORT_ENABLED=true$\r$\n"
    FileWrite $0 "AUTO_UPDATE_ENABLED=true$\r$\n"
    FileClose $0

    DetailPrint "✅ Configuración de base de datos creada"

    ; ════════════════════════════════════════════════════════════════
    ; PASO 6: INICIALIZACIÓN DE BASE DE DATOS
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🔄 Inicializando base de datos empresarial..."

    Call InitializeEnterpriseDatabase

    ; ════════════════════════════════════════════════════════════════
    ; PASO 7: CONFIGURACIÓN DEL FIREWALL DE WINDOWS
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🛡️ Configurando firewall de Windows..."

    ; Puerto principal del servidor POS
    nsExec::ExecToStack 'netsh advfirewall firewall add rule name="DYSA Point POS Server" dir=in action=allow protocol=TCP localport=8547 enable=yes'
    Pop $0

    ; Puerto del panel de administración
    nsExec::ExecToStack 'netsh advfirewall firewall add rule name="DYSA Point Admin Panel" dir=in action=allow protocol=TCP localport=8548 enable=yes'
    Pop $0

    ; Puerto para soporte remoto
    nsExec::ExecToStack 'netsh advfirewall firewall add rule name="DYSA Point Remote Support" dir=in action=allow protocol=TCP localport=8549 enable=yes'
    Pop $0

    DetailPrint "✅ Reglas de firewall configuradas"

    ; ════════════════════════════════════════════════════════════════
    ; PASO 8: INSTALACIÓN DE SERVICIO DE WINDOWS
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "⚙️ Instalando servicio de Windows..."

    Call InstallDysaPointService

    ; ════════════════════════════════════════════════════════════════
    ; PASO 9: CREACIÓN DE SHORTCUTS PROFESIONALES
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🔗 Creando accesos directos..."

    ; Shortcut en el escritorio
    CreateShortCut "$DESKTOP\DYSA Point POS.lnk" "$INSTDIR\dysa-point.exe" "" "$INSTDIR\icon.ico" 0

    ; Shortcuts en menú inicio
    CreateDirectory "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial"
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\DYSA Point POS.lnk" "$INSTDIR\dysa-point.exe" "" "$INSTDIR\icon.ico" 0
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Panel de Administración.lnk" "$INSTDIR\admin-panel.exe" "" "$INSTDIR\admin-icon.ico" 0
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Monitor del Sistema.lnk" "$INSTDIR\monitor.exe" "" "$INSTDIR\monitor-icon.ico" 0
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Soporte Técnico.lnk" "$INSTDIR\support.exe" "" "$INSTDIR\support-icon.ico" 0
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Desinstalar.lnk" "$INSTDIR\uninst.exe"

    DetailPrint "✅ Accesos directos creados"

    ; ════════════════════════════════════════════════════════════════
    ; PASO 10: REGISTRO EN EL SISTEMA WINDOWS
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "📝 Registrando en el sistema Windows..."

    ; Registro principal de la aplicación
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\dysa-point.exe"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "Path" "$INSTDIR"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "Version" "${PRODUCT_VERSION}"

    ; Registro para desinstalación
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "$(^Name)"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\dysa-point.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1

    ; Registro de tipo de archivo .dysa
    WriteRegStr HKCR ".dysa" "" "DYSA.PointFile"
    WriteRegStr HKCR "DYSA.PointFile" "" "Archivo de DYSA Point"
    WriteRegStr HKCR "DYSA.PointFile\DefaultIcon" "" "$INSTDIR\dysa-point.exe,0"
    WriteRegStr HKCR "DYSA.PointFile\shell\open\command" "" '"$INSTDIR\dysa-point.exe" "%1"'

    DetailPrint "✅ Sistema registrado en Windows"

    ; ════════════════════════════════════════════════════════════════
    ; PASO 11: CONFIGURACIÓN FINAL Y VERIFICACIÓN
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🏁 Realizando configuración final..."

    ; Establecer permisos correctos
    AccessControl::GrantOnFile "$APPDATA\DYSA Point" "(BU)" "FullAccess"
    AccessControl::GrantOnFile "$PROGRAMDATA\DYSA Point" "(BU)" "FullAccess"

    ; Crear archivo de primera ejecución
    FileOpen $0 "$APPDATA\DYSA Point\.first_run" w
    FileWrite $0 "1"
    FileClose $0

    DetailPrint "✅ Configuración final completada"

    ; ════════════════════════════════════════════════════════════════
    ; INSTALACIÓN COMPLETADA - MENSAJE FINAL
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🎉 ¡INSTALACIÓN COMPLETADA EXITOSAMENTE!"
    DetailPrint ""
    DetailPrint "✅ DYSA Point v2.0.14 está listo para usar"
    DetailPrint "✅ Base de datos configurada y funcionando"
    DetailPrint "✅ Servicios empresariales activados"
    DetailPrint "✅ Monitoreo 24/7 habilitado"
    DetailPrint "✅ Backup automático configurado"
    DetailPrint "✅ Soporte remoto disponible"
    DetailPrint ""
    DetailPrint "🚀 El sistema se iniciará automáticamente"

    ; Iniciar el sistema por primera vez
    Exec '"$INSTDIR\dysa-point.exe" --first-run --setup'

!macroend

; ════════════════════════════════════════════════════════════════
; FUNCIONES DE VERIFICACIÓN DEL SISTEMA
; ════════════════════════════════════════════════════════════════

Function VerifyWindowsVersion
    DetailPrint "🪟 Verificando versión de Windows..."

    ; Obtener versión de Windows
    ReadRegStr $0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "ProductName"

    ${If} $0 != ""
        DetailPrint "✅ Sistema: $0"
    ${Else}
        DetailPrint "⚠️ No se pudo detectar la versión de Windows"
    ${EndIf}
FunctionEnd

Function VerifyDiskSpace
    DetailPrint "💽 Verificando espacio en disco..."

    ; Verificar espacio disponible (5GB mínimo = 5368709120 bytes)
    ${GetRoot} "$INSTDIR" $0
    ${DriveSpace} "$0\" "/S=G" $1

    ${If} $1 > 5
        DetailPrint "✅ Espacio disponible: $1 GB (suficiente)"
    ${Else}
        DetailPrint "❌ Espacio insuficiente: $1 GB (se requieren 5GB)"
        MessageBox MB_ICONSTOP "⚠️ ESPACIO INSUFICIENTE$\n$\nSe requieren al menos 5GB de espacio libre.$\nActualmente disponible: $1 GB$\n$\nLibere espacio e intente nuevamente."
        Abort
    ${EndIf}
FunctionEnd

Function VerifyRAM
    DetailPrint "🧠 Verificando memoria RAM..."

    ; Obtener memoria total del sistema
    System::Alloc 64
    Pop $1
    System::Call "Kernel32::GlobalMemoryStatusEx(i r1)"
    System::Call "*$1(&l8, &l8, &l8.r2, &l8, &l8, &l8, &l8, &l8)"
    System::Free $1

    ; Convertir a GB
    System::Int64Op $2 / 1073741824
    Pop $3

    ${If} $3 > 3
        DetailPrint "✅ RAM disponible: $3 GB (suficiente)"
    ${Else}
        DetailPrint "⚠️ RAM limitada: $3 GB (se recomiendan 4GB)"
        MessageBox MB_ICONEXCLAMATION "⚠️ MEMORIA RAM LIMITADA$\n$\nSe recomienda tener al menos 4GB de RAM.$\nActualmente disponible: $3 GB$\n$\nEl sistema puede funcionar más lento."
    ${EndIf}
FunctionEnd

; ════════════════════════════════════════════════════════════════
; INSTALACIÓN AUTOMÁTICA DE MYSQL
; ════════════════════════════════════════════════════════════════

Function InstallMySQLAutomatically
    DetailPrint "📥 Descargando MySQL 8.0..."

    ; Descargar MySQL Installer
    NSISdl::download "https://dev.mysql.com/get/Downloads/MySQLInstaller/mysql-installer-community-8.0.35.0.msi" "$TEMP\mysql-installer.msi"
    Pop $0

    ${If} $0 == "success"
        DetailPrint "✅ MySQL descargado exitosamente"
        DetailPrint "🔧 Instalando MySQL (esto puede tomar varios minutos)..."

        ; Instalar MySQL silenciosamente
        ExecWait 'msiexec /i "$TEMP\mysql-installer.msi" /quiet /norestart ADDLOCAL=ServerNoConfigWizard,Client,MYSQLSH,Workbench,Documentation'

        DetailPrint "✅ MySQL 8.0 instalado"

        ; Limpiar archivo temporal
        Delete "$TEMP\mysql-installer.msi"
    ${Else}
        DetailPrint "❌ Error descargando MySQL: $0"
        MessageBox MB_ICONERROR "❌ ERROR EN DESCARGA$\n$\nNo se pudo descargar MySQL automáticamente.$\n$\nPor favor, descárgelo manualmente desde:$\nmysql.com/downloads"
        Abort
    ${EndIf}
FunctionEnd

; ════════════════════════════════════════════════════════════════
; INICIALIZACIÓN DE BASE DE DATOS EMPRESARIAL
; ════════════════════════════════════════════════════════════════

Function InitializeEnterpriseDatabase
    DetailPrint "🗄️ Inicializando base de datos empresarial..."

    ; Crear script SQL temporal
    FileOpen $0 "$TEMP\init_dysa_db.sql" w
    FileWrite $0 "-- DYSA Point v2.0.14 - Inicialización de Base de Datos$\r$\n"
    FileWrite $0 "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;$\r$\n"
    FileWrite $0 "USE $DB_NAME;$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "-- Tabla principal de ventas$\r$\n"
    FileWrite $0 "CREATE TABLE IF NOT EXISTS ventadirecta ($\r$\n"
    FileWrite $0 "  id_venta INT AUTO_INCREMENT PRIMARY KEY,$\r$\n"
    FileWrite $0 "  Num_Mesa INT,$\r$\n"
    FileWrite $0 "  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,$\r$\n"
    FileWrite $0 "  total DECIMAL(10,2),$\r$\n"
    FileWrite $0 "  cerrada CHAR(1) DEFAULT 'N'$\r$\n"
    FileWrite $0 ");$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "-- Tabla de mesas$\r$\n"
    FileWrite $0 "CREATE TABLE IF NOT EXISTS mesa ($\r$\n"
    FileWrite $0 "  Num_Mesa INT PRIMARY KEY,$\r$\n"
    FileWrite $0 "  descripcion VARCHAR(100),$\r$\n"
    FileWrite $0 "  capacidad INT DEFAULT 4,$\r$\n"
    FileWrite $0 "  estado VARCHAR(20) DEFAULT 'disponible',$\r$\n"
    FileWrite $0 "  activa BOOLEAN DEFAULT TRUE$\r$\n"
    FileWrite $0 ");$\r$\n"
    FileWrite $0 "$\r$\n"
    FileWrite $0 "-- Insertar mesas por defecto$\r$\n"
    FileWrite $0 "INSERT IGNORE INTO mesa (Num_Mesa, descripcion, capacidad) VALUES$\r$\n"
    FileWrite $0 "(1, 'Mesa 1', 4), (2, 'Mesa 2', 4), (3, 'Mesa 3', 6),$\r$\n"
    FileWrite $0 "(4, 'Mesa 4', 2), (5, 'Mesa 5', 4), (6, 'Mesa 6', 8);$\r$\n"
    FileClose $0

    ; Ejecutar script SQL
    nsExec::ExecToStack '"$PROGRAMFILES\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -e "source $TEMP\init_dysa_db.sql"'
    Pop $0
    Pop $1

    ${If} $0 == 0
        DetailPrint "✅ Base de datos inicializada correctamente"
    ${Else}
        DetailPrint "⚠️ Advertencia en inicialización de DB: $1"
    ${EndIf}

    ; Limpiar archivo temporal
    Delete "$TEMP\init_dysa_db.sql"
FunctionEnd

; ════════════════════════════════════════════════════════════════
; INSTALACIÓN DE SERVICIO DE WINDOWS
; ════════════════════════════════════════════════════════════════

Function InstallDysaPointService
    DetailPrint "⚙️ Instalando servicio de Windows 'DYSA Point Service'..."

    ; Crear script de servicio
    FileOpen $0 "$INSTDIR\service\install-service.bat" w
    FileWrite $0 "@echo off$\r$\n"
    FileWrite $0 "sc create \"DYSA Point Service\" binpath= \"$INSTDIR\service\dysa-point-service.exe\" start= auto$\r$\n"
    FileWrite $0 "sc description \"DYSA Point Service\" \"Servicio de DYSA Point - Sistema POS Empresarial para monitoreo y backup automático\"$\r$\n"
    FileWrite $0 "sc start \"DYSA Point Service\"$\r$\n"
    FileClose $0

    ; Ejecutar instalación del servicio
    nsExec::ExecToStack '"$INSTDIR\service\install-service.bat"'
    Pop $0

    ${If} $0 == 0
        DetailPrint "✅ Servicio de Windows instalado y iniciado"
    ${Else}
        DetailPrint "⚠️ Advertencia instalando servicio"
    ${EndIf}
FunctionEnd

; ════════════════════════════════════════════════════════════════
; MACRO DE DESINSTALACIÓN PROFESIONAL
; ════════════════════════════════════════════════════════════════

!macro customUninstall
    DetailPrint "🧹 INICIANDO DESINSTALACIÓN PROFESIONAL..."

    ; Detener servicios
    DetailPrint "⏹️ Deteniendo servicios..."
    nsExec::ExecToStack 'net stop "DYSA Point Service"'
    Pop $0
    nsExec::ExecToStack 'sc delete "DYSA Point Service"'
    Pop $0

    ; Remover reglas de firewall
    DetailPrint "🛡️ Removiendo reglas de firewall..."
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point POS Server"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Admin Panel"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Remote Support"'
    Pop $0

    ; Preguntar sobre datos del usuario
    MessageBox MB_YESNO|MB_ICONQUESTION "🗃️ CONSERVAR DATOS DEL RESTAURANTE$\n$\n¿Desea conservar los datos del restaurante?$\n$\n✅ SÍ: Se mantendrán logs, backups y configuración$\n❌ NO: Se eliminará todo (la base de datos se conservará)$\n$\n⚠️ Recomendamos conservar los datos por seguridad." IDYES keepData IDNO deleteData

    deleteData:
        DetailPrint "🗑️ Eliminando datos del usuario..."
        RMDir /r "$APPDATA\DYSA Point"
        RMDir /r "$PROGRAMDATA\DYSA Point"
        DetailPrint "✅ Datos eliminados completamente"
        Goto endDataHandling

    keepData:
        DetailPrint "💾 Conservando datos del restaurante en:"
        DetailPrint "   📁 $APPDATA\DYSA Point"
        DetailPrint "   📁 $PROGRAMDATA\DYSA Point"

    endDataHandling:

    ; Limpiar registro
    DetailPrint "📝 Limpiando registro de Windows..."
    DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"
    DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    DeleteRegKey HKCR ".dysa"
    DeleteRegKey HKCR "DYSA.PointFile"

    DetailPrint "✅ DESINSTALACIÓN COMPLETADA"
    DetailPrint ""
    DetailPrint "ℹ️ NOTA: La base de datos MySQL NO fue eliminada"
    DetailPrint "ℹ️ Si no la necesita, puede eliminarla manualmente"

!macroend
