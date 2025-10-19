/**
 * DYSA Point - Rutas de Comandas de Cocina
 * API endpoints para manejo completo del sistema de cocina por estaciones
 *
 * Endpoints incluidos:
 * - GET /estaciones - Resumen de todas las estaciones
 * - GET /estacion/:id - Comandas específicas de una estación
 * - PUT /comanda/:id/estado - Cambiar estado de comanda
 * - PUT /comanda/:id/prioridad - Cambiar prioridad
 * - GET /notificaciones - Server-sent events para tiempo real
 * - GET /metricas - Métricas de rendimiento de cocina
 */

const express = require('express');
const router = express.Router();

class CocinaRoutes {
    constructor(cocinaManager, database) {
        this.cocinaManager = cocinaManager;
        this.db = database;
        this.setupRoutes();
    }

    setupRoutes() {
        // Obtener resumen de todas las estaciones
        router.get('/estaciones', async (req, res) => {
            try {
                const resumen = await this.cocinaManager.obtenerResumenEstaciones();
                res.json(resumen);

            } catch (error) {
                console.error('❌ Error obteniendo resumen estaciones:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener comandas de una estación específica
        router.get('/estacion/:id', async (req, res) => {
            try {
                const estacionId = parseInt(req.params.id);
                const {
                    estado,
                    prioridad,
                    desde_fecha,
                    limite = 50
                } = req.query;

                const filtros = {
                    estado,
                    prioridad,
                    desde_fecha,
                    limite: parseInt(limite)
                };

                const comandas = await this.cocinaManager.obtenerComandasEstacion(estacionId, filtros);
                res.json(comandas);

            } catch (error) {
                console.error('❌ Error obteniendo comandas de estación:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Cambiar estado de una comanda
        router.put('/comanda/:id/estado', async (req, res) => {
            try {
                const comandaId = parseInt(req.params.id);
                const { nuevo_estado, usuario_codigo, observaciones } = req.body;

                if (!nuevo_estado) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nuevo estado es requerido'
                    });
                }

                const resultado = await this.cocinaManager.cambiarEstadoComanda(comandaId, nuevo_estado, {
                    usuario_codigo,
                    observaciones
                });

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error cambiando estado de comanda:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Cambiar prioridad de una comanda
        router.put('/comanda/:id/prioridad', async (req, res) => {
            try {
                const comandaId = parseInt(req.params.id);
                const { nueva_prioridad, usuario_codigo } = req.body;

                if (!nueva_prioridad || !usuario_codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nueva prioridad y código de usuario son requeridos'
                    });
                }

                const resultado = await this.cocinaManager.cambiarPrioridadComanda(
                    comandaId,
                    nueva_prioridad,
                    usuario_codigo
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error cambiando prioridad:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Notificaciones en tiempo real para cocina
        router.get('/notificaciones', async (req, res) => {
            try {
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*'
                });

                const enviarEvento = (tipo, datos) => {
                    res.write(`event: ${tipo}\n`);
                    res.write(`data: ${JSON.stringify(datos)}\n\n`);
                };

                // Estado inicial
                const estadoInicial = await this.cocinaManager.obtenerResumenEstaciones();
                enviarEvento('estado_inicial', estadoInicial);

                // Configurar listeners
                const onNuevaComanda = (datos) => enviarEvento('nueva_comanda', datos);
                const onCambioEstado = (datos) => enviarEvento('cambio_estado', datos);
                const onCambioPrioridad = (datos) => enviarEvento('cambio_prioridad', datos);
                const onPlatoListo = (datos) => enviarEvento('plato_listo', datos);

                this.cocinaManager.on('nueva_comanda', onNuevaComanda);
                this.cocinaManager.on('cambio_estado_comanda', onCambioEstado);
                this.cocinaManager.on('cambio_prioridad', onCambioPrioridad);
                this.cocinaManager.on('plato_listo', onPlatoListo);

                req.on('close', () => {
                    this.cocinaManager.removeListener('nueva_comanda', onNuevaComanda);
                    this.cocinaManager.removeListener('cambio_estado_comanda', onCambioEstado);
                    this.cocinaManager.removeListener('cambio_prioridad', onCambioPrioridad);
                    this.cocinaManager.removeListener('plato_listo', onPlatoListo);
                    res.end();
                });

            } catch (error) {
                console.error('❌ Error configurando notificaciones cocina:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Métricas de rendimiento de cocina
        router.get('/metricas', async (req, res) => {
            try {
                const { fecha = new Date().toISOString().split('T')[0] } = req.query;

                const metricas = await this.obtenerMetricasCocina(fecha);
                res.json(metricas);

            } catch (error) {
                console.error('❌ Error obteniendo métricas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Crear comanda manual
        router.post('/comanda', async (req, res) => {
            try {
                const { item_id, estacion_id, prioridad = 'normal' } = req.body;

                if (!item_id || !estacion_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'Item ID y Estación ID son requeridos'
                    });
                }

                const resultado = await this.cocinaManager.crearComandaDesdeVenta(
                    item_id,
                    estacion_id,
                    prioridad
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error creando comanda:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener historial de comandas
        router.get('/historial', async (req, res) => {
            try {
                const {
                    fecha_desde,
                    fecha_hasta,
                    estacion_id,
                    estado,
                    limite = 100
                } = req.query;

                let query = `
                    SELECT
                        cc.*,
                        vi.cantidad,
                        p.nombre as producto_nombre,
                        ec.nombre as estacion_nombre,
                        m.nombre as mesa_nombre,
                        u.nombre as garzon_nombre
                    FROM comandas_cocina cc
                    JOIN venta_items vi ON cc.item_id = vi.id
                    JOIN productos p ON vi.producto_id = p.id
                    JOIN estaciones_cocina ec ON cc.estacion_id = ec.id
                    JOIN ventas v ON vi.venta_id = v.id
                    JOIN mesas m ON v.mesa_id = m.id
                    JOIN usuarios u ON v.usuario_id = u.id
                    WHERE 1=1
                `;

                const params = [];

                if (fecha_desde) {
                    query += ` AND DATE(cc.created_at) >= ?`;
                    params.push(fecha_desde);
                }

                if (fecha_hasta) {
                    query += ` AND DATE(cc.created_at) <= ?`;
                    params.push(fecha_hasta);
                }

                if (estacion_id) {
                    query += ` AND cc.estacion_id = ?`;
                    params.push(parseInt(estacion_id));
                }

                if (estado) {
                    query += ` AND cc.estado = ?`;
                    params.push(estado);
                }

                query += ` ORDER BY cc.created_at DESC LIMIT ?`;
                params.push(parseInt(limite));

                const [historial] = await this.db.connection.execute(query, params);

                res.json({
                    success: true,
                    historial: historial,
                    total: historial.length
                });

            } catch (error) {
                console.error('❌ Error obteniendo historial:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    // Método auxiliar para obtener métricas
    async obtenerMetricasCocina(fecha) {
        try {
            // Métricas generales del día
            const [metricas] = await this.db.connection.execute(`
                SELECT
                    COUNT(*) as total_comandas,
                    COUNT(CASE WHEN estado = 'servida' THEN 1 END) as comandas_completadas,
                    COUNT(CASE WHEN estado = 'cancelada' THEN 1 END) as comandas_canceladas,
                    AVG(TIMESTAMPDIFF(MINUTE, created_at, fecha_listo)) as tiempo_promedio_preparacion,
                    AVG(TIMESTAMPDIFF(MINUTE, fecha_listo, fecha_servido)) as tiempo_promedio_espera,
                    COUNT(CASE WHEN prioridad = 'critica' THEN 1 END) as comandas_criticas,
                    COUNT(CASE WHEN prioridad = 'urgente' THEN 1 END) as comandas_urgentes
                FROM comandas_cocina
                WHERE DATE(created_at) = ?
            `, [fecha]);

            // Métricas por estación
            const [porEstacion] = await this.db.connection.execute(`
                SELECT
                    ec.id,
                    ec.nombre,
                    COUNT(cc.id) as total_comandas,
                    COUNT(CASE WHEN cc.estado = 'servida' THEN 1 END) as completadas,
                    AVG(TIMESTAMPDIFF(MINUTE, cc.created_at, cc.fecha_listo)) as tiempo_promedio,
                    COUNT(CASE WHEN cc.prioridad = 'critica' THEN 1 END) as criticas
                FROM estaciones_cocina ec
                LEFT JOIN comandas_cocina cc ON ec.id = cc.estacion_id AND DATE(cc.created_at) = ?
                WHERE ec.activo = 1
                GROUP BY ec.id
                ORDER BY ec.orden
            `, [fecha]);

            // Comandas por hora del día
            const [porHora] = await this.db.connection.execute(`
                SELECT
                    HOUR(created_at) as hora,
                    COUNT(*) as total_comandas,
                    COUNT(CASE WHEN estado = 'servida' THEN 1 END) as completadas
                FROM comandas_cocina
                WHERE DATE(created_at) = ?
                GROUP BY HOUR(created_at)
                ORDER BY hora
            `, [fecha]);

            return {
                success: true,
                fecha: fecha,
                resumen_general: {
                    ...metricas[0],
                    tiempo_promedio_preparacion: Math.round(metricas[0]?.tiempo_promedio_preparacion || 0),
                    tiempo_promedio_espera: Math.round(metricas[0]?.tiempo_promedio_espera || 0),
                    eficiencia_porcentaje: metricas[0].total_comandas > 0 ?
                        Math.round((metricas[0].comandas_completadas / metricas[0].total_comandas) * 100) : 0
                },
                por_estacion: porEstacion.map(est => ({
                    ...est,
                    tiempo_promedio: Math.round(est.tiempo_promedio || 0),
                    eficiencia_porcentaje: est.total_comandas > 0 ?
                        Math.round((est.completadas / est.total_comandas) * 100) : 0
                })),
                distribucion_horaria: porHora
            };

        } catch (error) {
            console.error('❌ Error calculando métricas:', error);
            throw error;
        }
    }

    getRouter() {
        return router;
    }
}

module.exports = CocinaRoutes;