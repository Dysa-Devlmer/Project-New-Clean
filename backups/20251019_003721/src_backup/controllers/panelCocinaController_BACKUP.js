/**
 * CONTROLADOR DE PANEL DE COCINA
 *
 * Vista en tiempo real para cocina/barra
 * Muestra pedidos pendientes de servir
 * Permite marcar productos como servidos
 *
 * @author Claude Code
 * @date 2025-10-04
 */

const db = require('../config/database');

/**
 * Obtener pedidos pendientes para cocina/barra
 * Muestra solo productos que han sido enviados a cocina pero no servidos
 */
exports.obtenerPedidosPendientes = async (req, res) => {
    try {
        const { tipo = 'cocina' } = req.query; // 'cocina' o 'barra'

        // Obtener ventas que tienen productos pendientes
        const [ventas] = await db.execute(
            `SELECT DISTINCT
                v.id_venta,
                v.Num_Mesa,
                m.descripcion as mesa_descripcion,
                v.num_personas,
                v.fecha_venta,
                v.hora_venta,
                c.nombre as camarero
            FROM ventas v
            INNER JOIN lineas_venta lv ON v.id_venta = lv.id_venta
            INNER JOIN productos p ON lv.id_producto = p.id_producto
            LEFT JOIN mesas m ON v.Num_Mesa = m.Num_Mesa
            LEFT JOIN usuarios c ON v.id_camarero = c.id_usuario
            WHERE v.estado = 'abierta'
              AND lv.eliminado = 'N'
              AND lv.cantidad_enviada_cocina > lv.cantidad_servida
              AND p.${tipo} = 'Y'
            ORDER BY v.fecha_venta, v.hora_venta`
        );

        // Por cada venta, obtener productos pendientes agrupados por bloque
        for (let venta of ventas) {
            const [productos] = await db.execute(
                `SELECT
                    lv.id_linea,
                    lv.id_producto,
                    p.nombre as producto_nombre,
                    cat.nombre as categoria_nombre,
                    cat.color as categoria_color,
                    lv.cantidad,
                    lv.cantidad_enviada_cocina,
                    lv.cantidad_servida,
                    (lv.cantidad_enviada_cocina - lv.cantidad_servida) as pendiente,
                    lv.nota,
                    lv.observaciones,
                    lv.bloque_cocina,
                    lv.fecha_envio_cocina
                FROM lineas_venta lv
                INNER JOIN productos p ON lv.id_producto = p.id_producto
                LEFT JOIN categorias cat ON p.id_categoria = cat.id_tipo_comg
                WHERE lv.id_venta = ?
                  AND lv.eliminado = 'N'
                  AND lv.cantidad_enviada_cocina > lv.cantidad_servida
                  AND p.${tipo} = 'Y'
                ORDER BY lv.bloque_cocina, lv.fecha_envio_cocina`,
                [venta.id_venta]
            );

            venta.productos = productos;
        }

        res.json({
            success: true,
            ventas,
            tipo
        });
    } catch (error) {
        console.error('Error al obtener pedidos pendientes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pedidos pendientes',
            error: error.message
        });
    }
};

/**
 * Marcar producto(s) como servido
 * Puede marcar una línea específica o toda la venta
 */
exports.marcarServido = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const { id_venta, id_linea = null, cantidad = null } = req.body;

        if (!id_venta) {
            return res.status(400).json({
                success: false,
                message: 'ID de venta es obligatorio'
            });
        }

        await connection.beginTransaction();

        if (id_linea && id_linea > 0) {
            // Marcar línea específica como servida

            // Obtener cantidad pendiente
            const [lineas] = await connection.execute(
                `SELECT cantidad_enviada_cocina, cantidad_servida
                FROM lineas_venta
                WHERE id_linea = ? AND id_venta = ?`,
                [id_linea, id_venta]
            );

            if (lineas.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Línea no encontrada'
                });
            }

            const pendiente = lineas[0].cantidad_enviada_cocina - lineas[0].cantidad_servida;
            const cantidadServir = cantidad || pendiente;

            if (cantidadServir > pendiente) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Cantidad a servir excede la cantidad pendiente'
                });
            }

            await connection.execute(
                `UPDATE lineas_venta
                SET cantidad_servida = cantidad_servida + ?
                WHERE id_linea = ?`,
                [cantidadServir, id_linea]
            );

        } else {
            // Marcar toda la venta como servida
            await connection.execute(
                `UPDATE lineas_venta
                SET cantidad_servida = cantidad_enviada_cocina
                WHERE id_venta = ?
                  AND eliminado = 'N'
                  AND cantidad_enviada_cocina > cantidad_servida`,
                [id_venta]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            message: id_linea ? 'Producto marcado como servido' : 'Todos los productos marcados como servidos'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al marcar como servido:', error);
        res.status(500).json({
            success: false,
            message: 'Error al marcar como servido',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Obtener estadísticas del panel de cocina
 */
exports.obtenerEstadisticas = async (req, res) => {
    try {
        const { tipo = 'cocina' } = req.query;

        // Total de ventas pendientes
        const [ventasPendientes] = await db.execute(
            `SELECT COUNT(DISTINCT v.id_venta) as total
            FROM ventas v
            INNER JOIN lineas_venta lv ON v.id_venta = lv.id_venta
            INNER JOIN productos p ON lv.id_producto = p.id_producto
            WHERE v.estado = 'abierta'
              AND lv.eliminado = 'N'
              AND lv.cantidad_enviada_cocina > lv.cantidad_servida
              AND p.${tipo} = 'Y'`
        );

        // Total de productos pendientes
        const [productosPendientes] = await db.execute(
            `SELECT SUM(lv.cantidad_enviada_cocina - lv.cantidad_servida) as total
            FROM lineas_venta lv
            INNER JOIN productos p ON lv.id_producto = p.id_producto
            INNER JOIN ventas v ON lv.id_venta = v.id_venta
            WHERE v.estado = 'abierta'
              AND lv.eliminado = 'N'
              AND lv.cantidad_enviada_cocina > lv.cantidad_servida
              AND p.${tipo} = 'Y'`
        );

        // Pedido más antiguo
        const [pedidoAntiguo] = await db.execute(
            `SELECT MIN(lv.fecha_envio_cocina) as fecha_antiguo
            FROM lineas_venta lv
            INNER JOIN productos p ON lv.id_producto = p.id_producto
            INNER JOIN ventas v ON lv.id_venta = v.id_venta
            WHERE v.estado = 'abierta'
              AND lv.eliminado = 'N'
              AND lv.cantidad_enviada_cocina > lv.cantidad_servida
              AND p.${tipo} = 'Y'`
        );

        res.json({
            success: true,
            estadisticas: {
                ventas_pendientes: ventasPendientes[0].total || 0,
                productos_pendientes: productosPendientes[0].total || 0,
                pedido_mas_antiguo: pedidoAntiguo[0].fecha_antiguo
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas',
            error: error.message
        });
    }
};
