; ═══════════════════════════════════════════════════════════════════
; 🗑️ DYSA POINT - DESINSTALADOR PROFESIONAL COMPLETO
; Desinstalación limpia y segura con preservación opcional de datos
; ═══════════════════════════════════════════════════════════════════

; ====================================
; VARIABLES PARA DESINSTALACIÓN
; ====================================
Var UNINSTALL_MODE  ; "CLEAN" o "PRESERVE"
Var RESTAURANT_NAME_UNINST
Var BACKUP_BEFORE_UNINSTALL

; ====================================
; FUNCIÓN DE INICIALIZACIÓN DEL DESINSTALADOR
; ====================================
Function un.onInit
    ; Verificar permisos de administrador
    UserInfo::GetAccountType
    Pop $0
    ${If} $0 != "admin"
        MessageBox MB_ICONSTOP "⚠️ PERMISOS REQUERIDOS$\n$\nSe necesitan permisos de administrador para desinstalar DYSA Point.$\n$\nEjecute como administrador e intente nuevamente."
        Abort
    ${EndIf}

    ; Leer información del restaurante desde el registro
    ReadRegStr $RESTAURANT_NAME_UNINST HKLM "SOFTWARE\DYSA Point" "RestaurantName"
    ${If} $RESTAURANT_NAME_UNINST == ""
        StrCpy $RESTAURANT_NAME_UNINST "este restaurante"
    ${EndIf}

    ; Mostrar diálogo de confirmación personalizado
    MessageBox MB_ICONQUESTION|MB_YESNO|MB_DEFBUTTON2 "🗑️ DESINSTALAR DYSA POINT$\n$\n¿Está seguro que desea desinstalar completamente DYSA Point del sistema de $RESTAURANT_NAME_UNINST?$\n$\n⚠️ Esta acción eliminará:$\n• El programa principal y todos sus componentes$\n• Los servicios de Windows instalados$\n• Los accesos directos del sistema$\n• Las configuraciones del registro$\n$\nℹ️ Los datos del restaurante pueden preservarse si lo desea.$\n$\n¿Continuar con la desinstalación?" IDYES +2 IDNO 0
    Abort

    ; Verificar si DYSA Point está ejecutándose
    Call un.CheckRunningProcesses
FunctionEnd

; ====================================
; VERIFICAR PROCESOS EN EJECUCIÓN
; ====================================
Function un.CheckRunningProcesses
    DetailPrint "🔍 Verificando procesos de DYSA Point en ejecución..."

    ; Lista de procesos a verificar
    StrCpy $0 "dysa-point.exe"
    Call un.CheckAndCloseProcess
    StrCpy $0 "admin-panel.exe"
    Call un.CheckAndCloseProcess
    StrCpy $0 "monitor.exe"
    Call un.CheckAndCloseProcess
    StrCpy $0 "support-center.exe"
    Call un.CheckAndCloseProcess
    StrCpy $0 "backup-manager.exe"
    Call un.CheckAndCloseProcess

    DetailPrint "✅ Verificación de procesos completada"
FunctionEnd

Function un.CheckAndCloseProcess
    ; Buscar proceso activo
    nsExec::ExecToStack 'tasklist /fi "imagename eq $0" | find "$0"'
    Pop $1
    Pop $2

    ${If} $1 == 0  ; Proceso encontrado
        MessageBox MB_ICONEXCLAMATION|MB_YESNO "⚠️ PROCESO ACTIVO DETECTADO$\n$\nEl proceso '$0' está ejecutándose actualmente.$\n$\n¿Desea cerrarlo automáticamente para continuar con la desinstalación?$\n$\n⚡ Se recomienda cerrar DYSA Point manualmente antes de desinstalar." IDYES killProcess IDNO skipKill

        killProcess:
            DetailPrint "⏹️ Cerrando proceso $0..."
            nsExec::ExecToStack 'taskkill /f /im "$0"'
            Pop $1
            ${If} $1 == 0
                DetailPrint "✅ Proceso $0 cerrado correctamente"
                Sleep 2000  ; Esperar 2 segundos
            ${Else}
                DetailPrint "⚠️ No se pudo cerrar $0 automáticamente"
            ${EndIf}
            Goto continueUninstall

        skipKill:
            MessageBox MB_OK "ℹ️ Por favor, cierre DYSA Point manualmente y ejecute el desinstalador nuevamente."
            Abort

        continueUninstall:
    ${EndIf}
FunctionEnd

