// backend/src/repositories/configuracion.repository.js
require('dotenv').config();
const mysql = require('mysql2/promise');

class ConfiguracionRepository {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'devlmer',
      password: process.env.DB_PASS || 'devlmer2025',
      database: process.env.DB_NAME || 'dysa_point',
      charset: 'utf8mb4'
    };
  }

  async getConnection() {
    return await mysql.createConnection(this.dbConfig);
  }

  /**
   * Obtiene toda la configuración del sistema desde múltiples tablas
   * @returns {Object} Configuración completa del sistema
   */
  async getConfiguracionCompleta() {
    const conn = await this.getConnection();

    try {
      // Obtener configuración de empresa
      const [empresa] = await conn.query(`
        SELECT
          razon_social, nombre_comercial, rut_nif, rut_empresa,
          direccion_fiscal, direccion, telefono, telefono_principal,
          email, email_principal, sitio_web, logo_url,
          giro_comercial, actividad_economica, comuna, ciudad, region,
          representante_legal, moneda, zona_horaria, idioma
        FROM configuracion_empresa
        WHERE id = 1 LIMIT 1
      `);

      // Obtener configuración fiscal
      const [fiscal] = await conn.query(`
        SELECT
          moneda_principal, simbolo_moneda, moneda_simbolo, iva_defecto,
          serie_factura, numeracion_inicio, formato_factura, decimales_moneda,
          redondeo_activo, redondeo_valor
        FROM configuracion_fiscal
        WHERE empresa_id = 1 LIMIT 1
      `);

      // Obtener configuración operativa
      const [operativa] = await conn.query(`
        SELECT
          zona_horaria, formato_fecha, formato_hora, idioma_predeterminado,
          idiomas_disponibles, moneda_decimales
        FROM configuracion_operativa
        WHERE empresa_id = 1 LIMIT 1
      `);

      // Obtener configuración del restaurante
      const [restaurante] = await conn.query(`
        SELECT
          nombre_establecimiento, tipo_restaurante, tipo_establecimiento,
          capacidad_maxima, total_mesas, mesas_activas, bloques_cocina,
          tiempo_preparacion_promedio
        FROM config_restaurante
        WHERE empresa_id = 1 LIMIT 1
      `);

      // Obtener configuración de ventas
      const [ventas] = await conn.query(`
        SELECT
          iva_porcentaje, permitir_descuentos, descuento_maximo,
          permitir_propinas, propina_sugerida, redondeo_activo, redondeo_valor
        FROM config_ventas
        WHERE empresa_id = 1 LIMIT 1
      `);

      // Obtener configuración de empleados
      const [empleados] = await conn.query(`
        SELECT
          total_empleados, empleados_activos, turnos_activos,
          control_horario, permisos_avanzados
        FROM config_empleados
        WHERE empresa_id = 1 LIMIT 1
      `);

      // Obtener configuración de impresión
      const [impresion] = await conn.query(`
        SELECT
          imprimir_logo, imprimir_direccion, imprimir_telefono, imprimir_rut,
          tamano_papel, orientacion, margen_superior, margen_inferior,
          impresora_tickets, impresora_cocina
        FROM config_impresion
        WHERE empresa_id = 1 LIMIT 1
      `);

      // Obtener configuración del sistema
      const [sistema] = await conn.query(`
        SELECT
          version_sistema, version, ambiente, modo_mantenimiento,
          backup_automatico, backup_frecuencia, ultimo_backup,
          debug_mode, ssl_activo
        FROM config_sistema
        WHERE empresa_id = 1 LIMIT 1
      `);

      // Obtener configuración de seguridad
      const [seguridad] = await conn.query(`
        SELECT
          sesion_timeout, intentos_login_max, bloqueo_temporal,
          auditoria_activa, logs_detallados, backup_encriptado
        FROM config_seguridad
        WHERE empresa_id = 1 LIMIT 1
      `);

      // Obtener estado runtime
      const [runtime] = await conn.query(`
        SELECT
          sistema_activo, base_datos_conectada, servidor_funcionando,
          usuarios_conectados, ventas_hoy, ingresos_hoy, ultima_actualizacion
        FROM config_estado_runtime
        WHERE empresa_id = 1 LIMIT 1
      `);

      return {
        empresa: empresa[0] || {},
        fiscal: fiscal[0] || {},
        operativa: operativa[0] || {},
        restaurante: restaurante[0] || {},
        ventas: ventas[0] || {},
        empleados: empleados[0] || {},
        impresion: impresion[0] || {},
        sistema: sistema[0] || {},
        seguridad: seguridad[0] || {},
        runtime: runtime[0] || {}
      };

    } finally {
      await conn.end();
    }
  }

  /**
   * Actualiza una sección específica de configuración
   * @param {string} seccion - Nombre de la sección (empresa, fiscal, etc.)
   * @param {Object} configuracion - Datos a actualizar
   * @returns {boolean} True si se actualizó correctamente
   */
  async actualizarConfiguracion(seccion, configuracion) {
    const conn = await this.getConnection();

    try {
      await conn.beginTransaction();

      let tabla, whereClause;

      switch (seccion) {
        case 'empresa':
          tabla = 'configuracion_empresa';
          whereClause = 'id = 1';
          break;
        case 'fiscal':
          tabla = 'configuracion_fiscal';
          whereClause = 'empresa_id = 1';
          break;
        case 'operativa':
          tabla = 'configuracion_operativa';
          whereClause = 'empresa_id = 1';
          break;
        case 'restaurante':
          tabla = 'config_restaurante';
          whereClause = 'empresa_id = 1';
          break;
        case 'ventas':
          tabla = 'config_ventas';
          whereClause = 'empresa_id = 1';
          break;
        case 'empleados':
          tabla = 'config_empleados';
          whereClause = 'empresa_id = 1';
          break;
        case 'impresion':
          tabla = 'config_impresion';
          whereClause = 'empresa_id = 1';
          break;
        case 'sistema':
          tabla = 'config_sistema';
          whereClause = 'empresa_id = 1';
          break;
        case 'seguridad':
          tabla = 'config_seguridad';
          whereClause = 'empresa_id = 1';
          break;
        default:
          throw new Error(`Sección de configuración no válida: ${seccion}`);
      }

      // Construir query de actualización dinámicamente
      const campos = Object.keys(configuracion);
      const valores = Object.values(configuracion);

      if (campos.length === 0) {
        throw new Error('No hay campos para actualizar');
      }

      const setClauses = campos.map(campo => `${campo} = ?`).join(', ');
      const query = `UPDATE ${tabla} SET ${setClauses}, updated_at = CURRENT_TIMESTAMP WHERE ${whereClause}`;

      const [result] = await conn.query(query, valores);

      // Verificar que se actualizó al menos una fila
      if (result.affectedRows === 0) {
        throw new Error(`No se encontró registro para actualizar en sección: ${seccion}`);
      }

      await conn.commit();
      return true;

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      await conn.end();
    }
  }

  /**
   * Obtiene la lista de categorías ordenadas
   * @returns {Array} Lista de categorías activas
   */
  async getCategorias() {
    const conn = await this.getConnection();

    try {
      const [categorias] = await conn.query(`
        SELECT
          id, nombre, descripcion, orden, color_hex, icono,
          activa, created_at, updated_at
        FROM categorias
        WHERE activa = 1
        ORDER BY orden ASC, nombre ASC
      `);

      return categorias;

    } finally {
      await conn.end();
    }
  }

  /**
   * Obtiene estadísticas generales del sistema
   * @returns {Object} Estadísticas del sistema
   */
  async getEstadisticasSistema() {
    const conn = await this.getConnection();

    try {
      // Contar tablas
      const [tablas] = await conn.query(`
        SELECT COUNT(*) as total_tablas
        FROM information_schema.tables
        WHERE table_schema = ?
      `, [this.dbConfig.database]);

      // Contar categorías
      const [categorias] = await conn.query(`
        SELECT COUNT(*) as total_categorias
        FROM categorias WHERE activa = 1
      `);

      // Contar productos (si existe la tabla)
      let productos = [{ total_productos: 0 }];
      try {
        [productos] = await conn.query(`
          SELECT COUNT(*) as total_productos
          FROM productos WHERE activo = 1
        `);
      } catch (e) {
        // La tabla productos puede no existir aún
      }

      return {
        total_tablas: tablas[0].total_tablas,
        total_categorias: categorias[0].total_categorias,
        total_productos: productos[0].total_productos,
        timestamp: new Date().toISOString()
      };

    } finally {
      await conn.end();
    }
  }
}

module.exports = ConfiguracionRepository;