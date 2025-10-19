; ═══════════════════════════════════════════════════════════════════
; 🏪 DYSA POINT - WIZARD DE CONFIGURACIÓN DEL RESTAURANTE
; Páginas personalizadas para recopilar datos del restaurante durante instalación
; ═══════════════════════════════════════════════════════════════════

; ====================================
; PÁGINA DE BIENVENIDA AL RESTAURANTE
; ====================================
Function RestaurantWelcomePage
    !insertmacro MUI_HEADER_TEXT "¡Bienvenido a DYSA Point!" "Sistema POS Empresarial - Configuración Inicial"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Logo y mensaje de bienvenida
    ${NSD_CreateLabel} 0 10u 100% 40u "¡Felicitaciones por elegir DYSA Point v2.0.14!$\r$\n$\r$\nEste asistente lo guiará paso a paso para configurar su sistema POS empresarial. Recopilaremos la información de su restaurante para personalizar completamente el sistema."
    Pop $Label

    ; Características destacadas
    ${NSD_CreateGroupBox} 0 60u 100% 80u "✨ Características Empresariales que Obtendrá:"
    Pop $0

    ${NSD_CreateLabel} 10u 75u 100% 60u "🏆 Sistema POS completo con 19 servicios empresariales$\r$\n🔄 Backup automático cada 6 horas$\r$\n🔍 Monitoreo 24/7 con alertas proactivas$\r$\n🛠️ Soporte remoto integrado$\r$\n🌐 Panel de administración web$\r$\n📊 Reportes avanzados en tiempo real"
    Pop $Label

    ; Información importante
    ${NSD_CreateLabel} 0 150u 100% 30u "⚡ La instalación tomará aproximadamente 10-15 minutos y configurará automáticamente todos los componentes necesarios para su restaurante.$\r$\n$\r$\n🚀 ¡Comencemos!"
    Pop $Label

    nsDialogs::Show
FunctionEnd

; ====================================
; PÁGINA PRINCIPAL - DATOS DEL RESTAURANTE
; ====================================
Function RestaurantInfoPage
    !insertmacro MUI_HEADER_TEXT "📝 Información del Restaurante" "Complete los datos de su negocio para configurar el sistema"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Instrucciones
    ${NSD_CreateLabel} 0 0 100% 25u "Complete la información de su restaurante. Estos datos aparecerán en tickets, reportes y configuraciones del sistema. Todos los campos marcados con (*) son obligatorios."
    Pop $Label

    ; SECCIÓN 1: INFORMACIÓN BÁSICA
    ${NSD_CreateGroupBox} 0 30u 100% 70u "🏪 Información Básica del Restaurante"
    Pop $0

    ; Nombre del restaurante
    ${NSD_CreateLabel} 10u 45u 100u 12u "Nombre del Restaurante: (*)"
    Pop $Label
    ${NSD_CreateText} 10u 57u 200u 12u "$RESTAURANT_NAME"
    Pop $Text_RestaurantName

    ; RUT/Tax ID
    ${NSD_CreateLabel} 220u 45u 80u 12u "RUT/Tax ID: (*)"
    Pop $Label
    ${NSD_CreateText} 220u 57u 80u 12u "$RESTAURANT_RUT"
    Pop $Text_RestaurantRUT

    ; Teléfono
    ${NSD_CreateLabel} 10u 75u 80u 12u "Teléfono de Contacto:"
    Pop $Label
    ${NSD_CreateText} 10u 87u 120u 12u "$RESTAURANT_PHONE"
    Pop $Text_RestaurantPhone

    ; Email
    ${NSD_CreateLabel} 140u 75u 100u 12u "Email de Contacto:"
    Pop $Label
    ${NSD_CreateText} 140u 87u 160u 12u "$RESTAURANT_EMAIL"
    Pop $Text_RestaurantEmail

    ; SECCIÓN 2: UBICACIÓN
    ${NSD_CreateGroupBox} 0 105u 100% 50u "📍 Ubicación del Restaurante"
    Pop $0

    ; Dirección completa
    ${NSD_CreateLabel} 10u 120u 100u 12u "Dirección Completa:"
    Pop $Label
    ${NSD_CreateText} 10u 132u 200u 12u "$RESTAURANT_ADDRESS"
    Pop $Text_RestaurantAddress

    ; Ciudad
    ${NSD_CreateLabel} 220u 120u 60u 12u "Ciudad:"
    Pop $Label
    ${NSD_CreateText} 220u 132u 80u 12u "$RESTAURANT_CITY"
    Pop $Text_RestaurantCity

    ; País (por defecto Chile)
    ${NSD_CreateLabel} 10u 142u 60u 12u "País:"
    Pop $Label
    ${NSD_CreateText} 10u 154u 80u 12u "Chile"
    Pop $Text_RestaurantCountry

    ; Nota informativa
    ${NSD_CreateLabel} 0 165u 100% 15u "ℹ️ Esta información se utilizará para configurar automáticamente tickets, reportes fiscales y documentos del sistema."
    Pop $Label

    nsDialogs::Show
