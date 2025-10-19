/**
 * DYSA Point - Sistema de Cola Offline (Outbox)
 * Usado solo por Electron para operaciones offline
 * Fecha: 19 de Octubre 2025
 */

const config = require('@dysa/shared-config');

class OutboxManager {
  constructor(options = {}) {
    this.queue = [];
    this.isProcessing = false;
    this.retryInterval = options.retryInterval || config.OUTBOX_RETRY_INTERVAL;
    this.maxRetries = options.maxRetries || 5;
    this.storage = options.storage || 'electron-store'; // o 'indexeddb'

    // Callbacks opcionales
    this.onItemProcessed = options.onItemProcessed || (() => {});
    this.onItemFailed = options.onItemFailed || (() => {});
    this.onQueueEmpty = options.onQueueEmpty || (() => {});
    this.onNetworkRestored = options.onNetworkRestored || (() => {});

    // Estado de conectividad
    this.isOnline = navigator ? navigator.onLine : true;

    // Cargar cola persistida
    this.loadQueue();

    // Configurar listeners de conectividad
    this.setupConnectivityListeners();

    // Procesar cola cada X segundos
    this.processingInterval = setInterval(() => this.processQueue(), this.retryInterval);

    console.log('📦 OutboxManager iniciado:', {
      retryInterval: this.retryInterval,
      maxRetries: this.maxRetries,
      isOnline: this.isOnline
    });
  }

