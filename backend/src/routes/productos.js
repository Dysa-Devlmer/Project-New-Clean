/**
 * SYSME Backend - Rutas de Productos
 * Gestión del catálogo de productos del restaurante
 * Compatible con sistema antiguo de SYSME
 * Fecha: 18 de Octubre 2025
 */

const express = require('express');
const { executeQuery, queries } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/productos
 * Obtener todos los productos activos con sus categorías
 */
router.get('/', optionalAuth, async (req, res) => {
    try {
        console.log('📦 Solicitando catálogo completo de productos');

        const result = await executeQuery(queries.getAllProductos, []);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener productos'
            });
        }

        // Organizar productos por categoría
        const productosAgrupados = {};
        const productosPlanos = [];

        result.data.forEach(producto => {
            const categoria = producto.categoria_nombre || 'Sin categoría';

            if (!productosAgrupados[categoria]) {
                productosAgrupados[categoria] = [];
            }

            const productoFormateado = {
                id: producto.id,
                codigo: producto.codigo_producto,
                nombre: producto.nombre_producto,
                descripcion: producto.descripcion_completa,
                precio_venta: parseFloat(producto.precio_venta) || 0,
                categoria_id: producto.categoria_id,
                categoria_nombre: categoria,
                imagen_url: producto.imagen_producto,
                disponible_delivery: producto.disponible_delivery || false,
                tiempo_preparacion: producto.tiempo_preparacion_minutos || 15,
                ingredientes: producto.ingredientes_principales,
                activo: producto.producto_activo
            };

            productosAgrupados[categoria].push(productoFormateado);
            productosPlanos.push(productoFormateado);
        });

        console.log(`✅ ${productosPlanos.length} productos obtenidos`);

        res.json({
            success: true,
            data: {
                productos: productosPlanos,
                por_categoria: productosAgrupados,
                total: productosPlanos.length
            }
        });

    } catch (error) {
        console.error('❌ Error obteniendo productos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/productos/categorias
 * Obtener todas las categorías activas
 */
router.get('/categorias', optionalAuth, async (req, res) => {
    try {
        console.log('📋 Solicitando categorías de productos');

        const result = await executeQuery(queries.getAllCategorias, []);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener categorías'
            });
        }

        const categorias = result.data.map(cat => ({
            id: cat.id,
            nombre: cat.nombre,
            descripcion: cat.descripcion,
            orden_display: cat.orden_display,
            color_hex: cat.color_hex || '#3498db',
            icono: cat.icono || '🍽️',
            activa: cat.activa
        }));

        console.log(`✅ ${categorias.length} categorías obtenidas`);

        res.json({
            success: true,
            data: categorias
        });

    } catch (error) {
        console.error('❌ Error obteniendo categorías:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/productos/categoria/:id
 * Obtener productos de una categoría específica
 */
router.get('/categoria/:id', optionalAuth, async (req, res) => {
    try {
        const categoriaId = req.params.id;
        console.log(`📦 Solicitando productos de categoría: ${categoriaId}`);

        const result = await executeQuery(queries.getProductosByCategoria, [categoriaId]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener productos de la categoría'
            });
        }

        const productos = result.data.map(producto => ({
            id: producto.id,
            codigo: producto.codigo_producto,
            nombre: producto.nombre_producto,
            descripcion: producto.descripcion_completa,
            precio_venta: parseFloat(producto.precio_venta) || 0,
            categoria_id: producto.categoria_id,
            imagen_url: producto.imagen_producto,
            disponible_delivery: producto.disponible_delivery || false,
            tiempo_preparacion: producto.tiempo_preparacion_minutos || 15,
            ingredientes: producto.ingredientes_principales,
            activo: producto.producto_activo
        }));

        console.log(`✅ ${productos.length} productos obtenidos para categoría ${categoriaId}`);

        res.json({
            success: true,
            data: productos
        });

    } catch (error) {
        console.error('❌ Error obteniendo productos por categoría:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/productos/:id
 * Obtener un producto específico por ID
 */
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const productoId = req.params.id;
        console.log(`📦 Solicitando producto ID: ${productoId}`);

        const result = await executeQuery(
            'SELECT p.*, c.nombre_categoria as categoria_nombre FROM productos p LEFT JOIN categorias_productos c ON p.categoria_id = c.id WHERE p.id = ? AND p.producto_activo = 1',
            [productoId]
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener producto'
            });
        }

        if (result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const producto = result.data[0];
        const productoFormateado = {
            id: producto.id,
            codigo: producto.codigo_producto,
            nombre: producto.nombre_producto,
            descripcion: producto.descripcion_completa,
            precio_venta: parseFloat(producto.precio_venta) || 0,
            categoria_id: producto.categoria_id,
            categoria_nombre: producto.categoria_nombre || 'Sin categoría',
            imagen_url: producto.imagen_producto,
            disponible_delivery: producto.disponible_delivery || false,
            tiempo_preparacion: producto.tiempo_preparacion_minutos || 15,
            ingredientes: producto.ingredientes_principales,
            activo: producto.producto_activo
        };

        console.log(`✅ Producto obtenido: ${producto.nombre_producto}`);

        res.json({
            success: true,
            data: productoFormateado
        });

    } catch (error) {
        console.error('❌ Error obteniendo producto:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /api/productos/buscar
 * Buscar productos por nombre o código
 */
router.post('/buscar', optionalAuth, async (req, res) => {
    try {
        const { termino } = req.body;

        if (!termino) {
            return res.status(400).json({
                success: false,
                error: 'Término de búsqueda requerido'
            });
        }

        console.log(`🔍 Buscando productos: "${termino}"`);

        const result = await executeQuery(
            `SELECT p.*, c.nombre_categoria as categoria_nombre
             FROM productos p
             LEFT JOIN categorias_productos c ON p.categoria_id = c.id
             WHERE p.producto_activo = 1
             AND (p.nombre_producto LIKE ? OR p.codigo_producto LIKE ? OR p.descripcion_completa LIKE ?)
             ORDER BY p.nombre_producto`,
            [`%${termino}%`, `%${termino}%`, `%${termino}%`]
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error en búsqueda de productos'
            });
        }

        const productos = result.data.map(producto => ({
            id: producto.id,
            codigo: producto.codigo_producto,
            nombre: producto.nombre_producto,
            descripcion: producto.descripcion_completa,
            precio_venta: parseFloat(producto.precio_venta) || 0,
            categoria_id: producto.categoria_id,
            categoria_nombre: producto.categoria_nombre || 'Sin categoría',
            imagen_url: producto.imagen_producto,
            tiempo_preparacion: producto.tiempo_preparacion || 15
        }));

        console.log(`✅ ${productos.length} productos encontrados para "${termino}"`);

        res.json({
            success: true,
            data: productos,
            termino_busqueda: termino
        });

    } catch (error) {
        console.error('❌ Error en búsqueda de productos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

module.exports = router;