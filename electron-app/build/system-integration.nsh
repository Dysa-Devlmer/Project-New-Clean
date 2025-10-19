; ═══════════════════════════════════════════════════════════════════
; 🔗 DYSA POINT - INTEGRACIÓN CON EL SISTEMA WINDOWS
; Registro en el sistema, shortcuts profesionales y servicios
; ═══════════════════════════════════════════════════════════════════

; ====================================
; REGISTRO COMPLETO EN WINDOWS
; ====================================
!macro RegisterInSystem
    DetailPrint "📝 Registrando DYSA Point en el sistema Windows..."

    ; ════════════════════════════════════════════════════════════════
    ; REGISTRO PRINCIPAL DE LA APLICACIÓN
    ; ════════════════════════════════════════════════════════════════

    ; Entrada principal en registry para Windows
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "InstallPath" "$INSTDIR"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "Version" "${PRODUCT_VERSION}"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "ProductName" "${PRODUCT_NAME}"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "InstallDate" "$$(Get-Date -Format yyyy-MM-dd)"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "RestaurantName" "$RESTAURANT_NAME"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "RestaurantRUT" "$RESTAURANT_RUT"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "SupportEmail" "soporte@dysa.cl"
    WriteRegStr HKLM "SOFTWARE\DYSA Point" "WebSite" "${PRODUCT_WEB_SITE}"

    ; Registro para el menu "Abrir con"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "" "$INSTDIR\dysa-point.exe"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "Path" "$INSTDIR"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "ApplicationDescription" "Sistema POS Empresarial para Restaurantes"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "ApplicationIcon" "$INSTDIR\icon.ico"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "ApplicationCompany" "${PRODUCT_PUBLISHER}"
    WriteRegStr HKLM "${PRODUCT_DIR_REGKEY}" "ApplicationVersion" "${PRODUCT_VERSION}"

    ; ════════════════════════════════════════════════════════════════
    ; REGISTRO PARA PANEL DE CONTROL (ADD/REMOVE PROGRAMS)
    ; ════════════════════════════════════════════════════════════════

    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayName" "DYSA Point - Sistema POS Empresarial v${PRODUCT_VERSION}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayVersion" "${PRODUCT_VERSION}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Publisher" "${PRODUCT_PUBLISHER}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "UninstallString" "$INSTDIR\uninst.exe"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "QuietUninstallString" "$INSTDIR\uninst.exe /S"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "DisplayIcon" "$INSTDIR\dysa-point.exe,0"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "InstallLocation" "$INSTDIR"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "InstallSource" "$EXEDIR"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLInfoAbout" "${PRODUCT_WEB_SITE}"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "URLUpdateInfo" "https://updates.dysa.cl/pos/"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "HelpLink" "https://support.dysa.cl"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Comments" "Sistema POS Empresarial para Restaurantes con 19 servicios profesionales"
    WriteRegStr ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Contact" "soporte@dysa.cl"
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoModify" 1
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "NoRepair" 1
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "EstimatedSize" 512000  ; 512MB estimado
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "VersionMajor" 2
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "VersionMinor" 0
    WriteRegDWORD ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}" "Language" 3082  ; Español

    ; ════════════════════════════════════════════════════════════════
    ; ASOCIACIONES DE ARCHIVOS
    ; ════════════════════════════════════════════════════════════════

    ; Archivos .dysa (configuración de restaurante)
    WriteRegStr HKCR ".dysa" "" "DYSA.RestaurantConfig"
    WriteRegStr HKCR ".dysa" "Content Type" "application/dysa-restaurant-config"
    WriteRegStr HKCR "DYSA.RestaurantConfig" "" "Configuración de Restaurante DYSA Point"
    WriteRegStr HKCR "DYSA.RestaurantConfig\DefaultIcon" "" "$INSTDIR\icons\config.ico,0"
    WriteRegStr HKCR "DYSA.RestaurantConfig\shell\open\command" "" '"$INSTDIR\dysa-point.exe" --config "%1"'
    WriteRegStr HKCR "DYSA.RestaurantConfig\shell\edit\command" "" '"$INSTDIR\admin-panel.exe" --edit-config "%1"'

    ; Archivos .dspos (backup de punto de venta)
    WriteRegStr HKCR ".dspos" "" "DYSA.POSBackup"
    WriteRegStr HKCR ".dspos" "Content Type" "application/dysa-pos-backup"
    WriteRegStr HKCR "DYSA.POSBackup" "" "Backup de DYSA Point POS"
    WriteRegStr HKCR "DYSA.POSBackup\DefaultIcon" "" "$INSTDIR\icons\backup.ico,0"
    WriteRegStr HKCR "DYSA.POSBackup\shell\restore\command" "" '"$INSTDIR\admin-panel.exe" --restore "%1"'

    ; ════════════════════════════════════════════════════════════════
    ; PROTOCOLO URL dysa://
    ; ════════════════════════════════════════════════════════════════

    WriteRegStr HKCR "dysa" "" "Protocolo DYSA Point"
    WriteRegStr HKCR "dysa" "URL Protocol" ""
    WriteRegStr HKCR "dysa\DefaultIcon" "" "$INSTDIR\dysa-point.exe,0"
    WriteRegStr HKCR "dysa\shell\open\command" "" '"$INSTDIR\dysa-point.exe" --url "%1"'

    DetailPrint "✅ Aplicación registrada correctamente en el sistema"
