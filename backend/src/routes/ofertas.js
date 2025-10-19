const express = require('express');
const router = express.Router();
const ofertasController = require('../controllers/ofertasController');

/**
 * RUTAS DE OFERTAS Y PROMOCIONES
 * Sistema completo de ofertas, promociones y descuentos
 */

// GET /api/ofertas - Obtener todas las ofertas activas
router.get('/', ofertasController.obtenerOfertasActivas);

// GET /api/ofertas/vigentes - Obtener ofertas vigentes (aplicables ahora)
router.get('/vigentes', ofertasController.obtenerOfertasVigentes);

// GET /api/ofertas/estadisticas - Estadísticas de uso de ofertas
router.get('/estadisticas', ofertasController.obtenerEstadisticasOfertas);

// GET /api/ofertas/:id - Obtener detalles de una oferta específica
router.get('/:id', ofertasController.obtenerOferta);

// POST /api/ofertas - Crear nueva oferta
router.post('/', ofertasController.crearOferta);

// POST /api/ofertas/aplicar - Aplicar ofertas a una venta
router.post('/aplicar', ofertasController.aplicarOfertasVenta);

// GET /api/ofertas/venta/:id_venta - Obtener ofertas aplicadas a una venta
router.get('/venta/:id_venta', ofertasController.obtenerOfertasVenta);

// PUT /api/ofertas/:id/desactivar - Desactivar oferta
router.put('/:id/desactivar', ofertasController.desactivarOferta);

module.exports = router;