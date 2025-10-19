/**
 * SYSME Backend - Rutas de Reportes
 * Generación de reportes del restaurante
 * Compatible con sistema antiguo de SYSME
 * Fecha: 18 de Octubre 2025
 */

const express = require('express');
const { executeQuery } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/reportes/ventas-diarias
 * Reporte de ventas por día
 */
router.get('/ventas-diarias', authenticateToken, async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;

        console.log('📊 Generando reporte de ventas diarias');

        const fechaInicio = fecha_inicio || new Date().toISOString().split('T')[0];
        const fechaFin = fecha_fin || fechaInicio;

        const result = await executeQuery(`
            SELECT
                DATE(v.timestamp_inicio) as fecha,
                COUNT(*) as total_ventas,
                SUM(v.total_final) as total_ingresos,
                AVG(v.total_final) as ticket_promedio,
                MIN(v.total_final) as ticket_minimo,
                MAX(v.total_final) as ticket_maximo
            FROM ventas_principales v
            WHERE DATE(v.timestamp_inicio) BETWEEN ? AND ?
            AND v.estado_venta = 'FINALIZADA'
            GROUP BY DATE(v.timestamp_inicio)
            ORDER BY fecha DESC
        `, [fechaInicio, fechaFin]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al generar reporte de ventas'
            });
        }

        const ventasPorDia = result.data.map(dia => ({
            fecha: dia.fecha,
            total_ventas: dia.total_ventas,
            total_ingresos: parseFloat(dia.total_ingresos) || 0,
            ticket_promedio: parseFloat(dia.ticket_promedio) || 0,
            ticket_minimo: parseFloat(dia.ticket_minimo) || 0,
            ticket_maximo: parseFloat(dia.ticket_maximo) || 0
        }));

        console.log(`✅ Reporte generado: ${ventasPorDia.length} días`);

        res.json({
            success: true,
            data: ventasPorDia,
            periodo: {
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin
            }
        });

    } catch (error) {
        console.error('❌ Error generando reporte de ventas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/reportes/productos-mas-vendidos
 * Reporte de productos más vendidos
 */
router.get('/productos-mas-vendidos', authenticateToken, async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin, limite = 20 } = req.query;

        console.log('📊 Generando reporte de productos más vendidos');

        const fechaInicio = fecha_inicio || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
        const fechaFin = fecha_fin || new Date().toISOString().split('T')[0];

        const result = await executeQuery(`
            SELECT
                p.id,
                p.nombre_producto,
                p.codigo_producto,
                c.nombre_categoria,
                SUM(dv.cantidad) as cantidad_vendida,
                SUM(dv.subtotal) as ingresos_totales,
                AVG(dv.precio_unitario) as precio_promedio,
                COUNT(DISTINCT dv.venta_id) as ventas_distintas
            FROM venta_detalles dv
            INNER JOIN productos p ON dv.producto_id = p.id
            INNER JOIN ventas_principales v ON dv.venta_id = v.id
            LEFT JOIN categorias_productos c ON p.categoria_id = c.id
            WHERE DATE(v.timestamp_inicio) BETWEEN ? AND ?
            AND v.estado_venta = 'FINALIZADA'
            GROUP BY p.id, p.nombre_producto, c.nombre_categoria
            ORDER BY cantidad_vendida DESC
            LIMIT ?
        `, [fechaInicio, fechaFin, parseInt(limite)]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al generar reporte de productos'
            });
        }

        const productosMasVendidos = result.data.map(producto => ({
            id: producto.id,
            nombre: producto.nombre_producto,
            codigo: producto.codigo_producto,
            categoria: producto.nombre_categoria,
            cantidad_vendida: producto.cantidad_vendida,
            ingresos_totales: parseFloat(producto.ingresos_totales) || 0,
            precio_promedio: parseFloat(producto.precio_promedio) || 0,
            ventas_distintas: producto.ventas_distintas
        }));

        console.log(`✅ Reporte generado: ${productosMasVendidos.length} productos`);

        res.json({
            success: true,
            data: productosMasVendidos,
            periodo: {
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin
            }
        });

    } catch (error) {
        console.error('❌ Error generando reporte de productos:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/reportes/ventas-por-mesa
 * Reporte de ventas por mesa
 */
router.get('/ventas-por-mesa', authenticateToken, async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;

        console.log('📊 Generando reporte de ventas por mesa');

        const fechaInicio = fecha_inicio || new Date().toISOString().split('T')[0];
        const fechaFin = fecha_fin || fechaInicio;

        const result = await executeQuery(`
            SELECT
                m.numero_mesa,
                m.zona_id,
                z.nombre_zona,
                COUNT(*) as total_ventas,
                SUM(v.total_final) as total_ingresos,
                AVG(v.total_final) as ticket_promedio,
                AVG(TIMESTAMPDIFF(MINUTE, v.timestamp_inicio, v.timestamp_finalizacion)) as tiempo_promedio_mesa
            FROM ventas_principales v
            INNER JOIN mesas_restaurante m ON v.mesa_id = m.id
            LEFT JOIN zonas_restaurante z ON m.zona_id = z.id
            WHERE DATE(v.timestamp_inicio) BETWEEN ? AND ?
            AND v.estado_venta = 'FINALIZADA'
            GROUP BY m.id, m.numero_mesa, z.nombre_zona
            ORDER BY total_ingresos DESC
        `, [fechaInicio, fechaFin]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al generar reporte de mesas'
            });
        }

        const ventasPorMesa = result.data.map(mesa => ({
            numero_mesa: mesa.numero_mesa,
            zona: mesa.nombre_zona,
            total_ventas: mesa.total_ventas,
            total_ingresos: parseFloat(mesa.total_ingresos) || 0,
            ticket_promedio: parseFloat(mesa.ticket_promedio) || 0,
            tiempo_promedio_mesa: mesa.tiempo_promedio_mesa || 0
        }));

        console.log(`✅ Reporte generado: ${ventasPorMesa.length} mesas`);

        res.json({
            success: true,
            data: ventasPorMesa,
            periodo: {
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin
            }
        });

    } catch (error) {
        console.error('❌ Error generando reporte de mesas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/reportes/ventas-por-empleado
 * Reporte de ventas por empleado
 */
router.get('/ventas-por-empleado', authenticateToken, async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;

        console.log('📊 Generando reporte de ventas por empleado');

        const fechaInicio = fecha_inicio || new Date().toISOString().split('T')[0];
        const fechaFin = fecha_fin || fechaInicio;

        const result = await executeQuery(`
            SELECT
                e.id,
                e.nombres,
                e.apellido_paterno,
                e.cargo,
                COUNT(*) as total_ventas,
                SUM(v.total_final) as total_ingresos,
                AVG(v.total_final) as ticket_promedio,
                AVG(TIMESTAMPDIFF(MINUTE, v.timestamp_inicio, v.timestamp_finalizacion)) as tiempo_promedio_venta
            FROM ventas_principales v
            INNER JOIN empleados e ON v.empleado_vendedor_id = e.id
            WHERE DATE(v.timestamp_inicio) BETWEEN ? AND ?
            AND v.estado_venta = 'FINALIZADA'
            GROUP BY e.id, e.nombres, e.apellido_paterno, e.cargo
            ORDER BY total_ingresos DESC
        `, [fechaInicio, fechaFin]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al generar reporte de empleados'
            });
        }

        const ventasPorEmpleado = result.data.map(empleado => ({
            id: empleado.id,
            nombre_completo: `${empleado.nombres} ${empleado.apellido_paterno}`,
            cargo: empleado.cargo,
            total_ventas: empleado.total_ventas,
            total_ingresos: parseFloat(empleado.total_ingresos) || 0,
            ticket_promedio: parseFloat(empleado.ticket_promedio) || 0,
            tiempo_promedio_venta: empleado.tiempo_promedio_venta || 0
        }));

        console.log(`✅ Reporte generado: ${ventasPorEmpleado.length} empleados`);

        res.json({
            success: true,
            data: ventasPorEmpleado,
            periodo: {
                fecha_inicio: fechaInicio,
                fecha_fin: fechaFin
            }
        });

    } catch (error) {
        console.error('❌ Error generando reporte de empleados:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/reportes/resumen-del-dia
 * Resumen ejecutivo del día actual
 */
router.get('/resumen-del-dia', authenticateToken, async (req, res) => {
    try {
        console.log('📊 Generando resumen del día');

        const hoy = new Date().toISOString().split('T')[0];

        // Ventas del día
        const ventasResult = await executeQuery(`
            SELECT
                COUNT(*) as total_ventas,
                SUM(total_final) as total_ingresos,
                AVG(total_final) as ticket_promedio
            FROM ventas_principales
            WHERE DATE(timestamp_inicio) = ?
            AND estado_venta = 'FINALIZADA'
        `, [hoy]);

        // Mesas ocupadas actualmente
        const mesasResult = await executeQuery(`
            SELECT COUNT(*) as mesas_ocupadas
            FROM mesas_restaurante
            WHERE estado_mesa = 'OCUPADA'
        `, []);

        // Productos más vendidos hoy (top 5)
        const productosResult = await executeQuery(`
            SELECT
                p.nombre_producto,
                SUM(dv.cantidad) as cantidad_vendida
            FROM venta_detalles dv
            INNER JOIN productos p ON dv.producto_id = p.id
            INNER JOIN ventas_principales v ON dv.venta_id = v.id
            WHERE DATE(v.timestamp_inicio) = ?
            AND v.estado_venta = 'FINALIZADA'
            GROUP BY p.id, p.nombre_producto
            ORDER BY cantidad_vendida DESC
            LIMIT 5
        `, [hoy]);

        // Órdenes pendientes en cocina (temporal - tabla no existe aún)
        const cocinaResult = { success: true, data: [{ ordenes_pendientes: 0 }] };
        // TODO: Implementar cuando se cree tabla ordenes_cocina
        /* const cocinaResult = await executeQuery(`
            SELECT COUNT(*) as ordenes_pendientes
            FROM ordenes_cocina
            WHERE estado_orden IN ('PENDIENTE', 'EN_PREPARACION')
            AND DATE(timestamp_creacion) = ?
        `, [hoy]); */

        const resumen = {
            ventas: {
                total_ventas: ventasResult.success ? (ventasResult.data[0]?.total_ventas || 0) : 0,
                total_ingresos: ventasResult.success ? parseFloat(ventasResult.data[0]?.total_ingresos || 0) : 0,
                ticket_promedio: ventasResult.success ? parseFloat(ventasResult.data[0]?.ticket_promedio || 0) : 0
            },
            mesas: {
                mesas_ocupadas: mesasResult.success ? (mesasResult.data[0]?.mesas_ocupadas || 0) : 0
            },
            productos_top: productosResult.success ? productosResult.data.map(p => ({
                nombre: p.nombre_producto,
                cantidad: p.cantidad_vendida
            })) : [],
            cocina: {
                ordenes_pendientes: cocinaResult.success ? (cocinaResult.data[0]?.ordenes_pendientes || 0) : 0
            },
            fecha: hoy,
            hora_generacion: new Date().toISOString()
        };

        console.log('✅ Resumen del día generado');

        res.json({
            success: true,
            data: resumen
        });

    } catch (error) {
        console.error('❌ Error generando resumen del día:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/reportes/lista
 * Lista de tipos de reportes disponibles
 */
router.get('/lista', authenticateToken, async (req, res) => {
    try {
        const reportesDisponibles = [
            {
                id: 'ventas-diarias',
                nombre: 'Ventas Diarias',
                descripcion: 'Reporte de ventas agrupadas por día',
                parametros: ['fecha_inicio', 'fecha_fin']
            },
            {
                id: 'productos-mas-vendidos',
                nombre: 'Productos Más Vendidos',
                descripcion: 'Ranking de productos por cantidad vendida',
                parametros: ['fecha_inicio', 'fecha_fin', 'limite']
            },
            {
                id: 'ventas-por-mesa',
                nombre: 'Ventas por Mesa',
                descripcion: 'Análisis de rendimiento por mesa',
                parametros: ['fecha_inicio', 'fecha_fin']
            },
            {
                id: 'ventas-por-empleado',
                nombre: 'Ventas por Empleado',
                descripcion: 'Rendimiento de ventas por empleado',
                parametros: ['fecha_inicio', 'fecha_fin']
            },
            {
                id: 'resumen-del-dia',
                nombre: 'Resumen del Día',
                descripcion: 'Resumen ejecutivo del día actual',
                parametros: []
            }
        ];

        res.json({
            success: true,
            data: reportesDisponibles
        });

    } catch (error) {
        console.error('❌ Error obteniendo lista de reportes:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

module.exports = router;