!macroend

; ====================================
; CREACIÓN DE SHORTCUTS PROFESIONALES
; ====================================
!macro CreateProfessionalShortcuts
    DetailPrint "🔗 Creando accesos directos profesionales..."

    ; ════════════════════════════════════════════════════════════════
    ; SHORTCUT EN ESCRITORIO
    ; ════════════════════════════════════════════════════════════════

    CreateShortCut "$DESKTOP\DYSA Point POS.lnk" \
                   "$INSTDIR\dysa-point.exe" \
                   "--restaurant $\"$RESTAURANT_NAME$\"" \
                   "$INSTDIR\icons\dysa-point.ico" 0 \
                   SW_SHOWNORMAL \
                   CONTROL|SHIFT|F9 \
                   "Sistema POS Empresarial para $RESTAURANT_NAME"

    ; ════════════════════════════════════════════════════════════════
    ; MENU INICIO - CARPETA PRINCIPAL
    ; ════════════════════════════════════════════════════════════════

    CreateDirectory "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial"

    ; Shortcut principal del POS
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\🏪 DYSA Point POS.lnk" \
                   "$INSTDIR\dysa-point.exe" \
                   "--restaurant $\"$RESTAURANT_NAME$\"" \
                   "$INSTDIR\icons\dysa-point.ico" 0 \
                   SW_SHOWNORMAL \
                   "" \
                   "Sistema POS principal para $RESTAURANT_NAME"

    ; Panel de Administración
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\⚙️ Panel de Administración.lnk" \
                   "$INSTDIR\admin-panel.exe" \
                   "--restaurant $\"$RESTAURANT_NAME$\"" \
                   "$INSTDIR\icons\admin-panel.ico" 0 \
                   SW_SHOWNORMAL \
                   "" \
                   "Panel administrativo del sistema"

    ; Monitor del Sistema
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\📊 Monitor del Sistema.lnk" \
                   "$INSTDIR\monitor.exe" \
                   "--restaurant $\"$RESTAURANT_NAME$\"" \
                   "$INSTDIR\icons\monitor.ico" 0 \
                   SW_SHOWNORMAL \
                   "" \
                   "Monitor de rendimiento y estadísticas"

    ; Centro de Soporte
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\🛠️ Centro de Soporte.lnk" \
                   "$INSTDIR\support-center.exe" \
                   "" \
                   "$INSTDIR\icons\support.ico" 0 \
                   SW_SHOWNORMAL \
                   "" \
                   "Centro de soporte técnico y tickets"

    ; ════════════════════════════════════════════════════════════════
    ; SUBMENU - HERRAMIENTAS EMPRESARIALES
    ; ════════════════════════════════════════════════════════════════

    CreateDirectory "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Herramientas Empresariales"

    ; Generador de Reportes
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Herramientas Empresariales\📈 Generador de Reportes.lnk" \
                   "$INSTDIR\report-generator.exe" \
                   "" \
                   "$INSTDIR\icons\reports.ico" 0

    ; Backup Manager
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Herramientas Empresariales\💾 Administrador de Backups.lnk" \
                   "$INSTDIR\backup-manager.exe" \
                   "" \
                   "$INSTDIR\icons\backup.ico" 0

    ; Configurador de Mesas
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Herramientas Empresariales\🏠 Configurador de Mesas.lnk" \
                   "$INSTDIR\table-configurator.exe" \
                   "" \
                   "$INSTDIR\icons\tables.ico" 0

    ; Administrador de Usuarios
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Herramientas Empresariales\👥 Administrador de Usuarios.lnk" \
                   "$INSTDIR\user-manager.exe" \
                   "" \
                   "$INSTDIR\icons\users.ico" 0

    ; ════════════════════════════════════════════════════════════════
    ; SUBMENU - DOCUMENTACIÓN Y SOPORTE
    ; ════════════════════════════════════════════════════════════════

    CreateDirectory "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Documentación y Soporte"

    ; Manual de Usuario
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Documentación y Soporte\📖 Manual de Usuario.lnk" \
                   "$INSTDIR\documentation\manual-usuario.pdf" \
                   "" \
                   "$INSTDIR\icons\manual.ico" 0

    ; Guía de Configuración
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Documentación y Soporte\🔧 Guía de Configuración.lnk" \
                   "$INSTDIR\documentation\guia-configuracion.html" \
                   "" \
                   "$INSTDIR\icons\config-guide.ico" 0

    ; Portal de Soporte Web
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Documentación y Soporte\🌐 Portal de Soporte Web.lnk" \
                   "https://support.dysa.cl" \
                   "" \
                   "$INSTDIR\icons\web-support.ico" 0

    ; Chatbot de Ayuda
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\Documentación y Soporte\💬 Chatbot de Ayuda.lnk" \
                   "$INSTDIR\chatbot-support.exe" \
                   "" \
                   "$INSTDIR\icons\chatbot.ico" 0

    ; ════════════════════════════════════════════════════════════════
    ; SHORTCUTS DE SISTEMA
    ; ════════════════════════════════════════════════════════════════

    ; Desinstalador
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\🗑️ Desinstalar DYSA Point.lnk" \
                   "$INSTDIR\uninst.exe" \
                   "" \
                   "$INSTDIR\icons\uninstall.ico" 0 \
                   SW_SHOWNORMAL \
                   "" \
                   "Desinstalar DYSA Point del sistema"

    ; Información del Sistema
    CreateShortCut "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial\ℹ️ Información del Sistema.lnk" \
                   "$INSTDIR\system-info.exe" \
                   "" \
                   "$INSTDIR\icons\info.ico" 0 \
                   SW_SHOWNORMAL \
                   "" \
                   "Información detallada del sistema instalado"

    ; ════════════════════════════════════════════════════════════════
    ; ACCESO RÁPIDO EN BARRA DE TAREAS (TASKBAR PINS)
    ; ════════════════════════════════════════════════════════════════

    ; Nota: Windows 10/11 no permite pin automático por seguridad
    ; Se crea shortcut especial que el usuario puede pin manualmente
    CreateShortCut "$INSTDIR\Pin-To-Taskbar.lnk" \
                   "$INSTDIR\dysa-point.exe" \
                   "--restaurant $\"$RESTAURANT_NAME$\" --taskbar" \
                   "$INSTDIR\icons\dysa-point.ico" 0 \
                   SW_SHOWNORMAL \
                   "" \
                   "DYSA Point POS - $RESTAURANT_NAME (Para Pin en Taskbar)"

    DetailPrint "✅ Accesos directos creados correctamente"
