/**
 * DYSA Point - Repositorio de Configuración del Sistema
 * Operaciones CRUD para configuración de red, instalación y empresa
 * Fecha: 19 de Octubre 2025
 */

const { pool } = require('../config/database');
const { ValidationError, NotFoundError } = require('../utils/errors');

class SystemConfigRepository {
  constructor() {
    this.redTable = 'sistema_red';
    this.instalacionTable = 'sistema_instalacion';
    this.duenioTable = 'restaurante_duenio';
    this.sucursalTable = 'restaurante_sucursal';
    this.logsTable = 'sistema_logs_config';
  }

  // ============================================================================
  // CONFIGURACIÓN DE RED
  // ============================================================================

  /**
   * Obtener configuración de red activa
   */
  async getNetworkConfig() {
    const [rows] = await pool.execute(`
      SELECT *
      FROM ${this.redTable}
      WHERE activo = 1
      ORDER BY id DESC
      LIMIT 1
    `);

    return rows[0] || null;
  }

  /**
   * Actualizar configuración de red
   */
  async updateNetworkConfig(configData, usuarioModificador = 'admin') {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Obtener configuración actual para log
      const [currentConfig] = await connection.execute(`
        SELECT * FROM ${this.redTable} WHERE activo = 1 LIMIT 1
      `);

      const configAnterior = currentConfig[0] || null;

      // Marcar todas las configuraciones como inactivas
      await connection.execute(`
        UPDATE ${this.redTable} SET activo = 0
      `);

      // Insertar nueva configuración
      const [result] = await connection.execute(`
        INSERT INTO ${this.redTable} (
          host_principal,
          puerto_api,
          puerto_events,
          ssl_activo,
          timeout_conexion,
          max_clients_sse,
          auto_discovery,
          configurado_por,
          activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        configData.host_principal,
        configData.puerto_api,
        configData.puerto_events || (configData.puerto_api + 1),
        configData.ssl_activo || 0,
        configData.timeout_conexion || 30,
        configData.max_clients_sse || 50,
        configData.auto_discovery || 1,
        usuarioModificador
      ]);

      // Registrar cambio en logs
      await connection.execute(`
        INSERT INTO ${this.logsTable} (
          tipo_cambio,
          tabla_afectada,
          registro_id,
          usuario,
          accion,
          datos_anteriores,
          datos_nuevos
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        'RED',
        this.redTable,
        result.insertId,
        usuarioModificador,
        'UPDATE',
        configAnterior ? JSON.stringify(configAnterior) : null,
        JSON.stringify({ ...configData, id: result.insertId })
      ]);

      await connection.commit();
      return { id: result.insertId, ...configData };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // ESTADO DE INSTALACIÓN
  // ============================================================================

  /**
   * Obtener estado de instalación
   */
  async getInstallationStatus() {
    const [rows] = await pool.execute(`
      SELECT *
      FROM ${this.instalacionTable}
      ORDER BY id DESC
      LIMIT 1
    `);

    return rows[0] || null;
  }

  /**
   * Actualizar estado de instalación
   */
  async updateInstallationStatus(statusData, usuarioModificador = 'admin') {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Obtener estado actual
      const [currentStatus] = await connection.execute(`
        SELECT * FROM ${this.instalacionTable} ORDER BY id DESC LIMIT 1
      `);

      if (currentStatus.length > 0) {
        // Actualizar registro existente
        const [result] = await connection.execute(`
          UPDATE ${this.instalacionTable}
          SET instalado = ?,
              version_instalada = ?,
              pasos_completados = ?,
              instalado_por = ?,
              fecha_instalacion = ?,
              requiere_actualizacion = ?
          WHERE id = ?
        `, [
          statusData.instalado,
          statusData.version_instalada || '2.0.0',
          JSON.stringify(statusData.pasos_completados || {}),
          usuarioModificador,
          statusData.instalado ? new Date() : null,
          statusData.requiere_actualizacion || 0,
          currentStatus[0].id
        ]);

        // Log del cambio
        await connection.execute(`
          INSERT INTO ${this.logsTable} (
            tipo_cambio,
            tabla_afectada,
            registro_id,
            usuario,
            accion,
            datos_anteriores,
            datos_nuevos
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [
          'INSTALACION',
          this.instalacionTable,
          currentStatus[0].id,
          usuarioModificador,
          'UPDATE',
          JSON.stringify(currentStatus[0]),
          JSON.stringify(statusData)
        ]);

        await connection.commit();
        return { id: currentStatus[0].id, ...statusData };

      } else {
        throw new NotFoundError('No se encontró registro de instalación');
      }

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // INFORMACIÓN DEL DUEÑO/EMPRESA
  // ============================================================================

  /**
   * Obtener información del dueño activo
   */
  async getOwnerInfo() {
    const [rows] = await pool.execute(`
      SELECT *
      FROM ${this.duenioTable}
      WHERE activo = 1
      ORDER BY id DESC
      LIMIT 1
    `);

    return rows[0] || null;
  }

  /**
   * Crear/Actualizar información del dueño
   */
  async upsertOwnerInfo(ownerData, usuarioModificador = 'admin') {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Verificar si ya existe un dueño activo
      const [existing] = await connection.execute(`
        SELECT * FROM ${this.duenioTable} WHERE activo = 1 LIMIT 1
      `);

      if (existing.length > 0) {
        // Actualizar existente
        const [result] = await connection.execute(`
          UPDATE ${this.duenioTable}
          SET nombre_completo = ?,
              rut_nif = ?,
              tipo_documento = ?,
              telefono = ?,
              email = ?,
              direccion = ?,
              ciudad = ?,
              pais = ?
          WHERE id = ?
        `, [
          ownerData.nombre_completo,
          ownerData.rut_nif,
          ownerData.tipo_documento || 'RUT',
          ownerData.telefono,
          ownerData.email,
          ownerData.direccion,
          ownerData.ciudad,
          ownerData.pais || 'Chile',
          existing[0].id
        ]);

        await connection.commit();
        return { id: existing[0].id, ...ownerData };

      } else {
        // Crear nuevo
        const [result] = await connection.execute(`
          INSERT INTO ${this.duenioTable} (
            nombre_completo,
            rut_nif,
            tipo_documento,
            telefono,
            email,
            direccion,
            ciudad,
            pais,
            activo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
        `, [
          ownerData.nombre_completo,
          ownerData.rut_nif,
          ownerData.tipo_documento || 'RUT',
          ownerData.telefono,
          ownerData.email,
          ownerData.direccion,
          ownerData.ciudad,
          ownerData.pais || 'Chile'
        ]);

        await connection.commit();
        return { id: result.insertId, ...ownerData };
      }

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // SUCURSALES
  // ============================================================================

  /**
   * Obtener todas las sucursales activas
   */
  async getBranches() {
    const [rows] = await pool.execute(`
      SELECT s.*, d.nombre_completo as duenio_nombre
      FROM ${this.sucursalTable} s
      LEFT JOIN ${this.duenioTable} d ON s.duenio_id = d.id
      WHERE s.activo = 1
      ORDER BY s.es_principal DESC, s.nombre_comercial
    `);

    return rows;
  }

  /**
   * Crear nueva sucursal
   */
  async createBranch(branchData, usuarioModificador = 'admin') {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Si esta sucursal es principal, desmarcar las demás
      if (branchData.es_principal) {
        await connection.execute(`
          UPDATE ${this.sucursalTable} SET es_principal = 0
        `);
      }

      const [result] = await connection.execute(`
        INSERT INTO ${this.sucursalTable} (
          duenio_id,
          nombre_comercial,
          direccion,
          ciudad,
          region,
          codigo_postal,
          telefono,
          email,
          horario_apertura,
          horario_cierre,
          dias_operacion,
          es_principal,
          capacidad_personas,
          tipo_cocina,
          activo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `, [
        branchData.duenio_id,
        branchData.nombre_comercial,
        branchData.direccion,
        branchData.ciudad,
        branchData.region,
        branchData.codigo_postal,
        branchData.telefono,
        branchData.email,
        branchData.horario_apertura || '11:00:00',
        branchData.horario_cierre || '23:00:00',
        branchData.dias_operacion || 'L-D',
        branchData.es_principal || 0,
        branchData.capacidad_personas || 50,
        branchData.tipo_cocina
      ]);

      await connection.commit();
      return { id: result.insertId, ...branchData };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // ============================================================================
  // LOGS Y AUDITORÍA
  // ============================================================================

  /**
   * Obtener logs de configuración recientes
   */
  async getConfigLogs(limit = 50) {
    const [rows] = await pool.execute(`
      SELECT *
      FROM ${this.logsTable}
      ORDER BY fecha_cambio DESC
      LIMIT ?
    `, [limit]);

    return rows;
  }

  /**
   * Registrar cambio en logs
   */
  async logConfigChange(tipo, tabla, registroId, usuario, accion, datosAnteriores, datosNuevos, ipOrigen = null) {
    const [result] = await pool.execute(`
      INSERT INTO ${this.logsTable} (
        tipo_cambio,
        tabla_afectada,
        registro_id,
        usuario,
        accion,
        datos_anteriores,
        datos_nuevos,
        ip_origen
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tipo,
      tabla,
      registroId,
      usuario,
      accion,
      datosAnteriores ? JSON.stringify(datosAnteriores) : null,
      datosNuevos ? JSON.stringify(datosNuevos) : null,
      ipOrigen
    ]);

    return result.insertId;
  }
}

module.exports = SystemConfigRepository;