FunctionEnd

Function RestaurantInfoPageLeave
    ; Obtener valores de los campos
    ${NSD_GetText} $Text_RestaurantName $RESTAURANT_NAME
    ${NSD_GetText} $Text_RestaurantAddress $RESTAURANT_ADDRESS
    ${NSD_GetText} $Text_RestaurantPhone $RESTAURANT_PHONE
    ${NSD_GetText} $Text_RestaurantRUT $RESTAURANT_RUT
    ${NSD_GetText} $Text_RestaurantEmail $RESTAURANT_EMAIL
    ${NSD_GetText} $Text_RestaurantCity $RESTAURANT_CITY
    ${NSD_GetText} $Text_RestaurantCountry $RESTAURANT_COUNTRY

    ; Validar campos obligatorios
    ${If} $RESTAURANT_NAME == ""
        MessageBox MB_ICONEXCLAMATION "❌ CAMPO REQUERIDO$\n$\nEl nombre del restaurante es obligatorio.$\nPor favor, complete este campo para continuar."
        Abort
    ${EndIf}

    ${If} $RESTAURANT_RUT == ""
        MessageBox MB_ICONEXCLAMATION "❌ CAMPO REQUERIDO$\n$\nEl RUT/Tax ID es obligatorio para la configuración fiscal.$\nPor favor, complete este campo para continuar."
        Abort
    ${EndIf}

    ; Validar formato de email si se proporciona
    ${If} $RESTAURANT_EMAIL != ""
        ${Unless} ${WordFind} "$RESTAURANT_EMAIL" "@" "#" $0
        ${AndUnless} ${WordFind} "$RESTAURANT_EMAIL" "." "#" $0
            MessageBox MB_ICONEXCLAMATION "❌ EMAIL INVÁLIDO$\n$\nEl formato del email no es válido.$\nPor favor, use un formato como: nombre@dominio.com"
            Abort
        ${EndUnless}
    ${EndIf}

    ; Confirmación de datos
    MessageBox MB_YESNO|MB_ICONQUESTION "✅ CONFIRMAR DATOS DEL RESTAURANTE$\n$\n🏪 Restaurante: $RESTAURANT_NAME$\n📄 RUT: $RESTAURANT_RUT$\n📍 Ciudad: $RESTAURANT_CITY$\n📞 Teléfono: $RESTAURANT_PHONE$\n✉️ Email: $RESTAURANT_EMAIL$\n$\n¿Los datos son correctos?" IDYES continueInstall IDNO fixData

    fixData:
        MessageBox MB_OK "Puede modificar los datos en la página anterior."
        Abort

    continueInstall:
        ; Datos validados correctamente
FunctionEnd