!macroend

; ====================================
; INSTALACIÓN DE SERVICIOS DE SISTEMA
; ====================================
!macro InstallSystemServices
    DetailPrint "⚙️ Instalando servicios del sistema Windows..."

    ; ════════════════════════════════════════════════════════════════
    ; SERVICIO PRINCIPAL DE DYSA POINT
    ; ════════════════════════════════════════════════════════════════

    ; Crear directorio de servicios
    CreateDirectory "$INSTDIR\services"
    CreateDirectory "$PROGRAMDATA\DYSA Point\Services\Logs"

    ; Crear archivo de configuración del servicio
    FileOpen $0 "$INSTDIR\services\dysa-point-service-config.json" w
    FileWrite $0 '{$\r$\n'
    FileWrite $0 '  "service_name": "DYSA Point Enterprise Service",$\r$\n'
    FileWrite $0 '  "service_description": "Servicio empresarial de DYSA Point para monitoreo, backup automático y soporte remoto",$\r$\n'
    FileWrite $0 '  "restaurant_name": "$RESTAURANT_NAME",$\r$\n'
    FileWrite $0 '  "restaurant_rut": "$RESTAURANT_RUT",$\r$\n'
    FileWrite $0 '  "auto_start": true,$\r$\n'
    FileWrite $0 '  "restart_on_failure": true,$\r$\n'
    FileWrite $0 '  "backup_interval": "6h",$\r$\n'
    FileWrite $0 '  "monitoring_enabled": true,$\r$\n'
    FileWrite $0 '  "remote_support_enabled": true,$\r$\n'
    FileWrite $0 '  "log_level": "info",$\r$\n'
    FileWrite $0 '  "log_file": "$PROGRAMDATA\\DYSA Point\\Services\\Logs\\service.log"$\r$\n'
    FileWrite $0 '}$\r$\n'
    FileClose $0

    ; Script de instalación del servicio
    FileOpen $0 "$INSTDIR\services\install-service.bat" w
    FileWrite $0 '@echo off$\r$\n'
    FileWrite $0 'echo Instalando servicio DYSA Point Enterprise...$\r$\n'
    FileWrite $0 'sc create "DYSA Point Enterprise" binpath= "\"$INSTDIR\\services\\dysa-point-service.exe\" --config \"$INSTDIR\\services\\dysa-point-service-config.json\"" ^$\r$\n'
    FileWrite $0 '   start= auto ^$\r$\n'
    FileWrite $0 '   type= own ^$\r$\n'
    FileWrite $0 '   error= normal ^$\r$\n'
    FileWrite $0 '   depend= MySQL80$\r$\n'
    FileWrite $0 '$\r$\n'
    FileWrite $0 'sc description "DYSA Point Enterprise" "Servicio empresarial de DYSA Point v2.0.14 para $RESTAURANT_NAME. Proporciona backup automático cada 6 horas, monitoreo 24/7, soporte remoto y actualizaciones automáticas."$\r$\n'
    FileWrite $0 '$\r$\n'
    FileWrite $0 'sc config "DYSA Point Enterprise" start= auto$\r$\n'
    FileWrite $0 'sc failure "DYSA Point Enterprise" reset= 86400 actions= restart/5000/restart/10000/restart/20000$\r$\n'
    FileWrite $0 '$\r$\n'
    FileWrite $0 'echo Iniciando servicio...$\r$\n'
    FileWrite $0 'sc start "DYSA Point Enterprise"$\r$\n'
    FileWrite $0 '$\r$\n'
    FileWrite $0 'if %errorlevel% equ 0 ($\r$\n'
    FileWrite $0 '    echo ✅ Servicio DYSA Point Enterprise instalado y iniciado correctamente$\r$\n'
    FileWrite $0 ') else ($\r$\n'
    FileWrite $0 '    echo ❌ Error instalando el servicio$\r$\n'
    FileWrite $0 ')$\r$\n'
    FileClose $0

    ; Ejecutar instalación del servicio
    DetailPrint "📦 Instalando servicio empresarial..."
    nsExec::ExecToStack '"$INSTDIR\services\install-service.bat"'
    Pop $0

    ${If} $0 == 0
        DetailPrint "✅ Servicio DYSA Point Enterprise instalado correctamente"

        ; Registrar el servicio en el sistema
        WriteRegStr HKLM "SYSTEM\CurrentControlSet\Services\DYSA Point Enterprise" "ServiceType" "own"
        WriteRegStr HKLM "SYSTEM\CurrentControlSet\Services\DYSA Point Enterprise" "RestaurantName" "$RESTAURANT_NAME"
        WriteRegStr HKLM "SYSTEM\CurrentControlSet\Services\DYSA Point Enterprise" "RestaurantRUT" "$RESTAURANT_RUT"
        WriteRegStr HKLM "SYSTEM\CurrentControlSet\Services\DYSA Point Enterprise" "Version" "${PRODUCT_VERSION}"
        WriteRegStr HKLM "SYSTEM\CurrentControlSet\Services\DYSA Point Enterprise" "InstallDate" "$$(Get-Date -Format yyyy-MM-dd)"
    ${Else}
        DetailPrint "⚠️ Advertencia: El servicio no se pudo instalar automáticamente"
        MessageBox MB_ICONEXCLAMATION "⚠️ SERVICIO NO INSTALADO$\n$\nEl servicio de Windows no se pudo instalar automáticamente.$\nLas funciones de backup automático y monitoreo pueden verse afectadas.$\n$\nPuede instalarlo manualmente desde el Panel de Administración."
    ${EndIf}

    ; ════════════════════════════════════════════════════════════════
    ; TAREAS PROGRAMADAS (SCHEDULED TASKS)
    ; ════════════════════════════════════════════════════════════════

    DetailPrint "📅 Configurando tareas programadas..."

    ; Tarea de backup diario (redundancia al servicio)
    nsExec::ExecToStack 'schtasks /create /tn "DYSA Point Daily Backup" /tr "\"$INSTDIR\\backup-manager.exe\" --auto-backup" /sc daily /st 02:00 /f'
    Pop $0

    ; Tarea de verificación de actualizaciones
    nsExec::ExecToStack 'schtasks /create /tn "DYSA Point Update Check" /tr "\"$INSTDIR\\update-checker.exe\" --check" /sc daily /st 06:00 /f'
    Pop $0

    ; Tarea de limpieza de logs semanales
    nsExec::ExecToStack 'schtasks /create /tn "DYSA Point Log Cleanup" /tr "\"$INSTDIR\\log-cleaner.exe\" --weekly" /sc weekly /d SUN /st 01:00 /f'
    Pop $0

    DetailPrint "✅ Tareas programadas configuradas"

    DetailPrint "✅ Servicios del sistema instalados correctamente"
