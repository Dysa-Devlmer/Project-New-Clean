// backend/src/services/configuracion.service.js
const ConfiguracionRepository = require('../repositories/configuracion.repository');

class ConfiguracionService {
  constructor() {
    this.repository = new ConfiguracionRepository();
  }

  /**
   * Obtiene la configuración completa del sistema
   * @returns {Object} Configuración estructurada del sistema
   */
  async getConfiguracionSistema() {
    try {
      const config = await this.repository.getConfiguracionCompleta();

      // Normalizar y estructurar la respuesta
      return {
        empresa: this._normalizarEmpresa(config.empresa),
        fiscal: this._normalizarFiscal(config.fiscal),
        operativa: this._normalizarOperativa(config.operativa),
        restaurante: this._normalizarRestaurante(config.restaurante),
        ventas: this._normalizarVentas(config.ventas),
        empleados: this._normalizarEmpleados(config.empleados),
        impresion: this._normalizarImpresion(config.impresion),
        sistema: this._normalizarSistema(config.sistema),
        seguridad: this._normalizarSeguridad(config.seguridad),
        runtime: this._normalizarRuntime(config.runtime),
        metadata: {
          timestamp: new Date().toISOString(),
          version: '2.0'
        }
      };
    } catch (error) {
      throw new Error(`Error al obtener configuración del sistema: ${error.message}`);
    }
  }

  /**
   * Actualiza una sección específica de configuración
   * @param {string} seccion - Sección a actualizar
   * @param {Object} configuracion - Datos de configuración
   * @returns {Object} Resultado de la actualización
   */
  async actualizarConfiguracionSistema(seccion, configuracion) {
    try {
      // Validar sección
      const seccionesValidas = [
        'empresa', 'fiscal', 'operativa', 'restaurante',
        'ventas', 'empleados', 'impresion', 'sistema', 'seguridad'
      ];

      if (!seccionesValidas.includes(seccion)) {
        throw new Error(`Sección no válida: ${seccion}. Secciones válidas: ${seccionesValidas.join(', ')}`);
      }

      // Validar datos según la sección
      const configuracionValidada = this._validarConfiguracion(seccion, configuracion);

      // Actualizar en la base de datos
      await this.repository.actualizarConfiguracion(seccion, configuracionValidada);

      // Retornar configuración actualizada
      const configActualizada = await this.getConfiguracionSistema();

      return {
        success: true,
        message: `Configuración de ${seccion} actualizada correctamente`,
        seccion,
        configuracion: configActualizada[seccion],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Error al actualizar configuración de ${seccion}: ${error.message}`);
    }
  }

  /**
   * Obtiene la lista de categorías activas
   * @returns {Array} Lista de categorías ordenadas
   */
  async getCategorias() {
    try {
      const categorias = await this.repository.getCategorias();

      return {
        categorias: categorias.map(cat => ({
          id: cat.id,
          nombre: cat.nombre,
          descripcion: cat.descripcion,
          orden: cat.orden,
          color: cat.color_hex,
          icono: cat.icono,
          activa: !!cat.activa,
          fechaCreacion: cat.created_at,
          fechaActualizacion: cat.updated_at
        })),
        total: categorias.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Error al obtener categorías: ${error.message}`);
    }
  }

  /**
   * Obtiene estadísticas del sistema
   * @returns {Object} Estadísticas generales
   */
  async getEstadisticasSistema() {
    try {
      return await this.repository.getEstadisticasSistema();
    } catch (error) {
      throw new Error(`Error al obtener estadísticas: ${error.message}`);
    }
  }

  // Métodos privados de normalización
  _normalizarEmpresa(empresa) {
    return {
      razonSocial: empresa.razon_social || '',
      nombreComercial: empresa.nombre_comercial || '',
      rut: empresa.rut_nif || empresa.rut_empresa || '',
      direccion: empresa.direccion_fiscal || empresa.direccion || '',
      telefono: empresa.telefono || empresa.telefono_principal || '',
      email: empresa.email || empresa.email_principal || '',
      sitioWeb: empresa.sitio_web || '',
      logoUrl: empresa.logo_url || '',
      giroComercial: empresa.giro_comercial || '',
      actividadEconomica: empresa.actividad_economica || '',
      comuna: empresa.comuna || '',
      ciudad: empresa.ciudad || '',
      region: empresa.region || '',
      representanteLegal: empresa.representante_legal || '',
      moneda: empresa.moneda || 'CLP',
      zonaHoraria: empresa.zona_horaria || 'America/Santiago',
      idioma: empresa.idioma || 'es_CL'
    };
  }

