/**
 * DYSA Point - Main.js CREADO DESDE CERO
 * Aplicación Electron SIMPLE Y FUNCIONAL
 * Versión: 3.0.0 - Completamente Reescrita
 */

const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');

// Variables globales
let mainWindow = null;
let aboutWindow = null;

// Configuración de la aplicación
const APP_CONFIG = {
    name: 'DYSA Point POS',
    version: '3.0.0',
    company: 'DYSA Solutions',
    description: 'Sistema POS Profesional para Restaurantes'
};

/**
 * Crear ventana principal
 */
function createMainWindow() {
    console.log('🚀 Creando ventana principal de DYSA Point...');

    // Crear la ventana del navegador
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,

        // Configuración de seguridad
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, 'preload.js')
        },

        // Configuración de ventana
        title: `${APP_CONFIG.name} v${APP_CONFIG.version}`,
        icon: path.join(__dirname, 'build', 'icon.ico'),
        titleBarStyle: 'default',
        autoHideMenuBar: false,
        resizable: true,
        minimizable: true,
        maximizable: true,
        closable: true,

        // Mostrar inmediatamente
        show: true,

        // Centro de pantalla
        center: true
    });

    // Cargar la interfaz principal (cajera)
    const interfacePath = path.join(__dirname, 'renderer', 'cajera', 'index.html');
    console.log(`📂 Cargando interfaz desde: ${interfacePath}`);

    mainWindow.loadFile(interfacePath);

    // Configurar menú de aplicación
    setupApplicationMenu();

    // Eventos de la ventana
    mainWindow.on('closed', () => {
        console.log('🔒 Ventana principal cerrada');
        mainWindow = null;
    });

    // Abrir DevTools en desarrollo
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    console.log('✅ Ventana principal creada exitosamente');
    return mainWindow;
}

/**
 * Configurar menú de la aplicación
 */
function setupApplicationMenu() {
    const template = [
        {
            label: 'Archivo',
            submenu: [
                {
                    label: 'Cambiar Interfaz',
                    submenu: [
                        {
                            label: 'Cajera/Caja',
                            click: () => switchInterface('cajera')
                        },
                        {
                            label: 'Garzón/Mesero',
                            click: () => switchInterface('garzon')
                        },
                        {
                            label: 'Configuración',
                            click: () => switchInterface('setup')
                        }
                    ]
                },
                { type: 'separator' },
                {
                    label: 'Recargar',
                    accelerator: 'F5',
                    click: () => {
                        if (mainWindow) {
                            mainWindow.reload();
                        }
                    }
                },
                { type: 'separator' },
                {
                    label: 'Salir',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Ver',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Ventana',
            submenu: [
                { role: 'minimize' },
                { role: 'close' }
            ]
        },
        {
            label: 'Ayuda',
            submenu: [
                {
                    label: 'Acerca de DYSA Point',
                    click: () => showAboutDialog()
                },
                {
                    label: 'Documentación',
                    click: () => {
                        require('electron').shell.openExternal('https://dysa.cl/documentacion');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

/**
 * Cambiar interfaz de usuario
 */
function switchInterface(interfaceType) {
    if (!mainWindow) return;

    const interfaces = {
        'cajera': 'renderer/cajera/index.html',
        'garzon': 'renderer/garzon/index.html',
        'setup': 'renderer/setup/index.html'
    };

    const interfacePath = interfaces[interfaceType];
    if (interfacePath) {
        console.log(`🔄 Cambiando a interfaz: ${interfaceType}`);
        mainWindow.loadFile(path.join(__dirname, interfacePath));
    }
}

/**
 * Mostrar diálogo "Acerca de"
 */
function showAboutDialog() {
    if (aboutWindow) {
        aboutWindow.focus();
        return;
    }

    aboutWindow = new BrowserWindow({
        width: 400,
        height: 300,
        resizable: false,
        minimizable: false,
        maximizable: false,
        modal: true,
        parent: mainWindow,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    const aboutHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Acerca de DYSA Point</title>
        <style>
            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
                margin: 0;
                padding: 20px;
                text-align: center;
                background: #f5f5f5;
            }
            .container {
                background: white;
                padding: 30px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            h1 { color: #2196F3; margin-bottom: 10px; }
            .version { color: #666; font-size: 14px; }
            .description { margin: 20px 0; color: #444; }
            .company { font-weight: bold; color: #333; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>${APP_CONFIG.name}</h1>
            <div class="version">Versión ${APP_CONFIG.version}</div>
            <div class="description">${APP_CONFIG.description}</div>
            <div class="company">${APP_CONFIG.company}</div>
            <div style="margin-top: 20px; font-size: 12px; color: #888;">
                © 2025 DYSA Solutions. Todos los derechos reservados.
            </div>
        </div>
    </body>
    </html>
    `;

    aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(aboutHtml)}`);

    aboutWindow.on('closed', () => {
        aboutWindow = null;
    });
}

/**
 * Configurar IPC (comunicación con renderer)
 */
function setupIPC() {
    // Obtener información de la aplicación
    ipcMain.handle('get-app-info', () => {
        return {
            name: APP_CONFIG.name,
            version: APP_CONFIG.version,
            company: APP_CONFIG.company,
            description: APP_CONFIG.description
        };
    });

    // Cambiar interfaz desde renderer
    ipcMain.handle('switch-interface', (event, interfaceType) => {
        switchInterface(interfaceType);
        return { success: true };
    });

    // Recargar aplicación
    ipcMain.handle('reload-app', () => {
        if (mainWindow) {
            mainWindow.reload();
            return { success: true };
        }
        return { success: false };
    });

    console.log('✅ IPC configurado correctamente');
}

/**
 * Eventos de la aplicación
 */
function setupAppEvents() {
    // Aplicación lista
    app.whenReady().then(() => {
        console.log('🚀 Aplicación Electron lista');

        // Configurar IPC
        setupIPC();

        // Crear ventana principal
        createMainWindow();
    });

    // Todas las ventanas cerradas
    app.on('window-all-closed', () => {
        console.log('🔒 Todas las ventanas cerradas');

        // En macOS es común que las apps permanezcan activas
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    // Activar (macOS)
    app.on('activate', () => {
        console.log('🔄 Aplicación activada');

        // En macOS, recrear ventana cuando se hace clic en el dock
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });

    // Aplicación lista para cerrar
    app.on('before-quit', () => {
        console.log('👋 Cerrando aplicación DYSA Point...');
    });
}

/**
 * Inicialización principal
 */
function initialize() {
    console.log('🎯 Inicializando DYSA Point...');
    console.log(`📋 Configuración: ${JSON.stringify(APP_CONFIG)}`);

    // Configurar eventos de la aplicación
    setupAppEvents();

    console.log('✅ Inicialización completada');
}

// Ejecutar solo si es el archivo principal
if (require.main === module) {
    initialize();
}

module.exports = {
    createMainWindow,
    switchInterface,
    APP_CONFIG
};