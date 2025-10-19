// Controlador de Productos - SISTEMA REAL
const { pool } = require('../config/database');

// Obtener todas las categorías (tipos)
async function obtenerCategorias(req, res) {
    try {
        const [categorias] = await pool.query(`
            SELECT * FROM tipo_comg
            WHERE activo = true
            ORDER BY orden_menu, descripcion
        `);
        res.json({ success: true, categorias });
    } catch (error) {
        console.error('Error al obtener categorías:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener productos por categoría
async function obtenerProductosPorCategoria(req, res) {
    try {
        const { id_categoria } = req.params;

        const [productos] = await pool.query(`
            SELECT
                c.id_complementog,
                c.alias as nombre,
                c.descripcion,
                c.precio,
                c.id_tipo_comg,
                c.cocina,
                c.imagen,
                c.tiempo_preparacion,
                t.descripcion as categoria
            FROM complementog c
            INNER JOIN tipo_comg t ON c.id_tipo_comg = t.id_tipo_comg
            WHERE c.id_tipo_comg = ? AND c.activo = true
            ORDER BY c.alias
        `, [id_categoria]);

        res.json({ success: true, productos });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener todos los productos
async function obtenerTodosProductos(req, res) {
    try {
        const [productos] = await pool.query(`
            SELECT
                c.id_complementog,
                c.alias as nombre,
                c.descripcion,
                c.precio,
                c.id_tipo_comg,
                c.cocina,
                c.imagen,
                t.descripcion as categoria
            FROM complementog c
            INNER JOIN tipo_comg t ON c.id_tipo_comg = t.id_tipo_comg
            WHERE c.activo = true
            ORDER BY t.orden_menu, c.alias
        `);

        res.json({ success: true, productos });
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    obtenerCategorias,
    obtenerProductosPorCategoria,
    obtenerTodosProductos
};