  _normalizarFiscal(fiscal) {
    return {
      monedaPrincipal: fiscal.moneda_principal || 'CLP',
      simboloMoneda: fiscal.simbolo_moneda || fiscal.moneda_simbolo || '$',
      ivaDefecto: parseFloat(fiscal.iva_defecto || 19),
      serieFactura: fiscal.serie_factura || 'F',
      numeracionInicio: parseInt(fiscal.numeracion_inicio || 1),
      formatoFactura: fiscal.formato_factura || 'estandar',
      decimalesMoneda: parseInt(fiscal.decimales_moneda || 0),
      redondeoActivo: !!fiscal.redondeo_activo,
      redondeoValor: parseFloat(fiscal.redondeo_valor || 0.05)
    };
  }

  _normalizarOperativa(operativa) {
    return {
      zonaHoraria: operativa.zona_horaria || 'America/Santiago',
      formatoFecha: operativa.formato_fecha || 'DD/MM/YYYY',
      formatoHora: operativa.formato_hora || 'HH:mm',
      idiomaPredeterminado: operativa.idioma_predeterminado || 'es',
      idiomasDisponibles: this._parseJSON(operativa.idiomas_disponibles, ['es', 'en']),
      monedaDecimales: parseInt(operativa.moneda_decimales || 0)
    };
  }

  _normalizarRestaurante(restaurante) {
    return {
      nombreEstablecimiento: restaurante.nombre_establecimiento || '',
      tipoRestaurante: restaurante.tipo_restaurante || restaurante.tipo_establecimiento || 'casual',
      capacidadMaxima: parseInt(restaurante.capacidad_maxima || 80),
      totalMesas: parseInt(restaurante.total_mesas || 20),
      mesasActivas: parseInt(restaurante.mesas_activas || 18),
      bloquesCocina: parseInt(restaurante.bloques_cocina || 4),
      tiempoPreparacionPromedio: parseInt(restaurante.tiempo_preparacion_promedio || 15)
    };
  }

  _normalizarVentas(ventas) {
    return {
      ivaPorcentaje: parseFloat(ventas.iva_porcentaje || 19),
      permitirDescuentos: !!ventas.permitir_descuentos,
      descuentoMaximo: parseFloat(ventas.descuento_maximo || 50),
      permitirPropinas: !!ventas.permitir_propinas,
      propinaSugerida: parseFloat(ventas.propina_sugerida || 10),
      redondeoActivo: !!ventas.redondeo_activo,
      redondeoValor: parseFloat(ventas.redondeo_valor || 0.05)
    };
  }

  _normalizarEmpleados(empleados) {
    return {
      totalEmpleados: parseInt(empleados.total_empleados || 8),
      empleadosActivos: parseInt(empleados.empleados_activos || 6),
      turnosActivos: parseInt(empleados.turnos_activos || 2),
      controlHorario: !!empleados.control_horario,
      permisosAvanzados: !!empleados.permisos_avanzados
    };
  }

  _normalizarImpresion(impresion) {
    return {
      imprimirLogo: !!impresion.imprimir_logo,
      imprimirDireccion: !!impresion.imprimir_direccion,
      imprimirTelefono: !!impresion.imprimir_telefono,
      imprimirRut: !!impresion.imprimir_rut,
      tamanoPapel: impresion.tamano_papel || 'A4',
      orientacion: impresion.orientacion || 'portrait',
      margenSuperior: parseInt(impresion.margen_superior || 10),
      margenInferior: parseInt(impresion.margen_inferior || 10),
      impresoraTickets: impresion.impresora_tickets || 'default',
      impresoraCocina: impresion.impresora_cocina || 'default'
    };
  }

