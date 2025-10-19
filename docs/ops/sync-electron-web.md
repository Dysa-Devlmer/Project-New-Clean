# Sincronización Electron + Web

## Objetivo
Implementar ÚNICA fuente de verdad con comportamiento idéntico entre la aplicación Electron y el cliente web del navegador.

## Arquitectura

### 1. Configuración Unificada (`packages/shared-config/`)

```javascript
// packages/shared-config/config.js
const dotenv = require('dotenv');

// Cargar variables de entorno
dotenv.config();

const config = {
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8547/api',
  WS_URL: process.env.WS_URL || 'ws://localhost:8547',
  SSE_URL: process.env.SSE_URL || 'http://localhost:8547/api/events/stream',
  BUILD_ENV: process.env.NODE_ENV || 'development',
  TZ: 'America/Santiago',

  // Timeouts
  HTTP_TIMEOUT: 5000,
  WS_RECONNECT_INTERVAL: 3000,
  OUTBOX_RETRY_INTERVAL: 5000,

  // Features
  ENABLE_OFFLINE: true,
  ENABLE_REALTIME: true,
  DEBUG_MODE: process.env.NODE_ENV === 'development'
};

module.exports = config;
```

### 2. Cliente HTTP Unificado (`packages/shared-http/`)

```javascript
// packages/shared-http/httpClient.js
const axios = require('axios');
const config = require('../shared-config/config');

class HttpClient {
  constructor() {
    this.client = axios.create({
      baseURL: config.API_BASE_URL,
      timeout: config.HTTP_TIMEOUT,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor - agregar token
    this.client.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - manejo de errores
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          await this.handleUnauthorized();
        }

        // Retry lógica para errores de red
        if (this.shouldRetry(error)) {
          return this.retryRequest(error.config);
        }

        return Promise.reject(error);
      }
    );
  }

  // Métodos principales
  async get(url, config = {}) {
    return this.client.get(url, config);
  }

  async post(url, data = {}, config = {}) {
    return this.client.post(url, data, config);
  }

  async put(url, data = {}, config = {}) {
    return this.client.put(url, data, config);
  }

  async delete(url, config = {}) {
    return this.client.delete(url, config);
  }

  // Utilidades
  getAuthToken() {
    // Implementar según estrategia de auth
    return localStorage.getItem('auth_token') || null;
  }

  shouldRetry(error) {
    return error.code === 'NETWORK_ERROR' ||
           error.response?.status >= 500;
  }

  async retryRequest(config, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        return await this.client.request(config);
      } catch (error) {
        if (i === retries - 1) throw error;
      }
    }
  }
}

module.exports = new HttpClient();
```

### 3. Eventos en Tiempo Real (SSE/WebSocket)

#### Backend - Endpoint SSE
```javascript
// backend/src/routes/events.js
const express = require('express');
const router = express.Router();

const clients = new Set();

router.get('/stream', (req, res) => {
  // Configurar SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  // Agregar cliente
  clients.add(res);

  // Ping cada 30s para mantener conexión
  const ping = setInterval(() => {
    res.write('data: {"type":"ping","timestamp":"' + new Date().toISOString() + '"}\n\n');
  }, 30000);

  // Limpiar al desconectar
  req.on('close', () => {
    clients.delete(res);
    clearInterval(ping);
  });
});

// Función para emitir eventos
function emitEvent(type, data) {
  const event = {
    type,
    data,
    timestamp: new Date().toISOString()
  };

  clients.forEach(client => {
    try {
      client.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch (error) {
      clients.delete(client);
    }
  });
}

module.exports = { router, emitEvent };
```

#### Cliente - Suscripción a Eventos
```javascript
// packages/shared-events/eventClient.js
const config = require('../shared-config/config');

class EventClient {
  constructor() {
    this.eventSource = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    this.eventSource = new EventSource(config.SSE_URL);

    this.eventSource.onopen = () => {
      console.log('SSE conectado');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleEvent(data);
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    this.eventSource.onerror = () => {
      console.log('SSE error, intentando reconectar...');
      this.reconnect();
    };
  }

  handleEvent(event) {
    const { type, data } = event;

    if (this.listeners.has(type)) {
      this.listeners.get(type).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${type}:`, error);
        }
      });
    }
  }

  subscribe(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType).add(callback);
  }

  unsubscribe(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);
    }
  }

  reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, config.WS_RECONNECT_INTERVAL);
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}

