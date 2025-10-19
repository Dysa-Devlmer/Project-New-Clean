/**
 * DYSA Point - Rutas de Ventas y Comandas
 * API endpoints para manejo completo de ventas, ítems y comandas
 *
 * Endpoints incluidos:
 * - POST /crear - Crear nueva venta
 * - GET /:id - Obtener detalles de venta
 * - POST /:id/items - Agregar ítem a venta
 * - PUT /items/:item_id/cantidad - Modificar cantidad
 * - DELETE /items/:item_id - Eliminar ítem
 * - GET /mesa/:mesa_id/activa - Obtener venta activa de mesa
 * - PUT /:id/estado - Cambiar estado de venta
 */

const express = require('express');
const router = express.Router();

class VentasRoutes {
    constructor(ventasManager, database) {
        this.ventasManager = ventasManager;
        this.db = database;
        this.setupRoutes();
    }

    setupRoutes() {
        // Crear nueva venta
        router.post('/crear', async (req, res) => {
            try {
                const {
                    mesa_id,
                    garzon_codigo,
                    observaciones,
                    tipo_orden = 'mesa'
                } = req.body;

                // Validar datos requeridos
                if (!mesa_id || !garzon_codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Mesa ID y código de garzón son requeridos'
                    });
                }

                const resultado = await this.ventasManager.crearVenta({
                    mesa_id: parseInt(mesa_id),
                    garzon_codigo,
                    observaciones,
                    tipo_orden
                });

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error en /crear:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener detalles completos de una venta
        router.get('/:id', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.id);

                if (!ventaId || isNaN(ventaId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de venta inválido'
                    });
                }

                const venta = await this.ventasManager.obtenerVentaCompleta(ventaId);

                if (!venta) {
                    return res.status(404).json({
                        success: false,
                        error: 'Venta no encontrada'
                    });
                }

                res.json({
                    success: true,
                    venta: venta
                });

            } catch (error) {
                console.error('❌ Error obteniendo venta:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Agregar ítem a una venta
        router.post('/:id/items', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.id);
                const {
                    producto_id,
                    cantidad,
                    precio_unitario,
                    modificadores = [],
                    observaciones,
                    garzon_codigo
                } = req.body;

                // Validar datos requeridos
                if (!producto_id || !cantidad || !garzon_codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Producto ID, cantidad y código de garzón son requeridos'
                    });
                }

