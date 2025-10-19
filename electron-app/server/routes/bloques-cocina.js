/**
 * DYSA Point - Rutas de Bloques de Cocina
 * API endpoints para el sistema de bloques de cocina (funcionalidad crítica #1)
 *
 * Endpoints implementados:
 * - POST /:venta_id/asignar - Asignar productos a bloques
 * - POST /:venta_id/enviar/:bloque - Enviar bloque específico
 * - POST /:venta_id/enviar-siguiente - Enviar siguiente bloque
 * - GET /:venta_id/estado - Estado de bloques de venta
 * - PUT /:venta_id/bloque/:bloque/listo - Marcar bloque listo
 * - GET /:venta_id/distribucion/:bloques - Distribución automática
 * - GET /configuracion - Obtener configuración de bloques
 */

const express = require('express');
const router = express.Router();

class BloquesCocinaRoutes {
    constructor(bloquesCocinaManager, database) {
        this.bloquesCocinaManager = bloquesCocinaManager;
        this.db = database;
        this.setupRoutes();
    }

    setupRoutes() {
        // Asignar productos de venta a bloques específicos
        router.post('/:venta_id/asignar', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);
                const {
                    distribucion_bloques,
                    auto_enviar_primero = true
                } = req.body;

                if (!distribucion_bloques || Object.keys(distribucion_bloques).length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Distribución de bloques es requerida'
                    });
                }

                const resultado = await this.bloquesCocinaManager.asignarProductosABloques(ventaId, {
                    distribucionBloques: distribucion_bloques,
                    autoEnviarPrimero: auto_enviar_primero
                });

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error asignando bloques:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Enviar bloque específico a cocina
        router.post('/:venta_id/enviar/:bloque', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);
                const numeroBloque = parseInt(req.params.bloque);
                const { usuario_id } = req.body;

                if (isNaN(numeroBloque) || numeroBloque < 1 || numeroBloque > 4) {
                    return res.status(400).json({
                        success: false,
                        error: 'Número de bloque debe ser entre 1 y 4'
                    });
                }

                const resultado = await this.bloquesCocinaManager.enviarBloqueACocina(
                    ventaId,
                    numeroBloque,
                    usuario_id
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error enviando bloque:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Enviar siguiente bloque automáticamente
        router.post('/:venta_id/enviar-siguiente', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);
                const { usuario_id } = req.body;

                const resultado = await this.bloquesCocinaManager.enviarSiguienteBloque(
                    ventaId,
                    usuario_id
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error enviando siguiente bloque:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener estado completo de bloques de una venta
        router.get('/:venta_id/estado', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);

                if (isNaN(ventaId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de venta inválido'
                    });
                }

                const estado = await this.bloquesCocinaManager.obtenerEstadoBloques(ventaId);
                res.json(estado);

            } catch (error) {
                console.error('❌ Error obteniendo estado de bloques:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Marcar bloque como listo
        router.put('/:venta_id/bloque/:bloque/listo', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);
                const numeroBloque = parseInt(req.params.bloque);

                if (isNaN(numeroBloque) || numeroBloque < 1 || numeroBloque > 4) {
                    return res.status(400).json({
                        success: false,
                        error: 'Número de bloque debe ser entre 1 y 4'
                    });
                }

                const resultado = await this.bloquesCocinaManager.marcarBloqueComoListo(
                    ventaId,
                    numeroBloque
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error marcando bloque listo:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener distribución automática de productos en bloques
        router.get('/:venta_id/distribucion/:bloques', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);
                const numeroBloques = parseInt(req.params.bloques);

                if (isNaN(numeroBloques) || numeroBloques < 1 || numeroBloques > 4) {
                    return res.status(400).json({
                        success: false,
                        error: 'Número de bloques debe ser entre 1 y 4'
                    });
                }

                const distribucion = await this.bloquesCocinaManager.distribucionAutomatica(
                    ventaId,
                    numeroBloques
                );

                res.json(distribucion);

            } catch (error) {
                console.error('❌ Error generando distribución:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener configuración de bloques
        router.get('/configuracion', async (req, res) => {
            try {
                const { tipo = 'global', id_referencia } = req.query;

                const configuracion = await this.bloquesCocinaManager.obtenerConfiguracion(
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

        // Obtener resumen de bloques activos (dashboard cocina)
        router.get('/activos/resumen', async (req, res) => {
            try {
                const [bloquesActivos] = await this.db.connection.execute(`
                    SELECT
                        ebc.id_venta,
                        vd.Num_Mesa,
                        m.descripcion as mesa_nombre,
                        ebc.bloque_numero,
                        ebc.estado,
                        ebc.fecha_envio,
                        ebc.total_productos,
                        ebc.productos_pendientes,
                        ebc.productos_listos,
                        c.nombre as camarero_nombre,
                        TIMESTAMPDIFF(MINUTE, ebc.fecha_envio, NOW()) as minutos_transcurridos
                    FROM envios_bloques_cocina ebc
                    JOIN ventadirecta vd ON ebc.id_venta = vd.id_venta
                    JOIN mesa m ON vd.Num_Mesa = m.Num_Mesa
                    JOIN camareros c ON vd.id_camarero = c.id_camarero
                    WHERE ebc.estado IN ('enviado', 'en_preparacion')
                    ORDER BY ebc.fecha_envio ASC
                `);

                // Agrupar por venta
                const ventasBloques = bloquesActivos.reduce((acc, bloque) => {
                    const ventaId = bloque.id_venta;
                    if (!acc[ventaId]) {
                        acc[ventaId] = {
                            venta_id: ventaId,
                            mesa: `${bloque.Num_Mesa} - ${bloque.mesa_nombre}`,
                            camarero: bloque.camarero_nombre,
                            bloques: []
                        };
                    }
                    acc[ventaId].bloques.push({
                        numero: bloque.bloque_numero,
                        estado: bloque.estado,
                        productos_total: bloque.total_productos,
                        productos_pendientes: bloque.productos_pendientes,
                        productos_listos: bloque.productos_listos,
                        minutos_transcurridos: bloque.minutos_transcurridos,
                        urgente: bloque.minutos_transcurridos > 15
                    });
                    return acc;
                }, {});

                res.json({
                    success: true,
                    ventas_con_bloques: Object.values(ventasBloques),
                    total_bloques_activos: bloquesActivos.length
                });

            } catch (error) {
                console.error('❌ Error obteniendo resumen de bloques activos:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Marcar productos específicos de un bloque como listos
        router.put('/:venta_id/bloque/:bloque/productos/listos', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.venta_id);
                const numeroBloque = parseInt(req.params.bloque);
                const { productos_ids = [] } = req.body;

                // Actualizar productos específicos en venta_cocina
                for (const productoId of productos_ids) {
                    await this.db.connection.execute(`
                        UPDATE venta_cocina
                        SET estado = 'listo', fecha_listo = CURRENT_TIMESTAMP
                        WHERE id_venta = ? AND bloque_cocina = ? AND id_linea = ?
                    `, [ventaId, numeroBloque, productoId]);
                }

                // Verificar si todos los productos del bloque están listos
                const [productosBloque] = await this.db.connection.execute(`
                    SELECT COUNT(*) as total,
                           COUNT(CASE WHEN estado = 'listo' THEN 1 END) as listos
                    FROM venta_cocina
                    WHERE id_venta = ? AND bloque_cocina = ?
                `, [ventaId, numeroBloque]);

                const todosListos = productosBloque[0].total === productosBloque[0].listos;

                if (todosListos) {
                    // Marcar bloque completo como listo
                    await this.bloquesCocinaManager.marcarBloqueComoListo(ventaId, numeroBloque);
                }

                res.json({
                    success: true,
                    productos_actualizados: productos_ids.length,
                    bloque_completo: todosListos,
                    productos_listos: productosBloque[0].listos,
                    productos_total: productosBloque[0].total
                });

            } catch (error) {
                console.error('❌ Error marcando productos listos:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener historial de envíos de bloques
        router.get('/historial', async (req, res) => {
            try {
                const {
                    fecha_desde,
                    fecha_hasta,
                    estado,
                    limit = 50
                } = req.query;

                let query = `
                    SELECT
                        ebc.*,
                        vd.Num_Mesa,
                        m.descripcion as mesa_nombre,
                        c.nombre as camarero_nombre,
                        TIMESTAMPDIFF(MINUTE, ebc.fecha_envio, COALESCE(ebc.updated_at, NOW())) as tiempo_total
                    FROM envios_bloques_cocina ebc
                    JOIN ventadirecta vd ON ebc.id_venta = vd.id_venta
                    JOIN mesa m ON vd.Num_Mesa = m.Num_Mesa
                    JOIN camareros c ON vd.id_camarero = c.id_camarero
                    WHERE 1=1
                `;

                const params = [];

                if (fecha_desde) {
                    query += ` AND DATE(ebc.fecha_envio) >= ?`;
                    params.push(fecha_desde);
                }

                if (fecha_hasta) {
                    query += ` AND DATE(ebc.fecha_envio) <= ?`;
                    params.push(fecha_hasta);
                }

                if (estado) {
                    query += ` AND ebc.estado = ?`;
                    params.push(estado);
                }

                query += ` ORDER BY ebc.fecha_envio DESC LIMIT ?`;
                params.push(parseInt(limit));

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

    getRouter() {
        return router;
    }
}

module.exports = BloquesCocinaRoutes;