/**
 * DYSA Point - Cliente de Eventos SSE Unificado
 * Usado por Electron y Web para sincronización en tiempo real
 * Fecha: 19 de Octubre 2025
 */

const config = require('@dysa/shared-config');

class EventClient {
  constructor(options = {}) {
    this.eventSource = null;
    this.listeners = new Map();
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = options.maxReconnectAttempts || 10;
    this.isConnected = false;
    this.clientId = null;

    // Callbacks opcionales
    this.onConnect = options.onConnect || (() => {});
    this.onDisconnect = options.onDisconnect || (() => {});
    this.onError = options.onError || (() => {});
    this.onReconnect = options.onReconnect || (() => {});

    // Auto-conectar si se especifica
    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  /**
   * Conecta al stream SSE del servidor
   */
  connect() {
    if (this.eventSource) {
      this.eventSource.close();
    }

    // Verificar si EventSource está disponible
    if (typeof EventSource === 'undefined') {
      console.error('❌ EventSource no está disponible en este entorno');
      return false;
    }

    console.log(`📡 Conectando a SSE: ${config.SSE_URL}`);

    try {
      this.eventSource = new EventSource(config.SSE_URL);

      this.eventSource.onopen = () => {
        console.log('✅ SSE conectado exitosamente');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onConnect();
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleEvent(data);
        } catch (error) {
          console.error('❌ Error parsing SSE event:', error, event.data);
        }
      };

      this.eventSource.onerror = (error) => {
        console.log('❌ SSE error, estado:', this.eventSource.readyState);
        this.isConnected = false;

        // Solo reconectar si no es un cierre manual
        if (this.eventSource.readyState !== EventSource.CLOSED) {
          this.onError(error);
          this.reconnect();
        }
      };

      return true;

    } catch (error) {
      console.error('❌ Error creando EventSource:', error);
      this.onError(error);
      return false;
    }
  }

  /**
   * Procesa un evento recibido
   */
  handleEvent(event) {
    const { type, data, clientId, timestamp } = event;

    // Eventos especiales del sistema
    switch (type) {
      case 'connected':
        this.clientId = clientId;
        console.log(`📡 Cliente SSE registrado: ${clientId}`);
        break;

      case 'ping':
        // Log silencioso del ping
        if (config.FEATURES.DEBUG_MODE) {
          console.log(`💓 Ping SSE recibido (${data?.connectedClients || 0} clientes)`);
        }
        break;

      default:
        // Evento normal - notificar a listeners
        if (this.listeners.has(type)) {
          this.listeners.get(type).forEach(callback => {
            try {
              callback(data, { timestamp, type, clientId });
            } catch (error) {
              console.error(`❌ Error in event listener for ${type}:`, error);
            }
          });
        }

        // Listener global (si existe)
        if (this.listeners.has('*')) {
          this.listeners.get('*').forEach(callback => {
            try {
              callback({ type, data, timestamp, clientId });
            } catch (error) {
              console.error(`❌ Error in global event listener:`, error);
            }
          });
        }
        break;
    }
  }

  /**
   * Suscribirse a un tipo de evento
   */
  subscribe(eventType, callback) {
    if (typeof callback !== 'function') {
      throw new Error('Callback debe ser una función');
    }

    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }

    this.listeners.get(eventType).add(callback);

    console.log(`📝 Suscrito a evento: ${eventType}`);