                if (cantidad <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'La cantidad debe ser mayor a 0'
                    });
                }

                const resultado = await this.ventasManager.agregarItem(ventaId, {
                    producto_id: parseInt(producto_id),
                    cantidad: parseFloat(cantidad),
                    precio_unitario: precio_unitario ? parseFloat(precio_unitario) : null,
                    modificadores,
                    observaciones,
                    garzon_codigo
                });

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error agregando ítem:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Modificar cantidad de un ítem
        router.put('/items/:item_id/cantidad', async (req, res) => {
            try {
                const itemId = parseInt(req.params.item_id);
                const { nueva_cantidad, garzon_codigo } = req.body;

                if (!nueva_cantidad || !garzon_codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nueva cantidad y código de garzón son requeridos'
                    });
                }

                if (nueva_cantidad <= 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'La cantidad debe ser mayor a 0'
                    });
                }

                const resultado = await this.ventasManager.modificarCantidadItem(
                    itemId,
                    parseFloat(nueva_cantidad),
                    garzon_codigo
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error modificando cantidad:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Eliminar ítem
        router.delete('/items/:item_id', async (req, res) => {
            try {
                const itemId = parseInt(req.params.item_id);
                const { garzon_codigo, motivo } = req.body;

                if (!garzon_codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Código de garzón es requerido'
                    });
                }

                const resultado = await this.ventasManager.eliminarItem(
                    itemId,
                    garzon_codigo,
                    motivo
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error eliminando ítem:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener venta activa por mesa
        router.get('/mesa/:mesa_id/activa', async (req, res) => {
            try {
                const mesaId = parseInt(req.params.mesa_id);

                if (!mesaId || isNaN(mesaId)) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de mesa inválido'
                    });
                }

                const venta = await this.ventasManager.obtenerVentaActivaPorMesa(mesaId);

                if (!venta) {
                    return res.json({
                        success: true,
                        venta: null,
                        mensaje: 'No hay venta activa en esta mesa'
                    });
                }

                // Obtener detalles completos
                const ventaCompleta = await this.ventasManager.obtenerVentaCompleta(venta.id);

                res.json({
                    success: true,
                    venta: ventaCompleta
                });

            } catch (error) {
                console.error('❌ Error obteniendo venta activa:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Cambiar estado de venta
        router.put('/:id/estado', async (req, res) => {
            try {
                const ventaId = parseInt(req.params.id);
                const { nuevo_estado, garzon_codigo, observaciones } = req.body;

                if (!nuevo_estado || !garzon_codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nuevo estado y código de garzón son requeridos'
                    });
                }

                const resultado = await this.cambiarEstadoVenta(ventaId, {
                    nuevo_estado,
                    garzon_codigo,
                    observaciones
                });

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error cambiando estado:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener productos disponibles para venta
        router.get('/productos/disponibles', async (req, res) => {
            try {
                const { categoria_id, buscar } = req.query;

                let query = `
                    SELECT
                        p.*,
                        c.nombre as categoria_nombre,
                        ec.nombre as estacion_nombre,
                        ec.color as estacion_color
                    FROM productos p
                    LEFT JOIN categorias c ON p.categoria_id = c.id
                    LEFT JOIN estaciones_cocina ec ON p.estacion_id = ec.id
                    WHERE p.activo = 1
                `;

                const params = [];

                // Filtrar por categoría si se especifica
                if (categoria_id) {
                    query += ` AND p.categoria_id = ?`;
                    params.push(parseInt(categoria_id));
                }

                // Búsqueda por nombre/código
                if (buscar) {
                    query += ` AND (p.nombre LIKE ? OR p.codigo LIKE ?)`;
                    params.push(`%${buscar}%`, `%${buscar}%`);
                }

                query += ` ORDER BY c.orden ASC, p.nombre ASC`;

                const [productos] = await this.db.connection.execute(query, params);

                res.json({
                    success: true,
                    productos: productos
                });

            } catch (error) {
                console.error('❌ Error obteniendo productos:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener categorías activas
        router.get('/categorias/activas', async (req, res) => {
            try {
                const [categorias] = await this.db.connection.execute(`
                    SELECT * FROM categorias
                    WHERE activo = 1
                    ORDER BY orden ASC
                `);

                res.json({
                    success: true,
                    categorias: categorias
                });

            } catch (error) {
                console.error('❌ Error obteniendo categorías:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener resumen de ventas del día
        router.get('/resumen/dia', async (req, res) => {
            try {
                const { fecha } = req.query;
                const fechaConsulta = fecha || new Date().toISOString().split('T')[0];

                const [resumen] = await this.db.connection.execute(`
                    SELECT
                        COUNT(*) as total_ventas,
                        COALESCE(SUM(total), 0) as total_ingresos,
                        COUNT(CASE WHEN estado = 'cerrada' THEN 1 END) as ventas_cerradas,
                        COUNT(CASE WHEN estado != 'cerrada' AND estado != 'cancelada' THEN 1 END) as ventas_activas
                    FROM ventas
                    WHERE DATE(created_at) = ?
                `, [fechaConsulta]);

                res.json({
                    success: true,
                    resumen: resumen[0],
                    fecha: fechaConsulta
                });

            } catch (error) {
                console.error('❌ Error obteniendo resumen:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    // Método auxiliar para cambiar estado de venta
    async cambiarEstadoVenta(ventaId, datos) {
        try {
            const { nuevo_estado, garzon_codigo, observaciones } = datos;

            // Validar garzón
            const garzon = await this.ventasManager.validarGarzon(garzon_codigo);
            if (!garzon.valido) {
                throw new Error(`Garzón no válido: ${garzon.error}`);
            }

            // Validar estado
            const estadosValidos = Object.values(this.ventasManager.ESTADOS_VENTA);
            if (!estadosValidos.includes(nuevo_estado)) {
                throw new Error(`Estado inválido: ${nuevo_estado}`);
            }

            // Obtener venta actual
            const venta = await this.ventasManager.obtenerVentaPorId(ventaId);
            if (!venta) {
                throw new Error('Venta no encontrada');
            }

            // Actualizar estado
            await this.db.connection.execute(`
                UPDATE ventas
                SET estado = ?, observaciones = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [nuevo_estado, observaciones, ventaId]);

            // Si se cierra la venta, actualizar mesa
            if (nuevo_estado === this.ventasManager.ESTADOS_VENTA.CERRADA) {
                await this.db.connection.execute(`
                    UPDATE mesas SET estado = 'libre', updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [venta.mesa_id]);
            }

            // Registrar auditoría
            await this.ventasManager.registrarAuditoria({
                usuario_id: garzon.id,
                accion: 'cambiar_estado_venta',
                tabla: 'ventas',
                registro_id: ventaId,
                detalles: JSON.stringify({
                    estado_anterior: venta.estado,
                    estado_nuevo: nuevo_estado,
                    observaciones
                })
            });

            console.log(`✅ Estado de venta ${ventaId} cambiado: ${venta.estado} → ${nuevo_estado}`);

            return {
                success: true,
                estado_anterior: venta.estado,
                estado_nuevo: nuevo_estado
            };

        } catch (error) {
            console.error('❌ Error cambiando estado de venta:', error);
            throw error;
        }
    }

    getRouter() {
        return router;
    }
}

module.exports = VentasRoutes;