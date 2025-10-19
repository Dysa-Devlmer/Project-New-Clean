/**
 * =====================================================
 * CONTROLADOR DE PRE-TICKETS CORREGIDO
 * Descripción: Manejo de tickets temporales adaptado al esquema real
 * Autor: Devlmer - Dysa - CORREGIDO por Claude Code
 * Fecha: 2025-10-18 03:00 AM
 * ESTADO: CORREGIDO COMPLETAMENTE - Esquema real
 * =====================================================
 */

const { pool } = require('../config/database');

/**
 * FUNCIONALIDAD ADAPTADA:
 * - Usa ventadirecta con estado = 'BORRADOR' para pretickets
 * - Usa ventadir_comg para productos temporales
 * - Convierte a estado = 'ABIERTA' al confirmar
 * - Esquema compatible con base de datos real
 */

// Obtener todos los pre-tickets activos (ventas en borrador)
const obtenerPretickets = async (req, res) => {
    try {
        const { mesa, estado = 'BORRADOR' } = req.query;

        let query = `
            SELECT
                vd.id_venta as id_preticket,
                vd.Num_Mesa,
                vd.id_empleado,
                e.nombre as nombre_empleado,
                vd.total,
                vd.estado,
                vd.observaciones,
                vd.fecha_hora as fecha_creacion,
                vd.fecha_cierre as fecha_confirmacion,
                vd.id_tarifa,
                t.descripcion as nombre_tarifa,
                mr.descripcion as descripcion_mesa,
                COUNT(vc.id_linea) as items_count
            FROM ventadirecta vd
            INNER JOIN empleados e ON vd.id_empleado = e.id_empleado
            INNER JOIN mesas_restaurante mr ON vd.Num_Mesa = mr.numero_mesa
            LEFT JOIN tarifa t ON vd.id_tarifa = t.id_tarifa
            LEFT JOIN ventadir_comg vc ON vd.id_venta = vc.id_venta
            WHERE vd.estado = ?
        `;

        const params = [estado];

        if (mesa) {
            query += ' AND vd.Num_Mesa = ?';
            params.push(mesa);
        }

        query += `
            GROUP BY vd.id_venta, vd.Num_Mesa, vd.id_empleado, e.nombre,
                     vd.total, vd.estado, vd.observaciones, vd.fecha_hora,
                     vd.fecha_cierre, vd.id_tarifa, t.descripcion, mr.descripcion
            ORDER BY vd.fecha_hora DESC
        `;

        const [pretickets] = await pool.query(query, params);

        res.json({
            success: true,
            data: pretickets,
            message: `Encontrados ${pretickets.length} pre-tickets en estado ${estado}`
        });

    } catch (error) {
        console.error('Error al obtener pre-tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener un pre-ticket específico con sus productos
const obtenerPreticket = async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener datos del pre-ticket
        const [preticket] = await pool.query(`
            SELECT
                vd.*,
                e.nombre as nombre_empleado,
                e.apellido as apellido_empleado,
                mr.descripcion as descripcion_mesa,
                mr.zona as zona_mesa,
                t.descripcion as nombre_tarifa
            FROM ventadirecta vd
            INNER JOIN empleados e ON vd.id_empleado = e.id_empleado
            INNER JOIN mesas_restaurante mr ON vd.Num_Mesa = mr.numero_mesa
            LEFT JOIN tarifa t ON vd.id_tarifa = t.id_tarifa
            WHERE vd.id_venta = ? AND vd.estado = 'BORRADOR'
        `, [id]);

        if (preticket.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pre-ticket no encontrado o ya procesado'
            });
        }

        // Obtener productos del pre-ticket
        const [productos] = await pool.query(`
            SELECT
                vc.id_linea,
                vc.id_venta,
                vc.id_complementog,
                p.alias as nombre_producto,
                p.precio as precio_base,
                vc.cantidad,
                vc.precio_unitario,
                vc.subtotal_linea,
                vc.observaciones,
                vc.estado_preparacion,
                vc.hora_cocina,
                cp.descripcion as categoria
            FROM ventadir_comg vc
            INNER JOIN productos p ON vc.id_complementog = p.id_complementog
            LEFT JOIN categorias_productos cp ON p.id_categoria = cp.id_categoria
            WHERE vc.id_venta = ?
            ORDER BY vc.hora_cocina ASC
        `, [id]);

        // Calcular resumen
        const resumen = {
            total_items: productos.length,
            subtotal: productos.reduce((sum, p) => sum + parseFloat(p.subtotal_linea || 0), 0),
            productos_por_categoria: productos.reduce((acc, p) => {
                const cat = p.categoria || 'Sin categoría';
                acc[cat] = (acc[cat] || 0) + parseInt(p.cantidad);
                return acc;
            }, {})
        };

        res.json({
            success: true,
            data: {
                ...preticket[0],
                productos: productos,
                resumen: resumen
            }
        });

    } catch (error) {
        console.error('Error al obtener pre-ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Crear nuevo pre-ticket (venta en borrador)
const crearPreticket = async (req, res) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const {
            Num_Mesa,
            id_empleado,
            productos = [],
            observaciones = null,
            id_tarifa = null
        } = req.body;

        // Validaciones básicas
        if (!Num_Mesa || !id_empleado) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'Mesa y empleado son requeridos'
            });
        }

        // Verificar que la mesa existe y está disponible
        const [mesa] = await conn.execute(`
            SELECT numero_mesa, descripcion, estado
            FROM mesas_restaurante
            WHERE numero_mesa = ? AND activa = 1
        `, [Num_Mesa]);

        if (mesa.length === 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'Mesa no encontrada o no disponible'
            });
        }

        // Verificar que el empleado existe
        const [empleado] = await conn.execute(`
            SELECT id_empleado, nombre, activo
            FROM empleados
            WHERE id_empleado = ? AND activo = 1
        `, [id_empleado]);

        if (empleado.length === 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'Empleado no encontrado o no activo'
            });
        }

        // Crear el pre-ticket (venta en borrador)
        const [result] = await conn.execute(`
            INSERT INTO ventadirecta (
                Num_Mesa,
                id_empleado,
                observaciones,
                id_tarifa,
                estado,
                fecha_hora,
                cerrada
            ) VALUES (?, ?, ?, ?, 'BORRADOR', NOW(), 'N')
        `, [Num_Mesa, id_empleado, observaciones, id_tarifa]);

        const id_venta = result.insertId;
        let total_venta = 0;

        // Agregar productos si se proporcionaron
        for (const producto of productos) {
            const { id_complementog, cantidad, observaciones_producto = null } = producto;

            if (!id_complementog || !cantidad || cantidad <= 0) {
                continue; // Saltar productos inválidos
            }

            // Obtener información del producto
            const [infoProducto] = await conn.execute(`
                SELECT precio, alias, activo
                FROM productos
                WHERE id_complementog = ? AND activo = 1
            `, [id_complementog]);

            if (infoProducto.length === 0) {
                continue; // Saltar productos no encontrados
            }

            let precio_unitario = infoProducto[0].precio;

            // Aplicar tarifa si existe
            if (id_tarifa) {
                const [precioTarifa] = await conn.execute(`
                    SELECT precio_con_tarifa
                    FROM productos_tarifas
                    WHERE id_producto = ? AND id_tarifa = ?
                `, [id_complementog, id_tarifa]);

                if (precioTarifa.length > 0) {
                    precio_unitario = precioTarifa[0].precio_con_tarifa;
                }
            }

            const subtotal = cantidad * precio_unitario;
            total_venta += subtotal;

            // Insertar línea de venta
            await conn.execute(`
                INSERT INTO ventadir_comg (
                    id_venta,
                    id_complementog,
                    cantidad,
                    precio_unitario,
                    subtotal_linea,
                    observaciones,
                    estado_preparacion,
                    hora_cocina
                ) VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE', NOW())
            `, [id_venta, id_complementog, cantidad, precio_unitario, subtotal, observaciones_producto]);
        }

        // Actualizar total de la venta
        await conn.execute(`
            UPDATE ventadirecta
            SET total = ?
            WHERE id_venta = ?
        `, [total_venta, id_venta]);

        // Marcar mesa como ocupada
        await conn.execute(`
            UPDATE mesas_restaurante
            SET estado = 'OCUPADA'
            WHERE numero_mesa = ?
        `, [Num_Mesa]);

        await conn.commit();

        // Obtener el pre-ticket creado completo
        const [preticketCreado] = await pool.query(`
            SELECT
                vd.*,
                e.nombre as nombre_empleado,
                mr.descripcion as descripcion_mesa
            FROM ventadirecta vd
            INNER JOIN empleados e ON vd.id_empleado = e.id_empleado
            INNER JOIN mesas_restaurante mr ON vd.Num_Mesa = mr.numero_mesa
            WHERE vd.id_venta = ?
        `, [id_venta]);

        res.status(201).json({
            success: true,
            message: 'Pre-ticket creado exitosamente',
            data: {
                id_preticket: id_venta,
                ...preticketCreado[0],
                productos_agregados: productos.length,
                total_calculado: total_venta
            }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error al crear pre-ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    } finally {
        conn.release();
    }
};

