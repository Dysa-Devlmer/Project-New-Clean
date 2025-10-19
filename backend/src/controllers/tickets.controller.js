/**
 * DYSA Point - Controlador de Tickets (Ventas)
 * API endpoints para tickets con validaciones y eventos SSE
 * Fecha: 19 de Octubre 2025
 */

const TicketsService = require('../services/tickets.service');
const { ValidationError, NotFoundError, BusinessError } = require('../utils/errors');
const { emitEvent } = require('../routes/events'); // Para SSE

class TicketsController {
  constructor() {
    this.ticketsService = new TicketsService();
  }

  /**
   * POST /api/pos/tickets
   * Crear nuevo ticket
   */
  async crearTicket(req, res) {
    try {
      const datosTicket = req.body;
      const usuario = req.user || { id: 1 }; // Mock usuario por ahora

      // Validar datos requeridos
      if (!datosTicket.mesa_id && datosTicket.tipo_venta === 'MESA') {
        return res.status(400).json({
          success: false,
          error: 'Mesa es requerida para ventas tipo MESA'
        });
      }

      const ticket = await this.ticketsService.crearTicket(datosTicket, usuario);

      // Emitir evento SSE para sincronización
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
        source: 'tickets.controller',
        action: 'create'
      });

      // Emitir evento de actualización de mesa si aplica
      if (ticket.mesa_id) {
        emitEvent('mesa.updated', {
          mesa_id: ticket.mesa_id,
          estado_mesa: 'OCUPADA',
          ticket_id: ticket.id,
          empleado_asignado: usuario.id
        }, {
          source: 'tickets.controller',
          action: 'mesa_occupied'
        });
      }

