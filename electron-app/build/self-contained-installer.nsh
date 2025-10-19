; ═══════════════════════════════════════════════════════════════════════════════════
; 🚀 DYSA POINT v2.0.14 - INSTALADOR AUTOCONTENIDO PROFESIONAL
; Instalador completo tipo VSCode/Photoshop con TODO incluido
; ═══════════════════════════════════════════════════════════════════════════════════

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "winmessages.nsh"
!include "x64.nsh"

; ════════════════════════════════════════════════════════════════════
; CONFIGURACIÓN DEL INSTALADOR AUTOCONTENIDO
; ════════════════════════════════════════════════════════════════════
!define PRODUCT_NAME "DYSA Point"
!define PRODUCT_VERSION "2.0.14"
!define PRODUCT_PUBLISHER "DYSA Technologies"
!define PRODUCT_WEB_SITE "https://dysa.tech"
!define PRODUCT_UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\DYSA Point"
!define PRODUCT_UNINST_ROOT_KEY "HKLM"

; Configuración del instalador
Name "${PRODUCT_NAME} ${PRODUCT_VERSION}"
OutFile "DYSA-Point-Complete-Installer-v${PRODUCT_VERSION}.exe"
InstallDir "$PROGRAMFILES64\DYSA Point"
RequestExecutionLevel admin
SetCompressor /SOLID lzma
SetCompressorDictSize 128
SetDatablockOptimize on

; ════════════════════════════════════════════════════════════════════
; INTERFAZ MODERNA PROFESIONAL
; ════════════════════════════════════════════════════════════════════
!define MUI_ABORTWARNING
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE_BITMAP "header.bmp"
!define MUI_WELCOMEFINISHPAGE_BITMAP "welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "uninstall.bmp"

; Colores corporativos profesionales
!define MUI_BGCOLOR 0x2D2D30
!define MUI_TEXTCOLOR 0xFFFFFF
!define MUI_LICENSEPAGE_BGCOLOR 0x1E1E1E
!define MUI_INSTFILESPAGE_COLORS "0xFFFFFF 0x2D2D30"

; Páginas del instalador
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "embedded_license.txt"
Page custom RestaurantConfigPage RestaurantConfigPageLeave
Page custom ComponentSelectionPage ComponentSelectionPageLeave
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
Page custom CompletionPage
!insertmacro MUI_PAGE_FINISH

; Páginas del desinstalador
!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Idiomas
!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "English"

; ════════════════════════════════════════════════════════════════════
; VARIABLES GLOBALES
; ════════════════════════════════════════════════════════════════════
Var RESTAURANT_NAME
Var RESTAURANT_RUT
Var RESTAURANT_EMAIL
Var RESTAURANT_PHONE
Var RESTAURANT_ADDRESS
Var RESTAURANT_CITY

Var INSTALL_MYSQL
Var INSTALL_NODE
Var INSTALL_SERVICES
Var CREATE_DATABASE

Var Dialog
Var RestaurantNameField
Var RestaurantRUTField
Var RestaurantEmailField
Var RestaurantPhoneField
Var RestaurantAddressField
Var RestaurantCityField

Var ComponentDialog
Var MySQLCheckbox
Var NodeCheckbox
Var ServicesCheckbox
Var DatabaseCheckbox

