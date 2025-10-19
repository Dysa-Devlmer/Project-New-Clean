// backend/src/controllers/mesas.controller.js
const MesasService = require('../services/mesas.service');

class MesasController {
  constructor() {
    this.mesasService = new MesasService();
  }

  /**
   * GET /api/pos/mesas
   * Obtiene todas las mesas con filtros opcionales
   */
  async getMesas(req, res) {
    try {
      const filtros = {
        zona_id: req.query.zona_id ? parseInt(req.query.zona_id) : undefined,
        estado: req.query.estado,
        capacidad_minima: req.query.capacidad_minima ? parseInt(req.query.capacidad_minima) : undefined,
        vip: req.query.vip !== undefined ? req.query.vip === 'true' : undefined
      };

      // Limpiar filtros undefined
      Object.keys(filtros).forEach(key => {
        if (filtros[key] === undefined) delete filtros[key];
      });

      const resultado = await this.mesasService.getMesas(filtros);

      res.json({
        success: true,
        data: resultado.data,
        meta: {
          total: resultado.total,
          filtros_aplicados: resultado.filtros_aplicados,
          timestamp: resultado.timestamp
        }
      });

    } catch (error) {
      console.error('Error en getMesas:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'MESAS_FETCH_ERROR'
      });
    }
  }

  /**
   * GET /api/pos/mesas/:id
   * Obtiene una mesa específica por ID
   */
  async getMesaById(req, res) {
    try {
      const { id } = req.params;
      const resultado = await this.mesasService.getMesaById(id);

      res.json({
        success: true,
        data: resultado.data
      });

    } catch (error) {
      console.error('Error en getMesaById:', error);
      const statusCode = error.message.includes('no encontrada') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'MESA_NOT_FOUND'
      });
    }
  }

  /**
   * POST /api/pos/mesas
   * Crea una nueva mesa
   */
  async crearMesa(req, res) {
    try {
      const datosMesa = req.body;

      // Agregar información del usuario que crea
      datosMesa.usuario_creacion = req.user?.nombre || 'SISTEMA';
      datosMesa.ip_origen = req.ip || req.connection.remoteAddress;

      const resultado = await this.mesasService.crearMesa(datosMesa);

      res.status(201).json({
        success: true,
        data: resultado.data,
        message: resultado.message
      });

    } catch (error) {
      console.error('Error en crearMesa:', error);
      const statusCode = error.message.includes('Ya existe') ? 409 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'MESA_CREATION_ERROR'
      });
    }
  }

  /**
   * PUT /api/pos/mesas/:id/estado
   * Cambia el estado de una mesa
   */
  async cambiarEstadoMesa(req, res) {
    try {
      const { id } = req.params;
      const { estado, comensales, empleado_id, motivo, observaciones, cliente_nombre } = req.body;

      if (!estado) {
        return res.status(400).json({
          success: false,
          error: 'Estado es requerido',
          code: 'MISSING_ESTADO'
        });
      }

      const opciones = {
        comensales,
        empleado_id,
        motivo,
        observaciones,
        cliente_nombre,
        usuario_id: req.user?.id || null,
        usuario_nombre: req.user?.nombre || 'SISTEMA',
        ip_origen: req.ip || req.connection.remoteAddress
      };

      // Limpiar opciones undefined
      Object.keys(opciones).forEach(key => {
        if (opciones[key] === undefined) delete opciones[key];
      });

      const resultado = await this.mesasService.cambiarEstadoMesa(id, estado, opciones);

      res.json({
        success: true,
        data: resultado.data,
        cambio: resultado.cambio,
        message: resultado.message
      });

    } catch (error) {
      console.error('Error en cambiarEstadoMesa:', error);
      const statusCode = error.message.includes('no encontrada') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'ESTADO_CHANGE_ERROR'
      });
    }
  }

  /**
   * PUT /api/pos/mesas/:id/comensales
   * Actualiza el número de comensales en una mesa ocupada
   */
  async actualizarComensales(req, res) {
    try {
      const { id } = req.params;
      const { comensales } = req.body;

      if (!comensales || comensales < 1) {
        return res.status(400).json({
          success: false,
          error: 'Número de comensales inválido',
          code: 'INVALID_COMENSALES'
        });
      }

      // Primero verificar que la mesa esté ocupada
      const mesa = await this.mesasService.getMesaById(id);
      if (!mesa.success) {
        return res.status(404).json({
          success: false,
          error: 'Mesa no encontrada',
          code: 'MESA_NOT_FOUND'
        });
      }

      if (mesa.data.estado_mesa !== 'OCUPADA') {
        return res.status(400).json({
          success: false,
          error: 'Solo se pueden actualizar comensales en mesas ocupadas',
          code: 'MESA_NOT_OCCUPIED'
        });
      }

      const opciones = {
        comensales,
        motivo: `Actualización de comensales: ${mesa.data.numero_comensales_actuales} → ${comensales}`,
        usuario_id: req.user?.id || null,
        usuario_nombre: req.user?.nombre || 'SISTEMA',
        ip_origen: req.ip || req.connection.remoteAddress
      };

      const resultado = await this.mesasService.cambiarEstadoMesa(id, 'OCUPADA', opciones);

      res.json({
        success: true,
        data: resultado.data,
        message: `Comensales actualizados a ${comensales}`
      });

    } catch (error) {
      console.error('Error en actualizarComensales:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'COMENSALES_UPDATE_ERROR'
      });
    }
  }

  /**
   * GET /api/pos/mesas/disponibles
   * Busca mesas disponibles por capacidad
   */
  async buscarMesasDisponibles(req, res) {
    try {
      const capacidadRequerida = parseInt(req.query.capacidad);

      if (!capacidadRequerida) {
        return res.status(400).json({
          success: false,
          error: 'Capacidad requerida es obligatoria',
          code: 'MISSING_CAPACIDAD'
        });
      }

      const filtros = {
        zona: req.query.zona
      };

      const resultado = await this.mesasService.buscarMesasDisponibles(capacidadRequerida, filtros);

      res.json({
        success: true,
        data: resultado.data,
        criterio_busqueda: resultado.criterio_busqueda,
        recomendacion: resultado.recomendacion
      });

    } catch (error) {
      console.error('Error en buscarMesasDisponibles:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'SEARCH_ERROR'
      });
    }
  }

  /**
   * GET /api/pos/mesas/:id/historial
   * Obtiene el historial de una mesa
   */
  async getHistorialMesa(req, res) {
    try {
      const { id } = req.params;
      const limite = parseInt(req.query.limite) || 10;

      const mesa = await this.mesasService.getMesaById(id);
      if (!mesa.success) {
        return res.status(404).json({
          success: false,
          error: 'Mesa no encontrada',
          code: 'MESA_NOT_FOUND'
        });
      }

      const historial = await this.mesasService.mesasRepository.getHistorialMesa(id, limite);

      res.json({
        success: true,
        data: {
          mesa: mesa.data,
          historial: historial
        },
        meta: {
          limite_aplicado: limite,
          total_registros: historial.length
        }
      });

    } catch (error) {
      console.error('Error en getHistorialMesa:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'HISTORIAL_ERROR'
      });
    }
  }

  /**
   * GET /api/pos/mesas/estadisticas
   * Obtiene estadísticas de mesas
   */
  async getEstadisticasMesas(req, res) {
    try {
      const resultado = await this.mesasService.getEstadisticasMesas();

      res.json({
        success: true,
        data: resultado.data
      });

    } catch (error) {
      console.error('Error en getEstadisticasMesas:', error);
      res.status(500).json({
        success: false,
        error: error.message,
        code: 'ESTADISTICAS_ERROR'
      });
    }
  }

  /**
   * POST /api/pos/mesas/:id/ocupar
   * Método conveniente para ocupar una mesa directamente
   */
  async ocuparMesa(req, res) {
    try {
      const { id } = req.params;
      const { comensales, empleado_id, cliente_nombre, observaciones } = req.body;

      if (!comensales || comensales < 1) {
        return res.status(400).json({
          success: false,
          error: 'Número de comensales es requerido',
          code: 'MISSING_COMENSALES'
        });
      }

      const opciones = {
        comensales,
        empleado_id,
        cliente_nombre,
        observaciones,
        motivo: `Mesa ocupada con ${comensales} comensales`,
        usuario_id: req.user?.id || null,
        usuario_nombre: req.user?.nombre || 'SISTEMA',
        ip_origen: req.ip || req.connection.remoteAddress
      };

      const resultado = await this.mesasService.cambiarEstadoMesa(id, 'OCUPADA', opciones);

      res.json({
        success: true,
        data: resultado.data,
        message: `Mesa ocupada exitosamente con ${comensales} comensales`
      });

    } catch (error) {
      console.error('Error en ocuparMesa:', error);
      const statusCode = error.message.includes('no encontrada') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'OCUPAR_MESA_ERROR'
      });
    }
  }

  /**
   * POST /api/pos/mesas/:id/liberar
   * Método conveniente para liberar una mesa
   */
  async liberarMesa(req, res) {
    try {
      const { id } = req.params;
      const { motivo, observaciones } = req.body;

      const opciones = {
        motivo: motivo || 'Mesa liberada',
        observaciones,
        usuario_id: req.user?.id || null,
        usuario_nombre: req.user?.nombre || 'SISTEMA',
        ip_origen: req.ip || req.connection.remoteAddress
      };

      const resultado = await this.mesasService.cambiarEstadoMesa(id, 'LIBRE', opciones);

      res.json({
        success: true,
        data: resultado.data,
        message: 'Mesa liberada exitosamente'
      });

    } catch (error) {
      console.error('Error en liberarMesa:', error);
      const statusCode = error.message.includes('no encontrada') ? 404 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'LIBERAR_MESA_ERROR'
      });
    }
  }

  /**
   * GET /api/pos/mesas/layout/:zona_id
   * Obtiene el layout de mesas de una zona específica para mostrar en el plano
   */
  async getLayoutZona(req, res) {
    try {
      const { zona_id } = req.params;

      const filtros = { zona_id: parseInt(zona_id) };
      const resultado = await this.mesasService.getMesas(filtros);

      // Formatear para layout visual
      const layout = resultado.data.map(mesa => ({
        id: mesa.id,
        numero_mesa: mesa.numero_mesa,
        estado: mesa.estado_mesa,
        estado_color: mesa.estado_color,
        coordenada_x: mesa.coordenada_x,
        coordenada_y: mesa.coordenada_y,
        ancho_mesa: mesa.ancho_mesa,
        alto_mesa: mesa.alto_mesa,
        rotacion_grados: mesa.rotacion_grados,
        forma_mesa: mesa.forma_mesa,
        capacidad_personas: mesa.capacidad_personas,
        numero_comensales_actuales: mesa.numero_comensales_actuales,
        mesa_vip: mesa.mesa_vip,
        alertas: mesa.alertas,
        tiempo_ocupacion_minutos: mesa.tiempo_ocupacion_minutos
      }));

      res.json({
        success: true,
        data: {
          zona_id: parseInt(zona_id),
          mesas: layout,
          total_mesas: layout.length
        }
      });

    } catch (error) {
      console.error('Error en getLayoutZona:', error);
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'LAYOUT_ERROR'
      });
    }
  }
}

module.exports = MesasController;