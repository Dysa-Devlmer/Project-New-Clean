/**
 * DYSA Point - Sistema de Punto de Venta
 * Manejo profesional de apertura/cierre de caja y sesiones de venta
 *
 * Funcionalidades:
 * - Apertura de punto de venta con conteo inicial
 * - Cierre de punto de venta con cuadre de caja
 * - Manejo de efectivo, tarjetas y otras formas de pago
 * - Reportes de sesión en tiempo real
 * - Control de múltiples cajas (si aplica)
 * - Auditoria completa de operaciones
 */

class PuntoVentaManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.activeSessions = new Map(); // Sesiones activas en memoria
    }

    /**
     * Abrir punto de venta
     */
    async abrirPuntoVenta(cajeroId, datosApertura) {
        const connection = await this.db.connection.beginTransaction();

        try {
            console.log(`🔓 Abriendo punto de venta - Cajero: ${cajeroId}`);

            const {
                cajaId = 1, // ID de la caja física
                montoInicialEfectivo,
                observacionesApertura = '',
                billetes = {}, // Detalle de billetes por denominación
                monedas = {}, // Detalle de monedas por denominación
                turno = 'MAÑANA' // MAÑANA, TARDE, NOCHE
            } = datosApertura;

            // Validaciones
            if (!cajeroId || montoInicialEfectivo < 0) {
                throw new Error('Datos de apertura inválidos');
            }

            // Verificar que no haya una sesión activa en esta caja
            const [sesionActiva] = await connection.execute(`
                SELECT id FROM punto_venta_sesiones
                WHERE caja_id = ? AND estado = 'ABIERTA'
            `, [cajaId]);

            if (sesionActiva.length > 0) {
                throw new Error('Ya existe una sesión activa en esta caja');
            }

            // Verificar que el cajero no tenga otra sesión abierta
            const [cajeroConSesion] = await connection.execute(`
                SELECT id FROM punto_venta_sesiones
                WHERE cajero_id = ? AND estado = 'ABIERTA'
            `, [cajeroId]);

            if (cajeroConSesion.length > 0) {
                throw new Error('El cajero ya tiene una sesión abierta');
            }

            // Obtener información del cajero
            const [cajero] = await connection.execute(`
                SELECT u.nombre, u.apellido, r.nombre as role_nombre
                FROM usuarios u
                INNER JOIN roles r ON u.role_id = r.id
                WHERE u.id = ?
            `, [cajeroId]);

            if (cajero.length === 0) {
                throw new Error('Cajero no encontrado');
            }

            // Crear nueva sesión de punto de venta
            const [sesionResult] = await connection.execute(`
                INSERT INTO punto_venta_sesiones (
                    caja_id, cajero_id, turno, estado,
                    fecha_apertura, hora_apertura,
                    monto_inicial_efectivo, observaciones_apertura,
                    created_at, updated_at
                ) VALUES (?, ?, ?, 'ABIERTA', CURDATE(), CURTIME(), ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [cajaId, cajeroId, turno, montoInicialEfectivo, observacionesApertura]);

            const sesionId = sesionResult.insertId;

            // Registrar detalle de efectivo inicial (billetes y monedas)
            await this.registrarDetalleEfectivo(connection, sesionId, 'APERTURA', billetes, monedas);

            // Registrar movimiento de caja inicial
            await connection.execute(`
                INSERT INTO movimientos_caja (
                    sesion_id, tipo_movimiento, monto, forma_pago,
                    descripcion, cajero_id, fecha, hora
                ) VALUES (?, 'APERTURA', ?, 'efectivo', 'Apertura de punto de venta', ?, CURDATE(), CURTIME())
            `, [sesionId, montoInicialEfectivo, cajeroId]);

            // Actualizar estado de la caja
            await connection.execute(`
                UPDATE cajas SET
                    estado = 'ABIERTA',
                    sesion_activa_id = ?,
                    cajero_actual_id = ?,
                    ultimo_movimiento = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [sesionId, cajeroId, cajaId]);

            await connection.commit();

            // Guardar en memoria para acceso rápido
            const sesionData = {
                id: sesionId,
                cajaId,
                cajeroId,
                cajeroNombre: `${cajero[0].nombre} ${cajero[0].apellido}`,
                turno,
                fechaApertura: new Date().toISOString().split('T')[0],
                horaApertura: new Date().toLocaleTimeString(),
                montoInicialEfectivo,
                ventasDelDia: 0,
                totalEfectivo: montoInicialEfectivo,
                totalTarjetas: 0,
                totalOtrasFormas: 0,
                estado: 'ABIERTA'
            };

            this.activeSessions.set(sesionId, sesionData);

            console.log(`✅ Punto de venta abierto - Sesión: ${sesionId}`);

            return {
                success: true,
                sesion: sesionData,
                message: 'Punto de venta abierto exitosamente'
            };

        } catch (error) {
            await connection.rollback();
            console.error('❌ Error abriendo punto de venta:', error);
            throw error;
        }
    }

    /**
     * Cerrar punto de venta
     */
    async cerrarPuntoVenta(sesionId, datosCierre) {
        const connection = await this.db.connection.beginTransaction();

        try {
            console.log(`🔒 Cerrando punto de venta - Sesión: ${sesionId}`);

            const {
                montoFinalEfectivo,
                billetes = {},
                monedas = {},
                observacionesCierre = '',
                forzarCierre = false
            } = datosCierre;

            // Obtener información de la sesión
            const [sesion] = await connection.execute(`
                SELECT s.*, u.nombre as cajero_nombre, u.apellido as cajero_apellido,
                       c.nombre as caja_nombre
                FROM punto_venta_sesiones s
                INNER JOIN usuarios u ON s.cajero_id = u.id
                INNER JOIN cajas c ON s.caja_id = c.id
                WHERE s.id = ? AND s.estado = 'ABIERTA'
            `, [sesionId]);

            if (sesion.length === 0) {
                throw new Error('Sesión no encontrada o ya cerrada');
            }

            const sesionData = sesion[0];

            // Calcular totales de ventas del día
            const totalesVentas = await this.calcularTotalesVentas(connection, sesionId);

            // Calcular movimientos de caja
            const movimientosCaja = await this.calcularMovimientosCaja(connection, sesionId);

            // Calcular diferencia en efectivo
            const efectivoEsperado = sesionData.monto_inicial_efectivo +
                                   totalesVentas.totalEfectivo +
                                   movimientosCaja.ingresosEfectivo -
                                   movimientosCaja.egresosEfectivo;

            const diferencia = montoFinalEfectivo - efectivoEsperado;

            // Verificar si hay diferencia significativa
            const tolerancia = 100; // $100 de tolerancia
            if (Math.abs(diferencia) > tolerancia && !forzarCierre) {
                return {
                    success: false,
                    requiresConfirmation: true,
                    diferencia,
                    efectivoEsperado,
                    montoFinalEfectivo,
                    message: `Diferencia de $${diferencia}. ¿Confirmar cierre?`,
                    detalle: {
                        montoInicial: sesionData.monto_inicial_efectivo,
                        ventasEfectivo: totalesVentas.totalEfectivo,
                        ingresos: movimientosCaja.ingresosEfectivo,
                        egresos: movimientosCaja.egresosEfectivo,
                        esperado: efectivoEsperado,
                        contado: montoFinalEfectivo
                    }
                };
            }

            // Registrar detalle de efectivo final
            await this.registrarDetalleEfectivo(connection, sesionId, 'CIERRE', billetes, monedas);

            // Actualizar sesión con datos de cierre
            await connection.execute(`
                UPDATE punto_venta_sesiones SET
                    estado = 'CERRADA',
                    fecha_cierre = CURDATE(),
                    hora_cierre = CURTIME(),
                    monto_final_efectivo = ?,
                    diferencia_efectivo = ?,
                    total_ventas_efectivo = ?,
                    total_ventas_tarjetas = ?,
                    total_ventas_otras = ?,
                    cantidad_ventas = ?,
                    observaciones_cierre = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                montoFinalEfectivo,
                diferencia,
                totalesVentas.totalEfectivo,
                totalesVentas.totalTarjetas,
                totalesVentas.totalOtrasFormas,
                totalesVentas.cantidadVentas,
                observacionesCierre,
                sesionId
            ]);

            // Registrar movimiento de cierre
            await connection.execute(`
                INSERT INTO movimientos_caja (
                    sesion_id, tipo_movimiento, monto, forma_pago,
                    descripcion, cajero_id, fecha, hora
                ) VALUES (?, 'CIERRE', ?, 'efectivo', 'Cierre de punto de venta', ?, CURDATE(), CURTIME())
            `, [sesionId, montoFinalEfectivo, sesionData.cajero_id]);

            // Actualizar estado de la caja
            await connection.execute(`
                UPDATE cajas SET
                    estado = 'CERRADA',
                    sesion_activa_id = NULL,
                    cajero_actual_id = NULL,
                    ultimo_movimiento = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [sesionData.caja_id]);

            // Generar reporte de cierre
            const reporteCierre = await this.generarReporteCierre(connection, sesionId);

            await connection.commit();

            // Remover de memoria
            this.activeSessions.delete(sesionId);

            console.log(`✅ Punto de venta cerrado - Sesión: ${sesionId}`);

            return {
                success: true,
                sesionId,
                diferencia,
                reporteCierre,
                message: 'Punto de venta cerrado exitosamente'
            };

        } catch (error) {
            await connection.rollback();
            console.error('❌ Error cerrando punto de venta:', error);
            throw error;
        }
    }

    /**
     * Obtener estado actual del punto de venta
     */
    async obtenerEstadoPuntoVenta(cajaId = 1) {
        try {
            const [sesion] = await this.db.connection.execute(`
                SELECT s.*, u.nombre as cajero_nombre, u.apellido as cajero_apellido,
                       c.nombre as caja_nombre, c.ubicacion as caja_ubicacion
                FROM punto_venta_sesiones s
                INNER JOIN usuarios u ON s.cajero_id = u.id
                INNER JOIN cajas c ON s.caja_id = c.id
                WHERE s.caja_id = ? AND s.estado = 'ABIERTA'
                ORDER BY s.fecha_apertura DESC, s.hora_apertura DESC
                LIMIT 1
            `, [cajaId]);

            if (sesion.length === 0) {
                return {
                    abierto: false,
                    sesion: null,
                    message: 'No hay sesión activa'
                };
            }

            const sesionData = sesion[0];

            // Obtener totales en tiempo real
            const totalesVentas = await this.calcularTotalesVentas(this.db.connection, sesionData.id);
            const movimientosCaja = await this.calcularMovimientosCaja(this.db.connection, sesionData.id);

            // Actualizar datos en memoria
            const estadoCompleto = {
                abierto: true,
                sesion: {
                    id: sesionData.id,
                    cajaId: sesionData.caja_id,
                    cajaNombre: sesionData.caja_nombre,
                    cajaUbicacion: sesionData.caja_ubicacion,
                    cajeroId: sesionData.cajero_id,
                    cajeroNombre: `${sesionData.cajero_nombre} ${sesionData.cajero_apellido}`,
                    turno: sesionData.turno,
                    fechaApertura: sesionData.fecha_apertura,
                    horaApertura: sesionData.hora_apertura,
                    montoInicialEfectivo: sesionData.monto_inicial_efectivo,
                    totales: {
                        ventasEfectivo: totalesVentas.totalEfectivo,
                        ventasTarjetas: totalesVentas.totalTarjetas,
                        ventasOtrasFormas: totalesVentas.totalOtrasFormas,
                        cantidadVentas: totalesVentas.cantidadVentas,
                        totalVentas: totalesVentas.totalGeneral
                    },
                    movimientos: {
                        ingresosEfectivo: movimientosCaja.ingresosEfectivo,
                        egresosEfectivo: movimientosCaja.egresosEfectivo,
                        saldoMovimientos: movimientosCaja.saldoNeto
                    },
                    efectivoActual: sesionData.monto_inicial_efectivo +
                                  totalesVentas.totalEfectivo +
                                  movimientosCaja.saldoNeto
                }
            };

            // Actualizar cache
            this.activeSessions.set(sesionData.id, estadoCompleto.sesion);

            return estadoCompleto;

        } catch (error) {
            console.error('❌ Error obteniendo estado del punto de venta:', error);
            throw error;
        }
    }

    /**
     * Registrar movimiento de caja (ingreso/egreso)
     */
    async registrarMovimientoCaja(sesionId, movimiento) {
        try {
            const {
                tipo, // 'INGRESO' o 'EGRESO'
                monto,
                formaPago = 'efectivo',
                descripcion,
                categoria = 'OTROS',
                referencia = '',
                cajeroId
            } = movimiento;

            // Validaciones
            if (!['INGRESO', 'EGRESO'].includes(tipo)) {
                throw new Error('Tipo de movimiento inválido');
            }

            if (monto <= 0) {
                throw new Error('El monto debe ser mayor a 0');
            }

            // Verificar que la sesión esté activa
            const [sesion] = await this.db.connection.execute(`
                SELECT id FROM punto_venta_sesiones
                WHERE id = ? AND estado = 'ABIERTA'
            `, [sesionId]);

            if (sesion.length === 0) {
                throw new Error('Sesión no encontrada o cerrada');
            }

            // Registrar movimiento
            const [result] = await this.db.connection.execute(`
                INSERT INTO movimientos_caja (
                    sesion_id, tipo_movimiento, monto, forma_pago,
                    descripcion, categoria, referencia, cajero_id,
                    fecha, hora, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), CURRENT_TIMESTAMP)
            `, [sesionId, tipo, monto, formaPago, descripcion, categoria, referencia, cajeroId]);

            console.log(`💰 Movimiento registrado - ${tipo}: $${monto} - ${descripcion}`);

            return {
                success: true,
                movimientoId: result.insertId,
                message: 'Movimiento registrado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error registrando movimiento:', error);
            throw error;
        }
    }

    /**
     * Métodos auxiliares
     */
    async calcularTotalesVentas(connection, sesionId) {
        const [totales] = await connection.execute(`
            SELECT
                COALESCE(SUM(CASE WHEN fp.tipo = 'efectivo' THEN vp.monto ELSE 0 END), 0) as total_efectivo,
                COALESCE(SUM(CASE WHEN fp.tipo = 'tarjeta' THEN vp.monto ELSE 0 END), 0) as total_tarjetas,
                COALESCE(SUM(CASE WHEN fp.tipo NOT IN ('efectivo', 'tarjeta') THEN vp.monto ELSE 0 END), 0) as total_otras,
                COUNT(DISTINCT v.id) as cantidad_ventas,
                COALESCE(SUM(vp.monto), 0) as total_general
            FROM ventas v
            INNER JOIN venta_pagos vp ON v.id = vp.venta_id
            INNER JOIN formas_pago fp ON vp.forma_pago_id = fp.id
            WHERE v.sesion_punto_venta_id = ? AND v.estado = 'COMPLETADA'
        `, [sesionId]);

        return {
            totalEfectivo: parseFloat(totales[0].total_efectivo || 0),
            totalTarjetas: parseFloat(totales[0].total_tarjetas || 0),
            totalOtrasFormas: parseFloat(totales[0].total_otras || 0),
            cantidadVentas: parseInt(totales[0].cantidad_ventas || 0),
            totalGeneral: parseFloat(totales[0].total_general || 0)
        };
    }

    async calcularMovimientosCaja(connection, sesionId) {
        const [movimientos] = await connection.execute(`
            SELECT
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'INGRESO' THEN monto ELSE 0 END), 0) as ingresos,
                COALESCE(SUM(CASE WHEN tipo_movimiento = 'EGRESO' THEN monto ELSE 0 END), 0) as egresos
            FROM movimientos_caja
            WHERE sesion_id = ? AND tipo_movimiento IN ('INGRESO', 'EGRESO')
        `, [sesionId]);

        const ingresos = parseFloat(movimientos[0].ingresos || 0);
        const egresos = parseFloat(movimientos[0].egresos || 0);

        return {
            ingresosEfectivo: ingresos,
            egresosEfectivo: egresos,
            saldoNeto: ingresos - egresos
        };
    }

    async registrarDetalleEfectivo(connection, sesionId, tipo, billetes, monedas) {
        // Registrar detalle de billetes
        for (const [denominacion, cantidad] of Object.entries(billetes)) {
            if (cantidad > 0) {
                await connection.execute(`
                    INSERT INTO detalle_efectivo_sesion (
                        sesion_id, tipo_operacion, tipo_denominacion,
                        denominacion, cantidad, total, created_at
                    ) VALUES (?, ?, 'BILLETE', ?, ?, ?, CURRENT_TIMESTAMP)
                `, [sesionId, tipo, denominacion, cantidad, denominacion * cantidad]);
            }
        }

        // Registrar detalle de monedas
        for (const [denominacion, cantidad] of Object.entries(monedas)) {
            if (cantidad > 0) {
                await connection.execute(`
                    INSERT INTO detalle_efectivo_sesion (
                        sesion_id, tipo_operacion, tipo_denominacion,
                        denominacion, cantidad, total, created_at
                    ) VALUES (?, ?, 'MONEDA', ?, ?, ?, CURRENT_TIMESTAMP)
                `, [sesionId, tipo, denominacion, cantidad, denominacion * cantidad]);
            }
        }
    }

    async generarReporteCierre(connection, sesionId) {
        // Obtener datos completos de la sesión
        const [sesion] = await connection.execute(`
            SELECT s.*, u.nombre as cajero_nombre, u.apellido as cajero_apellido,
                   c.nombre as caja_nombre
            FROM punto_venta_sesiones s
            INNER JOIN usuarios u ON s.cajero_id = u.id
            INNER JOIN cajas c ON s.caja_id = c.id
            WHERE s.id = ?
        `, [sesionId]);

        // Obtener ventas del día
        const [ventas] = await connection.execute(`
            SELECT v.*, m.numero as mesa_numero
            FROM ventas v
            LEFT JOIN mesas m ON v.mesa_id = m.id
            WHERE v.sesion_punto_venta_id = ?
            ORDER BY v.fecha DESC, v.hora DESC
        `, [sesionId]);

        // Obtener movimientos de caja
        const [movimientos] = await connection.execute(`
            SELECT * FROM movimientos_caja
            WHERE sesion_id = ?
            ORDER BY fecha DESC, hora DESC
        `, [sesionId]);

        return {
            sesion: sesion[0],
            ventas,
            movimientos,
            generadoEn: new Date().toISOString()
        };
    }

    /**
     * Obtener sesiones del punto de venta (historial)
     */
    async obtenerHistorialSesiones(filtros = {}) {
        try {
            const {
                fechaDesde,
                fechaHasta,
                cajaId,
                cajeroId,
                limite = 50
            } = filtros;

            let whereClause = 'WHERE 1=1';
            const params = [];

            if (fechaDesde) {
                whereClause += ' AND s.fecha_apertura >= ?';
                params.push(fechaDesde);
            }

            if (fechaHasta) {
                whereClause += ' AND s.fecha_apertura <= ?';
                params.push(fechaHasta);
            }

            if (cajaId) {
                whereClause += ' AND s.caja_id = ?';
                params.push(cajaId);
            }

            if (cajeroId) {
                whereClause += ' AND s.cajero_id = ?';
                params.push(cajeroId);
            }

            params.push(limite);

            const [sesiones] = await this.db.connection.execute(`
                SELECT s.*, u.nombre as cajero_nombre, u.apellido as cajero_apellido,
                       c.nombre as caja_nombre
                FROM punto_venta_sesiones s
                INNER JOIN usuarios u ON s.cajero_id = u.id
                INNER JOIN cajas c ON s.caja_id = c.id
                ${whereClause}
                ORDER BY s.fecha_apertura DESC, s.hora_apertura DESC
                LIMIT ?
            `, params);

            return {
                success: true,
                sesiones,
                total: sesiones.length
            };

        } catch (error) {
            console.error('❌ Error obteniendo historial:', error);
            throw error;
        }
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        this.activeSessions.clear();
        console.log('🧹 Limpieza de PuntoVentaManager completada');
    }
}

module.exports = PuntoVentaManager;