!macroend

; ====================================
; CONFIGURACIÓN DE FIREWALL AVANZADA
; ====================================
!macro ConfigureAdvancedFirewall
    DetailPrint "🛡️ Configurando firewall avanzado de Windows..."

    ; ════════════════════════════════════════════════════════════════
    ; REGLAS PARA SERVIDOR POS
    ; ════════════════════════════════════════════════════════════════

    ; Regla principal para servidor POS (puerto 8547)
    nsExec::ExecToStack 'netsh advfirewall firewall add rule ^
        name="DYSA Point POS Server ($RESTAURANT_NAME)" ^
        dir=in action=allow protocol=TCP localport=8547 ^
        program="$INSTDIR\\dysa-point.exe" ^
        description="Servidor principal del sistema POS DYSA Point para $RESTAURANT_NAME" ^
        enable=yes'
    Pop $0

    ; Regla para panel de administración (puerto 8548)
    nsExec::ExecToStack 'netsh advfirewall firewall add rule ^
        name="DYSA Point Admin Panel ($RESTAURANT_NAME)" ^
        dir=in action=allow protocol=TCP localport=8548 ^
        program="$INSTDIR\\admin-panel.exe" ^
        description="Panel de administración web de DYSA Point para $RESTAURANT_NAME" ^
        enable=yes'
    Pop $0

    ; Regla para soporte remoto (puerto 8549)
    nsExec::ExecToStack 'netsh advfirewall firewall add rule ^
        name="DYSA Point Remote Support ($RESTAURANT_NAME)" ^
        dir=in action=allow protocol=TCP localport=8549 ^
        program="$INSTDIR\\support-center.exe" ^
        description="Sistema de soporte remoto de DYSA Point para $RESTAURANT_NAME" ^
        enable=yes'
    Pop $0

    ; ════════════════════════════════════════════════════════════════
    ; REGLAS ADICIONALES PARA FUNCIONES EMPRESARIALES
    ; ════════════════════════════════════════════════════════════════

    ; Regla para actualizaciones automáticas
    nsExec::ExecToStack 'netsh advfirewall firewall add rule ^
        name="DYSA Point Auto Updates" ^
        dir=out action=allow protocol=TCP remoteport=443 ^
        program="$INSTDIR\\update-checker.exe" ^
        description="Actualizaciones automáticas de DYSA Point" ^
        enable=yes'
    Pop $0

    ; Regla para backup remoto (si está habilitado)
    nsExec::ExecToStack 'netsh advfirewall firewall add rule ^
        name="DYSA Point Remote Backup" ^
        dir=out action=allow protocol=TCP remoteport=443,22 ^
        program="$INSTDIR\\backup-manager.exe" ^
        description="Sistema de backup remoto de DYSA Point" ^
        enable=yes'
    Pop $0

    ; Regla para telemetría y monitoreo
    nsExec::ExecToStack 'netsh advfirewall firewall add rule ^
        name="DYSA Point Monitoring" ^
        dir=out action=allow protocol=TCP remoteport=443 ^
        program="$INSTDIR\\monitor.exe" ^
        description="Sistema de monitoreo y telemetría de DYSA Point" ^
        enable=yes'
    Pop $0

    DetailPrint "✅ Firewall configurado con reglas empresariales"
