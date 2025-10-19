// ═══════════════════════════════════════════════════════════════
// DYSA POINT - PRELOAD SCRIPT
// Bridge seguro entre Main Process y Renderer Process
// ═══════════════════════════════════════════════════════════════

const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    // Información de la aplicación
    getAppVersion: () => ipcRenderer.invoke('app-version'),

    // Auto-actualizaciones
    checkUpdates: () => ipcRenderer.invoke('check-updates'),
    onUpdateDownloading: (callback) => ipcRenderer.on('update-downloading', callback),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (event, percent) => callback(percent)),

    // Control de la aplicación
    quitApp: () => ipcRenderer.invoke('quit-app'),

    // Logging del sistema
    getLogsPath: () => ipcRenderer.invoke('get-logs-path'),

    // Backup de base de datos
    realizarBackup: () => ipcRenderer.invoke('realizar-backup'),
    listarBackups: () => ipcRenderer.invoke('listar-backups'),
    restaurarBackup: (backupPath) => ipcRenderer.invoke('restaurar-backup', backupPath),

    // Logging de actividad
    registrarActividad: (tipo, usuario, descripcion, datos) =>
        ipcRenderer.invoke('registrar-actividad', tipo, usuario, descripcion, datos),
    obtenerLogHoy: () => ipcRenderer.invoke('obtener-log-hoy'),
    buscarEnLogs: (criterio, dias) => ipcRenderer.invoke('buscar-en-logs', criterio, dias),

    // Información del sistema
    platform: process.platform,
    isProduction: process.env.NODE_ENV === 'production'
});

console.log('DYSA Point Preload Script cargado');