module.exports = new EventClient();
```

### 4. Offline Queue (Outbox) para Electron

```javascript
// packages/shared-outbox/outbox.js (Solo para Electron)
const { ipcRenderer } = require('electron');

class OutboxManager {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.retryInterval = config.OUTBOX_RETRY_INTERVAL;

    // Cargar cola persistida
    this.loadQueue();

    // Procesar cola cada X segundos
    setInterval(() => this.processQueue(), this.retryInterval);
  }

  async add(operation) {
    const item = {
      id: Date.now() + Math.random(),
      ...operation,
      timestamp: new Date().toISOString(),
      retries: 0,
      maxRetries: 5
    };

    this.queue.push(item);
    await this.saveQueue();

    // Intentar procesar inmediatamente
    this.processQueue();
  }

  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];

      try {
        await this.executeOperation(item);

        // Remover item exitoso
        this.queue.splice(i, 1);
        console.log(`Outbox: Operación ${item.id} ejecutada exitosamente`);

      } catch (error) {
        item.retries++;

        if (item.retries >= item.maxRetries) {
          console.error(`Outbox: Operación ${item.id} falló después de ${item.maxRetries} intentos`);
          this.queue.splice(i, 1);
        } else {
          console.log(`Outbox: Operación ${item.id} falló, reintento ${item.retries}/${item.maxRetries}`);
        }
      }
    }

    await this.saveQueue();
    this.isProcessing = false;
  }

  async executeOperation(item) {
    const httpClient = require('../shared-http/httpClient');

    switch (item.method.toUpperCase()) {
      case 'POST':
        return await httpClient.post(item.url, item.data);
      case 'PUT':
        return await httpClient.put(item.url, item.data);
      case 'DELETE':
        return await httpClient.delete(item.url);
      default:
        throw new Error(`Método no soportado: ${item.method}`);
    }
  }

  async loadQueue() {
    try {
      const saved = await ipcRenderer.invoke('load-outbox');
      this.queue = saved || [];
    } catch (error) {
      console.error('Error cargando outbox:', error);
      this.queue = [];
    }
  }

  async saveQueue() {
    try {
      await ipcRenderer.invoke('save-outbox', this.queue);
    } catch (error) {
      console.error('Error guardando outbox:', error);
    }
  }
}

module.exports = OutboxManager;
```

## Pruebas de Sincronización

### Test 1: Cambio Mesa Electron → Web
1. Abrir mesa en Electron
2. Verificar evento `mesa.updated` en SSE
3. Confirmar actualización en web <5s

### Test 2: Cambio Ticket Web → Electron
1. Agregar ítem en ticket desde web
2. Verificar evento `ticket.updated` en SSE
3. Confirmar totales actualizados en Electron <5s

### Test 3: Offline Electron
1. Desconectar red en Electron
2. Realizar operación (agregar ítem)
3. Verificar operación en Outbox
4. Reconectar red
5. Confirmar sincronización automática

## Comandos de Verificación

```bash
# Instalar dependencias compartidas
npm install --workspace=packages/shared-config
npm install --workspace=packages/shared-http

# Probar eventos SSE
curl -N -H "Accept: text/event-stream" http://localhost:8547/api/events/stream

# Trigger evento de prueba
curl -X POST http://localhost:8547/api/events/trigger -d '{"type":"mesa.updated","data":{"id":1}}'
```

## Estado de Implementación

- [ ] **shared-config**: Configuración unificada
- [ ] **shared-http**: Cliente HTTP con interceptores
- [ ] **SSE Backend**: Endpoint de eventos tiempo real
- [ ] **Event Client**: Suscripción a eventos
- [ ] **Outbox Electron**: Cola offline operaciones
- [ ] **Pruebas**: Tests de sincronización 3/3

---
**Próximo**: Implementar shared-config y shared-http como base