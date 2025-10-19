#!/usr/bin/env node

/**
 * DYSA Point - API Routes para Control de Caja
 *
 * Endpoints especializados para el control de apertura/cierre de caja
 * Implementación basada en análisis del sistema SYSME original
 *
 * Funcionalidades API:
 * - Apertura/cierre de caja con validaciones
 * - Verificación de estado de caja
 * - Registro de movimientos automático
 * - Reportes de cuadre de caja
 * - Validación antes de ventas
 */

const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');

module.exports = (controlCajaManager, databaseManager) => {

    // ========================================
    // ENDPOINTS DE APERTURA Y CIERRE
    // ========================================

    /**
     * POST /api/control-caja/abrir
     * Abrir caja con monto inicial
     */
    router.post('/abrir', async (req, res) => {
        try {
            const {
                id_caja = 1,
                id_empleado,
                monto_inicial,
                observaciones
            } = req.body;

            // Validaciones de entrada
            if (!id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de empleado es requerido'
                });
            }

            if (!monto_inicial || monto_inicial < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Monto inicial debe ser mayor a 0'
                });
            }

            const resultado = await controlCajaManager.abrirCaja({
                id_caja,
                id_empleado,
                monto_inicial: parseFloat(monto_inicial),
                observaciones
            });

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error en apertura de caja:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * POST /api/control-caja/cerrar
     * Cerrar caja con cuadre
     */
    router.post('/cerrar', async (req, res) => {
        try {
            const {
                id_caja = 1,
                id_empleado,
                monto_final,
                observaciones
            } = req.body;

            // Validaciones de entrada
            if (!id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de empleado es requerido'
                });
            }

            if (!monto_final || monto_final < 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Monto final debe ser mayor o igual a 0'
                });
            }

            const resultado = await controlCajaManager.cerrarCaja({
                id_caja,
                id_empleado,
                monto_final: parseFloat(monto_final),
                observaciones
            });

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error en cierre de caja:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE VERIFICACIÓN Y ESTADO
    // ========================================

    /**
     * GET /api/control-caja/estado/:id_caja?
     * Obtener estado actual de la caja
     */
    router.get('/estado/:id_caja?', async (req, res) => {
        try {
            const id_caja = parseInt(req.params.id_caja) || 1;

            const estado = await controlCajaManager.obtenerEstadoCaja(id_caja);

            res.json({
                success: true,
                data: estado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo estado:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/control-caja/validar-venta/:id_caja?
     * Validar si se pueden realizar ventas
     */
    router.get('/validar-venta/:id_caja?', async (req, res) => {
        try {
            const id_caja = parseInt(req.params.id_caja) || 1;

            const validacion = await controlCajaManager.validarVentaPermitida(id_caja);

            res.json({
                success: true,
                data: validacion,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error validando venta:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/control-caja/configuracion
     * Obtener configuración de cajas disponibles
     */
    router.get('/configuracion', async (req, res) => {
        try {
            const cajas = await controlCajaManager.obtenerConfiguracionCajas();

            res.json({
                success: true,
                data: cajas,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE MOVIMIENTOS
    // ========================================

    /**
     * POST /api/control-caja/movimiento
     * Registrar movimiento manual de caja
     */
    router.post('/movimiento', async (req, res) => {
        try {
            const {
                id_caja = 1,
                tipo_movimiento,
                monto,
                metodo_pago = 'efectivo',
                descripcion,
                referencia,
                id_empleado
            } = req.body;

            // Validaciones
            if (!['ingreso', 'egreso'].includes(tipo_movimiento)) {
                return res.status(400).json({
                    success: false,
                    error: 'Tipo de movimiento debe ser ingreso o egreso'
                });
            }

            if (!monto || monto <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Monto debe ser mayor a 0'
                });
            }

            if (!id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de empleado es requerido'
                });
            }

            // Verificar que la caja esté abierta
            const cajaAbierta = await controlCajaManager.verificarCajaAbierta(id_caja);
            if (!cajaAbierta) {
                return res.status(400).json({
                    success: false,
                    error: 'La caja debe estar abierta para registrar movimientos'
                });
            }

            await controlCajaManager.registrarMovimiento({
                id_apcaja: cajaAbierta.id_apcajas,
                tipo_movimiento,
                monto: parseFloat(monto),
                metodo_pago,
                descripcion,
                referencia,
                id_empleado
            });

            res.json({
                success: true,
                mensaje: 'Movimiento registrado correctamente',
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error registrando movimiento:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * POST /api/control-caja/registrar-venta
     * Registrar venta automáticamente en movimientos
     */
    router.post('/registrar-venta', async (req, res) => {
        try {
            const {
                id_caja = 1,
                id_venta,
                monto_total,
                metodo_pago = 'efectivo',
                id_empleado
            } = req.body;

            // Validaciones
            if (!id_venta || !monto_total || !id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de venta, monto total e ID de empleado son requeridos'
                });
            }

            // Verificar que la caja esté abierta
            const cajaAbierta = await controlCajaManager.verificarCajaAbierta(id_caja);
            if (!cajaAbierta) {
                return res.status(400).json({
                    success: false,
                    error: 'La caja debe estar abierta para registrar ventas'
                });
            }

            await controlCajaManager.registrarVenta(cajaAbierta.id_apcajas, {
                id_venta,
                monto_total: parseFloat(monto_total),
                metodo_pago,
                id_empleado
            });

            res.json({
                success: true,
                mensaje: 'Venta registrada en movimientos de caja',
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error registrando venta:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE REPORTES
    // ========================================

    /**
     * GET /api/control-caja/reporte/:id_apcaja
     * Generar reporte de cierre detallado
     */
    router.get('/reporte/:id_apcaja', async (req, res) => {
        try {
            const id_apcaja = parseInt(req.params.id_apcaja);

            if (!id_apcaja) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de apertura de caja requerido'
                });
            }

            const reporte = await controlCajaManager.generarReporteCierre(id_apcaja);

            res.json({
                success: true,
                data: reporte,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error generando reporte:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/control-caja/historial/:id_caja?
     * Obtener historial de aperturas/cierres
     */
    router.get('/historial/:id_caja?', async (req, res) => {
        try {
            const id_caja = parseInt(req.params.id_caja) || 1;
            const limite = parseInt(req.query.limite) || 10;

            const [historial] = await databaseManager.query(`
                SELECT
                    id_apcajas,
                    fecha_apertura,
                    fecha_cierre,
                    monto_inicial,
                    monto_final,
                    monto_sistema,
                    diferencia,
                    estado,
                    numero_movimientos,
                    observaciones_apertura,
                    observaciones_cierre
                FROM apcajas
                WHERE id_caja = ?
                ORDER BY fecha_apertura DESC
                LIMIT ?
            `, [id_caja, limite]);

            res.json({
                success: true,
                data: historial,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo historial:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE SALUD Y ESTADO
    // ========================================

    /**
     * GET /api/control-caja/health
     * Health check del servicio
     */
    router.get('/health', async (req, res) => {
        try {
            const estado = await controlCajaManager.obtenerEstadoServicio();

            res.json({
                success: true,
                data: estado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/control-caja/estadisticas
     * Estadísticas generales del sistema de cajas
     */
    router.get('/estadisticas', async (req, res) => {
        try {
            // Estadísticas de hoy
            const [ventasHoy] = await databaseManager.query(`
                SELECT
                    COUNT(*) as total_ventas,
                    COALESCE(SUM(monto), 0) as total_monto
                FROM movimientos_caja
                WHERE tipo_movimiento = 'venta'
                AND DATE(fecha_movimiento) = CURDATE()
            `);

            // Cajas activas
            const [cajasActivas] = await databaseManager.query(`
                SELECT COUNT(*) as total
                FROM apcajas
                WHERE abierta = 'S'
            `);

            // Total movimientos hoy
            const [movimientosHoy] = await databaseManager.query(`
                SELECT
                    tipo_movimiento,
                    COUNT(*) as cantidad,
                    SUM(monto) as total
                FROM movimientos_caja
                WHERE DATE(fecha_movimiento) = CURDATE()
                GROUP BY tipo_movimiento
            `);

            res.json({
                success: true,
                data: {
                    ventas_hoy: ventasHoy[0],
                    cajas_abiertas: cajasActivas[0].total,
                    movimientos_por_tipo: movimientosHoy,
                    fecha: moment().tz('America/Santiago').format('YYYY-MM-DD')
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    return router;
};