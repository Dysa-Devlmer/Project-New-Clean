// backend/src/repositories/mesas.repository.js
require('dotenv').config();
const mysql = require('mysql2/promise');

class MesasRepository {
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
   * Obtiene todas las mesas con filtros opcionales
   * @param {Object} filtros - Filtros de búsqueda
   * @returns {Array} Lista de mesas
   */
  async getMesas(filtros = {}) {
    const conn = await this.getConnection();

    try {
      let whereConditions = ['m.mesa_activa = 1'];
      let params = [];

      // Filtro por zona/sector
      if (filtros.zona_id) {
        whereConditions.push('m.zona_id = ?');
        params.push(filtros.zona_id);
      }

      // Filtro por estado
      if (filtros.estado) {
        whereConditions.push('m.estado_mesa = ?');
        params.push(filtros.estado);
      }

      // Filtro por capacidad mínima
      if (filtros.capacidad_minima) {
        whereConditions.push('m.capacidad_personas >= ?');
        params.push(filtros.capacidad_minima);
      }

      // Filtro por VIP
      if (filtros.vip !== undefined) {
        whereConditions.push('m.mesa_vip = ?');
        params.push(filtros.vip ? 1 : 0);
      }

      const whereClause = whereConditions.join(' AND ');

      const [mesas] = await conn.query(`
        SELECT
          m.id,
          m.numero_mesa,
          m.codigo_qr,
          m.zona_id,
          m.capacidad_personas,
          m.capacidad_maxima,
          m.forma_mesa,
          m.coordenada_x,
          m.coordenada_y,
          m.ancho_mesa,
          m.alto_mesa,
          m.rotacion_grados,
          m.mesa_vip,
          m.acceso_discapacitados,
          m.cerca_ventana,
          m.aire_libre,
          m.estado_mesa,
          m.requiere_reserva,
          m.ocupada_desde,
          m.empleado_asignado,
          m.numero_comensales_actuales,
          m.tiempo_limite_ocupacion,
          m.created_at,
          m.updated_at,
          z.nombre_zona,
          CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
          h.ultimo_cambio_fecha,
          h.ultimo_usuario_cambio,
          h.cambios_hoy
        FROM mesas_restaurante m
        LEFT JOIN zonas_restaurante z ON z.id = m.zona_id
        LEFT JOIN empleados e ON e.id = m.empleado_asignado
        LEFT JOIN v_mesas_con_historial h ON h.id = m.id
        WHERE ${whereClause}
        ORDER BY m.zona_id ASC, m.numero_mesa ASC
      `, params);

      return mesas;

    } finally {
      await conn.end();
    }
  }

  /**
   * Obtiene una mesa específica por ID
   * @param {number} id - ID de la mesa
   * @returns {Object|null} Datos de la mesa
   */
  async getMesaById(id) {
    const conn = await this.getConnection();

    try {
      const [mesas] = await conn.query(`
        SELECT
          m.*,
          z.nombre_zona,
          CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado
        FROM mesas_restaurante m
        LEFT JOIN zonas_restaurante z ON z.id = m.zona_id
        LEFT JOIN empleados e ON e.id = m.empleado_asignado
        WHERE m.id = ? AND m.mesa_activa = 1
      `, [id]);

      return mesas.length > 0 ? mesas[0] : null;

    } finally {
      await conn.end();
    }
  }

  /**
   * Obtiene mesa por número
   * @param {string} numeroMesa - Número de la mesa
   * @returns {Object|null} Datos de la mesa
   */
  async getMesaByNumero(numeroMesa) {
    const conn = await this.getConnection();

    try {
      const [mesas] = await conn.query(`
        SELECT * FROM mesas_restaurante
        WHERE numero_mesa = ? AND mesa_activa = 1
      `, [numeroMesa]);

      return mesas.length > 0 ? mesas[0] : null;

    } finally {
      await conn.end();
    }
  }

