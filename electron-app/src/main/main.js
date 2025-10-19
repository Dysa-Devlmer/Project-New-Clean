// ═══════════════════════════════════════════════════════════════
// DYSA POINT - ELECTRON MAIN PROCESS
// Aplicación de escritorio profesional para Windows 8/10/11
// ═══════════════════════════════════════════════════════════════

const { app, BrowserWindow, ipcMain, Menu, Tray, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const log = require('electron-log');
const { autoUpdater } = require('electron-updater');
const AutoLaunch = require('auto-launch');
const BackupService = require('./backup-service');
const ActivityLogger = require('./activity-logger');

// Configuración de logging
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
log.info('DYSA Point iniciando...');

// ═══════════════════════════════════════════════════════════════
// VARIABLES GLOBALES
// ═══════════════════════════════════════════════════════════════

let mainWindow = null;
let backendProcess = null;
let tray = null;
let isQuitting = false;
let backupService = null;
let activityLogger = null;
const isDevelopment = process.env.NODE_ENV === 'development';
const PORT = process.env.PORT || 8547;

// Rutas de recursos
const getResourcePath = (relativePath) => {
    if (isDevelopment) {
        return path.join(__dirname, '../../..', relativePath);
    }
    return path.join(process.resourcesPath, relativePath);
};

// Auto-inicio al arrancar Windows (solo para PC principal)
const daysaAutoLauncher = new AutoLaunch({
    name: 'DYSA Point',
    path: process.execPath,
    isHidden: false
});

// ═══════════════════════════════════════════════════════════════
// VERIFICACIÓN DE LICENCIA
// ═══════════════════════════════════════════════════════════════

function verificarLicencia() {
    try {
        const licenseModulePath = getResourcePath('backend/licencia.js');
        log.info('Verificando licencia desde:', licenseModulePath);

        const LicenseManager = require(licenseModulePath);
        const licenseManager = new LicenseManager();
        const licenseResult = licenseManager.verify();

        if (!licenseResult.valid) {
            const errorMsg = licenseManager.getErrorMessage(licenseResult);
            log.error('Licencia inválida:', errorMsg);

            dialog.showErrorBox(
                'Error de Licencia',
                'DYSA Point no tiene una licencia válida.\n\n' +
                errorMsg +
                '\n\nContacte a soporte@dysa.cl para obtener una licencia.'
            );

            return false;
        }

        log.info('✓ Licencia válida:', licenseResult.type);
        log.info('  Expira:', licenseResult.expirationDate);
        return true;

    } catch (error) {
        log.error('Error al verificar licencia:', error);
        dialog.showErrorBox(
            'Error Crítico',
            'No se pudo verificar la licencia del sistema.\n\n' +
            'Error: ' + error.message
        );
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════
// GESTIÓN DEL BACKEND NODE.JS
// ═══════════════════════════════════════════════════════════════

function iniciarBackend() {
    return new Promise((resolve, reject) => {
        try {
            const backendPath = getResourcePath('backend');
            const serverPath = path.join(backendPath, 'src/server.js');

            log.info('Iniciando backend desde:', backendPath);
            log.info('Script del servidor:', serverPath);

            // Verificar que el archivo existe
            if (!fs.existsSync(serverPath)) {
                throw new Error(`No se encontró el servidor en: ${serverPath}`);
            }

            // Configurar variables de entorno para el backend
            const env = {
                ...process.env,
                PORT: PORT.toString(),
                NODE_ENV: isDevelopment ? 'development' : 'production',
                DB_HOST: 'localhost',
                DB_PORT: '3306',
                DB_USER: 'devlmer',
                DB_PASSWORD: 'devlmer2025',
                DB_NAME: 'dysa_point'
            };

            // Iniciar proceso del backend
            backendProcess = spawn('node', [serverPath], {
                cwd: backendPath,
                env: env,
                stdio: ['ignore', 'pipe', 'pipe']
            });

            // Capturar salida del backend
            backendProcess.stdout.on('data', (data) => {
                const output = data.toString().trim();
                log.info('[Backend]', output);

                // Detectar cuando el servidor está listo
                if (output.includes('SERVIDOR SYSME INICIADO') ||
                    output.includes('Puerto:')) {
                    resolve();
                }
            });

            backendProcess.stderr.on('data', (data) => {
                const output = data.toString().trim();
                log.warn('[Backend Error]', output);
            });

            backendProcess.on('error', (error) => {
                log.error('Error al iniciar backend:', error);
                reject(error);
            });

            backendProcess.on('exit', (code, signal) => {
                log.warn(`Backend terminado con código ${code}, señal ${signal}`);
                backendProcess = null;

                if (!isQuitting) {
                    dialog.showErrorBox(
                        'Error del Servidor',
                        'El servidor backend se detuvo inesperadamente.\n\n' +
                        'La aplicación necesita reiniciarse.'
                    );
                    app.quit();
                }
            });

            // Timeout de 15 segundos
            setTimeout(() => {
                if (backendProcess && !backendProcess.killed) {
                    resolve(); // Asumir que inició correctamente
                }
            }, 15000);

        } catch (error) {
            log.error('Error al iniciar backend:', error);
            reject(error);
        }
    });
}

function detenerBackend() {
    if (backendProcess && !backendProcess.killed) {
        log.info('Deteniendo backend...');

        // Intentar cerrar gracefully
        backendProcess.kill('SIGTERM');

        // Forzar después de 5 segundos
        setTimeout(() => {
            if (backendProcess && !backendProcess.killed) {
                log.warn('Forzando cierre del backend...');
                backendProcess.kill('SIGKILL');
            }
        }, 5000);
    }
}

// ═══════════════════════════════════════════════════════════════
// CREACIÓN DE VENTANA PRINCIPAL
// ═══════════════════════════════════════════════════════════════

async function crearVentanaPrincipal() {
    log.info('Creando ventana principal...');

    mainWindow = new BrowserWindow({
        width: 1366,
        height: 768,
        minWidth: 1024,
        minHeight: 600,
        show: false,
        backgroundColor: '#1a1a1a',
        icon: path.join(__dirname, '../../assets/icons/icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            preload: path.join(__dirname, '../preload/preload.js')
        },
        frame: true,
        titleBarStyle: 'default'
    });

    // Maximizar en pantalla completa (modo kiosko suave)
    mainWindow.maximize();

    // Cargar la página principal
    const startUrl = isDevelopment
        ? path.join(__dirname, '../../renderer/cajera/index.html')
        : path.join(__dirname, '../../renderer/cajera/index.html');

    log.info('Cargando URL:', startUrl);

    // Esperar un poco para que el backend esté listo
    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
        await mainWindow.loadFile(startUrl);
        log.info('✓ Página cargada correctamente');
    } catch (error) {
        log.error('Error al cargar página:', error);
        dialog.showErrorBox(
            'Error al Iniciar',
            'No se pudo cargar la interfaz del sistema.\n\n' +
            'Verifique que el servidor backend esté funcionando.'
        );
        app.quit();
        return;
    }

    // Mostrar ventana cuando esté lista
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        log.info('✓ Ventana principal visible');

        // Abrir DevTools solo en desarrollo
        if (isDevelopment) {
            mainWindow.webContents.openDevTools();
        }
    });

    // Prevenir cierre, minimizar al tray
    mainWindow.on('close', (event) => {
        if (!isQuitting) {
            event.preventDefault();
            mainWindow.hide();

            if (tray && !tray.isDestroyed()) {
                tray.displayBalloon({
                    title: 'DYSA Point',
                    content: 'La aplicación sigue ejecutándose en segundo plano'
                });
            }
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Manejar errores de renderizado
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        log.error('Error al cargar página:', errorCode, errorDescription);
    });

    mainWindow.webContents.on('crashed', () => {
        log.error('La ventana ha crasheado');
        const options = {
            type: 'error',
            title: 'Error Crítico',
            message: 'La aplicación ha encontrado un error crítico.',
            buttons: ['Reiniciar', 'Salir']
        };

        dialog.showMessageBox(options).then((result) => {
            if (result.response === 0) {
                app.relaunch();
                app.exit(0);
            } else {
                app.quit();
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════
// SYSTEM TRAY
// ═══════════════════════════════════════════════════════════════

function crearSystemTray() {
    const iconPath = path.join(__dirname, '../../assets/icons/tray-icon.ico');

    tray = new Tray(iconPath);

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Mostrar DYSA Point',
            click: () => {
                if (mainWindow) {
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Ocultar',
            click: () => {
                if (mainWindow) {
                    mainWindow.hide();
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Verificar Actualizaciones',
            click: () => {
                verificarActualizaciones();
            }
        },
        { type: 'separator' },
        {
            label: 'Salir',
            click: () => {
                isQuitting = true;
                app.quit();
            }
        }
    ]);

    tray.setToolTip('DYSA Point - Sistema POS');
    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
        }
    });

    log.info('✓ System tray creado');
}

// ═══════════════════════════════════════════════════════════════
// AUTO-ACTUALIZACIONES
// ═══════════════════════════════════════════════════════════════

function configurarAutoUpdater() {
    // Configuración de auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.on('checking-for-update', () => {
        log.info('Verificando actualizaciones...');
    });

    autoUpdater.on('update-available', (info) => {
        log.info('Actualización disponible:', info.version);

        const options = {
            type: 'info',
            title: 'Actualización Disponible',
            message: `Hay una nueva versión disponible (${info.version}).\n\n¿Desea descargar e instalar ahora?`,
            buttons: ['Descargar', 'Más Tarde']
        };

        dialog.showMessageBox(mainWindow, options).then((result) => {
            if (result.response === 0) {
                autoUpdater.downloadUpdate();

                // Mostrar progreso
                if (mainWindow) {
                    mainWindow.webContents.send('update-downloading');
                }
            }
        });
    });

    autoUpdater.on('update-not-available', () => {
        log.info('No hay actualizaciones disponibles');
    });

    autoUpdater.on('download-progress', (progressObj) => {
        const message = `Descargando: ${Math.round(progressObj.percent)}%`;
        log.info(message);

        if (mainWindow) {
            mainWindow.webContents.send('update-progress', progressObj.percent);
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        log.info('Actualización descargada');

        const options = {
            type: 'info',
            title: 'Actualización Lista',
            message: 'La actualización se ha descargado. Se instalará al cerrar la aplicación.\n\n¿Desea reiniciar ahora?',
            buttons: ['Reiniciar', 'Más Tarde']
        };

        dialog.showMessageBox(mainWindow, options).then((result) => {
            if (result.response === 0) {
                isQuitting = true;
                autoUpdater.quitAndInstall();
            }
        });
    });

    autoUpdater.on('error', (error) => {
        log.error('Error en auto-updater:', error);
    });
}

function verificarActualizaciones() {
    if (isDevelopment) {
        log.info('Auto-update deshabilitado en desarrollo');
        return;
    }

    autoUpdater.checkForUpdates();
}

// ═══════════════════════════════════════════════════════════════
// INICIALIZACIÓN DE LA APLICACIÓN
// ═══════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
    log.info('Electron app ready');

    // 1. Verificar licencia
    log.info('Paso 1/4: Verificando licencia...');
    const licenciaValida = verificarLicencia();
    if (!licenciaValida) {
        app.quit();
        return;
    }

    // 2. Iniciar backend
    log.info('Paso 2/4: Iniciando backend...');
    try {
        await iniciarBackend();
        log.info('✓ Backend iniciado correctamente');
    } catch (error) {
        log.error('Error al iniciar backend:', error);
        dialog.showErrorBox(
            'Error al Iniciar',
            'No se pudo iniciar el servidor backend.\n\n' +
            'Verifique que MySQL esté instalado y funcionando.'
        );
        app.quit();
        return;
    }

    // 3. Crear ventana principal
    log.info('Paso 3/4: Creando ventana principal...');
    await crearVentanaPrincipal();

    // 4. Configurar system tray y auto-updater
    log.info('Paso 4/4: Configurando componentes adicionales...');
    crearSystemTray();
    configurarAutoUpdater();

    // 5. Inicializar servicios de backup y logging
    log.info('Paso 5/6: Inicializando servicios de backup y logging...');
    activityLogger = new ActivityLogger();
    activityLogger.registrar('SISTEMA', 'SISTEMA', 'DYSA Point iniciado');

    backupService = new BackupService();
    backupService.iniciarBackupsAutomaticos();
    log.info('✓ Servicios de backup y logging iniciados');

    // Verificar actualizaciones al inicio (después de 10 segundos)
    if (!isDevelopment) {
        setTimeout(() => {
            verificarActualizaciones();
        }, 10000);
    }

    // Configurar auto-inicio
    if (!isDevelopment) {
        daysaAutoLauncher.isEnabled().then((isEnabled) => {
            if (!isEnabled) {
                daysaAutoLauncher.enable();
                log.info('✓ Auto-inicio habilitado');
            }
        }).catch((err) => {
            log.error('Error al configurar auto-inicio:', err);
        });
    }

    log.info('✓ DYSA Point iniciado completamente');
});

// ═══════════════════════════════════════════════════════════════
// EVENTOS DE CIERRE
// ═══════════════════════════════════════════════════════════════

app.on('window-all-closed', () => {
    // En Windows, mantener la app corriendo en el tray
    log.info('Todas las ventanas cerradas');
});

app.on('before-quit', () => {
    log.info('Aplicación cerrándose...');
    isQuitting = true;

    // Detener servicios
    if (backupService) {
        backupService.detenerBackupsAutomaticos();
    }

    if (activityLogger) {
        activityLogger.registrar('SISTEMA', 'SISTEMA', 'DYSA Point cerrándose');
        activityLogger.cerrar();
    }

    detenerBackend();
});

app.on('quit', () => {
    log.info('Aplicación cerrada');
});

app.on('activate', () => {
    if (mainWindow === null) {
        crearVentanaPrincipal();
    } else {
        mainWindow.show();
    }
});

// ═══════════════════════════════════════════════════════════════
// IPC HANDLERS (Comunicación con el renderer)
// ═══════════════════════════════════════════════════════════════

ipcMain.handle('app-version', () => {
    return app.getVersion();
});

ipcMain.handle('check-updates', () => {
    verificarActualizaciones();
});

ipcMain.handle('quit-app', () => {
    isQuitting = true;
    app.quit();
});

ipcMain.handle('get-logs-path', () => {
    return log.transports.file.getFile().path;
});

// Handlers de backup
ipcMain.handle('realizar-backup', async () => {
    if (!backupService) return { success: false, error: 'Servicio de backup no iniciado' };

    try {
        const filePath = await backupService.realizarBackup();
        if (activityLogger) {
            activityLogger.backupRealizado(true, filePath);
        }
        return { success: true, file: filePath };
    } catch (error) {
        log.error('Error en backup manual:', error);
        if (activityLogger) {
            activityLogger.backupRealizado(false);
        }
        return { success: false, error: error.message };
    }
});

ipcMain.handle('listar-backups', () => {
    if (!backupService) return [];
    return backupService.obtenerListaBackups();
});

ipcMain.handle('restaurar-backup', async (event, backupPath) => {
    if (!backupService) return { success: false, error: 'Servicio de backup no iniciado' };

    try {
        await backupService.restaurarBackup(backupPath);
        if (activityLogger) {
            activityLogger.registrar('RESTAURACION', 'ADMINISTRADOR', 'Backup restaurado', { archivo: backupPath });
        }
        return { success: true };
    } catch (error) {
        log.error('Error al restaurar backup:', error);
        return { success: false, error: error.message };
    }
});

// Handlers de logging
ipcMain.handle('registrar-actividad', (event, tipo, usuario, descripcion, datos) => {
    if (activityLogger) {
        activityLogger.registrar(tipo, usuario, descripcion, datos);
    }
    return { success: true };
});

ipcMain.handle('obtener-log-hoy', () => {
    if (!activityLogger) return '';
    return activityLogger.obtenerLogHoy();
});

ipcMain.handle('buscar-en-logs', (event, criterio, dias) => {
    if (!activityLogger) return [];
    return activityLogger.buscar(criterio, dias || 7);
});

log.info('DYSA Point Main Process cargado');
