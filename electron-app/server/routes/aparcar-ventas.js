/**
 * DYSA Point - Rutas de Aparcar Ventas
 * API endpoints para el sistema de aparcamiento de ventas (funcionalidad crítica #2)
 *
 * Endpoints implementados:
 * - POST /:venta_id/aparcar - Aparcar venta específica
 * - POST /:venta_id/recuperar/:mesa - Recuperar venta en mesa específica
 * - GET /aparcadas - Obtener lista de ventas aparcadas
 * - GET /historial - Historial de aparcamientos
 * - GET /configuracion - Configuración del sistema
 * - DELETE /limpiar-vencidas - Limpiar ventas vencidas
 */

const express = require('express');
const router = express.Router();

class AparcamientoRoutes {
    constructor(aparcamientoManager, database) {
        this.aparcamientoManager = aparcamientoManager;
        this.db = database;
        this.setupRoutes();
    }

    setupRoutes() {
        // Aparcar venta específica
        router.post('/:venta_id/aparcar', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);
                const { usuario_id, motivo } = req.body;

                if (isNaN(ventaId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de venta inválido'
                    });
                }

                if (!usuario_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de usuario es requerido'
                    });
                }

                const resultado = await this.aparcamientoManager.aparcarVenta(
                    ventaId,
                    usuario_id,
                    motivo
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error aparcando venta:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Recuperar venta aparcada en mesa específica
        router.post('/:venta_id/recuperar/:mesa', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);
                const nuevaMesa = parseInt(req.params.mesa);
                const { usuario_id } = req.body;

                if (isNaN(ventaId) || isNaN(nuevaMesa)) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de venta o mesa inválidos'
                    });
                }

                if (!usuario_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de usuario es requerido'
                    });
                }

                const resultado = await this.aparcamientoManager.recuperarVenta(
                    ventaId,
                    nuevaMesa,
                    usuario_id
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error recuperando venta:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener lista de ventas aparcadas
        router.get('/aparcadas', async (req, res) => {
            try {
                const resultado = await this.aparcamientoManager.obtenerVentasAparcadas();
                res.json(resultado);

            } catch (error) {
                console.error('❌ Error obteniendo ventas aparcadas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener detalles de venta aparcada específica
        router.get('/:venta_id/detalle', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);

                if (isNaN(ventaId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de venta inválido'
                    });
                }

                // Obtener información de la venta
                const [venta] = await this.db.connection.execute(`
                    SELECT
                        vd.*,
                        m.descripcion as mesa_descripcion,
                        c.nombre as camarero_nombre,
                        ua.nombre as usuario_aparcamiento_nombre,
                        TIMESTAMPDIFF(MINUTE, vd.fecha_aparcamiento, NOW()) as minutos_aparcada
                    FROM ventadirecta vd
                    JOIN mesa m ON vd.Num_Mesa = m.Num_Mesa
                    JOIN camareros c ON vd.id_camarero = c.id_camarero
                    LEFT JOIN camareros ua ON vd.usuario_aparcamiento = ua.id_camarero
                    WHERE vd.id_venta = ? AND vd.cerrada = 'M'
                `, [ventaId]);

                if (venta.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Venta aparcada no encontrada'
                    });
                }

                // Obtener productos de la venta
                const [productos] = await this.db.connection.execute(`
                    SELECT
                        vc.*,
                        cg.alias as producto_nombre,
                        cg.precio as precio_unitario
                    FROM ventadir_comg vc
                    JOIN complementog cg ON vc.id_complementog = cg.id_complementog
                    WHERE vc.id_venta = ?
                    ORDER BY vc.id_linea ASC
                `, [ventaId]);

                res.json({
                    success: true,
                    venta: venta[0],
                    productos: productos,
                    tiempo_restante: 120 - venta[0].minutos_aparcada, // Tiempo máximo - tiempo transcurrido
                    alerta_tiempo: venta[0].minutos_aparcada >= 105 // Alerta 15 min antes
                });

            } catch (error) {
                console.error('❌ Error obteniendo detalle de venta aparcada:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener historial de aparcamientos
        router.get('/historial', async (req, res) => {
            try {
                const {
                    fecha_desde,
                    fecha_hasta,
                    limit = 50
                } = req.query;

                const resultado = await this.aparcamientoManager.obtenerHistorialAparcamientos(
                    fecha_desde,
                    fecha_hasta,
                    limit
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error obteniendo historial:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener configuración del sistema de aparcamiento
        router.get('/configuracion', async (req, res) => {
            try {
                const { tipo = 'global', id_referencia } = req.query;

                const configuracion = await this.aparcamientoManager.obtenerConfiguracion(
                    tipo,
                    id_referencia ? parseInt(id_referencia) : null
                );

                res.json({
                    success: true,
                    configuracion: configuracion
                });

            } catch (error) {
                console.error('❌ Error obteniendo configuración:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Dashboard de aparcamientos (estadísticas)
        router.get('/dashboard', async (req, res) => {
            try {
                // Estadísticas actuales
                const [estadisticasActuales] = await this.db.connection.execute(`
                    SELECT
                        COUNT(*) as total_aparcadas,
                        AVG(TIMESTAMPDIFF(MINUTE, fecha_aparcamiento, NOW())) as promedio_tiempo_aparcada,
                        COUNT(CASE WHEN TIMESTAMPDIFF(MINUTE, fecha_aparcamiento, NOW()) > 105 THEN 1 END) as con_alerta,
                        COUNT(CASE WHEN TIMESTAMPDIFF(MINUTE, fecha_aparcamiento, NOW()) > 120 THEN 1 END) as excedidas
                    FROM ventadirecta
                    WHERE cerrada = 'M'
                `);

                // Estadísticas del día
                const [estadisticasDia] = await this.db.connection.execute(`
                    SELECT
                        accion,
                        COUNT(*) as total,
                        AVG(total_venta) as promedio_total
                    FROM historial_aparcamientos
                    WHERE DATE(fecha_accion) = CURDATE()
                    GROUP BY accion
                `);

                // Top usuarios más activos en aparcamientos
                const [usuariosActivos] = await this.db.connection.execute(`
                    SELECT
                        c.nombre as usuario_nombre,
                        ha.accion,
                        COUNT(*) as total_acciones
                    FROM historial_aparcamientos ha
                    JOIN camareros c ON ha.usuario_accion = c.id_camarero
                    WHERE DATE(ha.fecha_accion) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
                    GROUP BY ha.usuario_accion, c.nombre, ha.accion
                    ORDER BY total_acciones DESC
                    LIMIT 10
                `);

                res.json({
                    success: true,
                    estadisticas_actuales: estadisticasActuales[0] || {},
                    estadisticas_dia: estadisticasDia || [],
                    usuarios_activos: usuariosActivos || []
                });

            } catch (error) {
                console.error('❌ Error obteniendo dashboard:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Limpiar ventas vencidas
        router.delete('/limpiar-vencidas', async (req, res) => {
            try {
                const ventasLimpiadas = await this.aparcamientoManager.limpiarVentasVencidas();

                res.json({
                    success: true,
                    ventas_encontradas: ventasLimpiadas,
                    message: `Se encontraron ${ventasLimpiadas} ventas vencidas`
                });

            } catch (error) {
                console.error('❌ Error limpiando ventas vencidas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Verificar estado de venta
        router.get('/:venta_id/estado', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);

                if (isNaN(ventaId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de venta inválido'
                    });
                }

                const [venta] = await this.db.connection.execute(`
                    SELECT
                        id_venta,
                        cerrada,
                        fecha_aparcamiento,
                        CASE
                            WHEN cerrada = 'N' THEN 'activa'
                            WHEN cerrada = 'M' THEN 'aparcada'
                            WHEN cerrada = 'Y' THEN 'cerrada'
                            ELSE 'desconocida'
                        END as estado_descripcion,
                        CASE
                            WHEN cerrada = 'M' THEN TIMESTAMPDIFF(MINUTE, fecha_aparcamiento, NOW())
                            ELSE NULL
                        END as minutos_aparcada
                    FROM ventadirecta
                    WHERE id_venta = ?
                `, [ventaId]);

                if (venta.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Venta no encontrada'
                    });
                }

                res.json({
                    success: true,
                    venta: venta[0]
                });

            } catch (error) {
                console.error('❌ Error verificando estado de venta:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener mesas disponibles para recuperar venta
        router.get('/mesas-disponibles', async (req, res) => {
            try {
                const [mesas] = await this.db.connection.execute(`
                    SELECT
                        Num_Mesa,
                        descripcion,
                        capacidad,
                        estado
                    FROM mesa
                    WHERE estado = 'libre' AND activa = true
                    ORDER BY Num_Mesa ASC
                `);

                res.json({
                    success: true,
                    mesas_disponibles: mesas,
                    total: mesas.length
                });

            } catch (error) {
                console.error('❌ Error obteniendo mesas disponibles:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    getRouter() {
        return router;
    }
}

module.exports = AparcamientoRoutes;