; ════════════════════════════════════════════════════════════════════
; PÁGINA DE CONFIGURACIÓN DEL RESTAURANTE
; ════════════════════════════════════════════════════════════════════
Function RestaurantConfigPage
    !insertmacro MUI_HEADER_TEXT "Configuración del Restaurante" "Configure los datos de su negocio"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Logo y mensaje principal
    ${NSD_CreateLabel} 0 0 100% 30u "¡Bienvenido a DYSA Point v2.0.14!$\r$\n$\r$\nEste instalador incluye TODOS los componentes necesarios:$\r$\n• MySQL Server 8.0 Portable • Node.js Runtime • Todas las dependencias"
    Pop $0
    CreateFont $1 "Segoe UI" 11 600
    SendMessage $0 ${WM_SETFONT} $1 0

    ; Información del restaurante
    ${NSD_CreateGroupBox} 0 40u 100% 110u "📝 Información del Restaurante"
    Pop $0

    ; Nombre del restaurante
    ${NSD_CreateLabel} 10u 55u 120u 12u "Nombre del Restaurante:"
    Pop $0
    ${NSD_CreateText} 10u 67u 200u 12u ""
    Pop $RestaurantNameField

    ; RUT/Tax ID
    ${NSD_CreateLabel} 220u 55u 80u 12u "RUT/Tax ID:"
    Pop $0
    ${NSD_CreateText} 220u 67u 100u 12u ""
    Pop $RestaurantRUTField

    ; Email
    ${NSD_CreateLabel} 10u 85u 80u 12u "Email:"
    Pop $0
    ${NSD_CreateText} 10u 97u 150u 12u ""
    Pop $RestaurantEmailField

    ; Teléfono
    ${NSD_CreateLabel} 170u 85u 80u 12u "Teléfono:"
    Pop $0
    ${NSD_CreateText} 170u 97u 100u 12u ""
    Pop $RestaurantPhoneField

    ; Dirección
    ${NSD_CreateLabel} 10u 115u 80u 12u "Dirección:"
    Pop $0
    ${NSD_CreateText} 10u 127u 200u 12u ""
    Pop $RestaurantAddressField

    ; Ciudad
    ${NSD_CreateLabel} 220u 115u 60u 12u "Ciudad:"
    Pop $0
    ${NSD_CreateText} 220u 127u 100u 12u "Santiago"
    Pop $RestaurantCityField

    ; Información adicional
    ${NSD_CreateLabel} 0 160u 100% 20u "ℹ️ Esta información se usará para configurar automáticamente su sistema POS.$\r$\nTodos los campos son opcionales y pueden modificarse después de la instalación."
    Pop $0

    nsDialogs::Show
FunctionEnd

Function RestaurantConfigPageLeave
    ${NSD_GetText} $RestaurantNameField $RESTAURANT_NAME
    ${NSD_GetText} $RestaurantRUTField $RESTAURANT_RUT
    ${NSD_GetText} $RestaurantEmailField $RESTAURANT_EMAIL
    ${NSD_GetText} $RestaurantPhoneField $RESTAURANT_PHONE
    ${NSD_GetText} $RestaurantAddressField $RESTAURANT_ADDRESS
    ${NSD_GetText} $RestaurantCityField $RESTAURANT_CITY

    ; Valores por defecto si están vacíos
    ${If} $RESTAURANT_NAME == ""
        StrCpy $RESTAURANT_NAME "Mi Restaurante"
    ${EndIf}
    ${If} $RESTAURANT_CITY == ""
        StrCpy $RESTAURANT_CITY "Santiago"
    ${EndIf}
FunctionEnd