  /**
   * Cambia el estado de una mesa y registra en historial
   * @param {number} mesaId - ID de la mesa
   * @param {string} nuevoEstado - Nuevo estado
   * @param {Object} opciones - Opciones adicionales
   * @returns {boolean} True si se actualizó correctamente
   */
  async cambiarEstadoMesa(mesaId, nuevoEstado, opciones = {}) {
    const conn = await this.getConnection();

    try {
      await conn.beginTransaction();

      // Obtener estado actual
      const [mesaActual] = await conn.query(
        'SELECT estado_mesa, numero_comensales_actuales FROM mesas_restaurante WHERE id = ?',
        [mesaId]
      );

      if (mesaActual.length === 0) {
        throw new Error('Mesa no encontrada');
      }

      const estadoAnterior = mesaActual[0].estado_mesa;
      const comensalesAnterior = mesaActual[0].numero_comensales_actuales;

      // Actualizar estado de la mesa
      const updates = ['estado_mesa = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const params = [nuevoEstado];

      // Campos adicionales según el estado
      if (nuevoEstado === 'OCUPADA') {
        updates.push('ocupada_desde = CURRENT_TIMESTAMP');
        if (opciones.comensales) {
          updates.push('numero_comensales_actuales = ?');
          params.push(opciones.comensales);
        }
        if (opciones.empleado_id) {
          updates.push('empleado_asignado = ?');
          params.push(opciones.empleado_id);
        }
      } else if (nuevoEstado === 'LIBRE') {
        updates.push('ocupada_desde = NULL');
        updates.push('numero_comensales_actuales = 0');
        updates.push('empleado_asignado = NULL');
      }

      params.push(mesaId);

      await conn.query(
        `UPDATE mesas_restaurante SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      // Registrar en historial
      await conn.query(`
        INSERT INTO mesa_historial (
          mesa_id, estado_anterior, estado_nuevo, usuario_id, usuario_nombre,
          motivo, comensales_anterior, comensales_nuevo, observaciones, ip_origen
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        mesaId,
        estadoAnterior,
        nuevoEstado,
        opciones.usuario_id || null,
        opciones.usuario_nombre || 'SISTEMA',
        opciones.motivo || `Cambio de estado: ${estadoAnterior} → ${nuevoEstado}`,
        comensalesAnterior,
        opciones.comensales || comensalesAnterior,
        opciones.observaciones || null,
        opciones.ip_origen || null
      ]);

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
   * Crear nueva mesa
   * @param {Object} datosMesa - Datos de la nueva mesa
   * @returns {number} ID de la mesa creada
   */
  async crearMesa(datosmesa) {
    const conn = await this.getConnection();

    try {
      await conn.beginTransaction();

      const [result] = await conn.query(`
        INSERT INTO mesas_restaurante (
          numero_mesa, zona_id, capacidad_personas, capacidad_maxima,
          forma_mesa, coordenada_x, coordenada_y, ancho_mesa, alto_mesa,
          rotacion_grados, mesa_vip, acceso_discapacitados, cerca_ventana,
          aire_libre, requiere_reserva, tiempo_limite_ocupacion,
          estado_mesa, mesa_activa
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'LIBRE', 1)
      `, [
        datosmesa.numero_mesa,
        datosmesa.zona_id,
        datosmesa.capacidad_personas,
        datosmesa.capacidad_maxima || datosmesa.capacidad_personas + 2,
        datosmesa.forma_mesa || 'CUADRADA',
        datosmesa.coordenada_x || 0,
        datosmesa.coordenada_y || 0,
        datosmesa.ancho_mesa || 100,
        datosmesa.alto_mesa || 100,
        datosmesa.rotacion_grados || 0,
        datosmesa.mesa_vip || 0,
        datosmesa.acceso_discapacitados || 1,
        datosmesa.cerca_ventana || 0,
        datosmesa.aire_libre || 0,
        datosmesa.requiere_reserva || 0,
        datosmesa.tiempo_limite_ocupacion || 120
      ]);

      const mesaId = result.insertId;

      // Registrar en historial
      await conn.query(`
        INSERT INTO mesa_historial (
          mesa_id, estado_anterior, estado_nuevo, usuario_nombre, motivo
        ) VALUES (?, NULL, 'LIBRE', 'SISTEMA', 'Mesa creada')
      `, [mesaId]);

      await conn.commit();
      return mesaId;

    } catch (error) {
      await conn.rollback();
      throw error;
    } finally {
      await conn.end();
    }
  }

  /**
   * Obtener historial de una mesa
   * @param {number} mesaId - ID de la mesa
   * @param {number} limite - Límite de registros
   * @returns {Array} Historial de la mesa
   */
  async getHistorialMesa(mesaId, limite = 10) {
    const conn = await this.getConnection();

    try {
      const [historial] = await conn.query(`
        SELECT
          h.*,
          m.numero_mesa
        FROM mesa_historial h
        JOIN mesas_restaurante m ON m.id = h.mesa_id
        WHERE h.mesa_id = ?
        ORDER BY h.created_at DESC
        LIMIT ?
      `, [mesaId, limite]);

      return historial;

    } finally {
      await conn.end();
    }
  }

  /**
   * Obtener estadísticas de mesas
   * @returns {Object} Estadísticas de mesas
   */
  async getEstadisticasMesas() {
    const conn = await this.getConnection();

    try {
      // Conteo por estado
      const [estadoCount] = await conn.query(`
        SELECT
          estado_mesa,
          COUNT(*) as cantidad
        FROM mesas_restaurante
        WHERE mesa_activa = 1
        GROUP BY estado_mesa
      `);

      // Conteo por zona
      const [zonaCount] = await conn.query(`
        SELECT
          z.nombre_zona,
          COUNT(m.id) as total_mesas,
          SUM(CASE WHEN m.estado_mesa = 'LIBRE' THEN 1 ELSE 0 END) as libres,
          SUM(CASE WHEN m.estado_mesa = 'OCUPADA' THEN 1 ELSE 0 END) as ocupadas
        FROM mesas_restaurante m
        LEFT JOIN zonas_restaurante z ON z.id = m.zona_id
        WHERE m.mesa_activa = 1
        GROUP BY m.zona_id, z.nombre_zona
      `);

      // Total de mesas
      const [totalMesas] = await conn.query(`
        SELECT COUNT(*) as total FROM mesas_restaurante WHERE mesa_activa = 1
      `);

      return {
        total_mesas: totalMesas[0].total,
        por_estado: estadoCount,
        por_zona: zonaCount,
        timestamp: new Date().toISOString()
      };

    } finally {
      await conn.end();
    }
  }

  /**
   * Buscar mesas disponibles por capacidad
   * @param {number} capacidadRequerida - Capacidad requerida
   * @param {string} zona - Zona preferida (opcional)
   * @returns {Array} Mesas disponibles
   */
  async buscarMesasDisponibles(capacidadRequerida, zona = null) {
    const conn = await this.getConnection();

    try {
      let whereConditions = [
        'm.mesa_activa = 1',
        'm.estado_mesa = "LIBRE"',
        'm.capacidad_personas >= ?'
      ];
      let params = [capacidadRequerida];

      if (zona) {
        whereConditions.push('z.nombre_zona = ?');
        params.push(zona);
      }

      const [mesas] = await conn.query(`
        SELECT
          m.id,
          m.numero_mesa,
          m.capacidad_personas,
          m.capacidad_maxima,
          m.forma_mesa,
          m.mesa_vip,
          m.cerca_ventana,
          m.aire_libre,
          z.nombre_zona
        FROM mesas_restaurante m
        LEFT JOIN zonas_restaurante z ON z.id = m.zona_id
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY
          m.capacidad_personas ASC,
          m.mesa_vip DESC,
          m.numero_mesa ASC
      `, params);

      return mesas;

    } finally {
      await conn.end();
    }
  }
}

module.exports = MesasRepository;