; ====================================
; PÁGINA DE OPCIONES DE DESINSTALACIÓN
; ====================================
Function un.UninstallOptionsPage
    !insertmacro MUI_HEADER_TEXT "🗑️ Opciones de Desinstalación" "Seleccione cómo desea proceder con la desinstalación"

    nsDialogs::Create 1018
    Pop $0

    ${If} $0 == error
        Abort
    ${EndIf}

    ; Información del restaurante
    ${NSD_CreateLabel} 0 10u 100% 20u "Se procederá a desinstalar DYSA Point del sistema de:$\r$\n🏪 $RESTAURANT_NAME_UNINST"
    Pop $1

    ; Opciones de preservación de datos
    ${NSD_CreateGroupBox} 0 40u 100% 80u "💾 Opciones de Preservación de Datos"
    Pop $2

    ; Opción 1: Desinstalación limpia
    ${NSD_CreateRadioButton} 10u 60u 200u 15u "🗑️ Desinstalación Completa (Recomendada)"
    Pop $3
    ${NSD_AddStyle} $3 ${WS_GROUP}
    ${NSD_Check} $3

    ${NSD_CreateLabel} 20u 75u 250u 25u "Elimina todo: programa, configuración, logs y datos temporales.$\r$\nMANTIENE: Base de datos MySQL con datos de ventas."
    Pop $4

    ; Opción 2: Preservar datos
    ${NSD_CreateRadioButton} 10u 105u 200u 15u "💾 Preservar Datos del Restaurante"
    Pop $5

    ${NSD_CreateLabel} 20u 120u 250u 25u "Mantiene: configuración, logs, backups y reportes.$\r$\nElimina: solo el programa principal y servicios."
    Pop $6

    ; Opción de backup antes de desinstalar
    ${NSD_CreateCheckBox} 0 150u 200u 15u "📦 Crear backup completo antes de desinstalar"
    Pop $7
    ${NSD_Check} $7

    nsDialogs::Show
FunctionEnd

; ====================================
; MACRO PRINCIPAL DE DESINSTALACIÓN
; ====================================
!macro un.CompleteUninstall
    DetailPrint "🧹 INICIANDO DESINSTALACIÓN PROFESIONAL DE DYSA POINT..."

    ; ════════════════════════════════════════════════════════════════
    ; PASO 1: DETENER SERVICIOS DE WINDOWS
    ; ════════════════════════════════════════════════════════════════
    Call un.StopSystemServices

    ; ════════════════════════════════════════════════════════════════
    ; PASO 2: CREAR BACKUP DE EMERGENCIA (OPCIONAL)
    ; ════════════════════════════════════════════════════════════════
    Call un.CreateEmergencyBackup

    ; ════════════════════════════════════════════════════════════════
    ; PASO 3: REMOVER REGLAS DE FIREWALL
    ; ════════════════════════════════════════════════════════════════
    Call un.RemoveFirewallRules

    ; ════════════════════════════════════════════════════════════════
    ; PASO 4: ELIMINAR TAREAS PROGRAMADAS
    ; ════════════════════════════════════════════════════════════════
    Call un.RemoveScheduledTasks

    ; ════════════════════════════════════════════════════════════════
    ; PASO 5: LIMPIAR REGISTRO DE WINDOWS
    ; ════════════════════════════════════════════════════════════════
    Call un.CleanWindowsRegistry

    ; ════════════════════════════════════════════════════════════════
    ; PASO 6: ELIMINAR SHORTCUTS Y MENÚS
    ; ════════════════════════════════════════════════════════════════
    Call un.RemoveShortcuts

    ; ════════════════════════════════════════════════════════════════
    ; PASO 7: GESTIONAR DATOS DE USUARIO
    ; ════════════════════════════════════════════════════════════════
    Call un.ManageUserData

    ; ════════════════════════════════════════════════════════════════
    ; PASO 8: ELIMINAR ARCHIVOS DEL PROGRAMA
    ; ════════════════════════════════════════════════════════════════
    Call un.RemoveProgramFiles

    ; ════════════════════════════════════════════════════════════════
    ; PASO 9: LIMPIAR DIRECTORIOS VACÍOS
    ; ════════════════════════════════════════════════════════════════
    Call un.CleanupEmptyDirectories

    ; ════════════════════════════════════════════════════════════════
    ; PASO 10: VERIFICACIÓN FINAL
    ; ════════════════════════════════════════════════════════════════
    Call un.FinalVerification

    DetailPrint "✅ DESINSTALACIÓN COMPLETADA EXITOSAMENTE"
!macroend

; ====================================
; FUNCIONES DE DESINSTALACIÓN DETALLADAS
; ====================================

