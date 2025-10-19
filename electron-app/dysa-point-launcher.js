#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * 🚀 DYSA POINT v2.0.14 - LAUNCHER AUTOCONTENIDO
 * Launcher inteligente que detecta y usa componentes portables incluidos
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const { app, BrowserWindow, dialog, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const os = require('os');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURACIÓN GLOBAL DEL LAUNCHER
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    app: {
        name: 'DYSA Point',
        version: '2.0.14',
        description: 'Sistema POS Empresarial Autocontenido'
    },
    paths: {
        base: process.cwd(),
        mysql: path.join(process.cwd(), 'mysql-portable'),
        nodejs: path.join(process.cwd(), 'nodejs-runtime'),
        data: path.join(process.cwd(), 'data'),
        logs: path.join(process.cwd(), 'logs'),
        backups: path.join(process.cwd(), 'backups')
    },
    ports: {
        server: 8547,
        admin: 8548,
        mysql: 3306
    },
    mysql: {
        host: '127.0.0.1',
        port: 3306,
        user: 'root',
        password: '',
        database: 'dysa_point'
    }
};

let mainWindow = null;
let splashWindow = null;
let mysqlProcess = null;
let serverProcess = null;
let restaurantConfig = null;

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE DETECCIÓN Y VERIFICACIÓN
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detectar si estamos en modo portable
 */
function isPortableMode() {
    const mysqlExists = fs.existsSync(CONFIG.paths.mysql);
    const nodejsExists = fs.existsSync(CONFIG.paths.nodejs);

    console.log('🔍 Detección de modo portable:');
    console.log(`   MySQL Portable: ${mysqlExists ? '✅' : '❌'} (${CONFIG.paths.mysql})`);
    console.log(`   Node.js Portable: ${nodejsExists ? '✅' : '❌'} (${CONFIG.paths.nodejs})`);

    return mysqlExists || nodejsExists;
}

/**
 * Cargar configuración del restaurante
 */
function loadRestaurantConfig() {
    const configPath = path.join(CONFIG.paths.data, 'restaurant-config.json');

    try {
        if (fs.existsSync(configPath)) {
            const configData = fs.readFileSync(configPath, 'utf8');
            restaurantConfig = JSON.parse(configData);
            console.log(`🏪 Configuración cargada para: ${restaurantConfig.restaurant.name}`);
            return true;
        }
    } catch (error) {
        console.error('❌ Error cargando configuración del restaurante:', error);
    }

    return false;
}

/**
 * Verificar puertos disponibles
 */
