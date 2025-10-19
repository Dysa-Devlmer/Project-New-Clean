// backend/src/services/mesas.service.js
const MesasRepository = require('../repositories/mesas.repository');

class MesasService {
  constructor() {
    this.mesasRepository = new MesasRepository();
  }

  /**
   * Estados válidos para mesas
   */
  static ESTADOS_VALIDOS = [
    'LIBRE',
    'OCUPADA',
    'RESERVADA',
    'LIMPIEZA',
    'FUERA_SERVICIO'
  ];

  /**
   * Transiciones de estado permitidas
   */
  static TRANSICIONES_PERMITIDAS = {
    'LIBRE': ['OCUPADA', 'RESERVADA', 'LIMPIEZA', 'FUERA_SERVICIO'],
    'OCUPADA': ['LIBRE', 'LIMPIEZA', 'FUERA_SERVICIO'],
    'RESERVADA': ['LIBRE', 'OCUPADA', 'FUERA_SERVICIO'],
    'LIMPIEZA': ['LIBRE', 'FUERA_SERVICIO'],
    'FUERA_SERVICIO': ['LIBRE', 'LIMPIEZA']
  };

  /**
   * Obtiene todas las mesas con filtros y validaciones
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Object} Resultado con mesas y metadatos
   */
  async getMesas(filtros = {}) {
    try {
      // Validar filtros
      this._validarFiltrosMesas(filtros);

      const mesas = await this.mesasRepository.getMesas(filtros);

      // Enriquecer datos con información calculada
      const mesasEnriquecidas = mesas.map(mesa => ({
        ...mesa,
        tiempo_ocupacion_minutos: this._calcularTiempoOcupacion(mesa),
        estado_color: this._obtenerColorEstado(mesa.estado_mesa),
        puede_ocupar: this._puedeOcupar(mesa),
        alertas: this._generarAlertas(mesa)
      }));

      return {
        success: true,
        data: mesasEnriquecidas,
        total: mesasEnriquecidas.length,
        filtros_aplicados: filtros,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Error al obtener mesas: ${error.message}`);
    }
  }

  /**
   * Obtiene una mesa específica por ID
   * @param {number} id - ID de la mesa
   * @returns {Object} Datos de la mesa
   */
  async getMesaById(id) {
    try {
      this._validarId(id);

      const mesa = await this.mesasRepository.getMesaById(id);

      if (!mesa) {
        throw new Error('Mesa no encontrada');
      }

      // Obtener historial reciente
      const historial = await this.mesasRepository.getHistorialMesa(id, 5);

      return {
        success: true,
        data: {
          ...mesa,
          tiempo_ocupacion_minutos: this._calcularTiempoOcupacion(mesa),
          estado_color: this._obtenerColorEstado(mesa.estado_mesa),
          puede_ocupar: this._puedeOcupar(mesa),
          alertas: this._generarAlertas(mesa),
          historial_reciente: historial
        }
      };

    } catch (error) {
      throw new Error(`Error al obtener mesa: ${error.message}`);
    }
  }

  /**
   * Cambia el estado de una mesa con validaciones de negocio
   * @param {number} mesaId - ID de la mesa
   * @param {string} nuevoEstado - Nuevo estado
   * @param {Object} opciones - Opciones del cambio
   * @returns {Object} Resultado del cambio
   */
  async cambiarEstadoMesa(mesaId, nuevoEstado, opciones = {}) {
    try {
      this._validarId(mesaId);
      this._validarEstado(nuevoEstado);

      // Obtener estado actual
      const mesa = await this.mesasRepository.getMesaById(mesaId);
      if (!mesa) {
        throw new Error('Mesa no encontrada');
      }

      // Validar transición de estado
      this._validarTransicionEstado(mesa.estado_mesa, nuevoEstado);

      // Validaciones específicas por estado
      this._validarCambioEstadoEspecifico(mesa, nuevoEstado, opciones);

      // Preparar opciones con validaciones
      const opcionesValidadas = this._prepararOpcionesCambioEstado(
        mesa, nuevoEstado, opciones
      );

      // Ejecutar cambio
      await this.mesasRepository.cambiarEstadoMesa(mesaId, nuevoEstado, opcionesValidadas);

      // Obtener mesa actualizada
      const mesaActualizada = await this.mesasRepository.getMesaById(mesaId);

      return {
        success: true,
        data: mesaActualizada,
        cambio: {
          estado_anterior: mesa.estado_mesa,
          estado_nuevo: nuevoEstado,
          usuario: opcionesValidadas.usuario_nombre,
          fecha: new Date().toISOString(),
          motivo: opcionesValidadas.motivo
        },
        message: `Estado cambiado exitosamente: ${mesa.estado_mesa} → ${nuevoEstado}`
      };

    } catch (error) {
      throw new Error(`Error al cambiar estado de mesa: ${error.message}`);
    }
  }

  /**
   * Crear nueva mesa con validaciones
   * @param {Object} datosMesa - Datos de la nueva mesa
   * @returns {Object} Mesa creada
   */
  async crearMesa(datosMesa) {
    try {
      // Validar datos de entrada
      this._validarDatosMesa(datosMesa);

      // Validar que no exista mesa con mismo número
      const mesaExistente = await this.mesasRepository.getMesaByNumero(datosMesa.numero_mesa);
      if (mesaExistente) {
        throw new Error(`Ya existe una mesa con el número ${datosMesa.numero_mesa}`);
      }

      // Normalizar datos
      const datosNormalizados = this._normalizarDatosMesa(datosMesa);

      // Crear mesa
      const mesaId = await this.mesasRepository.crearMesa(datosNormalizados);

      // Obtener mesa creada
      const mesaCreada = await this.mesasRepository.getMesaById(mesaId);

      return {
        success: true,
        data: mesaCreada,
        message: `Mesa ${datosMesa.numero_mesa} creada exitosamente`
      };

    } catch (error) {
      throw new Error(`Error al crear mesa: ${error.message}`);
    }
  }

  /**
   * Buscar mesas disponibles por capacidad
   * @param {number} capacidadRequerida - Capacidad requerida
   * @param {Object} filtros - Filtros adicionales
   * @returns {Object} Mesas disponibles ordenadas por prioridad
   */
  async buscarMesasDisponibles(capacidadRequerida, filtros = {}) {
    try {
      this._validarCapacidad(capacidadRequerida);

      const mesas = await this.mesasRepository.buscarMesasDisponibles(
        capacidadRequerida,
        filtros.zona
      );

      // Ordenar por criterios de negocio
      const mesasOrdenadas = this._ordenarMesasPorPrioridad(mesas, capacidadRequerida);

      return {
        success: true,
        data: mesasOrdenadas,
        criterio_busqueda: {
          capacidad_requerida: capacidadRequerida,
          zona: filtros.zona || 'Todas',
          total_encontradas: mesasOrdenadas.length
        },
        recomendacion: mesasOrdenadas.length > 0 ? mesasOrdenadas[0] : null
      };

    } catch (error) {
      throw new Error(`Error al buscar mesas disponibles: ${error.message}`);
    }
  }

  /**
   * Obtener estadísticas de mesas
   * @returns {Object} Estadísticas completas
   */
  async getEstadisticasMesas() {
    try {
      const estadisticas = await this.mesasRepository.getEstadisticasMesas();

      // Agregar métricas calculadas
      const estadisticasCompletas = {
        ...estadisticas,
        metricas: {
          porcentaje_ocupacion: this._calcularPorcentajeOcupacion(estadisticas.por_estado),
          eficiencia_rotacion: this._calcularEficienciaRotacion(estadisticas),
          alertas_sistema: this._generarAlertasSistema(estadisticas)
        }
      };

      return {
        success: true,
        data: estadisticasCompletas
      };

    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  // === MÉTODOS PRIVADOS DE VALIDACIÓN ===

  _validarFiltrosMesas(filtros) {
    if (filtros.estado && !MesasService.ESTADOS_VALIDOS.includes(filtros.estado)) {
      throw new Error(`Estado inválido: ${filtros.estado}`);
    }

    if (filtros.capacidad_minima && (filtros.capacidad_minima < 1 || filtros.capacidad_minima > 20)) {
      throw new Error('Capacidad mínima debe estar entre 1 y 20');
    }

    if (filtros.zona_id && filtros.zona_id < 1) {
      throw new Error('ID de zona inválido');
    }
  }

  _validarId(id) {
    if (!id || !Number.isInteger(Number(id)) || Number(id) < 1) {
      throw new Error('ID de mesa inválido');
    }
  }

  _validarEstado(estado) {
    if (!estado || !MesasService.ESTADOS_VALIDOS.includes(estado)) {
      throw new Error(`Estado inválido: ${estado}. Estados válidos: ${MesasService.ESTADOS_VALIDOS.join(', ')}`);
    }
  }

  _validarTransicionEstado(estadoActual, nuevoEstado) {
    if (estadoActual === nuevoEstado) {
      throw new Error(`La mesa ya está en estado ${nuevoEstado}`);
    }

    if (!MesasService.TRANSICIONES_PERMITIDAS[estadoActual]?.includes(nuevoEstado)) {
      throw new Error(`Transición no permitida: ${estadoActual} → ${nuevoEstado}`);
    }
  }

  _validarCambioEstadoEspecifico(mesa, nuevoEstado, opciones) {
    switch (nuevoEstado) {
      case 'OCUPADA':
        if (!opciones.comensales || opciones.comensales < 1) {
          throw new Error('Debe especificar número de comensales para ocupar mesa');
        }
        if (opciones.comensales > mesa.capacidad_maxima) {
          throw new Error(`Número de comensales (${opciones.comensales}) excede capacidad máxima (${mesa.capacidad_maxima})`);
        }
        break;

      case 'RESERVADA':
        if (!opciones.cliente_nombre) {
          throw new Error('Debe especificar nombre del cliente para reserva');
        }
        break;

      case 'FUERA_SERVICIO':
        if (!opciones.motivo) {
          throw new Error('Debe especificar motivo para poner mesa fuera de servicio');
        }
        break;
    }
  }

  _validarDatosMesa(datos) {
    if (!datos.numero_mesa) {
      throw new Error('Número de mesa es requerido');
    }

    if (!datos.zona_id || datos.zona_id < 1) {
      throw new Error('ID de zona válido es requerido');
    }

    if (!datos.capacidad_personas || datos.capacidad_personas < 1 || datos.capacidad_personas > 20) {
      throw new Error('Capacidad de personas debe estar entre 1 y 20');
    }

    if (datos.coordenada_x !== undefined && (datos.coordenada_x < 0 || datos.coordenada_x > 2000)) {
      throw new Error('Coordenada X debe estar entre 0 y 2000');
    }

    if (datos.coordenada_y !== undefined && (datos.coordenada_y < 0 || datos.coordenada_y > 2000)) {
      throw new Error('Coordenada Y debe estar entre 0 y 2000');
    }
  }

  _validarCapacidad(capacidad) {
    if (!capacidad || capacidad < 1 || capacidad > 20) {
      throw new Error('Capacidad requerida debe estar entre 1 y 20');
    }
  }

  // === MÉTODOS PRIVADOS DE LÓGICA DE NEGOCIO ===

  _calcularTiempoOcupacion(mesa) {
    if (mesa.estado_mesa !== 'OCUPADA' || !mesa.ocupada_desde) {
      return 0;
    }

    const ahora = new Date();
    const ocupadaDesde = new Date(mesa.ocupada_desde);
    return Math.floor((ahora - ocupadaDesde) / (1000 * 60)); // minutos
  }

  _obtenerColorEstado(estado) {
    const colores = {
      'LIBRE': '#4CAF50',      // Verde
      'OCUPADA': '#FF9800',    // Naranja
      'RESERVADA': '#2196F3',  // Azul
      'LIMPIEZA': '#9C27B0',   // Morado
      'FUERA_SERVICIO': '#F44336' // Rojo
    };
    return colores[estado] || '#757575';
  }

  _puedeOcupar(mesa) {
    return mesa.estado_mesa === 'LIBRE' && mesa.mesa_activa === 1;
  }

  _generarAlertas(mesa) {
    const alertas = [];

    if (mesa.estado_mesa === 'OCUPADA') {
      const tiempoOcupacion = this._calcularTiempoOcupacion(mesa);

      if (mesa.tiempo_limite_ocupacion && tiempoOcupacion > mesa.tiempo_limite_ocupacion) {
        alertas.push({
          tipo: 'tiempo_excedido',
          mensaje: `Mesa excede tiempo límite (${tiempoOcupacion}/${mesa.tiempo_limite_ocupacion} min)`,
          prioridad: 'alta'
        });
      } else if (mesa.tiempo_limite_ocupacion && tiempoOcupacion > (mesa.tiempo_limite_ocupacion * 0.8)) {
        alertas.push({
          tipo: 'tiempo_advertencia',
          mensaje: `Mesa cerca del tiempo límite (${tiempoOcupacion}/${mesa.tiempo_limite_ocupacion} min)`,
          prioridad: 'media'
        });
      }
    }

    if (mesa.estado_mesa === 'LIMPIEZA' && mesa.cambios_hoy > 5) {
      alertas.push({
        tipo: 'limpieza_frecuente',
        mensaje: `Mesa ha requerido limpieza ${mesa.cambios_hoy} veces hoy`,
        prioridad: 'media'
      });
    }

    return alertas;
  }

  _prepararOpcionesCambioEstado(mesa, nuevoEstado, opciones) {
    return {
      ...opciones,
      usuario_nombre: opciones.usuario_nombre || 'SISTEMA',
      motivo: opciones.motivo || `Cambio de estado: ${mesa.estado_mesa} → ${nuevoEstado}`,
      ip_origen: opciones.ip_origen || null
    };
  }

  _normalizarDatosMesa(datos) {
    return {
      ...datos,
      capacidad_maxima: datos.capacidad_maxima || datos.capacidad_personas + 2,
      forma_mesa: datos.forma_mesa || 'CUADRADA',
      coordenada_x: datos.coordenada_x || 0,
      coordenada_y: datos.coordenada_y || 0,
      ancho_mesa: datos.ancho_mesa || 100,
      alto_mesa: datos.alto_mesa || 100,
      rotacion_grados: datos.rotacion_grados || 0,
      mesa_vip: datos.mesa_vip || 0,
      acceso_discapacitados: datos.acceso_discapacitados !== undefined ? datos.acceso_discapacitados : 1,
      cerca_ventana: datos.cerca_ventana || 0,
      aire_libre: datos.aire_libre || 0,
      requiere_reserva: datos.requiere_reserva || 0,
      tiempo_limite_ocupacion: datos.tiempo_limite_ocupacion || 120
    };
  }

  _ordenarMesasPorPrioridad(mesas, capacidadRequerida) {
    return mesas.sort((a, b) => {
      // 1. Prioridad por capacidad exacta
      const diferenciaA = a.capacidad_personas - capacidadRequerida;
      const diferenciaB = b.capacidad_personas - capacidadRequerida;

      if (diferenciaA !== diferenciaB) {
        return diferenciaA - diferenciaB; // Menor diferencia primero
      }

      // 2. Prioridad por características especiales
      if (a.mesa_vip !== b.mesa_vip) {
        return b.mesa_vip - a.mesa_vip; // VIP primero
      }

      if (a.cerca_ventana !== b.cerca_ventana) {
        return b.cerca_ventana - a.cerca_ventana; // Ventana primero
      }

      // 3. Por número de mesa
      return a.numero_mesa.localeCompare(b.numero_mesa);
    });
  }

  _calcularPorcentajeOcupacion(porEstado) {
    const total = porEstado.reduce((sum, item) => sum + item.cantidad, 0);
    const ocupadas = porEstado.find(item => item.estado_mesa === 'OCUPADA')?.cantidad || 0;

    return total > 0 ? Math.round((ocupadas / total) * 100) : 0;
  }

  _calcularEficienciaRotacion(estadisticas) {
    // Métrica simple basada en ocupación vs disponibilidad
    const total = estadisticas.total_mesas;
    const ocupadas = estadisticas.por_estado.find(e => e.estado_mesa === 'OCUPADA')?.cantidad || 0;
    const libres = estadisticas.por_estado.find(e => e.estado_mesa === 'LIBRE')?.cantidad || 0;

    return {
      ratio_ocupacion: total > 0 ? (ocupadas / total) : 0,
      mesas_disponibles: libres,
      recomendacion: ocupadas / total > 0.8 ? 'Considerar optimizar tiempos de servicio' : 'Capacidad adecuada'
    };
  }

  _generarAlertasSistema(estadisticas) {
    const alertas = [];
    const porcentajeOcupacion = this._calcularPorcentajeOcupacion(estadisticas.por_estado);

    if (porcentajeOcupacion > 90) {
      alertas.push({
        tipo: 'ocupacion_critica',
        mensaje: `Ocupación crítica: ${porcentajeOcupacion}%`,
        prioridad: 'alta'
      });
    }

    const fueraServicio = estadisticas.por_estado.find(e => e.estado_mesa === 'FUERA_SERVICIO')?.cantidad || 0;
    if (fueraServicio > 0) {
      alertas.push({
        tipo: 'mesas_fuera_servicio',
        mensaje: `${fueraServicio} mesa(s) fuera de servicio`,
        prioridad: 'media'
      });
    }

    return alertas;
  }
}

module.exports = MesasService;