
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

        const activeLink = document.querySelector(`[href="${path}"]`);
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

            const response = await fetch(`${this.config.apiBase}/admin/page${path}`);
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
        const wsUrl = `${protocol}//${window.location.host}/ws/admin`;

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
        element.className = `notification notification-${notification.type}`;
        element.setAttribute('data-id', notification.id);

        element.innerHTML = `
            <div class="notification-content">
                <div class="notification-message">${notification.message}</div>
                <div class="notification-time">${moment(notification.timestamp).fromNow()}</div>
            </div>
            <button class="notification-close" onclick="dashboard.removeNotification(${notification.id})">×</button>
        `;

        container.appendChild(element);
        element.classList.add('fade-in');
    }

    createNotificationsContainer() {
        const container = document.createElement('div');
        container.className = 'notifications-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 3000;
            max-width: 400px;
        `;

        document.body.appendChild(container);
        return container;
    }

    removeNotification(id) {
        const element = document.querySelector(`[data-id="${id}"]`);
        if (element) {
            element.style.transform = 'translateX(100%)';
            element.style.opacity = '0';
            setTimeout(() => element.remove(), 300);
        }

        this.notifications = this.notifications.filter(n => n.id !== id);
    }

    async apiCall(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.config.apiBase}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            this.showNotification(`Error: ${error.message}`, 'error');
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
            const response = await this.dashboard.apiCall(`/widgets/${this.type}`);
            this.data = response.data;
        } catch (error) {
            console.error(`Error cargando datos del widget ${this.type}:`, error);
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

        this.element.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Ventas en Tiempo Real</h3>
                <div class="widget-actions">
                    <button class="widget-btn" title="Refrescar">🔄</button>
                </div>
            </div>
            <div class="widget-body">
                <div class="metric-card">
                    <div class="metric-value">${this.dashboard.formatCurrency(ventas_hoy || 0)}</div>
                    <div class="metric-label">Ventas de Hoy</div>
                    <div class="metric-change ${comparacion_ayer >= 0 ? 'positive' : 'negative'}">
                        ${comparacion_ayer >= 0 ? '↗' : '↘'} ${Math.abs(comparacion_ayer || 0)}%
                    </div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min((ventas_hoy / meta_diaria) * 100, 100)}%"></div>
                </div>
                <div class="progress-label">${Math.round((ventas_hoy / meta_diaria) * 100)}% de la meta diaria</div>
            </div>
        `;
    }

    renderMesasEstado() {
        const { mesas } = this.data;

        let mesasHTML = '';
        if (mesas && mesas.length > 0) {
            mesasHTML = mesas.map(mesa => `
                <div class="mesa-item ${mesa.estado}">
                    <div class="mesa-numero">Mesa ${mesa.numero}</div>
                    <div class="mesa-estado">${mesa.estado}</div>
                    <div class="mesa-tiempo">${mesa.tiempo_transcurrido || '-'}</div>
                </div>
            `).join('');
        }

        this.element.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Estado de Mesas</h3>
                <div class="widget-actions">
                    <button class="widget-btn" title="Vista completa">🔍</button>
                </div>
            </div>
            <div class="widget-body">
                <div class="mesas-grid">
                    ${mesasHTML}
                </div>
            </div>
        `;
    }

    renderSistemaSalud() {
        const { cpu, memoria, disco, estado } = this.data;

        this.element.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Salud del Sistema</h3>
                <div class="widget-actions">
                    <span class="status-badge status-${estado}">${estado}</span>
                </div>
            </div>
            <div class="widget-body">
                <div class="health-metrics">
                    <div class="health-metric">
                        <div class="health-label">CPU</div>
                        <div class="health-bar">
                            <div class="health-fill" style="width: ${cpu}%; background: ${cpu > 80 ? '#e74c3c' : cpu > 60 ? '#f39c12' : '#27ae60'};"></div>
                        </div>
                        <div class="health-value">${cpu}%</div>
                    </div>
                    <div class="health-metric">
                        <div class="health-label">Memoria</div>
                        <div class="health-bar">
                            <div class="health-fill" style="width: ${memoria}%; background: ${memoria > 80 ? '#e74c3c' : memoria > 60 ? '#f39c12' : '#27ae60'};"></div>
                        </div>
                        <div class="health-value">${memoria}%</div>
                    </div>
                    <div class="health-metric">
                        <div class="health-label">Disco</div>
                        <div class="health-bar">
                            <div class="health-fill" style="width: ${disco}%; background: ${disco > 80 ? '#e74c3c' : disco > 60 ? '#f39c12' : '#27ae60'};"></div>
                        </div>
                        <div class="health-value">${disco}%</div>
                    </div>
                </div>
            </div>
        `;
    }

    renderDefault() {
        this.element.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Widget ${this.type}</h3>
            </div>
            <div class="widget-body">
                <p>Datos cargando...</p>
            </div>
        `;
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