// Agregar producto a pre-ticket existente
const agregarProducto = async (req, res) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const { id } = req.params;
        const { id_complementog, cantidad, observaciones = null } = req.body;

        // Validaciones básicas
        if (!id_complementog || !cantidad || cantidad <= 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'ID del producto y cantidad válida son requeridos'
            });
        }

        // Verificar que el pre-ticket existe y está en borrador
        const [preticket] = await conn.execute(`
            SELECT * FROM ventadirecta
            WHERE id_venta = ? AND estado = 'BORRADOR'
        `, [id]);

        if (preticket.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                success: false,
                message: 'Pre-ticket no encontrado o ya confirmado'
            });
        }

        // Obtener información del producto
        const [producto] = await conn.execute(`
            SELECT precio, alias, activo
            FROM productos
            WHERE id_complementog = ? AND activo = 1
        `, [id_complementog]);

        if (producto.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado o no disponible'
            });
        }

        let precio_unitario = producto[0].precio;
        const id_tarifa = preticket[0].id_tarifa;

        // Aplicar tarifa si existe
        if (id_tarifa) {
            const [precioTarifa] = await conn.execute(`
                SELECT precio_con_tarifa
                FROM productos_tarifas
                WHERE id_producto = ? AND id_tarifa = ?
            `, [id_complementog, id_tarifa]);

            if (precioTarifa.length > 0) {
                precio_unitario = precioTarifa[0].precio_con_tarifa;
            }
        }

        const subtotal = cantidad * precio_unitario;

        // Insertar producto
        await conn.execute(`
            INSERT INTO ventadir_comg (
                id_venta,
                id_complementog,
                cantidad,
                precio_unitario,
                subtotal_linea,
                observaciones,
                estado_preparacion,
                hora_cocina
            ) VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE', NOW())
        `, [id, id_complementog, cantidad, precio_unitario, subtotal, observaciones]);

        // Recalcular total de la venta
        const [nuevoTotal] = await conn.execute(`
            SELECT SUM(subtotal_linea) as total
            FROM ventadir_comg
            WHERE id_venta = ?
        `, [id]);

        await conn.execute(`
            UPDATE ventadirecta
            SET total = ?
            WHERE id_venta = ?
        `, [nuevoTotal[0].total || 0, id]);

        await conn.commit();

        res.json({
            success: true,
            message: 'Producto agregado exitosamente',
            data: {
                producto_agregado: producto[0].alias,
                cantidad: cantidad,
                precio_unitario: precio_unitario,
                subtotal: subtotal,
                nuevo_total: nuevoTotal[0].total || 0
            }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error al agregar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    } finally {
        conn.release();
    }
};