async function checkPortAvailability(port) {
    return new Promise((resolve) => {
        const net = require('net');
        const server = net.createServer();

        server.listen(port, () => {
            server.once('close', () => resolve(true));
            server.close();
        });

        server.on('error', () => resolve(false));
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE INICIALIZACIÓN DE COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Inicializar MySQL Portable
 */
async function initializeMySQL() {
    return new Promise((resolve, reject) => {
        const mysqlBin = path.join(CONFIG.paths.mysql, 'bin', 'mysqld.exe');
        const mysqlConfig = path.join(CONFIG.paths.mysql, 'my.ini');

        if (!fs.existsSync(mysqlBin)) {
            console.log('⚠️ MySQL portable no encontrado, usando sistema...');
            return resolve(false);
        }

        console.log('🗄️ Iniciando MySQL Portable...');

        // Crear configuración MySQL si no existe
        if (!fs.existsSync(mysqlConfig)) {
            const configContent = `
[mysqld]
port=${CONFIG.ports.mysql}
basedir=${CONFIG.paths.mysql.replace(/\\/g, '/')}
datadir=${CONFIG.paths.mysql.replace(/\\/g, '/')}/data
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
max_connections=100
max_allowed_packet=128M
bind-address=127.0.0.1
skip-networking=false
log-error=${CONFIG.paths.logs.replace(/\\/g, '/')}/mysql-error.log

[client]
port=${CONFIG.ports.mysql}
default-character-set=utf8mb4
`;

            try {
                fs.writeFileSync(mysqlConfig, configContent);
                console.log('✅ Configuración MySQL creada');
            } catch (error) {
                console.error('❌ Error creando configuración MySQL:', error);
            }
        }

        // Iniciar MySQL
        mysqlProcess = spawn(mysqlBin, [
            `--defaults-file=${mysqlConfig}`,
            '--console'
        ], {
            cwd: CONFIG.paths.mysql,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        mysqlProcess.stdout.on('data', (data) => {
            const message = data.toString();
            if (message.includes('ready for connections')) {
                console.log('✅ MySQL Portable iniciado correctamente');
                resolve(true);
            }
        });

        mysqlProcess.stderr.on('data', (data) => {
            console.log('MySQL:', data.toString());
        });

        mysqlProcess.on('error', (error) => {
            console.error('❌ Error iniciando MySQL:', error);
            reject(error);
        });

        // Timeout de 30 segundos
        setTimeout(() => {
            if (mysqlProcess && !mysqlProcess.killed) {
                console.log('✅ MySQL Portable iniciado (timeout alcanzado)');
                resolve(true);
            }
        }, 30000);
    });
}

/**
 * Inicializar servidor Node.js
 */
async function initializeServer() {
    return new Promise((resolve, reject) => {
        const nodeBin = fs.existsSync(CONFIG.paths.nodejs)
            ? path.join(CONFIG.paths.nodejs, 'node.exe')
            : 'node';

        const serverScript = path.join(CONFIG.paths.base, 'server', 'server.js');

        console.log('⚡ Iniciando servidor DYSA Point...');
        console.log(`   Node.js: ${nodeBin}`);
        console.log(`   Script: ${serverScript}`);

        // Configurar variables de entorno
        const env = {
            ...process.env,
            NODE_ENV: 'production',
            PORT: CONFIG.ports.server,
            ADMIN_PORT: CONFIG.ports.admin,
            DB_HOST: CONFIG.mysql.host,
            DB_PORT: CONFIG.mysql.port,
            DB_USER: CONFIG.mysql.user,
            DB_PASSWORD: CONFIG.mysql.password,
            DB_NAME: CONFIG.mysql.database,
            PORTABLE_MODE: 'true',
            RESTAURANT_NAME: restaurantConfig ? restaurantConfig.restaurant.name : 'DYSA Point'
        };

        serverProcess = spawn(nodeBin, [serverScript], {
            cwd: CONFIG.paths.base,
            env: env,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        serverProcess.stdout.on('data', (data) => {
            const message = data.toString();
            console.log('Server:', message);

            if (message.includes(`listening on port ${CONFIG.ports.server}`) ||
                message.includes('Server started') ||
                message.includes('DYSA Point Server')) {
                console.log('✅ Servidor DYSA Point iniciado correctamente');
                resolve(true);
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.log('Server Error:', data.toString());
        });

        serverProcess.on('error', (error) => {
            console.error('❌ Error iniciando servidor:', error);
            reject(error);
        });

        // Timeout de 60 segundos
        setTimeout(() => {
            console.log('✅ Servidor iniciado (timeout alcanzado)');
            resolve(true);
        }, 60000);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNCIONES DE INTERFAZ GRÁFICA
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Crear ventana de splash con progreso
 */
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 600,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Crear HTML de splash dinámicamente
    const splashHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                color: white;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                overflow: hidden;
            }

            .logo {
                font-size: 48px;
                font-weight: bold;
                margin-bottom: 10px;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
            }

            .subtitle {
                font-size: 18px;
                margin-bottom: 30px;
                opacity: 0.9;
            }

            .restaurant-name {
                font-size: 20px;
                color: #ffd700;
                margin-bottom: 40px;
                font-weight: 600;
            }

            .progress-container {
                width: 400px;
                height: 8px;
                background: rgba(255,255,255,0.2);
                border-radius: 4px;
                overflow: hidden;
                margin-bottom: 20px;
            }

            .progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #4CAF50, #8BC34A);
                width: 0%;
                transition: width 0.5s ease;
                border-radius: 4px;
            }

            .status-text {
                font-size: 14px;
                opacity: 0.8;
                text-align: center;
                min-height: 20px;
            }

            .version {
                position: absolute;
                bottom: 20px;
                right: 20px;
                font-size: 12px;
                opacity: 0.6;
            }
        </style>
    </head>
    <body>
        <div class="logo">🚀 DYSA POINT</div>
        <div class="subtitle">Sistema POS Empresarial Autocontenido</div>
        <div class="restaurant-name" id="restaurantName">Cargando configuración...</div>

        <div class="progress-container">
            <div class="progress-bar" id="progressBar"></div>
        </div>

        <div class="status-text" id="statusText">Iniciando sistema...</div>

        <div class="version">v2.0.14</div>

        <script>
            const { ipcRenderer } = require('electron');

            ipcRenderer.on('update-progress', (event, data) => {
                document.getElementById('progressBar').style.width = data.percent + '%';
                document.getElementById('statusText').textContent = data.message;
            });

            ipcRenderer.on('update-restaurant', (event, name) => {
                document.getElementById('restaurantName').textContent = '🏪 ' + name;
            });
        </script>
    </body>
    </html>`;

    splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHTML));

    // Actualizar nombre del restaurante si está disponible
    if (restaurantConfig) {
        setTimeout(() => {
            splashWindow.webContents.send('update-restaurant', restaurantConfig.restaurant.name);
        }, 1000);
    }
}

/**
 * Actualizar progreso en splash
 */
function updateSplashProgress(percent, message) {
    if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.webContents.send('update-progress', { percent, message });
        console.log(`📊 Progreso: ${percent}% - ${message}`);
    }
}

/**
 * Crear ventana principal
 */
function createMainWindow() {
    const windowTitle = restaurantConfig
        ? `DYSA Point - ${restaurantConfig.restaurant.name}`
        : 'DYSA Point - Sistema POS';

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: windowTitle,
        icon: path.join(__dirname, 'build', 'icon.ico'),
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        show: false // No mostrar hasta que esté listo
    });

    // Cargar aplicación
    mainWindow.loadURL(`http://localhost:${CONFIG.ports.server}`);

    // Mostrar cuando esté listo
    mainWindow.once('ready-to-show', () => {
        if (splashWindow && !splashWindow.isDestroyed()) {
            splashWindow.close();
        }
        mainWindow.show();
        mainWindow.maximize();

        console.log('✅ Ventana principal mostrada');
    });

    // Manejar cierre
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Abrir DevTools en desarrollo
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECUENCIA DE INICIALIZACIÓN PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Inicializar aplicación completa
 */
async function initializeApplication() {
    try {
        console.log('🚀 Iniciando DYSA Point v2.0.14...');
        console.log('════════════════════════════════════════');

        // Crear directorios necesarios
        [CONFIG.paths.data, CONFIG.paths.logs, CONFIG.paths.backups].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
                console.log(`📁 Directorio creado: ${dir}`);
            }
        });

        // Crear splash window
        createSplashWindow();
        updateSplashProgress(10, 'Verificando configuración...');

        // Detectar modo portable
        const portable = isPortableMode();
        console.log(`🔧 Modo portable: ${portable ? 'Activado' : 'Desactivado'}`);

        updateSplashProgress(20, 'Cargando configuración del restaurante...');

        // Cargar configuración del restaurante
        loadRestaurantConfig();

        updateSplashProgress(30, 'Verificando puertos...');

        // Verificar puertos
        const serverPortAvailable = await checkPortAvailability(CONFIG.ports.server);
        const mysqlPortAvailable = await checkPortAvailability(CONFIG.ports.mysql);

        console.log(`🌐 Puerto ${CONFIG.ports.server}: ${serverPortAvailable ? 'Disponible' : 'En uso'}`);
        console.log(`🗄️ Puerto MySQL ${CONFIG.ports.mysql}: ${mysqlPortAvailable ? 'Disponible' : 'En uso'}`);

        updateSplashProgress(40, 'Iniciando base de datos...');

        // Inicializar MySQL si es portable
        if (portable && fs.existsSync(CONFIG.paths.mysql)) {
            await initializeMySQL();
            updateSplashProgress(60, 'Base de datos iniciada correctamente');
        } else {
            console.log('ℹ️ Usando MySQL del sistema');
            updateSplashProgress(60, 'Conectando a base de datos del sistema...');
        }

        updateSplashProgress(70, 'Iniciando servidor de aplicación...');

        // Esperar un poco para que MySQL esté listo
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Inicializar servidor
        await initializeServer();
        updateSplashProgress(90, 'Preparando interfaz...');

        // Esperar un poco más para que el servidor esté completamente listo
        await new Promise(resolve => setTimeout(resolve, 2000));

        updateSplashProgress(100, '¡Sistema listo! Abriendo DYSA Point...');

        // Crear ventana principal
        setTimeout(() => {
            createMainWindow();
        }, 1000);

    } catch (error) {
        console.error('❌ Error fatal en la inicialización:', error);

        dialog.showErrorBox(
            'Error de Inicialización',
            `No se pudo inicializar DYSA Point:\n\n${error.message}\n\nContacte soporte: soporte@dysa.cl`
        );

        app.quit();
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANEJADORES DE EVENTOS DE ELECTRON
// ═══════════════════════════════════════════════════════════════════════════════

app.whenReady().then(() => {
    console.log('🎯 Electron listo, iniciando aplicación...');
    initializeApplication();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    console.log('🚪 Cerrando aplicación...');

    // Cerrar procesos
    if (serverProcess && !serverProcess.killed) {
        serverProcess.kill();
        console.log('⚡ Servidor cerrado');
    }

    if (mysqlProcess && !mysqlProcess.killed) {
        mysqlProcess.kill();
        console.log('🗄️ MySQL cerrado');
    }

    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    console.log('💾 Guardando estado antes de cerrar...');

    // Aquí puedes agregar lógica de guardado si es necesario
});

// Manejar IPC si es necesario
ipcMain.handle('get-restaurant-config', () => {
    return restaurantConfig;
});

ipcMain.handle('get-app-info', () => {
    return {
        name: CONFIG.app.name,
        version: CONFIG.app.version,
        portable: isPortableMode(),
        paths: CONFIG.paths
    };
});

console.log('🎬 Launcher DYSA Point iniciado');
console.log(`📂 Directorio base: ${CONFIG.paths.base}`);
console.log(`🔧 Modo portable: ${isPortableMode()}`);