Function un.StopSystemServices
    DetailPrint "⏹️ Deteniendo servicios del sistema..."

    ; Detener servicio principal
    nsExec::ExecToStack 'net stop "DYSA Point Enterprise"'
    Pop $0
    ${If} $0 == 0
        DetailPrint "✅ Servicio DYSA Point Enterprise detenido"
    ${Else}
        DetailPrint "ℹ️ Servicio no estaba ejecutándose"
    ${EndIf}

    ; Eliminar servicio del sistema
    nsExec::ExecToStack 'sc delete "DYSA Point Enterprise"'
    Pop $0
    ${If} $0 == 0
        DetailPrint "✅ Servicio DYSA Point Enterprise eliminado"
    ${Else}
        DetailPrint "⚠️ No se pudo eliminar el servicio automáticamente"
    ${EndIf}

    ; Esperar a que se liberen todos los recursos
    Sleep 3000
    DetailPrint "✅ Servicios del sistema procesados"
FunctionEnd

Function un.CreateEmergencyBackup
    ; Verificar si se solicitó backup
    ${If} $BACKUP_BEFORE_UNINSTALL == "1"
        DetailPrint "📦 Creando backup de emergencia..."

        ; Crear directorio de backup temporal
        CreateDirectory "$TEMP\DYSA_Point_Emergency_Backup"

        ; Backup de configuración
        CopyFiles /SILENT "$APPDATA\DYSA Point\config\*.*" "$TEMP\DYSA_Point_Emergency_Backup\config\"

        ; Backup de logs importantes
        CopyFiles /SILENT "$APPDATA\DYSA Point\logs\*.log" "$TEMP\DYSA_Point_Emergency_Backup\logs\"

        ; Crear archivo de información del backup
        FileOpen $0 "$TEMP\DYSA_Point_Emergency_Backup\backup_info.txt" w
        FileWrite $0 "DYSA Point Emergency Backup$\r$\n"
        FileWrite $0 "============================$\r$\n"
        FileWrite $0 "Restaurante: $RESTAURANT_NAME_UNINST$\r$\n"
        FileWrite $0 "Fecha: $$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')$\r$\n"
        FileWrite $0 "Versión: 2.0.14$\r$\n"
        FileWrite $0 "$\r$\n"
        FileWrite $0 "Este backup fue creado automáticamente antes de la desinstalación.$\r$\n"
        FileWrite $0 "Contiene la configuración y logs más importantes del sistema.$\r$\n"
        FileWrite $0 "$\r$\n"
        FileWrite $0 "NOTA: La base de datos MySQL NO está incluida en este backup.$\r$\n"
        FileWrite $0 "Para recuperar datos de ventas, use las herramientas de MySQL.$\r$\n"
        FileClose $0

        DetailPrint "✅ Backup de emergencia creado en $TEMP\DYSA_Point_Emergency_Backup"
        MessageBox MB_OK "📦 BACKUP CREADO$\n$\nSe ha creado un backup de emergencia en:$\n$TEMP\DYSA_Point_Emergency_Backup$\n$\nGuárdelo en un lugar seguro si necesita recuperar la configuración posteriormente."
    ${EndIf}
FunctionEnd

Function un.RemoveFirewallRules
    DetailPrint "🛡️ Removiendo reglas del firewall..."

    ; Lista de reglas a remover
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point POS Server ($RESTAURANT_NAME_UNINST)"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Admin Panel ($RESTAURANT_NAME_UNINST)"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Remote Support ($RESTAURANT_NAME_UNINST)"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Auto Updates"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Remote Backup"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Monitoring"'
    Pop $0

    ; Reglas genéricas por si el nombre del restaurante cambió
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point POS Server"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Admin Panel"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="DYSA Point Remote Support"'
    Pop $0

    DetailPrint "✅ Reglas del firewall removidas"
FunctionEnd

Function un.RemoveScheduledTasks
    DetailPrint "📅 Eliminando tareas programadas..."

    ; Eliminar tareas programadas
    nsExec::ExecToStack 'schtasks /delete /tn "DYSA Point Daily Backup" /f'
    Pop $0
    nsExec::ExecToStack 'schtasks /delete /tn "DYSA Point Update Check" /f'
    Pop $0
    nsExec::ExecToStack 'schtasks /delete /tn "DYSA Point Log Cleanup" /f'
    Pop $0

    DetailPrint "✅ Tareas programadas eliminadas"
FunctionEnd

