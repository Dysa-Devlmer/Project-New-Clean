/**
 * DYSA Point - Servicio de Caja/Pagos
 * Lógica de negocio para pagos, cálculos automáticos y cierres de caja
 * Fecha: 20 de Octubre 2025
 */

const CajaRepository = require('../repositories/caja.repository');
const TicketsRepository = require('../repositories/tickets.repository');
const { ValidationError, NotFoundError, BusinessError } = require('../utils/errors');

class CajaService {
  constructor() {
    this.cajaRepository = new CajaRepository();
    this.ticketsRepository = new TicketsRepository();
  }

  /**
   * Registrar pago de un ticket
   */
  async registrarPago(pagoData, usuario) {
    try {
      // Validaciones
      this.validarDatosPago(pagoData);

      // Verificar que el ticket existe y está abierto
      const ticket = await this.ticketsRepository.findById(pagoData.venta_id);
      if (!ticket) {
        throw new NotFoundError('Ticket no encontrado');
      }

      if (ticket.estado_venta === 'PAGADA') {
        throw new BusinessError('El ticket ya está pagado');
      }

      if (ticket.estado_venta === 'ANULADA') {
        throw new BusinessError('No se puede pagar un ticket anulado');
      }

      // Calcular totales y cambio
      const calculosPago = this.calcularPago(pagoData, ticket);

      // Crear el pago
      const datosPago = {
        ...pagoData,
        ...calculosPago,
        empleado_cajero_id: usuario.id || 1,
        terminal_id: pagoData.terminal_id || 1
      };

      const pago = await this.cajaRepository.createPago(datosPago);

      // Verificar si el ticket está completamente pagado
      const pagosTicket = await this.cajaRepository.findPagosByVentaId(pagoData.venta_id);
      const totalPagado = pagosTicket.reduce((sum, p) => sum + parseFloat(p.monto_pagado), 0);

      if (totalPagado >= parseFloat(ticket.total_final)) {
        // Marcar ticket como pagado
        await this.ticketsRepository.update(pagoData.venta_id, {
          estado_venta: 'PAGADA',
          estado_pago: 'PAGADO_TOTAL',
          timestamp_cierre: new Date()
        });
      } else {
        // Pago parcial
        await this.ticketsRepository.update(pagoData.venta_id, {
          estado_pago: 'PAGADO_PARCIAL'
        });
      }

      return {
        pago,
        ticket_actualizado: {
          estado_venta: totalPagado >= parseFloat(ticket.total_final) ? 'PAGADA' : ticket.estado_venta,
          total_pagado: totalPagado,
          pendiente_pago: parseFloat(ticket.total_final) - totalPagado
        }
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Calcular montos de pago, cambio y propina
   */
  calcularPago(pagoData, ticket) {
    const montoPagado = parseFloat(pagoData.monto_pagado);
    const totalTicket = parseFloat(ticket.total_final);
    const montoPropina = parseFloat(pagoData.monto_propina || 0);

    // Para efectivo, calcular cambio
    let montoCambio = 0;
    if (pagoData.metodo_pago_id === 1) { // Asumir que 1 = Efectivo
      const totalConPropina = totalTicket + montoPropina;
      montoCambio = Math.max(0, montoPagado - totalConPropina);
    }

    return {
      monto_pagado: montoPagado,
      monto_cambio: montoCambio,
      monto_propina: montoPropina
    };
  }

  /**
   * Validar datos de pago
   */
  validarDatosPago(pagoData) {
    if (!pagoData.venta_id) {
      throw new ValidationError('ID de venta es requerido');
    }

    if (!pagoData.metodo_pago_id) {
      throw new ValidationError('Método de pago es requerido');
    }

    if (!pagoData.monto_pagado || parseFloat(pagoData.monto_pagado) <= 0) {
      throw new ValidationError('Monto pagado debe ser mayor a 0');
    }
  }

  /**
   * Obtener métodos de pago disponibles
   */
  async getMetodosPago() {
    return await this.cajaRepository.getMetodosPago();
  }

  /**
   * Obtener resumen de caja del día
   */
  async getResumenDia(fecha = null) {
    return await this.cajaRepository.getResumenDia(fecha);
  }

  /**
   * Realizar cierre simple de caja
   */
  async realizarCierre(cierreData, usuario) {
    try {
      // Obtener resumen del día
      const resumenDia = await this.getResumenDia();

      // Calcular diferencia en caja (efectivo)
      const ventasEfectivo = resumenDia.por_metodo_pago
        .filter(m => m.tipo_metodo === 'EFECTIVO')
        .reduce((sum, m) => sum + parseFloat(m.total_por_metodo || 0), 0);

      const diferenciaCaja = (cierreData.monto_final_efectivo || 0) -
                            (cierreData.monto_inicial_efectivo || 0) -
                            ventasEfectivo;

      const datosCompletos = {
        ...cierreData,
        empleado_cajero_id: usuario.id || 1,
        total_ventas_efectivo: ventasEfectivo,
        total_ventas_tarjeta: resumenDia.por_metodo_pago
          .filter(m => m.tipo_metodo === 'TARJETA')
          .reduce((sum, m) => sum + parseFloat(m.total_por_metodo || 0), 0),
        total_ventas_digital: resumenDia.por_metodo_pago
          .filter(m => m.tipo_metodo === 'DIGITAL')
          .reduce((sum, m) => sum + parseFloat(m.total_por_metodo || 0), 0),
        total_propinas: resumenDia.resumen_general.total_propinas || 0,
        diferencia_caja: diferenciaCaja
      };

      const cierre = await this.cajaRepository.createCierre(datosCompletos);

      return {
        cierre,
        resumen_dia: resumenDia,
        alertas: diferenciaCaja !== 0 ? [`Diferencia en caja: $${diferenciaCaja}`] : []
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtener estadísticas de pagos
   */
  async getEstadisticas() {
    try {
      const resumen = await this.getResumenDia();

      return {
        transacciones_hoy: resumen.resumen_general.total_transacciones || 0,
        ingresos_hoy: resumen.resumen_general.total_ingresos || 0,
        propinas_hoy: resumen.resumen_general.total_propinas || 0,
        promedio_venta: resumen.resumen_general.promedio_venta || 0,
        metodos_pago: resumen.por_metodo_pago || [],
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw error;
    }
  }
}

module.exports = CajaService;