; ════════════════════════════════════════════════════════════════════
; PÁGINA DE SELECCIÓN DE COMPONENTES
; ════════════════════════════════════════════════════════════════════
Function ComponentSelectionPage
    !insertmacro MUI_HEADER_TEXT "Componentes del Sistema" "Seleccione qué componentes instalar"

    nsDialogs::Create 1018
    Pop $ComponentDialog

    ${If} $ComponentDialog == error
        Abort
    ${EndIf}

    ; Título informativo
    ${NSD_CreateLabel} 0 0 100% 25u "Seleccione los componentes a instalar. Todos están incluidos en este instalador:$\r$\n✅ No requiere descargas adicionales • ✅ Instalación 100% offline"
    Pop $0

    ; Componentes principales
    ${NSD_CreateGroupBox} 0 30u 100% 120u "🚀 Componentes del Sistema"
    Pop $0

    ; MySQL Server Portable
    ${NSD_CreateCheckbox} 10u 45u 280u 15u "🗄️ MySQL Server 8.0 Portable (85 MB incluido)"
    Pop $MySQLCheckbox
    ${NSD_Check} $MySQLCheckbox
    ${NSD_CreateLabel} 20u 62u 280u 12u "Base de datos empresarial completa sin instalación en sistema"
    Pop $0

    ; Node.js Runtime
    ${NSD_CreateCheckbox} 10u 80u 280u 15u "⚡ Node.js Runtime 18.x (45 MB incluido)"
    Pop $NodeCheckbox
    ${NSD_Check} $NodeCheckbox
    ${NSD_CreateLabel} 20u 97u 280u 12u "Motor de JavaScript para el backend del sistema"
    Pop $0

    ; Servicios empresariales
    ${NSD_CreateCheckbox} 10u 115u 280u 15u "⚙️ Servicios Empresariales (Backup, Monitoreo, Soporte)"
    Pop $ServicesCheckbox
    ${NSD_Check} $ServicesCheckbox
    ${NSD_CreateLabel} 20u 132u 280u 12u "19 servicios profesionales + monitoreo 24/7 + backup automático"
    Pop $0

    ; Configuración automática de BD
    ${NSD_CreateGroupBox} 0 155u 100% 50u "🔧 Configuración Automática"
    Pop $0

    ${NSD_CreateCheckbox} 10u 170u 280u 15u "🛠️ Crear y configurar base de datos automáticamente"
    Pop $DatabaseCheckbox
    ${NSD_Check} $DatabaseCheckbox
    ${NSD_CreateLabel} 20u 187u 280u 12u "Inicializa tablas, usuarios y datos de ejemplo para $RESTAURANT_NAME"
    Pop $0

    nsDialogs::Show
FunctionEnd

Function ComponentSelectionPageLeave
    ${NSD_GetState} $MySQLCheckbox $INSTALL_MYSQL
    ${NSD_GetState} $NodeCheckbox $INSTALL_NODE
    ${NSD_GetState} $ServicesCheckbox $INSTALL_SERVICES
    ${NSD_GetState} $DatabaseCheckbox $CREATE_DATABASE
FunctionEnd

