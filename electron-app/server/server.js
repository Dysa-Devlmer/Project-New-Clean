/**
 * DYSA Point - Servidor Integrado para Electron
 * Backend Node.js empaquetado en aplicación de escritorio
 *
 * Este servidor se ejecuta dentro del proceso principal de Electron
 * y proporciona todas las APIs necesarias para el sistema POS
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const https = require('https');
const { app: electronApp } = require('electron');

// Importar gestor de base de datos
const DatabaseManager = require('./database/database-manager');

// Importar sistema de autenticación
const AuthenticationManager = require('./middleware/auth');
const AuthRoutes = require('./routes/auth');

// Importar sistema de garzones
const GarzonAuthManager = require('./middleware/garzon-auth');
const GarzonRoutes = require('./routes/garzones');

// Importar sistema de ventas
const VentasManager = require('./services/ventas');
const VentasRoutes = require('./routes/ventas');

// Importar sistema de mesas
const MesasManager = require('./services/mesas');
const MesasRoutes = require('./routes/mesas');

// Importar sistema de bloques de cocina
const BloquesCocinaManager = require('./services/bloques-cocina');
const BloquesCocinaRoutes = require('./routes/bloques-cocina');

// Importar sistema de aparcar ventas
const AparcamientoManager = require('./services/aparcar-ventas');
const AparcamientoRoutes = require('./routes/aparcar-ventas');

// Importar sistema de pre-tickets
const PreticketManager = require('./services/pretickets');
const PreticketRoutes = require('./routes/pretickets');

// Importar sistema de tarifas múltiples
const TarifasManager = require('./services/tarifas-multiples');
const TarifasMultiplesRoutes = require('./routes/tarifas-multiples');

// Importar sistema de mapa visual de mesas
const MapaVisualManager = require('./services/mapa-visual-mesas');
const MapaVisualMesasRoutes = require('./routes/mapa-visual-mesas');

// Importar sistema de configuración inicial
const ConfiguracionInicialManager = require('./services/configuracion-inicial');
const ConfiguracionInicialRoutes = require('./routes/configuracion-inicial');

// Importar sistema de backup automático
const BackupAutomaticoManager = require('./services/backup-automatico');
const BackupAutomaticoRoutes = require('./routes/backup-automatico');

// Importar sistema de monitoreo y alertas
const MonitoreoAlertasManager = require('./services/monitoreo-alertas');
const MonitoreoAlertasRoutes = require('./routes/monitoreo-alertas');

// Importar sistema de documentación técnica
const DocumentacionTecnicaManager = require('./services/documentacion-tecnica');
const DocumentacionTecnicaRoutes = require('./routes/documentacion-tecnica');

// Importar sistema de actualizaciones automáticas
const ActualizacionesAutomaticasManager = require('./services/actualizaciones-automaticas');
const ActualizacionesAutomaticasRoutes = require('./routes/actualizaciones-automaticas');

// Importar sistema de interfaz web de administración
const InterfazWebAdminManager = require('./services/interfaz-web-admin');
const InterfazWebAdminRoutes = require('./routes/interfaz-web-admin');

// Importar sistema de logs empresariales
const LogsEmpresarialesManager = require('./services/logs-empresariales');
const LogsEmpresarialesRoutes = require('./routes/logs-empresariales');

// Importar sistema de optimización para alto volumen
const OptimizacionAltoVolumenManager = require('./services/optimizacion-alto-volumen');
const OptimizacionAltoVolumenRoutes = require('./routes/optimizacion-alto-volumen');

// Importar sistema de soporte remoto
const SoporteRemotoManager = require('./services/soporte-remoto');
const SoporteRemotoRoutes = require('./routes/soporte-remoto');

// Importar sistema de control de caja (NUEVO - CRÍTICO)
const ControlCajaManager = require('./services/control-caja');
const ControlCajaRoutes = require('./routes/control-caja-routes');

// Importar sistema de folios fiscales (NUEVO - CRÍTICO)
const FoliosFiscalesManager = require('./services/folios-fiscales');
const FoliosFiscalesRoutes = require('./routes/folios-fiscales-routes');

// Importar sistema de control de personal (NUEVO - IMPORTANTE)
const ControlPersonalManager = require('./services/control-personal');
const ControlPersonalRoutes = require('./routes/control-personal-routes');

class ServerManager {
    constructor(port = 8547) {
        this.port = port;
        this.app = null;
        this.server = null;
        this.isRunning = false;
        this.httpsEnabled = false;
        this.database = null;
        this.authManager = null;
        this.garzonAuthManager = null;
        this.ventasManager = null;
        this.mesasManager = null;
        this.bloquesCocinaManager = null;
        this.aparcamientoManager = null;
        this.preticketManager = null;
        this.tarifasManager = null;
        this.mapaVisualManager = null;
        this.configuracionInicialManager = null;
        this.backupAutomaticoManager = null;
        this.monitoreoAlertasManager = null;
        this.documentacionTecnicaManager = null;
        this.actualizacionesAutomaticasManager = null;
        this.interfazWebAdminManager = null;
        this.logsEmpresarialesManager = null;
        this.optimizacionAltoVolumenManager = null;
        this.soporteRemotoManager = null;

        // Nuevos sistemas críticos
        this.controlCajaManager = null;
        this.foliosFiscalesManager = null;
        this.controlPersonalManager = null;
    }

    async start() {
        try {
            console.log('🚀 Iniciando servidor integrado DYSA Point...');

            // Inicializar base de datos
            await this.initializeDatabase();

            // Inicializar sistema de autenticación
            await this.initializeAuthentication();

            // Crear aplicación Express
            this.app = express();

            // Configurar middlewares
            this.setupMiddlewares();

            // Configurar rutas
            this.setupRoutes();

            // Configurar manejo de errores
            this.setupErrorHandling();

            // Configurar HTTPS si está disponible
            await this.setupHTTPS();

            // Iniciar servidor
            await this.startServer();

            console.log(`✅ Servidor DYSA Point iniciado en puerto ${this.port}`);
            console.log(`🔗 URL local: ${this.httpsEnabled ? 'https' : 'http'}://localhost:${this.port}`);

            this.isRunning = true;
            return true;

        } catch (error) {
            console.error('❌ Error iniciando servidor:', error);
            throw error;
        }
    }

    setupMiddlewares() {
        // CORS para comunicación cross-origin
        this.app.use(cors({
            origin: [
                'http://localhost:3000',
                'http://localhost:8547',
                'https://localhost:8547',
                'file://',
                'electron://'
            ],
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));

        // Parser de JSON
        this.app.use(bodyParser.json({ limit: '50mb' }));
        this.app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

        // Logging de requests
        this.app.use((req, res, next) => {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] ${req.method} ${req.path}`);
            next();
        });

        // Headers de seguridad
        this.app.use((req, res, next) => {
            res.header('X-Powered-By', 'DYSA Point v2.0.14');
            res.header('X-Content-Type-Options', 'nosniff');
            res.header('X-Frame-Options', 'DENY');
            res.header('X-XSS-Protection', '1; mode=block');
            next();
        });

        // Servir archivos estáticos (para development)
        const publicPath = path.join(__dirname, '..', 'renderer');
        if (fs.existsSync(publicPath)) {
            this.app.use('/static', express.static(publicPath));
        }
    }

    async initializeDatabase() {
        try {
            console.log('🗄️ Inicializando conexión a base de datos...');

            this.database = new DatabaseManager({
                host: 'localhost',
                port: 3306,
                user: 'devlmer',
                password: 'devlmer2025',
                database: 'dysa_point'
            });

            // Conectar e inicializar la BD
            await this.database.initialize();

            console.log('✅ Base de datos inicializada correctamente');
            return true;
        } catch (error) {
            console.error('❌ Error inicializando base de datos:', error);
            // No lanzar error aquí, permitir que el servidor inicie sin BD
            // El setup inicial manejará la configuración
            return false;
        }
    }

    async initializeAuthentication() {
        try {
            console.log('🔐 Inicializando sistemas de autenticación...');

            if (!this.database) {
                console.warn('⚠️ Base de datos no disponible, saltando inicialización de autenticación');
                return false;
            }

            // Inicializar sistema de autenticación completo (para administradores)
            this.authManager = new AuthenticationManager(this.database);

            // Inicializar sistema de garzones (para operación del restaurante)
            this.garzonAuthManager = new GarzonAuthManager(this.database);

            // Inicializar sistema de ventas
            this.ventasManager = new VentasManager(this.database);

            // Inicializar sistema de mesas
            this.mesasManager = new MesasManager(this.database);

            // Inicializar sistema de bloques de cocina
            this.bloquesCocinaManager = new BloquesCocinaManager(this.database);

            // Inicializar sistema de aparcar ventas
            this.aparcamientoManager = new AparcamientoManager(this.database);

            // Inicializar sistema de pre-tickets
            this.preticketManager = new PreticketManager(this.database);

            // Inicializar sistema de tarifas múltiples
            this.tarifasManager = new TarifasManager(this.database);

            // Inicializar sistema de mapa visual de mesas
            this.mapaVisualManager = new MapaVisualManager(this.database);

            // Inicializar sistema de configuración inicial
            this.configuracionInicialManager = new ConfiguracionInicialManager(this.database);

            // Inicializar sistema de backup automático
            this.backupAutomaticoManager = new BackupAutomaticoManager(this.database);
            await this.backupAutomaticoManager.inicializar();

            // Inicializar sistema de monitoreo y alertas
            this.monitoreoAlertasManager = new MonitoreoAlertasManager(this.database);
            await this.monitoreoAlertasManager.inicializar();

            // Inicializar sistema de documentación técnica
            this.documentacionTecnicaManager = new DocumentacionTecnicaManager(this.database);
            await this.documentacionTecnicaManager.inicializar();

            // Inicializar sistema de actualizaciones automáticas
            this.actualizacionesAutomaticasManager = new ActualizacionesAutomaticasManager(this.database);
            await this.actualizacionesAutomaticasManager.inicializar();

            // Inicializar sistema de interfaz web de administración
            this.interfazWebAdminManager = new InterfazWebAdminManager(this.database);
            await this.interfazWebAdminManager.inicializar();

            // Inicializar sistema de logs empresariales
            this.logsEmpresarialesManager = new LogsEmpresarialesManager(this.database);
            await this.logsEmpresarialesManager.inicializar();

            // Inicializar sistema de optimización para alto volumen
            this.optimizacionAltoVolumenManager = new OptimizacionAltoVolumenManager(this.database);
            await this.optimizacionAltoVolumenManager.inicializar();

            // Inicializar sistema de soporte remoto
            this.soporteRemotoManager = new SoporteRemotoManager(this.database);
            await this.soporteRemotoManager.inicializarSistema();

            // NUEVOS SISTEMAS CRÍTICOS - Basados en análisis SYSME original

            // Inicializar sistema de control de caja obligatorio
            this.controlCajaManager = new ControlCajaManager(this.database);
            await this.controlCajaManager.inicializar();

            // Inicializar sistema de folios fiscales correlativos
            this.foliosFiscalesManager = new FoliosFiscalesManager(this.database);
            await this.foliosFiscalesManager.inicializar();

            // Inicializar sistema de control de personal y asistencias
            this.controlPersonalManager = new ControlPersonalManager(this.database);
            await this.controlPersonalManager.inicializar();

            // Inicializar actualizaciones en tiempo real
            this.mesasManager.iniciarActualizacionesPeriodicas();

            // Inicializar limpieza automática de sesiones
            this.authManager.startSessionCleanup();

            console.log('✅ Sistemas de autenticación inicializados correctamente');
            return true;

        } catch (error) {
            console.error('❌ Error inicializando autenticación:', error);
            return false;
        }
    }

    setupInitialRoutes() {
        // Rutas de configuración inicial y status básico
        this.app.get('/setup/status', (req, res) => {
            res.json({
                success: true,
                message: 'Sistema de configuración inicial',
                database_connected: this.database ? true : false,
                timestamp: new Date().toISOString()
            });
        });

        // Ruta para verificar conectividad de base de datos
        this.app.get('/setup/database-check', async (req, res) => {
            try {
                if (!this.database) {
                    return res.status(503).json({
                        success: false,
                        error: 'Base de datos no inicializada'
                    });
                }

                const [result] = await this.database.connection.execute('SELECT 1 as connected');
                res.json({
                    success: true,
                    connected: true,
                    result: result[0]
                });
            } catch (error) {
                res.status(503).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    setupRoutes() {
        // Verificación de salud del servidor
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'OK',
                message: 'DYSA Point Electron Server funcionando',
                timestamp: new Date().toISOString(),
                version: '2.0.14',
                environment: 'electron',
                uptime: process.uptime()
            });
        });

        // Información del sistema
        this.app.get('/system-info', (req, res) => {
            res.json({
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.version,
                electronVersion: process.versions.electron,
                pid: process.pid,
                memory: process.memoryUsage(),
                cpu: process.cpuUsage()
            });
        });

        // Rutas específicas del setup inicial
        this.setupInitialRoutes();

        // Cargar rutas de autenticación y sistemas principales (incluyendo nuevos sistemas críticos)
        if (this.authManager && this.garzonAuthManager && this.ventasManager && this.mesasManager && this.bloquesCocinaManager && this.aparcamientoManager && this.preticketManager && this.tarifasManager && this.mapaVisualManager && this.configuracionInicialManager && this.backupAutomaticoManager && this.monitoreoAlertasManager && this.documentacionTecnicaManager && this.actualizacionesAutomaticasManager && this.interfazWebAdminManager && this.logsEmpresarialesManager && this.optimizacionAltoVolumenManager && this.soporteRemotoManager && this.controlCajaManager && this.foliosFiscalesManager && this.controlPersonalManager) {
            try {
                // Rutas de autenticación administrativa
                const authRoutes = new AuthRoutes(this.authManager, this.database);
                this.app.use('/api/auth', authRoutes.getRouter());

                // Rutas de garzones
                const garzonRoutes = new GarzonRoutes(this.garzonAuthManager, this.database);
                this.app.use('/api/garzones', garzonRoutes.getRouter());

                // Rutas de ventas y comandas
                const ventasRoutes = new VentasRoutes(this.ventasManager, this.database);
                this.app.use('/api/ventas', ventasRoutes.getRouter());

                // Rutas de gestión de mesas
                const mesasRoutes = new MesasRoutes(this.mesasManager, this.database);
                this.app.use('/api/mesas', mesasRoutes.getRouter());

                // Rutas de bloques de cocina
                const bloquesCocinaRoutes = new BloquesCocinaRoutes(this.bloquesCocinaManager, this.database);
                this.app.use('/api/bloques-cocina', bloquesCocinaRoutes.getRouter());

                // Rutas de aparcar ventas
                const aparcamientoRoutes = new AparcamientoRoutes(this.aparcamientoManager, this.database);
                this.app.use('/api/aparcar-ventas', aparcamientoRoutes.getRouter());

                // Rutas de pre-tickets
                const preticketRoutes = new PreticketRoutes(this.preticketManager, this.database);
                this.app.use('/api/pretickets', preticketRoutes.getRouter());

                // Rutas de tarifas múltiples
                const tarifasMultiplesRoutes = new TarifasMultiplesRoutes(this.tarifasManager, this.database);
                this.app.use('/api/tarifas', tarifasMultiplesRoutes.getRouter());

                // Rutas de mapa visual de mesas
                const mapaVisualMesasRoutes = new MapaVisualMesasRoutes(this.mapaVisualManager, this.database);
                this.app.use('/api/mapa-visual', mapaVisualMesasRoutes.getRouter());

                // Rutas de configuración inicial
                const configuracionInicialRoutes = new ConfiguracionInicialRoutes(this.configuracionInicialManager, this.database);
                this.app.use('/api/configuracion', configuracionInicialRoutes.getRouter());

                // Rutas de backup automático
                const backupAutomaticoRoutes = new BackupAutomaticoRoutes(this.backupAutomaticoManager, this.database);
                this.app.use('/api/backup', backupAutomaticoRoutes.getRouter());

                // Rutas de monitoreo y alertas
                const monitoreoAlertasRoutes = new MonitoreoAlertasRoutes(this.monitoreoAlertasManager, this.database);
                this.app.use('/api/monitoreo', monitoreoAlertasRoutes.getRouter());

                // Rutas de documentación técnica
                const documentacionTecnicaRoutes = new DocumentacionTecnicaRoutes(this.documentacionTecnicaManager, this.database);
                this.app.use('/api/documentacion', documentacionTecnicaRoutes.getRouter());

                // Rutas de actualizaciones automáticas
                const actualizacionesAutomaticasRoutes = new ActualizacionesAutomaticasRoutes(this.actualizacionesAutomaticasManager, this.database);
                this.app.use('/api/actualizaciones', actualizacionesAutomaticasRoutes.getRouter());

                // Rutas de interfaz web de administración
                const interfazWebAdminRoutes = new InterfazWebAdminRoutes(this.interfazWebAdminManager, this.database);
                this.app.use('/admin', interfazWebAdminRoutes.getRouter());

                // Rutas de logs empresariales
                const logsEmpresarialesRoutes = new LogsEmpresarialesRoutes(this.logsEmpresarialesManager, this.database);
                this.app.use('/api/logs', logsEmpresarialesRoutes.getRouter());

                // Rutas de optimización para alto volumen
                const optimizacionAltoVolumenRoutes = new OptimizacionAltoVolumenRoutes(this.optimizacionAltoVolumenManager, this.database);
                this.app.use('/api/performance', optimizacionAltoVolumenRoutes.getRouter());

                // Rutas de soporte remoto
                SoporteRemotoRoutes(this.app, this.soporteRemotoManager);

                // RUTAS DE NUEVOS SISTEMAS CRÍTICOS

                // Rutas de control de caja
                const controlCajaRoutes = ControlCajaRoutes(this.controlCajaManager, this.database);
                this.app.use('/api/control-caja', controlCajaRoutes);

                // Rutas de folios fiscales
                const foliosFiscalesRoutes = FoliosFiscalesRoutes(this.foliosFiscalesManager, this.database);
                this.app.use('/api/folios-fiscales', foliosFiscalesRoutes);

                // Rutas de control de personal
                const controlPersonalRoutes = ControlPersonalRoutes(this.controlPersonalManager, this.database);
                this.app.use('/api/control-personal', controlPersonalRoutes);

                console.log('✅ Rutas de sistemas principales cargadas correctamente (incluidos 3 sistemas críticos nuevos)');
            } catch (error) {
                console.error('❌ Error cargando rutas de sistemas:', error);
            }
        }

        // Cargar rutas de la API
        try {
            // Ruta principal de la API
            const apiRouter = require('./routes/api');
            this.app.use('/api', apiRouter);

            // Rutas específicas
            const clientesRouter = require('./routes/clientes');
            this.app.use('/api/clientes', clientesRouter);

            console.log('✅ Rutas de API cargadas correctamente');
        } catch (error) {
            console.error('❌ Error cargando rutas:', error);

            // Fallback - crear rutas básicas
            this.app.get('/api/test', (req, res) => {
                res.json({
                    success: true,
                    message: 'API funcionando - modo básico',
                    timestamp: new Date().toISOString()
                });
            });
        }

        // Ruta catch-all para debugging
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint no encontrado',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString()
            });
        });
    }

    setupErrorHandling() {
        // Manejo de errores 404
        this.app.use((req, res, next) => {
            res.status(404).json({
                success: false,
                error: 'Recurso no encontrado',
                path: req.path,
                timestamp: new Date().toISOString()
            });
        });

        // Manejo de errores generales
        this.app.use((error, req, res, next) => {
            console.error('❌ Error del servidor:', error);

            res.status(error.status || 500).json({
                success: false,
                error: error.message || 'Error interno del servidor',
                timestamp: new Date().toISOString(),
                ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
            });
        });
    }

    async setupHTTPS() {
        // Intentar configurar HTTPS para comunicación segura
        try {
            const userDataPath = electronApp.getPath('userData');
            const certPath = path.join(userDataPath, 'certificates');

            // Verificar si existen certificados
            const keyPath = path.join(certPath, 'server.key');
            const certFilePath = path.join(certPath, 'server.crt');

            if (fs.existsSync(keyPath) && fs.existsSync(certFilePath)) {
                this.httpsOptions = {
                    key: fs.readFileSync(keyPath),
                    cert: fs.readFileSync(certFilePath)
                };
                this.httpsEnabled = true;
                console.log('🔒 HTTPS habilitado con certificados locales');
            } else {
                console.log('📡 HTTP habilitado (sin certificados HTTPS)');
            }
        } catch (error) {
            console.warn('⚠️ No se pudo configurar HTTPS:', error.message);
        }
    }

    async startServer() {
        return new Promise((resolve, reject) => {
            try {
                if (this.httpsEnabled && this.httpsOptions) {
                    this.server = https.createServer(this.httpsOptions, this.app);
                } else {
                    this.server = this.app;
                }

                this.server.listen(this.port, '0.0.0.0', (error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });

                // Manejo de errores del servidor
                this.server.on('error', (error) => {
                    if (error.code === 'EADDRINUSE') {
                        console.error(`❌ Puerto ${this.port} en uso. Intentando puerto alternativo...`);
                        this.port += 1;
                        setTimeout(() => this.startServer(), 1000);
                    } else {
                        console.error('❌ Error del servidor:', error);
                        reject(error);
                    }
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    async stop() {
        if (this.server && this.isRunning) {
            return new Promise((resolve) => {
                console.log('🛑 Deteniendo servidor...');

                // Limpiar sistemas de autenticación
                if (this.garzonAuthManager) {
                    this.garzonAuthManager.cleanup();
                }

                // Limpiar sistema de ventas
                if (this.ventasManager) {
                    this.ventasManager.cleanup();
                }

                // Limpiar sistema de mesas
                if (this.mesasManager) {
                    this.mesasManager.cleanup();
                }

                // Limpiar sistema de bloques de cocina
                if (this.bloquesCocinaManager) {
                    this.bloquesCocinaManager.cleanup();
                }

                // Limpiar sistema de aparcar ventas
                if (this.aparcamientoManager) {
                    this.aparcamientoManager.cleanup();
                }

                // Limpiar sistema de pre-tickets
                if (this.preticketManager) {
                    this.preticketManager.cleanup();
                }

                // Limpiar sistema de tarifas múltiples
                if (this.tarifasManager) {
                    this.tarifasManager.cleanup();
                }

                // Limpiar sistema de mapa visual de mesas
                if (this.mapaVisualManager) {
                    this.mapaVisualManager.cleanup();
                }

                // Limpiar sistema de configuración inicial
                if (this.configuracionInicialManager) {
                    this.configuracionInicialManager.cleanup();
                }

                // Limpiar sistema de backup automático
                if (this.backupAutomaticoManager) {
                    this.backupAutomaticoManager.cleanup();
                }

                // Limpiar sistema de monitoreo y alertas
                if (this.monitoreoAlertasManager) {
                    this.monitoreoAlertasManager.cleanup();
                }

                // Limpiar sistema de documentación técnica
                if (this.documentacionTecnicaManager) {
                    this.documentacionTecnicaManager.cleanup();
                }

                // Limpiar sistema de actualizaciones automáticas
                if (this.actualizacionesAutomaticasManager) {
                    this.actualizacionesAutomaticasManager.cleanup();
                }

                // Limpiar sistema de interfaz web de administración
                if (this.interfazWebAdminManager) {
                    this.interfazWebAdminManager.cleanup();
                }

                // Limpiar sistema de logs empresariales
                if (this.logsEmpresarialesManager) {
                    this.logsEmpresarialesManager.cleanup();
                }

                // Limpiar sistema de optimización alto volumen
                if (this.optimizacionAltoVolumenManager) {
                    this.optimizacionAltoVolumenManager.cleanup();
                }

                // Limpiar sistema de soporte remoto
                if (this.soporteRemotoManager) {
                    this.soporteRemotoManager.cleanup();
                }

                // Cerrar base de datos
                if (this.database) {
                    this.database.close();
                }

                this.server.close(() => {
                    console.log('✅ Servidor detenido');
                    this.isRunning = false;
                    resolve();
                });
            });
        }
    }

    async restart() {
        console.log('🔄 Reiniciando servidor...');
        await this.stop();
        await this.start();
        return true;
    }

    getPort() {
        return this.port;
    }

    isServerRunning() {
        return this.isRunning;
    }

    getServerInfo() {
        return {
            port: this.port,
            running: this.isRunning,
            https: this.httpsEnabled,
            uptime: this.isRunning ? process.uptime() : 0,
            pid: process.pid
        };
    }
}

module.exports = ServerManager;

// Si el archivo se ejecuta directamente (no como módulo), iniciar el servidor
if (require.main === module) {
    const server = new ServerManager(8547);

    server.start()
        .then(() => {
            console.log('🎉 Servidor DYSA Point listo y funcionando');

            // Mantener el proceso activo
            process.on('SIGINT', async () => {
                console.log('\n🔄 Cerrando servidor de manera segura...');
                await server.stop();
                process.exit(0);
            });
        })
        .catch((error) => {
            console.error('💥 Error crítico al iniciar servidor:', error);
            process.exit(1);
        });
}