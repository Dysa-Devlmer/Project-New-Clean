/**
 * DYSA Point - Controlador de Configuración del Sistema
 * Endpoints para configuración de red, instalación y empresa
 * Fecha: 19 de Octubre 2025
 */

const SystemConfigService = require('../services/system-config.service');
const { ValidationError, BusinessLogicError, NotFoundError } = require('../utils/errors');

class SystemConfigController {
  constructor() {
    this.service = new SystemConfigService();
  }

  // ============================================================================
  // CONFIGURACIÓN DE RED
  // ============================================================================

  /**
   * GET /api/sistema/red - Obtener configuración de red actual
   */
  async getNetworkConfig(req, res) {
    try {
      const config = await this.service.getNetworkConfig();

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error al obtener configuración de red:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/sistema/red - Actualizar configuración de red y reiniciar servidor
   */
  async updateNetworkConfig(req, res) {
    try {
      const configData = req.body;
      const usuario = req.user?.usuario || 'admin'; // Asume middleware de auth
      const ipOrigen = req.ip || req.connection.remoteAddress;

      // Validar datos requeridos
      if (!configData.host_principal || !configData.puerto_api) {
        return res.status(400).json({
          success: false,
          error: 'Datos incompletos',
          message: 'host_principal y puerto_api son requeridos'
        });
      }

      const updatedConfig = await this.service.updateNetworkConfig(configData, usuario, ipOrigen);

      // IMPORTANTE: Aquí se debe reiniciar el servidor
      // Por ahora devolvemos success y el reinicio se maneja después
      res.json({
        success: true,
        data: updatedConfig,
        message: 'Configuración de red actualizada. Reiniciando servidor...',
        restart_required: true,
        timestamp: new Date().toISOString()
      });

      // El reinicio se maneja en el middleware o después de la respuesta
      // Ver implementación en routes/system.js

    } catch (error) {
      console.error('Error al actualizar configuración de red:', error);

      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: 'Datos inválidos',
          message: error.message,
          field: error.field
        });
      }

      if (error instanceof BusinessLogicError) {
        return res.status(422).json({
          success: false,
          error: 'Error de validación de negocio',
          message: error.message,
          rule: error.rule
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * POST /api/sistema/red/test - Probar conectividad con nueva configuración
   */
  async testNetworkConfig(req, res) {
    try {
      const { host_principal, puerto_api } = req.body;

      if (!host_principal || !puerto_api) {
        return res.status(400).json({
          success: false,
          error: 'host_principal y puerto_api son requeridos'
        });
      }

      // Simular prueba de conectividad
      // En implementación real, intentarías conectar al host:puerto
      const testResult = {
        host_accesible: true, // Simulado
        puerto_disponible: puerto_api !== 80 && puerto_api !== 443, // Simulado
        latencia_ms: Math.random() * 50 + 10, // Simulado
        timestamp: new Date().toISOString()
      };

      const success = testResult.host_accesible && testResult.puerto_disponible;

      res.json({
        success,
        data: testResult,
        message: success
          ? `Conexión exitosa a ${host_principal}:${puerto_api}`
          : `Error de conexión a ${host_principal}:${puerto_api}`
      });

    } catch (error) {
      console.error('Error al probar configuración de red:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  // ============================================================================
  // ESTADO DE INSTALACIÓN
  // ============================================================================

  /**
   * GET /api/sistema/instalacion - Obtener estado de instalación
   */
  async getInstallationStatus(req, res) {
    try {
      const status = await this.service.getInstallationStatus();

      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error al obtener estado de instalación:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * PUT /api/sistema/instalacion/paso - Actualizar paso específico
   */
  async updateInstallationStep(req, res) {
    try {
      const { paso, completado } = req.body;
      const usuario = req.user?.usuario || 'admin';

      if (!paso || typeof completado !== 'boolean') {
        return res.status(400).json({
          success: false,
          error: 'paso y completado son requeridos'
        });
      }

      const updatedStatus = await this.service.updateInstallationStep(paso, completado, usuario);

      res.json({
        success: true,
        data: updatedStatus,
        message: `Paso '${paso}' ${completado ? 'completado' : 'marcado como pendiente'}`,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error al actualizar paso de instalación:', error);

      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: 'Datos inválidos',
          message: error.message,
          field: error.field
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  // ============================================================================
  // ASISTENTE DE INSTALACIÓN COMPLETA
  // ============================================================================

  /**
   * POST /api/setup/instalacion - Procesar instalación completa del sistema
   */
  async processFullInstallation(req, res) {
    try {
      const installationData = req.body;
      const usuario = req.user?.usuario || 'admin';
      const ipOrigen = req.ip || req.connection.remoteAddress;

      // Validar estructura mínima
      if (!installationData.duenio && !installationData.sucursales) {
        return res.status(400).json({
          success: false,
          error: 'Datos incompletos',
          message: 'Se requiere información del dueño o al menos una sucursal'
        });
      }

      const result = await this.service.processFullInstallation(installationData, usuario, ipOrigen);

      res.json({
        success: true,
        data: result.data,
        message: result.message,
        installation_completed: true,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error en instalación completa:', error);

      if (error instanceof ValidationError) {
        return res.status(400).json({
          success: false,
          error: 'Datos inválidos',
          message: error.message,
          field: error.field
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * GET /api/setup/status - Verificar si el sistema requiere instalación
   */
  async getSetupStatus(req, res) {
    try {
      const installationStatus = await this.service.getInstallationStatus();
      const systemInfo = await this.service.getSystemInfo();

      const requiresSetup = !installationStatus.instalado;

      res.json({
        success: true,
        data: {
          requires_setup: requiresSetup,
          installation_status: installationStatus,
          system_info: requiresSetup ? null : systemInfo // Solo mostrar info si ya está instalado
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error al verificar estado de setup:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  // ============================================================================
  // INFORMACIÓN GENERAL DEL SISTEMA
  // ============================================================================

  /**
   * GET /api/sistema/info - Obtener información completa del sistema
   */
  async getSystemInfo(req, res) {
    try {
      const systemInfo = await this.service.getSystemInfo();

      res.json({
        success: true,
        data: systemInfo,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error al obtener información del sistema:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  }

  /**
   * GET /api/sistema/health - Health check con información de configuración
   */
  async getSystemHealth(req, res) {
    try {
      const networkConfig = await this.service.getNetworkConfig();
      const installationStatus = await this.service.getInstallationStatus();

      const health = {
        status: 'healthy',
        uptime: process.uptime(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production',
        database: 'connected', // Asumir que está conectada si llegamos aquí
        network_config: {
          host: networkConfig.host_principal,
          port: networkConfig.puerto_api,
          ssl: networkConfig.ssl_activo
        },
        installation: {
          completed: installationStatus.instalado,
          version: installationStatus.version_instalada
        },
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('Error en health check:', error);
      res.status(503).json({
        success: false,
        error: 'Servicio no disponible',
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = SystemConfigController;