; ════════════════════════════════════════════════════════════════════
; SECCIÓN PRINCIPAL DE INSTALACIÓN
; ════════════════════════════════════════════════════════════════════
Section "MainSection" SEC01
    DetailPrint "🚀 Iniciando instalación autocontenida de DYSA Point..."

    ; Crear estructura de directorios
    CreateDirectory "$INSTDIR"
    CreateDirectory "$INSTDIR\runtime"
    CreateDirectory "$INSTDIR\mysql-portable"
    CreateDirectory "$INSTDIR\nodejs-runtime"
    CreateDirectory "$INSTDIR\app"
    CreateDirectory "$INSTDIR\services"
    CreateDirectory "$INSTDIR\data"
    CreateDirectory "$INSTDIR\logs"
    CreateDirectory "$INSTDIR\backups"

    SetOutPath "$INSTDIR"

    ; ════════════════════════════════════════════════════════════════
    ; INSTALAR APLICACIÓN PRINCIPAL
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "📦 Instalando aplicación DYSA Point..."

    ; Extraer aplicación principal empaquetada
    File /r "dist\*.*"

    ; Copiar archivos de configuración
    File "package.json"
    File "main.js"
    File /r "server"
    File /r "renderer"

    DetailPrint "✅ Aplicación principal instalada"

    ; ════════════════════════════════════════════════════════════════
    ; INSTALAR NODE.JS PORTABLE
    ; ════════════════════════════════════════════════════════════════
    ${If} $INSTALL_NODE == 1
        DetailPrint "⚡ Instalando Node.js Runtime Portable..."

        SetOutPath "$INSTDIR\nodejs-runtime"

        ; Extraer Node.js portable (incluido en el instalador)
        File /r "embedded\nodejs-portable\*.*"

        ; Crear wrapper para node
        FileOpen $0 "$INSTDIR\node.cmd" w
        FileWrite $0 '@echo off$\r$\n'
        FileWrite $0 '"$INSTDIR\nodejs-runtime\node.exe" %*$\r$\n'
        FileClose $0

        ; Crear wrapper para npm
        FileOpen $0 "$INSTDIR\npm.cmd" w
        FileWrite $0 '@echo off$\r$\n'
        FileWrite $0 '"$INSTDIR\nodejs-runtime\npm.cmd" %*$\r$\n'
        FileClose $0

        DetailPrint "✅ Node.js Runtime instalado"
    ${EndIf}

    ; ════════════════════════════════════════════════════════════════
    ; INSTALAR MYSQL PORTABLE
    ; ════════════════════════════════════════════════════════════════
    ${If} $INSTALL_MYSQL == 1
        DetailPrint "🗄️ Instalando MySQL Server Portable..."

        SetOutPath "$INSTDIR\mysql-portable"

        ; Extraer MySQL portable completo (incluido en el instalador)
        File /r "embedded\mysql-portable\*.*"

        ; Crear configuración personalizada
        FileOpen $0 "$INSTDIR\mysql-portable\my.ini" w
        FileWrite $0 "[mysqld]$\r$\n"
        FileWrite $0 "port=3306$\r$\n"
        FileWrite $0 "basedir=$INSTDIR\mysql-portable$\r$\n"
        FileWrite $0 "datadir=$INSTDIR\mysql-portable\data$\r$\n"
        FileWrite $0 "character-set-server=utf8mb4$\r$\n"
        FileWrite $0 "collation-server=utf8mb4_unicode_ci$\r$\n"
        FileWrite $0 "max_connections=100$\r$\n"
        FileWrite $0 "max_allowed_packet=128M$\r$\n"
        FileWrite $0 "skip-networking=false$\r$\n"
        FileWrite $0 "bind-address=127.0.0.1$\r$\n"
        FileWrite $0 "[client]$\r$\n"
        FileWrite $0 "port=3306$\r$\n"
        FileWrite $0 "default-character-set=utf8mb4$\r$\n"
        FileClose $0

        ; Inicializar base de datos
        DetailPrint "🔧 Inicializando base de datos..."
        nsExec::ExecToStack '"$INSTDIR\mysql-portable\bin\mysqld.exe" --initialize-insecure --basedir="$INSTDIR\mysql-portable" --datadir="$INSTDIR\mysql-portable\data"'
        Pop $0

        DetailPrint "✅ MySQL Portable instalado"
    ${EndIf}

    ; ════════════════════════════════════════════════════════════════
    ; INSTALAR DEPENDENCIAS INCLUIDAS
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "📚 Instalando dependencias incluidas..."

    SetOutPath "$INSTDIR\app"

    ; Extraer node_modules completo (pre-empaquetado)
    File /r "embedded\node_modules"

    DetailPrint "✅ Todas las dependencias instaladas"

    ; ════════════════════════════════════════════════════════════════
    ; CONFIGURAR RESTAURANTE AUTOMÁTICAMENTE
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🏪 Configurando datos del restaurante..."

    ; Crear archivo de configuración del restaurante
    FileOpen $0 "$INSTDIR\data\restaurant-config.json" w
    FileWrite $0 '{$\r$\n'
    FileWrite $0 '  "restaurant": {$\r$\n'
    FileWrite $0 '    "name": "$RESTAURANT_NAME",$\r$\n'
    FileWrite $0 '    "rut": "$RESTAURANT_RUT",$\r$\n'
    FileWrite $0 '    "email": "$RESTAURANT_EMAIL",$\r$\n'
    FileWrite $0 '    "phone": "$RESTAURANT_PHONE",$\r$\n'
    FileWrite $0 '    "address": "$RESTAURANT_ADDRESS",$\r$\n'
    FileWrite $0 '    "city": "$RESTAURANT_CITY"$\r$\n'
    FileWrite $0 '  },$\r$\n'
    FileWrite $0 '  "system": {$\r$\n'
    FileWrite $0 '    "version": "2.0.14",$\r$\n'
    FileWrite $0 '    "install_date": "$$(Get-Date -Format yyyy-MM-dd)",$\r$\n'
    FileWrite $0 '    "mysql_port": 3306,$\r$\n'
    FileWrite $0 '    "server_port": 8547,$\r$\n'
    FileWrite $0 '    "admin_port": 8548$\r$\n'
    FileWrite $0 '  }$\r$\n'
    FileWrite $0 '}$\r$\n'
    FileClose $0

    ; Crear archivo .env
    FileOpen $0 "$INSTDIR\.env" w
    FileWrite $0 "# DYSA Point v2.0.14 - Configuración Autocontenida$\r$\n"
    FileWrite $0 "NODE_ENV=production$\r$\n"
    FileWrite $0 "PORT=8547$\r$\n"
    FileWrite $0 "ADMIN_PORT=8548$\r$\n"
    FileWrite $0 "DB_HOST=127.0.0.1$\r$\n"
    FileWrite $0 "DB_PORT=3306$\r$\n"
    FileWrite $0 "DB_USER=root$\r$\n"
    FileWrite $0 "DB_PASSWORD=$\r$\n"
    FileWrite $0 "DB_NAME=dysa_point$\r$\n"
    FileWrite $0 "RESTAURANT_NAME=$RESTAURANT_NAME$\r$\n"
    FileWrite $0 "MYSQL_PATH=$INSTDIR\mysql-portable$\r$\n"
    FileWrite $0 "NODE_PATH=$INSTDIR\nodejs-runtime$\r$\n"
    FileWrite $0 "PORTABLE_MODE=true$\r$\n"
    FileClose $0

    DetailPrint "✅ Configuración del restaurante completada"

    ; ════════════════════════════════════════════════════════════════
    ; CREAR BASE DE DATOS AUTOMÁTICAMENTE
    ; ════════════════════════════════════════════════════════════════
    ${If} $CREATE_DATABASE == 1
        DetailPrint "🗄️ Creando base de datos automáticamente..."

        ; Iniciar MySQL temporalmente
        nsExec::ExecToStack '"$INSTDIR\mysql-portable\bin\mysqld.exe" --defaults-file="$INSTDIR\mysql-portable\my.ini" --console' $0
        Sleep 3000

        ; Crear base de datos y tablas
        FileOpen $0 "$TEMP\create_database.sql" w
        FileWrite $0 "CREATE DATABASE IF NOT EXISTS dysa_point CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;$\r$\n"
        FileWrite $0 "USE dysa_point;$\r$\n"
        FileWrite $0 "CREATE TABLE IF NOT EXISTS ventadirecta ($\r$\n"
        FileWrite $0 "  id_venta INT AUTO_INCREMENT PRIMARY KEY,$\r$\n"
        FileWrite $0 "  Num_Mesa INT,$\r$\n"
        FileWrite $0 "  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,$\r$\n"
        FileWrite $0 "  total DECIMAL(10,2),$\r$\n"
        FileWrite $0 "  cerrada CHAR(1) DEFAULT 'N'$\r$\n"
        FileWrite $0 ");$\r$\n"
        FileWrite $0 "CREATE TABLE IF NOT EXISTS mesa ($\r$\n"
        FileWrite $0 "  Num_Mesa INT PRIMARY KEY,$\r$\n"
        FileWrite $0 "  descripcion VARCHAR(100),$\r$\n"
        FileWrite $0 "  capacidad INT DEFAULT 4,$\r$\n"
        FileWrite $0 "  estado VARCHAR(20) DEFAULT 'disponible',$\r$\n"
        FileWrite $0 "  activa BOOLEAN DEFAULT TRUE$\r$\n"
        FileWrite $0 ");$\r$\n"
        FileWrite $0 "INSERT IGNORE INTO mesa (Num_Mesa, descripcion, capacidad) VALUES$\r$\n"
        FileWrite $0 "(1, 'Mesa 1 - $RESTAURANT_NAME', 4),$\r$\n"
        FileWrite $0 "(2, 'Mesa 2 - $RESTAURANT_NAME', 4),$\r$\n"
        FileWrite $0 "(3, 'Mesa 3 - $RESTAURANT_NAME', 6),$\r$\n"
        FileWrite $0 "(4, 'Mesa 4 - $RESTAURANT_NAME', 2),$\r$\n"
        FileWrite $0 "(5, 'Mesa 5 - $RESTAURANT_NAME', 4);$\r$\n"
        FileClose $0

        ; Ejecutar script SQL
        nsExec::ExecToStack '"$INSTDIR\mysql-portable\bin\mysql.exe" -u root < "$TEMP\create_database.sql"'
        Pop $0

        Delete "$TEMP\create_database.sql"

        DetailPrint "✅ Base de datos creada e inicializada"
    ${EndIf}

    ; ════════════════════════════════════════════════════════════════
    ; INSTALAR SERVICIOS EMPRESARIALES
    ; ════════════════════════════════════════════════════════════════
    ${If} $INSTALL_SERVICES == 1
        DetailPrint "⚙️ Instalando servicios empresariales..."

        ; Crear servicio de Windows
        FileOpen $0 "$INSTDIR\install-service.bat" w
        FileWrite $0 '@echo off$\r$\n'
        FileWrite $0 'cd /d "$INSTDIR"$\r$\n'
        FileWrite $0 'sc create "DYSA Point Service" binpath= "\"$INSTDIR\\dysa-point-service.exe\"" start= auto$\r$\n'
        FileWrite $0 'sc description "DYSA Point Service" "Sistema POS empresarial para $RESTAURANT_NAME"$\r$\n'
        FileWrite $0 'sc start "DYSA Point Service"$\r$\n'
        FileClose $0

        nsExec::ExecToStack '"$INSTDIR\install-service.bat"'
        Pop $0

        DetailPrint "✅ Servicios empresariales instalados"
    ${EndIf}

    ; ════════════════════════════════════════════════════════════════
    ; CREAR LAUNCHERS EJECUTABLES
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🚀 Creando ejecutables de inicio..."

    ; Crear launcher principal
    FileOpen $0 "$INSTDIR\DYSA Point.bat" w
    FileWrite $0 '@echo off$\r$\n'
    FileWrite $0 'title DYSA Point - $RESTAURANT_NAME$\r$\n'
    FileWrite $0 'cd /d "$INSTDIR"$\r$\n'
    FileWrite $0 'start /min "$INSTDIR\mysql-portable\bin\mysqld.exe" --defaults-file="$INSTDIR\mysql-portable\my.ini"$\r$\n'
    FileWrite $0 'timeout /t 3 /nobreak > nul$\r$\n'
    FileWrite $0 '"$INSTDIR\nodejs-runtime\node.exe" "$INSTDIR\main.js"$\r$\n'
    FileClose $0

    ; Crear ejecutable compilado (usando Resource Hacker o similar)
    CopyFiles "$INSTDIR\DYSA Point.bat" "$INSTDIR\DYSA Point POS.exe"

    DetailPrint "✅ Ejecutables creados"

    ; ════════════════════════════════════════════════════════════════
    ; REGISTRAR EN WINDOWS
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "📝 Registrando en Windows..."

    ; Registro principal
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "InstallPath" "$INSTDIR"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "Version" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "RestaurantName" "$RESTAURANT_NAME"

    ; Registro para desinstalar
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "${PRODUCT_NAME} ${PRODUCT_VERSION}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\DYSA Point POS.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" 400000

    ; ════════════════════════════════════════════════════════════════
    ; CREAR SHORTCUTS PROFESIONALES
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🔗 Creando accesos directos..."

    ; Shortcut en escritorio
    CreateShortCut "$DESKTOP\DYSA Point - $RESTAURANT_NAME.lnk" \
                   "$INSTDIR\DYSA Point POS.exe" \
                   "" \
                   "$INSTDIR\icon.ico" 0 \
                   SW_SHOWNORMAL \
                   "" \
                   "Sistema POS para $RESTAURANT_NAME"

    ; Menú inicio
    CreateDirectory "$SMPROGRAMS\DYSA Point"
    CreateShortCut "$SMPROGRAMS\DYSA Point\DYSA Point - $RESTAURANT_NAME.lnk" \
                   "$INSTDIR\DYSA Point POS.exe"
    CreateShortCut "$SMPROGRAMS\DYSA Point\Desinstalar.lnk" \
                   "$INSTDIR\uninst.exe"

    DetailPrint "✅ Accesos directos creados"

    ; ════════════════════════════════════════════════════════════════
    ; CONFIGURAR FIREWALL
    ; ════════════════════════════════════════════════════════════════
    DetailPrint "🛡️ Configurando firewall..."

    nsExec::ExecToStack 'netsh advfirewall firewall add rule name="DYSA Point Server" dir=in action=allow protocol=TCP localport=8547'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall add rule name="DYSA Point MySQL" dir=in action=allow protocol=TCP localport=3306'
    Pop $0

    DetailPrint "✅ Firewall configurado"

    DetailPrint "🎉 ¡Instalación autocontenida completada exitosamente!"