  _normalizarSistema(sistema) {
    return {
      version: sistema.version_sistema || sistema.version || '3.0.0',
      ambiente: sistema.ambiente || 'production',
      modoMantenimiento: !!sistema.modo_mantenimiento,
      backupAutomatico: !!sistema.backup_automatico,
      backupFrecuencia: sistema.backup_frecuencia || 'diario',
      ultimoBackup: sistema.ultimo_backup || null,
      debugMode: !!sistema.debug_mode,
      sslActivo: !!sistema.ssl_activo
    };
  }

  _normalizarSeguridad(seguridad) {
    return {
      sesionTimeout: parseInt(seguridad.sesion_timeout || 3600),
      intentosLoginMax: parseInt(seguridad.intentos_login_max || 5),
      bloqueoTemporal: parseInt(seguridad.bloqueo_temporal || 300),
      auditoriaActiva: !!seguridad.auditoria_activa,
      logsDetallados: !!seguridad.logs_detallados,
      backupEncriptado: !!seguridad.backup_encriptado
    };
  }

  _normalizarRuntime(runtime) {
    return {
      sistemaActivo: !!runtime.sistema_activo,
      baseDatosConectada: !!runtime.base_datos_conectada,
      servidorFuncionando: !!runtime.servidor_funcionando,
      usuariosConectados: parseInt(runtime.usuarios_conectados || 0),
      ventasHoy: parseInt(runtime.ventas_hoy || 0),
      ingresosHoy: parseFloat(runtime.ingresos_hoy || 0),
      ultimaActualizacion: runtime.ultima_actualizacion || new Date().toISOString()
    };
  }

  // Métodos de validación
  _validarConfiguracion(seccion, configuracion) {
    const validators = {
      empresa: this._validarEmpresa,
      fiscal: this._validarFiscal,
      operativa: this._validarOperativa,
      restaurante: this._validarRestaurante,
      ventas: this._validarVentas,
      empleados: this._validarEmpleados,
      impresion: this._validarImpresion,
      sistema: this._validarSistema,
      seguridad: this._validarSeguridad
    };

    const validator = validators[seccion];
    if (!validator) {
      throw new Error(`No existe validador para la sección: ${seccion}`);
    }

    return validator.call(this, configuracion);
  }

  _validarEmpresa(config) {
    const validado = {};
    if (config.razonSocial !== undefined) validado.razon_social = String(config.razonSocial);
    if (config.nombreComercial !== undefined) validado.nombre_comercial = String(config.nombreComercial);
    if (config.rut !== undefined) validado.rut_nif = String(config.rut);
    if (config.direccion !== undefined) validado.direccion_fiscal = String(config.direccion);
    if (config.telefono !== undefined) validado.telefono = String(config.telefono);
    if (config.email !== undefined) validado.email = String(config.email);
    if (config.sitioWeb !== undefined) validado.sitio_web = String(config.sitioWeb);
    if (config.logoUrl !== undefined) validado.logo_url = String(config.logoUrl);
    return validado;
  }

  _validarFiscal(config) {
    const validado = {};
    if (config.monedaPrincipal !== undefined) validado.moneda_principal = String(config.monedaPrincipal);
    if (config.simboloMoneda !== undefined) validado.simbolo_moneda = String(config.simboloMoneda);
    if (config.ivaDefecto !== undefined) {
      const iva = parseFloat(config.ivaDefecto);
      if (iva < 0 || iva > 50) throw new Error('IVA debe estar entre 0 y 50%');
      validado.iva_defecto = iva;
    }
    if (config.serieFactura !== undefined) validado.serie_factura = String(config.serieFactura);
    if (config.numeracionInicio !== undefined) validado.numeracion_inicio = parseInt(config.numeracionInicio);
    if (config.formatoFactura !== undefined) validado.formato_factura = String(config.formatoFactura);
    return validado;
  }

