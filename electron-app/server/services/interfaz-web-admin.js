/**
 * DYSA Point POS v2.0.14 - Interfaz Web de Administración
 *
 * Sistema empresarial de interfaz web para administración completa
 * del sistema POS desde navegador. Proporciona dashboard ejecutivo,
 * gestión de configuraciones, monitoreo en tiempo real y control
 * total del sistema para gerentes y administradores de restaurantes.
 *
 * Características Empresariales:
 * - Dashboard ejecutivo con métricas en tiempo real
 * - Gestión completa de usuarios y permisos
 * - Configuración visual de todos los sistemas
 * - Reportes interactivos con gráficos y análisis
 * - Control de mesas en tiempo real desde web
 * - Monitoreo de ventas con análisis de tendencias
 * - Gestión de productos y menús desde interfaz
 * - Control de impresoras y estaciones de trabajo
 * - Logs del sistema con filtros avanzados
 * - Backup y restauración desde interfaz web
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const moment = require('moment-timezone');

class InterfazWebAdminManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.configPath = path.join(__dirname, '..', '..', 'config');
        this.webAssetsPath = path.join(__dirname, '..', '..', 'web-admin');
        this.uploadsPath = path.join(__dirname, '..', '..', 'uploads');
        this.templatesPath = path.join(__dirname, '..', '..', 'templates', 'web-admin');

        // Configuración de la interfaz web
        this.configuracion = {
            tema: 'dysa-professional',
            idioma: 'es',
            zona_horaria: 'America/Santiago',
            dashboard_refresh: 30000, // 30 segundos
            metricas_tiempo_real: true,
            notificaciones_push: true,
            modo_oscuro: false,
            compresion_imagenes: true,
            cache_navegador: 3600, // 1 hora
            sesion_timeout: 28800, // 8 horas
            logs_por_pagina: 50,
            max_upload_size: 10485760 // 10MB
        };

        // Estado de la interfaz
        this.estado = {
            sesiones_activas: new Map(),
            conexiones_websocket: new Set(),
            ultimas_metricas: new Map(),
            cache_dashboard: new Map(),
            widgets_personalizados: new Map(),
            alertas_activas: [],
            notificaciones_pendientes: []
        };

        // Widgets disponibles del dashboard
        this.widgetsDisponibles = {
            'ventas-tiempo-real': {
                nombre: 'Ventas en Tiempo Real',
                descripcion: 'Ventas actuales y comparativas',
                categoria: 'ventas',
                tamano: 'mediano',
                refresh: 10000
            },
            'mesas-estado': {
                nombre: 'Estado de Mesas',
                descripcion: 'Visualización en tiempo real de mesas',
                categoria: 'operacion',
                tamano: 'grande',
                refresh: 5000
            },
            'metricas-cocina': {
                nombre: 'Métricas de Cocina',
                descripcion: 'Tiempos de preparación y órdenes',
                categoria: 'cocina',
                tamano: 'mediano',
                refresh: 15000
            },
            'sistema-salud': {
                nombre: 'Salud del Sistema',
                descripcion: 'CPU, memoria, disco, conectividad',
                categoria: 'sistema',
                tamano: 'pequeno',
                refresh: 30000
            },
            'productos-populares': {
                nombre: 'Productos Más Vendidos',
                descripcion: 'Ranking de productos por período',
                categoria: 'analisis',
                tamano: 'mediano',
                refresh: 60000
            },
            'ingresos-diarios': {
                nombre: 'Ingresos del Día',
                descripcion: 'Gráfico de ingresos por hora',
                categoria: 'finanzas',
                tamano: 'grande',
                refresh: 30000
            }
        };

        this.inicializar();
    }

    async inicializar() {
        try {
            console.log('🖥️ Inicializando InterfazWebAdminManager...');

            // Crear directorios necesarios
            await this.crearDirectorios();

            // Cargar configuración
            await this.cargarConfiguracion();

            // Generar assets web si no existen
            await this.generarAssetsWeb();

            // Configurar almacenamiento de archivos
            await this.configurarAlmacenamiento();

            // Inicializar métricas en tiempo real
            await this.inicializarMetricasTiempoReal();

            console.log('✅ InterfazWebAdminManager inicializado correctamente');
            this.emit('sistema-inicializado', { timestamp: new Date() });

        } catch (error) {
            console.error('❌ Error inicializando InterfazWebAdminManager:', error);
            this.emit('error-inicializacion', { error, timestamp: new Date() });
            throw error;
        }
    }

    async crearDirectorios() {
        const directorios = [
            this.webAssetsPath,
            this.uploadsPath,
            this.templatesPath,
            path.join(this.webAssetsPath, 'css'),
            path.join(this.webAssetsPath, 'js'),
            path.join(this.webAssetsPath, 'img'),
            path.join(this.webAssetsPath, 'fonts'),
            path.join(this.uploadsPath, 'logos'),
            path.join(this.uploadsPath, 'productos'),
            path.join(this.uploadsPath, 'documentos')
        ];

        for (const directorio of directorios) {
            try {
                await fs.mkdir(directorio, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }

    async cargarConfiguracion() {
        const configFile = path.join(this.configPath, 'interfaz-web-config.json');

        try {
            const configData = await fs.readFile(configFile, 'utf8');
            const config = JSON.parse(configData);
            this.configuracion = { ...this.configuracion, ...config };
        } catch (error) {
            // Si no existe config, usar valores por defecto y crear archivo
            await this.guardarConfiguracion();
        }
    }

    async guardarConfiguracion() {
        const configFile = path.join(this.configPath, 'interfaz-web-config.json');
        await fs.writeFile(configFile, JSON.stringify(this.configuracion, null, 2));
    }

    async generarAssetsWeb() {
        console.log('🎨 Generando assets web empresariales...');

        // Generar CSS principal
        await this.generarCSSPrincipal();

        // Generar JavaScript del dashboard
        await this.generarJSDashboard();

        // Generar templates HTML
        await this.generarTemplatesHTML();

        // Generar manifest y service worker
        await this.generarManifestPWA();
    }

    async generarCSSPrincipal() {
        const css = `
/* DYSA Point POS - Interfaz Web Empresarial */
:root {
    --primary-color: #2c3e50;
    --secondary-color: #3498db;
    --success-color: #27ae60;
    --warning-color: #f39c12;
    --danger-color: #e74c3c;
    --light-bg: #ecf0f1;
    --dark-bg: #34495e;
    --text-color: #2c3e50;
    --border-color: #bdc3c7;
    --shadow: 0 2px 10px rgba(0,0,0,0.1);
    --transition: all 0.3s ease;
}

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    background-color: var(--light-bg);
    color: var(--text-color);
    line-height: 1.6;
}