; ====================================
; PÁGINA DE CONFIGURACIÓN DE BASE DE DATOS
; ====================================
Function DatabaseConfigPage
    !insertmacro MUI_HEADER_TEXT "🗄️ Configuración de Base de Datos" "Configure la conexión a MySQL para su sistema"

    nsDialogs::Create 1018
    Pop $DBDialog

    ${If} $DBDialog == error
        Abort
    ${EndIf}

    ; Instrucciones
    ${NSD_CreateLabel} 0 0 100% 30u "Configure los parámetros de conexión a MySQL. Si tiene una instalación estándar de MySQL, puede usar los valores por defecto. El sistema creará automáticamente la base de datos necesaria."
    Pop $Label

    ; SECCIÓN 1: CONFIGURACIÓN DEL SERVIDOR
    ${NSD_CreateGroupBox} 0 35u 100% 60u "🖥️ Configuración del Servidor MySQL"
    Pop $0

    ; Servidor MySQL
    ${NSD_CreateLabel} 10u 50u 80u 12u "Servidor MySQL:"
    Pop $Label
    ${NSD_CreateText} 10u 62u 120u 12u "localhost"
    Pop $Text_DBHost

    ; Puerto MySQL
    ${NSD_CreateLabel} 140u 50u 50u 12u "Puerto:"
    Pop $Label
    ${NSD_CreateText} 140u 62u 60u 12u "3306"
    Pop $Text_DBPort

    ; Usuario MySQL
    ${NSD_CreateLabel} 10u 75u 80u 12u "Usuario MySQL:"
    Pop $Label
    ${NSD_CreateText} 10u 87u 120u 12u "devlmer"
    Pop $Text_DBUser

    ; Contraseña MySQL
    ${NSD_CreateLabel} 140u 75u 100u 12u "Contraseña MySQL:"
    Pop $Label
    ${NSD_CreateText} 140u 87u 120u 12u "devlmer2025"
    Pop $Text_DBPassword
    ${NSD_SendMessage} $Text_DBPassword ${EM_SETPASSWORDCHAR} 42 0

    ; SECCIÓN 2: BASE DE DATOS
    ${NSD_CreateGroupBox} 0 100u 100% 40u "💾 Base de Datos del Sistema"
    Pop $0

    ; Nombre de la base de datos
    ${NSD_CreateLabel} 10u 115u 120u 12u "Nombre de la Base de Datos:"
    Pop $Label
    ${NSD_CreateText} 10u 127u 150u 12u "dysa_point"
    Pop $Text_DBName

    ; Botón de prueba de conexión
    ${NSD_CreateButton} 170u 125u 80u 15u "🔍 Probar Conexión"
    Pop $0
    ${NSD_OnClick} $0 TestDatabaseConnection

    ; Información adicional
    ${NSD_CreateLabel} 0 145u 100% 35u "ℹ️ INFORMACIÓN IMPORTANTE:$\r$\n• El sistema creará automáticamente las tablas necesarias$\r$\n• Se configurará el backup automático cada 6 horas$\r$\n• Se habilitará el monitoreo 24/7 de la base de datos"
    Pop $Label

    nsDialogs::Show
FunctionEnd

Function DatabaseConfigPageLeave
    ; Obtener valores de configuración de DB
    ${NSD_GetText} $Text_DBHost $DB_HOST
    ${NSD_GetText} $Text_DBPort $DB_PORT
    ${NSD_GetText} $Text_DBUser $DB_USER
    ${NSD_GetText} $Text_DBPassword $DB_PASSWORD
    ${NSD_GetText} $Text_DBName $DB_NAME

    ; Validar campos obligatorios
    ${If} $DB_HOST == ""
        StrCpy $DB_HOST "localhost"
    ${EndIf}

    ${If} $DB_PORT == ""
        StrCpy $DB_PORT "3306"
    ${EndIf}

    ${If} $DB_USER == ""
        MessageBox MB_ICONEXCLAMATION "❌ CAMPO REQUERIDO$\n$\nEl usuario de MySQL es obligatorio.$\nPor favor, complete este campo."
        Abort
    ${EndIf}

    ${If} $DB_NAME == ""
        StrCpy $DB_NAME "dysa_point"
    ${EndIf}

    ; Confirmación de configuración
    MessageBox MB_YESNO|MB_ICONQUESTION "✅ CONFIRMAR CONFIGURACIÓN DE BASE DE DATOS$\n$\n🖥️ Servidor: $DB_HOST:$DB_PORT$\n👤 Usuario: $DB_USER$\n💾 Base de Datos: $DB_NAME$\n$\n¿La configuración es correcta?" IDYES continueDB IDNO fixDB

    fixDB:
        Abort

    continueDB:
        ; Configuración validada
FunctionEnd

Function TestDatabaseConnection
    MessageBox MB_OK "🔍 PRUEBA DE CONEXIÓN$\n$\nProbando conexión a MySQL...$\n$\nEsta función estará disponible en la versión final del instalador."
FunctionEnd

