/**
 * DYSA Point - Rutas de Mesas v2
 * Gestión de mesas del restaurante con patrón Repository-Service-Controller
 * Fase 2: POS núcleo con persistencia real y auditoría
 * Fecha: 19 de Octubre 2025
 */

const express = require('express');
const MesasController = require('../controllers/mesas.controller');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();
const mesasController = new MesasController();

// Middleware para simular usuario (temporal hasta implementar auth completo)
const simulateUser = (req, res, next) => {
  if (!req.user) {
    req.user = {
      id: 1,
      nombre: 'USUARIO_SISTEMA'
    };
  }
  next();
};

// Aplicar middleware a todas las rutas
router.use(simulateUser);

// Middleware para identificar que responde el router v2
router.use((req, res, next) => {
  res.set('X-Router', 'mesas-v2');
  next();
});

// === RUTAS PRINCIPALES DEL PATRÓN v2 ===

// === RUTAS ESPECÍFICAS (deben ir ANTES de las rutas dinámicas) ===

/**
 * @route GET /api/mesas/disponibles
 * @desc Busca mesas disponibles por capacidad
 * @access Public
 * @query {number} capacidad - Capacidad requerida (obligatorio)
 * @query {string} zona - Nombre de la zona (opcional)
 */
router.get('/disponibles', async (req, res) => {
  await mesasController.buscarMesasDisponibles(req, res);
});

/**
 * @route GET /api/mesas/estadisticas
 * @desc Obtiene estadísticas del sistema de mesas
 * @access Public
 */
router.get('/estadisticas', async (req, res) => {
  await mesasController.getEstadisticasMesas(req, res);
});

/**
 * @route GET /api/mesas/layout/:zona_id
 * @desc Obtiene el layout de mesas de una zona específica
 * @access Public
 * @param {number} zona_id - ID de la zona
 */
router.get('/layout/:zona_id', async (req, res) => {
  await mesasController.getLayoutZona(req, res);
});

// === RUTAS DE COMPATIBILIDAD CON SISTEMA ANTERIOR ===

/**
 * @route GET /api/mesas/zona/:zonaId
 * @desc Obtener mesas de una zona específica (compatibilidad)
 * @access Public
 * @param {number} zonaId - ID de la zona
 */
router.get('/zona/:zonaId', async (req, res) => {
  req.query.zona_id = req.params.zonaId;
  await mesasController.getMesas(req, res);
});

/**
 * @route GET /api/mesas/estado
 * @desc Alias para estadísticas (compatibilidad)
 * @access Public
 */
router.get('/estado', async (req, res) => {
  await mesasController.getEstadisticasMesas(req, res);
});

// === RUTAS DINÁMICAS (deben ir DESPUÉS de las rutas específicas) ===

/**
 * @route GET /api/mesas/:id/historial
 * @desc Obtiene el historial de cambios de una mesa
 * @access Public
 * @param {number} id - ID de la mesa (solo números)
 * @query {number} limite - Límite de registros (default: 10)
 */
router.get('/:id(\\d+)/historial', async (req, res) => {
  await mesasController.getHistorialMesa(req, res);
});

/**
 * @route GET /api/mesas/:id
 * @desc Obtiene una mesa específica por ID
 * @access Public
 * @param {number} id - ID de la mesa (solo números)
 */
router.get('/:id(\\d+)', async (req, res) => {
  await mesasController.getMesaById(req, res);
});

/**
 * @route GET /api/mesas
 * @desc Obtiene todas las mesas con filtros opcionales
 * @access Public
 * @query {number} zona_id - ID de la zona
 * @query {string} estado - Estado de la mesa (LIBRE, OCUPADA, etc.)
 * @query {number} capacidad_minima - Capacidad mínima requerida
 * @query {boolean} vip - Filtro por mesas VIP
 */
router.get('/', async (req, res) => {
  await mesasController.getMesas(req, res);
});

/**
 * @route POST /api/mesas
 * @desc Crea una nueva mesa
 * @access Public
 * @body {object} datosMesa - Datos de la mesa a crear
 */
router.post('/', async (req, res) => {
  await mesasController.crearMesa(req, res);
});

/**
 * @route PUT /api/mesas/:id/estado
 * @desc Cambia el estado de una mesa
 * @access Public
 * @param {number} id - ID de la mesa (solo números)
 * @body {object} cambioEstado - Datos del cambio de estado
 */
router.put('/:id(\\d+)/estado', async (req, res) => {
  await mesasController.cambiarEstadoMesa(req, res);
});

/**
 * @route PUT /api/mesas/:id/comensales
 * @desc Actualiza el número de comensales en una mesa ocupada
 * @access Public
 * @param {number} id - ID de la mesa (solo números)
 * @body {number} comensales - Nuevo número de comensales
 */
router.put('/:id(\\d+)/comensales', async (req, res) => {
  await mesasController.actualizarComensales(req, res);
});

// === MÉTODOS CONVENIENTES ===

/**
 * @route POST /api/mesas/:id/ocupar
 * @desc Método conveniente para ocupar una mesa directamente
 * @access Public
 * @param {number} id - ID de la mesa (solo números)
 * @body {object} datosOcupacion - Datos de ocupación
 */
router.post('/:id(\\d+)/ocupar', async (req, res) => {
  await mesasController.ocuparMesa(req, res);
});

/**
 * @route POST /api/mesas/:id/liberar
 * @desc Método conveniente para liberar una mesa
 * @access Public
 * @param {number} id - ID de la mesa (solo números)
 * @body {object} datosLiberacion - Datos de liberación (opcional)
 */
router.post('/:id(\\d+)/liberar', async (req, res) => {
  await mesasController.liberarMesa(req, res);
});

// === MANEJO DE ERRORES ===

// Middleware de manejo de errores para rutas no encontradas
router.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND'
  });
});

// Middleware de manejo de errores generales
router.use((error, req, res, next) => {
  console.error('Error en rutas de mesas:', error);

  res.status(500).json({
    success: false,
    error: 'Error interno del servidor',
    code: 'INTERNAL_ERROR',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

module.exports = router;