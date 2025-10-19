/**
 * DYSA Point - Rutas de Configuración del Sistema
 * Endpoints para red, instalación y configuración general
 * Fecha: 19 de Octubre 2025
 */

const express = require('express');
const SystemConfigController = require('../controllers/system-config.controller');

const router = express.Router();
const controller = new SystemConfigController();

// ============================================================================
// MIDDLEWARE DE AUTENTICACIÓN (SIMULADO)
// ============================================================================
const authenticateAdmin = (req, res, next) => {
  // TODO: Implementar autenticación real
  // Por ahora, simular usuario admin
  req.user = {
    id: 1,
    usuario: 'admin',
    rol: 'administrador'
  };
  next();
};

// ============================================================================
// RUTAS DE CONFIGURACIÓN DE RED
// ============================================================================

/**
 * GET /api/sistema/red
 * Obtener configuración de red actual
 */
router.get('/red', (req, res) => {
  controller.getNetworkConfig(req, res);
});

/**
 * PUT /api/sistema/red
 * Actualizar configuración de red (requiere reinicio del servidor)
 */
router.put('/red', authenticateAdmin, async (req, res) => {
  try {
    // Manejar la respuesta normal primero
    await controller.updateNetworkConfig(req, res);

    // REINICIO CONTROLADO DEL SERVIDOR
    // Solo ejecutar si la respuesta fue exitosa
    if (res.headersSent && res.statusCode === 200) {
      console.log('🔄 Programando reinicio del servidor con nueva configuración de red...');

      // Importar utilidad de reinicio y programar
      const { scheduleReboot } = require('../utils/reboot-server');
      const app = req.app; // Obtener app desde el request

      // Programar reinicio con delay
      scheduleReboot(app, req.body, 1500);
    }
  } catch (error) {
    console.error('Error en PUT /red:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }
});

/**
 * POST /api/sistema/red/test
 * Probar conectividad con configuración propuesta
 */
router.post('/red/test', (req, res) => {
  controller.testNetworkConfig(req, res);
});

// ============================================================================
// RUTAS DE ESTADO DE INSTALACIÓN
// ============================================================================

/**
 * GET /api/sistema/instalacion
 * Obtener estado actual de instalación
 */
router.get('/instalacion', (req, res) => {
  controller.getInstallationStatus(req, res);
});

/**
 * PUT /api/sistema/instalacion/paso
 * Actualizar paso específico de instalación
 */
router.put('/instalacion/paso', authenticateAdmin, (req, res) => {
  controller.updateInstallationStep(req, res);
});

// ============================================================================
// RUTAS DE INFORMACIÓN GENERAL
// ============================================================================

/**
 * GET /api/sistema/info
 * Obtener información completa del sistema
 */
router.get('/info', (req, res) => {
  controller.getSystemInfo(req, res);
});

/**
 * GET /api/sistema/health
 * Health check extendido con configuración
 */
router.get('/health', (req, res) => {
  controller.getSystemHealth(req, res);
});

// ============================================================================
// RUTAS DE ASISTENTE DE INSTALACIÓN
// ============================================================================

/**
 * GET /api/setup/status (cuando se monta en /api/setup)
 * Verificar si el sistema requiere configuración inicial
 */
router.get('/status', (req, res) => {
  controller.getSetupStatus(req, res);
});

/**
 * POST /api/setup/instalacion (cuando se monta en /api/setup)
 * Procesar instalación completa del sistema
 */
router.post('/instalacion', (req, res) => {
  controller.processFullInstallation(req, res);
});


// ============================================================================
// EXPORTAR ROUTER
// ============================================================================

module.exports = router;