; ====================================
; PÁGINA DE CONFIGURACIÓN AVANZADA (OPCIONAL)
; ====================================
Function AdvancedConfigPage
    !insertmacro MUI_HEADER_TEXT "⚙️ Configuración Avanzada" "Personalice las características empresariales del sistema"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Instrucciones
    ${NSD_CreateLabel} 0 0 100% 20u "Configure las características avanzadas del sistema. Estas opciones pueden modificarse posteriormente desde el panel de administración."
    Pop $Label

    ; SECCIÓN 1: CARACTERÍSTICAS EMPRESARIALES
    ${NSD_CreateGroupBox} 0 25u 100% 80u "🏆 Características Empresariales"
    Pop $0

    ; Backup automático
    ${NSD_CreateCheckbox} 10u 40u 200u 12u "✅ Backup automático cada 6 horas"
    Pop $0
    ${NSD_Check} $0

    ; Monitoreo 24/7
    ${NSD_CreateCheckbox} 10u 55u 200u 12u "✅ Monitoreo del sistema 24/7"
    Pop $0
    ${NSD_Check} $0

    ; Soporte remoto
    ${NSD_CreateCheckbox} 10u 70u 200u 12u "✅ Soporte técnico remoto"
    Pop $0
    ${NSD_Check} $0

    ; Actualizaciones automáticas
    ${NSD_CreateCheckbox} 10u 85u 200u 12u "✅ Actualizaciones automáticas"
    Pop $0
    ${NSD_Check} $0

    ; SECCIÓN 2: CONFIGURACIÓN DE PUERTOS
    ${NSD_CreateGroupBox} 0 110u 100% 50u "🌐 Configuración de Red"
    Pop $0

    ; Puerto principal
    ${NSD_CreateLabel} 10u 125u 100u 12u "Puerto del Sistema POS:"
    Pop $Label
    ${NSD_CreateText} 10u 137u 60u 12u "8547"
    Pop $0

    ; Puerto de administración
    ${NSD_CreateLabel} 80u 125u 120u 12u "Puerto Panel Administración:"
    Pop $Label
    ${NSD_CreateText} 80u 137u 60u 12u "8548"
    Pop $0

    ; Puerto de soporte
    ${NSD_CreateLabel} 150u 125u 100u 12u "Puerto Soporte Remoto:"
    Pop $Label
    ${NSD_CreateText} 150u 137u 60u 12u "8549"
    Pop $0

    ; Información final
    ${NSD_CreateLabel} 0 165u 100% 15u "🚀 El sistema estará listo para usar inmediatamente después de la instalación con configuración optimizada."
    Pop $Label

    nsDialogs::Show
FunctionEnd

; ====================================
; PÁGINA DE RESUMEN FINAL
; ====================================
Function InstallSummaryPage
    !insertmacro MUI_HEADER_TEXT "📋 Resumen de Instalación" "Revisión final antes de instalar DYSA Point"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Título de resumen
    ${NSD_CreateLabel} 0 0 100% 15u "✅ Todo está listo para instalar DYSA Point en su restaurante. Revise el resumen a continuación:"
    Pop $Label

    ; RESUMEN DEL RESTAURANTE
    ${NSD_CreateGroupBox} 0 20u 100% 60u "🏪 Datos del Restaurante"
    Pop $0

    ${NSD_CreateLabel} 10u 35u 100% 40u "🏷️ Nombre: $RESTAURANT_NAME$\r$\n📄 RUT: $RESTAURANT_RUT$\r$\n📍 Dirección: $RESTAURANT_ADDRESS, $RESTAURANT_CITY$\r$\n📞 Teléfono: $RESTAURANT_PHONE$\r$\n✉️ Email: $RESTAURANT_EMAIL"
    Pop $Label

    ; RESUMEN DE LA BASE DE DATOS
    ${NSD_CreateGroupBox} 0 85u 100% 35u "🗄️ Configuración de Base de Datos"
    Pop $0

    ${NSD_CreateLabel} 10u 100u 100% 15u "🖥️ Servidor: $DB_HOST:$DB_PORT    👤 Usuario: $DB_USER    💾 BD: $DB_NAME"
    Pop $Label

    ; CARACTERÍSTICAS A INSTALAR
    ${NSD_CreateGroupBox} 0 125u 100% 55u "🚀 Sistema a Instalar"
    Pop $0

    ${NSD_CreateLabel} 10u 140u 100% 35u "🏆 DYSA Point v2.0.14 - Sistema POS Empresarial$\r$\n✅ 19 servicios empresariales + 23 APIs REST$\r$\n✅ Backup automático + Monitoreo 24/7 + Soporte remoto$\r$\n✅ Panel web administrativo + Optimización de rendimiento"
    Pop $Label

    nsDialogs::Show
FunctionEnd

