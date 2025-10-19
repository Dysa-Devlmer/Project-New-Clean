/**
 * DYSA Point - Cliente API
 * Manejo de todas las comunicaciones con el backend
 * Compatible con sistema de autenticación JWT
 * Fecha: 18 de Octubre 2025
 */

class DysaAPIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL || window.location.origin;
        this.token = localStorage.getItem('dysa_auth_token');
        this.requestTimeout = 30000; // 30 segundos

        // Cache para datos frecuentemente accedidos
        this.cache = {
            empleados: null,
            productos: null,
            mesas: null,
            categorias: null
        };

        console.log('🔧 API Client inicializado:', this.baseURL);
    }

    // Configuración de headers estándar
    getHeaders(includeAuth = true) {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (includeAuth && this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        return headers;
    }

    // Método base para realizar requests
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;

        const config = {
            timeout: this.requestTimeout,
            headers: this.getHeaders(options.auth !== false),
            ...options
        };

        try {
            console.log(`🌐 API Request: ${options.method || 'GET'} ${endpoint}`);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);

            const response = await fetch(url, {
                ...config,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Verificar si la respuesta es JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Respuesta no válida del servidor (${response.status})`);
            }

            const result = await response.json();

            // Manejo de errores de autenticación
            if (response.status === 401) {
                this.handleAuthError();
                throw new Error('Sesión expirada. Debe iniciar sesión nuevamente.');
            }

            if (!response.ok) {
                throw new Error(result.error || `Error HTTP ${response.status}`);
            }

            console.log(`✅ API Response: ${endpoint}`, result.success ? 'SUCCESS' : 'ERROR');
            return result;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.error('❌ Request timeout:', endpoint);
                throw new Error('Tiempo de espera agotado. Verifique su conexión.');
            }

            console.error(`❌ API Error (${endpoint}):`, error);
            throw error;
        }
    }

    // GET request
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;

        return this.request(url, { method: 'GET' });
    }

    // POST request
    async post(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    // PUT request
    async put(endpoint, data = {}) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    // DELETE request
    async delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }

    // Configurar token de autenticación
    setAuthToken(token) {
        this.token = token;
        localStorage.setItem('dysa_auth_token', token);
    }

    // Limpiar autenticación
    clearAuth() {
        this.token = null;
        localStorage.removeItem('dysa_auth_token');
        this.clearCache();
    }

    // Manejo de errores de autenticación
    handleAuthError() {
        this.clearAuth();
        // Recargar página para mostrar login
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    }

    // Limpiar cache
    clearCache() {
        this.cache = {
            empleados: null,
            productos: null,
            mesas: null,
            categorias: null
        };
    }

    // ======================
    // MÉTODOS DE AUTENTICACIÓN
    // ======================

    async login(usuario, password) {
        const result = await this.post('/api/auth/login', { usuario, password });

        if (result.success) {
            this.setAuthToken(result.data.token);
        }

        return result;
    }

    async verify() {
        if (!this.token) {
            throw new Error('No hay token de autenticación');
        }

        return this.post('/api/auth/verify', { token: this.token });
    }

    async logout() {
        try {
            await this.post('/api/auth/logout');
        } finally {
            this.clearAuth();
        }
    }

    // ======================
    // MÉTODOS DE EMPLEADOS
    // ======================

    async getEmpleados(useCache = true) {
        if (useCache && this.cache.empleados) {
            return { success: true, data: this.cache.empleados };
        }

        const result = await this.get('/api/auth/empleados');

        if (result.success && useCache) {
            this.cache.empleados = result.data;
        }

        return result;
    }

    // ======================
    // MÉTODOS DE MESAS
    // ======================

    async getMesas(useCache = true) {
        if (useCache && this.cache.mesas) {
            return { success: true, data: this.cache.mesas };
        }

        const result = await this.get('/api/mesas');

        if (result.success && useCache) {
            this.cache.mesas = result.data;
        }

        return result;
    }

    async getMesaById(id) {
        return this.get(`/api/mesas/${id}`);
    }

    async updateMesaEstado(id, estado) {
        const result = await this.put(`/api/mesas/${id}/estado`, { estado });

        // Limpiar cache de mesas
        this.cache.mesas = null;

        return result;
    }

    // ======================
    // MÉTODOS DE PRODUCTOS
    // ======================

    async getProductos(useCache = true) {
        if (useCache && this.cache.productos) {
            return { success: true, data: this.cache.productos };
        }

        const result = await this.get('/api/productos');

        if (result.success && useCache) {
            this.cache.productos = result.data;
        }

        return result;
    }

    async getCategorias(useCache = true) {
        if (useCache && this.cache.categorias) {
            return { success: true, data: this.cache.categorias };
        }

        const result = await this.get('/api/productos/categorias');

        if (result.success && useCache) {
            this.cache.categorias = result.data;
        }

        return result;
    }

    async getProductosByCategoria(categoriaId) {
        return this.get(`/api/productos/categoria/${categoriaId}`);
    }

    async buscarProductos(termino) {
        return this.get('/api/productos/buscar', { q: termino });
    }

    // ======================
    // MÉTODOS DE VENTAS
    // ======================

    async crearVenta(data) {
        return this.post('/api/ventas', data);
    }

    async getVentas(filtros = {}) {
        return this.get('/api/ventas', filtros);
    }

    async getVentaById(id) {
        return this.get(`/api/ventas/${id}`);
    }

    async agregarProductoVenta(ventaId, productoData) {
        return this.post(`/api/ventas/${ventaId}/productos`, productoData);
    }

    async actualizarLineaVenta(ventaId, lineaId, data) {
        return this.put(`/api/ventas/${ventaId}/lineas/${lineaId}`, data);
    }

    async eliminarLineaVenta(ventaId, lineaId) {
        return this.delete(`/api/ventas/${ventaId}/lineas/${lineaId}`);
    }

    async finalizarVenta(ventaId, pagoData) {
        return this.post(`/api/ventas/${ventaId}/finalizar`, pagoData);
    }

    async cancelarVenta(ventaId, motivo) {
        return this.post(`/api/ventas/${ventaId}/cancelar`, { motivo });
    }

    // ======================
    // MÉTODOS DE PAGOS
    // ======================

    async getFormasPago() {
        return this.get('/api/pagos/formas');
    }

    async procesarPago(ventaId, pagoData) {
        return this.post(`/api/pagos/procesar/${ventaId}`, pagoData);
    }

    // ======================
    // MÉTODOS DE COCINA
    // ======================

    async getOrdenesCocina() {
        return this.get('/api/cocina/ordenes');
    }

    async marcarProductoListo(ventaId, lineaId) {
        return this.post(`/api/cocina/marcar-listo`, { ventaId, lineaId });
    }

    async getEstadoCocina() {
        return this.get('/api/cocina/estado');
    }

    // ======================
    // MÉTODOS DE CAJA
    // ======================

    async abrirCaja(montoApertura) {
        return this.post('/api/caja/abrir', { montoApertura });
    }

    async cerrarCaja() {
        return this.post('/api/caja/cerrar');
    }

    async getEstadoCaja() {
        return this.get('/api/caja/estado');
    }

    async getMovimientosCaja(fecha = null) {
        const params = fecha ? { fecha } : {};
        return this.get('/api/caja/movimientos', params);
    }

    // ======================
    // MÉTODOS DE REPORTES
    // ======================

    async getReporteVentas(filtros = {}) {
        return this.get('/api/reportes/ventas', filtros);
    }

    async getReporteCaja(fecha) {
        return this.get('/api/reportes/caja', { fecha });
    }

    async getReporteProductos(filtros = {}) {
        return this.get('/api/reportes/productos', filtros);
    }

    // ======================
    // MÉTODOS DE SISTEMA
    // ======================

    async getHealth() {
        return this.get('/health', { auth: false });
    }

    async getSystemInfo() {
        return this.get('/api/system/info');
    }

    async getConfiguracion() {
        return this.get('/api/sistema/configuracion');
    }

    // ======================
    // UTILIDADES
    // ======================

    // Formatear moneda
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-CL', {
            style: 'currency',
            currency: 'CLP'
        }).format(amount);
    }

    // Formatear fecha
    formatDate(date) {
        return new Intl.DateTimeFormat('es-CL', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(new Date(date));
    }

    // Validar conexión
    async checkConnection() {
        try {
            await this.getHealth();
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Crear instancia global del cliente API
const dysaAPI = new DysaAPIClient();

// Exponer para uso global
if (typeof window !== 'undefined') {
    window.dysaAPI = dysaAPI;
}

console.log('✅ DYSA API Client cargado exitosamente');

// Exportar para uso en módulos (si se requiere)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DysaAPIClient;
}