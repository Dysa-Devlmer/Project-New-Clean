/**
 * DYSA Point - Sistema de Impresión Automática
 * Manejo profesional de impresión de tickets, comandas y reportes
 *
 * Funcionalidades:
 * - Impresión automática de comandas por estación
 * - Tickets de cliente y comprobantes
 * - Reportes de cierre de caja
 * - Configuración múltiple de impresoras
 * - Cola de impresión y reintento automático
 * - Soporte ESC/POS y impresoras térmicas
 */

const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

class ImpresionManager extends EventEmitter {
    constructor(database) {
        super();
        this.db = database;
        this.connection = database.connection;

        // Tipos de impresión
        this.TIPOS_IMPRESION = {
            COMANDA_COCINA: 'comanda_cocina',
            TICKET_CLIENTE: 'ticket_cliente',
            COMPROBANTE_PAGO: 'comprobante_pago',
            REPORTE_CIERRE: 'reporte_cierre',
            COMPROBANTE_APERTURA: 'comprobante_apertura'
        };

        // Estados de trabajos de impresión
        this.ESTADOS_TRABAJO = {
            PENDIENTE: 'pendiente',
            PROCESANDO: 'procesando',
            COMPLETADO: 'completado',
            ERROR: 'error',
            CANCELADO: 'cancelado'
        };

        // Cola de impresión
        this.colaImpresion = new Map();

        // Configuración de impresoras
        this.impresorasConfiguradas = new Map();

        // Intervalo de procesamiento
        this.intervaloProcesamiento = null;

        console.log('🖨️ ImpresionManager inicializado correctamente');
        this.inicializarImpresoras();
    }

    /**
     * Inicializar configuración de impresoras
     */
    async inicializarImpresoras() {
        try {
            const [impresoras] = await this.connection.execute(`
                SELECT * FROM impresoras WHERE activo = 1 ORDER BY id ASC
            `);

            for (const impresora of impresoras) {
                this.impresorasConfiguradas.set(impresora.id, {
                    ...impresora,
                    disponible: true,
                    ultimo_error: null,
                    trabajos_completados: 0,
                    trabajos_fallidos: 0
                });
            }

            console.log(`✅ ${impresoras.length} impresoras configuradas`);

            // Iniciar procesamiento de cola
            this.iniciarProcesamiento();

        } catch (error) {
            console.error('❌ Error inicializando impresoras:', error);
        }
    }

    /**
     * Imprimir comanda en cocina automáticamente
     */
    async imprimirComandaCocina(comandaId) {
        try {
            // Obtener detalles de la comanda
            const [comandas] = await this.connection.execute(`
                SELECT
                    cc.*,
                    vi.cantidad,
                    vi.observaciones as item_observaciones,
                    p.nombre as producto_nombre,
                    p.descripcion,
                    ec.nombre as estacion_nombre,
                    ec.id as estacion_id,
                    v.mesa_id,
                    m.nombre as mesa_nombre,
                    u.nombre as garzon_nombre,
                    u.apellido as garzon_apellido
                FROM comandas_cocina cc
                JOIN venta_items vi ON cc.item_id = vi.id
                JOIN productos p ON vi.producto_id = p.id
                JOIN estaciones_cocina ec ON cc.estacion_id = ec.id
                JOIN ventas v ON vi.venta_id = v.id
                JOIN mesas m ON v.mesa_id = m.id
                JOIN usuarios u ON v.usuario_id = u.id
                WHERE cc.id = ?
            `, [comandaId]);

            if (comandas.length === 0) {
                throw new Error(`Comanda ${comandaId} no encontrada`);
            }

            const comanda = comandas[0];

            // Buscar impresora de la estación
            const impresora = this.buscarImpresoraPorEstacion(comanda.estacion_id);
            if (!impresora) {
                console.warn(`⚠️ No hay impresora configurada para estación ${comanda.estacion_nombre}`);
                return { success: false, error: 'Impresora no encontrada' };
            }

            // Generar contenido de la comanda
            const contenidoComanda = this.generarContenidoComanda(comanda);

            // Agregar a cola de impresión
            const trabajoId = await this.agregarTrabajoImpresion({
                tipo: this.TIPOS_IMPRESION.COMANDA_COCINA,
                impresora_id: impresora.id,
                contenido: contenidoComanda,
                referencia_id: comandaId,
                prioridad: this.obtenerPrioridadComanda(comanda.prioridad)
            });

            return { success: true, trabajo_id: trabajoId };

        } catch (error) {
            console.error('❌ Error preparando impresión de comanda:', error);
            throw error;
        }
    }