; ====================================
; PÁGINA DE PROGRESO DE INSTALACIÓN
; ====================================
Function InstallProgressPage
    !insertmacro MUI_HEADER_TEXT "⚡ Instalando DYSA Point" "Por favor espere mientras se configura su sistema..."

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Mensaje de progreso
    ${NSD_CreateLabel} 0 20u 100% 40u "🚀 Instalando DYSA Point v2.0.14...$\r$\n$\r$\n⏱️ Este proceso tomará aproximadamente 10-15 minutos.$\r$\nSe están configurando todos los componentes empresariales para su restaurante."
    Pop $Label

    ; Barra de progreso (simulada con texto)
    ${NSD_CreateLabel} 0 80u 100% 60u "📦 Pasos de instalación:$\r$\n$\r$\n✅ Verificando requisitos del sistema$\r$\n🔄 Instalando archivos del programa$\r$\n🔄 Configurando base de datos$\r$\n⏳ Configurando servicios empresariales$\r$\n⏳ Instalando servicio de Windows$\r$\n⏳ Configurando backup automático$\r$\n⏳ Habilitando monitoreo 24/7$\r$\n⏳ Creando accesos directos"
    Pop $Label

    ; Información adicional
    ${NSD_CreateLabel} 0 150u 100% 30u "ℹ️ Durante la instalación se configurará automáticamente:$\r$\n• Firewall de Windows • Servicio automático • Registro del sistema$\r$\n• Base de datos empresarial • Configuración del restaurante"
    Pop $Label

    nsDialogs::Show
FunctionEnd

; ====================================
; PÁGINA DE INSTALACIÓN COMPLETADA
; ====================================
Function InstallCompletePage
    !insertmacro MUI_HEADER_TEXT "🎉 ¡Instalación Completada!" "DYSA Point está listo para revolucionar su restaurante"

    nsDialogs::Create 1018
    Pop $Dialog

    ${If} $Dialog == error
        Abort
    ${EndIf}

    ; Mensaje de éxito
    ${NSD_CreateLabel} 0 10u 100% 30u "🏆 ¡Felicitaciones! DYSA Point v2.0.14 se ha instalado exitosamente.$\r$\n$\r$\nSu sistema POS empresarial está configurado y listo para usar."
    Pop $Label

    ; Información del sistema instalado
    ${NSD_CreateGroupBox} 0 45u 100% 70u "✅ Sistema Configurado Para: $RESTAURANT_NAME"
    Pop $0

    ${NSD_CreateLabel} 10u 60u 100% 50u "🚀 Características activas:$\r$\n• ✅ 19 servicios empresariales funcionando$\r$\n• ✅ Base de datos '$DB_NAME' inicializada$\r$\n• ✅ Backup automático cada 6 horas$\r$\n• ✅ Monitoreo 24/7 habilitado$\r$\n• ✅ Soporte remoto disponible$\r$\n• ✅ Panel web administrativo activo"
    Pop $Label

    ; Accesos disponibles
    ${NSD_CreateGroupBox} 0 120u 100% 40u "🔗 Accesos al Sistema"
    Pop $0

    ${NSD_CreateLabel} 10u 135u 100% 20u "🖥️ DYSA Point POS: Escritorio$\r$\n🌐 Panel Admin: http://localhost:8548"
    Pop $Label

    ; Botones de acción
    ${NSD_CreateButton} 0 165u 80u 15u "🚀 Iniciar Sistema"
    Pop $0
    ${NSD_OnClick} $0 StartDysaPoint

    ${NSD_CreateButton} 90u 165u 80u 15u "📖 Ver Documentación"
    Pop $0
    ${NSD_OnClick} $0 OpenDocumentation

    ${NSD_CreateButton} 180u 165u 80u 15u "🎯 Panel Admin"
    Pop $0
    ${NSD_OnClick} $0 OpenAdminPanel

    nsDialogs::Show
FunctionEnd

Function StartDysaPoint
    Exec '"$INSTDIR\dysa-point.exe"'
    MessageBox MB_OK "🚀 DYSA Point se está iniciando...$\n$\nEn unos segundos verá la interfaz principal del sistema."
FunctionEnd

Function OpenDocumentation
    ExecShell "open" "$INSTDIR\documentation\GUIA_USUARIO_COMPLETA.html"
FunctionEnd

Function OpenAdminPanel
    ExecShell "open" "http://localhost:8548"
FunctionEnd