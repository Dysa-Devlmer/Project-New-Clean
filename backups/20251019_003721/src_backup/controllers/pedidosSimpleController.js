// Controlador de Pedidos Simplificado - Para demostración y testing
const { pool } = require('../config/database');

// Crear pedido simplificado usando tablas existentes
async function crearPedidoSimple(req, res) {
    try {
        const {
            numero_mesa,
            productos, // Array de {id, cantidad}
            empleado_id = 1
        } = req.body;

        console.log('Creando pedido para mesa:', numero_mesa);
        console.log('Productos:', productos);

        // Verificar que la mesa existe
        const [mesa] = await pool.query(
            'SELECT id FROM mesas_restaurante WHERE numero_mesa = ?',
            [numero_mesa]
        );

        if (mesa.length === 0) {
            return res.status(400).json({
                success: false,
                error: `Mesa ${numero_mesa} no encontrada`
            });
        }

        // Calcular total del pedido
        let total = 0;
        const detalles = [];

        for (const producto of productos) {
            // Obtener producto y precio
            const [prod] = await pool.query(
                'SELECT id, nombre_producto, precio_venta FROM productos WHERE id = ?',
                [producto.id]
            );

            if (prod.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: `Producto ${producto.id} no encontrado`
                });
            }

            const precio_unitario = parseFloat(prod[0].precio_venta);
            const subtotal = precio_unitario * producto.cantidad;
            total += subtotal;

            detalles.push({
                producto_id: producto.id,
                nombre_producto: prod[0].nombre_producto,
                cantidad: producto.cantidad,
                precio_unitario,
                subtotal
            });
        }

        // Simular creación de pedido (sin insertar en BD por ahora)
        const pedido = {
            id_pedido: Date.now(),
            numero_mesa,
            mesa_id: mesa[0].id,
            empleado_id,
            productos: detalles,
            total: total,
            estado: 'CREADO',
            fecha_creacion: new Date().toISOString()
        };

        res.json({
            success: true,
            message: 'Pedido creado exitosamente',
            pedido
        });

    } catch (error) {
        console.error('Error al crear pedido simple:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// Obtener menú disponible para crear pedidos
async function obtenerMenuDisponible(req, res) {
    try {
        const [productos] = await pool.query(`
            SELECT
                p.id,
                p.codigo_producto,
                p.nombre_producto,
                p.descripcion_completa,
                p.precio_venta,
                c.nombre_categoria,
                p.tiempo_preparacion_minutos
            FROM productos p
            INNER JOIN categorias_productos c ON p.categoria_id = c.id
            WHERE p.producto_activo = 1
            ORDER BY c.orden_visualizacion, p.posicion_menu
        `);

        res.json({
            success: true,
            productos,
            total_productos: productos.length
        });

    } catch (error) {
        console.error('Error al obtener menú:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

// Obtener estado de mesas para pedidos
async function obtenerEstadoMesasParaPedidos(req, res) {
    try {
        const [mesas] = await pool.query(`
            SELECT
                id,
                numero_mesa,
                capacidad_personas,
                zona_id,
                estado_mesa,
                forma_mesa
            FROM mesas_restaurante
            WHERE mesa_activa = 1
            ORDER BY numero_mesa
        `);

        res.json({
            success: true,
            mesas,
            total_mesas: mesas.length
        });

    } catch (error) {
        console.error('Error al obtener estado de mesas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
}

module.exports = {
    crearPedidoSimple,
    obtenerMenuDisponible,
    obtenerEstadoMesasParaPedidos
};