/**
 * DYSA Point - Controlador de Tickets Simplificado
 * Versión funcional inmediata para smoke tests
 * Fecha: 20 de Octubre 2025
 */

const { emitEvent } = require('../routes/events'); // Para SSE

class TicketsSimpleController {
  constructor() {
    // Simulador en memoria para demos rápidas (luego migrar a BD)
    this.tickets = [];
    this.nextId = 1;
  }

  /**
   * GET /api/pos/tickets/estadisticas
   * Estadísticas básicas
   */
  async obtenerEstadisticas(req, res) {
    try {
      const estadisticas = {
        tickets_abiertos: this.tickets.filter(t => t.estado_venta === 'ABIERTA').length,
        tickets_cerrados: this.tickets.filter(t => t.estado_venta === 'CERRADA').length,
        tickets_pagados: this.tickets.filter(t => t.estado_pago === 'PAGADO').length,
        total_ventas_hoy: this.tickets.reduce((sum, t) => sum + (t.total_final || 0), 0),
        promedio_ticket: this.tickets.length > 0
          ? this.tickets.reduce((sum, t) => sum + (t.total_final || 0), 0) / this.tickets.length
          : 0,
        mesas_ocupadas: [...new Set(this.tickets.filter(t => t.estado_venta === 'ABIERTA' && t.mesa_id).map(t => t.mesa_id))].length,
        items_vendidos: this.tickets.reduce((sum, t) => sum + (t.items ? t.items.length : 0), 0),
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: estadisticas,
        message: 'Estadísticas obtenidas (modo simulación)'
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo estadísticas: ' + error.message
      });
    }
  }

  /**
   * POST /api/pos/tickets
   * Crear nuevo ticket
   */
  async crearTicket(req, res) {
    try {
      const { mesa_id, tipo_venta = 'MESA', modalidad_pago = 'CONTADO', nombre_cliente } = req.body;

      // Validaciones básicas
      if (tipo_venta === 'MESA' && !mesa_id) {
        return res.status(400).json({
          success: false,
          error: 'Mesa es requerida para ventas tipo MESA'
        });
      }

      // Crear ticket
      const ticket = {
        id: this.nextId++,
        numero_venta: `TK-${Date.now()}`,
        mesa_id: mesa_id || null,
        tipo_venta,
        modalidad_pago,
        nombre_cliente: nombre_cliente || null,
        estado_venta: 'ABIERTA',
        estado_cocina: 'PENDIENTE',
        estado_pago: 'PENDIENTE',
        empleado_vendedor_id: 1, // Mock
        timestamp_inicio: new Date().toISOString(),
        fecha_venta: new Date().toISOString().split('T')[0],
        hora_inicio: new Date().toTimeString().split(' ')[0],
        items: [],
        subtotal_bruto: 0,
        descuento_monto: 0,
        subtotal_neto: 0,
        iva_monto: 0,
        total_final: 0,
        propina_sugerida: 0
      };

      this.tickets.push(ticket);

      // Emitir evento SSE
      emitEvent('ticket.created', {
        ticket_id: ticket.id,
        numero_venta: ticket.numero_venta,
        mesa_id: ticket.mesa_id,
        tipo_venta: ticket.tipo_venta,
        estado_venta: ticket.estado_venta,
        empleado_vendedor_id: ticket.empleado_vendedor_id,
        total_final: ticket.total_final,
        timestamp: new Date().toISOString()
      }, {
        source: 'tickets-simple.controller',
        action: 'create'
      });

      res.status(201).json({
        success: true,
        data: ticket,
        message: 'Ticket creado exitosamente (modo simulación)'
      });

    } catch (error) {
      console.error('Error creando ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Error creando ticket: ' + error.message
      });
    }
  }

  /**
   * GET /api/pos/tickets/:id
   * Obtener ticket por ID
   */
  async obtenerTicket(req, res) {
    try {
      const ticketId = parseInt(req.params.id);
      const ticket = this.tickets.find(t => t.id === ticketId);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket no encontrado'
        });
      }

      res.json({
        success: true,
        data: ticket
      });

    } catch (error) {
      console.error('Error obteniendo ticket:', error);
      res.status(500).json({
        success: false,
        error: 'Error obteniendo ticket: ' + error.message
      });
    }
  }

  /**
   * GET /api/pos/tickets
   * Listar tickets
   */
  async listarTickets(req, res) {
    try {
      const { mesa_id, estado_venta, limite = 50 } = req.query;
      let tickets = [...this.tickets];

      // Filtros
      if (mesa_id) {
        tickets = tickets.filter(t => t.mesa_id === parseInt(mesa_id));
      }

      if (estado_venta) {
        tickets = tickets.filter(t => t.estado_venta === estado_venta);
      }

      // Limitar resultados
      tickets = tickets.slice(0, parseInt(limite));

      res.json({
        success: true,
        data: tickets,
        total: tickets.length,
        message: 'Tickets listados (modo simulación)'
      });

    } catch (error) {
      console.error('Error listando tickets:', error);
      res.status(500).json({
        success: false,
        error: 'Error listando tickets: ' + error.message
      });
    }
  }

  /**
   * POST /api/pos/tickets/:id/items
   * Agregar item al ticket
   */
  async agregarItem(req, res) {
    try {
      const ticketId = parseInt(req.params.id);
      const { producto_id, cantidad = 1, precio_unitario = 10000, modificadores = [] } = req.body;

      const ticket = this.tickets.find(t => t.id === ticketId);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket no encontrado'
        });
      }

      if (ticket.estado_venta !== 'ABIERTA') {
        return res.status(400).json({
          success: false,
          error: 'No se puede agregar items a un ticket cerrado'
        });
      }

      // Crear item
      const item = {
        id: Date.now(),
        producto_id: producto_id || 101,
        nombre_producto: `Producto ${producto_id || 101}`,
        cantidad,
        precio_unitario,
        modificadores: modificadores || [],
        subtotal_item: cantidad * precio_unitario,
        estado_preparacion: 'PENDIENTE',
        timestamp_agregado: new Date().toISOString()
      };

      ticket.items.push(item);

      // Recalcular totales
      this.recalcularTotales(ticket);

      // Emitir evento SSE
      emitEvent('ticket.item.added', {
        ticket_id: ticketId,
        item: item,
        ticket_actualizado: {
          id: ticket.id,
          total_final: ticket.total_final,
          subtotal_neto: ticket.subtotal_neto,
          iva_monto: ticket.iva_monto,
          total_items: ticket.items.length
        }
      }, {
        source: 'tickets-simple.controller',
        action: 'add_item'
      });

      res.status(201).json({
        success: true,
        data: { item, ticket },
        message: 'Item agregado exitosamente (modo simulación)'
      });

    } catch (error) {
      console.error('Error agregando item:', error);
      res.status(500).json({
        success: false,
        error: 'Error agregando item: ' + error.message
      });
    }
  }

  /**
   * PUT /api/pos/tickets/:id/estado
   * Actualizar estado del ticket
   */
  async actualizarEstado(req, res) {
    try {
      const ticketId = parseInt(req.params.id);
      const { estado_venta, estado_cocina, estado_pago } = req.body;

      const ticket = this.tickets.find(t => t.id === ticketId);
      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket no encontrado'
        });
      }

      // Actualizar estados
      if (estado_venta) ticket.estado_venta = estado_venta;
      if (estado_cocina) ticket.estado_cocina = estado_cocina;
      if (estado_pago) ticket.estado_pago = estado_pago;

      if (estado_venta === 'CERRADA') {
        ticket.timestamp_cierre = new Date().toISOString();
      }

      // Emitir evento SSE
      emitEvent('ticket.updated', {
        ticket_id: ticketId,
        numero_venta: ticket.numero_venta,
        mesa_id: ticket.mesa_id,
        estado_nuevo: { estado_venta, estado_cocina, estado_pago },
        ticket_actualizado: {
          id: ticket.id,
          estado_venta: ticket.estado_venta,
          estado_cocina: ticket.estado_cocina,
          estado_pago: ticket.estado_pago,
          timestamp_cierre: ticket.timestamp_cierre
        }
      }, {
        source: 'tickets-simple.controller',
        action: 'update_status'
      });

      res.json({
        success: true,
        data: ticket,
        message: 'Estado actualizado exitosamente (modo simulación)'
      });

    } catch (error) {
      console.error('Error actualizando estado:', error);
      res.status(500).json({
        success: false,
        error: 'Error actualizando estado: ' + error.message
      });
    }
  }

  /**
   * Recalcular totales del ticket
   */
  recalcularTotales(ticket) {
    ticket.subtotal_bruto = ticket.items.reduce((sum, item) => sum + item.subtotal_item, 0);
    ticket.subtotal_neto = ticket.subtotal_bruto - ticket.descuento_monto;
    ticket.iva_monto = Math.round(ticket.subtotal_neto * 0.19); // IVA 19%
    ticket.total_final = ticket.subtotal_neto + ticket.iva_monto;
    ticket.propina_sugerida = Math.round(ticket.total_final * 0.10); // Propina 10%
  }
}

module.exports = TicketsSimpleController;