  /**
   * Configurar listeners de conectividad
   */
  setupConnectivityListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('🌐 Conexión restaurada');
        this.isOnline = true;
        this.onNetworkRestored();
        this.processQueue(); // Procesar inmediatamente
      });

      window.addEventListener('offline', () => {
        console.log('📴 Conexión perdida');
        this.isOnline = false;
      });
    }
  }

  /**
   * Agregar operación a la cola
   */
  async add(operation) {
    const item = {
      id: this.generateId(),
      ...operation,
      timestamp: new Date().toISOString(),
      retries: 0,
      maxRetries: operation.maxRetries || this.maxRetries,
      priority: operation.priority || 'normal', // high, normal, low
      metadata: operation.metadata || {}
    };

    // Validar operación
    if (!item.method || !item.url) {
      throw new Error('Operación debe tener method y url');
    }

    this.queue.push(item);
    await this.saveQueue();

    console.log(`📦 Operación agregada a Outbox: ${item.method} ${item.url} (ID: ${item.id})`);

    // Intentar procesar inmediatamente si estamos online
    if (this.isOnline) {
      this.processQueue();
    }

    return item.id;
  }

  /**
   * Procesar cola de operaciones
   */
  async processQueue() {
    if (this.isProcessing || !this.isOnline || this.queue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log(`📦 Procesando cola Outbox (${this.queue.length} items)`);

    // Ordenar por prioridad y timestamp
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Mayor prioridad primero
      }

      return new Date(a.timestamp) - new Date(b.timestamp); // Más antiguo primero
    });

    // Procesar items uno por uno
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];

      try {
        await this.executeOperation(item);

        // Remover item exitoso
        this.queue.splice(i, 1);
        console.log(`✅ Outbox: Operación ${item.id} ejecutada exitosamente`);
        this.onItemProcessed(item);

      } catch (error) {
        await this.handleOperationError(item, error, i);
      }
    }

    await this.saveQueue();
    this.isProcessing = false;

    // Notificar si la cola está vacía
    if (this.queue.length === 0) {
      this.onQueueEmpty();
    }
  }

  /**
   * Ejecutar una operación HTTP
   */
  async executeOperation(item) {
    const httpClient = require('@dysa/shared-http')();

    const config = {
      timeout: 10000, // Timeout más corto para offline
      ...item.config
    };

    switch (item.method.toUpperCase()) {
      case 'GET':
        return await httpClient.get(item.url, config);

      case 'POST':
        return await httpClient.post(item.url, item.data, config);

      case 'PUT':
        return await httpClient.put(item.url, item.data, config);

      case 'PATCH':
        return await httpClient.patch(item.url, item.data, config);

      case 'DELETE':
        return await httpClient.delete(item.url, config);

      default:
        throw new Error(`Método HTTP no soportado: ${item.method}`);
    }
  }

  /**
   * Manejar error en operación
   */
  async handleOperationError(item, error, index) {
    item.retries++;
    item.lastError = {
      message: error.message,
      type: error.type || 'UNKNOWN',
      timestamp: new Date().toISOString()
    };

    if (item.retries >= item.maxRetries) {
      console.error(`❌ Outbox: Operación ${item.id} falló definitivamente después de ${item.maxRetries} intentos`);
      this.queue.splice(index, 1); // Remover permanentemente
      this.onItemFailed(item, error);
    } else {
      console.log(`⚠️  Outbox: Operación ${item.id} falló, reintento ${item.retries}/${item.maxRetries}. Error: ${error.message}`);

      // Aumentar delay exponencialmente
      item.nextRetry = new Date(Date.now() + (1000 * Math.pow(2, item.retries))).toISOString();
    }
  }

  /**
   * Cargar cola desde almacenamiento persistente
   */
  async loadQueue() {
    try {
      let saved = [];

      if (this.isElectronEnvironment()) {
        // Electron - usar IPC
        const { ipcRenderer } = require('electron');
        saved = await ipcRenderer.invoke('outbox-load') || [];
      } else if (typeof window !== 'undefined' && window.indexedDB) {
        // Web - usar IndexedDB
        saved = await this.loadFromIndexedDB();
      } else {
        // Fallback - localStorage
        const data = localStorage.getItem('dysa_outbox');
        saved = data ? JSON.parse(data) : [];
      }

      // Filtrar items que no han expirado (más de 7 días)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      this.queue = saved.filter(item => new Date(item.timestamp) > sevenDaysAgo);

      console.log(`📦 Outbox cargado: ${this.queue.length} items`);

    } catch (error) {
      console.error('❌ Error cargando outbox:', error);
      this.queue = [];
    }
  }

  /**
   * Guardar cola en almacenamiento persistente
   */
  async saveQueue() {
    try {
      if (this.isElectronEnvironment()) {
        // Electron - usar IPC
        const { ipcRenderer } = require('electron');
        await ipcRenderer.invoke('outbox-save', this.queue);
      } else if (typeof window !== 'undefined' && window.indexedDB) {
        // Web - usar IndexedDB
        await this.saveToIndexedDB();
      } else {
        // Fallback - localStorage
        localStorage.setItem('dysa_outbox', JSON.stringify(this.queue));
      }
    } catch (error) {
      console.error('❌ Error guardando outbox:', error);
    }
  }

  /**
   * Cargar desde IndexedDB (para web)
   */
  async loadFromIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('dysa_outbox', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['queue'], 'readonly');
        const store = transaction.objectStore('queue');
        const getRequest = store.get('queue');

        getRequest.onsuccess = () => {
          resolve(getRequest.result?.data || []);
        };

        getRequest.onerror = () => reject(getRequest.error);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue');
        }
      };
    });
  }

  /**
   * Guardar en IndexedDB (para web)
   */
  async saveToIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('dysa_outbox', 1);

      request.onerror = () => reject(request.error);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['queue'], 'readwrite');
        const store = transaction.objectStore('queue');
        const putRequest = store.put({ data: this.queue }, 'queue');

        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue');
        }
      };
    });
  }

  // === MÉTODOS ESPECÍFICOS DEL POS ===

  /**
   * Agregar operación de mesa offline
   */
  async addMesaOperation(method, mesaId, data = {}) {
    const url = mesaId ? `/mesas/${mesaId}` : '/mesas';

    return this.add({
      method,
      url,
      data,
      priority: 'high',
      metadata: {
        type: 'mesa',
        mesaId,
        operation: method
      }
    });
  }

  /**
   * Agregar operación de ticket offline
   */
  async addTicketOperation(method, ticketId, data = {}) {
    const url = ticketId ? `/pos/tickets/${ticketId}` : '/pos/tickets';

    return this.add({
      method,
      url,
      data,
      priority: 'high',
      metadata: {
        type: 'ticket',
        ticketId,
        operation: method
      }
    });
  }

  // === UTILIDADES ===

  generateId() {
    return Date.now() + Math.random().toString(36).substr(2, 9);
  }

  isElectronEnvironment() {
    return typeof process !== 'undefined' && process.versions?.electron;
  }

  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      isOnline: this.isOnline,
      lastProcessed: this.lastProcessed,
      itemsByPriority: {
        high: this.queue.filter(item => item.priority === 'high').length,
        normal: this.queue.filter(item => item.priority === 'normal').length,
        low: this.queue.filter(item => item.priority === 'low').length
      },
      itemsByType: this.queue.reduce((acc, item) => {
        const type = item.metadata?.type || 'unknown';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {})
    };
  }

  /**
   * Limpiar outbox (remover todos los items)
   */
  async clear() {
    this.queue = [];
    await this.saveQueue();
    console.log('📦 Outbox limpiado');
  }

  /**
   * Pausar/reanudar procesamiento
   */
  pause() {
    this.isProcessing = true; // Bloquear procesamiento
    console.log('⏸️  Outbox pausado');
  }

  resume() {
    this.isProcessing = false;
    console.log('▶️  Outbox reanudado');
    this.processQueue();
  }

  /**
   * Destruir instancia
   */
  destroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.queue = [];
    console.log('🗑️  OutboxManager destruido');
  }
}

module.exports = OutboxManager;