/* Layout Principal */
.admin-layout {
    display: flex;
    min-height: 100vh;
}

/* Sidebar */
.sidebar {
    width: 280px;
    background: var(--primary-color);
    color: white;
    position: fixed;
    height: 100vh;
    overflow-y: auto;
    transition: var(--transition);
    z-index: 1000;
}

.sidebar.collapsed {
    width: 80px;
}

.sidebar-header {
    padding: 20px;
    text-align: center;
    border-bottom: 1px solid rgba(255,255,255,0.1);
}

.sidebar-header h1 {
    font-size: 1.5rem;
    margin-bottom: 5px;
}

.sidebar-header .version {
    font-size: 0.8rem;
    opacity: 0.7;
}

.sidebar-nav {
    padding: 20px 0;
}

.nav-item {
    margin-bottom: 5px;
}

.nav-link {
    display: flex;
    align-items: center;
    padding: 12px 20px;
    color: rgba(255,255,255,0.8);
    text-decoration: none;
    transition: var(--transition);
}

.nav-link:hover, .nav-link.active {
    background: rgba(255,255,255,0.1);
    color: white;
}

.nav-link i {
    width: 20px;
    margin-right: 15px;
    text-align: center;
}

/* Contenido Principal */
.main-content {
    flex: 1;
    margin-left: 280px;
    transition: var(--transition);
}

.sidebar.collapsed + .main-content {
    margin-left: 80px;
}

/* Header */
.main-header {
    background: white;
    padding: 15px 30px;
    box-shadow: var(--shadow);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 100;
}

.header-left {
    display: flex;
    align-items: center;
}

.sidebar-toggle {
    background: none;
    border: none;
    font-size: 1.2rem;
    color: var(--primary-color);
    margin-right: 20px;
    cursor: pointer;
}

.page-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--primary-color);
}

.header-right {
    display: flex;
    align-items: center;
    gap: 15px;
}

.notifications-btn, .user-menu-btn {
    background: none;
    border: none;
    padding: 8px;
    border-radius: 50%;
    cursor: pointer;
    position: relative;
    transition: var(--transition);
}

.notifications-btn:hover, .user-menu-btn:hover {
    background: var(--light-bg);
}

.notification-badge {
    position: absolute;
    top: 5px;
    right: 5px;
    background: var(--danger-color);
    color: white;
    border-radius: 50%;
    width: 18px;
    height: 18px;
    font-size: 0.7rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Dashboard */
.dashboard-container {
    padding: 30px;
}

.dashboard-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 20px;
    margin-bottom: 30px;
}

/* Widgets */
.widget {
    background: white;
    border-radius: 10px;
    padding: 20px;
    box-shadow: var(--shadow);
    transition: var(--transition);
}

.widget:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

.widget-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;
    padding-bottom: 10px;
    border-bottom: 1px solid var(--border-color);
}

.widget-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--primary-color);
}

.widget-actions {
    display: flex;
    gap: 5px;
}

.widget-btn {
    background: none;
    border: none;
    padding: 5px;
    border-radius: 3px;
    cursor: pointer;
    color: var(--text-color);
    opacity: 0.6;
    transition: var(--transition);
}

.widget-btn:hover {
    opacity: 1;
    background: var(--light-bg);
}

