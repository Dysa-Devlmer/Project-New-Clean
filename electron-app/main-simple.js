/**
 * DYSA Point - Aplicación Electron Simplificada
 * Versión sin servidor integrado complejo
 * Para testing y validación de electronAPI
 */

const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Importar módulos básicos
const LicenseManager = require('./licensing/license-validator');

class DysaPointAppSimple {
    constructor() {
        this.mainWindow = null;
        this.licenseManager = new LicenseManager();
        this.appConfig = {
            name: 'DYSA Point POS',
            version: '2.0.14',
            company: 'DYSA Solutions',
            serverPort: 8547,
            isLicensed: false
        };
    }

    async initialize() {
        console.log('🚀 Iniciando DYSA Point (versión simplificada)...');

        // Configurar eventos de la aplicación
        this.setupAppEvents();

        // Verificar licencia
        await this.validateLicense();
    }

    setupAppEvents() {
        // Aplicación lista
        app.whenReady().then(() => {
            this.createWindow();

            // macOS - crear ventana si no hay ninguna abierta
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    this.createWindow();
                }
            });
        });

        // Cerrar aplicación (Windows/Linux)
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    }

    async validateLicense() {
        try {
            const licenseValid = await this.licenseManager.validateHardwareLicense();

            if (!licenseValid) {
                console.log('❌ Licencia no válida');
                return false;
            }

            this.appConfig.isLicensed = true;
            console.log('✅ Licencia validada correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error validando licencia:', error);
            return false;
        }
    }

    createWindow() {
        // Configuración de ventana
        const windowOptions = {
            width: 1400,
            height: 900,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                preload: path.join(__dirname, 'preload.js')
            },
            icon: path.join(__dirname, 'build', 'icon.ico'),
            title: `${this.appConfig.name} v${this.appConfig.version}`,
            show: false // No mostrar hasta cargar completamente
        };

        // Crear ventana principal
        this.mainWindow = new BrowserWindow(windowOptions);

        // Cargar interfaz de cajera (modo servidor)
        this.mainWindow.loadFile(path.join(__dirname, 'renderer', 'cajera', 'index.html'));

        // Mostrar ventana cuando esté lista
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow.show();
            console.log('✅ Ventana Electron mostrada correctamente');
        });

        // Manejar cierre de ventana
        this.mainWindow.on('closed', () => {
            this.mainWindow = null;
        });

        // Configurar eventos IPC
        this.setupIPC();

        // Abrir DevTools en modo desarrollo
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.webContents.openDevTools();
        }

        console.log('🖥️ Ventana de Electron creada');
    }

    setupIPC() {
        // Comunicación con renderer process
        ipcMain.handle('get-app-config', () => this.appConfig);

        ipcMain.handle('get-system-info', () => ({
            platform: process.platform,
            arch: process.arch,
            version: process.version,
            hostname: os.hostname(),
            networkInterfaces: os.networkInterfaces()
        }));

        ipcMain.handle('show-message-dialog', async (event, options) => {
            return await dialog.showMessageBox(this.mainWindow, options);
        });

        console.log('📡 IPC configurado correctamente');
    }
}

// Inicializar aplicación
const dysaApp = new DysaPointAppSimple();

// Manejar comandos de línea
if (require.main === module) {
    dysaApp.initialize().catch(console.error);
}

module.exports = DysaPointAppSimple;