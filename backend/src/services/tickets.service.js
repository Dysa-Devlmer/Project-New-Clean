/**
 * DYSA Point - Servicio de Tickets (Ventas)
 * Lógica de negocio para tickets/ventas, items y operaciones split/merge
 * Fecha: 19 de Octubre 2025
 */

const TicketsRepository = require('../repositories/tickets-simple.repository');
const MesasRepository = require('../repositories/mesas.repository');
const { ValidationError, NotFoundError, BusinessError } = require('../utils/errors');

class TicketsService {
  constructor() {
    this.ticketsRepository = new TicketsRepository();
    this.mesasRepository = new MesasRepository();
  }

  /**
   * Crear nuevo ticket
   */
  async crearTicket(datosTicket, usuario) {
    try {
      // Validaciones
      this.validarDatosTicket(datosTicket);

      // Si es para mesa, validar que esté disponible
      if (datosTicket.mesa_id) {
        const mesa = await this.mesasRepository.findById(datosTicket.mesa_id);

        if (!mesa) {
          throw new NotFoundError('Mesa no encontrada');
        }

        if (mesa.estado_mesa === 'FUERA_SERVICIO') {
          throw new BusinessError('Mesa fuera de servicio');
        }

        // Verificar si ya hay un ticket abierto para esta mesa
        const ticketsAbiertos = await this.ticketsRepository.findMany({
          mesa_id: datosTicket.mesa_id,
          estado_venta: 'ABIERTA'
        });

        if (ticketsAbiertos.length > 0) {
          throw new BusinessError('Ya existe un ticket abierto para esta mesa');
        }
      }

      // Preparar datos del ticket
      const ticketData = {
        ...datosTicket,
        empleado_vendedor_id: usuario.id,
        terminal_id: datosTicket.terminal_id || 1,
        fecha_venta: new Date().toISOString().split('T')[0],
        hora_inicio: new Date().toTimeString().split(' ')[0]
      };

      // Crear ticket
      const ticket = await this.ticketsRepository.create(ticketData);

      // Actualizar estado de mesa si aplica
      if (datosTicket.mesa_id) {
        await this.mesasRepository.actualizarEstado(datosTicket.mesa_id, {
          estado: 'OCUPADA',
          numero_comensales: datosTicket.numero_comensales || 1,
          empleado_asignado: usuario.id
        });
      }

      return ticket;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtener ticket por ID
   */
  async obtenerTicket(ticketId) {
    try {
      const ticket = await this.ticketsRepository.findById(ticketId);

      // Enriquecer con información adicional
      return this.enriquecerTicket(ticket);

    } catch (error) {
      throw error;
    }
  }

  /**
   * Listar tickets con filtros
   */
  async listarTickets(filtros = {}) {
    try {
      const tickets = await this.ticketsRepository.findMany(filtros);

      // Enriquecer lista con información básica
      return tickets.map(ticket => ({
        ...ticket,
        estado_color: this.obtenerColorEstado(ticket.estado_venta),
        prioridad: this.calcularPrioridad(ticket),
        alertas: this.generarAlertas(ticket)
      }));

    } catch (error) {
      throw error;
    }
  }

  /**
   * Agregar item al ticket
   */
  async agregarItem(ticketId, datosItem, usuario) {
    try {
      // Validaciones
      this.validarDatosItem(datosItem);

      // Verificar que el ticket existe y está abierto
      const ticket = await this.ticketsRepository.findById(ticketId);

      if (ticket.estado_venta !== 'ABIERTA') {
        throw new BusinessError('No se puede agregar items a un ticket cerrado');
      }

      // Agregar item
      const item = await this.ticketsRepository.addItem(ticketId, datosItem);

      // Obtener ticket actualizado
      const ticketActualizado = await this.ticketsRepository.findById(ticketId);

      return {
        item,
        ticket: ticketActualizado
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Actualizar item del ticket
   */
  async actualizarItem(ticketId, itemId, datosActualizacion, usuario) {
    try {
      // Actualizar item
      const item = await this.ticketsRepository.updateItem(ticketId, itemId, datosActualizacion);

      // Obtener ticket actualizado
      const ticketActualizado = await this.ticketsRepository.findById(ticketId);

      return {
        item,
        ticket: ticketActualizado
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Remover item del ticket
   */
  async removerItem(ticketId, itemId, usuario) {
    try {
      // Remover item
      const resultado = await this.ticketsRepository.removeItem(ticketId, itemId);

      // Obtener ticket actualizado
      const ticketActualizado = await this.ticketsRepository.findById(ticketId);

      return {
        resultado,
        ticket: ticketActualizado
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Actualizar estado del ticket
   */
  async actualizarEstado(ticketId, nuevoEstado, datos = {}, usuario) {
    try {
      const ticket = await this.ticketsRepository.findById(ticketId);

      // Validar transición de estado
      this.validarTransicionEstado(ticket, nuevoEstado);

      // Actualizar estado
      const ticketActualizado = await this.ticketsRepository.updateEstado(ticketId, nuevoEstado, datos);

      // Actualizar estado de mesa si el ticket se cierra
      if (nuevoEstado.estado_venta === 'CERRADA' && ticket.mesa_id) {
        // Verificar si hay otros tickets abiertos en la mesa
        const otrosTickets = await this.ticketsRepository.findMany({
          mesa_id: ticket.mesa_id,
          estado_venta: 'ABIERTA'
        });

        if (otrosTickets.filter(t => t.id !== ticketId).length === 0) {
          // No hay otros tickets abiertos, liberar mesa
          await this.mesasRepository.actualizarEstado(ticket.mesa_id, {
            estado: 'LIBRE',
            numero_comensales: 0,
            empleado_asignado: null
          });
        }
      }

      return ticketActualizado;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Split de ticket por ítems
   */
  async splitTicketPorItems(ticketId, itemsParaNuevoTicket, datosNuevoTicket, usuario) {
    try {
      const ticket = await this.ticketsRepository.findById(ticketId);

      if (ticket.estado_venta !== 'ABIERTA') {
        throw new BusinessError('Solo se puede hacer split de tickets abiertos');
      }

      if (itemsParaNuevoTicket.length === 0) {
        throw new ValidationError('Debe especificar al menos un item para el nuevo ticket');
      }

      // Validar que todos los items pertenecen al ticket
      const itemsTicket = ticket.items.map(i => i.id);
      const itemsInvalidos = itemsParaNuevoTicket.filter(id => !itemsTicket.includes(id));

      if (itemsInvalidos.length > 0) {
        throw new ValidationError(`Items no encontrados en ticket: ${itemsInvalidos.join(', ')}`);
      }

      if (itemsParaNuevoTicket.length >= ticket.items.length) {
        throw new ValidationError('No se pueden mover todos los items. Debe quedar al menos uno en el ticket original');
      }

      // Crear nuevo ticket
      const nuevoTicketData = {
        ...datosNuevoTicket,
        mesa_id: ticket.mesa_id, // Mantener la misma mesa
        tipo_venta: ticket.tipo_venta,
        modalidad_pago: ticket.modalidad_pago
      };

      const nuevoTicket = await this.crearTicket(nuevoTicketData, usuario);

      // Mover items seleccionados al nuevo ticket
      for (const itemId of itemsParaNuevoTicket) {
        const item = ticket.items.find(i => i.id === itemId);

        // Agregar item al nuevo ticket
        await this.ticketsRepository.addItem(nuevoTicket.id, {
          producto_id: item.producto_id,
          cantidad: item.cantidad,
          precio_unitario: item.precio_unitario,
          descuento_porcentaje: item.descuento_porcentaje,
          modificaciones_solicitadas: item.modificaciones_solicitadas,
          ingredientes_removidos: item.ingredientes_removidos,
          ingredientes_agregados: item.ingredientes_agregados,
          nivel_coccion: item.nivel_coccion,
          observaciones_item: item.observaciones_item,
          es_cortesia: item.es_cortesia
        });

        // Remover item del ticket original
        await this.ticketsRepository.removeItem(ticketId, itemId);
      }

      // Obtener tickets actualizados
      const ticketOriginalActualizado = await this.ticketsRepository.findById(ticketId);
      const nuevoTicketCompleto = await this.ticketsRepository.findById(nuevoTicket.id);

      return {
        ticket_original: ticketOriginalActualizado,
        ticket_nuevo: nuevoTicketCompleto
      };

    } catch (error) {
      throw error;
    }
  }

  /**
   * Split de ticket por comensales
   */
  async splitTicketPorComensales(ticketId, numeroComensales, usuario) {
    try {
      const ticket = await this.ticketsRepository.findById(ticketId);

      if (ticket.estado_venta !== 'ABIERTA') {
        throw new BusinessError('Solo se puede hacer split de tickets abiertos');
      }

      if (numeroComensales < 2 || numeroComensales > ticket.items.length) {
        throw new ValidationError('Número de comensales inválido');
      }

      const ticketsResultado = [];
      const itemsPorComensal = Math.ceil(ticket.items.length / numeroComensales);

      // Crear tickets para cada comensal
      for (let i = 0; i < numeroComensales; i++) {
        const inicioItems = i * itemsPorComensal;
        const finItems = Math.min((i + 1) * itemsPorComensal, ticket.items.length);
        const itemsComensal = ticket.items.slice(inicioItems, finItems);

        if (itemsComensal.length === 0) continue;

        if (i === 0) {
          // Usar ticket original para primer comensal
          // Remover items que no le corresponden
          for (let j = finItems; j < ticket.items.length; j++) {
            await this.ticketsRepository.removeItem(ticketId, ticket.items[j].id);
          }

          const ticketActualizado = await this.ticketsRepository.findById(ticketId);
          ticketsResultado.push(ticketActualizado);

        } else {
          // Crear nuevo ticket para comensales adicionales
          const nuevoTicketData = {
            mesa_id: ticket.mesa_id,
            tipo_venta: ticket.tipo_venta,
            modalidad_pago: ticket.modalidad_pago,
            observaciones_generales: `Split comensal ${i + 1}/${numeroComensales}`
          };

          const nuevoTicket = await this.crearTicket(nuevoTicketData, usuario);

          // Agregar items correspondientes
          for (const item of itemsComensal) {
            await this.ticketsRepository.addItem(nuevoTicket.id, {
              producto_id: item.producto_id,
              cantidad: item.cantidad,
              precio_unitario: item.precio_unitario,
              descuento_porcentaje: item.descuento_porcentaje,
              modificaciones_solicitadas: item.modificaciones_solicitadas,
              ingredientes_removidos: item.ingredientes_removidos,
              ingredientes_agregados: item.ingredientes_agregados,
              nivel_coccion: item.nivel_coccion,
              observaciones_item: item.observaciones_item,
              es_cortesia: item.es_cortesia
            });
          }

          const ticketCompleto = await this.ticketsRepository.findById(nuevoTicket.id);
          ticketsResultado.push(ticketCompleto);
        }
      }

      return ticketsResultado;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Merge de tickets
   */
  async mergeTickets(ticketIdPrincipal, ticketIdsSecundarios, usuario) {
    try {
      // Validar ticket principal
      const ticketPrincipal = await this.ticketsRepository.findById(ticketIdPrincipal);

      if (ticketPrincipal.estado_venta !== 'ABIERTA') {
        throw new BusinessError('El ticket principal debe estar abierto');
      }

      // Validar tickets secundarios
      const ticketsSecundarios = [];
      for (const ticketId of ticketIdsSecundarios) {
        const ticket = await this.ticketsRepository.findById(ticketId);

        if (ticket.estado_venta !== 'ABIERTA') {
          throw new BusinessError(`Ticket ${ticketId} no está abierto`);
        }

        if (ticket.mesa_id !== ticketPrincipal.mesa_id) {
          throw new BusinessError(`Ticket ${ticketId} no está en la misma mesa`);
        }

        ticketsSecundarios.push(ticket);
      }

      // Mover todos los items de tickets secundarios al principal
      for (const ticketSecundario of ticketsSecundarios) {
        for (const item of ticketSecundario.items) {
          // Agregar item al ticket principal
          await this.ticketsRepository.addItem(ticketIdPrincipal, {
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            descuento_porcentaje: item.descuento_porcentaje,
            modificaciones_solicitadas: item.modificaciones_solicitadas,
            ingredientes_removidos: item.ingredientes_removidos,
            ingredientes_agregados: item.ingredientes_agregados,
            nivel_coccion: item.nivel_coccion,
            observaciones_item: item.observaciones_item,
            es_cortesia: item.es_cortesia
          });
        }

        // Cerrar ticket secundario como cancelado
        await this.ticketsRepository.updateEstado(ticketSecundario.id, {
          estado_venta: 'ANULADA'
        }, {
          observaciones_generales: `Fusionado con ticket ${ticketIdPrincipal}`
        });
      }

      // Obtener ticket principal actualizado
      const ticketFinal = await this.ticketsRepository.findById(ticketIdPrincipal);

      return ticketFinal;

    } catch (error) {
      throw error;
    }
  }

  /**
   * Obtener estadísticas
   */
  async obtenerEstadisticas(filtros = {}) {
    try {
      return await this.ticketsRepository.getEstadisticas(filtros);
    } catch (error) {
      throw error;
    }
  }

  // === MÉTODOS PRIVADOS ===

  /**
   * Validar datos del ticket
   */
  validarDatosTicket(datos) {
    if (!datos.empleado_vendedor_id && !datos.empleado_vendedor_id) {
      throw new ValidationError('ID de vendedor es requerido');
    }

    if (datos.mesa_id && typeof datos.mesa_id !== 'number') {
      throw new ValidationError('ID de mesa debe ser numérico');
    }

    if (datos.tipo_venta && !['MESA', 'DELIVERY', 'TAKEAWAY', 'DRIVE_THRU', 'ONLINE'].includes(datos.tipo_venta)) {
      throw new ValidationError('Tipo de venta inválido');
    }

    if (datos.modalidad_pago && !['CONTADO', 'CREDITO', 'MIXTO'].includes(datos.modalidad_pago)) {
      throw new ValidationError('Modalidad de pago inválida');
    }
  }

  /**
   * Validar datos del item
   */
  validarDatosItem(datos) {
    if (!datos.producto_id) {
      throw new ValidationError('ID de producto es requerido');
    }

    if (!datos.cantidad || datos.cantidad <= 0) {
      throw new ValidationError('Cantidad debe ser mayor a cero');
    }

    if (datos.precio_unitario && datos.precio_unitario < 0) {
      throw new ValidationError('Precio unitario no puede ser negativo');
    }

    if (datos.descuento_porcentaje && (datos.descuento_porcentaje < 0 || datos.descuento_porcentaje > 100)) {
      throw new ValidationError('Porcentaje de descuento debe estar entre 0 y 100');
    }
  }

  /**
   * Validar transición de estado
   */
  validarTransicionEstado(ticket, nuevoEstado) {
    const estadosValidos = {
      'ABIERTA': ['CERRADA', 'ANULADA'],
      'CERRADA': ['PAGADA', 'ANULADA'],
      'PAGADA': [],
      'ANULADA': [],
      'EN_PROCESO': ['ABIERTA', 'CERRADA', 'ANULADA']
    };

    if (nuevoEstado.estado_venta) {
      const transicionesPermitidas = estadosValidos[ticket.estado_venta] || [];

      if (!transicionesPermitidas.includes(nuevoEstado.estado_venta)) {
        throw new BusinessError(`Transición de estado inválida: ${ticket.estado_venta} → ${nuevoEstado.estado_venta}`);
      }
    }
  }

  /**
   * Enriquecer ticket con información adicional
   */
  enriquecerTicket(ticket) {
    return {
      ...ticket,
      estado_color: this.obtenerColorEstado(ticket.estado_venta),
      prioridad: this.calcularPrioridad(ticket),
      alertas: this.generarAlertas(ticket),
      tiempo_transcurrido_formateado: this.formatearTiempo(ticket.tiempo_transcurrido_minutos),
      resumen_cocina: this.generarResumenCocina(ticket.items || [])
    };
  }

  /**
   * Obtener color según estado
   */
  obtenerColorEstado(estado) {
    const colores = {
      'ABIERTA': '#3498db',     // Azul
      'CERRADA': '#2ecc71',     // Verde
      'PAGADA': '#27ae60',      // Verde oscuro
      'ANULADA': '#e74c3c',     // Rojo
      'EN_PROCESO': '#f39c12'   // Naranja
    };

    return colores[estado] || '#95a5a6';
  }

  /**
   * Calcular prioridad del ticket
   */
  calcularPrioridad(ticket) {
    let prioridad = 'normal';

    // Prioridad alta si tiene más de 45 minutos
    if (ticket.tiempo_transcurrido_minutos > 45) {
      prioridad = 'alta';
    }
    // Prioridad baja si es reciente (menos de 10 minutos)
    else if (ticket.tiempo_transcurrido_minutos < 10) {
      prioridad = 'baja';
    }

    return prioridad;
  }

  /**
   * Generar alertas para el ticket
   */
  generarAlertas(ticket) {
    const alertas = [];

    // Alerta por tiempo
    if (ticket.tiempo_transcurrido_minutos > 60) {
      alertas.push({
        tipo: 'tiempo',
        mensaje: 'Ticket lleva más de 1 hora abierto',
        severidad: 'alta'
      });
    } else if (ticket.tiempo_transcurrido_minutos > 45) {
      alertas.push({
        tipo: 'tiempo',
        mensaje: 'Ticket lleva más de 45 minutos abierto',
        severidad: 'media'
      });
    }

    // Alerta por estado de cocina
    if (ticket.estado_cocina === 'LISTO' && ticket.estado_venta === 'ABIERTA') {
      alertas.push({
        tipo: 'cocina',
        mensaje: 'Pedido listo para entregar',
        severidad: 'media'
      });
    }

    // Alerta por total alto
    if (parseFloat(ticket.total_final) > 50000) {
      alertas.push({
        tipo: 'monto',
        mensaje: 'Ticket de alto valor',
        severidad: 'baja'
      });
    }

    return alertas;
  }

  /**
   * Formatear tiempo en minutos a horas:minutos
   */
  formatearTiempo(minutos) {
    if (!minutos) return '0m';

    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;

    if (horas > 0) {
      return `${horas}h ${mins}m`;
    }
    return `${mins}m`;
  }

  /**
   * Generar resumen de cocina
   */
  generarResumenCocina(items) {
    const resumen = {
      total_items: items.length,
      pendientes: items.filter(i => i.estado_preparacion === 'PENDIENTE').length,
      en_preparacion: items.filter(i => i.estado_preparacion === 'EN_PREPARACION').length,
      listos: items.filter(i => i.estado_preparacion === 'LISTO').length,
      entregados: items.filter(i => i.estado_preparacion === 'ENTREGADO').length
    };

    resumen.completado_porcentaje = resumen.total_items > 0
      ? Math.round((resumen.entregados / resumen.total_items) * 100)
      : 0;

    return resumen;
  }
}

module.exports = TicketsService;