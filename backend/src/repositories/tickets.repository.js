/**
 * DYSA Point - Repositorio de Tickets (Ventas)
 * Operaciones CRUD para tickets/ventas y sus items
 * Fecha: 19 de Octubre 2025
 */

const db = require('../config/database');
const { ValidationError, NotFoundError } = require('../utils/errors');

class TicketsRepository {
  constructor() {
    this.tableName = 'ventas_principales';
    this.detallesTableName = 'venta_detalles';
    this.pagosTableName = 'pagos_ventas';
  }

  /**
   * Crear nuevo ticket/venta
   */
  async create(ticketData) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Generar número de venta único
      const numeroVenta = `TK-${Date.now()}`;

      const insertQuery = `
        INSERT INTO ${this.tableName} (
          numero_venta,
          mesa_id,
          empleado_vendedor_id,
          terminal_id,
          fecha_venta,
          hora_inicio,
          timestamp_inicio,
          tipo_venta,
          modalidad_pago,
          nombre_cliente,
          telefono_cliente,
          direccion_entrega,
          subtotal_bruto,
          descuento_porcentaje,
          descuento_monto,
          subtotal_neto,
          iva_porcentaje,
          iva_monto,
          total_final,
          propina_sugerida,
          propina_recibida,
          propina_porcentaje,
          estado_venta,
          estado_cocina,
          estado_pago,
          tiempo_preparacion_estimado,
          observaciones_generales,
          comentarios_cliente
        ) VALUES (
          ?, ?, ?, ?, ?, ?, NOW(), ?, ?, ?, ?, ?,
          0.00, 0.00, 0.00, 0.00, 19.00, 0.00, 0.00,
          0.00, 0.00, 0.00, 'ABIERTA', 'PENDIENTE', 'PENDIENTE',
          ?, ?, ?
        )
      `;

      const values = [
        numeroVenta,
        ticketData.mesa_id || null,
        ticketData.empleado_vendedor_id,
        ticketData.terminal_id || 1,
        ticketData.fecha_venta || new Date().toISOString().split('T')[0],
        ticketData.hora_inicio || new Date().toTimeString().split(' ')[0],
        ticketData.tipo_venta || 'MESA',
        ticketData.modalidad_pago || 'CONTADO',
        ticketData.nombre_cliente || null,
        ticketData.telefono_cliente || null,
        ticketData.direccion_entrega || null,
        ticketData.tiempo_preparacion_estimado || 30,
        ticketData.observaciones_generales || null,
        ticketData.comentarios_cliente || null
      ];

      const [result] = await connection.execute(insertQuery, values);

      await connection.commit();

      // Retornar ticket creado
      return await this.findById(result.insertId, connection);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Buscar ticket por ID con items
   */
  async findById(id, providedConnection = null) {
    const connection = providedConnection || await db.getConnection();

    try {
      // Buscar ticket principal
      const ticketQuery = `
        SELECT
          v.*,
          m.numero_mesa,
          m.zona_id,
          m.capacidad_personas,
          e.nombres as vendedor_nombres,
          e.apellido_paterno as vendedor_apellido,
          t.nombre_terminal,
          TIMESTAMPDIFF(MINUTE, v.timestamp_inicio, COALESCE(v.timestamp_cierre, NOW())) as tiempo_transcurrido_minutos
        FROM ${this.tableName} v
        LEFT JOIN mesas_restaurante m ON v.mesa_id = m.id
        LEFT JOIN empleados e ON v.empleado_vendedor_id = e.id
        LEFT JOIN terminales_pos t ON v.terminal_id = t.id
        WHERE v.id = ?
      `;

      const [tickets] = await connection.execute(ticketQuery, [id]);

      if (tickets.length === 0) {
        throw new NotFoundError(`Ticket con ID ${id} no encontrado`);
      }

      const ticket = tickets[0];

      // Buscar items del ticket
      const itemsQuery = `
        SELECT
          vd.*,
          p.categoria_id,
          p.estacion_preparacion_id,
          p.tiempo_preparacion_minutos,
          p.permite_modificaciones,
          ep.nombre_estacion,
          ep.tipo_estacion,
          c.nombre as categoria_nombre,
          c.color_hex as categoria_color,
          TIMESTAMPDIFF(MINUTE, vd.timestamp_pedido, COALESCE(vd.timestamp_listo, NOW())) as tiempo_preparacion_transcurrido
        FROM ${this.detallesTableName} vd
        LEFT JOIN productos p ON vd.producto_id = p.id
        LEFT JOIN estaciones_preparacion ep ON p.estacion_preparacion_id = ep.id
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE vd.venta_id = ?
        ORDER BY vd.numero_linea ASC
      `;

      const [items] = await connection.execute(itemsQuery, [id]);

      // Buscar pagos del ticket
      const pagosQuery = `
        SELECT
          pv.*,
          fp.nombre_forma_pago,
          fp.tipo_pago,
          fp.porcentaje_comision,
          e.nombres as cajero_nombres,
          e.apellido_paterno as cajero_apellido
        FROM ${this.pagosTableName} pv
        LEFT JOIN formas_pago fp ON pv.forma_pago_id = fp.id
        LEFT JOIN empleados e ON pv.empleado_cajero_id = e.id
        WHERE pv.venta_id = ?
        ORDER BY pv.created_at ASC
      `;

      const [pagos] = await connection.execute(pagosQuery, [id]);

      // Estructurar respuesta
      return {
        ...ticket,
        items: items || [],
        pagos: pagos || [],
        estadisticas: {
          total_items: items.length,
          items_pendientes: items.filter(i => i.estado_preparacion === 'PENDIENTE').length,
          items_en_preparacion: items.filter(i => i.estado_preparacion === 'EN_PREPARACION').length,
          items_listos: items.filter(i => i.estado_preparacion === 'LISTO').length,
          items_entregados: items.filter(i => i.estado_preparacion === 'ENTREGADO').length,
          total_pagado: pagos.reduce((sum, p) => sum + parseFloat(p.monto_pago), 0),
          saldo_pendiente: parseFloat(ticket.total_final) - pagos.reduce((sum, p) => sum + parseFloat(p.monto_pago), 0)
        }
      };

    } finally {
      if (!providedConnection) {
        connection.release();
      }
    }
  }

