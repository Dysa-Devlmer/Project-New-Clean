/**
 * DYSA Point - Preload Script
 * Script de precarga seguro para comunicación entre main y renderer
 *
 * Este script se ejecuta en un contexto aislado y proporciona
 * una API segura para que el renderer se comunique con el main process
 */

const { contextBridge, ipcRenderer } = require('electron');

// API segura expuesta al renderer process
const electronAPI = {
    // Información del sistema
    getAppConfig: () => ipcRenderer.invoke('get-app-config'),
    getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

    // Diálogos del sistema
    showMessageDialog: (options) => ipcRenderer.invoke('show-message-dialog', options),

    // Control del servidor
    restartServer: () => ipcRenderer.invoke('restart-server'),

    // Setup inicial del restaurante
    setupInitialize: (configData) => ipcRenderer.invoke('setup-initialize', configData),
    completeSetup: () => ipcRenderer.invoke('complete-setup'),

    // Comunicación con backend local
    serverAPI: {
        // GET requests
        get: async (endpoint) => {
            try {
                const config = await ipcRenderer.invoke('get-app-config');
                const response = await fetch(`http://localhost:${config.serverPort}/api${endpoint}`);
                return await response.json();
            } catch (error) {
                console.error('Error en GET:', error);
                throw error;
            }
        },

        // POST requests
        post: async (endpoint, data) => {
            try {
                const config = await ipcRenderer.invoke('get-app-config');
                const response = await fetch(`http://localhost:${config.serverPort}/api${endpoint}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                return await response.json();
            } catch (error) {
                console.error('Error en POST:', error);
                throw error;
            }
        },

        // PUT requests
        put: async (endpoint, data) => {
            try {
                const config = await ipcRenderer.invoke('get-app-config');
                const response = await fetch(`http://localhost:${config.serverPort}/api${endpoint}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });
                return await response.json();
            } catch (error) {
                console.error('Error en PUT:', error);
                throw error;
            }
        },

        // DELETE requests
        delete: async (endpoint) => {
            try {
                const config = await ipcRenderer.invoke('get-app-config');
                const response = await fetch(`http://localhost:${config.serverPort}/api${endpoint}`, {
                    method: 'DELETE'
                });
                return await response.json();
            } catch (error) {
                console.error('Error en DELETE:', error);
                throw error;
            }
        }
    },

    // Utilidades del sistema
    platform: process.platform,
    isWindows: process.platform === 'win32',
    isMac: process.platform === 'darwin',
    isLinux: process.platform === 'linux',

    // Eventos del sistema
    onAppEvent: (event, callback) => {
        ipcRenderer.on(event, callback);
    },

    removeAppEventListener: (event, callback) => {
        ipcRenderer.removeListener(event, callback);
    },

    // Notificaciones del sistema
    showNotification: (title, body) => {
        if (Notification.permission === 'granted') {
            new Notification(title, { body });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification(title, { body });
                }
            });
        }
    },

    // Almacenamiento local seguro
    storage: {
        set: (key, value) => {
            localStorage.setItem(key, JSON.stringify(value));
        },
        get: (key) => {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        },
        remove: (key) => {
            localStorage.removeItem(key);
        },
        clear: () => {
            localStorage.clear();
        }
    },

    // Información de versión y licencia
    version: '2.0.14',
    buildDate: new Date().toISOString(),

    // Logging seguro
    log: {
        info: (message) => console.log(`[INFO] ${message}`),
        warn: (message) => console.warn(`[WARN] ${message}`),
        error: (message) => console.error(`[ERROR] ${message}`)
    }
};

// Exponer API al contexto del renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Configuración adicional de seguridad
window.addEventListener('DOMContentLoaded', () => {
    // Prevenir navegación no autorizada
    document.addEventListener('click', (e) => {
        if (e.target.tagName === 'A' && e.target.href && e.target.href.startsWith('http')) {
            e.preventDefault();
            // Los enlaces externos se abren en navegador por defecto
        }
    });

    // Configurar información del sistema en el DOM
    document.body.setAttribute('data-platform', process.platform);
    document.body.setAttribute('data-version', '2.0.14');

    console.log('🔐 DYSA Point Desktop - Preload script cargado');
    console.log('📱 Plataforma:', process.platform);
    console.log('🔢 Versión:', '2.0.14');
});