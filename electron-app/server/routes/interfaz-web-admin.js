/**
 * DYSA Point POS v2.0.14 - Rutas de Interfaz Web de Administración
 *
 * Sistema de rutas especializadas para la interfaz web de administración
 * empresarial. Proporciona endpoints para dashboard, gestión visual,
 * APIs de widgets en tiempo real y control completo del sistema.
 *
 * Endpoints especializados para:
 * - Dashboard ejecutivo con métricas en tiempo real
 * - Páginas de administración (usuarios, productos, reportes)
 * - APIs de widgets dinámicos
 * - Gestión de archivos y uploads
 * - WebSocket para actualizaciones en tiempo real
 * - Configuración visual del sistema
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;
const WebSocket = require('ws');

class InterfazWebAdminRoutes {
    constructor(interfazWebManager) {
        this.router = express.Router();
        this.interfazWebManager = interfazWebManager;
        this.websocketServer = null;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Rate limiting diferenciado para interfaz web
        this.rateLimiters = {
            // Límite para operaciones de gestión (crear, editar, eliminar)
            gestion: rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutos
                max: 50, // 50 operaciones por ventana
                message: {
                    error: 'Demasiadas operaciones de gestión',
                    limite: '50 operaciones cada 5 minutos'
                },
                standardHeaders: true,
                legacyHeaders: false
            }),

            // Límite para consultas de dashboard
            dashboard: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 120, // 120 consultas por minuto
                message: {
                    error: 'Demasiadas consultas de dashboard',
                    limite: '120 consultas por minuto'
                }
            }),

            // Límite para uploads
            uploads: rateLimit({
                windowMs: 10 * 60 * 1000, // 10 minutos
                max: 20, // 20 uploads por ventana
                message: {
                    error: 'Demasiados uploads',
                    limite: '20 uploads cada 10 minutos'
                }
            }),

            // Límite para APIs generales
            api: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 200, // 200 requests por minuto
                message: {
                    error: 'Demasiadas peticiones API',
                    limite: '200 requests por minuto'
                }
            })
        };

        // Middleware de logging para interfaz web
        this.router.use((req, res, next) => {
            console.log(`🖥️ InterfazWebAdmin: ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Servir assets estáticos
        this.router.use('/assets', express.static(this.interfazWebManager.webAssetsPath));
        this.router.use('/uploads', express.static(this.interfazWebManager.uploadsPath));

        // Rutas principales de páginas
        this.setupPageRoutes();

        // APIs de widgets
        this.setupWidgetAPIs();

        // APIs de gestión
        this.setupManagementAPIs();

        // APIs de configuración
        this.setupConfigurationAPIs();

        // APIs de archivos
        this.setupFileAPIs();

        // WebSocket setup
        this.setupWebSocketRoutes();
    }

    setupPageRoutes() {
        // Página principal del dashboard
        this.router.get('/', async (req, res) => {
            res.redirect('/admin/dashboard');
        });

        this.router.get('/dashboard', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const dashboardHTML = await this.generarPaginaDashboard();
                res.type('html').send(dashboardHTML);
            } catch (error) {
                console.error('❌ Error generando dashboard:', error);
                res.status(500).send('Error interno del servidor');
            }
        });

        // Página de ventas
        this.router.get('/ventas', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const ventasHTML = await this.generarPaginaVentas();
                res.type('html').send(ventasHTML);
            } catch (error) {
                console.error('❌ Error generando página de ventas:', error);
                res.status(500).send('Error interno del servidor');
            }
        });

        // Página de mesas
        this.router.get('/mesas', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const mesasHTML = await this.generarPaginaMesas();
                res.type('html').send(mesasHTML);
            } catch (error) {
                console.error('❌ Error generando página de mesas:', error);
                res.status(500).send('Error interno del servidor');
            }
        });

        // Página de productos
        this.router.get('/productos', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const productosHTML = await this.generarPaginaProductos();
                res.type('html').send(productosHTML);
            } catch (error) {
                console.error('❌ Error generando página de productos:', error);
                res.status(500).send('Error interno del servidor');
            }
        });

        // Página de usuarios
        this.router.get('/usuarios', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const usuariosHTML = await this.generarPaginaUsuarios();
                res.type('html').send(usuariosHTML);
            } catch (error) {
                console.error('❌ Error generando página de usuarios:', error);
                res.status(500).send('Error interno del servidor');
            }
        });

        // Página de reportes
        this.router.get('/reportes', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const reportesHTML = await this.generarPaginaReportes();
                res.type('html').send(reportesHTML);
            } catch (error) {
                console.error('❌ Error generando página de reportes:', error);
                res.status(500).send('Error interno del servidor');
            }
        });

        // Página de sistema
        this.router.get('/sistema', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const sistemaHTML = await this.generarPaginaSistema();
                res.type('html').send(sistemaHTML);
            } catch (error) {
                console.error('❌ Error generando página de sistema:', error);
                res.status(500).send('Error interno del servidor');
            }
        });

        // Página de configuración
        this.router.get('/configuracion', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const configuracionHTML = await this.generarPaginaConfiguracion();
                res.type('html').send(configuracionHTML);
            } catch (error) {
                console.error('❌ Error generando página de configuración:', error);
                res.status(500).send('Error interno del servidor');
            }
        });
    }

    setupWidgetAPIs() {
        // API para obtener datos de widgets específicos
        this.router.get('/api/widgets/:widgetType', this.rateLimiters.api, async (req, res) => {
            try {
                const { widgetType } = req.params;
                const dashboardData = await this.interfazWebManager.generarDashboardData();

                const widgetData = dashboardData.widgets[widgetType];

                if (!widgetData) {
                    return res.status(404).json({
                        success: false,
                        error: 'Widget no encontrado',
                        widget_solicitado: widgetType
                    });
                }

                res.json({
                    success: true,
                    data: widgetData,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error obteniendo datos de widget:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo datos del widget'
                });
            }
        });

        // API para obtener todos los datos del dashboard
        this.router.get('/api/dashboard/data', this.rateLimiters.dashboard, async (req, res) => {
            try {
                const dashboardData = await this.interfazWebManager.generarDashboardData();

                res.json({
                    success: true,
                    data: dashboardData,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error obteniendo datos del dashboard:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo datos del dashboard'
                });
            }
        });

        // API para métricas en tiempo real
        this.router.get('/api/metrics/realtime', this.rateLimiters.api, async (req, res) => {
            try {
                const metricas = this.interfazWebManager.estado.ultimas_metricas.get('general');

                if (!metricas) {
                    return res.status(404).json({
                        success: false,
                        error: 'Métricas no disponibles'
                    });
                }

                res.json({
                    success: true,
                    metricas,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error obteniendo métricas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo métricas en tiempo real'
                });
            }
        });
    }

    setupManagementAPIs() {
        // API para gestión de usuarios
        this.router.get('/api/management/usuarios', this.rateLimiters.api, async (req, res) => {
            try {
                // Obtener lista de usuarios del sistema
                const usuarios = await this.obtenerUsuarios();

                res.json({
                    success: true,
                    usuarios,
                    total: usuarios.length
                });

            } catch (error) {
                console.error('❌ Error obteniendo usuarios:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo lista de usuarios'
                });
            }
        });

        // API para gestión de productos
        this.router.get('/api/management/productos', this.rateLimiters.api, async (req, res) => {
            try {
                const { categoria, activo, limite = 50, pagina = 1 } = req.query;
                const productos = await this.obtenerProductos({ categoria, activo, limite, pagina });

                res.json({
                    success: true,
                    productos: productos.items,
                    total: productos.total,
                    pagina: parseInt(pagina),
                    total_paginas: Math.ceil(productos.total / limite)
                });

            } catch (error) {
                console.error('❌ Error obteniendo productos:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo lista de productos'
                });
            }
        });

        // API para gestión de ventas
        this.router.get('/api/management/ventas', this.rateLimiters.api, async (req, res) => {
            try {
                const { fecha_inicio, fecha_fin, estado, limite = 50, pagina = 1 } = req.query;
                const ventas = await this.obtenerVentas({ fecha_inicio, fecha_fin, estado, limite, pagina });

                res.json({
                    success: true,
                    ventas: ventas.items,
                    total: ventas.total,
                    pagina: parseInt(pagina),
                    total_paginas: Math.ceil(ventas.total / limite),
                    resumen: ventas.resumen
                });

            } catch (error) {
                console.error('❌ Error obteniendo ventas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo lista de ventas'
                });
            }
        });

        // API para crear/editar productos
        this.router.post('/api/management/productos', this.rateLimiters.gestion, async (req, res) => {
            try {
                const { nombre, precio, categoria, descripcion, activo = true } = req.body;

                // Validaciones
                if (!nombre || !precio) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre y precio son requeridos'
                    });
                }

                const nuevoProducto = await this.crearProducto({
                    nombre, precio, categoria, descripcion, activo
                });

                res.status(201).json({
                    success: true,
                    mensaje: 'Producto creado exitosamente',
                    producto: nuevoProducto
                });

            } catch (error) {
                console.error('❌ Error creando producto:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error creando producto'
                });
            }
        });
    }

    setupConfigurationAPIs() {
        // API para obtener configuración de la interfaz
        this.router.get('/api/config/interfaz', this.rateLimiters.api, async (req, res) => {
            try {
                const configuracion = this.interfazWebManager.configuracion;

                res.json({
                    success: true,
                    configuracion: {
                        tema: configuracion.tema,
                        idioma: configuracion.idioma,
                        zona_horaria: configuracion.zona_horaria,
                        dashboard_refresh: configuracion.dashboard_refresh,
                        modo_oscuro: configuracion.modo_oscuro,
                        notificaciones_push: configuracion.notificaciones_push
                    }
                });

            } catch (error) {
                console.error('❌ Error obteniendo configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo configuración'
                });
            }
        });

        // API para actualizar configuración
        this.router.put('/api/config/interfaz', this.rateLimiters.gestion, async (req, res) => {
            try {
                const {
                    tema,
                    idioma,
                    zona_horaria,
                    dashboard_refresh,
                    modo_oscuro,
                    notificaciones_push
                } = req.body;

                const nuevaConfig = {};

                // Validar y aplicar cambios
                if (tema && ['dysa-professional', 'dark', 'light'].includes(tema)) {
                    nuevaConfig.tema = tema;
                }

                if (idioma && ['es', 'en', 'pt'].includes(idioma)) {
                    nuevaConfig.idioma = idioma;
                }

                if (zona_horaria) {
                    nuevaConfig.zona_horaria = zona_horaria;
                }

                if (typeof dashboard_refresh === 'number' && dashboard_refresh >= 5000) {
                    nuevaConfig.dashboard_refresh = dashboard_refresh;
                }

                if (typeof modo_oscuro === 'boolean') {
                    nuevaConfig.modo_oscuro = modo_oscuro;
                }

                if (typeof notificaciones_push === 'boolean') {
                    nuevaConfig.notificaciones_push = notificaciones_push;
                }

                await this.interfazWebManager.actualizarConfiguracion(nuevaConfig);

                res.json({
                    success: true,
                    mensaje: 'Configuración actualizada exitosamente',
                    configuracion_aplicada: nuevaConfig
                });

            } catch (error) {
                console.error('❌ Error actualizando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando configuración'
                });
            }
        });
    }

    setupFileAPIs() {
        // API para upload de archivos
        this.router.post('/api/files/upload/:tipo', this.rateLimiters.uploads, async (req, res) => {
            try {
                const { tipo } = req.params;
                const tiposPermitidos = ['logos', 'productos', 'documentos'];

                if (!tiposPermitidos.includes(tipo)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tipo de archivo no permitido',
                        tipos_permitidos: tiposPermitidos
                    });
                }

                // Usar middleware de multer
                this.interfazWebManager.upload.single('file')(req, res, async (err) => {
                    if (err) {
                        return res.status(400).json({
                            success: false,
                            error: 'Error en upload de archivo',
                            detalles: err.message
                        });
                    }

                    if (!req.file) {
                        return res.status(400).json({
                            success: false,
                            error: 'No se proporcionó archivo'
                        });
                    }

                    try {
                        const archivoInfo = await this.interfazWebManager.procesarUpload(req.file, tipo);

                        res.json({
                            success: true,
                            mensaje: 'Archivo subido exitosamente',
                            archivo: archivoInfo
                        });

                    } catch (error) {
                        console.error('❌ Error procesando upload:', error);
                        res.status(500).json({
                            success: false,
                            error: 'Error procesando archivo'
                        });
                    }
                });

            } catch (error) {
                console.error('❌ Error en upload:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno en upload'
                });
            }
        });

        // API para listar archivos
        this.router.get('/api/files/:tipo', this.rateLimiters.api, async (req, res) => {
            try {
                const { tipo } = req.params;
                const archivos = await this.listarArchivos(tipo);

                res.json({
                    success: true,
                    archivos,
                    total: archivos.length
                });

            } catch (error) {
                console.error('❌ Error listando archivos:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error listando archivos'
                });
            }
        });
    }

    setupWebSocketRoutes() {
        // Esta función será llamada desde el servidor principal
        // para configurar el WebSocket server
        this.setupWebSocketServer = (server) => {
            this.websocketServer = new WebSocket.Server({
                server,
                path: '/ws/admin'
            });

            this.websocketServer.on('connection', (ws, req) => {
                console.log('🔌 Nueva conexión WebSocket al admin');
                this.interfazWebManager.estado.conexiones_websocket.add(ws);

                ws.on('message', (message) => {
                    try {
                        const data = JSON.parse(message);
                        this.handleWebSocketMessage(ws, data);
                    } catch (error) {
                        console.error('❌ Error procesando mensaje WebSocket:', error);
                    }
                });

                ws.on('close', () => {
                    console.log('❌ Conexión WebSocket cerrada');
                    this.interfazWebManager.estado.conexiones_websocket.delete(ws);
                });

                // Enviar datos iniciales
                this.enviarDatosIniciales(ws);
            });

            // Configurar broadcast de métricas
            this.interfazWebManager.on('metricas-actualizadas', (metricas) => {
                this.broadcastToClients({
                    type: 'metric-update',
                    data: metricas
                });
            });
        };
    }

    handleWebSocketMessage(ws, data) {
        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                break;
            case 'subscribe-widget':
                // Suscribirse a actualizaciones de widget específico
                break;
            case 'request-data':
                this.enviarDatosIniciales(ws);
                break;
        }
    }

    async enviarDatosIniciales(ws) {
        try {
            const dashboardData = await this.interfazWebManager.generarDashboardData();

            ws.send(JSON.stringify({
                type: 'initial-data',
                data: dashboardData,
                timestamp: new Date().toISOString()
            }));
        } catch (error) {
            console.error('❌ Error enviando datos iniciales:', error);
        }
    }

    broadcastToClients(message) {
        const messageStr = JSON.stringify(message);

        this.interfazWebManager.estado.conexiones_websocket.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }

    // Métodos auxiliares para generar páginas HTML
    async generarPaginaDashboard() {
        const templatePath = path.join(this.interfazWebManager.templatesPath, 'dashboard.html');

        try {
            const template = await fs.readFile(templatePath, 'utf8');
            return template;
        } catch (error) {
            return this.generarPaginaError('Error cargando dashboard');
        }
    }

    async generarPaginaVentas() {
        return this.generarPaginaBasica('Ventas', 'Gestión de ventas y transacciones', `
            <div class="page-header">
                <h1>Gestión de Ventas</h1>
                <div class="page-actions">
                    <button class="btn btn-primary">Nueva Venta</button>
                    <button class="btn btn-secondary">Exportar</button>
                </div>
            </div>
            <div class="content-grid">
                <div class="widget" data-widget="ventas-resumen">
                    <div class="widget-header">
                        <h3>Resumen de Ventas</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                <div class="widget large" data-widget="ventas-tabla">
                    <div class="widget-header">
                        <h3>Ventas Recientes</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `);
    }

    async generarPaginaMesas() {
        return this.generarPaginaBasica('Mesas', 'Control de mesas en tiempo real', `
            <div class="page-header">
                <h1>Control de Mesas</h1>
                <div class="page-actions">
                    <button class="btn btn-success">Liberar Todas</button>
                    <button class="btn btn-primary">Vista Completa</button>
                </div>
            </div>
            <div class="mesas-layout">
                <div class="widget large" data-widget="mesas-mapa">
                    <div class="widget-header">
                        <h3>Mapa Visual de Mesas</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `);
    }

    async generarPaginaProductos() {
        return this.generarPaginaBasica('Productos', 'Gestión de menú y productos', `
            <div class="page-header">
                <h1>Gestión de Productos</h1>
                <div class="page-actions">
                    <button class="btn btn-primary">Nuevo Producto</button>
                    <button class="btn btn-secondary">Importar</button>
                </div>
            </div>
            <div class="content-grid">
                <div class="widget" data-widget="productos-categorias">
                    <div class="widget-header">
                        <h3>Categorías</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                <div class="widget large" data-widget="productos-lista">
                    <div class="widget-header">
                        <h3>Lista de Productos</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `);
    }

    async generarPaginaUsuarios() {
        return this.generarPaginaBasica('Usuarios', 'Gestión de usuarios y permisos', `
            <div class="page-header">
                <h1>Gestión de Usuarios</h1>
                <div class="page-actions">
                    <button class="btn btn-primary">Nuevo Usuario</button>
                    <button class="btn btn-secondary">Permisos</button>
                </div>
            </div>
            <div class="content-grid">
                <div class="widget large" data-widget="usuarios-tabla">
                    <div class="widget-header">
                        <h3>Usuarios del Sistema</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `);
    }

    async generarPaginaReportes() {
        return this.generarPaginaBasica('Reportes', 'Análisis y reportes ejecutivos', `
            <div class="page-header">
                <h1>Reportes y Análisis</h1>
                <div class="page-actions">
                    <button class="btn btn-primary">Generar Reporte</button>
                    <button class="btn btn-secondary">Programar</button>
                </div>
            </div>
            <div class="content-grid">
                <div class="widget" data-widget="reportes-ventas">
                    <div class="widget-header">
                        <h3>Reporte de Ventas</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                <div class="widget" data-widget="reportes-productos">
                    <div class="widget-header">
                        <h3>Productos Más Vendidos</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `);
    }

    async generarPaginaSistema() {
        return this.generarPaginaBasica('Sistema', 'Estado y configuración del sistema', `
            <div class="page-header">
                <h1>Estado del Sistema</h1>
                <div class="page-actions">
                    <button class="btn btn-warning">Reiniciar</button>
                    <button class="btn btn-primary">Actualizar</button>
                </div>
            </div>
            <div class="content-grid">
                <div class="widget" data-widget="sistema-estado">
                    <div class="widget-header">
                        <h3>Estado General</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                <div class="widget" data-widget="sistema-recursos">
                    <div class="widget-header">
                        <h3>Recursos del Sistema</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `);
    }

    async generarPaginaConfiguracion() {
        return this.generarPaginaBasica('Configuración', 'Configuración del sistema', `
            <div class="page-header">
                <h1>Configuración</h1>
                <div class="page-actions">
                    <button class="btn btn-success">Guardar</button>
                    <button class="btn btn-secondary">Exportar</button>
                </div>
            </div>
            <div class="content-grid">
                <div class="widget large" data-widget="configuracion-general">
                    <div class="widget-header">
                        <h3>Configuración General</h3>
                    </div>
                    <div class="widget-body">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
            </div>
        `);
    }

    generarPaginaBasica(titulo, descripcion, contenido) {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo} - DYSA Point POS</title>
    <link rel="stylesheet" href="/admin/assets/css/admin.css">
</head>
<body>
    <div class="admin-layout">
        <nav class="sidebar">
            <div class="sidebar-header">
                <h1>DYSA Point</h1>
                <div class="version">v2.0.14</div>
            </div>
            <ul class="sidebar-nav">
                <li class="nav-item">
                    <a href="/admin/dashboard" class="nav-link">📊 Dashboard</a>
                </li>
                <li class="nav-item">
                    <a href="/admin/ventas" class="nav-link">💰 Ventas</a>
                </li>
                <li class="nav-item">
                    <a href="/admin/mesas" class="nav-link">🍽️ Mesas</a>
                </li>
                <li class="nav-item">
                    <a href="/admin/productos" class="nav-link">🍕 Productos</a>
                </li>
                <li class="nav-item">
                    <a href="/admin/usuarios" class="nav-link">👥 Usuarios</a>
                </li>
                <li class="nav-item">
                    <a href="/admin/reportes" class="nav-link">📈 Reportes</a>
                </li>
                <li class="nav-item">
                    <a href="/admin/sistema" class="nav-link">⚙️ Sistema</a>
                </li>
                <li class="nav-item">
                    <a href="/admin/configuracion" class="nav-link">🔧 Configuración</a>
                </li>
            </ul>
        </nav>
        <main class="main-content">
            <header class="main-header">
                <div class="header-left">
                    <button class="sidebar-toggle">☰</button>
                    <h1 class="page-title">${titulo}</h1>
                </div>
                <div class="header-right">
                    <button class="notifications-btn">🔔</button>
                    <button class="user-menu-btn">👤</button>
                </div>
            </header>
            <div class="dashboard-container">
                ${contenido}
            </div>
        </main>
    </div>
    <script src="/admin/assets/js/dashboard.js"></script>
</body>
</html>
        `;
    }

    generarPaginaError(mensaje) {
        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Error - DYSA Point POS</title>
</head>
<body>
    <div style="text-align: center; padding: 50px;">
        <h1>❌ Error</h1>
        <p>${mensaje}</p>
        <a href="/admin/dashboard">Volver al Dashboard</a>
    </div>
</body>
</html>
        `;
    }

    // Métodos auxiliares para datos
    async obtenerUsuarios() {
        // Implementar según base de datos
        return [
            { id: 1, nombre: 'Administrador', email: 'admin@restaurante.com', activo: true },
            { id: 2, nombre: 'Garzón 1', codigo: 'GAR001', activo: true }
        ];
    }

    async obtenerProductos(filtros) {
        // Implementar según base de datos
        return {
            items: [
                { id: 1, nombre: 'Hamburguesa Clásica', precio: 8500, categoria: 'Principales' },
                { id: 2, nombre: 'Pizza Margherita', precio: 12000, categoria: 'Principales' }
            ],
            total: 2
        };
    }

    async obtenerVentas(filtros) {
        // Implementar según base de datos
        return {
            items: [
                { id: 1, fecha: new Date(), total: 25600, mesa: 5, estado: 'cerrada' }
            ],
            total: 1,
            resumen: { total_ingresos: 25600, ventas_count: 1 }
        };
    }

    async crearProducto(datos) {
        // Implementar según base de datos
        return { id: Date.now(), ...datos };
    }

    async listarArchivos(tipo) {
        // Implementar listado de archivos
        return [];
    }

    getRouter() {
        return this.router;
    }
}

module.exports = InterfazWebAdminRoutes;