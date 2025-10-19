// Controlador de Pedidos - SISTEMA REAL
// INTEGRADO CON CONTROL DE STOCK
const { pool } = require('../config/database');

// Crear nuevo pedido/venta
// REDUCE STOCK AUTOMÁTICAMENTE AL AGREGAR PRODUCTOS
// REUTILIZA PEDIDOS ABIERTOS EN LA MISMA MESA
async function crearPedido(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            Num_Mesa,
            comensales,
            id_camarero,
            id_caja,
            id_cliente = null, // INTEGRACIÓN CLIENTES
            id_almacen = 1, // Almacén por defecto
            productos, // Array de {id_complementog, cantidad, observaciones}
            observaciones
        } = req.body;

        const fecha_venta = new Date().toISOString().split('T')[0];
        const hora = new Date().toTimeString().split(' ')[0];

        // VERIFICAR SI YA EXISTE UN PEDIDO ABIERTO EN ESTA MESA
        const [ventasAbiertas] = await connection.query(`
            SELECT id_venta, total
            FROM ventadirecta
            WHERE Num_Mesa = ? AND cerrada = 'N'
            ORDER BY id_venta DESC
            LIMIT 1
        `, [Num_Mesa]);

        let id_venta;
        let ventaExistente = false;

        if (ventasAbiertas.length > 0) {
            // REUTILIZAR VENTA EXISTENTE
            id_venta = ventasAbiertas[0].id_venta;
            ventaExistente = true;

            // Actualizar fecha/hora, comensales y cliente si es necesario
            await connection.query(`
                UPDATE ventadirecta
                SET comensales = GREATEST(comensales, ?),
                    id_cliente = COALESCE(?, id_cliente),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id_venta = ?
            `, [comensales, id_cliente, id_venta]);
        } else {
            // CREAR NUEVA VENTA
            const [result] = await connection.query(`
                INSERT INTO ventadirecta
                (Num_Mesa, comensales, fecha_venta, hora, id_camarero, id_caja, id_cliente, cerrada, observaciones)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'N', ?)
            `, [Num_Mesa, comensales, fecha_venta, hora, id_camarero, id_caja, id_cliente, observaciones]);

            id_venta = result.insertId;
        }

        // Insertar productos Y REDUCIR STOCK
        let total = 0;
        for (const producto of productos) {
            // Obtener precio actual del producto
            const [prod] = await connection.query(
                'SELECT precio FROM complementog WHERE id_complementog = ?',
                [producto.id_complementog]
            );

            if (prod.length === 0) {
                throw new Error(`Producto ${producto.id_complementog} no encontrado`);
            }

            const precio_unitario = prod[0].precio;
            total += precio_unitario * producto.cantidad;

            // VERIFICAR SI YA EXISTE UNA LÍNEA CON EL MISMO PRODUCTO
            // IMPORTANTE: Solo agrupar con líneas que NO han sido enviadas a cocina
            // (solo si no tiene observaciones o son las mismas)
            const [lineaExistente] = await connection.query(`
                SELECT id_linea, cantidad, observaciones, cocina
                FROM ventadir_comg
                WHERE id_venta = ? AND id_complementog = ? AND cocina = 0
                ORDER BY id_linea DESC
                LIMIT 1
            `, [id_venta, producto.id_complementog]);

            let id_linea;

            // Solo agrupar si las observaciones son EXACTAMENTE iguales (incluyendo ambos vacíos/null)
            const obsNueva = producto.observaciones || '';
            const obsExistente = lineaExistente.length > 0 ? (lineaExistente[0].observaciones || '') : '';
            const observacionesIguales = obsNueva === obsExistente;

            if (lineaExistente.length > 0 && observacionesIguales) {
                // ACTUALIZAR LÍNEA EXISTENTE (solo si observaciones son EXACTAMENTE iguales)
                id_linea = lineaExistente[0].id_linea;
                const nueva_cantidad = lineaExistente[0].cantidad + producto.cantidad;

                await connection.query(`
                    UPDATE ventadir_comg
                    SET cantidad = ?
                    WHERE id_linea = ?
                `, [nueva_cantidad, id_linea]);
            } else {
                // CREAR NUEVA LÍNEA
                const [lineaResult] = await connection.query(`
                    INSERT INTO ventadir_comg
                    (id_venta, id_complementog, cantidad, precio_unitario, observaciones)
                    VALUES (?, ?, ?, ?, ?)
                `, [
                    id_venta,
                    producto.id_complementog,
                    producto.cantidad,
                    precio_unitario,
                    producto.observaciones || null
                ]);

                id_linea = lineaResult.insertId;
            }

            // REDUCIR STOCK (llama al stored procedure que maneja packs)
            try {
                await connection.query(
                    'CALL sp_reducir_stock(?, ?, ?, ?, ?, ?)',
                    [id_almacen, producto.id_complementog, producto.cantidad, id_camarero, id_venta, id_linea]
                );
            } catch (stockError) {
                console.warn('Advertencia stock:', stockError.message);
                // No fallar la venta si no hay control de stock configurado
            }
        }

        // Actualizar total
        await connection.query(
            'UPDATE ventadirecta SET total = ? WHERE id_venta = ?',
            [total, id_venta]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Pedido creado exitosamente',
            id_venta,
            total
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al crear pedido:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Enviar pedido a cocina
async function enviarACocina(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_venta, id_caja } = req.body;

        // Obtener TODOS los productos del pedido pendientes de enviar
        const [lineas] = await connection.query(`
            SELECT vc.*, c.cocina
            FROM ventadir_comg vc
            INNER JOIN complementog c ON vc.id_complementog = c.id_complementog
            WHERE vc.id_venta = ? AND vc.cocina < vc.cantidad
        `, [id_venta]);

        if (lineas.length === 0) {
            return res.json({
                success: true,
                message: 'No hay productos pendientes para enviar'
            });
        }

        // Actualizar cantidad enviada (marca como enviado a cocina/barra)
        const hora_cocina = new Date().toTimeString().split(' ')[0];

        for (const linea of lineas) {
            await connection.query(`
                UPDATE ventadir_comg
                SET cocina = cantidad, hora_cocina = ?
                WHERE id_linea = ?
            `, [hora_cocina, linea.id_linea]);
        }

        // Registrar envío a cocina
        await connection.query(`
            INSERT INTO venta_cocina (id_venta, id_caja, estado)
            VALUES (?, ?, 'enviado')
        `, [id_venta, id_caja]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Pedido enviado a cocina',
            productos_enviados: lineas.length
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al enviar a cocina:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Obtener pedidos activos (no cerrados)
async function obtenerPedidosActivos(req, res) {
    try {
        const [pedidos] = await pool.query(`
            SELECT
                v.id_venta,
                v.Num_Mesa,
                v.comensales,
                v.fecha_venta,
                v.hora,
                v.total,
                v.cerrada,
                v.observaciones,
                m.descripcion as mesa_descripcion,
                c.nombre as camarero
            FROM ventadirecta v
            INNER JOIN mesa m ON v.Num_Mesa = m.Num_Mesa
            INNER JOIN camareros c ON v.id_camarero = c.id_camarero
            WHERE v.cerrada = 'N'
            ORDER BY v.fecha_venta DESC, v.hora DESC
        `);

        res.json({ success: true, pedidos });
    } catch (error) {
        console.error('Error al obtener pedidos activos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener detalle de un pedido
async function obtenerDetallePedido(req, res) {
    try {
        const { id_venta } = req.params;

        // Obtener datos de la venta
        const [venta] = await pool.query(`
            SELECT
                v.*,
                m.descripcion as mesa_descripcion,
                c.nombre as camarero
            FROM ventadirecta v
            INNER JOIN mesa m ON v.Num_Mesa = m.Num_Mesa
            LEFT JOIN camareros c ON v.id_camarero = c.id_camarero
            WHERE v.id_venta = ?
        `, [id_venta]);

        if (venta.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada'
            });
        }

        // Obtener productos
        const [productos] = await pool.query(`
            SELECT
                vc.id_linea,
                vc.id_complementog,
                vc.cantidad,
                vc.precio_unitario,
                vc.subtotal,
                vc.nota,
                vc.observaciones,
                vc.cocina as enviado_cocina,
                vc.servido_cocina,
                c.alias as producto_nombre,
                c.descripcion as producto_descripcion,
                c.cocina,
                t.descripcion as categoria_nombre
            FROM ventadir_comg vc
            INNER JOIN complementog c ON vc.id_complementog = c.id_complementog
            INNER JOIN tipo_comg t ON c.id_tipo_comg = t.id_tipo_comg
            WHERE vc.id_venta = ?
            ORDER BY t.descripcion, vc.id_linea
        `, [id_venta]);

        res.json({
            success: true,
            venta: venta[0],
            productos
        });
    } catch (error) {
        console.error('Error al obtener detalle:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Cancelar venta completa
// RESTAURA STOCK AUTOMÁTICAMENTE AL CANCELAR
async function cancelarVenta(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_venta, id_usuario, motivo, id_almacen = 1 } = req.body;

        // Verificar que la venta existe y no está ya cancelada
        const [venta] = await connection.query(
            'SELECT * FROM ventadirecta WHERE id_venta = ?',
            [id_venta]
        );

        if (venta.length === 0) {
            throw new Error('Venta no encontrada');
        }

        if (venta[0].cerrada === 'C') {
            throw new Error('La venta ya está cancelada');
        }

        // Obtener todas las líneas de la venta
        const [lineas] = await connection.query(`
            SELECT id_linea, id_complementog, cantidad
            FROM ventadir_comg
            WHERE id_venta = ?
        `, [id_venta]);

        // RESTAURAR STOCK de cada línea
        for (const linea of lineas) {
            try {
                await connection.query(
                    'CALL sp_restaurar_stock(?, ?, ?, ?, ?, ?)',
                    [id_almacen, linea.id_complementog, linea.cantidad, id_usuario, id_venta, linea.id_linea]
                );
            } catch (stockError) {
                console.warn('Advertencia al restaurar stock:', stockError.message);
                // No fallar la cancelación si no hay control de stock
            }
        }

        // Marcar venta como cancelada
        await connection.query(
            `UPDATE ventadirecta
            SET cerrada = 'C', observaciones = CONCAT(IFNULL(observaciones, ''), ' - CANCELADA: ', ?)
            WHERE id_venta = ?`,
            [motivo || 'Sin motivo especificado', id_venta]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Venta cancelada y stock restaurado exitosamente',
            lineas_restauradas: lineas.length
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al cancelar venta:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Eliminar línea de venta
// RESTAURA STOCK DE LA LÍNEA ELIMINADA
async function eliminarLineaVenta(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_linea, id_usuario, id_almacen = 1 } = req.body;

        // Obtener datos de la línea
        const [linea] = await connection.query(`
            SELECT id_venta, id_complementog, cantidad, precio_unitario, subtotal
            FROM ventadir_comg
            WHERE id_linea = ?
        `, [id_linea]);

        if (linea.length === 0) {
            throw new Error('Línea no encontrada');
        }

        const { id_venta, id_complementog, cantidad, subtotal } = linea[0];

        // RESTAURAR STOCK
        try {
            await connection.query(
                'CALL sp_restaurar_stock(?, ?, ?, ?, ?, ?)',
                [id_almacen, id_complementog, cantidad, id_usuario, id_venta, id_linea]
            );
        } catch (stockError) {
            console.warn('Advertencia al restaurar stock:', stockError.message);
        }

        // Eliminar línea
        await connection.query(
            'DELETE FROM ventadir_comg WHERE id_linea = ?',
            [id_linea]
        );

        // Recalcular total de la venta
        const [nuevasSumas] = await connection.query(
            'SELECT SUM(subtotal) as total FROM ventadir_comg WHERE id_venta = ?',
            [id_venta]
        );

        const nuevoTotal = nuevasSumas[0].total || 0;

        await connection.query(
            'UPDATE ventadirecta SET total = ? WHERE id_venta = ?',
            [nuevoTotal, id_venta]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Línea eliminada y stock restaurado',
            nuevo_total: nuevoTotal
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al eliminar línea:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

module.exports = {
    crearPedido,
    enviarACocina,
    obtenerPedidosActivos,
    obtenerDetallePedido,
    cancelarVenta,
    eliminarLineaVenta
};
