/**
 * DYSA Point - Rutas de Tickets Simplificadas
 * Endpoints funcionales inmediatos para smoke tests
 * Fecha: 20 de Octubre 2025
 */

const express = require('express');
const router = express.Router();
const TicketsSimpleController = require('../controllers/tickets-simple.controller');

const ticketsController = new TicketsSimpleController();

// === ENDPOINTS NÚCLEO P0 ===

/**
 * GET /api/pos/tickets/estadisticas
 * Obtener estadísticas de tickets
 */
router.get('/estadisticas', async (req, res) => {
  await ticketsController.obtenerEstadisticas(req, res);
});

/**
 * POST /api/pos/tickets
 * Crear nuevo ticket
 */
router.post('/', async (req, res) => {
  await ticketsController.crearTicket(req, res);
});

/**
 * GET /api/pos/tickets/:id
 * Obtener ticket por ID
 */
router.get('/:id', async (req, res) => {
  await ticketsController.obtenerTicket(req, res);
});

/**
 * GET /api/pos/tickets
 * Listar tickets con filtros
 */
router.get('/', async (req, res) => {
  await ticketsController.listarTickets(req, res);
});

/**
 * POST /api/pos/tickets/:id/items
 * Agregar item al ticket
 */
router.post('/:id/items', async (req, res) => {
  await ticketsController.agregarItem(req, res);
});

/**
 * PUT /api/pos/tickets/:id/estado
 * Actualizar estado del ticket
 */
router.put('/:id/estado', async (req, res) => {
  await ticketsController.actualizarEstado(req, res);
});

// === ENDPOINTS PARA SMOKE TESTS ===

/**
 * GET /api/pos/tickets/test/demo
 * Crear datos de demo para pruebas
 */
router.get('/test/demo', async (req, res) => {
  try {
    // Crear tickets de demo
    const demoTickets = [
      {
        mesa_id: 1,
        tipo_venta: 'MESA',
        nombre_cliente: 'Mesa 1'
      },
      {
        mesa_id: 2,
        tipo_venta: 'MESA',
        nombre_cliente: 'Mesa 2'
      },
      {
        tipo_venta: 'TAKEAWAY',
        nombre_cliente: 'Juan Pérez'
      }
    ];

    const tickets = [];
    for (const demo of demoTickets) {
      // Simular creación mediante el controlador
      const mockReq = { body: demo };
      const mockRes = {
        status: () => mockRes,
        json: (data) => data
      };

      await ticketsController.crearTicket(mockReq, mockRes);
      tickets.push(demo);
    }

    res.json({
      success: true,
      data: {
        tickets_creados: tickets.length,
        mensaje: 'Datos de demo creados exitosamente'
      }
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error creando datos de demo: ' + error.message
    });
  }
});

/**
 * DELETE /api/pos/tickets/test/reset
 * Limpiar todos los datos de prueba
 */
router.delete('/test/reset', async (req, res) => {
  try {
    ticketsController.tickets = [];
    ticketsController.nextId = 1;

    res.json({
      success: true,
      message: 'Datos de prueba limpiados exitosamente'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error limpiando datos: ' + error.message
    });
  }
});

module.exports = router;