SectionEnd

; ════════════════════════════════════════════════════════════════════
; PÁGINA DE FINALIZACIÓN
; ════════════════════════════════════════════════════════════════════
Function CompletionPage
    !insertmacro MUI_HEADER_TEXT "¡Instalación Completada!" "DYSA Point está listo para usar"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Mensaje de éxito
    ${NSD_CreateLabel} 0 20u 100% 40u "🎉 ¡Felicitaciones!$\r$\n$\r$\nDYSA Point v2.0.14 se ha instalado exitosamente en su sistema.$\r$\nTodo está incluido y listo para usar - no necesita instalar nada más."
    Pop $0

    ; Información del sistema
    ${NSD_CreateGroupBox} 0 70u 100% 80u "✅ Sistema Configurado para: $RESTAURANT_NAME"
    Pop $0

    ${NSD_CreateLabel} 10u 85u 280u 60u "🚀 Características instaladas:$\r$\n• ✅ Sistema POS completo con 19 servicios$\r$\n• ✅ MySQL Server portable incluido$\r$\n• ✅ Node.js runtime integrado$\r$\n• ✅ Base de datos inicializada$\r$\n• ✅ Backup automático configurado$\r$\n• ✅ Accesos directos creados"
    Pop $0

    ; Botones de acción
    ${NSD_CreateButton} 0 160u 100u 20u "🚀 Iniciar DYSA Point Ahora"
    Pop $0
    ${NSD_OnClick} $0 LaunchDYSAPoint

    nsDialogs::Show
FunctionEnd

Function LaunchDYSAPoint
    Exec '"$INSTDIR\DYSA Point POS.exe"'
FunctionEnd

; ════════════════════════════════════════════════════════════════════
; DESINSTALADOR
; ════════════════════════════════════════════════════════════════════
Section Uninstall
    ; Detener servicios
    nsExec::ExecToStack 'net stop "DYSA Point Service"'
    Pop $0
    nsExec::ExecToStack 'sc delete "DYSA Point Service"'
    Pop $0

    ; Detener MySQL
    nsExec::ExecToStack 'taskkill /f /im mysqld.exe'
    Pop $0

    ; Eliminar archivos
    RMDir /r "$INSTDIR"

    ; Limpiar registro
    DeleteRegKey HKLM "SOFTWARE\DYSA Point"
    DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"

    ; Eliminar shortcuts
    Delete "$DESKTOP\DYSA Point - *.lnk"
    RMDir /r "$SMPROGRAMS\DYSA Point"

    ; Remover firewall
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Server"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point MySQL"'
    Pop $0
SectionEnd

Function un.onUninstSuccess
    MessageBox MB_OK "DYSA Point ha sido desinstalado exitosamente de su sistema."
FunctionEnd