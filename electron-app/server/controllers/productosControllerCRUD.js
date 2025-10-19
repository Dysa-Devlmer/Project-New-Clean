// Controller para CRUD completo de productos (complementog)
const { pool } = require('../config/database');

// Obtener todos los productos con paginación
async function obtenerProductos(req, res) {
    try {
        const { activo, id_tipo_comg, limit = 100, offset = 0 } = req.query;

        let whereConditions = [];
        let params = [];

        if (activo) {
            whereConditions.push('c.activo = ?');
            params.push(activo);
        }

        if (id_tipo_comg) {
            whereConditions.push('c.id_tipo_comg = ?');
            params.push(id_tipo_comg);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        const [productos] = await pool.query(`
            SELECT
                c.id_complementog,
                c.id_tipo_comg,
                c.alias as nombre,
                c.descripcion,
                c.precio,
                c.cocina,
                c.barra,
                c.activo,
                c.orden,
                c.created_at,
                t.descripcion as categoria_nombre
            FROM complementog c
            INNER JOIN tipo_comg t ON c.id_tipo_comg = t.id_tipo_comg
            ${whereClause}
            ORDER BY c.orden, c.alias
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);

        // Contar total
        const [count] = await pool.query(`
            SELECT COUNT(*) as total
            FROM complementog c
            ${whereClause}
        `, params);

        res.json({
            success: true,
            productos,
            total: count[0].total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener producto por ID
async function obtenerProductoPorId(req, res) {
    try {
        const { id_complementog } = req.params;

        const [producto] = await pool.query(`
            SELECT
                c.*,
                t.descripcion as categoria_nombre
            FROM complementog c
            INNER JOIN tipo_comg t ON c.id_tipo_comg = t.id_tipo_comg
            WHERE c.id_complementog = ?
        `, [id_complementog]);

        if (producto.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        // Obtener opciones asignadas
        const [opciones] = await pool.query(`
            SELECT
                o.id_opcion,
                o.nombre,
                o.descripcion
            FROM producto_opciones po
            INNER JOIN opciones_producto o ON po.id_opcion = o.id_opcion
            WHERE po.id_complementog = ?
            ORDER BY o.orden, o.nombre
        `, [id_complementog]);

        res.json({
            success: true,
            producto: {
                ...producto[0],
                opciones
            }
        });

    } catch (error) {
        console.error('Error al obtener producto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Crear nuevo producto
async function crearProducto(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            alias,
            descripcion,
            precio,
            id_tipo_comg,
            cocina,
            barra,
            orden,
            activo,
            opciones // Array de IDs de opciones
        } = req.body;

        // Validaciones
        if (!alias || !alias.trim()) {
            return res.status(400).json({
                success: false,
                error: 'El nombre del producto es requerido'
            });
        }

        if (!precio || precio <= 0) {
            return res.status(400).json({
                success: false,
                error: 'El precio debe ser mayor a 0'
            });
        }

        if (!id_tipo_comg) {
            return res.status(400).json({
                success: false,
                error: 'La categoría es requerida'
            });
        }

        // Crear producto
        const [result] = await connection.query(`
            INSERT INTO complementog
            (alias, descripcion, precio, id_tipo_comg, cocina, barra, orden, activo)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            alias.trim(),
            descripcion?.trim() || '',
            precio,
            id_tipo_comg,
            cocina || 'N',
            barra || 'N',
            orden || 0,
            activo || 'Y'
        ]);

        const id_complementog = result.insertId;

        // Asignar opciones si vienen
        if (opciones && Array.isArray(opciones) && opciones.length > 0) {
            const opcionesValues = opciones.map(id_opcion => [id_complementog, id_opcion]);
            await connection.query(`
                INSERT INTO producto_opciones (id_complementog, id_opcion)
                VALUES ?
            `, [opcionesValues]);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Producto creado exitosamente',
            id_complementog
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al crear producto:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Actualizar producto
async function actualizarProducto(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_complementog } = req.params;
        const {
            alias,
            descripcion,
            precio,
            id_tipo_comg,
            cocina,
            barra,
            orden,
            activo,
            opciones // Array de IDs de opciones
        } = req.body;

        // Construir query dinámicamente
        const updates = [];
        const values = [];

        if (alias !== undefined) {
            updates.push('alias = ?');
            values.push(alias.trim());
        }
        if (descripcion !== undefined) {
            updates.push('descripcion = ?');
            values.push(descripcion?.trim() || '');
        }
        if (precio !== undefined) {
            if (precio <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'El precio debe ser mayor a 0'
                });
            }
            updates.push('precio = ?');
            values.push(precio);
        }
        if (id_tipo_comg !== undefined) {
            updates.push('id_tipo_comg = ?');
            values.push(id_tipo_comg);
        }
        if (cocina !== undefined) {
            updates.push('cocina = ?');
            values.push(cocina);
        }
        if (barra !== undefined) {
            updates.push('barra = ?');
            values.push(barra);
        }
        if (orden !== undefined) {
            updates.push('orden = ?');
            values.push(orden);
        }
        if (activo !== undefined) {
            updates.push('activo = ?');
            values.push(activo);
        }

        if (updates.length > 0) {
            values.push(id_complementog);
            const [result] = await connection.query(`
                UPDATE complementog
                SET ${updates.join(', ')}
                WHERE id_complementog = ?
            `, values);

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Producto no encontrado'
                });
            }
        }

        // Actualizar opciones si vienen
        if (opciones !== undefined) {
            // Eliminar opciones actuales
            await connection.query(`
                DELETE FROM producto_opciones
                WHERE id_complementog = ?
            `, [id_complementog]);

            // Insertar nuevas opciones
            if (Array.isArray(opciones) && opciones.length > 0) {
                const opcionesValues = opciones.map(id_opcion => [id_complementog, id_opcion]);
                await connection.query(`
                    INSERT INTO producto_opciones (id_complementog, id_opcion)
                    VALUES ?
                `, [opcionesValues]);
            }
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Producto actualizado exitosamente'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al actualizar producto:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Eliminar producto (soft delete)
async function eliminarProducto(req, res) {
    try {
        const { id_complementog } = req.params;

        // Verificar si el producto está en pedidos activos
        const [pedidos] = await pool.query(`
            SELECT COUNT(*) as total
            FROM ventadir_comg vc
            INNER JOIN ventadirecta v ON vc.id_venta = v.id_venta
            WHERE vc.id_complementog = ? AND v.cerrada = 'N'
        `, [id_complementog]);

        if (pedidos[0].total > 0) {
            return res.status(400).json({
                success: false,
                error: 'No se puede eliminar el producto porque está en pedidos activos'
            });
        }

        // Soft delete
        const [result] = await pool.query(`
            UPDATE complementog
            SET activo = 'N'
            WHERE id_complementog = ?
        `, [id_complementog]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Producto eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener estadísticas de productos
async function obtenerEstadisticas(req, res) {
    try {
        const [stats] = await pool.query(`
            SELECT
                COUNT(*) as total_productos,
                COUNT(CASE WHEN activo = 'Y' THEN 1 END) as productos_activos,
                COUNT(CASE WHEN cocina = 'Y' THEN 1 END) as productos_cocina,
                COUNT(CASE WHEN barra = 'Y' THEN 1 END) as productos_barra,
                MIN(precio) as precio_minimo,
                MAX(precio) as precio_maximo,
                AVG(precio) as precio_promedio
            FROM complementog
        `);

        res.json({
            success: true,
            estadisticas: stats[0]
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    obtenerProductos,
    obtenerProductoPorId,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    obtenerEstadisticas
};