// Confirmar pre-ticket (convertirlo en venta real)
const confirmarPreticket = async (req, res) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const { id } = req.params;

        // Verificar que el pre-ticket existe y está en borrador
        const [preticket] = await conn.execute(`
            SELECT * FROM ventadirecta
            WHERE id_venta = ? AND estado = 'BORRADOR'
        `, [id]);

        if (preticket.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                success: false,
                message: 'Pre-ticket no encontrado o ya procesado'
            });
        }

        // Verificar que tiene productos
        const [productos] = await conn.execute(`
            SELECT COUNT(*) as total_productos
            FROM ventadir_comg
            WHERE id_venta = ?
        `, [id]);

        if (productos[0].total_productos === 0) {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'No se puede confirmar un pre-ticket sin productos'
            });
        }

        // Confirmar el pre-ticket (cambiar estado a ABIERTA)
        await conn.execute(`
            UPDATE ventadirecta
            SET estado = 'ABIERTA',
                fecha_hora = NOW()
            WHERE id_venta = ?
        `, [id]);

        // Actualizar estado de preparación de productos
        await conn.execute(`
            UPDATE ventadir_comg
            SET estado_preparacion = 'EN_PREPARACION'
            WHERE id_venta = ? AND estado_preparacion = 'PENDIENTE'
        `, [id]);

        // Registrar en log de ventas
        await conn.execute(`
            INSERT INTO log_operaciones (
                tabla_afectada,
                operacion,
                id_registro,
                descripcion,
                usuario_id,
                fecha_hora
            ) VALUES (
                'ventadirecta',
                'CONFIRMAR_PRETICKET',
                ?,
                CONCAT('Pre-ticket confirmado - Mesa: ', ?),
                ?,
                NOW()
            )
        `, [id, preticket[0].Num_Mesa, preticket[0].id_empleado]);

        await conn.commit();

        res.json({
            success: true,
            message: 'Pre-ticket confirmado exitosamente - Venta activa',
            data: {
                id_venta: id,
                estado_anterior: 'BORRADOR',
                estado_actual: 'ABIERTA',
                mesa: preticket[0].Num_Mesa,
                total: preticket[0].total
            }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error al confirmar pre-ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    } finally {
        conn.release();
    }
};

