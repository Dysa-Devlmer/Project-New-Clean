// backend/src/controllers/configuracion.controller.js
const ConfiguracionService = require('../services/configuracion.service');

class ConfiguracionController {
  constructor() {
    this.service = new ConfiguracionService();
  }

  /**
   * GET /api/configuracion/sistema/configuracion
   * Obtiene toda la configuración del sistema
   */
  async getConfiguracionSistema(req, res) {
    try {
      const configuracion = await this.service.getConfiguracionSistema();

      res.status(200).json({
        success: true,
        data: configuracion,
        message: 'Configuración del sistema obtenida correctamente'
      });

    } catch (error) {
      console.error('Error en getConfiguracionSistema:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error interno del servidor al obtener configuración'
      });
    }
  }

  /**
   * PUT /api/configuracion/sistema/configuracion
   * Actualiza una sección específica de configuración
   * Body: { seccion: string, configuracion: object }
   */
  async putConfiguracionSistema(req, res) {
    try {
      const { seccion, configuracion } = req.body;

      // Validar que se proporcionaron los datos requeridos
      if (!seccion) {
        return res.status(400).json({
          success: false,
          error: 'El campo "seccion" es requerido',
          message: 'Debe especificar la sección a actualizar'
        });
      }

      if (!configuracion || typeof configuracion !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'El campo "configuracion" es requerido y debe ser un objeto',
          message: 'Debe proporcionar los datos de configuración a actualizar'
        });
      }

      const resultado = await this.service.actualizarConfiguracionSistema(seccion, configuracion);

      res.status(200).json({
        success: true,
        data: resultado,
        message: `Configuración de ${seccion} actualizada correctamente`
      });

    } catch (error) {
      console.error('Error en putConfiguracionSistema:', error);

      // Determinar el código de estado basado en el tipo de error
      let statusCode = 500;
      if (error.message.includes('no válida') || error.message.includes('requerido')) {
        statusCode = 400;
      } else if (error.message.includes('no encontró')) {
        statusCode = 404;
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        message: 'Error al actualizar configuración del sistema'
      });
    }
  }

  /**
   * GET /api/configuracion/categorias/lista
   * Obtiene la lista de categorías activas ordenadas
   */
  async getCategorias(req, res) {
    try {
      const categorias = await this.service.getCategorias();

      res.status(200).json({
        success: true,
        data: categorias,
        message: 'Categorías obtenidas correctamente'
      });

    } catch (error) {
      console.error('Error en getCategorias:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error interno del servidor al obtener categorías'
      });
    }
  }

  /**
   * GET /api/configuracion/sistema/estado
   * Obtiene estadísticas y estado general del sistema
   */
  async getEstadoSistema(req, res) {
    try {
      const estadisticas = await this.service.getEstadisticasSistema();

      res.status(200).json({
        success: true,
        data: estadisticas,
        message: 'Estado del sistema obtenido correctamente'
      });

    } catch (error) {
      console.error('Error en getEstadoSistema:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error interno del servidor al obtener estado del sistema'
      });
    }
  }

  /**
   * GET /api/configuracion/empresa
   * Obtiene solo la configuración de empresa
   */
  async getConfiguracionEmpresa(req, res) {
    try {
      const configuracion = await this.service.getConfiguracionSistema();

      res.status(200).json({
        success: true,
        data: {
          empresa: configuracion.empresa,
          timestamp: configuracion.metadata.timestamp
        },
        message: 'Configuración de empresa obtenida correctamente'
      });

    } catch (error) {
      console.error('Error en getConfiguracionEmpresa:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        message: 'Error interno del servidor al obtener configuración de empresa'
      });
    }
  }

  /**
   * PUT /api/configuracion/empresa
   * Actualiza solo la configuración de empresa
   */
  async putConfiguracionEmpresa(req, res) {
    try {
      const configuracion = req.body;

      if (!configuracion || typeof configuracion !== 'object') {
        return res.status(400).json({
          success: false,
          error: 'Debe proporcionar los datos de configuración de empresa',
          message: 'El cuerpo de la petición debe contener la configuración'
        });
      }

      const resultado = await this.service.actualizarConfiguracionSistema('empresa', configuracion);

      res.status(200).json({
        success: true,
        data: resultado,
        message: 'Configuración de empresa actualizada correctamente'
      });

    } catch (error) {
      console.error('Error en putConfiguracionEmpresa:', error);

      let statusCode = 500;
      if (error.message.includes('no válida') || error.message.includes('requerido')) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        error: error.message,
        message: 'Error al actualizar configuración de empresa'
      });
    }
  }

  // Middleware para manejar errores de rutas
  handleNotFound(req, res) {
    res.status(404).json({
      success: false,
      error: 'Endpoint no encontrado',
      message: `La ruta ${req.method} ${req.path} no existe`,
      availableEndpoints: [
        'GET /api/configuracion/sistema/configuracion',
        'PUT /api/configuracion/sistema/configuracion',
        'GET /api/configuracion/categorias/lista',
        'GET /api/configuracion/empresa',
        'PUT /api/configuracion/empresa',
        'GET /api/configuracion/sistema/estado'
      ]
    });
  }
}

module.exports = ConfiguracionController;