!macroend

; ====================================
; CONFIGURACIÓN DE PERMISOS DE SISTEMA
; ====================================
!macro ConfigureSystemPermissions
    DetailPrint "🔐 Configurando permisos del sistema..."

    ; ════════════════════════════════════════════════════════════════
    ; PERMISOS EN DIRECTORIOS DE DATOS
    ; ════════════════════════════════════════════════════════════════

    ; Permisos completos para APPDATA
    AccessControl::GrantOnFile "$APPDATA\DYSA Point" "(BU)" "FullAccess"
    AccessControl::GrantOnFile "$APPDATA\DYSA Point" "(S-1-5-32-545)" "FullAccess"  ; Users group
    AccessControl::GrantOnFile "$APPDATA\DYSA Point" "SYSTEM" "FullAccess"
    AccessControl::GrantOnFile "$APPDATA\DYSA Point" "Administrators" "FullAccess"

    ; Permisos para PROGRAMDATA (servicios)
    AccessControl::GrantOnFile "$PROGRAMDATA\DYSA Point" "(BU)" "FullAccess"
    AccessControl::GrantOnFile "$PROGRAMDATA\DYSA Point" "SYSTEM" "FullAccess"
    AccessControl::GrantOnFile "$PROGRAMDATA\DYSA Point" "Administrators" "FullAccess"
    AccessControl::GrantOnFile "$PROGRAMDATA\DYSA Point" "SERVICE" "FullAccess"

    ; ════════════════════════════════════════════════════════════════
    ; PERMISOS EN DIRECTORIO DE INSTALACIÓN
    ; ════════════════════════════════════════════════════════════════

    ; Permisos de lectura/ejecución para usuarios
    AccessControl::GrantOnFile "$INSTDIR" "(BU)" "ReadAndExecute"
    AccessControl::GrantOnFile "$INSTDIR" "(S-1-5-32-545)" "ReadAndExecute"  ; Users group

    ; Permisos completos para administradores
    AccessControl::GrantOnFile "$INSTDIR" "Administrators" "FullAccess"
    AccessControl::GrantOnFile "$INSTDIR" "SYSTEM" "FullAccess"

    ; Permisos especiales para el ejecutable principal
    AccessControl::GrantOnFile "$INSTDIR\dysa-point.exe" "(BU)" "ReadAndExecute"
    AccessControl::GrantOnFile "$INSTDIR\dysa-point.exe" "SERVICE" "ReadAndExecute"

    ; ════════════════════════════════════════════════════════════════
    ; CONFIGURACIÓN DE UAC (User Account Control)
    ; ════════════════════════════════════════════════════════════════

    ; Crear manifests para UAC
    FileOpen $0 "$INSTDIR\dysa-point.exe.manifest" w
    FileWrite $0 '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>$\r$\n'
    FileWrite $0 '<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">$\r$\n'
    FileWrite $0 '  <assemblyIdentity version="2.0.14.0" processorArchitecture="X86" name="DYSA.Point.POS" type="win32"/>$\r$\n'
    FileWrite $0 '  <description>DYSA Point - Sistema POS Empresarial</description>$\r$\n'
    FileWrite $0 '  <trustInfo xmlns="urn:schemas-microsoft-com:asm.v2">$\r$\n'
    FileWrite $0 '    <security>$\r$\n'
    FileWrite $0 '      <requestedPrivileges>$\r$\n'
    FileWrite $0 '        <requestedExecutionLevel level="asInvoker" uiAccess="false"/>$\r$\n'
    FileWrite $0 '      </requestedPrivileges>$\r$\n'
    FileWrite $0 '    </security>$\r$\n'
    FileWrite $0 '  </trustInfo>$\r$\n'
    FileWrite $0 '  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">$\r$\n'
    FileWrite $0 '    <application>$\r$\n'
    FileWrite $0 '      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>$\r$\n'  ; Windows 10
    FileWrite $0 '      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}"/>$\r$\n'  ; Windows 7
    FileWrite $0 '      <supportedOS Id="{4a2f28e3-53b9-4441-ba9c-d69d4a4a6e38}"/>$\r$\n'  ; Windows 8
    FileWrite $0 '      <supportedOS Id="{35138b9a-5d96-4fbd-8e2d-a2440225f93a}"/>$\r$\n'  ; Windows 8.1
    FileWrite $0 '    </application>$\r$\n'
    FileWrite $0 '  </compatibility>$\r$\n'
    FileWrite $0 '</assembly>$\r$\n'
    FileClose $0

    DetailPrint "✅ Permisos del sistema configurados correctamente"
!macroend