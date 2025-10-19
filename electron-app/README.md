# DYSA Point Desktop - Aplicación Electron

Aplicación de escritorio profesional para Windows 8/10/11 del sistema POS DYSA Point.

## 📋 Características

- ✅ Aplicación nativa de escritorio con Electron
- ✅ Backend Node.js integrado (puerto 8547)
- ✅ Sistema de licencias hardware-based
- ✅ Backup automático de base de datos (diario a las 3 AM)
- ✅ Logging de actividad de usuarios
- ✅ Auto-actualizaciones
- ✅ System tray icon
- ✅ Auto-inicio con Windows (solo PC principal)
- ✅ Instalador profesional con NSIS
- ✅ Soporte para arquitectura cliente-servidor (LAN)

## 🏗️ Arquitectura

### Estructura de Carpetas

```
electron-app/
├── src/
│   ├── main/                    # Proceso principal de Electron
│   │   ├── main.js              # Punto de entrada principal
│   │   ├── backup-service.js    # Servicio de backups automáticos
│   │   └── activity-logger.js   # Logger de actividad
│   ├── preload/                 # Scripts de preload (bridge seguro)
│   │   └── preload.js           # Context bridge
│   └── renderer/                # Proceso de renderizado (vacío, usa HTML del frontend)
├── assets/                      # Recursos (iconos, imágenes)
│   └── icons/                   # Iconos de la aplicación
├── build/                       # Configuración de build
│   └── installer.nsh            # Script personalizado NSIS
├── dist/                        # Salida del build (generado)
└── package.json                 # Configuración npm y electron-builder

backend/                         # Backend Node.js (copiado al instalador)
frontend/                        # Frontend HTML/CSS/JS (copiado al instalador)
```

### Componentes Principales

#### 1. Main Process (`src/main/main.js`)
- Crea la ventana principal de Electron
- Inicia el backend Node.js como proceso hijo
- Verifica la licencia al inicio
- Gestiona auto-actualizaciones
- Crea system tray icon
- Inicializa servicios de backup y logging

#### 2. Backup Service (`src/main/backup-service.js`)
- Backup automático diario a las 3 AM
- Mantiene los últimos 30 backups
- Usa mysqldump para exportar la BD
- Permite restauración de backups
- Limpieza automática de backups antiguos

#### 3. Activity Logger (`src/main/activity-logger.js`)
- Registra todas las acciones importantes del sistema
- Logs diarios en archivos separados
- Búsqueda en logs
- Mantiene 90 días de historial
- Rotación automática de logs

#### 4. Preload Script (`src/preload/preload.js`)
- Bridge seguro entre main y renderer process
- Expone APIs controladas vía contextBridge
- Previene acceso directo a Node.js desde el frontend

## 🚀 Desarrollo

### Requisitos
- Node.js >= 18.0.0
- npm >= 9.0.0
- MySQL 8.0
- Windows 8/10/11

### Instalación de Dependencias

```bash
cd electron-app
npm install
```

### Ejecutar en Modo Desarrollo

```bash
npm run dev
```

### Ejecutar en Modo Producción

```bash
npm start
```

## 📦 Build y Distribución

### Compilar Instalador (64-bit)

```bash
npm run build
```

### Compilar Instalador (32-bit y 64-bit)

```bash
npm run build:all
```

### Empaquetar sin Instalador (Para Pruebas)

```bash
npm run pack
```

## 📖 Configuración

### Variables de Entorno

El backend se configura automáticamente con estas variables:

```env
PORT=8547
NODE_ENV=production
DB_HOST=localhost
DB_PORT=3306
DB_USER=devlmer
DB_PASSWORD=devlmer2025
DB_NAME=dysa_point
```

### Backup Automático

Configuración predeterminada del servicio de backup:

- **Hora de backup:** 3:00 AM
- **Backups a mantener:** 30
- **Ubicación:** `%APPDATA%\DYSA Point\backups\`

### Logging de Actividad

Configuración del logger de actividad:

- **Días a mantener:** 90
- **Ubicación:** `%APPDATA%\DYSA Point\logs\activity\`
- **Tamaño máximo por archivo:** 10 MB

## 🔐 Licencias

El sistema verifica la licencia hardware-based al iniciar:

1. Lee el ID del hardware (CPU, motherboard, etc.)
2. Verifica contra la licencia instalada en `backend/licencia.js`
3. Si no es válida, bloquea el inicio y muestra error
4. Si es válida, permite el inicio normal

Tipos de licencia soportados:
- **Desarrollo:** Para desarrollo local
- **Producción:** Para instalaciones en restaurantes
- **Temporal:** Con fecha de expiración

## 🌐 Arquitectura Cliente-Servidor

### PC Principal (Cajera)
- Ejecuta backend + frontend + MySQL
- Actúa como servidor para terminales
- Auto-inicio con Windows
- Backups automáticos habilitados

### Terminales (Garzones)
- Solo ejecutan frontend
- Se conectan al backend de la PC principal vía LAN
- Reconexión automática si se pierde la red
- Sin MySQL local

## 📝 APIs Disponibles para el Frontend

El preload script expone estas APIs al frontend vía `window.electronAPI`:

### Información de la Aplicación
- `getAppVersion()` - Obtiene la versión de la app

### Auto-actualizaciones
- `checkUpdates()` - Verifica actualizaciones manualmente
- `onUpdateDownloading(callback)` - Evento: descarga iniciada
- `onUpdateProgress(callback)` - Evento: progreso de descarga

### Control de la Aplicación
- `quitApp()` - Cierra la aplicación

### Backups
- `realizarBackup()` - Realiza un backup manual
- `listarBackups()` - Lista todos los backups disponibles
- `restaurarBackup(path)` - Restaura un backup específico

### Logging de Actividad
- `registrarActividad(tipo, usuario, descripcion, datos)` - Registra una actividad
- `obtenerLogHoy()` - Obtiene el log del día actual
- `buscarEnLogs(criterio, dias)` - Busca en logs

### Información del Sistema
- `platform` - Plataforma del SO
- `isProduction` - Si está en modo producción

## 📂 Ubicaciones de Datos

### Windows
- **Backups:** `C:\Users\{Usuario}\AppData\Roaming\DYSA Point\backups\`
- **Logs de actividad:** `C:\Users\{Usuario}\AppData\Roaming\DYSA Point\logs\activity\`
- **Logs del sistema:** `C:\Users\{Usuario}\AppData\Roaming\DYSA Point\logs\`
- **Configuración:** `C:\Users\{Usuario}\AppData\Roaming\DYSA Point\.env`

## 🔧 Solución de Problemas

### El backend no inicia
1. Verificar que MySQL esté instalado y corriendo
2. Verificar credenciales en las variables de entorno
3. Revisar logs en `%APPDATA%\DYSA Point\logs\`

### Error de licencia
1. Verificar que `backend/licencia.js` esté presente
2. Contactar soporte para obtener licencia válida

### Ventana no carga
1. Esperar 15 segundos (timeout del backend)
2. Verificar que el puerto 8547 esté libre
3. Revisar firewall de Windows

## 📞 Soporte

- **Email:** soporte@dysa.cl
- **Documentación:** Ver carpeta `docs/`

## 🔄 Versiones

**Versión Actual:** 2.0.0

### Changelog
- v2.0.0: Migración a Electron desde aplicación web pura
- Sistema de backups automáticos
- Logging de actividad
- Auto-actualizaciones
- Instalador profesional NSIS

## 📄 Licencia

PROPIETARIO - DYSA Solutions © 2025

---

**Generado:** 2025-10-11
**Autor:** DYSA Solutions Development Team