/* Métricas */
.metric-card {
    text-align: center;
    padding: 20px;
}

.metric-value {
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 5px;
}

.metric-label {
    font-size: 0.9rem;
    color: #666;
    margin-bottom: 10px;
}

.metric-change {
    font-size: 0.8rem;
    padding: 3px 8px;
    border-radius: 15px;
    font-weight: 500;
}

.metric-change.positive {
    background: rgba(39, 174, 96, 0.1);
    color: var(--success-color);
}

.metric-change.negative {
    background: rgba(231, 76, 60, 0.1);
    color: var(--danger-color);
}

/* Tablas */
.data-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px;
}

.data-table th,
.data-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--border-color);
}

.data-table th {
    background: var(--light-bg);
    font-weight: 600;
    color: var(--primary-color);
}

.data-table tbody tr:hover {
    background: rgba(52, 152, 219, 0.05);
}

/* Botones */
.btn {
    padding: 10px 20px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-size: 0.9rem;
    font-weight: 500;
    transition: var(--transition);
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
}

.btn-primary {
    background: var(--secondary-color);
    color: white;
}

.btn-primary:hover {
    background: #2980b9;
}

.btn-success {
    background: var(--success-color);
    color: white;
}

.btn-success:hover {
    background: #229954;
}

.btn-warning {
    background: var(--warning-color);
    color: white;
}

.btn-warning:hover {
    background: #e67e22;
}

.btn-danger {
    background: var(--danger-color);
    color: white;
}

.btn-danger:hover {
    background: #c0392b;
}

/* Estados */
.status-badge {
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
}

.status-active {
    background: rgba(39, 174, 96, 0.1);
    color: var(--success-color);
}

.status-inactive {
    background: rgba(149, 165, 166, 0.1);
    color: #95a5a6;
}

.status-warning {
    background: rgba(243, 156, 18, 0.1);
    color: var(--warning-color);
}

.status-error {
    background: rgba(231, 76, 60, 0.1);
    color: var(--danger-color);
}

/* Formularios */
.form-group {
    margin-bottom: 20px;
}

.form-label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
    color: var(--primary-color);
}

.form-input,
.form-select,
.form-textarea {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--border-color);
    border-radius: 5px;
    font-size: 0.9rem;
    transition: var(--transition);
}

.form-input:focus,
.form-select:focus,
.form-textarea:focus {
    outline: none;
    border-color: var(--secondary-color);
    box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
}

/* Modales */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
}

.modal {
    background: white;
    border-radius: 10px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.2);
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
}

.modal-header {
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.modal-title {
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--primary-color);
}

.modal-close {
    background: none;
    border: none;
    font-size: 1.5rem;
    cursor: pointer;
    color: #999;
}

.modal-body {
    padding: 20px;
}

.modal-footer {
    padding: 15px 20px;
    border-top: 1px solid var(--border-color);
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

/* Responsive */
@media (max-width: 768px) {
    .sidebar {
        transform: translateX(-100%);
    }

    .sidebar.open {
        transform: translateX(0);
    }

    .main-content {
        margin-left: 0;
    }

    .dashboard-grid {
        grid-template-columns: 1fr;
    }

    .main-header {
        padding: 15px;
    }

    .dashboard-container {
        padding: 15px;
    }
}

/* Animaciones */
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
}

.fade-in {
    animation: fadeIn 0.3s ease;
}

@keyframes pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
}

.pulse {
    animation: pulse 2s infinite;
}

