/**
 * =====================================================
 * DYSA POINT 2.0 - RUTAS DE GESTIÓN DE CLIENTES
 * =====================================================
 *
 * Rutas RESTful para gestión completa de clientes de restaurante
 *
 * Fecha: 2025-10-12 05:01:18
 * Enfoque: Solo Restaurantes
 */

const express = require('express');
const router = express.Router();
const clientesController = require('../controllers/clientesController');

// ===================================================
// RUTAS CRUD BÁSICO
// ===================================================

/**
 * GET /api/clientes
 * Obtener lista de clientes con filtros y paginación
 * Query params:
 * - page: número de página
 * - limit: elementos por página
 * - busqueda: término de búsqueda
 * - tipo_cliente: filtro por tipo
 * - activo: filtro por estado
 * - orden: campo para ordenar
 * - direccion: ASC o DESC
 */
router.get('/', clientesController.obtenerClientes);

/**
 * GET /api/clientes/:id
 * Obtener cliente específico con toda su información
 */
router.get('/:id', clientesController.obtenerClientePorId);

/**
 * POST /api/clientes
 * Crear nuevo cliente
 * Body: datos del cliente
 */
router.post('/', clientesController.crearCliente);

/**
 * PUT /api/clientes/:id
 * Actualizar cliente existente
 * Body: campos a actualizar
 */
router.put('/:id', clientesController.actualizarCliente);

/**
 * DELETE /api/clientes/:id
 * Eliminar cliente (soft delete)
 */
router.delete('/:id', clientesController.eliminarCliente);

// ===================================================
// RUTAS DE BÚSQUEDA ESPECIALIZADA
// ===================================================

/**
 * GET /api/clientes/buscar/telefono/:telefono
 * Búsqueda rápida por teléfono (para terminal de garzón)
 */
router.get('/buscar/telefono/:telefono', clientesController.buscarPorTelefono);

/**
 * GET /api/clientes/especiales/vip-frecuentes
 * Obtener clientes VIP y frecuentes
 */
router.get('/especiales/vip-frecuentes', clientesController.obtenerClientesEspeciales);

/**
 * GET /api/clientes/estadisticas/generales
 * Obtener estadísticas generales de clientes
 */
router.get('/estadisticas/generales', clientesController.obtenerEstadisticas);

// ===================================================
// RUTAS DE GESTIÓN DE NOTAS
// ===================================================

/**
 * POST /api/clientes/:id/notas
 * Agregar nota a cliente
 * Body: { tipo_nota, nota, visible_en_terminal, id_camarero }
 */
router.post('/:id/notas', clientesController.agregarNota);

module.exports = router;