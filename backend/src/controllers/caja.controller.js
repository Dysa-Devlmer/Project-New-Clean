/**
 * DYSA Point - Controlador de Caja/Pagos
 * Endpoints para pagos, métodos de pago y cierres de caja con SSE
 * Fecha: 20 de Octubre 2025
 */

const CajaService = require('../services/caja.service');
const { ValidationError, NotFoundError, BusinessError } = require('../utils/errors');
const { emitEvent } = require('../routes/events');

class CajaController {
  constructor() {
    this.cajaService = new CajaService();
  }

  /**
   * POST /api/pos/caja/pagos
   * Registrar pago de un ticket
   */
  async registrarPago(req, res) {
    try {
      const pagoData = req.body;
      const usuario = req.user || { id: 1 };

      // Validaciones básicas
      if (!pagoData.venta_id) {
        return res.status(400).json({
          success: false,
          error: 'ID de venta es requerido'
        });
      }

      if (!pagoData.metodo_pago_id) {
        return res.status(400).json({
          success: false,
          error: 'Método de pago es requerido'
        });
      }

      if (!pagoData.monto_pagado || parseFloat(pagoData.monto_pagado) <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Monto pagado debe ser mayor a 0'
        });
      }

      const resultado = await this.cajaService.registrarPago(pagoData, usuario);

      // Emitir eventos SSE
      emitEvent('payment.created', {
        pago_id: resultado.pago.id,
        ticket_id: pagoData.venta_id,
        metodo_pago: resultado.pago.metodo_pago_nombre,
        monto_pagado: resultado.pago.monto_pagado,
        ticket_estado: resultado.ticket_actualizado.estado_venta,
        total_pagado: resultado.ticket_actualizado.total_pagado
      });

      if (resultado.ticket_actualizado.estado_venta === 'PAGADA') {
        emitEvent('ticket.paid', {
          ticket_id: pagoData.venta_id,
          total_final: resultado.ticket_actualizado.total_pagado,
          metodo_pago: resultado.pago.metodo_pago_nombre
        });
      }

      res.json({
        success: true,
        data: {
          pago: resultado.pago,
          ticket: resultado.ticket_actualizado
        },
        message: 'Pago registrado exitosamente'
      });

    } catch (error) {
      console.error('Error en registrarPago:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * GET /api/pos/caja/metodos
   * Obtener métodos de pago disponibles
   */
  async obtenerMetodosPago(req, res) {
    try {
      const metodos = await this.cajaService.getMetodosPago();

      res.json({
        success: true,
        data: metodos,
        message: 'Métodos de pago obtenidos exitosamente'
      });

    } catch (error) {
      console.error('Error en obtenerMetodosPago:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * POST /api/pos/caja/cierre
   * Realizar cierre simple de caja
   */
  async realizarCierre(req, res) {
    try {
      const cierreData = req.body;
      const usuario = req.user || { id: 1 };

      const resultado = await this.cajaService.realizarCierre(cierreData, usuario);

      // Emitir evento SSE
      emitEvent('cashdrawer.updated', {
        cierre_id: resultado.cierre.id,
        total_ventas: resultado.cierre.total_ventas,
        diferencia_caja: resultado.cierre.diferencia_caja,
        empleado_id: usuario.id
      });

      res.json({
        success: true,
        data: {
          cierre: resultado.cierre,
          resumen_dia: resultado.resumen_dia,
          alertas: resultado.alertas
        },
        message: 'Cierre de caja realizado exitosamente'
      });

    } catch (error) {
      console.error('Error en realizarCierre:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * GET /api/pos/caja/resumen
   * Obtener resumen de caja del día
   */
  async obtenerResumen(req, res) {
    try {
      const fecha = req.query.fecha || null;
      const resumen = await this.cajaService.getResumenDia(fecha);

      res.json({
        success: true,
        data: resumen,
        message: 'Resumen de caja obtenido exitosamente'
      });

    } catch (error) {
      console.error('Error en obtenerResumen:', error);
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: error.message
      });
    }
  }

  /**
   * GET /api/pos/caja/estadisticas
   * Obtener estadísticas de pagos y caja
   */
  async obtenerEstadisticas(req, res) {
    try {
      const estadisticas = await this.cajaService.getEstadisticas();

      res.json({
        success: true,
        data: estadisticas,
        message: 'Estadísticas de caja obtenidas exitosamente'
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
}

module.exports = CajaController;