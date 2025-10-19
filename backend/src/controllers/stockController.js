/**
 * CONTROLADOR DE STOCK/INVENTARIO
 *
 * Gestiona el control completo de inventario:
 * - Consulta de stock por producto/almacén
 * - Ajustes manuales de inventario
 * - Alertas de stock bajo
 * - Movimientos de inventario
 * - Gestión de almacenes
 * - Productos pack (compuestos)
 *
 * @author Claude Code
 * @date 2025-10-04 03:22 AM (Chile)
 */

const db = require('../config/database');

/**
 * Obtener lista de almacenes
 */
exports.obtenerAlmacenes = async (req, res) => {
    try {
        const [almacenes] = await db.execute(
            `SELECT
                id_almacen,
                nombre,
                descripcion,
                ubicacion,
                activo,
                fecha_creacion
            FROM almacen
            WHERE activo = 'Y'
            ORDER BY nombre`
        );

        res.json({
            success: true,
            almacenes
        });
    } catch (error) {
        console.error('Error al obtener almacenes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener almacenes',
            error: error.message
        });
    }
};

/**
 * Obtener stock de un producto en todos los almacenes
 */
exports.obtenerStockProducto = async (req, res) => {
    try {
        const { id_producto } = req.params;

        const [stock] = await db.execute(
            `SELECT
                ap.id_almacen_producto,
                ap.id_almacen,
                a.nombre as almacen_nombre,
                ap.id_producto,
                p.nombre as producto_nombre,
                ap.stock_actual,
                ap.stock_minimo,
                ap.stock_maximo,
                ap.unidad,
                ap.activo,
                ap.fecha_actualizacion,
                CASE
                    WHEN ap.stock_actual < ap.stock_minimo THEN 'BAJO'
                    WHEN ap.stock_actual >= ap.stock_minimo AND ap.stock_actual <= (ap.stock_minimo * 1.5) THEN 'CRITICO'
                    ELSE 'OK'
                END as estado_stock
            FROM almacen_producto ap
            INNER JOIN almacen a ON ap.id_almacen = a.id_almacen
            INNER JOIN productos p ON ap.id_producto = p.id_producto
            WHERE ap.id_producto = ?
              AND ap.activo = 'Y'
              AND a.activo = 'Y'
            ORDER BY a.nombre`,
            [id_producto]
        );

        res.json({
            success: true,
            stock
        });
    } catch (error) {
        console.error('Error al obtener stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener stock del producto',
            error: error.message
        });
    }
};

/**
 * Obtener stock de todos los productos de un almacén
 */
exports.obtenerStockAlmacen = async (req, res) => {
    try {
        const { id_almacen } = req.params;
        const { categoria, estado } = req.query;

        let query = `
            SELECT
                ap.id_almacen_producto,
                ap.id_producto,
                p.nombre as producto_nombre,
                p.id_tipo_comg as id_categoria,
                tc.descripcion as categoria_nombre,
                ap.stock_actual,
                ap.stock_minimo,
                ap.stock_maximo,
                ap.unidad,
                ap.fecha_actualizacion,
                CASE
                    WHEN ap.stock_actual < ap.stock_minimo THEN 'BAJO'
                    WHEN ap.stock_actual >= ap.stock_minimo AND ap.stock_actual <= (ap.stock_minimo * 1.5) THEN 'CRITICO'
                    ELSE 'OK'
                END as estado_stock,
                ROUND((ap.stock_actual / ap.stock_minimo * 100), 2) as porcentaje_stock
            FROM almacen_producto ap
            INNER JOIN productos p ON ap.id_producto = p.id_producto
            LEFT JOIN tipo_complementog tc ON p.id_tipo_comg = tc.id_tipo_comg
            WHERE ap.id_almacen = ?
              AND ap.activo = 'Y'
              AND p.activo = 'Y'
        `;

        const params = [id_almacen];

        if (categoria) {
            query += ' AND p.id_tipo_comg = ?';
            params.push(categoria);
        }

        if (estado === 'BAJO') {
            query += ' HAVING estado_stock = "BAJO"';
        } else if (estado === 'CRITICO') {
            query += ' HAVING estado_stock = "CRITICO"';
        }

        query += ' ORDER BY estado_stock ASC, p.nombre';

        const [productos] = await db.execute(query, params);

        res.json({
            success: true,
            productos,
            total: productos.length
        });
    } catch (error) {
        console.error('Error al obtener stock del almacén:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener stock del almacén',
            error: error.message
        });
    }
};