// Cancelar pre-ticket
const cancelarPreticket = async (req, res) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const { id } = req.params;

        // Verificar que el pre-ticket existe
        const [preticket] = await conn.execute(`
            SELECT * FROM ventadirecta
            WHERE id_venta = ? AND estado = 'BORRADOR'
        `, [id]);

        if (preticket.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                success: false,
                message: 'Pre-ticket no encontrado o ya procesado'
            });
        }

        // Eliminar productos del pre-ticket
        await conn.execute(`
            DELETE FROM ventadir_comg
            WHERE id_venta = ?
        `, [id]);

        // Eliminar el pre-ticket
        await conn.execute(`
            DELETE FROM ventadirecta
            WHERE id_venta = ?
        `, [id]);

        // Liberar la mesa
        await conn.execute(`
            UPDATE mesas_restaurante
            SET estado = 'LIBRE'
            WHERE numero_mesa = ?
        `, [preticket[0].Num_Mesa]);

        // Registrar en log
        await conn.execute(`
            INSERT INTO log_operaciones (
                tabla_afectada,
                operacion,
                id_registro,
                descripcion,
                usuario_id,
                fecha_hora
            ) VALUES (
                'ventadirecta',
                'CANCELAR_PRETICKET',
                ?,
                CONCAT('Pre-ticket cancelado - Mesa: ', ?),
                ?,
                NOW()
            )
        `, [id, preticket[0].Num_Mesa, preticket[0].id_empleado]);

        await conn.commit();

        res.json({
            success: true,
            message: 'Pre-ticket cancelado exitosamente',
            data: {
                id_cancelado: id,
                mesa_liberada: preticket[0].Num_Mesa
            }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error al cancelar pre-ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    } finally {
        conn.release();
    }
};

// Eliminar producto de pre-ticket
const eliminarProducto = async (req, res) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const { id, id_producto } = req.params;

        // Verificar que el pre-ticket está en borrador
        const [preticket] = await conn.execute(`
            SELECT estado FROM ventadirecta WHERE id_venta = ?
        `, [id]);

        if (preticket.length === 0 || preticket[0].estado !== 'BORRADOR') {
            await conn.rollback();
            return res.status(400).json({
                success: false,
                message: 'No se puede modificar este pre-ticket'
            });
        }

        // Verificar que el producto existe en el pre-ticket
        const [producto] = await conn.execute(`
            SELECT vc.*, p.alias as nombre_producto
            FROM ventadir_comg vc
            INNER JOIN productos p ON vc.id_complementog = p.id_complementog
            WHERE vc.id_linea = ? AND vc.id_venta = ?
        `, [id_producto, id]);

        if (producto.length === 0) {
            await conn.rollback();
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado en este pre-ticket'
            });
        }

        // Eliminar el producto
        await conn.execute(`
            DELETE FROM ventadir_comg
            WHERE id_linea = ? AND id_venta = ?
        `, [id_producto, id]);

        // Recalcular total de la venta
        const [nuevoTotal] = await conn.execute(`
            SELECT COALESCE(SUM(subtotal_linea), 0) as total
            FROM ventadir_comg
            WHERE id_venta = ?
        `, [id]);

        await conn.execute(`
            UPDATE ventadirecta
            SET total = ?
            WHERE id_venta = ?
        `, [nuevoTotal[0].total, id]);

        await conn.commit();

        res.json({
            success: true,
            message: 'Producto eliminado exitosamente',
            data: {
                producto_eliminado: producto[0].nombre_producto,
                subtotal_recuperado: producto[0].subtotal_linea,
                nuevo_total: nuevoTotal[0].total
            }
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error al eliminar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    } finally {
        conn.release();
    }
};

module.exports = {
    obtenerPretickets,
    obtenerPreticket,
    crearPreticket,
    agregarProducto,
    confirmarPreticket,
    cancelarPreticket,
    eliminarProducto
};