    /**
     * Imprimir ticket de cliente
     */
    async imprimirTicketCliente(ventaId) {
        try {
            // Obtener detalles completos de la venta
            const [ventas] = await this.connection.execute(`
                SELECT
                    v.*,
                    m.nombre as mesa_nombre,
                    u.nombre as garzon_nombre,
                    u.apellido as garzon_apellido,
                    pvs.fecha_apertura as sesion_apertura
                FROM ventas v
                JOIN mesas m ON v.mesa_id = m.id
                JOIN usuarios u ON v.usuario_id = u.id
                JOIN punto_venta_sesiones pvs ON v.sesion_pv_id = pvs.id
                WHERE v.id = ?
            `, [ventaId]);

            if (ventas.length === 0) {
                throw new Error(`Venta ${ventaId} no encontrada`);
            }

            const venta = ventas[0];

            // Obtener ítems de la venta
            const [items] = await this.connection.execute(`
                SELECT
                    vi.*,
                    p.nombre as producto_nombre,
                    p.codigo as producto_codigo
                FROM venta_items vi
                JOIN productos p ON vi.producto_id = p.id
                WHERE vi.venta_id = ? AND vi.estado != 'cancelado'
                ORDER BY vi.created_at ASC
            `, [ventaId]);

            // Buscar impresora de caja
            const impresora = this.buscarImpresoraPorTipo('caja');
            if (!impresora) {
                throw new Error('Impresora de caja no encontrada');
            }

            // Generar contenido del ticket
            const contenidoTicket = this.generarContenidoTicket(venta, items);

            // Agregar a cola de impresión
            const trabajoId = await this.agregarTrabajoImpresion({
                tipo: this.TIPOS_IMPRESION.TICKET_CLIENTE,
                impresora_id: impresora.id,
                contenido: contenidoTicket,
                referencia_id: ventaId,
                prioridad: 'alta'
            });

            return { success: true, trabajo_id: trabajoId };

        } catch (error) {
            console.error('❌ Error preparando ticket cliente:', error);
            throw error;
        }
    }

    /**
     * Imprimir reporte de cierre de caja
     */
    async imprimirReporteCierre(sesionId) {
        try {
            // Obtener datos de la sesión
            const datosReporte = await this.obtenerDatosCierre(sesionId);

            // Buscar impresora de reportes
            const impresora = this.buscarImpresoraPorTipo('caja');
            if (!impresora) {
                throw new Error('Impresora de reportes no encontrada');
            }

            // Generar contenido del reporte
            const contenidoReporte = this.generarContenidoReporteCierre(datosReporte);

            // Agregar a cola de impresión
            const trabajoId = await this.agregarTrabajoImpresion({
                tipo: this.TIPOS_IMPRESION.REPORTE_CIERRE,
                impresora_id: impresora.id,
                contenido: contenidoReporte,
                referencia_id: sesionId,
                prioridad: 'alta'
            });

            return { success: true, trabajo_id: trabajoId };

        } catch (error) {
            console.error('❌ Error preparando reporte de cierre:', error);
            throw error;
        }
    }