/**
 * Obtener alertas de stock bajo (vista v_stock_bajo)
 */
exports.obtenerAlertasStockBajo = async (req, res) => {
    try {
        const { id_almacen, limite = 50 } = req.query;

        let query = 'SELECT * FROM v_stock_bajo WHERE 1=1';
        const params = [];

        if (id_almacen) {
            query += ' AND id_almacen = ?';
            params.push(id_almacen);
        }

        query += ' LIMIT ?';
        params.push(parseInt(limite));

        const [alertas] = await db.execute(query, params);

        res.json({
            success: true,
            alertas,
            total: alertas.length
        });
    } catch (error) {
        console.error('Error al obtener alertas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener alertas de stock bajo',
            error: error.message
        });
    }
};

/**
 * Ajustar stock manualmente
 */
exports.ajustarStock = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            id_almacen,
            id_producto,
            nuevo_stock,
            id_usuario,
            observaciones = 'Ajuste manual de inventario'
        } = req.body;

        if (!id_almacen || !id_producto || nuevo_stock === undefined) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros: id_almacen, id_producto y nuevo_stock son requeridos'
            });
        }

        // Obtener stock actual
        const [stockActual] = await connection.execute(
            `SELECT stock_actual FROM almacen_producto
            WHERE id_almacen = ? AND id_producto = ? AND activo = 'Y'`,
            [id_almacen, id_producto]
        );

        if (stockActual.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado en este almacén'
            });
        }

        const stock_anterior = parseFloat(stockActual[0].stock_actual);
        const stock_nuevo = parseFloat(nuevo_stock);
        const diferencia = stock_nuevo - stock_anterior;

        // Actualizar stock
        await connection.execute(
            `UPDATE almacen_producto
            SET stock_actual = ?
            WHERE id_almacen = ? AND id_producto = ? AND activo = 'Y'`,
            [stock_nuevo, id_almacen, id_producto]
        );

        // Registrar movimiento
        const tipo_movimiento = diferencia > 0 ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA';

        await connection.execute(
            `INSERT INTO movimientos_stock (
                id_almacen,
                id_producto,
                tipo_movimiento,
                cantidad,
                stock_anterior,
                stock_posterior,
                id_usuario,
                observaciones
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                id_almacen,
                id_producto,
                tipo_movimiento,
                Math.abs(diferencia),
                stock_anterior,
                stock_nuevo,
                id_usuario || null,
                observaciones
            ]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Stock ajustado exitosamente',
            stock_anterior,
            stock_nuevo,
            diferencia
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al ajustar stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error al ajustar stock',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Obtener movimientos de stock
 */
exports.obtenerMovimientos = async (req, res) => {
    try {
        const {
            id_almacen,
            id_producto,
            tipo_movimiento,
            fecha_desde,
            fecha_hasta,
            limite = 100
        } = req.query;

        let query = `
            SELECT
                ms.id_movimiento,
                ms.id_almacen,
                a.nombre as almacen_nombre,
                ms.id_producto,
                p.nombre as producto_nombre,
                ms.tipo_movimiento,
                ms.cantidad,
                ms.stock_anterior,
                ms.stock_posterior,
                ms.id_usuario,
                u.nombre as usuario_nombre,
                ms.id_venta,
                ms.id_linea,
                ms.observaciones,
                ms.fecha_movimiento
            FROM movimientos_stock ms
            INNER JOIN almacen a ON ms.id_almacen = a.id_almacen
            INNER JOIN productos p ON ms.id_producto = p.id_producto
            LEFT JOIN usuarios u ON ms.id_usuario = u.id_usuario
            WHERE 1=1
        `;
        const params = [];

        if (id_almacen) {
            query += ' AND ms.id_almacen = ?';
            params.push(id_almacen);
        }

        if (id_producto) {
            query += ' AND ms.id_producto = ?';
            params.push(id_producto);
        }

        if (tipo_movimiento) {
            query += ' AND ms.tipo_movimiento = ?';
            params.push(tipo_movimiento);
        }

        if (fecha_desde) {
            query += ' AND ms.fecha_movimiento >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ' AND ms.fecha_movimiento <= ?';
            params.push(fecha_hasta);
        }

        query += ' ORDER BY ms.fecha_movimiento DESC LIMIT ?';
        params.push(parseInt(limite));

        const [movimientos] = await db.execute(query, params);

        res.json({
            success: true,
            movimientos,
            total: movimientos.length
        });
    } catch (error) {
        console.error('Error al obtener movimientos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener movimientos de stock',
            error: error.message
        });
    }
};

/**
 * Reducir stock al agregar a venta (llama al stored procedure)
 */
exports.reducirStockVenta = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            id_almacen,
            id_producto,
            cantidad,
            id_usuario,
            id_venta,
            id_linea
        } = req.body;

        if (!id_almacen || !id_producto || !cantidad || !id_venta) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros requeridos'
            });
        }

        // Llamar al stored procedure que maneja packs recursivamente
        await connection.execute(
            'CALL sp_reducir_stock(?, ?, ?, ?, ?, ?)',
            [id_almacen, id_producto, cantidad, id_usuario || null, id_venta, id_linea || null]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Stock reducido exitosamente'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al reducir stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error al reducir stock',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Restaurar stock al cancelar venta (llama al stored procedure)
 */
exports.restaurarStockVenta = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            id_almacen,
            id_producto,
            cantidad,
            id_usuario,
            id_venta,
            id_linea
        } = req.body;

        if (!id_almacen || !id_producto || !cantidad || !id_venta) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros requeridos'
            });
        }

        // Llamar al stored procedure que maneja packs recursivamente
        await connection.execute(
            'CALL sp_restaurar_stock(?, ?, ?, ?, ?, ?)',
            [id_almacen, id_producto, cantidad, id_usuario || null, id_venta, id_linea || null]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Stock restaurado exitosamente'
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al restaurar stock:', error);
        res.status(500).json({
            success: false,
            message: 'Error al restaurar stock',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Crear almacén
 */
exports.crearAlmacen = async (req, res) => {
    try {
        const { nombre, descripcion, ubicacion } = req.body;

        if (!nombre) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del almacén es requerido'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO almacen (nombre, descripcion, ubicacion)
            VALUES (?, ?, ?)`,
            [nombre, descripcion || null, ubicacion || null]
        );

        res.json({
            success: true,
            message: 'Almacén creado exitosamente',
            id_almacen: result.insertId
        });
    } catch (error) {
        console.error('Error al crear almacén:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear almacén',
            error: error.message
        });
    }
};

