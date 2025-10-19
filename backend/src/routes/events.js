/**
 * DYSA Point - Rutas de Eventos en Tiempo Real
 * Sistema SSE para sincronización Electron/Web
 * Fecha: 19 de Octubre 2025
 */

const express = require('express');
const router = express.Router();

// Store de clientes conectados
const clients = new Set();

/**
 * @route GET /api/events/stream
 * @desc Endpoint SSE para eventos en tiempo real
 * @access Public
 */
router.get('/stream', (req, res) => {
  // Configurar headers SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Identificar cliente
  const clientInfo = {
    id: Date.now() + Math.random(),
    res,
    connectedAt: new Date().toISOString(),
    userAgent: req.headers['user-agent'] || 'unknown',
    ip: req.ip || req.connection.remoteAddress
  };

  // Agregar cliente al store
  clients.add(clientInfo);

  console.log(`📡 SSE Cliente conectado: ${clientInfo.id} (Total: ${clients.size})`);

  // Enviar evento de bienvenida
  res.write(`data: ${JSON.stringify({
    type: 'connected',
    clientId: clientInfo.id,
    timestamp: new Date().toISOString(),
    message: 'Conectado al stream de eventos DYSA Point'
  })}\n\n`);

  // Ping cada 30s para mantener conexión viva
  const pingInterval = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({
        type: 'ping',
        timestamp: new Date().toISOString(),
        connectedClients: clients.size
      })}\n\n`);
    } catch (error) {
      console.log(`❌ Error enviando ping a cliente ${clientInfo.id}:`, error.message);
      cleanup();
    }
  }, 30000);

  // Función de limpieza
  const cleanup = () => {
    clearInterval(pingInterval);
    clients.delete(clientInfo);
    console.log(`📡 SSE Cliente desconectado: ${clientInfo.id} (Total: ${clients.size})`);
  };

  // Limpiar al cerrar conexión
  req.on('close', cleanup);
  req.on('end', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

/**
 * @route POST /api/events/trigger
 * @desc Endpoint para trigger manual de eventos (testing)
 * @access Public
 */
router.post('/trigger', (req, res) => {
  const { type, data } = req.body;

  if (!type) {
    return res.status(400).json({
      success: false,
      error: 'Tipo de evento requerido',
      code: 'MISSING_EVENT_TYPE'
    });
  }

  try {
    emitEvent(type, data || {});

    res.json({
      success: true,
      message: `Evento '${type}' enviado a ${clients.size} clientes`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error enviando evento',
      code: 'EMIT_ERROR',
      details: error.message
    });
  }
});

/**
 * @route GET /api/events/status
 * @desc Estado del sistema de eventos
 * @access Public
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      connectedClients: clients.size,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      clients: Array.from(clients).map(client => ({
        id: client.id,
        connectedAt: client.connectedAt,
        userAgent: client.userAgent,
        ip: client.ip
      }))
    }
  });
});

// === FUNCIÓN PRINCIPAL PARA EMITIR EVENTOS ===

/**
 * Emite un evento a todos los clientes conectados
 * @param {string} type - Tipo del evento
 * @param {object} data - Datos del evento
 * @param {object} options - Opciones adicionales
 */
function emitEvent(type, data = {}, options = {}) {
  const event = {
    type,
    data,
    timestamp: new Date().toISOString(),
    source: options.source || 'server',
    id: options.id || Date.now() + Math.random()
  };

  const eventString = `data: ${JSON.stringify(event)}\n\n`;
  const clientsToRemove = [];

  console.log(`📢 Emitiendo evento '${type}' a ${clients.size} clientes`);

  // Enviar a todos los clientes conectados
  clients.forEach(client => {
    try {
      client.res.write(eventString);
    } catch (error) {
      console.log(`❌ Error enviando evento a cliente ${client.id}:`, error.message);
      clientsToRemove.push(client);
    }
  });

  // Limpiar clientes desconectados
  clientsToRemove.forEach(client => {
    clients.delete(client);
  });

  if (clientsToRemove.length > 0) {
    console.log(`🧹 Limpiados ${clientsToRemove.length} clientes desconectados`);
  }

  return {
    success: true,
    clientsNotified: clients.size,
    event
  };
}

// === EVENTOS ESPECÍFICOS DEL POS ===

/**
 * Eventos relacionados con mesas
 */
const mesasEvents = {
  mesaUpdated: (mesaData) => emitEvent('mesa.updated', mesaData),
  mesaOccupied: (mesaData) => emitEvent('mesa.occupied', mesaData),
  mesaFreed: (mesaData) => emitEvent('mesa.freed', mesaData),
  mesaStateChanged: (mesaData) => emitEvent('mesa.state.changed', mesaData)
};

/**
 * Eventos relacionados con tickets
 */
const ticketsEvents = {
  ticketCreated: (ticketData) => emitEvent('ticket.created', ticketData),
  ticketUpdated: (ticketData) => emitEvent('ticket.updated', ticketData),
  ticketClosed: (ticketData) => emitEvent('ticket.closed', ticketData),
  itemAdded: (itemData) => emitEvent('ticket.item.added', itemData),
  itemRemoved: (itemData) => emitEvent('ticket.item.removed', itemData),
  ticketSplit: (splitData) => emitEvent('ticket.split', splitData),
  ticketMerged: (mergeData) => emitEvent('ticket.merged', mergeData)
};

/**
 * Eventos del sistema
 */
const systemEvents = {
  configUpdated: (configData) => emitEvent('system.config.updated', configData),
  userLoggedIn: (userData) => emitEvent('system.user.logged_in', userData),
  userLoggedOut: (userData) => emitEvent('system.user.logged_out', userData),
  systemAlert: (alertData) => emitEvent('system.alert', alertData)
};

// Exportar router y funciones
module.exports = {
  router,
  emitEvent,
  mesasEvents,
  ticketsEvents,
  systemEvents,
  getConnectedClients: () => clients.size
};