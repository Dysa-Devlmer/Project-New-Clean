# 📖 GUÍA DE INSTALACIÓN Y USO - DYSA POINT DESKTOP

**Versión:** 2.0.0
**Fecha:** 2025-10-11
**Autor:** DYSA Solutions

---

## 📋 TABLA DE CONTENIDOS

1. [Requisitos del Sistema](#requisitos-del-sistema)
2. [Instalación en PC Principal (Cajera)](#instalación-en-pc-principal-cajera)
3. [Instalación en Terminales (Garzones)](#instalación-en-terminales-garzones)
4. [Primer Inicio y Configuración](#primer-inicio-y-configuración)
5. [Uso Diario](#uso-diario)
6. [Backups y Restauración](#backups-y-restauración)
7. [Actualizaciones](#actualizaciones)
8. [Solución de Problemas](#solución-de-problemas)
9. [Mantenimiento](#mantenimiento)
10. [Desinstalación](#desinstalación)

---

## 🖥️ REQUISITOS DEL SISTEMA

### PC Principal (Cajera)

**Mínimo:**
- Windows 8 / 8.1 / 10 / 11
- Procesador: Intel Core i3 o equivalente
- RAM: 4 GB
- Disco Duro: 500 MB libres (más espacio para backups)
- Conexión de red: Ethernet 100 Mbps

**Recomendado:**
- Windows 10 / 11
- Procesador: Intel Core i5 o superior
- RAM: 8 GB o más
- Disco Duro: SSD con 2 GB libres
- Conexión de red: Ethernet 1 Gbps

### Terminales (Garzones)

**Mínimo:**
- Windows 8 / 8.1 / 10 / 11
- Procesador: Intel Core i3 o equivalente
- RAM: 2 GB
- Disco Duro: 200 MB libres
- Conexión de red: Ethernet/WiFi 100 Mbps

**Recomendado:**
- Windows 10 / 11
- Procesador: Intel Core i5
- RAM: 4 GB
- Disco Duro: SSD con 500 MB libres
- Conexión de red: Ethernet 1 Gbps

### Software Prerequisito

**PC Principal:**
- ✅ MySQL 8.0 o superior (incluido en instalador)
- ✅ Node.js 18.x (incluido en instalador)
- ✅ .NET Framework 4.7.2 o superior (Windows 10/11 lo incluyen)

**Terminales:**
- ✅ Solo necesitan el instalador de DYSA Point

---

## 🏢 INSTALACIÓN EN PC PRINCIPAL (CAJERA)

### Paso 1: Preparación

1. **Verificar requisitos:**
   - Comprobar que el PC cumple los requisitos mínimos
   - Verificar que tiene conexión a Internet (solo para la instalación)
   - Tener a mano la licencia de DYSA Point

2. **Descargar el instalador:**
   - Obtener `DYSA_Point_Setup_Principal_v2.0.0.exe` del USB o servidor

3. **Desactivar antivirus temporalmente:**
   - Algunos antivirus bloquean la instalación
   - Desactivar temporalmente Windows Defender o el antivirus instalado

### Paso 2: Ejecutar el Instalador

1. **Doble clic en el instalador:**
   ```
   DYSA_Point_Setup_Principal_v2.0.0.exe
   ```

2. **Aceptar permisos de administrador:**
   - Windows preguntará si confías en la aplicación
   - Clic en "Sí"

3. **Wizard de instalación:**

   **Pantalla 1: Bienvenida**
   - Leer el mensaje de bienvenida
   - Clic en "Siguiente"

   **Pantalla 2: Términos de Licencia**
   - Leer los términos de uso
   - Marcar "Acepto los términos"
   - Clic en "Siguiente"

   **Pantalla 3: Ubicación de Instalación**
   - Ubicación predeterminada: `C:\Program Files\DYSA Point\`
   - Cambiar si es necesario
   - Clic en "Siguiente"

   **Pantalla 4: Verificación de MySQL**
   - El instalador verificará si MySQL está instalado
   - Si NO está instalado:
     - Aparecerá un mensaje
     - El instalador guiará la instalación de MySQL
     - Anotar la contraseña de root de MySQL
   - Si YA está instalado:
     - Continuar automáticamente

   **Pantalla 5: Configuración de Firewall**
   - El instalador configurará el firewall de Windows
   - Permitirá el puerto 8547 para el servidor
   - Clic en "Permitir"

   **Pantalla 6: Instalación**
   - Barra de progreso mostrará el avance
   - Proceso toma aproximadamente 5-10 minutos
   - NO cerrar ni apagar el PC durante este proceso

   **Pantalla 7: Finalización**
   - Marcar "Iniciar DYSA Point ahora"
   - Clic en "Finalizar"

### Paso 3: Activación de Licencia

1. **Primer inicio:**
   - DYSA Point se abrirá automáticamente
   - Aparecerá el mensaje de verificación de licencia

2. **Si la licencia NO es válida:**
   - Aparecerá un mensaje de error
   - Opciones:
     - a) **Si tienes archivo de licencia:** Colocarlo en `backend/licencia.js`
     - b) **Si necesitas licencia:** Contactar a soporte@dysa.cl con el ID del hardware mostrado

3. **Si la licencia ES válida:**
   - El sistema iniciará normalmente
   - Aparecerá la pantalla principal

### Paso 4: Configuración Inicial de la Base de Datos

1. **Importar datos iniciales:**
   - El instalador ya creó la estructura de la BD
   - Si necesitas datos de prueba:
     ```sql
     -- Ejecutar en MySQL Workbench
     USE dysa_point;
     SOURCE E:\POS SYSME\POS_MISTURA\database\datos_iniciales.sql;
     ```

2. **Verificar conexión:**
   - En DYSA Point, ir a Configuración
   - Verificar que aparece "✓ Conectado a MySQL"

### Paso 5: Configuración de Red (Para Terminales)

1. **Obtener la IP del PC Principal:**
   - Abrir CMD (Win + R, escribir `cmd`)
   - Ejecutar: `ipconfig`
   - Anotar la IPv4 Address (ej: 192.168.1.100)

2. **Configurar firewall para LAN:**
   - Ya configurado automáticamente por el instalador
   - Puerto 8547 abierto para la red local

3. **Probar acceso desde otro PC:**
   - En otro PC de la red, abrir navegador
   - Ir a: `http://192.168.1.100:8547/frontend/terminal/waiter-mesas.html`
   - Debe cargar la interfaz de garzón

---

## 💻 INSTALACIÓN EN TERMINALES (GARZONES)

### Requisitos Previos

- PC Principal debe estar instalado y funcionando
- Terminal debe estar en la misma red que el PC Principal
- Conocer la IP del PC Principal

### Paso 1: Ejecutar el Instalador

1. **Doble clic en el instalador de terminal:**
   ```
   DYSA_Point_Setup_Terminal_v2.0.0.exe
   ```

2. **Wizard de instalación:**
   - Similar al de PC Principal
   - Más rápido (no instala MySQL)
   - Solo instala el cliente Electron

### Paso 2: Configuración de Conexión

1. **Primer inicio:**
   - DYSA Point abrirá automáticamente

2. **Pantalla de configuración:**
   - Aparecerá: "Configurar conexión al servidor"
   - Ingresar IP del PC Principal: `192.168.1.100`
   - Ingresar Puerto: `8547`
   - Clic en "Probar Conexión"

3. **Verificación:**
   - Si conecta: "✓ Conexión exitosa"
   - Si falla: Verificar:
     - PC Principal está encendido
     - Están en la misma red
     - Firewall del PC Principal permite conexiones

4. **Guardar configuración:**
   - Clic en "Guardar"
   - La terminal se conectará automáticamente en futuros inicios

### Paso 3: Probar Funcionamiento

1. **Abrir interfaz de garzón:**
   - Debe mostrar el grid de mesas
   - Probar seleccionar una mesa
   - Verificar que carga productos

---

## 🚀 PRIMER INICIO Y CONFIGURACIÓN

### En PC Principal

1. **Revisar Dashboard:**
   - Ventas: $0
   - Mesas: Cantidad correcta
   - Productos: Cantidad correcta

2. **Configurar Usuarios:**
   - Ir a Admin > Usuarios
   - Crear usuarios para garzones
   - Asignar permisos

3. **Configurar Productos:**
   - Ir a Admin > Productos
   - Verificar catálogo
   - Ajustar precios si es necesario

4. **Configurar Mesas:**
   - Ir a Admin > Mesas
   - Verificar cantidad y distribución
   - Activar/desactivar según necesidad

5. **Configurar Impresoras:**
   - Ir a Configuración > Impresoras
   - Configurar impresora de tickets
   - Configurar impresora de cocina

### En Terminales

1. **Verificar conexión:**
   - System tray debe mostrar "✓ Conectado"

2. **Probar flujo completo:**
   - Seleccionar mesa
   - Agregar productos
   - Enviar a cocina
   - Verificar en PC Principal que aparece

---

## 📱 USO DIARIO

### PC Principal (Cajera)

#### Apertura de Caja

1. Al iniciar el día, abrir DYSA Point
2. Ir a Caja > Apertura
3. Ingresar monto inicial
4. Confirmar

#### Cierre de Caja

1. Al final del día, ir a Caja > Cierre
2. Sistema mostrará:
   - Ventas del día
   - Efectivo esperado
   - Diferencia
3. Ingresar observaciones si hay diferencia
4. Confirmar cierre
5. Imprimir reporte

### Terminales (Garzones)

#### Atender Mesa

1. Abrir DYSA Point
2. Seleccionar mesa en el grid
3. Agregar productos
4. Aplicar opciones (ej: "para llevar")
5. Agregar observaciones si es necesario
6. Enviar a cocina

#### Cerrar Cuenta

1. Seleccionar mesa ocupada
2. Clic en "Cerrar Cuenta"
3. Revisar total
4. Aplicar descuento si corresponde
5. Confirmar cierre
6. Imprimir cuenta

---

## 💾 BACKUPS Y RESTAURACIÓN

### Backups Automáticos

El sistema realiza backups automáticamente:

- **Hora:** 3:00 AM todos los días
- **Ubicación:** `C:\Users\{Usuario}\AppData\Roaming\DYSA Point\backups\`
- **Cantidad:** Mantiene los últimos 30 backups
- **Limpieza:** Automática, elimina backups con más de 30 días

### Backup Manual

1. **Desde el System Tray:**
   - Clic derecho en el icono de DYSA Point
   - Seleccionar "Realizar Backup"
   - Esperar mensaje de confirmación

2. **Desde la interfaz:**
   - Ir a Admin > Backups
   - Clic en "Crear Backup Ahora"
   - Esperar confirmación

3. **Verificar backup:**
   - Ir a la carpeta de backups
   - Verificar que el archivo existe
   - Tamaño aproximado: 5-50 MB dependiendo de datos

### Restaurar Backup

⚠️ **ADVERTENCIA:** Restaurar un backup sobrescribe TODOS los datos actuales.

1. **Detener DYSA Point:**
   - Cerrar la aplicación completamente
   - Verificar en el Task Manager que no está corriendo

2. **Abrir MySQL Workbench:**
   - Conectar a localhost:3306
   - Usuario: devlmer
   - Contraseña: devlmer2025

3. **Ejecutar restauración:**
   ```sql
   USE dysa_point;
   SOURCE C:\Users\{Usuario}\AppData\Roaming\DYSA Point\backups\dysa_point_backup_YYYY-MM-DD.sql;
   ```

4. **Reiniciar DYSA Point:**
   - Abrir la aplicación
   - Verificar datos restaurados

### Backup Manual a USB

1. **Copiar archivo de backup:**
   - Ir a carpeta de backups
   - Copiar el archivo `.sql` más reciente
   - Pegar en USB
   - Guardar en lugar seguro (idealmente fuera del local)

---

## 🔄 ACTUALIZACIONES

### Actualizaciones Automáticas

El sistema verifica actualizaciones automáticamente:

- **Frecuencia:** Al iniciar la aplicación
- **Proceso:**
  1. Detecta actualización disponible
  2. Muestra notificación
  3. Usuario decide si descargar
  4. Descarga en segundo plano
  5. Instala al cerrar la aplicación

### Actualización Manual

1. **Verificar versión actual:**
   - System tray > Acerca de
   - Anotar versión (ej: v2.0.0)

2. **Verificar actualizaciones:**
   - System tray > Verificar Actualizaciones
   - Esperar verificación

3. **Si hay actualización:**
   - Clic en "Descargar"
   - Esperar descarga (puede tomar varios minutos)
   - Cerrar DYSA Point cuando termine
   - La actualización se instalará automáticamente
   - Abrir DYSA Point nuevamente

### Notas Importantes

- ✅ Las actualizaciones NO afectan la base de datos
- ✅ Las actualizaciones NO afectan las ventas en curso
- ✅ Los backups se mantienen intactos
- ⚠️ Se recomienda hacer un backup manual antes de actualizar

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Problema: "No se puede conectar a la base de datos"

**Causas posibles:**
- MySQL no está corriendo
- Credenciales incorrectas
- Puerto 3306 bloqueado

**Soluciones:**

1. **Verificar que MySQL esté corriendo:**
   ```cmd
   sc query MySQL80
   ```
   - Si no está corriendo:
     ```cmd
     net start MySQL80
     ```

2. **Verificar credenciales:**
   - Archivo: `C:\Users\{Usuario}\AppData\Roaming\DYSA Point\.env`
   - Verificar:
     ```
     DB_USER=devlmer
     DB_PASSWORD=devlmer2025
     DB_NAME=dysa_point
     ```

3. **Reiniciar MySQL:**
   ```cmd
   net stop MySQL80
   net start MySQL80
   ```

### Problema: "Error de licencia"

**Causas:**
- Licencia expirada
- Hardware cambió
- Archivo de licencia corrupto

**Soluciones:**

1. **Verificar fecha de expiración:**
   - Ver mensaje de error
   - Contactar soporte si expiró

2. **Reinstalar licencia:**
   - Obtener nuevo archivo de licencia de soporte
   - Colocar en: `C:\Program Files\DYSA Point\resources\backend\licencia.js`
   - Reiniciar DYSA Point

### Problema: Terminal no puede conectarse al servidor

**Causas:**
- PC Principal apagado
- Problema de red
- Firewall bloqueando

**Soluciones:**

1. **Verificar PC Principal:**
   - Verificar que esté encendido
   - Verificar que DYSA Point esté corriendo

2. **Verificar red:**
   - Ping desde la terminal al servidor:
     ```cmd
     ping 192.168.1.100
     ```
   - Debe responder

3. **Verificar firewall:**
   - En PC Principal, ejecutar:
     ```cmd
     netsh advfirewall firewall show rule name="DYSA Point Server"
     ```
   - Debe mostrar la regla activa

4. **Probar puerto:**
   - En terminal, abrir navegador
   - Ir a: `http://192.168.1.100:8547/health`
   - Debe mostrar: `{"status":"OK"}`

### Problema: Interfaz no carga

**Soluciones:**

1. **Esperar 15 segundos:**
   - El backend tarda en iniciar
   - Ser paciente

2. **Verificar puerto 8547:**
   ```cmd
   netstat -ano | findstr :8547
   ```
   - Debe mostrar LISTENING

3. **Reiniciar aplicación:**
   - Cerrar completamente
   - Abrir nuevamente

4. **Ver logs:**
   - Ir a: `C:\Users\{Usuario}\AppData\Roaming\DYSA Point\logs\`
   - Revisar últimos errores

### Problema: Ventana en blanco

**Soluciones:**

1. **Borrar caché:**
   - Cerrar DYSA Point
   - Eliminar: `C:\Users\{Usuario}\AppData\Roaming\DYSA Point\Cache\`
   - Abrir DYSA Point

2. **Reinstalar:**
   - Desinstalar DYSA Point
   - Mantener datos cuando pregunte
   - Instalar de nuevo

---

## 🛠️ MANTENIMIENTO

### Diario

- ✅ Verificar que backups automáticos se realizaron
- ✅ Revisar logs de actividad por errores

### Semanal

- ✅ Copiar backup a USB/nube
- ✅ Limpiar logs antiguos (automático, solo verificar)

### Mensual

- ✅ Verificar actualizaciones
- ✅ Revisar espacio en disco
- ✅ Probar restauración de backup (en ambiente de prueba)

### Anual

- ✅ Renovar licencia si es necesario
- ✅ Actualizar Windows
- ✅ Actualizar MySQL si hay versión nueva

---

## 🗑️ DESINSTALACIÓN

### Proceso Completo

1. **Cerrar DYSA Point:**
   - Salir de la aplicación
   - Verificar que no esté en system tray

2. **Backup final:**
   - Realizar un backup manual
   - Copiar a USB

3. **Desinstalar desde Panel de Control:**
   - Win + R → `appwiz.cpl`
   - Buscar "DYSA Point"
   - Clic derecho → Desinstalar

4. **Wizard de desinstalación:**
   - Preguntará: "¿Eliminar datos?"
   - **SI** quieres eliminar TODO: Marcar "Sí"
   - **NO** quieres eliminar datos: Marcar "No"

5. **Confirmación:**
   - Clic en "Desinstalar"
   - Esperar finalización

### Limpieza Manual (Opcional)

Si desinstalaste y quieres eliminar TODO manualmente:

1. **Eliminar carpeta de datos:**
   ```cmd
   rmdir /s "C:\Users\{Usuario}\AppData\Roaming\DYSA Point"
   ```

2. **Eliminar carpeta de instalación:**
   ```cmd
   rmdir /s "C:\Program Files\DYSA Point"
   ```

3. **Limpiar registro (Avanzado):**
   - No recomendado sin conocimientos técnicos
   - Usar CCleaner o herramienta similar

---

## 📞 SOPORTE TÉCNICO

### Contacto

- **Email:** soporte@dysa.cl
- **Teléfono:** +56 X XXXX XXXX
- **Horario:** Lunes a Viernes, 9:00 - 18:00

### Información a Proveer

Cuando contactes soporte, ten a mano:

1. Versión de DYSA Point
2. Sistema operativo y versión
3. Mensaje de error exacto (captura de pantalla)
4. Logs del sistema (carpeta de logs)
5. Descripción del problema paso a paso

---

## 📚 RECURSOS ADICIONALES

- **Manual de Usuario:** `MANUAL_USUARIO.pdf`
- **Guía Rápida:** `GUIA_RAPIDA.pdf`
- **Video Tutoriales:** https://dysa.cl/tutoriales
- **FAQ:** https://dysa.cl/faq

---

**Última actualización:** 2025-10-11
**Versión del documento:** 1.0
**Autor:** DYSA Solutions Development Team

© 2025 DYSA Solutions. Todos los derechos reservados.