  _validarOperativa(config) {
    const validado = {};
    if (config.zonaHoraria !== undefined) validado.zona_horaria = String(config.zonaHoraria);
    if (config.formatoFecha !== undefined) validado.formato_fecha = String(config.formatoFecha);
    if (config.formatoHora !== undefined) validado.formato_hora = String(config.formatoHora);
    if (config.idiomaPredeterminado !== undefined) validado.idioma_predeterminado = String(config.idiomaPredeterminado);
    if (config.idiomasDisponibles !== undefined) {
      validado.idiomas_disponibles = JSON.stringify(config.idiomasDisponibles);
    }
    return validado;
  }

  _validarRestaurante(config) {
    const validado = {};
    if (config.nombreEstablecimiento !== undefined) validado.nombre_establecimiento = String(config.nombreEstablecimiento);
    if (config.tipoRestaurante !== undefined) validado.tipo_restaurante = String(config.tipoRestaurante);
    if (config.capacidadMaxima !== undefined) validado.capacidad_maxima = parseInt(config.capacidadMaxima);
    if (config.totalMesas !== undefined) validado.total_mesas = parseInt(config.totalMesas);
    if (config.mesasActivas !== undefined) validado.mesas_activas = parseInt(config.mesasActivas);
    return validado;
  }

  _validarVentas(config) {
    const validado = {};
    if (config.ivaPorcentaje !== undefined) {
      const iva = parseFloat(config.ivaPorcentaje);
      if (iva < 0 || iva > 50) throw new Error('IVA debe estar entre 0 y 50%');
      validado.iva_porcentaje = iva;
    }
    if (config.permitirDescuentos !== undefined) validado.permitir_descuentos = config.permitirDescuentos ? 1 : 0;
    if (config.descuentoMaximo !== undefined) validado.descuento_maximo = parseFloat(config.descuentoMaximo);
    if (config.permitirPropinas !== undefined) validado.permitir_propinas = config.permitirPropinas ? 1 : 0;
    if (config.propinaSugerida !== undefined) validado.propina_sugerida = parseFloat(config.propinaSugerida);
    return validado;
  }

  _validarEmpleados(config) {
    const validado = {};
    if (config.totalEmpleados !== undefined) validado.total_empleados = parseInt(config.totalEmpleados);
    if (config.empleadosActivos !== undefined) validado.empleados_activos = parseInt(config.empleadosActivos);
    if (config.turnosActivos !== undefined) validado.turnos_activos = parseInt(config.turnosActivos);
    if (config.controlHorario !== undefined) validado.control_horario = config.controlHorario ? 1 : 0;
    return validado;
  }

  _validarImpresion(config) {
    const validado = {};
    if (config.imprimirLogo !== undefined) validado.imprimir_logo = config.imprimirLogo ? 1 : 0;
    if (config.imprimirDireccion !== undefined) validado.imprimir_direccion = config.imprimirDireccion ? 1 : 0;
    if (config.tamanoPapel !== undefined) validado.tamano_papel = String(config.tamanoPapel);
    if (config.orientacion !== undefined) validado.orientacion = String(config.orientacion);
    return validado;
  }

  _validarSistema(config) {
    const validado = {};
    if (config.version !== undefined) validado.version = String(config.version);
    if (config.ambiente !== undefined) validado.ambiente = String(config.ambiente);
    if (config.modoMantenimiento !== undefined) validado.modo_mantenimiento = config.modoMantenimiento ? 1 : 0;
    if (config.debugMode !== undefined) validado.debug_mode = config.debugMode ? 1 : 0;
    return validado;
  }

  _validarSeguridad(config) {
    const validado = {};
    if (config.sesionTimeout !== undefined) validado.sesion_timeout = parseInt(config.sesionTimeout);
    if (config.intentosLoginMax !== undefined) validado.intentos_login_max = parseInt(config.intentosLoginMax);
    if (config.auditoriaActiva !== undefined) validado.auditoria_activa = config.auditoriaActiva ? 1 : 0;
    return validado;
  }

  // Utility methods
  _parseJSON(jsonString, defaultValue = null) {
    try {
      return jsonString ? JSON.parse(jsonString) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  }
}

module.exports = ConfiguracionService;