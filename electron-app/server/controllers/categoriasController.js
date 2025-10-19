// Controller para gestión de categorías (tipo_comg)
const { pool } = require('../config/database');

// Obtener todas las categorías
async function obtenerCategorias(req, res) {
    try {
        const [categorias] = await pool.query(`
            SELECT
                id_tipo_comg,
                descripcion,
                color,
                impresora,
                orden_menu,
                activo
            FROM tipo_comg
            ORDER BY orden_menu, descripcion
        `);

        res.json({
            success: true,
            categorias,
            cantidad: categorias.length
        });

    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener categoría por ID
async function obtenerCategoriaPorId(req, res) {
    try {
        const { id_tipo_comg } = req.params;

        const [categoria] = await pool.query(`
            SELECT
                id_tipo_comg,
                descripcion,
                orden,
                activo,
                created_at
            FROM tipo_comg
            WHERE id_tipo_comg = ?
        `, [id_tipo_comg]);

        if (categoria.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Categoría no encontrada'
            });
        }

        // Obtener cantidad de productos en esta categoría
        const [productos] = await pool.query(`
            SELECT COUNT(*) as total
            FROM complementog
            WHERE id_tipo_comg = ? AND activo = 'Y'
        `, [id_tipo_comg]);

        res.json({
            success: true,
            categoria: {
                ...categoria[0],
                total_productos: productos[0].total
            }
        });

    } catch (error) {
        console.error('Error al obtener categoría:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Crear nueva categoría
async function crearCategoria(req, res) {
    try {
        const { descripcion, orden, activo } = req.body;

        if (!descripcion || !descripcion.trim()) {
            return res.status(400).json({
                success: false,
                error: 'La descripción es requerida'
            });
        }

        const [result] = await pool.query(`
            INSERT INTO tipo_comg (descripcion, orden, activo)
            VALUES (?, ?, ?)
        `, [descripcion.trim().toUpperCase(), orden || 0, activo || 'Y']);

        res.json({
            success: true,
            message: 'Categoría creada exitosamente',
            id_tipo_comg: result.insertId
        });

    } catch (error) {
        console.error('Error al crear categoría:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Actualizar categoría
async function actualizarCategoria(req, res) {
    try {
        const { id_tipo_comg } = req.params;
        const { descripcion, orden, activo } = req.body;

        // Construir query dinámicamente
        const updates = [];
        const values = [];

        if (descripcion !== undefined) {
            updates.push('descripcion = ?');
            values.push(descripcion.trim().toUpperCase());
        }
        if (orden !== undefined) {
            updates.push('orden = ?');
            values.push(orden);
        }
        if (activo !== undefined) {
            updates.push('activo = ?');
            values.push(activo);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay campos para actualizar'
            });
        }

        values.push(id_tipo_comg);

        const [result] = await pool.query(`
            UPDATE tipo_comg
            SET ${updates.join(', ')}
            WHERE id_tipo_comg = ?
        `, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Categoría no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Categoría actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar categoría:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Eliminar categoría (soft delete)
async function eliminarCategoria(req, res) {
    try {
        const { id_tipo_comg } = req.params;

        // Verificar si hay productos en esta categoría
        const [productos] = await pool.query(`
            SELECT COUNT(*) as total
            FROM complementog
            WHERE id_tipo_comg = ? AND activo = 'Y'
        `, [id_tipo_comg]);

        if (productos[0].total > 0) {
            return res.status(400).json({
                success: false,
                error: `No se puede eliminar la categoría porque tiene ${productos[0].total} producto(s) activo(s)`
            });
        }

        // Soft delete
        const [result] = await pool.query(`
            UPDATE tipo_comg
            SET activo = 'N'
            WHERE id_tipo_comg = ?
        `, [id_tipo_comg]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Categoría no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Categoría eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener estadísticas de categorías
async function obtenerEstadisticas(req, res) {
    try {
        const [stats] = await pool.query(`
            SELECT
                t.id_tipo_comg,
                t.descripcion,
                t.activo,
                COUNT(DISTINCT c.id_complementog) as total_productos,
                COUNT(DISTINCT CASE WHEN c.activo = 'Y' THEN c.id_complementog END) as productos_activos,
                MIN(c.precio) as precio_minimo,
                MAX(c.precio) as precio_maximo,
                AVG(c.precio) as precio_promedio
            FROM tipo_comg t
            LEFT JOIN complementog c ON t.id_tipo_comg = c.id_tipo_comg
            GROUP BY t.id_tipo_comg, t.descripcion, t.activo
            ORDER BY t.orden, t.descripcion
        `);

        res.json({
            success: true,
            estadisticas: stats
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    obtenerCategorias,
    obtenerCategoriaPorId,
    crearCategoria,
    actualizarCategoria,
    eliminarCategoria,
    obtenerEstadisticas
};