    // Retornar función para desuscribirse
    return () => this.unsubscribe(eventType, callback);
  }

  /**
   * Desuscribirse de un tipo de evento
   */
  unsubscribe(eventType, callback) {
    if (this.listeners.has(eventType)) {
      this.listeners.get(eventType).delete(callback);

      // Limpiar si no quedan listeners
      if (this.listeners.get(eventType).size === 0) {
        this.listeners.delete(eventType);
      }

      console.log(`📝 Desuscrito de evento: ${eventType}`);
      return true;
    }
    return false;
  }

  /**
   * Desuscribirse de todos los eventos
   */
  unsubscribeAll() {
    this.listeners.clear();
    console.log('📝 Desuscrito de todos los eventos');
  }

  /**
   * Reconectar automáticamente
   */
  reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`❌ Max reintentos alcanzado (${this.maxReconnectAttempts})`);
      this.onError(new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

    console.log(`🔄 Reintento ${this.reconnectAttempts}/${this.maxReconnectAttempts} en ${delay}ms`);

    setTimeout(() => {
      this.onReconnect(this.reconnectAttempts);
      this.connect();
    }, delay);
  }

  /**
   * Desconectar manualmente
   */
  disconnect() {
    if (this.eventSource) {
      console.log('📡 Desconectando SSE manualmente');
      this.eventSource.close();
      this.eventSource = null;
      this.isConnected = false;
      this.clientId = null;
      this.onDisconnect();
    }
  }

  /**
   * Estado de la conexión
   */
  getStatus() {
    return {
      connected: this.isConnected,
      clientId: this.clientId,
      readyState: this.eventSource?.readyState,
      reconnectAttempts: this.reconnectAttempts,
      listenersCount: Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0),
      eventTypes: Array.from(this.listeners.keys())
    };
  }

  // === MÉTODOS ESPECÍFICOS DEL POS ===

  /**
   * Suscribirse a eventos de mesas
   */
  subscribeMesasEvents(callbacks = {}) {
    const unsubscribers = [];

    if (callbacks.onMesaUpdated) {
      unsubscribers.push(this.subscribe('mesa.updated', callbacks.onMesaUpdated));
    }

    if (callbacks.onMesaOccupied) {
      unsubscribers.push(this.subscribe('mesa.occupied', callbacks.onMesaOccupied));
    }

    if (callbacks.onMesaFreed) {
      unsubscribers.push(this.subscribe('mesa.freed', callbacks.onMesaFreed));
    }

    if (callbacks.onMesaStateChanged) {
      unsubscribers.push(this.subscribe('mesa.state.changed', callbacks.onMesaStateChanged));
    }

    // Retornar función para desuscribirse de todos
    return () => unsubscribers.forEach(unsub => unsub());
  }

  /**
   * Suscribirse a eventos de tickets
   */
  subscribeTicketsEvents(callbacks = {}) {
    const unsubscribers = [];

    if (callbacks.onTicketCreated) {
      unsubscribers.push(this.subscribe('ticket.created', callbacks.onTicketCreated));
    }

    if (callbacks.onTicketUpdated) {
      unsubscribers.push(this.subscribe('ticket.updated', callbacks.onTicketUpdated));
    }

    if (callbacks.onTicketClosed) {
      unsubscribers.push(this.subscribe('ticket.closed', callbacks.onTicketClosed));
    }

    if (callbacks.onItemAdded) {
      unsubscribers.push(this.subscribe('ticket.item.added', callbacks.onItemAdded));
    }

    if (callbacks.onItemRemoved) {
      unsubscribers.push(this.subscribe('ticket.item.removed', callbacks.onItemRemoved));
    }

    if (callbacks.onTicketSplit) {
      unsubscribers.push(this.subscribe('ticket.split', callbacks.onTicketSplit));
    }

    if (callbacks.onTicketMerged) {
      unsubscribers.push(this.subscribe('ticket.merged', callbacks.onTicketMerged));
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }

  /**
   * Suscribirse a eventos del sistema
   */
  subscribeSystemEvents(callbacks = {}) {
    const unsubscribers = [];

    if (callbacks.onConfigUpdated) {
      unsubscribers.push(this.subscribe('system.config.updated', callbacks.onConfigUpdated));
    }

    if (callbacks.onUserLoggedIn) {
      unsubscribers.push(this.subscribe('system.user.logged_in', callbacks.onUserLoggedIn));
    }

    if (callbacks.onUserLoggedOut) {
      unsubscribers.push(this.subscribe('system.user.logged_out', callbacks.onUserLoggedOut));
    }

    if (callbacks.onSystemAlert) {
      unsubscribers.push(this.subscribe('system.alert', callbacks.onSystemAlert));
    }

    return () => unsubscribers.forEach(unsub => unsub());
  }
}

// Exportar clase
module.exports = EventClient;