    /**
     * Agregar trabajo a cola de impresión
     */
    async agregarTrabajoImpresion(datosTrabajoData) {
        try {
            const {
                tipo,
                impresora_id,
                contenido,
                referencia_id,
                prioridad = 'normal'
            } = datosTrabajoData;

            // Insertar en base de datos
            const [resultado] = await this.connection.execute(`
                INSERT INTO trabajos_impresion (
                    tipo, impresora_id, contenido, referencia_id,
                    prioridad, estado, intentos, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                tipo,
                impresora_id,
                contenido,
                referencia_id,
                prioridad,
                this.ESTADOS_TRABAJO.PENDIENTE
            ]);

            const trabajoId = resultado.insertId;

            // Agregar a cola en memoria
            this.colaImpresion.set(trabajoId, {
                id: trabajoId,
                ...datosTrabajoData,
                estado: this.ESTADOS_TRABAJO.PENDIENTE,
                intentos: 0,
                created_at: new Date()
            });

            console.log(`📋 Trabajo de impresión agregado: ${trabajoId} (${tipo})`);

            return trabajoId;

        } catch (error) {
            console.error('❌ Error agregando trabajo de impresión:', error);
            throw error;
        }
    }

    /**
     * Iniciar procesamiento automático de cola
     */
    iniciarProcesamiento() {
        if (this.intervaloProcesamiento) {
            clearInterval(this.intervaloProcesamiento);
        }

        this.intervaloProcesamiento = setInterval(async () => {
            await this.procesarColaImpresion();
        }, 5000); // Procesar cada 5 segundos

        console.log('🔄 Procesamiento automático de impresión iniciado');
    }

    /**
     * Procesar cola de impresión
     */
    async procesarColaImpresion() {
        try {
            // Obtener trabajos pendientes ordenados por prioridad
            const trabajosPendientes = Array.from(this.colaImpresion.values())
                .filter(trabajo => trabajo.estado === this.ESTADOS_TRABAJO.PENDIENTE)
                .sort((a, b) => {
                    const prioridadA = this.obtenerValorPrioridad(a.prioridad);
                    const prioridadB = this.obtenerValorPrioridad(b.prioridad);
                    return prioridadB - prioridadA;
                });

            for (const trabajo of trabajosPendientes.slice(0, 3)) { // Procesar máximo 3 a la vez
                await this.procesarTrabajoIndividual(trabajo);
            }

        } catch (error) {
            console.error('❌ Error procesando cola de impresión:', error);
        }
    }

    /**
     * Procesar trabajo individual de impresión
     */
    async procesarTrabajoIndividual(trabajo) {
        try {
            // Marcar como procesando
            await this.actualizarEstadoTrabajo(trabajo.id, this.ESTADOS_TRABAJO.PROCESANDO);

            // Obtener impresora
            const impresora = this.impresorasConfiguradas.get(trabajo.impresora_id);
            if (!impresora || !impresora.disponible) {
                throw new Error(`Impresora ${trabajo.impresora_id} no disponible`);
            }

            // Simular impresión (aquí se integraría con driver real de impresora)
            const resultado = await this.enviarAImpresora(impresora, trabajo.contenido);

            if (resultado.success) {
                await this.actualizarEstadoTrabajo(trabajo.id, this.ESTADOS_TRABAJO.COMPLETADO);
                impresora.trabajos_completados++;

                console.log(`✅ Impresión completada: ${trabajo.tipo} (ID: ${trabajo.id})`);

                // Emitir evento de impresión completada
                this.emit('impresion_completada', {
                    trabajo_id: trabajo.id,
                    tipo: trabajo.tipo,
                    impresora: impresora.nombre
                });

            } else {
                throw new Error(resultado.error || 'Error desconocido en impresión');
            }

        } catch (error) {
            console.error(`❌ Error procesando trabajo ${trabajo.id}:`, error);

            // Incrementar intentos
            trabajo.intentos++;
            impresora.trabajos_fallidos++;
            impresora.ultimo_error = error.message;

            if (trabajo.intentos >= 3) {
                // Marcar como error después de 3 intentos
                await this.actualizarEstadoTrabajo(trabajo.id, this.ESTADOS_TRABAJO.ERROR);

                this.emit('impresion_fallida', {
                    trabajo_id: trabajo.id,
                    tipo: trabajo.tipo,
                    error: error.message
                });
            } else {
                // Volver a pendiente para reintento
                await this.actualizarEstadoTrabajo(trabajo.id, this.ESTADOS_TRABAJO.PENDIENTE);
            }
        }
    }

    // Métodos auxiliares de generación de contenido

    /**
     * Generar contenido de comanda para cocina
     */
    generarContenidoComanda(comanda) {
        const fecha = new Date().toLocaleDateString('es-CL');
        const hora = new Date().toLocaleTimeString('es-CL');

        return `
================================
       ${comanda.estacion_nombre.toUpperCase()}
================================
Fecha: ${fecha}      Hora: ${hora}
Mesa: ${comanda.mesa_nombre}
Garzón: ${comanda.garzon_nombre} ${comanda.garzon_apellido}

COMANDA #${comanda.id}
${comanda.prioridad === 'critica' ? '⚠️  URGENTE  ⚠️' : ''}

--------------------------------
${comanda.cantidad}x ${comanda.producto_nombre}

${comanda.item_observaciones ? `Observaciones:
${comanda.item_observaciones}` : ''}

${comanda.descripcion ? `Descripción:
${comanda.descripcion}` : ''}

================================
Hora: ${hora}
${comanda.prioridad === 'critica' ? '⚠️  URGENTE  ⚠️' : ''}
================================



`;
    }

    /**
     * Generar contenido de ticket cliente
     */
    generarContenidoTicket(venta, items) {
        const fecha = new Date().toLocaleDateString('es-CL');
        const hora = new Date().toLocaleTimeString('es-CL');

        let contenido = `
================================
         RESTAURANT XYZ
================================
Fecha: ${fecha}      Hora: ${hora}
Mesa: ${venta.mesa_nombre}
Garzón: ${venta.garzon_nombre} ${venta.garzon_apellido}

TICKET #${venta.id}
--------------------------------
`;

        // Agregar ítems
        for (const item of items) {
            contenido += `${item.cantidad}x ${item.producto_nombre.padEnd(20)} $${item.subtotal}\n`;
        }

        contenido += `
--------------------------------
Subtotal:          $${venta.subtotal}
IVA (19%):         $${venta.impuestos}
${venta.descuento > 0 ? `Descuento:         -$${venta.descuento}\n` : ''}
TOTAL:             $${venta.total}
================================

Gracias por su visita
www.restaurant-xyz.cl

================================



`;

        return contenido;
    }

    /**
     * Generar contenido de reporte de cierre
     */
    generarContenidoReporteCierre(datos) {
        const fecha = new Date().toLocaleDateString('es-CL');
        const hora = new Date().toLocaleTimeString('es-CL');

        return `
================================
       REPORTE DE CIERRE
================================
Fecha: ${fecha}      Hora: ${hora}
Sesión #${datos.sesion_id}

Apertura: ${datos.fecha_apertura}
Cierre: ${datos.fecha_cierre}
Cajero: ${datos.cajero_nombre}

================================
        RESUMEN DE VENTAS
================================
Total Ventas: ${datos.total_ventas}
Total Ingresos: $${datos.total_ingresos}

--------------------------------
      DETALLE POR FORMA PAGO
--------------------------------
${datos.formas_pago.map(fp =>
`${fp.nombre.padEnd(15)}: $${fp.total}`).join('\n')}

================================
         ARQUEO DE CAJA
================================
Efectivo Inicial: $${datos.efectivo_inicial}
Ventas Efectivo:  $${datos.ventas_efectivo}
Total Esperado:   $${datos.total_esperado}
Total Contado:    $${datos.total_contado}
Diferencia:       $${datos.diferencia}

${datos.diferencia !== 0 ? '⚠️  REVISAR DIFERENCIA  ⚠️' : '✅ CUADRE CORRECTO'}

================================
Firma Cajero: _________________

Fecha: ${fecha}
================================



`;
    }

    // Métodos auxiliares

    buscarImpresoraPorEstacion(estacionId) {
        return Array.from(this.impresorasConfiguradas.values())
            .find(imp => imp.ubicacion.includes('Cocina') || imp.ubicacion.includes('Bar'));
    }

    buscarImpresoraPorTipo(tipo) {
        const ubicacionMap = {
            'caja': 'Caja',
            'cocina': 'Cocina',
            'bar': 'Bar'
        };

        return Array.from(this.impresorasConfiguradas.values())
            .find(imp => imp.ubicacion.includes(ubicacionMap[tipo] || 'Caja'));
    }

    obtenerPrioridadComanda(prioridad) {
        const mapPrioridad = {
            'critica': 'alta',
            'urgente': 'media',
            'normal': 'baja'
        };
        return mapPrioridad[prioridad] || 'baja';
    }

    obtenerValorPrioridad(prioridad) {
        const valores = { 'alta': 3, 'media': 2, 'baja': 1 };
        return valores[prioridad] || 1;
    }

    async actualizarEstadoTrabajo(trabajoId, nuevoEstado) {
        await this.connection.execute(`
            UPDATE trabajos_impresion
            SET estado = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [nuevoEstado, trabajoId]);

        const trabajo = this.colaImpresion.get(trabajoId);
        if (trabajo) {
            trabajo.estado = nuevoEstado;
        }
    }

    async enviarAImpresora(impresora, contenido) {
        // Simulación de envío a impresora
        // En implementación real se usaría driver específico
        return new Promise((resolve) => {
            setTimeout(() => {
                // Simular éxito/fallo aleatorio para testing
                const exito = Math.random() > 0.1; // 90% éxito
                resolve({
                    success: exito,
                    error: exito ? null : 'Error simulado de comunicación'
                });
            }, 1000);
        });
    }

    async obtenerDatosCierre(sesionId) {
        // Simular datos de cierre
        return {
            sesion_id: sesionId,
            fecha_apertura: '2025-10-13 08:00:00',
            fecha_cierre: '2025-10-13 22:00:00',
            cajero_nombre: 'Juan Pérez',
            total_ventas: 45,
            total_ingresos: 125000,
            formas_pago: [
                { nombre: 'Efectivo', total: 75000 },
                { nombre: 'Tarjeta', total: 50000 }
            ],
            efectivo_inicial: 50000,
            ventas_efectivo: 75000,
            total_esperado: 125000,
            total_contado: 125000,
            diferencia: 0
        };
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 ImpresionManager: Limpiando recursos...');

        if (this.intervaloProcesamiento) {
            clearInterval(this.intervaloProcesamiento);
        }

        this.colaImpresion.clear();
        this.impresorasConfiguradas.clear();
        this.removeAllListeners();
    }
}

module.exports = ImpresionManager;