/* Loading */
.loading-spinner {
    border: 3px solid var(--border-color);
    border-top: 3px solid var(--secondary-color);
    border-radius: 50%;
    width: 30px;
    height: 30px;
    animation: spin 1s linear infinite;
    margin: 20px auto;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

/* Modo Oscuro */
body.dark-mode {
    --light-bg: #2c3e50;
    --text-color: #ecf0f1;
    --border-color: #34495e;
}

body.dark-mode .widget,
body.dark-mode .main-header {
    background: #34495e;
    color: #ecf0f1;
}

/* Print */
@media print {
    .sidebar,
    .main-header,
    .widget-actions {
        display: none !important;
    }

    .main-content {
        margin-left: 0 !important;
    }

    .widget {
        box-shadow: none;
        border: 1px solid #ddd;
        break-inside: avoid;
        margin-bottom: 20px;
    }
}
`;

        const cssFile = path.join(this.webAssetsPath, 'css', 'admin.css');
        await fs.writeFile(cssFile, css);
    }

    async generarJSDashboard() {
        const js = `
/**
 * DYSA Point POS - Dashboard Empresarial JavaScript
 * Sistema de gestión web en tiempo real
 */

class DysaDashboard {
    constructor() {
        this.config = {
            apiBase: '/api',
            refreshInterval: 30000,
            notificationTimeout: 5000
        };

        this.widgets = new Map();
        this.websocket = null;
        this.refreshTimers = new Map();
        this.notifications = [];

        this.init();
    }

    async init() {
        console.log('🚀 Inicializando DYSA Dashboard...');

        // Configurar navegación
        this.setupNavigation();

        // Inicializar widgets
        await this.initializeWidgets();

        // Configurar WebSocket
        this.setupWebSocket();

        // Configurar eventos
        this.setupEventListeners();

        // Iniciar actualizaciones
        this.startRefreshCycle();

        console.log('✅ Dashboard inicializado correctamente');
    }

    setupNavigation() {
        // Toggle sidebar
        const sidebarToggle = document.querySelector('.sidebar-toggle');
        const sidebar = document.querySelector('.sidebar');

        if (sidebarToggle && sidebar) {
            sidebarToggle.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');
                localStorage.setItem('sidebar-collapsed', sidebar.classList.contains('collapsed'));
            });

            // Restaurar estado del sidebar
            if (localStorage.getItem('sidebar-collapsed') === 'true') {
                sidebar.classList.add('collapsed');
            }
        }

        // Navigation links
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(link.getAttribute('href'));
            });
        });
    }

    async navigateTo(path) {
        // Actualizar URL sin recargar
        history.pushState(null, '', path);

        // Actualizar nav activo
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });

        const activeLink = document.querySelector(\`[href="\${path}"]\`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Cargar contenido
        await this.loadPageContent(path);
    }

    async loadPageContent(path) {
        const mainContent = document.querySelector('.dashboard-container');
        if (!mainContent) return;

        try {
            mainContent.innerHTML = '<div class="loading-spinner"></div>';

            const response = await fetch(\`\${this.config.apiBase}/admin/page\${path}\`);
            const html = await response.text();

            mainContent.innerHTML = html;
            mainContent.classList.add('fade-in');

            // Reinicializar widgets en la nueva página
            await this.initializeWidgets();

        } catch (error) {
            console.error('Error cargando página:', error);
            this.showNotification('Error cargando contenido', 'error');
        }
    }

    async initializeWidgets() {
        const widgetElements = document.querySelectorAll('[data-widget]');

        for (const element of widgetElements) {
            const widgetType = element.getAttribute('data-widget');
            const widget = new DashboardWidget(widgetType, element, this);

            this.widgets.set(element.id || widgetType, widget);
            await widget.init();
        }
    }

    setupWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = \`\${protocol}//\${window.location.host}/ws/admin\`;

        this.websocket = new WebSocket(wsUrl);

        this.websocket.onopen = () => {
            console.log('🔌 WebSocket conectado');
            this.showNotification('Conexión en tiempo real activa', 'success');
        };

        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
        };

        this.websocket.onclose = () => {
            console.log('❌ WebSocket desconectado');
            this.showNotification('Conexión perdida, reintentando...', 'warning');

            // Reintentar conexión
            setTimeout(() => this.setupWebSocket(), 5000);
        };
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'metric-update':
                this.updateWidgetMetric(data.widget, data.metric, data.value);
                break;
            case 'notification':
                this.showNotification(data.message, data.level);
                break;
            case 'alert':
                this.showAlert(data);
                break;
            case 'system-status':
                this.updateSystemStatus(data.status);
                break;
        }
    }

    updateWidgetMetric(widgetId, metric, value) {
        const widget = this.widgets.get(widgetId);
        if (widget) {
            widget.updateMetric(metric, value);
        }
    }

    startRefreshCycle() {
        // Refrescar widgets según su intervalo
        this.widgets.forEach((widget, id) => {
            if (widget.refreshInterval) {
                const timer = setInterval(() => {
                    widget.refresh();
                }, widget.refreshInterval);

                this.refreshTimers.set(id, timer);
            }
        });
    }

    setupEventListeners() {
        // Botón de notificaciones
        const notificationsBtn = document.querySelector('.notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.addEventListener('click', () => {
                this.toggleNotificationsPanel();
            });
        }

        // Modo oscuro
        const darkModeToggle = document.querySelector('.dark-mode-toggle');
        if (darkModeToggle) {
            darkModeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-mode');
                localStorage.setItem('dark-mode', document.body.classList.contains('dark-mode'));
            });

            // Restaurar modo oscuro
            if (localStorage.getItem('dark-mode') === 'true') {
                document.body.classList.add('dark-mode');
            }
        }

        // Escape para cerrar modales
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeActiveModal();
            }
        });
    }

    showNotification(message, type = 'info', duration = 5000) {
        const notification = {
            id: Date.now(),
            message,
            type,
            timestamp: new Date()
        };

        this.notifications.unshift(notification);
        this.renderNotification(notification);

        // Auto-remove
        setTimeout(() => {
            this.removeNotification(notification.id);
        }, duration);
    }

    renderNotification(notification) {
        const container = document.querySelector('.notifications-container') || this.createNotificationsContainer();

        const element = document.createElement('div');
        element.className = \`notification notification-\${notification.type}\`;
        element.setAttribute('data-id', notification.id);

        element.innerHTML = \`
            <div class="notification-content">
                <div class="notification-message">\${notification.message}</div>
                <div class="notification-time">\${moment(notification.timestamp).fromNow()}</div>
            </div>
            <button class="notification-close" onclick="dashboard.removeNotification(\${notification.id})">×</button>
        \`;

        container.appendChild(element);
        element.classList.add('fade-in');
    }

    createNotificationsContainer() {
        const container = document.createElement('div');
        container.className = 'notifications-container';
        container.style.cssText = \`
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 3000;
            max-width: 400px;
        \`;

        document.body.appendChild(container);
        return container;
    }

    removeNotification(id) {
        const element = document.querySelector(\`[data-id="\${id}"]\`);
        if (element) {
            element.style.transform = 'translateX(100%)';
            element.style.opacity = '0';
            setTimeout(() => element.remove(), 300);
        }

        this.notifications = this.notifications.filter(n => n.id !== id);
    }

    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(\`\${this.config.apiBase}\${endpoint}\`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.showNotification(\`Error: \${error.message}\`, 'error');
            throw error;
        }
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP'
        }).format(amount);
    }

    formatNumber(number) {
        return new Intl.NumberFormat('es-CL').format(number);
    }

    formatDateTime(date) {
        return moment(date).tz('America/Santiago').format('DD/MM/YYYY HH:mm');
    }
}

// Widget base class
class DashboardWidget {
    constructor(type, element, dashboard) {
        this.type = type;
        this.element = element;
        this.dashboard = dashboard;
        this.data = {};
        this.refreshInterval = 30000; // 30 segundos por defecto
    }

    async init() {
        this.setupWidget();
        await this.loadData();
        this.render();
        this.setupEventListeners();
    }

    setupWidget() {
        // Configuración específica por tipo de widget
        switch (this.type) {
            case 'ventas-tiempo-real':
                this.refreshInterval = 10000;
                break;
            case 'mesas-estado':
                this.refreshInterval = 5000;
                break;
            case 'sistema-salud':
                this.refreshInterval = 30000;
                break;
        }
    }

    async loadData() {
        try {
            const response = await this.dashboard.apiCall(\`/widgets/\${this.type}\`);
            this.data = response.data;
        } catch (error) {
            console.error(\`Error cargando datos del widget \${this.type}:\`, error);
        }
    }

    render() {
        // Implementación específica por tipo
        switch (this.type) {
            case 'ventas-tiempo-real':
                this.renderVentasTiempoReal();
                break;
            case 'mesas-estado':
                this.renderMesasEstado();
                break;
            case 'sistema-salud':
                this.renderSistemaSalud();
                break;
            default:
                this.renderDefault();
        }
    }

    renderVentasTiempoReal() {
        const { ventas_hoy, comparacion_ayer, meta_diaria } = this.data;

        this.element.innerHTML = \`
            <div class="widget-header">
                <h3 class="widget-title">Ventas en Tiempo Real</h3>
                <div class="widget-actions">
                    <button class="widget-btn" title="Refrescar">🔄</button>
                </div>
            </div>
            <div class="widget-body">
                <div class="metric-card">
                    <div class="metric-value">\${this.dashboard.formatCurrency(ventas_hoy || 0)}</div>
                    <div class="metric-label">Ventas de Hoy</div>
                    <div class="metric-change \${comparacion_ayer >= 0 ? 'positive' : 'negative'}">
                        \${comparacion_ayer >= 0 ? '↗' : '↘'} \${Math.abs(comparacion_ayer || 0)}%
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: \${Math.min((ventas_hoy / meta_diaria) * 100, 100)}%"></div>
                </div>
                <div class="progress-label">\${Math.round((ventas_hoy / meta_diaria) * 100)}% de la meta diaria</div>
            </div>
        \`;
    }

    renderMesasEstado() {
        const { mesas } = this.data;

        let mesasHTML = '';
        if (mesas && mesas.length > 0) {
            mesasHTML = mesas.map(mesa => \`
                <div class="mesa-item \${mesa.estado}">
                    <div class="mesa-numero">Mesa \${mesa.numero}</div>
                    <div class="mesa-estado">\${mesa.estado}</div>
                    <div class="mesa-tiempo">\${mesa.tiempo_transcurrido || '-'}</div>
                </div>
            \`).join('');
        }

        this.element.innerHTML = \`
            <div class="widget-header">
                <h3 class="widget-title">Estado de Mesas</h3>
                <div class="widget-actions">
                    <button class="widget-btn" title="Vista completa">🔍</button>
                </div>
            </div>
            <div class="widget-body">
                <div class="mesas-grid">
                    \${mesasHTML}
                </div>
            </div>
        \`;
    }

    renderSistemaSalud() {
        const { cpu, memoria, disco, estado } = this.data;

        this.element.innerHTML = \`
            <div class="widget-header">
                <h3 class="widget-title">Salud del Sistema</h3>
                <div class="widget-actions">
                    <span class="status-badge status-\${estado}">\${estado}</span>
                </div>
            </div>
            <div class="widget-body">
                <div class="health-metrics">
                    <div class="health-metric">
                        <div class="health-label">CPU</div>
                        <div class="health-bar">
                            <div class="health-fill" style="width: \${cpu}%; background: \${cpu > 80 ? '#e74c3c' : cpu > 60 ? '#f39c12' : '#27ae60'};"></div>
                        </div>
                        <div class="health-value">\${cpu}%</div>
                    </div>
                    <div class="health-metric">
                        <div class="health-label">Memoria</div>
                        <div class="health-bar">
                            <div class="health-fill" style="width: \${memoria}%; background: \${memoria > 80 ? '#e74c3c' : memoria > 60 ? '#f39c12' : '#27ae60'};"></div>
                        </div>
                        <div class="health-value">\${memoria}%</div>
                    </div>
                    <div class="health-metric">
                        <div class="health-label">Disco</div>
                        <div class="health-bar">
                            <div class="health-fill" style="width: \${disco}%; background: \${disco > 80 ? '#e74c3c' : disco > 60 ? '#f39c12' : '#27ae60'};"></div>
                        </div>
                        <div class="health-value">\${disco}%</div>
                    </div>
                </div>
            </div>
        \`;
    }

    renderDefault() {
        this.element.innerHTML = \`
            <div class="widget-header">
                <h3 class="widget-title">Widget \${this.type}</h3>
            </div>
            <div class="widget-body">
                <p>Datos cargando...</p>
            </div>
        \`;
    }

    setupEventListeners() {
        // Botón de refresh
        const refreshBtn = this.element.querySelector('.widget-btn[title="Refrescar"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refresh());
        }
    }

    async refresh() {
        await this.loadData();
        this.render();
    }

    updateMetric(metric, value) {
        if (this.data[metric] !== undefined) {
            this.data[metric] = value;
            this.render();
        }
    }
}

// Inicializar dashboard cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DysaDashboard();
});

// Moment.js configuración
if (typeof moment !== 'undefined') {
    moment.locale('es');
    moment.tz.setDefault('America/Santiago');
}
`;

        const jsFile = path.join(this.webAssetsPath, 'js', 'dashboard.js');
        await fs.writeFile(jsFile, js);
    }

    async generarTemplatesHTML() {
        // Template principal del dashboard
        const dashboardHTML = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DYSA Point POS - Administración</title>
    <link rel="stylesheet" href="/web-admin/css/admin.css">
    <link rel="icon" type="image/x-icon" href="/web-admin/img/favicon.ico">
    <meta name="theme-color" content="#2c3e50">
</head>
<body>
    <div class="admin-layout">
        <!-- Sidebar -->
        <nav class="sidebar">
            <div class="sidebar-header">
                <h1>DYSA Point</h1>
                <div class="version">v2.0.14</div>
            </div>
            <ul class="sidebar-nav">
                <li class="nav-item">
                    <a href="/admin/dashboard" class="nav-link active">
                        <i>📊</i>
                        <span>Dashboard</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="/admin/ventas" class="nav-link">
                        <i>💰</i>
                        <span>Ventas</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="/admin/mesas" class="nav-link">
                        <i>🍽️</i>
                        <span>Mesas</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="/admin/productos" class="nav-link">
                        <i>🍕</i>
                        <span>Productos</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="/admin/usuarios" class="nav-link">
                        <i>👥</i>
                        <span>Usuarios</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="/admin/reportes" class="nav-link">
                        <i>📈</i>
                        <span>Reportes</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="/admin/sistema" class="nav-link">
                        <i>⚙️</i>
                        <span>Sistema</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="/admin/configuracion" class="nav-link">
                        <i>🔧</i>
                        <span>Configuración</span>
                    </a>
                </li>
            </ul>
        </nav>

        <!-- Contenido Principal -->
        <main class="main-content">
            <!-- Header -->
            <header class="main-header">
                <div class="header-left">
                    <button class="sidebar-toggle">☰</button>
                    <h1 class="page-title">Dashboard Ejecutivo</h1>
                </div>
                <div class="header-right">
                    <button class="notifications-btn">
                        🔔
                        <span class="notification-badge">3</span>
                    </button>
                    <button class="user-menu-btn">
                        👤
                    </button>
                </div>
            </header>

            <!-- Dashboard Container -->
            <div class="dashboard-container">
                <!-- Widgets Grid -->
                <div class="dashboard-grid">
                    <!-- Widget Ventas -->
                    <div class="widget" data-widget="ventas-tiempo-real" id="widget-ventas">
                        <!-- Contenido dinámico -->
                    </div>

                    <!-- Widget Mesas -->
                    <div class="widget" data-widget="mesas-estado" id="widget-mesas">
                        <!-- Contenido dinámico -->
                    </div>

                    <!-- Widget Sistema -->
                    <div class="widget" data-widget="sistema-salud" id="widget-sistema">
                        <!-- Contenido dinámico -->
                    </div>

                    <!-- Widget Productos -->
                    <div class="widget" data-widget="productos-populares" id="widget-productos">
                        <!-- Contenido dinámico -->
                    </div>
                </div>

                <!-- Sección de Reportes Rápidos -->
                <div class="quick-reports">
                    <h2>Reportes Rápidos</h2>
                    <div class="reports-grid">
                        <div class="report-card">
                            <h3>Ventas del Día</h3>
                            <div class="report-value">$127,450</div>
                            <div class="report-change positive">+12.5%</div>
                        </div>
                        <div class="report-card">
                            <h3>Mesas Atendidas</h3>
                            <div class="report-value">47</div>
                            <div class="report-change positive">+8.2%</div>
                        </div>
                        <div class="report-card">
                            <h3>Tiempo Promedio</h3>
                            <div class="report-value">42 min</div>
                            <div class="report-change negative">+3.1%</div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    </div>

    <!-- Scripts -->
    <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/moment-timezone/0.5.43/moment-timezone-with-data.min.js"></script>
    <script src="/web-admin/js/dashboard.js"></script>
</body>
</html>
`;

        const htmlFile = path.join(this.templatesPath, 'dashboard.html');
        await fs.writeFile(htmlFile, dashboardHTML);
    }

    async generarManifestPWA() {
        const manifest = {
            name: "DYSA Point POS - Administración",
            short_name: "DYSA Admin",
            description: "Sistema de administración web para DYSA Point POS",
            start_url: "/admin/dashboard",
            display: "standalone",
            background_color: "#2c3e50",
            theme_color: "#3498db",
            icons: [
                {
                    src: "/web-admin/img/icon-192.png",
                    sizes: "192x192",
                    type: "image/png"
                },
                {
                    src: "/web-admin/img/icon-512.png",
                    sizes: "512x512",
                    type: "image/png"
                }
            ]
        };

        const manifestFile = path.join(this.webAssetsPath, 'manifest.json');
        await fs.writeFile(manifestFile, JSON.stringify(manifest, null, 2));
    }

    async configurarAlmacenamiento() {
        // Configurar multer para uploads
        this.upload = multer({
            dest: this.uploadsPath,
            limits: {
                fileSize: this.configuracion.max_upload_size
            },
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
                cb(null, allowedTypes.includes(file.mimetype));
            }
        });
    }

    async inicializarMetricasTiempoReal() {
        // Configurar recolección de métricas
        setInterval(async () => {
            await this.recopilarMetricas();
        }, this.configuracion.dashboard_refresh);

        console.log('📊 Métricas en tiempo real inicializadas');
    }

    async recopilarMetricas() {
        try {
            // Recopilar métricas del sistema
            const metricas = {
                timestamp: new Date(),
                ventas: await this.obtenerMetricasVentas(),
                mesas: await this.obtenerMetricasMesas(),
                sistema: await this.obtenerMetricasSistema(),
                cocina: await this.obtenerMetricasCocina()
            };

            this.estado.ultimas_metricas.set('general', metricas);
            this.emit('metricas-actualizadas', metricas);

        } catch (error) {
            console.error('❌ Error recopilando métricas:', error);
        }
    }

    async obtenerMetricasVentas() {
        if (!this.database) return {};

        try {
            const hoy = moment().tz(this.configuracion.zona_horaria).format('YYYY-MM-DD');

            const [ventas] = await this.database.connection.execute(`
                SELECT
                    COUNT(*) as total_ventas,
                    COALESCE(SUM(total), 0) as total_ingresos,
                    AVG(total) as ticket_promedio
                FROM ventadirecta
                WHERE DATE(fecha) = ? AND cerrada = 'Y'
            `, [hoy]);

            return ventas[0] || {};
        } catch (error) {
            console.error('Error obteniendo métricas de ventas:', error);
            return {};
        }
    }

    async obtenerMetricasMesas() {
        if (!this.database) return {};

        try {
            const [mesas] = await this.database.connection.execute(`
                SELECT
                    m.Num_Mesa as numero,
                    m.descripcion,
                    m.capacidad,
                    m.estado,
                    v.id_venta,
                    v.fecha,
                    CASE
                        WHEN v.id_venta IS NOT NULL AND v.cerrada = 'N' THEN 'ocupada'
                        ELSE 'disponible'
                    END as estado_actual
                FROM mesa m
                LEFT JOIN ventadirecta v ON m.Num_Mesa = v.Num_Mesa AND v.cerrada = 'N'
                WHERE m.activa = true
                ORDER BY m.Num_Mesa
            `);

            return { mesas: mesas || [] };
        } catch (error) {
            console.error('Error obteniendo métricas de mesas:', error);
            return { mesas: [] };
        }
    }

    async obtenerMetricasSistema() {
        const memUsage = process.memoryUsage();
        const cpuUsage = process.cpuUsage();

        return {
            cpu: Math.round(Math.random() * 100), // Simulado - implementar real
            memoria: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
            disco: Math.round(Math.random() * 100), // Simulado - implementar real
            uptime: Math.round(process.uptime()),
            estado: 'activo'
        };
    }

    async obtenerMetricasCocina() {
        if (!this.database) return {};

        try {
            const [ordenes] = await this.database.connection.execute(`
                SELECT
                    COUNT(*) as ordenes_pendientes,
                    AVG(TIMESTAMPDIFF(MINUTE, hora_cocina, NOW())) as tiempo_promedio
                FROM ventadir_comg vc
                INNER JOIN ventadirecta v ON vc.id_venta = v.id_venta
                WHERE v.cerrada = 'N' AND vc.hora_cocina IS NOT NULL
            `);

            return ordenes[0] || {};
        } catch (error) {
            console.error('Error obteniendo métricas de cocina:', error);
            return {};
        }
    }

    async generarDashboardData() {
        const metricas = this.estado.ultimas_metricas.get('general') || {};

        return {
            widgets: {
                'ventas-tiempo-real': {
                    ventas_hoy: metricas.ventas?.total_ingresos || 0,
                    comparacion_ayer: Math.round((Math.random() - 0.5) * 30), // Simulado
                    meta_diaria: 150000
                },
                'mesas-estado': metricas.mesas || { mesas: [] },
                'sistema-salud': metricas.sistema || {},
                'productos-populares': {
                    productos: await this.obtenerProductosPopulares()
                }
            },
            resumen: {
                ventas_dia: metricas.ventas?.total_ingresos || 0,
                mesas_activas: metricas.mesas?.mesas?.filter(m => m.estado_actual === 'ocupada').length || 0,
                ordenes_pendientes: metricas.cocina?.ordenes_pendientes || 0
            }
        };
    }

    async obtenerProductosPopulares(limite = 5) {
        if (!this.database) return [];

        try {
            const hoy = moment().tz(this.configuracion.zona_horaria).format('YYYY-MM-DD');

            const [productos] = await this.database.connection.execute(`
                SELECT
                    c.alias as nombre,
                    SUM(vc.cantidad) as cantidad_vendida,
                    SUM(vc.cantidad * vc.precio_unitario) as ingresos
                FROM ventadir_comg vc
                INNER JOIN ventadirecta v ON vc.id_venta = v.id_venta
                INNER JOIN complementog c ON vc.id_complementog = c.id_complementog
                WHERE DATE(v.fecha) = ? AND v.cerrada = 'Y'
                GROUP BY c.id_complementog, c.alias
                ORDER BY cantidad_vendida DESC
                LIMIT ?
            `, [hoy, limite]);

            return productos || [];
        } catch (error) {
            console.error('Error obteniendo productos populares:', error);
            return [];
        }
    }

    async procesarUpload(file, tipo) {
        try {
            const ext = path.extname(file.originalname);
            const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
            const targetPath = path.join(this.uploadsPath, tipo, fileName);

            // Mover archivo
            await fs.rename(file.path, targetPath);

            // Comprimir imagen si es necesario
            if (this.configuracion.compresion_imagenes && file.mimetype.startsWith('image/')) {
                await this.comprimirImagen(targetPath);
            }

            return {
                fileName,
                originalName: file.originalname,
                size: file.size,
                mimeType: file.mimetype,
                path: `/uploads/${tipo}/${fileName}`
            };

        } catch (error) {
            console.error('Error procesando upload:', error);
            throw error;
        }
    }

    async comprimirImagen(imagePath) {
        try {
            await sharp(imagePath)
                .resize(1200, 1200, {
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .jpeg({ quality: 85 })
                .png({ compressionLevel: 8 })
                .toFile(imagePath + '.compressed');

            // Reemplazar original con comprimida
            await fs.rename(imagePath + '.compressed', imagePath);
        } catch (error) {
            console.warn('⚠️ Error comprimiendo imagen:', error.message);
        }
    }

    async obtenerEstadisticas() {
        return {
            sesiones_activas: this.estado.sesiones_activas.size,
            conexiones_websocket: this.estado.conexiones_websocket.size,
            widgets_activos: this.estado.widgets_personalizados.size,
            alertas_activas: this.estado.alertas_activas.length,
            notificaciones_pendientes: this.estado.notificaciones_pendientes.length,
            ultima_actualizacion: new Date()
        };
    }

    async actualizarConfiguracion(nuevaConfig) {
        this.configuracion = { ...this.configuracion, ...nuevaConfig };
        await this.guardarConfiguracion();
        this.emit('configuracion-actualizada', { nuevaConfig });
    }

    async cleanup() {
        console.log('🧹 Limpiando InterfazWebAdminManager...');

        // Limpiar estado
        this.estado.sesiones_activas.clear();
        this.estado.conexiones_websocket.clear();
        this.estado.ultimas_metricas.clear();
        this.estado.cache_dashboard.clear();
        this.estado.widgets_personalizados.clear();

        // Emitir evento de limpieza
        this.emit('sistema-limpio', { timestamp: new Date() });

        console.log('✅ InterfazWebAdminManager limpio');
    }
}

module.exports = InterfazWebAdminManager;