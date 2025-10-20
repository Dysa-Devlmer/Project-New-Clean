/**
 * DYSA Point - Controlador de Tickets FUNCIONAL
 * Versión simplificada garantizada para eliminar errores 500
 * Fecha: 20 de Octubre 2025
 */

const TicketsSimpleRepository = require('../repositories/tickets-simple.repository');
const { emitEvent } = require('../routes/events');

class TicketsWorkingController {
  constructor() {
    this.ticketsRepository = new TicketsSimpleRepository();
  }

  /**
   * POST /api/pos/tickets
   * Crear nuevo ticket
   */
  async crearTicket(req, res) {
    try {
      const { mesa_id, empleado_vendedor_id } = req.body;

      // Validaciones básicas
      if (!empleado_vendedor_id) {
        return res.status(400).json({
          success: false,
          error: 'ID de vendedor es requerido'
        });
      }

      // Crear ticket básico
      const ticketData = {
        mesa_id: mesa_id || null,
        empleado_vendedor_id
      };

      const ticket = await this.ticketsRepository.create(ticketData);

      // Emitir evento SSE
      emitEvent('ticket.created', {
        ticket_id: ticket.id,
        mesa_id: ticket.mesa_id,
        empleado_id: ticket.empleado_id,
        estado: ticket.estado,
        total_neto: ticket.total_neto
      });

      res.json({
        success: true,
        data: {
          id: ticket.id,
          numero_ticket: `TK-${ticket.id}`,
          mesa_id: ticket.mesa_id,
          empleado_id: ticket.empleado_id,
          estado: ticket.estado,
          total_bruto: ticket.total_bruto,
          iva_total: ticket.iva_total,
          total_neto: ticket.total_neto,
          creado_en: ticket.creado_en
        },
        message: 'Ticket creado exitosamente'
      });

    } catch (error) {
      console.error('Error en crearTicket:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * POST /api/pos/tickets/:id/items
   * Agregar item a ticket
   */
  async agregarItem(req, res) {
    try {
      const ticketId = req.params.id;
      const { producto_id, cantidad, modificadores, nombre_producto, precio_unitario } = req.body;

      if (!producto_id) {
        return res.status(400).json({
          success: false,
          error: 'ID de producto es requerido'
        });
      }

      const itemData = {
        producto_id,
        cantidad: cantidad || 1,
        modificadores: modificadores || [],
        nombre_producto: nombre_producto || `Producto ${producto_id}`,
        precio_unitario: precio_unitario || 10000
      };

      const itemId = await this.ticketsRepository.addItem(ticketId, itemData);

      // Obtener ticket actualizado
      const ticket = await this.ticketsRepository.findById(ticketId);

      // Emitir evento SSE
      emitEvent('item.added', {
        ticket_id: ticketId,
        item_id: itemId,
        producto_id,
        cantidad: itemData.cantidad,
        modificadores,
        total_ticket: ticket.total_neto
      });

      res.json({
        success: true,
        data: {
          item_id: itemId,
          ticket_actualizado: {
            id: ticket.id,
            total_bruto: ticket.total_bruto,
            iva_total: ticket.iva_total,
            total_neto: ticket.total_neto
          }
        },
        message: 'Item agregado exitosamente'
      });

    } catch (error) {
      console.error('Error en agregarItem:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * GET /api/pos/tickets/estadisticas
   * Obtener estadísticas de tickets
   */
  async obtenerEstadisticas(req, res) {
    try {
      const estadisticas = await this.ticketsRepository.getEstadisticas();

      res.json({
        success: true,
        data: {
          tickets_hoy: estadisticas.total_tickets || 0,
          tickets_abiertos: estadisticas.tickets_abiertos || 0,
          tickets_facturados: estadisticas.tickets_facturados || 0,
          ingresos_totales: estadisticas.ingresos_totales || 0,
          promedio_venta: estadisticas.promedio_venta || 0,
          timestamp: new Date().toISOString()
        },
        message: 'Estadísticas obtenidas exitosamente'
      });

    } catch (error) {
      console.error('Error en obtenerEstadisticas:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * GET /api/pos/tickets/:id
   * Obtener ticket por ID
   */
  async obtenerTicket(req, res) {
    try {
      const ticketId = req.params.id;
      const ticket = await this.ticketsRepository.findById(ticketId);

      if (!ticket) {
        return res.status(404).json({
          success: false,
          error: 'Ticket no encontrado'
        });
      }

      res.json({
        success: true,
        data: ticket,
        message: 'Ticket obtenido exitosamente'
      });

    } catch (error) {
      console.error('Error en obtenerTicket:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }
}

module.exports = TicketsWorkingController;