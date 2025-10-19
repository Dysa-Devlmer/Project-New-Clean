/**
 * DYSA Point - Rutas de Punto de Venta
 * API endpoints para manejo de apertura/cierre de caja y operaciones de punto de venta
 *
 * Endpoints incluidos:
 * - POST /abrir - Abrir punto de venta
 * - POST /cerrar - Cerrar punto de venta
 * - GET /estado - Estado actual del punto de venta
 * - POST /movimiento - Registrar movimiento de caja
 * - GET /historial - Historial de sesiones
 * - GET /reporte/:id - Reporte de sesión específica
 */

const express = require('express');
const router = express.Router();

class PuntoVentaRoutes {
    constructor(puntoVentaManager, garzonAuthManager, databaseManager) {
        this.puntoVenta = puntoVentaManager;
        this.garzonAuth = garzonAuthManager;
        this.db = databaseManager;
        this.setupRoutes();
    }

    setupRoutes() {
        /**
         * POST /punto-venta/abrir
         * Abrir punto de venta con conteo inicial
         */
        router.post('/abrir', this.garzonAuth.validateGarzonMiddleware('abrir_caja'), async (req, res) => {
            try {
                const {
                    cajaId = 1,
                    montoInicialEfectivo,
                    observacionesApertura,
                    billetes = {},
                    monedas = {},
                    turno = 'MAÑANA'
                } = req.body;

                // Validaciones
                if (typeof montoInicialEfectivo !== 'number' || montoInicialEfectivo < 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Monto inicial de efectivo inválido',
                        code: 'INVALID_INITIAL_AMOUNT'
                    });
                }

                // Validar que el garzón tenga permisos de cajero
                if (!['CAJERO', 'ADMIN', 'JEFE_GARZON'].includes(req.garzon.role.codigo)) {
                    return res.status(403).json({
                        success: false,
                        error: 'Solo cajeros pueden abrir punto de venta',
                        code: 'INSUFFICIENT_ROLE'
                    });
                }

                const datosApertura = {
                    cajaId,
                    montoInicialEfectivo,
                    observacionesApertura,
                    billetes,
                    monedas,
                    turno
                };

                const result = await this.puntoVenta.abrirPuntoVenta(req.garzon.id, datosApertura);

                res.json({
                    success: true,
                    message: 'Punto de venta abierto exitosamente',
                    sesion: result.sesion,
                    cajero: {
                        id: req.garzon.id,
                        nombre: req.garzon.nombreCompleto
                    }
                });

            } catch (error) {
                console.error('❌ Error abriendo punto de venta:', error);

                if (error.message.includes('sesión activa')) {
                    return res.status(409).json({
                        success: false,
                        error: error.message,
                        code: 'SESSION_ALREADY_EXISTS'
                    });
                }

                res.status(500).json({
                    success: false,
                    error: 'Error abriendo punto de venta',
                    code: 'OPEN_POS_ERROR'
                });
            }
        });

        /**
         * POST /punto-venta/cerrar
         * Cerrar punto de venta con cuadre de caja
         */
        router.post('/cerrar', this.garzonAuth.validateGarzonMiddleware('cerrar_caja'), async (req, res) => {
            try {
                const {
                    sesionId,
                    montoFinalEfectivo,
                    billetes = {},
                    monedas = {},
                    observacionesCierre,
                    forzarCierre = false
                } = req.body;

                // Validaciones
                if (!sesionId) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de sesión requerido',
                        code: 'MISSING_SESSION_ID'
                    });
                }

                if (typeof montoFinalEfectivo !== 'number' || montoFinalEfectivo < 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Monto final de efectivo inválido',
                        code: 'INVALID_FINAL_AMOUNT'
                    });
                }

                // Verificar que el garzón sea el mismo que abrió la sesión o sea administrador
                const [sesion] = await this.db.connection.execute(`
                    SELECT cajero_id FROM punto_venta_sesiones WHERE id = ? AND estado = 'ABIERTA'
                `, [sesionId]);

                if (sesion.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Sesión no encontrada o ya cerrada',
                        code: 'SESSION_NOT_FOUND'
                    });
                }

                const puedeModificar = req.garzon.id === sesion[0].cajero_id ||
                                     ['ADMIN', 'JEFE_GARZON'].includes(req.garzon.role.codigo);

                if (!puedeModificar) {
                    return res.status(403).json({
                        success: false,
                        error: 'Solo el cajero que abrió la sesión puede cerrarla',
                        code: 'UNAUTHORIZED_CLOSE'
                    });
                }

                const datosCierre = {
                    montoFinalEfectivo,
                    billetes,
                    monedas,
                    observacionesCierre,
                    forzarCierre
                };

                const result = await this.puntoVenta.cerrarPuntoVenta(sesionId, datosCierre);

                if (!result.success && result.requiresConfirmation) {
                    return res.status(422).json(result);
                }

                res.json({
                    success: true,
                    message: 'Punto de venta cerrado exitosamente',
                    sesionId: result.sesionId,
                    diferencia: result.diferencia,
                    reporte: result.reporteCierre
                });

            } catch (error) {
                console.error('❌ Error cerrando punto de venta:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error cerrando punto de venta',
                    code: 'CLOSE_POS_ERROR'
                });
            }
        });

        /**
         * GET /punto-venta/estado/:cajaId?
         * Obtener estado actual del punto de venta
         */
        router.get('/estado/:cajaId?', async (req, res) => {
            try {
                const cajaId = req.params.cajaId ? parseInt(req.params.cajaId) : 1;

                const estado = await this.puntoVenta.obtenerEstadoPuntoVenta(cajaId);

                res.json({
                    success: true,
                    cajaId,
                    ...estado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error obteniendo estado:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo estado del punto de venta',
                    code: 'GET_STATUS_ERROR'
                });
            }
        });

        /**
         * POST /punto-venta/movimiento
         * Registrar movimiento de caja (ingreso/egreso)
         */
        router.post('/movimiento', this.garzonAuth.validateGarzonMiddleware('caja.mover'), async (req, res) => {
            try {
                const {
                    sesionId,
                    tipo, // 'INGRESO' o 'EGRESO'
                    monto,
                    formaPago = 'efectivo',
                    descripcion,
                    categoria = 'OTROS',
                    referencia
                } = req.body;

                // Validaciones
                if (!sesionId || !tipo || !monto || !descripcion) {
                    return res.status(400).json({
                        success: false,
                        error: 'Datos incompletos para el movimiento',
                        code: 'INCOMPLETE_MOVEMENT_DATA'
                    });
                }

                if (!['INGRESO', 'EGRESO'].includes(tipo)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tipo de movimiento inválido',
                        code: 'INVALID_MOVEMENT_TYPE'
                    });
                }

                if (typeof monto !== 'number' || monto <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Monto inválido',
                        code: 'INVALID_AMOUNT'
                    });
                }

                const movimiento = {
                    tipo,
                    monto,
                    formaPago,
                    descripcion,
                    categoria,
                    referencia,
                    cajeroId: req.garzon.id
                };

                const result = await this.puntoVenta.registrarMovimientoCaja(sesionId, movimiento);

                res.json({
                    success: true,
                    message: 'Movimiento registrado exitosamente',
                    movimientoId: result.movimientoId,
                    cajero: {
                        id: req.garzon.id,
                        nombre: req.garzon.nombreCompleto
                    }
                });

            } catch (error) {
                console.error('❌ Error registrando movimiento:', error);

                if (error.message.includes('Sesión no encontrada')) {
                    return res.status(404).json({
                        success: false,
                        error: error.message,
                        code: 'SESSION_NOT_FOUND'
                    });
                }

                res.status(500).json({
                    success: false,
                    error: 'Error registrando movimiento',
                    code: 'REGISTER_MOVEMENT_ERROR'
                });
            }
        });

        /**
         * GET /punto-venta/historial
         * Obtener historial de sesiones
         */
        router.get('/historial', this.garzonAuth.validateGarzonMiddleware('ver_reportes'), async (req, res) => {
            try {
                const {
                    fechaDesde,
                    fechaHasta,
                    cajaId,
                    cajeroId,
                    limite = 50
                } = req.query;

                const filtros = {
                    fechaDesde,
                    fechaHasta,
                    cajaId: cajaId ? parseInt(cajaId) : undefined,
                    cajeroId: cajeroId ? parseInt(cajeroId) : undefined,
                    limite: Math.min(parseInt(limite) || 50, 200) // máximo 200
                };

                const result = await this.puntoVenta.obtenerHistorialSesiones(filtros);

                res.json({
                    success: true,
                    ...result,
                    filtros
                });

            } catch (error) {
                console.error('❌ Error obteniendo historial:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo historial',
                    code: 'GET_HISTORY_ERROR'
                });
            }
        });

        /**
         * GET /punto-venta/reporte/:sesionId
         * Obtener reporte detallado de una sesión
         */
        router.get('/reporte/:sesionId', this.garzonAuth.validateGarzonMiddleware('ver_reportes'), async (req, res) => {
            try {
                const { sesionId } = req.params;

                // Obtener datos de la sesión
                const [sesion] = await this.db.connection.execute(`
                    SELECT s.*, u.nombre as cajero_nombre, u.apellido as cajero_apellido,
                           c.nombre as caja_nombre, c.ubicacion as caja_ubicacion
                    FROM punto_venta_sesiones s
                    INNER JOIN usuarios u ON s.cajero_id = u.id
                    INNER JOIN cajas c ON s.caja_id = c.id
                    WHERE s.id = ?
                `, [sesionId]);

                if (sesion.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Sesión no encontrada',
                        code: 'SESSION_NOT_FOUND'
                    });
                }

                // Obtener ventas de la sesión
                const [ventas] = await this.db.connection.execute(`
                    SELECT v.id, v.numero, v.fecha, v.hora, v.total,
                           v.estado, m.numero as mesa_numero,
                           u.nombre as garzon_nombre, u.apellido as garzon_apellido
                    FROM ventas v
                    LEFT JOIN mesas m ON v.mesa_id = m.id
                    LEFT JOIN usuarios u ON v.garzon_id = u.id
                    WHERE v.sesion_punto_venta_id = ?
                    ORDER BY v.fecha DESC, v.hora DESC
                `, [sesionId]);

                // Obtener formas de pago de las ventas
                const [formasPago] = await this.db.connection.execute(`
                    SELECT fp.nombre as forma_pago, fp.tipo,
                           SUM(vp.monto) as total,
                           COUNT(vp.id) as cantidad_transacciones
                    FROM venta_pagos vp
                    INNER JOIN formas_pago fp ON vp.forma_pago_id = fp.id
                    INNER JOIN ventas v ON vp.venta_id = v.id
                    WHERE v.sesion_punto_venta_id = ?
                    GROUP BY fp.id, fp.nombre, fp.tipo
                    ORDER BY total DESC
                `, [sesionId]);

                // Obtener movimientos de caja
                const [movimientos] = await this.db.connection.execute(`
                    SELECT mc.*, u.nombre as cajero_nombre, u.apellido as cajero_apellido
                    FROM movimientos_caja mc
                    INNER JOIN usuarios u ON mc.cajero_id = u.id
                    WHERE mc.sesion_id = ?
                    ORDER BY mc.fecha DESC, mc.hora DESC
                `, [sesionId]);

                // Obtener detalle de efectivo
                const [detalleEfectivo] = await this.db.connection.execute(`
                    SELECT tipo_operacion, tipo_denominacion, denominacion,
                           cantidad, total
                    FROM detalle_efectivo_sesion
                    WHERE sesion_id = ?
                    ORDER BY tipo_operacion, tipo_denominacion, denominacion DESC
                `, [sesionId]);

                const reporte = {
                    sesion: sesion[0],
                    resumen: {
                        totalVentas: ventas.length,
                        montoTotalVentas: ventas.reduce((sum, v) => sum + parseFloat(v.total || 0), 0),
                        ventasPorEstado: ventas.reduce((acc, v) => {
                            acc[v.estado] = (acc[v.estado] || 0) + 1;
                            return acc;
                        }, {}),
                        formasPago: formasPago.map(fp => ({
                            ...fp,
                            total: parseFloat(fp.total),
                            cantidad_transacciones: parseInt(fp.cantidad_transacciones)
                        }))
                    },
                    ventas,
                    movimientos,
                    detalleEfectivo: {
                        apertura: detalleEfectivo.filter(d => d.tipo_operacion === 'APERTURA'),
                        cierre: detalleEfectivo.filter(d => d.tipo_operacion === 'CIERRE')
                    },
                    generadoEn: new Date().toISOString()
                };

                res.json({
                    success: true,
                    reporte
                });

            } catch (error) {
                console.error('❌ Error generando reporte:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error generando reporte',
                    code: 'GENERATE_REPORT_ERROR'
                });
            }
        });

        /**
         * GET /punto-venta/cajas
         * Obtener lista de cajas disponibles
         */
        router.get('/cajas', async (req, res) => {
            try {
                const [cajas] = await this.db.connection.execute(`
                    SELECT c.*, s.id as sesion_activa_id,
                           u.nombre as cajero_nombre, u.apellido as cajero_apellido
                    FROM cajas c
                    LEFT JOIN punto_venta_sesiones s ON c.sesion_activa_id = s.id
                    LEFT JOIN usuarios u ON c.cajero_actual_id = u.id
                    WHERE c.activo = 1
                    ORDER BY c.numero
                `);

                res.json({
                    success: true,
                    cajas: cajas.map(caja => ({
                        id: caja.id,
                        numero: caja.numero,
                        nombre: caja.nombre,
                        ubicacion: caja.ubicacion,
                        estado: caja.estado,
                        sesionActiva: caja.sesion_activa_id ? {
                            id: caja.sesion_activa_id,
                            cajero: caja.cajero_nombre ?
                                   `${caja.cajero_nombre} ${caja.cajero_apellido}` : null
                        } : null
                    }))
                });

            } catch (error) {
                console.error('❌ Error obteniendo cajas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo cajas',
                    code: 'GET_CAJAS_ERROR'
                });
            }
        });

        /**
         * GET /punto-venta/denominaciones
         * Obtener denominaciones de billetes y monedas configuradas
         */
        router.get('/denominaciones', async (req, res) => {
            try {
                // Denominaciones estándar para Chile (pesos chilenos)
                const denominaciones = {
                    billetes: [
                        { valor: 20000, nombre: '$20.000' },
                        { valor: 10000, nombre: '$10.000' },
                        { valor: 5000, nombre: '$5.000' },
                        { valor: 2000, nombre: '$2.000' },
                        { valor: 1000, nombre: '$1.000' }
                    ],
                    monedas: [
                        { valor: 500, nombre: '$500' },
                        { valor: 100, nombre: '$100' },
                        { valor: 50, nombre: '$50' },
                        { valor: 10, nombre: '$10' },
                        { valor: 5, nombre: '$5' },
                        { valor: 1, nombre: '$1' }
                    ]
                };

                res.json({
                    success: true,
                    denominaciones
                });

            } catch (error) {
                console.error('❌ Error obteniendo denominaciones:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo denominaciones',
                    code: 'GET_DENOMINATIONS_ERROR'
                });
            }
        });
    }

    getRouter() {
        return router;
    }
}

module.exports = PuntoVentaRoutes;