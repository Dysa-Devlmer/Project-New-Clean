/**
 * SYSME Backend - Rutas de Ventas
 * Sistema completo de ventas POS para restaurante
 * Compatible con sistema antiguo de SYSME
 * Fecha: 18 de Octubre 2025
 */

const express = require('express');
const { executeQuery, executeTransaction, queries } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/ventas/nueva
 * Crear nueva venta - Equivalente al sistema antiguo
 */
router.post('/nueva', authenticateToken, async (req, res) => {
    try {
        const { mesa_id, tipo_venta = 'MESA' } = req.body;
        const empleado_id = req.empleado.id;
        const terminal_id = req.empleado.terminal || 1;

        console.log(`💰 Creando nueva venta - Mesa: ${mesa_id}, Empleado: ${req.empleado.nombre}`);

        // Generar número de venta único
        const numeroVenta = `V${Date.now()}`;

        const result = await executeQuery(queries.createVenta, [
            numeroVenta,
            mesa_id,
            empleado_id,
            terminal_id,
            tipo_venta
        ]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al crear venta'
            });
        }

        const ventaId = result.data.insertId;

        // Si tiene mesa, actualizar estado de la mesa
        if (mesa_id) {
            await executeQuery(queries.updateEstadoMesa, ['OCUPADA', mesa_id]);
        }

        console.log(`✅ Venta creada: ID ${ventaId}, Número: ${numeroVenta}`);

        res.json({
            success: true,
            message: 'Venta creada exitosamente',
            data: {
                id: ventaId,
                numero_venta: numeroVenta,
                mesa_id,
                empleado_id,
                terminal_id,
                tipo_venta,
                estado: 'ABIERTA',
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error creando venta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /api/ventas/:id/producto
 * Agregar producto a venta - Core del sistema POS
 */
router.post('/:id/producto', authenticateToken, async (req, res) => {
    try {
        const ventaId = req.params.id;
        const { producto_id, cantidad = 1, observaciones = '' } = req.body;

        console.log(`➕ Agregando producto ${producto_id} (x${cantidad}) a venta ${ventaId}`);

        // Verificar que la venta existe y está abierta
        const ventaResult = await executeQuery(
            'SELECT * FROM ventas_principales WHERE id = ? AND estado_venta = "ABIERTA"',
            [ventaId]
        );

        if (!ventaResult.success || ventaResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada o cerrada'
            });
        }

        // Obtener información del producto
        const productoResult = await executeQuery(
            'SELECT * FROM productos WHERE id = ? AND producto_activo = 1',
            [producto_id]
        );

        if (!productoResult.success || productoResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Producto no encontrado'
            });
        }

        const producto = productoResult.data[0];
        const precioUnitario = parseFloat(producto.precio_venta);
        const subtotal = precioUnitario * cantidad;

        // Generar número de línea (obtener siguiente número)
        const numeroLineaResult = await executeQuery(
            'SELECT COALESCE(MAX(numero_linea), 0) + 1 as siguiente_linea FROM venta_detalles WHERE venta_id = ?',
            [ventaId]
        );
        const numeroLinea = numeroLineaResult.data[0]?.siguiente_linea || 1;

        // Agregar detalle de venta
        const detalleResult = await executeQuery(queries.addDetalleVenta, [
            ventaId,                    // venta_id
            numeroLinea,                // numero_linea
            producto_id,                // producto_id
            producto.codigo_producto || `PROD${producto_id}`, // codigo_producto
            producto.nombre_producto,   // nombre_producto
            cantidad,                   // cantidad
            precioUnitario,            // precio_unitario
            subtotal,                  // subtotal_linea
            subtotal,                  // subtotal_con_descuento (mismo que subtotal por ahora)
            observaciones              // observaciones_item
        ]);

        if (!detalleResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al agregar producto a venta'
            });
        }

        // Recalcular total de la venta
        await recalcularTotalVenta(ventaId);

        console.log(`✅ Producto agregado: ${producto.nombre} x${cantidad} = $${subtotal}`);

        res.json({
            success: true,
            message: 'Producto agregado a venta',
            data: {
                detalle_id: detalleResult.data.insertId,
                producto_nombre: producto.nombre,
                cantidad,
                precio_unitario: precioUnitario,
                subtotal,
                observaciones
            }
        });

    } catch (error) {
        console.error('❌ Error agregando producto a venta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/ventas/:id/detalles
 * Obtener detalles de una venta (líneas de productos)
 */
router.get('/:id/detalles', authenticateToken, async (req, res) => {
    try {
        const ventaId = req.params.id;

        console.log(`📋 Obteniendo detalles de venta ${ventaId}`);

        const result = await executeQuery(queries.getDetallesVenta, [ventaId]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener detalles de venta'
            });
        }

        const detalles = result.data.map(detalle => ({
            id: detalle.id,
            producto_id: detalle.producto_id,
            producto_nombre: detalle.producto_nombre,
            cantidad: detalle.cantidad,
            precio_unitario: parseFloat(detalle.precio_unitario),
            subtotal: parseFloat(detalle.subtotal),
            observaciones: detalle.observaciones,
            estado_cocina: detalle.estado_cocina || 'PENDIENTE'
        }));

        console.log(`✅ ${detalles.length} líneas de venta obtenidas`);

        res.json({
            success: true,
            data: detalles
        });

    } catch (error) {
        console.error('❌ Error obteniendo detalles de venta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/ventas/abiertas
 * Obtener todas las ventas abiertas - Para mostrar en pantalla principal
 */
router.get('/abiertas', authenticateToken, async (req, res) => {
    try {
        console.log('📊 Obteniendo ventas abiertas');

        const result = await executeQuery(queries.getVentasAbiertas, []);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener ventas abiertas'
            });
        }

        const ventas = result.data.map(venta => ({
            id: venta.id,
            numero_venta: venta.numero_venta,
            mesa_id: venta.mesa_id,
            empleado_vendedor_id: venta.empleado_vendedor_id,
            total_final: parseFloat(venta.total_final) || 0,
            estado_venta: venta.estado_venta,
            estado_cocina: venta.estado_cocina,
            timestamp_inicio: venta.timestamp_inicio,
            tipo_venta: venta.tipo_venta
        }));

        console.log(`✅ ${ventas.length} ventas abiertas encontradas`);

        res.json({
            success: true,
            data: ventas
        });

    } catch (error) {
        console.error('❌ Error obteniendo ventas abiertas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /api/ventas/:id/cerrar
 * Cerrar venta - Finalizar el proceso de venta
 */
router.post('/:id/cerrar', authenticateToken, async (req, res) => {
    try {
        const ventaId = req.params.id;
        const { forma_pago = 'EFECTIVO', monto_recibido = 0 } = req.body;

        console.log(`🔒 Cerrando venta ${ventaId}`);

        // Verificar que la venta existe y está abierta
        const ventaResult = await executeQuery(
            'SELECT * FROM ventas_principales WHERE id = ? AND estado_venta = "ABIERTA"',
            [ventaId]
        );

        if (!ventaResult.success || ventaResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada o ya cerrada'
            });
        }

        const venta = ventaResult.data[0];

        // Cerrar venta
        await executeQuery(queries.cerrarVenta, [ventaId]);

        // Si tiene mesa, liberar la mesa
        if (venta.mesa_id) {
            await executeQuery(queries.updateEstadoMesa, ['LIBRE', venta.mesa_id]);
        }

        // Registrar pago si se proporciona
        if (monto_recibido > 0) {
            await executeQuery(
                `INSERT INTO pagos_ventas (venta_id, forma_pago, monto, timestamp_pago)
                 VALUES (?, ?, ?, NOW())`,
                [ventaId, forma_pago, monto_recibido]
            );
        }

        console.log(`✅ Venta cerrada: ${venta.numero_venta}`);

        res.json({
            success: true,
            message: 'Venta cerrada exitosamente',
            data: {
                venta_id: ventaId,
                numero_venta: venta.numero_venta,
                total_final: parseFloat(venta.total_final),
                forma_pago,
                monto_recibido,
                timestamp_cierre: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error cerrando venta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * DELETE /api/ventas/:id/detalle/:detalleId
 * Eliminar línea de venta
 */
router.delete('/:id/detalle/:detalleId', authenticateToken, async (req, res) => {
    try {
        const { id: ventaId, detalleId } = req.params;

        console.log(`🗑️ Eliminando línea ${detalleId} de venta ${ventaId}`);

        // Verificar que la venta está abierta
        const ventaResult = await executeQuery(
            'SELECT * FROM ventas_principales WHERE id = ? AND estado_venta = "ABIERTA"',
            [ventaId]
        );

        if (!ventaResult.success || ventaResult.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada o cerrada'
            });
        }

        // Eliminar detalle
        const deleteResult = await executeQuery(
            'DELETE FROM venta_detalles WHERE id = ? AND venta_id = ?',
            [detalleId, ventaId]
        );

        if (!deleteResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al eliminar línea de venta'
            });
        }

        // Recalcular total
        await recalcularTotalVenta(ventaId);

        console.log(`✅ Línea de venta eliminada`);

        res.json({
            success: true,
            message: 'Línea de venta eliminada'
        });

    } catch (error) {
        console.error('❌ Error eliminando línea de venta:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * Función auxiliar para recalcular el total de una venta
 */
async function recalcularTotalVenta(ventaId) {
    try {
        const result = await executeQuery(
            'SELECT SUM(subtotal_con_descuento) as total FROM venta_detalles WHERE venta_id = ?',
            [ventaId]
        );

        if (result.success && result.data.length > 0) {
            const total = parseFloat(result.data[0].total) || 0;
            await executeQuery(queries.updateTotalVenta, [total, ventaId]);
        }
    } catch (error) {
        console.error('❌ Error recalculando total:', error);
    }
}

module.exports = router;