  /**
   * Buscar tickets con filtros
   */
  async findMany(filters = {}) {
    const connection = await db.getConnection();

    try {
      let whereConditions = [];
      let params = [];

      // Construir filtros
      if (filters.mesa_id) {
        whereConditions.push('v.mesa_id = ?');
        params.push(filters.mesa_id);
      }

      if (filters.estado_venta) {
        whereConditions.push('v.estado_venta = ?');
        params.push(filters.estado_venta);
      }

      if (filters.estado_cocina) {
        whereConditions.push('v.estado_cocina = ?');
        params.push(filters.estado_cocina);
      }

      if (filters.estado_pago) {
        whereConditions.push('v.estado_pago = ?');
        params.push(filters.estado_pago);
      }

      if (filters.tipo_venta) {
        whereConditions.push('v.tipo_venta = ?');
        params.push(filters.tipo_venta);
      }

      if (filters.empleado_vendedor_id) {
        whereConditions.push('v.empleado_vendedor_id = ?');
        params.push(filters.empleado_vendedor_id);
      }

      if (filters.fecha_desde) {
        whereConditions.push('v.fecha_venta >= ?');
        params.push(filters.fecha_desde);
      }

      if (filters.fecha_hasta) {
        whereConditions.push('v.fecha_venta <= ?');
        params.push(filters.fecha_hasta);
      }

      if (filters.buscar) {
        whereConditions.push('(v.numero_venta LIKE ? OR v.nombre_cliente LIKE ? OR v.observaciones_generales LIKE ?)');
        const searchTerm = `%${filters.buscar}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const query = `
        SELECT
          v.*,
          m.numero_mesa,
          m.zona_id,
          e.nombres as vendedor_nombres,
          e.apellido_paterno as vendedor_apellido,
          COUNT(vd.id) as total_items,
          SUM(CASE WHEN vd.estado_preparacion = 'PENDIENTE' THEN 1 ELSE 0 END) as items_pendientes,
          SUM(CASE WHEN vd.estado_preparacion = 'EN_PREPARACION' THEN 1 ELSE 0 END) as items_en_preparacion,
          SUM(CASE WHEN vd.estado_preparacion = 'LISTO' THEN 1 ELSE 0 END) as items_listos,
          SUM(CASE WHEN vd.estado_preparacion = 'ENTREGADO' THEN 1 ELSE 0 END) as items_entregados,
          TIMESTAMPDIFF(MINUTE, v.timestamp_inicio, COALESCE(v.timestamp_cierre, NOW())) as tiempo_transcurrido_minutos
        FROM ${this.tableName} v
        LEFT JOIN mesas_restaurante m ON v.mesa_id = m.id
        LEFT JOIN empleados e ON v.empleado_vendedor_id = e.id
        LEFT JOIN ${this.detallesTableName} vd ON v.id = vd.venta_id
        ${whereClause}
        GROUP BY v.id
        ORDER BY ${filters.orden || 'v.timestamp_inicio DESC'}
        LIMIT ${filters.limite || 50}
        OFFSET ${filters.offset || 0}
      `;

      const [tickets] = await connection.execute(query, params);

      return tickets;

    } finally {
      connection.release();
    }
  }

  /**
   * Agregar item al ticket
   */
  async addItem(ticketId, itemData) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Verificar que el ticket existe y está abierto
      const ticket = await this.findById(ticketId, connection);

      if (ticket.estado_venta !== 'ABIERTA') {
        throw new ValidationError('No se puede agregar items a un ticket cerrado');
      }

      // Obtener próximo número de línea
      const [lineasResult] = await connection.execute(
        `SELECT COALESCE(MAX(numero_linea), 0) + 1 as siguiente_linea FROM ${this.detallesTableName} WHERE venta_id = ?`,
        [ticketId]
      );
      const numeroLinea = lineasResult[0].siguiente_linea;

      // Obtener información del producto
      const [productos] = await connection.execute(
        'SELECT * FROM productos WHERE id = ? AND producto_activo = 1',
        [itemData.producto_id]
      );

      if (productos.length === 0) {
        throw new ValidationError('Producto no encontrado o inactivo');
      }

      const producto = productos[0];

      // Calcular precios
      const cantidad = parseFloat(itemData.cantidad) || 1;
      const precioUnitario = parseFloat(itemData.precio_unitario) || parseFloat(producto.precio_venta);
      const subtotalLinea = cantidad * precioUnitario;
      const descuentoPorcentaje = parseFloat(itemData.descuento_porcentaje) || 0;
      const descuentoMonto = (subtotalLinea * descuentoPorcentaje) / 100;
      const subtotalConDescuento = subtotalLinea - descuentoMonto;

      // Insertar item
      const insertItemQuery = `
        INSERT INTO ${this.detallesTableName} (
          venta_id,
          numero_linea,
          producto_id,
          codigo_producto,
          nombre_producto,
          cantidad,
          precio_unitario,
          precio_costo_unitario,
          subtotal_linea,
          descuento_porcentaje,
          descuento_monto,
          subtotal_con_descuento,
          estado_preparacion,
          estacion_preparacion_id,
          modificaciones_solicitadas,
          ingredientes_removidos,
          ingredientes_agregados,
          nivel_coccion,
          observaciones_item,
          es_cortesia,
          requiere_edad_verificacion
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?, ?, ?, ?, ?, ?
        )
      `;

      const values = [
        ticketId,
        numeroLinea,
        itemData.producto_id,
        producto.codigo_producto,
        itemData.nombre_producto || producto.nombre_producto,
        cantidad,
        precioUnitario,
        parseFloat(producto.precio_costo) || 0,
        subtotalLinea,
        descuentoPorcentaje,
        descuentoMonto,
        subtotalConDescuento,
        producto.estacion_preparacion_id,
        itemData.modificaciones_solicitadas || null,
        itemData.ingredientes_removidos || null,
        itemData.ingredientes_agregados || null,
        itemData.nivel_coccion || null,
        itemData.observaciones_item || null,
        itemData.es_cortesia ? 1 : 0,
        producto.requiere_edad_verificacion || 0
      ];

      const [itemResult] = await connection.execute(insertItemQuery, values);

      // Recalcular totales del ticket
      await this.recalcularTotales(ticketId, connection);

      await connection.commit();

      // Retornar item creado
      const [newItem] = await connection.execute(
        `SELECT * FROM ${this.detallesTableName} WHERE id = ?`,
        [itemResult.insertId]
      );

      return newItem[0];

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Actualizar item del ticket
   */
  async updateItem(ticketId, itemId, updateData) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Verificar que el item existe
      const [items] = await connection.execute(
        `SELECT * FROM ${this.detallesTableName} WHERE id = ? AND venta_id = ?`,
        [itemId, ticketId]
      );

      if (items.length === 0) {
        throw new NotFoundError('Item no encontrado en este ticket');
      }

      const item = items[0];

      // Verificar que el ticket está abierto
      const ticket = await this.findById(ticketId, connection);
      if (ticket.estado_venta !== 'ABIERTA') {
        throw new ValidationError('No se puede modificar items de un ticket cerrado');
      }

      // Construir query de actualización
      const updateFields = [];
      const values = [];

      if (updateData.cantidad !== undefined) {
        updateFields.push('cantidad = ?');
        values.push(parseFloat(updateData.cantidad));

        // Recalcular subtotales
        const nuevaCantidad = parseFloat(updateData.cantidad);
        const precioUnitario = parseFloat(item.precio_unitario);
        const nuevoSubtotal = nuevaCantidad * precioUnitario;
        const descuentoMonto = (nuevoSubtotal * parseFloat(item.descuento_porcentaje)) / 100;

        updateFields.push('subtotal_linea = ?, subtotal_con_descuento = ?');
        values.push(nuevoSubtotal, nuevoSubtotal - descuentoMonto);
      }

      if (updateData.modificaciones_solicitadas !== undefined) {
        updateFields.push('modificaciones_solicitadas = ?');
        values.push(updateData.modificaciones_solicitadas);
      }

      if (updateData.ingredientes_removidos !== undefined) {
        updateFields.push('ingredientes_removidos = ?');
        values.push(updateData.ingredientes_removidos);
      }

      if (updateData.ingredientes_agregados !== undefined) {
        updateFields.push('ingredientes_agregados = ?');
        values.push(updateData.ingredientes_agregados);
      }

      if (updateData.nivel_coccion !== undefined) {
        updateFields.push('nivel_coccion = ?');
        values.push(updateData.nivel_coccion);
      }

      if (updateData.observaciones_item !== undefined) {
        updateFields.push('observaciones_item = ?');
        values.push(updateData.observaciones_item);
      }

      if (updateData.estado_preparacion !== undefined) {
        updateFields.push('estado_preparacion = ?');
        values.push(updateData.estado_preparacion);

        // Actualizar timestamps según el estado
        if (updateData.estado_preparacion === 'EN_PREPARACION') {
          updateFields.push('timestamp_preparacion = NOW()');
        } else if (updateData.estado_preparacion === 'LISTO') {
          updateFields.push('timestamp_listo = NOW()');
        } else if (updateData.estado_preparacion === 'ENTREGADO') {
          updateFields.push('timestamp_entregado = NOW()');
        }
      }

      if (updateFields.length === 0) {
        throw new ValidationError('No hay campos para actualizar');
      }

      updateFields.push('updated_at = NOW()');
      values.push(itemId, ticketId);

      const updateQuery = `
        UPDATE ${this.detallesTableName}
        SET ${updateFields.join(', ')}
        WHERE id = ? AND venta_id = ?
      `;

      await connection.execute(updateQuery, values);

      // Recalcular totales del ticket si cambió la cantidad
      if (updateData.cantidad !== undefined) {
        await this.recalcularTotales(ticketId, connection);
      }

      await connection.commit();

      // Retornar item actualizado
      const [updatedItem] = await connection.execute(
        `SELECT * FROM ${this.detallesTableName} WHERE id = ?`,
        [itemId]
      );

      return updatedItem[0];

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Remover item del ticket
   */
  async removeItem(ticketId, itemId) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Verificar que el ticket está abierto
      const ticket = await this.findById(ticketId, connection);
      if (ticket.estado_venta !== 'ABIERTA') {
        throw new ValidationError('No se puede remover items de un ticket cerrado');
      }

      // Verificar que el item existe
      const [items] = await connection.execute(
        `SELECT * FROM ${this.detallesTableName} WHERE id = ? AND venta_id = ?`,
        [itemId, ticketId]
      );

      if (items.length === 0) {
        throw new NotFoundError('Item no encontrado en este ticket');
      }

      // Remover item
      await connection.execute(
        `DELETE FROM ${this.detallesTableName} WHERE id = ? AND venta_id = ?`,
        [itemId, ticketId]
      );

      // Recalcular totales del ticket
      await this.recalcularTotales(ticketId, connection);

      await connection.commit();

      return { success: true, message: 'Item removido exitosamente' };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Recalcular totales del ticket
   */
  async recalcularTotales(ticketId, providedConnection = null) {
    const connection = providedConnection || await db.getConnection();

    try {
      // Obtener totales de items
      const [totales] = await connection.execute(
        `SELECT
          SUM(subtotal_linea) as subtotal_bruto,
          SUM(descuento_monto) as descuento_total,
          SUM(subtotal_con_descuento) as subtotal_neto
        FROM ${this.detallesTableName}
        WHERE venta_id = ?`,
        [ticketId]
      );

      const subtotalBruto = parseFloat(totales[0].subtotal_bruto) || 0;
      const descuentoTotal = parseFloat(totales[0].descuento_total) || 0;
      const subtotalNeto = parseFloat(totales[0].subtotal_neto) || 0;

      // Obtener configuración de IVA
      const [configIva] = await connection.execute(
        'SELECT valor FROM configuracion_fiscal WHERE clave = ? AND activa = 1',
        ['iva_defecto']
      );

      const ivaPorcentaje = configIva.length > 0 ? parseFloat(configIva[0].valor) : 19.00;
      const ivaMonto = (subtotalNeto * ivaPorcentaje) / 100;
      const totalFinal = subtotalNeto + ivaMonto;

      // Actualizar ticket
      await connection.execute(
        `UPDATE ${this.tableName}
        SET
          subtotal_bruto = ?,
          descuento_monto = ?,
          subtotal_neto = ?,
          iva_porcentaje = ?,
          iva_monto = ?,
          total_final = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [subtotalBruto, descuentoTotal, subtotalNeto, ivaPorcentaje, ivaMonto, totalFinal, ticketId]
      );

      return {
        subtotal_bruto: subtotalBruto,
        descuento_total: descuentoTotal,
        subtotal_neto: subtotalNeto,
        iva_porcentaje: ivaPorcentaje,
        iva_monto: ivaMonto,
        total_final: totalFinal
      };

    } finally {
      if (!providedConnection) {
        connection.release();
      }
    }
  }

