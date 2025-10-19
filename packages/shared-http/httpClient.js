/**
 * DYSA Point - Cliente HTTP Unificado
 * Usado por Electron y Web para comunicación con backend
 * Incluye interceptores, retry, manejo de auth y errores
 * Fecha: 19 de Octubre 2025
 */

const axios = require('axios');
const config = require('@dysa/shared-config');

class HttpClient {
  constructor(options = {}) {
    this.client = axios.create({
      baseURL: config.API_BASE_URL,
      timeout: config.HTTP_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Client-Type': options.clientType || 'unknown',
        'X-Client-Version': options.clientVersion || '1.0.0'
      }
    });

    this.retryConfig = {
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000
    };

    this.authCallbacks = {
      onUnauthorized: options.onUnauthorized || (() => {}),
      onTokenRefresh: options.onTokenRefresh || (() => {})
    };

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor - agregar token y headers
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Agregar timestamp para debugging
        if (config.DEBUG_MODE) {
          config.headers['X-Request-Time'] = new Date().toISOString();
        }

        // Log en desarrollo
        if (config.FEATURES.DEBUG_MODE) {
          console.log(`🚀 HTTP ${config.method?.toUpperCase()} ${config.url}`, {
            params: config.params,
            data: config.data ? Object.keys(config.data) : undefined
          });
        }

        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor - manejo de errores y retry
    this.client.interceptors.response.use(
      (response) => {
        // Log respuesta exitosa en desarrollo
        if (config.FEATURES.DEBUG_MODE) {
          console.log(`✅ HTTP ${response.status} ${response.config.url}`, {
            data: response.data?.success !== undefined ? response.data.success : 'OK'
          });
        }

        return response;
      },
      async (error) => {
        const originalRequest = error.config;

        // Log error en desarrollo
        if (config.FEATURES.DEBUG_MODE) {
          console.error(`❌ HTTP ${error.response?.status || 'NETWORK'} ${originalRequest?.url}`, {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
        }

        // Manejo de 401 - Token expirado
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await this.authCallbacks.onUnauthorized();

            // Reintentar con nuevo token
            const newToken = this.getAuthToken();
            if (newToken) {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              return this.client.request(originalRequest);
            }
          } catch (authError) {
            console.error('Error en refresh de token:', authError);
            return Promise.reject(error);
          }
        }

        // Retry para errores de red o 5xx
        if (this.shouldRetry(error) && !originalRequest._retryCount) {
          return this.retryRequest(originalRequest);
        }

        return Promise.reject(this.transformError(error));
      }
    );
  }

  // === MÉTODOS PRINCIPALES ===

  async get(url, config = {}) {
    return this.client.get(url, config);
  }

  async post(url, data = {}, config = {}) {
    return this.client.post(url, data, config);
  }

  async put(url, data = {}, config = {}) {
    return this.client.put(url, data, config);
  }

  async patch(url, data = {}, config = {}) {
    return this.client.patch(url, data, config);
  }

  async delete(url, config = {}) {
    return this.client.delete(url, config);
  }

  // === MÉTODOS ESPECÍFICOS DEL POS ===

  // Mesas
  async getMesas(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    const url = params ? `/mesas?${params}` : '/mesas';
    return this.get(url);
  }

  async getMesaById(id) {
    return this.get(`/mesas/${id}`);
  }

  async getMesasDisponibles(capacidad, zona = null) {
    const params = { capacidad };
    if (zona) params.zona = zona;

    const query = new URLSearchParams(params).toString();
    return this.get(`/mesas/disponibles?${query}`);
  }

  async getMesasEstadisticas() {
    return this.get('/mesas/estadisticas');
  }

  async cambiarEstadoMesa(id, nuevoEstado, datos = {}) {
    return this.put(`/mesas/${id}/estado`, {
      estado_nuevo: nuevoEstado,
      ...datos
    });
  }

  // Tickets (por implementar)
  async createTicket(mesaId, datos = {}) {
    return this.post('/pos/tickets', {
      mesa_id: mesaId,
      ...datos
    });
  }

  async addItemToTicket(ticketId, item) {
    return this.post(`/pos/tickets/${ticketId}/items`, item);
  }

  async splitTicket(ticketId, splitData) {
    return this.patch(`/pos/tickets/${ticketId}/split`, splitData);
  }

  // Configuración
  async getConfiguracion() {
    return this.get('/configuracion/sistema/configuracion');
  }

  // === UTILIDADES PRIVADAS ===

  getAuthToken() {
    if (typeof window !== 'undefined') {
      // Navegador
      return localStorage.getItem('dysa_auth_token') ||
             sessionStorage.getItem('dysa_auth_token');
    } else if (typeof process !== 'undefined' && process.versions?.electron) {
      // Electron - usar IPC para obtener token del main process
      try {
        const { ipcRenderer } = require('electron');
        return ipcRenderer.sendSync('get-auth-token');
      } catch (error) {
        console.warn('No se pudo obtener token desde Electron main process');
        return null;
      }
    }
    return null;
  }

  shouldRetry(error) {
    // Retry en errores de red o servidor (5xx)
    return (
      error.code === 'NETWORK_ERROR' ||
      error.code === 'ECONNABORTED' ||
      (error.response && error.response.status >= 500)
    );
  }

  async retryRequest(originalRequest) {
    originalRequest._retryCount = originalRequest._retryCount || 0;

    if (originalRequest._retryCount >= this.retryConfig.maxRetries) {
      return Promise.reject(new Error('Max retries reached'));
    }

    originalRequest._retryCount++;

    // Backoff exponencial
    const delay = this.retryConfig.retryDelay * Math.pow(2, originalRequest._retryCount - 1);

    console.log(`🔄 Retry ${originalRequest._retryCount}/${this.retryConfig.maxRetries} en ${delay}ms para ${originalRequest.url}`);

    await new Promise(resolve => setTimeout(resolve, delay));

    return this.client.request(originalRequest);
  }

  transformError(error) {
    // Transformar error de axios a formato consistente
    if (error.response) {
      // Error con respuesta del servidor
      return {
        type: 'HTTP_ERROR',
        status: error.response.status,
        message: error.response.data?.error || error.message,
        data: error.response.data,
        code: error.response.data?.code || `HTTP_${error.response.status}`
      };
    } else if (error.request) {
      // Error de red
      return {
        type: 'NETWORK_ERROR',
        message: 'Error de conexión con el servidor',
        code: 'NETWORK_ERROR',
        originalError: error.message
      };
    } else {
      // Error de configuración
      return {
        type: 'CONFIG_ERROR',
        message: error.message,
        code: 'CONFIG_ERROR'
      };
    }
  }

  // === MÉTODOS PÚBLICOS DE UTILIDAD ===

  setAuthToken(token) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dysa_auth_token', token);
    } else if (typeof process !== 'undefined' && process.versions?.electron) {
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('set-auth-token', token);
      } catch (error) {
        console.warn('No se pudo guardar token en Electron main process');
      }
    }
  }

  clearAuthToken() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dysa_auth_token');
      sessionStorage.removeItem('dysa_auth_token');
    } else if (typeof process !== 'undefined' && process.versions?.electron) {
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('clear-auth-token');
      } catch (error) {
        console.warn('No se pudo limpiar token en Electron main process');
      }
    }
  }

  // Health check del servidor
  async healthCheck() {
    try {
      const response = await this.get('/health');
      return {
        healthy: true,
        data: response.data
      };
    } catch (error) {
      return {
        healthy: false,
        error: this.transformError(error)
      };
    }
  }
}

// Exportar instancia singleton
let instance = null;

function createHttpClient(options = {}) {
  if (!instance) {
    instance = new HttpClient(options);
  }
  return instance;
}

// Para testing, permitir crear nueva instancia
createHttpClient.createNew = (options = {}) => new HttpClient(options);

module.exports = createHttpClient;