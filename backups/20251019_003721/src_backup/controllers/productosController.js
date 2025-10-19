// Controlador de Productos - SISTEMA REAL
const { pool } = require('../config/database');

// Obtener todas las categorías (tipos)
async function obtenerCategorias(req, res) {
    try {
        const [categorias] = await pool.query(`
            SELECT * FROM categorias_productos
            WHERE categoria_activa = true
            ORDER BY orden_visualizacion, nombre_categoria
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
                p.id,
                p.codigo_producto,
                p.nombre_producto as nombre,
                p.descripcion_completa,
                p.precio_venta,
                p.categoria_id,
                p.requiere_preparacion,
                p.tiempo_preparacion_minutos,
                c.nombre_categoria as categoria
            FROM productos p
            INNER JOIN categorias_productos c ON p.categoria_id = c.id
            WHERE p.categoria_id = ? AND p.producto_activo = true
            ORDER BY p.posicion_menu, p.nombre_producto
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
                p.id,
                p.codigo_producto,
                p.nombre_producto as nombre,
                p.descripcion_completa,
                p.precio_venta,
                p.categoria_id,
                p.requiere_preparacion,
                p.tiempo_preparacion_minutos,
                c.nombre_categoria as categoria
            FROM productos p
            INNER JOIN categorias_productos c ON p.categoria_id = c.id
            WHERE p.producto_activo = true
            ORDER BY c.orden_visualizacion, p.posicion_menu, p.nombre_producto
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
