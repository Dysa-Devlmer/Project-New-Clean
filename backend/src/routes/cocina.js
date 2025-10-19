/**
 * SYSME Backend - Rutas de Cocina
 * Panel de cocina en tiempo real para restaurante
 * Compatible con sistema antiguo de SYSME
 * Fecha: 18 de Octubre 2025
 */

const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/cocina/ordenes
 * Obtener todas las órdenes pendientes y en preparación para cocina
 */
router.get('/ordenes', optionalAuth, async (req, res) => {
    try {
        console.log('👨‍🍳 Obteniendo órdenes para cocina');

        const result = await executeQuery(`
            SELECT
                v.id as venta_id,
                v.numero_venta,
                v.timestamp_inicio,
                m.numero_mesa,
                e.nombres as empleado_nombre,
                vd.id as detalle_id,
                vd.producto_id,
                p.nombre_producto as producto_nombre,
                vd.cantidad,
                vd.observaciones_item as observaciones,
                vd.estado_preparacion as estado_preparacion,
                vd.created_at as timestamp_pedido,
                p.tiempo_preparacion_minutos as tiempo_preparacion
            FROM ventas_principales v
            INNER JOIN venta_detalles vd ON v.id = vd.venta_id
            INNER JOIN productos p ON vd.producto_id = p.id
            LEFT JOIN mesas_restaurante m ON v.mesa_id = m.id
            LEFT JOIN empleados e ON v.empleado_vendedor_id = e.id
            WHERE v.estado_venta = 'ABIERTA'
            AND vd.estado_preparacion IN ('PENDIENTE', 'EN_PREPARACION')
            ORDER BY vd.created_at ASC, v.timestamp_inicio ASC
        `, []);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener órdenes de cocina'
            });
        }

        // Agrupar por venta para mejor visualización
        const ordenesPorVenta = {};
        const ahora = new Date();

        result.data.forEach(item => {
            const ventaId = item.venta_id;

            if (!ordenesPorVenta[ventaId]) {
                ordenesPorVenta[ventaId] = {
                    venta_id: ventaId,
                    numero_venta: item.numero_venta,
                    numero_mesa: item.numero_mesa || 'Takeaway',
                    empleado_nombre: item.empleado_nombre,
                    timestamp_inicio: item.timestamp_inicio,
                    tiempo_transcurrido: Math.floor((ahora - new Date(item.timestamp_inicio)) / 60000),
                    productos: []
                };
            }

            ordenesPorVenta[ventaId].productos.push({
                detalle_id: item.detalle_id,
                producto_id: item.producto_id,
                producto_nombre: item.producto_nombre,
                cantidad: item.cantidad,
                observaciones: item.observaciones,
                estado_preparacion: item.estado_preparacion,
                timestamp_pedido: item.timestamp_pedido,
                tiempo_preparacion: item.tiempo_preparacion || 15,
                minutos_transcurridos: Math.floor((ahora - new Date(item.timestamp_pedido)) / 60000)
            });
        });

        const ordenes = Object.values(ordenesPorVenta);

        // Estadísticas para el panel
        const estadisticas = {
            total_ordenes: ordenes.length,
            productos_pendientes: result.data.filter(item => item.estado_preparacion === 'PENDIENTE').length,
            productos_en_preparacion: result.data.filter(item => item.estado_preparacion === 'EN_PREPARACION').length,
            tiempo_promedio_espera: ordenes.length > 0 ?
                Math.round(ordenes.reduce((sum, orden) => sum + orden.tiempo_transcurrido, 0) / ordenes.length) : 0
        };

        console.log(`✅ ${ordenes.length} órdenes activas en cocina`);

        res.json({
            success: true,
            data: ordenes,
            estadisticas
        });

    } catch (error) {
        console.error('❌ Error obteniendo órdenes de cocina:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * PUT /api/cocina/detalle/:detalleId/estado
 * Actualizar estado de un producto en cocina
 */
router.put('/detalle/:detalleId/estado', authenticateToken, async (req, res) => {
    try {
        const detalleId = req.params.detalleId;
        const { nuevo_estado } = req.body;

        console.log(`🔄 Actualizando estado de producto ${detalleId} a ${nuevo_estado}`);

        if (!['PENDIENTE', 'EN_PREPARACION', 'LISTO', 'ENTREGADO'].includes(nuevo_estado)) {
            return res.status(400).json({
                success: false,
                error: 'Estado de cocina inválido'
            });
        }

        // Obtener información del detalle
        const detalleResult = await executeQuery(`
            SELECT vd.*, p.nombre_producto as producto_nombre, v.numero_venta, m.numero_mesa
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            INNER JOIN ventas_principales v ON vd.venta_id = v.id
            LEFT JOIN mesas_restaurante m ON v.mesa_id = m.id
            WHERE vd.id = ?
        `, [detalleId]);

        if (!detalleResult.success || detalleResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const detalle = detalleResult.data[0];

        // Actualizar estado
        const updateResult = await executeQuery(`
            UPDATE venta_detalles
            SET estado_preparacion = ?,
                timestamp_preparacion = CASE
                    WHEN ? = 'EN_PREPARACION' THEN NOW()
                    ELSE timestamp_preparacion
                END,
                timestamp_listo = CASE
                    WHEN ? = 'LISTO' THEN NOW()
                    ELSE timestamp_listo
                END,
                timestamp_entregado = CASE
                    WHEN ? = 'ENTREGADO' THEN NOW()
                    ELSE timestamp_entregado
                END
            WHERE id = ?
        `, [nuevo_estado, nuevo_estado, nuevo_estado, nuevo_estado, detalleId]);

        if (!updateResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar estado del producto'
            });
        }

        // Verificar si todos los productos de la venta están listos
        const ventaEstadoResult = await executeQuery(`
            SELECT
                COUNT(*) as total_productos,
                SUM(CASE WHEN estado_preparacion = 'LISTO' OR estado_preparacion = 'ENTREGADO' THEN 1 ELSE 0 END) as productos_listos
            FROM venta_detalles
            WHERE venta_id = ?
        `, [detalle.venta_id]);

        let venta_completa = false;
        if (ventaEstadoResult.success && ventaEstadoResult.data.length > 0) {
            const estadoVenta = ventaEstadoResult.data[0];
            venta_completa = estadoVenta.total_productos === estadoVenta.productos_listos;

            // Si todos están listos, actualizar estado de cocina de la venta
            if (venta_completa) {
                await executeQuery(`
                    UPDATE ventas_principales
                    SET estado_preparacion = 'LISTO'
                    WHERE id = ?
                `, [detalle.venta_id]);
            }
        }

        console.log(`✅ Producto ${detalle.producto_nombre} actualizado a ${nuevo_estado}`);

        res.json({
            success: true,
            message: 'Estado de producto actualizado',
            data: {
                detalle_id: detalleId,
                producto_nombre: detalle.producto_nombre,
                numero_venta: detalle.numero_venta,
                numero_mesa: detalle.numero_mesa,
                estado_anterior: detalle.estado_preparacion,
                estado_nuevo: nuevo_estado,
                venta_completa,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error actualizando estado de cocina:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/cocina/estadisticas
 * Obtener estadísticas del panel de cocina
 */
router.get('/estadisticas', optionalAuth, async (req, res) => {
    try {
        console.log('📊 Obteniendo estadísticas de cocina');

        // Estadísticas generales
        const estadisticasResult = await executeQuery(`
            SELECT
                COUNT(DISTINCT v.id) as ordenes_activas,
                COUNT(vd.id) as total_productos,
                SUM(CASE WHEN vd.estado_preparacion = 'PENDIENTE' THEN 1 ELSE 0 END) as pendientes,
                SUM(CASE WHEN vd.estado_preparacion = 'EN_PREPARACION' THEN 1 ELSE 0 END) as en_preparacion,
                SUM(CASE WHEN vd.estado_preparacion = 'LISTO' THEN 1 ELSE 0 END) as listos
            FROM ventas_principales v
            INNER JOIN venta_detalles vd ON v.id = vd.venta_id
            WHERE v.estado_venta = 'ABIERTA'
        `, []);

        // Tiempo promedio de preparación
        const tiemposResult = await executeQuery(`
            SELECT
                AVG(TIMESTAMPDIFF(MINUTE, vd.created_at, NOW())) as tiempo_promedio_minutos,
                MAX(TIMESTAMPDIFF(MINUTE, vd.created_at, NOW())) as tiempo_maximo_minutos
            FROM ventas_principales v
            INNER JOIN venta_detalles vd ON v.id = vd.venta_id
            WHERE v.estado_venta = 'ABIERTA'
            AND vd.estado_preparacion IN ('PENDIENTE', 'EN_PREPARACION')
        `, []);

        // Productos más pedidos hoy
        const productosPopularesResult = await executeQuery(`
            SELECT
                p.nombre_producto,
                COUNT(*) as cantidad_pedidos
            FROM ventas_principales v
            INNER JOIN venta_detalles vd ON v.id = vd.venta_id
            INNER JOIN productos p ON vd.producto_id = p.id
            WHERE DATE(v.fecha_venta) = CURDATE()
            GROUP BY p.id, p.nombre_producto
            ORDER BY cantidad_pedidos DESC
            LIMIT 5
        `, []);

        const estadisticas = {
            general: estadisticasResult.success && estadisticasResult.data.length > 0 ? {
                ordenes_activas: estadisticasResult.data[0].ordenes_activas || 0,
                total_productos: estadisticasResult.data[0].total_productos || 0,
                pendientes: estadisticasResult.data[0].pendientes || 0,
                en_preparacion: estadisticasResult.data[0].en_preparacion || 0,
                listos: estadisticasResult.data[0].listos || 0
            } : {},

            tiempos: tiemposResult.success && tiemposResult.data.length > 0 ? {
                tiempo_promedio_minutos: Math.round(tiemposResult.data[0].tiempo_promedio_minutos || 0),
                tiempo_maximo_minutos: tiemposResult.data[0].tiempo_maximo_minutos || 0
            } : {},

            productos_populares: productosPopularesResult.success ? productosPopularesResult.data : []
        };

        console.log(`✅ Estadísticas de cocina obtenidas`);

        res.json({
            success: true,
            data: estadisticas
        });

    } catch (error) {
        console.error('❌ Error obteniendo estadísticas de cocina:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /api/cocina/marcar-servido
 * Marcar producto como servido - Compatible con sistema antiguo
 */
router.post('/marcar-servido', authenticateToken, async (req, res) => {
    try {
        const { venta_id, detalle_id } = req.body;

        console.log(`✅ Marcando como servido - Venta: ${venta_id}, Detalle: ${detalle_id}`);

        if (!detalle_id) {
            return res.status(400).json({
                success: false,
                error: 'ID de detalle requerido'
            });
        }

        // Actualizar estado a entregado
        const result = await executeQuery(`
            UPDATE venta_detalles
            SET estado_preparacion = 'ENTREGADO',
                timestamp_entregado = NOW()
            WHERE id = ?
        `, [detalle_id]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al marcar producto como servido'
            });
        }

        console.log(`✅ Producto marcado como servido`);

        res.json({
            success: true,
            message: 'Producto marcado como servido',
            data: {
                detalle_id,
                estado: 'ENTREGADO',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error marcando producto como servido:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

module.exports = router;