const express = require('express');
const router = express.Router();
const preticketsController = require('../controllers/preticketsController');

/**
 * RUTAS DE PRE-TICKETS
 * Sistema de tickets temporales antes de confirmar
 */

// GET /api/pretickets - Obtener todos los pre-tickets
router.get('/', preticketsController.obtenerPretickets);

// GET /api/pretickets/:id - Obtener un pre-ticket específico con productos
router.get('/:id', preticketsController.obtenerPreticket);

// POST /api/pretickets - Crear nuevo pre-ticket
router.post('/', preticketsController.crearPreticket);

// POST /api/pretickets/:id/productos - Agregar producto a pre-ticket
router.post('/:id/productos', preticketsController.agregarProducto);

// PUT /api/pretickets/:id/confirmar - Confirmar pre-ticket (convertir en venta)
router.put('/:id/confirmar', preticketsController.confirmarPreticket);

// PUT /api/pretickets/:id/cancelar - Cancelar pre-ticket
router.put('/:id/cancelar', preticketsController.cancelarPreticket);

// DELETE /api/pretickets/:id/productos/:id_producto - Eliminar producto de pre-ticket
router.delete('/:id/productos/:id_producto', preticketsController.eliminarProducto);

module.exports = router;