Function un.CleanWindowsRegistry
    DetailPrint "📝 Limpiando registro de Windows..."

    ; Eliminar claves principales de DYSA Point
    DeleteRegKey HKLM "SOFTWARE\DYSA Point"
    DeleteRegKey HKLM "${PRODUCT_DIR_REGKEY}"
    DeleteRegKey ${PRODUCT_UNINST_ROOT_KEY} "${PRODUCT_UNINST_KEY}"

    ; Eliminar asociaciones de archivos
    DeleteRegKey HKCR ".dysa"
    DeleteRegKey HKCR "DYSA.RestaurantConfig"
    DeleteRegKey HKCR ".dspos"
    DeleteRegKey HKCR "DYSA.POSBackup"
    DeleteRegKey HKCR "dysa"

    ; Limpiar entradas de servicios (si quedaron)
    DeleteRegKey HKLM "SYSTEM\CurrentControlSet\Services\DYSA Point Enterprise"

    ; Limpiar entradas de inicio automático
    DeleteRegValue HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Run" "DYSA Point"
    DeleteRegValue HKCU "SOFTWARE\Microsoft\Windows\CurrentVersion\Run" "DYSA Point"

    DetailPrint "✅ Registro de Windows limpiado"
FunctionEnd

Function un.RemoveShortcuts
    DetailPrint "🔗 Eliminando accesos directos..."

    ; Eliminar shortcuts del escritorio
    Delete "$DESKTOP\DYSA Point POS.lnk"

    ; Eliminar toda la carpeta del menú inicio
    RMDir /r "$SMPROGRAMS\DYSA Point - Sistema POS Empresarial"

    ; Eliminar shortcuts adicionales que puedan existir
    Delete "$DESKTOP\DYSA Point Admin.lnk"
    Delete "$DESKTOP\DYSA Point Monitor.lnk"

    ; Eliminar del menú de inicio rápido (si existe)
    Delete "$QUICKLAUNCH\DYSA Point POS.lnk"

    ; Eliminar shortcut especial para taskbar
    Delete "$INSTDIR\Pin-To-Taskbar.lnk"

    DetailPrint "✅ Accesos directos eliminados"
FunctionEnd

Function un.ManageUserData
    DetailPrint "💾 Gestionando datos de usuario..."

    ; Determinar qué hacer con los datos según la opción seleccionada
    ${If} $UNINSTALL_MODE == "PRESERVE"
        DetailPrint "💾 Preservando datos del restaurante..."

        ; Mover datos importantes a una ubicación de preservación
        CreateDirectory "$DOCUMENTS\DYSA Point Preserved Data"
        CopyFiles /SILENT "$APPDATA\DYSA Point\*.*" "$DOCUMENTS\DYSA Point Preserved Data\"

        MessageBox MB_OK "💾 DATOS PRESERVADOS$\n$\nLos datos del restaurante han sido preservados en:$\n$DOCUMENTS\DYSA Point Preserved Data$\n$\nIncluye: configuración, logs, backups y reportes.$\n$\nLa base de datos MySQL permanece intacta."

        DetailPrint "✅ Datos preservados en $DOCUMENTS\DYSA Point Preserved Data"

    ${Else}
        ; Desinstalación completa
        DetailPrint "🗑️ Eliminando datos de usuario (desinstalación completa)..."

        ; Preguntar confirmación final
        MessageBox MB_ICONQUESTION|MB_YESNO "⚠️ CONFIRMACIÓN FINAL$\n$\n¿Está COMPLETAMENTE SEGURO que desea eliminar todos los datos?$\n$\nSe eliminarán:$\n• Configuración del restaurante$\n• Logs del sistema$\n• Backups locales$\n• Reportes guardados$\n$\nNOTA: La base de datos MySQL NO será eliminada.$\n$\n¿Continuar?" IDYES deleteUserData IDNO preserveUserData

        deleteUserData:
            ; Eliminar datos de APPDATA
            RMDir /r "$APPDATA\DYSA Point"
            DetailPrint "✅ Datos de APPDATA eliminados"

            ; Eliminar datos de PROGRAMDATA
            RMDir /r "$PROGRAMDATA\DYSA Point"
            DetailPrint "✅ Datos de PROGRAMDATA eliminados"

            Goto endUserData

        preserveUserData:
            ; El usuario cambió de opinión, preservar datos
            CreateDirectory "$DOCUMENTS\DYSA Point Preserved Data"
            CopyFiles /SILENT "$APPDATA\DYSA Point\*.*" "$DOCUMENTS\DYSA Point Preserved Data\"
            RMDir /r "$APPDATA\DYSA Point"
            RMDir /r "$PROGRAMDATA\DYSA Point"

            MessageBox MB_OK "💾 DATOS PRESERVADOS POR SEGURIDAD$\n$\nAunque seleccionó desinstalación completa, los datos han sido preservados en:$\n$DOCUMENTS\DYSA Point Preserved Data$\n$\nPor seguridad del restaurante."
            DetailPrint "✅ Datos preservados por seguridad del usuario"

        endUserData:
    ${EndIf}