      res.status(201).json({
        success: true,
        data: ticket,
        message: 'Ticket creado exitosamente'
      });

    } catch (error) {
      console.error('Error creando ticket:', error);

      if (error instanceof ValidationError || error instanceof BusinessError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
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

      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'ID de ticket inválido'
        });
      }

      const ticket = await this.ticketsService.obtenerTicket(ticketId);

      res.json({
        success: true,
        data: ticket
      });

    } catch (error) {
      console.error('Error obteniendo ticket:', error);

      if (error instanceof NotFoundError) {
        return res.status(404).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/pos/tickets
   * Listar tickets con filtros
   */
  async listarTickets(req, res) {
    try {
      const filtros = {
        mesa_id: req.query.mesa_id ? parseInt(req.query.mesa_id) : undefined,
        estado_venta: req.query.estado_venta,
        estado_cocina: req.query.estado_cocina,
        estado_pago: req.query.estado_pago,
        tipo_venta: req.query.tipo_venta,
        empleado_vendedor_id: req.query.empleado_vendedor_id ? parseInt(req.query.empleado_vendedor_id) : undefined,
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta,
        buscar: req.query.buscar,
        orden: req.query.orden || 'timestamp_inicio DESC',
        limite: req.query.limite ? parseInt(req.query.limite) : 50,
        offset: req.query.offset ? parseInt(req.query.offset) : 0
      };

      const tickets = await this.ticketsService.listarTickets(filtros);

      res.json({
        success: true,
        data: tickets,
        total: tickets.length,
        filtros: filtros
      });

    } catch (error) {
      console.error('Error listando tickets:', error);

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
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
      const datosItem = req.body;
      const usuario = req.user || { id: 1 };

      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'ID de ticket inválido'
        });
      }

      // Validar datos del item
      if (!datosItem.producto_id) {
        return res.status(400).json({
          success: false,
          error: 'ID de producto es requerido'
        });
      }

      if (!datosItem.cantidad || datosItem.cantidad <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Cantidad debe ser mayor a cero'
        });
      }

      const resultado = await this.ticketsService.agregarItem(ticketId, datosItem, usuario);

      // Emitir evento SSE
      emitEvent('ticket.item.added', {
        ticket_id: ticketId,
        item: resultado.item,
        ticket_actualizado: {
          id: resultado.ticket.id,
          total_final: resultado.ticket.total_final,
          subtotal_neto: resultado.ticket.subtotal_neto,
          iva_monto: resultado.ticket.iva_monto,
          total_items: resultado.ticket.estadisticas.total_items
        }
      }, {
        source: 'tickets.controller',
        action: 'add_item'
      });

      res.status(201).json({
        success: true,
        data: resultado,
        message: 'Item agregado exitosamente'
      });

    } catch (error) {
      console.error('Error agregando item:', error);

      if (error instanceof ValidationError || error instanceof BusinessError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * PUT /api/pos/tickets/:id/items/:itemId
   * Actualizar item del ticket
   */
  async actualizarItem(req, res) {
    try {
      const ticketId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const datosActualizacion = req.body;
      const usuario = req.user || { id: 1 };

      if (isNaN(ticketId) || isNaN(itemId)) {
        return res.status(400).json({
          success: false,
          error: 'IDs inválidos'
        });
      }

      const resultado = await this.ticketsService.actualizarItem(ticketId, itemId, datosActualizacion, usuario);

      // Emitir evento SSE
      emitEvent('ticket.item.updated', {
        ticket_id: ticketId,
        item_id: itemId,
        item: resultado.item,
        ticket_actualizado: {
          id: resultado.ticket.id,
          total_final: resultado.ticket.total_final,
          subtotal_neto: resultado.ticket.subtotal_neto,
          iva_monto: resultado.ticket.iva_monto
        },
        cambios: datosActualizacion
      }, {
        source: 'tickets.controller',
        action: 'update_item'
      });

      res.json({
        success: true,
        data: resultado,
        message: 'Item actualizado exitosamente'
      });

    } catch (error) {
      console.error('Error actualizando item:', error);

      if (error instanceof ValidationError || error instanceof BusinessError || error instanceof NotFoundError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * DELETE /api/pos/tickets/:id/items/:itemId
   * Remover item del ticket
   */
  async removerItem(req, res) {
    try {
      const ticketId = parseInt(req.params.id);
      const itemId = parseInt(req.params.itemId);
      const usuario = req.user || { id: 1 };

      if (isNaN(ticketId) || isNaN(itemId)) {
        return res.status(400).json({
          success: false,
          error: 'IDs inválidos'
        });
      }

      const resultado = await this.ticketsService.removerItem(ticketId, itemId, usuario);

      // Emitir evento SSE
      emitEvent('ticket.item.removed', {
        ticket_id: ticketId,
        item_id: itemId,
        ticket_actualizado: {
          id: resultado.ticket.id,
          total_final: resultado.ticket.total_final,
          subtotal_neto: resultado.ticket.subtotal_neto,
          iva_monto: resultado.ticket.iva_monto,
          total_items: resultado.ticket.estadisticas.total_items
        }
      }, {
        source: 'tickets.controller',
        action: 'remove_item'
      });

      res.json({
        success: true,
        data: resultado,
        message: 'Item removido exitosamente'
      });

    } catch (error) {
      console.error('Error removiendo item:', error);

      if (error instanceof ValidationError || error instanceof BusinessError || error instanceof NotFoundError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
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
      const { estado_venta, estado_cocina, estado_pago, ...datos } = req.body;
      const usuario = req.user || { id: 1 };

      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'ID de ticket inválido'
        });
      }

      const nuevoEstado = {};
      if (estado_venta) nuevoEstado.estado_venta = estado_venta;
      if (estado_cocina) nuevoEstado.estado_cocina = estado_cocina;
      if (estado_pago) nuevoEstado.estado_pago = estado_pago;

      if (Object.keys(nuevoEstado).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar al menos un estado para actualizar'
        });
      }

      const ticket = await this.ticketsService.actualizarEstado(ticketId, nuevoEstado, datos, usuario);

      // Emitir evento SSE
      emitEvent('ticket.updated', {
        ticket_id: ticketId,
        numero_venta: ticket.numero_venta,
        mesa_id: ticket.mesa_id,
        estado_anterior: req.body.estado_anterior,
        estado_nuevo: nuevoEstado,
        ticket_actualizado: {
          id: ticket.id,
          estado_venta: ticket.estado_venta,
          estado_cocina: ticket.estado_cocina,
          estado_pago: ticket.estado_pago,
          timestamp_cierre: ticket.timestamp_cierre
        }
      }, {
        source: 'tickets.controller',
        action: 'update_status'
      });

      // Si el ticket se cerró y tenía mesa, emitir evento de mesa liberada
      if (estado_venta === 'CERRADA' && ticket.mesa_id) {
        emitEvent('mesa.updated', {
          mesa_id: ticket.mesa_id,
          estado_mesa: 'LIBRE',
          ticket_cerrado: ticketId
        }, {
          source: 'tickets.controller',
          action: 'mesa_freed'
        });
      }

      res.json({
        success: true,
        data: ticket,
        message: 'Estado actualizado exitosamente'
      });

    } catch (error) {
      console.error('Error actualizando estado:', error);

      if (error instanceof ValidationError || error instanceof BusinessError || error instanceof NotFoundError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/pos/tickets/:id/split/items
   * Split de ticket por ítems específicos
   */
  async splitTicketPorItems(req, res) {
    try {
      const ticketId = parseInt(req.params.id);
      const { items_para_nuevo_ticket, datos_nuevo_ticket } = req.body;
      const usuario = req.user || { id: 1 };

      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'ID de ticket inválido'
        });
      }

      if (!items_para_nuevo_ticket || !Array.isArray(items_para_nuevo_ticket) || items_para_nuevo_ticket.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar items para el nuevo ticket'
        });
      }

      const resultado = await this.ticketsService.splitTicketPorItems(
        ticketId,
        items_para_nuevo_ticket,
        datos_nuevo_ticket || {},
        usuario
      );

      // Emitir evento SSE
      emitEvent('ticket.split', {
        ticket_original: {
          id: resultado.ticket_original.id,
          numero_venta: resultado.ticket_original.numero_venta,
          total_final: resultado.ticket_original.total_final,
          total_items: resultado.ticket_original.estadisticas.total_items
        },
        ticket_nuevo: {
          id: resultado.ticket_nuevo.id,
          numero_venta: resultado.ticket_nuevo.numero_venta,
          total_final: resultado.ticket_nuevo.total_final,
          total_items: resultado.ticket_nuevo.estadisticas.total_items
        },
        mesa_id: resultado.ticket_original.mesa_id,
        tipo_split: 'items'
      }, {
        source: 'tickets.controller',
        action: 'split_by_items'
      });

      res.status(201).json({
        success: true,
        data: resultado,
        message: 'Ticket dividido exitosamente'
      });

    } catch (error) {
      console.error('Error en split por items:', error);

      if (error instanceof ValidationError || error instanceof BusinessError || error instanceof NotFoundError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/pos/tickets/:id/split/comensales
   * Split de ticket por número de comensales
   */
  async splitTicketPorComensales(req, res) {
    try {
      const ticketId = parseInt(req.params.id);
      const { numero_comensales } = req.body;
      const usuario = req.user || { id: 1 };

      if (isNaN(ticketId)) {
        return res.status(400).json({
          success: false,
          error: 'ID de ticket inválido'
        });
      }

      if (!numero_comensales || numero_comensales < 2) {
        return res.status(400).json({
          success: false,
          error: 'Número de comensales debe ser mayor a 1'
        });
      }

      const tickets = await this.ticketsService.splitTicketPorComensales(ticketId, numero_comensales, usuario);

      // Emitir evento SSE
      emitEvent('ticket.split', {
        tickets_resultantes: tickets.map(t => ({
          id: t.id,
          numero_venta: t.numero_venta,
          total_final: t.total_final,
          total_items: t.estadisticas.total_items
        })),
        mesa_id: tickets[0].mesa_id,
        numero_comensales: numero_comensales,
        tipo_split: 'comensales'
      }, {
        source: 'tickets.controller',
        action: 'split_by_diners'
      });

      res.status(201).json({
        success: true,
        data: tickets,
        message: `Ticket dividido en ${numero_comensales} partes`
      });

    } catch (error) {
      console.error('Error en split por comensales:', error);

      if (error instanceof ValidationError || error instanceof BusinessError || error instanceof NotFoundError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * POST /api/pos/tickets/merge
   * Merge de múltiples tickets
   */
  async mergeTickets(req, res) {
    try {
      const { ticket_principal_id, tickets_secundarios_ids } = req.body;
      const usuario = req.user || { id: 1 };

      if (!ticket_principal_id) {
        return res.status(400).json({
          success: false,
          error: 'ID de ticket principal es requerido'
        });
      }

      if (!tickets_secundarios_ids || !Array.isArray(tickets_secundarios_ids) || tickets_secundarios_ids.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Debe especificar tickets para fusionar'
        });
      }

      const ticketFinal = await this.ticketsService.mergeTickets(
        ticket_principal_id,
        tickets_secundarios_ids,
        usuario
      );

      // Emitir evento SSE
      emitEvent('ticket.merged', {
        ticket_final: {
          id: ticketFinal.id,
          numero_venta: ticketFinal.numero_venta,
          total_final: ticketFinal.total_final,
          total_items: ticketFinal.estadisticas.total_items
        },
        tickets_fusionados: tickets_secundarios_ids,
        mesa_id: ticketFinal.mesa_id
      }, {
        source: 'tickets.controller',
        action: 'merge_tickets'
      });

      res.json({
        success: true,
        data: ticketFinal,
        message: 'Tickets fusionados exitosamente'
      });

    } catch (error) {
      console.error('Error en merge de tickets:', error);

      if (error instanceof ValidationError || error instanceof BusinessError || error instanceof NotFoundError) {
        return res.status(400).json({
          success: false,
          error: error.message
        });
      }

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }

  /**
   * GET /api/pos/tickets/estadisticas
   * Obtener estadísticas de tickets
   */
  async obtenerEstadisticas(req, res) {
    try {
      const filtros = {
        fecha_desde: req.query.fecha_desde,
        fecha_hasta: req.query.fecha_hasta
      };

      const estadisticas = await this.ticketsService.obtenerEstadisticas(filtros);

      res.json({
        success: true,
        data: estadisticas,
        filtros: filtros
      });

    } catch (error) {
      console.error('Error obteniendo estadísticas:', error);

      res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
}

module.exports = TicketsController;