/**
 * Agregar producto a almacén
 */
exports.agregarProductoAlmacen = async (req, res) => {
    try {
        const {
            id_almacen,
            id_producto,
            stock_inicial = 0,
            stock_minimo = 0,
            stock_maximo = null,
            unidad = 'unidad'
        } = req.body;

        if (!id_almacen || !id_producto) {
            return res.status(400).json({
                success: false,
                message: 'id_almacen e id_producto son requeridos'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO almacen_producto (
                id_almacen,
                id_producto,
                stock_actual,
                stock_minimo,
                stock_maximo,
                unidad
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                stock_minimo = VALUES(stock_minimo),
                stock_maximo = VALUES(stock_maximo),
                unidad = VALUES(unidad)`,
            [id_almacen, id_producto, stock_inicial, stock_minimo, stock_maximo, unidad]
        );

        res.json({
            success: true,
            message: 'Producto agregado al almacén exitosamente',
            id_almacen_producto: result.insertId
        });
    } catch (error) {
        console.error('Error al agregar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar producto al almacén',
            error: error.message
        });
    }
};

/**
 * Obtener estadísticas generales de stock
 */
exports.obtenerEstadisticas = async (req, res) => {
    try {
        // Estado por almacén
        const [estadoAlmacenes] = await db.execute(
            'SELECT * FROM v_stock_por_almacen ORDER BY almacen_nombre'
        );

        // Total de productos con stock bajo
        const [stockBajo] = await db.execute(
            'SELECT COUNT(*) as total FROM v_stock_bajo'
        );

        // Movimientos del día por tipo
        const [movimientosHoy] = await db.execute(
            `SELECT
                tipo_movimiento,
                COUNT(*) as total,
                SUM(cantidad) as cantidad_total
            FROM movimientos_stock
            WHERE DATE(fecha_movimiento) = CURDATE()
            GROUP BY tipo_movimiento`
        );

        res.json({
            success: true,
            estadisticas: {
                almacenes: estadoAlmacenes,
                productos_stock_bajo: stockBajo[0].total,
                movimientos_hoy: movimientosHoy
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas de stock',
            error: error.message
        });
    }
};

/**
 * Obtener componentes de un pack
 */
exports.obtenerComponentesPack = async (req, res) => {
    try {
        const { id_producto } = req.params;

        const [componentes] = await db.execute(
            `SELECT
                pp.id_pack,
                pp.id_producto_padre,
                p_padre.nombre as producto_padre_nombre,
                pp.id_producto_hijo,
                p_hijo.nombre as producto_hijo_nombre,
                pp.cantidad,
                pp.activo
            FROM producto_pack pp
            INNER JOIN productos p_padre ON pp.id_producto_padre = p_padre.id_producto
            INNER JOIN productos p_hijo ON pp.id_producto_hijo = p_hijo.id_producto
            WHERE pp.id_producto_padre = ?
              AND pp.activo = 'Y'
            ORDER BY p_hijo.nombre`,
            [id_producto]
        );

        res.json({
            success: true,
            componentes,
            es_pack: componentes.length > 0
        });
    } catch (error) {
        console.error('Error al obtener componentes:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener componentes del pack',
            error: error.message
        });
    }
};

/**
 * Crear producto pack
 */
exports.crearProductoPack = async (req, res) => {
    try {
        const { id_producto_padre, id_producto_hijo, cantidad = 1 } = req.body;

        if (!id_producto_padre || !id_producto_hijo) {
            return res.status(400).json({
                success: false,
                message: 'id_producto_padre e id_producto_hijo son requeridos'
            });
        }

        const [result] = await db.execute(
            `INSERT INTO producto_pack (id_producto_padre, id_producto_hijo, cantidad)
            VALUES (?, ?, ?)`,
            [id_producto_padre, id_producto_hijo, cantidad]
        );

        res.json({
            success: true,
            message: 'Componente de pack agregado exitosamente',
            id_pack: result.insertId
        });
    } catch (error) {
        console.error('Error al crear pack:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear componente de pack',
            error: error.message
        });
    }
};

/**
 * Eliminar componente de pack
 */
exports.eliminarComponentePack = async (req, res) => {
    try {
        const { id_pack } = req.params;

        await db.execute(
            `UPDATE producto_pack SET activo = 'N' WHERE id_pack = ?`,
            [id_pack]
        );

        res.json({
            success: true,
            message: 'Componente de pack eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar componente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar componente de pack',
            error: error.message
        });
    }
};