FunctionEnd

Function un.RemoveProgramFiles
    DetailPrint "📂 Eliminando archivos del programa..."

    ; Eliminar archivos principales
    Delete "$INSTDIR\dysa-point.exe"
    Delete "$INSTDIR\admin-panel.exe"
    Delete "$INSTDIR\monitor.exe"
    Delete "$INSTDIR\support-center.exe"
    Delete "$INSTDIR\backup-manager.exe"

    ; Eliminar directorios del programa
    RMDir /r "$INSTDIR\services"
    RMDir /r "$INSTDIR\documentation"
    RMDir /r "$INSTDIR\icons"
    RMDir /r "$INSTDIR\resources"
    RMDir /r "$INSTDIR\node_modules"

    ; Eliminar archivos de configuración
    Delete "$INSTDIR\package.json"
    Delete "$INSTDIR\main.js"
    Delete "$INSTDIR\*.manifest"

    DetailPrint "✅ Archivos del programa eliminados"
FunctionEnd

Function un.CleanupEmptyDirectories
    DetailPrint "🧹 Limpiando directorios vacíos..."

    ; Intentar eliminar directorio principal (solo si está vacío)
    RMDir "$INSTDIR"

    ; Limpiar directorios padre si quedaron vacíos
    RMDir "$PROGRAMFILES64\DYSA Point"
    RMDir "$PROGRAMFILES\DYSA Point"

    DetailPrint "✅ Limpieza de directorios completada"
FunctionEnd

Function un.FinalVerification
    DetailPrint "🔍 Realizando verificación final..."

    ; Verificar que no queden procesos ejecutándose
    nsExec::ExecToStack 'tasklist /fi "imagename eq dysa-point.exe" | find "dysa-point.exe"'
    Pop $0
    ${If} $0 == 0
        DetailPrint "⚠️ Advertencia: Aún hay procesos de DYSA Point ejecutándose"
    ${Else}
        DetailPrint "✅ No se detectaron procesos residuales"
    ${EndIf}

    ; Verificar limpieza del registro
    ReadRegStr $0 HKLM "SOFTWARE\DYSA Point" "InstallPath"
    ${If} $0 == ""
        DetailPrint "✅ Registro de Windows limpio"
    ${Else}
        DetailPrint "⚠️ Advertencia: Algunas entradas del registro pueden persistir"
    ${EndIf}

    ; Verificar servicios
    nsExec::ExecToStack 'sc query "DYSA Point Enterprise"'
    Pop $0
    ${If} $0 != 0
        DetailPrint "✅ Servicios de Windows eliminados correctamente"
    ${Else}
        DetailPrint "⚠️ Advertencia: El servicio puede requerir eliminación manual"
    ${EndIf}

    DetailPrint "✅ Verificación final completada"
FunctionEnd

; ====================================
; FUNCIÓN DE ÉXITO DE DESINSTALACIÓN
; ====================================
Function un.onUninstSuccess
    HideWindow

    ; Información final sobre la base de datos
    ReadRegStr $0 HKLM "SOFTWARE\DYSA Point" "RestaurantName"
    ${If} $0 == ""
        StrCpy $0 "el restaurante"
    ${EndIf}

    MessageBox MB_ICONINFORMATION "✅ DESINSTALACIÓN COMPLETADA$\n$\nDYSA Point ha sido desinstalado exitosamente del sistema.$\n$\n📊 INFORMACIÓN IMPORTANTE:$\n$\n🗄️ BASE DE DATOS MYSQL:$\nLa base de datos con los datos de ventas de $0 NO ha sido eliminada.$\nSi desea eliminarla completamente, debe hacerlo manualmente desde MySQL.$\n$\n💾 DATOS PRESERVADOS:$\n${If} $UNINSTALL_MODE == 'PRESERVE'Los datos del restaurante han sido preservados según su selección.${Else}${If} $BACKUP_BEFORE_UNINSTALL == '1'Se creó un backup de emergencia antes de la desinstalación.${EndIf}${EndIf}$\n$\n🙏 Gracias por utilizar DYSA Point.$\nSi necesita reinstalar el sistema en el futuro, todos sus datos de ventas estarán disponibles en la base de datos MySQL.$\n$\n📧 Soporte: soporte@dysa.cl"
FunctionEnd