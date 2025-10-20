/**
 * DYSA Point - Repositorio de Caja/Pagos
 * Operaciones CRUD para pagos, métodos de pago y cierres de caja
 * Fecha: 20 de Octubre 2025
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { ValidationError, NotFoundError } = require('../utils/errors');

class CajaRepository {
  constructor() {
    this.pagosTableName = 'pagos_ventas';
    this.metodosTableName = 'metodos_pago';
    this.cierresTableName = 'cierres_caja';
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
   * Crear nuevo pago
   */
  async createPago(pagoData) {
    const connection = await this.getConnection();

    try {
      await connection.beginTransaction();

      const insertQuery = `
        INSERT INTO ${this.pagosTableName} (
          venta_id,
          metodo_pago_id,
          numero_transaccion,
          monto_pagado,
          monto_cambio,
          monto_propina,
          estado_pago,
          fecha_pago,
          hora_pago,
          empleado_cajero_id,
          terminal_id,
          referencia_externa,
          observaciones
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const numeroTransaccion = `PAY-${Date.now()}`;

      const [result] = await connection.execute(insertQuery, [
        pagoData.venta_id,
        pagoData.metodo_pago_id,
        numeroTransaccion,
        pagoData.monto_pagado,
        pagoData.monto_cambio || 0,
        pagoData.monto_propina || 0,
        pagoData.estado_pago || 'COMPLETADO',
        new Date().toISOString().split('T')[0], // fecha_pago
        new Date().toTimeString().split(' ')[0], // hora_pago
        pagoData.empleado_cajero_id,
        pagoData.terminal_id || 1,
        pagoData.referencia_externa || null,
        pagoData.observaciones || null
      ]);

      await connection.commit();

      // Obtener el pago creado
      const pago = await this.findById(result.insertId);
      return pago;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  /**
   * Obtener pago por ID
   */
  async findById(id) {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT p.*, mp.nombre as metodo_pago_nombre, mp.tipo as metodo_pago_tipo,
               v.numero_venta, v.total_final as venta_total
        FROM ${this.pagosTableName} p
        LEFT JOIN ${this.metodosTableName} mp ON p.metodo_pago_id = mp.id
        LEFT JOIN ventas_principales v ON p.venta_id = v.id
        WHERE p.id = ?
      `;

      const [rows] = await connection.execute(query, [id]);
      return rows[0] || null;

    } finally {
      await connection.end();
    }
  }

  /**
   * Obtener métodos de pago disponibles
   */
  async getMetodosPago() {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT * FROM ${this.metodosTableName}
        WHERE activo = 1
        ORDER BY orden_visualizacion, nombre
      `;

      const [rows] = await connection.execute(query);
      return rows;

    } finally {
      await connection.end();
    }
  }

  /**
   * Obtener resumen de caja del día
   */
  async getResumenDia(fecha = null) {
    const connection = await this.getConnection();

    try {
      const fechaQuery = fecha || new Date().toISOString().split('T')[0];

      const query = `
        SELECT
          COUNT(*) as total_transacciones,
          SUM(monto_pagado) as total_ingresos,
          SUM(monto_propina) as total_propinas,
          AVG(monto_pagado) as promedio_venta,
          mp.nombre as metodo_pago,
          mp.tipo as tipo_metodo,
          COUNT(p.id) as cantidad_por_metodo,
          SUM(p.monto_pagado) as total_por_metodo
        FROM ${this.pagosTableName} p
        LEFT JOIN ${this.metodosTableName} mp ON p.metodo_pago_id = mp.id
        WHERE DATE(p.fecha_pago) = ?
        AND p.estado_pago = 'COMPLETADO'
        GROUP BY p.metodo_pago_id, mp.nombre, mp.tipo
        ORDER BY total_por_metodo DESC
      `;

      const [rows] = await connection.execute(query, [fechaQuery]);

      // También obtener totales generales
      const totalQuery = `
        SELECT
          COUNT(*) as total_transacciones,
          SUM(monto_pagado) as total_ingresos,
          SUM(monto_propina) as total_propinas,
          AVG(monto_pagado) as promedio_venta
        FROM ${this.pagosTableName}
        WHERE DATE(fecha_pago) = ?
        AND estado_pago = 'COMPLETADO'
      `;

      const [totales] = await connection.execute(totalQuery, [fechaQuery]);

      return {
        resumen_general: totales[0],
        por_metodo_pago: rows
      };

    } finally {
      await connection.end();
    }
  }

  /**
   * Crear cierre de caja
   */
  async createCierre(cierreData) {
    const connection = await this.getConnection();

    try {
      await connection.beginTransaction();

      const insertQuery = `
        INSERT INTO ${this.cierresTableName} (
          empleado_cajero_id,
          terminal_id,
          fecha_cierre,
          hora_inicio,
          hora_cierre,
          monto_inicial_efectivo,
          monto_final_efectivo,
          total_ventas_efectivo,
          total_ventas_tarjeta,
          total_ventas_digital,
          total_propinas,
          diferencia_caja,
          observaciones,
          estado_cierre
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await connection.execute(insertQuery, [
        cierreData.empleado_cajero_id,
        cierreData.terminal_id || 1,
        new Date().toISOString().split('T')[0],
        cierreData.hora_inicio,
        new Date().toTimeString().split(' ')[0],
        cierreData.monto_inicial_efectivo || 0,
        cierreData.monto_final_efectivo || 0,
        cierreData.total_ventas_efectivo || 0,
        cierreData.total_ventas_tarjeta || 0,
        cierreData.total_ventas_digital || 0,
        cierreData.total_propinas || 0,
        cierreData.diferencia_caja || 0,
        cierreData.observaciones || null,
        'COMPLETADO'
      ]);

      await connection.commit();

      return await this.findCierreById(result.insertId);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  /**
   * Obtener cierre por ID
   */
  async findCierreById(id) {
    const connection = await this.getConnection();

    try {
      const query = `SELECT * FROM ${this.cierresTableName} WHERE id = ?`;
      const [rows] = await connection.execute(query, [id]);
      return rows[0] || null;

    } finally {
      await connection.end();
    }
  }

  /**
   * Obtener pagos de una venta específica
   */
  async findPagosByVentaId(ventaId) {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT p.*, mp.nombre as metodo_pago_nombre, mp.tipo as metodo_pago_tipo
        FROM ${this.pagosTableName} p
        LEFT JOIN ${this.metodosTableName} mp ON p.metodo_pago_id = mp.id
        WHERE p.venta_id = ?
        ORDER BY p.fecha_pago DESC, p.hora_pago DESC
      `;

      const [rows] = await connection.execute(query, [ventaId]);
      return rows;

    } finally {
      await connection.end();
    }
  }
}

module.exports = CajaRepository;