  /**
   * Actualizar estado del ticket
   */
  async updateEstado(ticketId, nuevoEstado, datos = {}) {
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const updateFields = [];
      const values = [];

      if (nuevoEstado.estado_venta) {
        updateFields.push('estado_venta = ?');
        values.push(nuevoEstado.estado_venta);

        if (nuevoEstado.estado_venta === 'CERRADA') {
          updateFields.push('timestamp_cierre = NOW()');
        }
      }

      if (nuevoEstado.estado_cocina) {
        updateFields.push('estado_cocina = ?');
        values.push(nuevoEstado.estado_cocina);
      }

      if (nuevoEstado.estado_pago) {
        updateFields.push('estado_pago = ?');
        values.push(nuevoEstado.estado_pago);
      }

      if (datos.observaciones_generales !== undefined) {
        updateFields.push('observaciones_generales = ?');
        values.push(datos.observaciones_generales);
      }

      if (datos.propina_recibida !== undefined) {
        updateFields.push('propina_recibida = ?');
        values.push(parseFloat(datos.propina_recibida));
      }

      updateFields.push('updated_at = NOW()');
      values.push(ticketId);

      const updateQuery = `
        UPDATE ${this.tableName}
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      await connection.execute(updateQuery, values);

      await connection.commit();

      return await this.findById(ticketId, connection);

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Obtener estadísticas de tickets
   */
  async getEstadisticas(filtros = {}) {
    const connection = await db.getConnection();

    try {
      const fechaHoy = new Date().toISOString().split('T')[0];
      const fechaDesde = filtros.fecha_desde || fechaHoy;
      const fechaHasta = filtros.fecha_hasta || fechaHoy;

      const query = `
        SELECT
          COUNT(*) as total_tickets,
          COUNT(CASE WHEN estado_venta = 'ABIERTA' THEN 1 END) as tickets_abiertos,
          COUNT(CASE WHEN estado_venta = 'CERRADA' THEN 1 END) as tickets_cerrados,
          COUNT(CASE WHEN estado_pago = 'PAGADO_TOTAL' THEN 1 END) as tickets_pagados,
          COUNT(CASE WHEN estado_cocina = 'PENDIENTE' THEN 1 END) as cocina_pendientes,
          COUNT(CASE WHEN estado_cocina = 'EN_PREPARACION' THEN 1 END) as cocina_preparacion,
          COUNT(CASE WHEN estado_cocina = 'LISTO' THEN 1 END) as cocina_listos,
          SUM(total_final) as ventas_totales,
          AVG(total_final) as ticket_promedio,
          SUM(CASE WHEN estado_pago = 'PAGADO_TOTAL' THEN total_final ELSE 0 END) as ventas_pagadas,
          COUNT(DISTINCT mesa_id) as mesas_utilizadas,
          AVG(TIMESTAMPDIFF(MINUTE, timestamp_inicio, COALESCE(timestamp_cierre, NOW()))) as tiempo_promedio_minutos
        FROM ${this.tableName}
        WHERE fecha_venta BETWEEN ? AND ?
      `;

      const [estadisticas] = await connection.execute(query, [fechaDesde, fechaHasta]);

      return estadisticas[0];

    } finally {
      connection.release();
    }
  }
}

module.exports = TicketsRepository;