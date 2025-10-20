/**
 * DYSA Point - Repositorio de Tickets Simplificado
 * Usa las nuevas tablas: tickets, ticket_items, ticket_item_modificadores
 * Fecha: 20 de Octubre 2025
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { ValidationError, NotFoundError } = require('../utils/errors');

class TicketsSimpleRepository {
  constructor() {
    this.tableName = 'tickets';
    this.itemsTableName = 'ticket_items';
    this.modificadoresTableName = 'ticket_item_modificadores';
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
   * Crear nuevo ticket
   */
  async create(ticketData) {
    const connection = await this.getConnection();

    try {
      await connection.beginTransaction();

      const insertQuery = `
        INSERT INTO ${this.tableName} (
          mesa_id,
          empleado_id,
          estado,
          total_bruto,
          descuento_total,
          propina,
          iva_total,
          total_neto
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const [result] = await connection.execute(insertQuery, [
        ticketData.mesa_id,
        ticketData.empleado_vendedor_id || ticketData.empleado_id,
        'ABIERTO',
        0, // total_bruto
        0, // descuento_total
        0, // propina
        0, // iva_total
        0  // total_neto
      ]);

      await connection.commit();

      // Obtener el ticket creado
      const ticket = await this.findById(result.insertId);
      return ticket;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  /**
   * Obtener ticket por ID
   */
  async findById(id) {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT t.*,
               m.numero_mesa
        FROM ${this.tableName} t
        LEFT JOIN mesas_restaurante m ON t.mesa_id = m.id
        WHERE t.id = ?
      `;

      const [rows] = await connection.execute(query, [id]);
      return rows[0] || null;

    } finally {
      await connection.end();
    }
  }

  /**
   * Obtener estadísticas
   */
  async getEstadisticas() {
    const connection = await this.getConnection();

    try {
      const query = `
        SELECT
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN estado = 'ABIERTO' THEN 1 END) as tickets_abiertos,
          COUNT(CASE WHEN estado = 'FACTURADO' THEN 1 END) as tickets_facturados,
          SUM(total_neto) as ingresos_totales,
          AVG(total_neto) as promedio_venta
        FROM ${this.tableName}
        WHERE DATE(creado_en) = CURDATE()
      `;

      const [rows] = await connection.execute(query);
      return rows[0] || {
        total_tickets: 0,
        tickets_abiertos: 0,
        tickets_facturados: 0,
        ingresos_totales: 0,
        promedio_venta: 0
      };

    } finally {
      await connection.end();
    }
  }

  /**
   * Agregar item a ticket
   */
  async addItem(ticketId, itemData) {
    const connection = await this.getConnection();

    try {
      await connection.beginTransaction();

      // Insertar item
      const insertQuery = `
        INSERT INTO ${this.itemsTableName} (
          ticket_id,
          producto_id,
          nombre_producto,
          cantidad,
          precio_unitario,
          subtotal,
          iva,
          total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const precio = parseFloat(itemData.precio_unitario || 10000); // Precio por defecto
      const cantidad = parseFloat(itemData.cantidad || 1);
      const subtotal = precio * cantidad;
      const iva = subtotal * 0.19; // 19% IVA
      const total = subtotal + iva;

      const [result] = await connection.execute(insertQuery, [
        ticketId,
        itemData.producto_id,
        itemData.nombre_producto || `Producto ${itemData.producto_id}`,
        cantidad,
        precio,
        subtotal,
        iva,
        total
      ]);

      // Agregar modificadores si existen
      if (itemData.modificadores && itemData.modificadores.length > 0) {
        for (const mod of itemData.modificadores) {
          await connection.execute(
            `INSERT INTO ${this.modificadoresTableName} (item_id, modificador, precio) VALUES (?, ?, ?)`,
            [result.insertId, mod, 0]
          );
        }
      }

      // Actualizar totales del ticket
      await this.recalcularTotales(ticketId, connection);

      await connection.commit();

      return result.insertId;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      await connection.end();
    }
  }

  /**
   * Recalcular totales del ticket
   */
  async recalcularTotales(ticketId, connection = null) {
    const conn = connection || await this.getConnection();
    const shouldClose = !connection;

    try {
      // Sumar totales de items
      const [totales] = await conn.execute(`
        SELECT
          SUM(subtotal) as total_bruto,
          SUM(iva) as iva_total,
          SUM(total) as total_neto
        FROM ${this.itemsTableName}
        WHERE ticket_id = ?
      `, [ticketId]);

      const { total_bruto, iva_total, total_neto } = totales[0];

      // Actualizar ticket
      await conn.execute(`
        UPDATE ${this.tableName}
        SET total_bruto = ?, iva_total = ?, total_neto = ?
        WHERE id = ?
      `, [total_bruto || 0, iva_total || 0, total_neto || 0, ticketId]);

    } finally {
      if (shouldClose) {
        await conn.end();
      }
    }
  }

  /**
   * Buscar tickets con filtros
   */
  async findMany(filters = {}) {
    const connection = await this.getConnection();

    try {
      let query = `SELECT * FROM ${this.tableName} WHERE 1=1`;
      const params = [];

      if (filters.mesa_id) {
        query += ` AND mesa_id = ?`;
        params.push(filters.mesa_id);
      }

      if (filters.estado) {
        query += ` AND estado = ?`;
        params.push(filters.estado);
      }

      query += ` ORDER BY creado_en DESC`;

      const [rows] = await connection.execute(query, params);
      return rows;

    } finally {
      await connection.end();
    }
  }
}

module.exports = TicketsSimpleRepository;