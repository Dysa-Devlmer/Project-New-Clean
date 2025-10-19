/**
 * DYSA Point - Configuración Unificada
 * Usado por Electron y Web para mantener única fuente de verdad
 * Fecha: 19 de Octubre 2025
 */

const dotenv = require('dotenv');

// Cargar variables de entorno desde la raíz del proyecto
dotenv.config({ path: process.env.ENV_PATH || '../../.env' });

const config = {
  // URLs principales
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:8547/api',
  WS_URL: process.env.WS_URL || 'ws://localhost:8547',
  SSE_URL: process.env.SSE_URL || 'http://localhost:8547/api/events/stream',

  // Configuración de aplicación
  BUILD_ENV: process.env.NODE_ENV || 'development',
  TZ: process.env.TZ || 'America/Santiago',
  LOCALE: process.env.LOCALE || 'es-CL',

  // Base de datos (para referencia)
  DB: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: process.env.DB_PORT || '3306',
    USER: process.env.DB_USER || 'devlmer',
    PASSWORD: process.env.DB_PASS || 'devlmer2025',
    DATABASE: process.env.DB_NAME || 'dysa_point'
  },

  // Timeouts y intervalos
  HTTP_TIMEOUT: parseInt(process.env.HTTP_TIMEOUT) || 5000,
  WS_RECONNECT_INTERVAL: parseInt(process.env.WS_RECONNECT_INTERVAL) || 3000,
  OUTBOX_RETRY_INTERVAL: parseInt(process.env.OUTBOX_RETRY_INTERVAL) || 5000,
  PING_INTERVAL: parseInt(process.env.PING_INTERVAL) || 30000,

  // Features flags
  FEATURES: {
    ENABLE_OFFLINE: process.env.ENABLE_OFFLINE !== 'false',
    ENABLE_REALTIME: process.env.ENABLE_REALTIME !== 'false',
    ENABLE_AUDIO_ALERTS: process.env.ENABLE_AUDIO_ALERTS !== 'false',
    ENABLE_PRINT_DIRECT: process.env.ENABLE_PRINT_DIRECT !== 'false',
    DEBUG_MODE: process.env.NODE_ENV === 'development'
  },

  // POS específico
  POS: {
    DEFAULT_CURRENCY: 'CLP',
    CURRENCY_SYMBOL: '$',
    IVA_RATE: 0.19,
    MAX_ITEMS_PER_TICKET: 100,
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutos
    AUTO_SAVE_INTERVAL: 10000 // 10 segundos
  },

  // Eventos SSE que se emiten
  EVENTS: {
    MESA_UPDATED: 'mesa.updated',
    MESA_OCCUPIED: 'mesa.occupied',
    MESA_FREED: 'mesa.freed',
    TICKET_CREATED: 'ticket.created',
    TICKET_UPDATED: 'ticket.updated',
    TICKET_CLOSED: 'ticket.closed',
    ITEM_ADDED: 'ticket.item.added',
    ITEM_REMOVED: 'ticket.item.removed',
    PING: 'ping'
  },

  // Configuración de impresión
  PRINT: {
    TICKET_WIDTH: 58, // mm
    KITCHEN_WIDTH: 80, // mm
    FONT_SIZE: 12,
    COPIES_KITCHEN: 1,
    COPIES_CLIENT: 1
  },

  // Configuración de audio
  AUDIO: {
    NEW_ORDER_SOUND: '/sounds/new-order.wav',
    ORDER_READY_SOUND: '/sounds/order-ready.wav',
    ERROR_SOUND: '/sounds/error.wav',
    VOLUME: 0.7
  }
};

// Validaciones básicas
if (!config.API_BASE_URL.startsWith('http')) {
  throw new Error('API_BASE_URL debe comenzar con http:// o https://');
}

if (config.HTTP_TIMEOUT < 1000) {
  console.warn('HTTP_TIMEOUT muy bajo, recomendado al menos 3000ms');
}

// Método helper para obtener URL completa de API
config.getApiUrl = (endpoint) => {
  const base = config.API_BASE_URL.replace(/\/$/, '');
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${base}${path}`;
};

// Método helper para verificar feature flags
config.isFeatureEnabled = (feature) => {
  return config.FEATURES[feature] === true;
};

// Método helper para formatear moneda
config.formatCurrency = (amount) => {
  return new Intl.NumberFormat(config.LOCALE, {
    style: 'currency',
    currency: config.POS.DEFAULT_CURRENCY,
    minimumFractionDigits: 0
  }).format(amount);
};

// Log de configuración en desarrollo
if (config.FEATURES.DEBUG_MODE) {
  console.log('🔧 DYSA Config loaded:', {
    API_BASE_URL: config.API_BASE_URL,
    BUILD_ENV: config.BUILD_ENV,
    FEATURES: config.FEATURES,
    TZ: config.TZ
  });
}

module.exports = config;