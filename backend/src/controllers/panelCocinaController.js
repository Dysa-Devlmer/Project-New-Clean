/**
 * CONTROLADOR DE PANEL DE COCINA - SISTEMA REAL COMPLETAMENTE CORREGIDO
 *
 * Vista en tiempo real para cocina/barra
 * Muestra pedidos pendientes de servir
 * Permite marcar productos como servidos
 *
 * @author Claude Code - CORREGIDO PARA ESQUEMA REAL
 * @date 2025-10-18
 */

const { pool } = require('../config/database');

/**
 * Obtener pedidos pendientes para cocina/barra - CORREGIDO
 * Muestra solo productos que han sido enviados a cocina pero no servidos
 */
exports.obtenerPedidosPendientes = async (req, res) => {
    try {
        const { tipo = 'cocina' } = req.query; // 'cocina' o 'barra'

        // Obtener ventas que tienen productos pendientes - ESQUEMA CORREGIDO
        const [ventas] = await pool.execute(
            `SELECT DISTINCT
                vp.id,
                vp.numero_venta,
                mr.numero_mesa,
                mr.descripcion_mesa,
                vp.numero_comensales,
                vp.fecha_venta,
                vp.hora_inicio,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as empleado_vendedor,
                vp.estado_venta,
                vp.observaciones_generales
            FROM ventas_principales vp
            INNER JOIN venta_detalles vd ON vp.id = vd.venta_id
            INNER JOIN productos p ON vd.producto_id = p.id
            LEFT JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            LEFT JOIN empleados e ON vp.empleado_vendedor_id = e.id
            WHERE vp.estado_venta IN ('ABIERTA', 'EN_PREPARACION')
              AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
              AND p.requiere_preparacion = 1
              AND (? = 'cocina' AND p.categoria_preparacion = 'COCINA' OR
                   ? = 'barra' AND p.categoria_preparacion = 'BARRA' OR
                   ? = 'todos')
            ORDER BY vp.fecha_venta, vp.hora_inicio`,
            [tipo, tipo, tipo]
        );

        // Por cada venta, obtener productos pendientes agrupados por estado
        for (let venta of ventas) {
            const [productos] = await pool.execute(
                `SELECT
                    vd.id,
                    vd.numero_linea,
                    vd.producto_id,
                    p.nombre_producto,
                    p.codigo_producto,
                    cp.nombre_categoria,
                    cp.color_categoria,
                    vd.cantidad,
                    vd.precio_unitario,
                    vd.subtotal_linea,
                    vd.observaciones_item,
                    vd.estado_preparacion,
                    vd.timestamp_envio_cocina,
                    vd.timestamp_inicio_preparacion,
                    vd.prioridad_preparacion,
                    TIMESTAMPDIFF(MINUTE, vd.timestamp_envio_cocina, NOW()) as minutos_espera
                FROM venta_detalles vd
                INNER JOIN productos p ON vd.producto_id = p.id
                LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
                WHERE vd.venta_id = ?
                  AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
                  AND p.requiere_preparacion = 1
                  AND (? = 'cocina' AND p.categoria_preparacion = 'COCINA' OR
                       ? = 'barra' AND p.categoria_preparacion = 'BARRA' OR
                       ? = 'todos')
                ORDER BY vd.prioridad_preparacion DESC, vd.timestamp_envio_cocina ASC`,
                [venta.id, tipo, tipo, tipo]
            );

            venta.productos = productos;
            venta.total_productos_pendientes = productos.length;
            venta.tiempo_espera_maximo = productos.length > 0 ? Math.max(...productos.map(p => p.minutos_espera)) : 0;
        }

        // Filtrar ventas que realmente tienen productos pendientes
        const ventasConProductos = ventas.filter(v => v.productos.length > 0);

        res.json({
            success: true,
            ventas: ventasConProductos,
            total_ventas: ventasConProductos.length,
            total_productos: ventasConProductos.reduce((sum, v) => sum + v.total_productos_pendientes, 0),
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
 * Marcar producto(s) como servido - CORREGIDO
 * Puede marcar una línea específica o toda la venta
 */
exports.marcarServido = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { venta_id, detalle_id = null, estado_nuevo = 'SERVIDO', empleado_id } = req.body;

        if (!venta_id) {
            return res.status(400).json({
                success: false,
                message: 'ID de venta es obligatorio'
            });
        }

        await connection.beginTransaction();

        if (detalle_id && detalle_id > 0) {
            // Marcar línea específica como servida
            const [detalles] = await connection.execute(
                `SELECT vd.*, p.nombre_producto
                FROM venta_detalles vd
                INNER JOIN productos p ON vd.producto_id = p.id
                WHERE vd.id = ? AND vd.venta_id = ?`,
                [detalle_id, venta_id]
            );

            if (detalles.length === 0) {
                await connection.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Línea de venta no encontrada'
                });
            }

            const detalle = detalles[0];

            // Validar transición de estado
            if (detalle.estado_preparacion === 'SERVIDO') {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Este producto ya está marcado como servido'
                });
            }

            // Actualizar estado del detalle
            await connection.execute(
                `UPDATE venta_detalles
                SET estado_preparacion = ?,
                    timestamp_servido = CURRENT_TIMESTAMP,
                    empleado_servicio_id = ?
                WHERE id = ?`,
                [estado_nuevo, empleado_id, detalle_id]
            );

            // Registrar en log de cocina
            await connection.execute(
                `INSERT INTO logs_cocina
                (venta_id, detalle_id, producto_id, accion, estado_anterior, estado_nuevo, empleado_id, observaciones)
                VALUES (?, ?, ?, 'MARCAR_SERVIDO', ?, ?, ?, ?)`,
                [venta_id, detalle_id, detalle.producto_id, detalle.estado_preparacion, estado_nuevo, empleado_id,
                 `Producto ${detalle.nombre_producto} marcado como ${estado_nuevo}`]
            );

        } else {
            // Marcar toda la venta como servida
            const [detallesPendientes] = await connection.execute(
                `SELECT vd.id, vd.producto_id, p.nombre_producto
                FROM venta_detalles vd
                INNER JOIN productos p ON vd.producto_id = p.id
                WHERE vd.venta_id = ?
                  AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
                  AND p.requiere_preparacion = 1`,
                [venta_id]
            );

            if (detallesPendientes.length === 0) {
                await connection.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'No hay productos pendientes para marcar como servidos'
                });
            }

            // Actualizar todos los detalles pendientes
            await connection.execute(
                `UPDATE venta_detalles vd
                INNER JOIN productos p ON vd.producto_id = p.id
                SET vd.estado_preparacion = 'SERVIDO',
                    vd.timestamp_servido = CURRENT_TIMESTAMP,
                    vd.empleado_servicio_id = ?
                WHERE vd.venta_id = ?
                  AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
                  AND p.requiere_preparacion = 1`,
                [empleado_id, venta_id]
            );

            // Registrar en log de cocina para cada producto
            for (const detalle of detallesPendientes) {
                await connection.execute(
                    `INSERT INTO logs_cocina
                    (venta_id, detalle_id, producto_id, accion, estado_anterior, estado_nuevo, empleado_id, observaciones)
                    VALUES (?, ?, ?, 'MARCAR_SERVIDO_MASIVO', 'EN_PREPARACION', 'SERVIDO', ?, ?)`,
                    [venta_id, detalle.id, detalle.producto_id, empleado_id,
                     `Producto ${detalle.nombre_producto} marcado como servido (acción masiva)`]
                );
            }
        }

        // Verificar si toda la venta está servida para actualizar estado principal
        const [pendientesRestantes] = await connection.execute(
            `SELECT COUNT(*) as total
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            WHERE vd.venta_id = ?
              AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
              AND p.requiere_preparacion = 1`,
            [venta_id]
        );

        if (pendientesRestantes[0].total === 0) {
            // Todas las líneas están servidas, actualizar estado de la venta
            await connection.execute(
                `UPDATE ventas_principales
                SET estado_venta = 'SERVIDA'
                WHERE id = ? AND estado_venta != 'PAGADA'`,
                [venta_id]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            message: detalle_id ? 'Producto marcado como servido' : 'Todos los productos marcados como servidos',
            productos_actualizados: detalle_id ? 1 : detallesPendientes?.length || 0
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
 * Obtener estadísticas del panel de cocina - CORREGIDO
 */
exports.obtenerEstadisticas = async (req, res) => {
    try {
        const { tipo = 'cocina' } = req.query;

        // Total de ventas pendientes - ESQUEMA CORREGIDO
        const [ventasPendientes] = await pool.execute(
            `SELECT COUNT(DISTINCT vp.id) as total
            FROM ventas_principales vp
            INNER JOIN venta_detalles vd ON vp.id = vd.venta_id
            INNER JOIN productos p ON vd.producto_id = p.id
            WHERE vp.estado_venta IN ('ABIERTA', 'EN_PREPARACION', 'SERVIDA')
              AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
              AND p.requiere_preparacion = 1
              AND (? = 'cocina' AND p.categoria_preparacion = 'COCINA' OR
                   ? = 'barra' AND p.categoria_preparacion = 'BARRA' OR
                   ? = 'todos')`,
            [tipo, tipo, tipo]
        );

        // Total de productos pendientes
        const [productosPendientes] = await pool.execute(
            `SELECT COUNT(*) as total
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            INNER JOIN ventas_principales vp ON vd.venta_id = vp.id
            WHERE vp.estado_venta IN ('ABIERTA', 'EN_PREPARACION', 'SERVIDA')
              AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
              AND p.requiere_preparacion = 1
              AND (? = 'cocina' AND p.categoria_preparacion = 'COCINA' OR
                   ? = 'barra' AND p.categoria_preparacion = 'BARRA' OR
                   ? = 'todos')`,
            [tipo, tipo, tipo]
        );

        // Pedido más antiguo y tiempo promedio
        const [tiempos] = await pool.execute(
            `SELECT
                MIN(vd.timestamp_envio_cocina) as pedido_mas_antiguo,
                AVG(TIMESTAMPDIFF(MINUTE, vd.timestamp_envio_cocina, NOW())) as tiempo_promedio_espera,
                MAX(TIMESTAMPDIFF(MINUTE, vd.timestamp_envio_cocina, NOW())) as tiempo_maximo_espera
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            INNER JOIN ventas_principales vp ON vd.venta_id = vp.id
            WHERE vp.estado_venta IN ('ABIERTA', 'EN_PREPARACION', 'SERVIDA')
              AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
              AND p.requiere_preparacion = 1
              AND (? = 'cocina' AND p.categoria_preparacion = 'COCINA' OR
                   ? = 'barra' AND p.categoria_preparacion = 'BARRA' OR
                   ? = 'todos')`,
            [tipo, tipo, tipo]
        );

        // Estadísticas de productos por prioridad
        const [porPrioridad] = await pool.execute(
            `SELECT
                vd.prioridad_preparacion,
                COUNT(*) as total_productos
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            INNER JOIN ventas_principales vp ON vd.venta_id = vp.id
            WHERE vp.estado_venta IN ('ABIERTA', 'EN_PREPARACION', 'SERVIDA')
              AND vd.estado_preparacion IN ('ENVIADO_COCINA', 'EN_PREPARACION')
              AND p.requiere_preparacion = 1
              AND (? = 'cocina' AND p.categoria_preparacion = 'COCINA' OR
                   ? = 'barra' AND p.categoria_preparacion = 'BARRA' OR
                   ? = 'todos')
            GROUP BY vd.prioridad_preparacion
            ORDER BY vd.prioridad_preparacion DESC`,
            [tipo, tipo, tipo]
        );

        res.json({
            success: true,
            estadisticas: {
                ventas_pendientes: ventasPendientes[0].total || 0,
                productos_pendientes: productosPendientes[0].total || 0,
                pedido_mas_antiguo: tiempos[0].pedido_mas_antiguo,
                tiempo_promedio_espera: Math.round(tiempos[0].tiempo_promedio_espera || 0),
                tiempo_maximo_espera: Math.round(tiempos[0].tiempo_maximo_espera || 0),
                productos_por_prioridad: porPrioridad
            },
            tipo,
            timestamp: new Date()
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

/**
 * Iniciar preparación de un producto - NUEVA FUNCIÓN EMPRESARIAL
 */
exports.iniciarPreparacion = async (req, res) => {
    const connection = await pool.getConnection();

    try {
        const { detalle_id, empleado_id, tiempo_estimado } = req.body;

        if (!detalle_id || !empleado_id) {
            return res.status(400).json({
                success: false,
                message: 'ID de detalle y empleado son obligatorios'
            });
        }

        await connection.beginTransaction();

        // Verificar que el producto esté en estado correcto
        const [detalles] = await connection.execute(
            `SELECT vd.*, p.nombre_producto
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            WHERE vd.id = ? AND vd.estado_preparacion = 'ENVIADO_COCINA'`,
            [detalle_id]
        );

        if (detalles.length === 0) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Producto no encontrado o no está en estado para iniciar preparación'
            });
        }

        const detalle = detalles[0];

        // Actualizar estado a en preparación
        await connection.execute(
            `UPDATE venta_detalles
            SET estado_preparacion = 'EN_PREPARACION',
                timestamp_inicio_preparacion = CURRENT_TIMESTAMP,
                empleado_preparacion_id = ?,
                tiempo_estimado_preparacion = ?
            WHERE id = ?`,
            [empleado_id, tiempo_estimado, detalle_id]
        );

        // Registrar en log
        await connection.execute(
            `INSERT INTO logs_cocina
            (venta_id, detalle_id, producto_id, accion, estado_anterior, estado_nuevo, empleado_id, observaciones)
            VALUES (?, ?, ?, 'INICIAR_PREPARACION', 'ENVIADO_COCINA', 'EN_PREPARACION', ?, ?)`,
            [detalle.venta_id, detalle_id, detalle.producto_id, empleado_id,
             `Iniciada preparación de ${detalle.nombre_producto}. Tiempo estimado: ${tiempo_estimado} min`]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Preparación iniciada exitosamente',
            detalle_id,
            tiempo_estimado
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al iniciar preparación:', error);
        res.status(500).json({
            success: false,
            message: 'Error al iniciar preparación',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Obtener historial de logs de cocina - NUEVA FUNCIÓN EMPRESARIAL
 */
exports.obtenerHistorialLogs = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, empleado_id, venta_id, limite = 100 } = req.query;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (fecha_inicio && fecha_fin) {
            whereClause += ' AND DATE(lc.timestamp_accion) BETWEEN ? AND ?';
            params.push(fecha_inicio, fecha_fin);
        }

        if (empleado_id) {
            whereClause += ' AND lc.empleado_id = ?';
            params.push(empleado_id);
        }

        if (venta_id) {
            whereClause += ' AND lc.venta_id = ?';
            params.push(venta_id);
        }

        const [logs] = await pool.execute(
            `SELECT
                lc.*,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                p.nombre_producto,
                vp.numero_venta,
                mr.numero_mesa
            FROM logs_cocina lc
            LEFT JOIN empleados e ON lc.empleado_id = e.id
            LEFT JOIN productos p ON lc.producto_id = p.id
            LEFT JOIN ventas_principales vp ON lc.venta_id = vp.id
            LEFT JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            ${whereClause}
            ORDER BY lc.timestamp_accion DESC
            LIMIT ?`,
            [...params, parseInt(limite)]
        );

        res.json({
            success: true,
            logs,
            total: logs.length
        });

    } catch (error) {
        console.error('Error al obtener historial de logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener historial de logs',
            error: error.message
        });
    }
};