/**
 * =====================================================
 * CONTROLADOR DE HISTORIAL DE VENTAS - SISTEMA REAL COMPLETAMENTE CORREGIDO
 * Descripción: Gestión de consultas históricas de ventas con filtros avanzados
 * Autor: Sistema POS Mistura - CORREGIDO POR CLAUDE CODE
 * Fecha: 2025-10-18 - VERSIÓN CORREGIDA
 * ESQUEMA: Corregido para base de datos real
 * =====================================================
 */

const { pool } = require('../config/database');

/**
 * Obtener historial de ventas con filtros y paginación - CORREGIDO
 * @route GET /api/historial
 */
async function obtenerHistorial(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            empleado_id,
            mesa_id,
            forma_pago_id,
            estado,
            pagina = 1,
            limite = 20
        } = req.query;

        // Validaciones
        if (pagina < 1) {
            return res.status(400).json({
                success: false,
                error: 'El número de página debe ser mayor a 0'
            });
        }

        if (limite < 1 || limite > 100) {
            return res.status(400).json({
                success: false,
                error: 'El límite debe estar entre 1 y 100'
            });
        }

        // Construir query dinámico - ESQUEMA CORREGIDO
        let whereConditions = ['1=1'];
        let queryParams = [];

        // Filtro de fechas
        if (fecha_desde) {
            whereConditions.push('DATE(vp.fecha_venta) >= ?');
            queryParams.push(fecha_desde);
        }

        if (fecha_hasta) {
            whereConditions.push('DATE(vp.fecha_venta) <= ?');
            queryParams.push(fecha_hasta);
        }

        // Filtro de empleado (vendedor)
        if (empleado_id) {
            whereConditions.push('vp.empleado_vendedor_id = ?');
            queryParams.push(empleado_id);
        }

        // Filtro de mesa
        if (mesa_id) {
            whereConditions.push('vp.mesa_id = ?');
            queryParams.push(mesa_id);
        }

        // Filtro de estado
        if (estado) {
            whereConditions.push('vp.estado_venta = ?');
            queryParams.push(estado);
        } else {
            // Por defecto, solo ventas cerradas y pagadas
            whereConditions.push('vp.estado_venta IN ("PAGADA", "CERRADA", "CANCELADA")');
        }

        const whereClause = whereConditions.join(' AND ');

        // Obtener total de registros
        const [countResult] = await pool.query(`
            SELECT COUNT(*) as total
            FROM ventas_principales vp
            WHERE ${whereClause}
        `, queryParams);

        const totalRegistros = countResult[0].total;
        const totalPaginas = Math.ceil(totalRegistros / limite);
        const offset = (pagina - 1) * limite;

        // Obtener registros paginados - ESQUEMA CORREGIDO
        const [ventas] = await pool.query(`
            SELECT
                vp.id,
                vp.numero_venta,
                vp.fecha_venta,
                vp.hora_inicio,
                vp.timestamp_cierre,
                vp.estado_venta,
                vp.total_final,
                vp.numero_comensales,
                vp.observaciones_generales,
                mr.numero_mesa,
                mr.descripcion_mesa,
                mr.zona_mesa,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                e.puesto_trabajo,
                COUNT(vd.id) as total_productos,
                GROUP_CONCAT(DISTINCT fp.nombre_forma_pago) as formas_pago_usadas
            FROM ventas_principales vp
            LEFT JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            LEFT JOIN empleados e ON vp.empleado_vendedor_id = e.id
            LEFT JOIN venta_detalles vd ON vp.id = vd.venta_id
            LEFT JOIN pagos_ventas pv ON vp.id = pv.venta_id
            LEFT JOIN formas_pago fp ON pv.forma_pago_id = fp.id
            WHERE ${whereClause}
            GROUP BY vp.id, vp.numero_venta, vp.fecha_venta, vp.hora_inicio, vp.timestamp_cierre,
                     vp.estado_venta, vp.total_final, vp.numero_comensales, vp.observaciones_generales,
                     mr.numero_mesa, mr.descripcion_mesa, mr.zona_mesa, e.nombres, e.apellido_paterno, e.puesto_trabajo
            ORDER BY vp.fecha_venta DESC, vp.hora_inicio DESC
            LIMIT ? OFFSET ?
        `, [...queryParams, parseInt(limite), offset]);

        res.json({
            success: true,
            data: ventas,
            paginacion: {
                pagina_actual: parseInt(pagina),
                total_paginas: totalPaginas,
                total_registros: totalRegistros,
                registros_por_pagina: parseInt(limite),
                tiene_anterior: pagina > 1,
                tiene_siguiente: pagina < totalPaginas
            }
        });

    } catch (error) {
        console.error('Error al obtener historial:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener historial de ventas',
            detalle: error.message
        });
    }
}

/**
 * Obtener detalle completo de una venta - CORREGIDO
 * @route GET /api/historial/:venta_id
 */
async function obtenerDetalleVenta(req, res) {
    try {
        const { venta_id } = req.params;

        // Obtener información de la venta - ESQUEMA CORREGIDO
        const [ventas] = await pool.query(`
            SELECT
                vp.*,
                mr.numero_mesa,
                mr.descripcion_mesa,
                mr.zona_mesa,
                mr.capacidad_mesa,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                e.puesto_trabajo,
                c.nombre_caja,
                c.descripcion_caja
            FROM ventas_principales vp
            LEFT JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            LEFT JOIN empleados e ON vp.empleado_vendedor_id = e.id
            LEFT JOIN cajas c ON vp.terminal_id = c.id
            WHERE vp.id = ?
        `, [venta_id]);

        if (ventas.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada'
            });
        }

        // Obtener líneas de venta - ESQUEMA CORREGIDO
        const [lineas] = await pool.query(`
            SELECT
                vd.*,
                p.nombre_producto,
                p.codigo_producto,
                cp.nombre_categoria,
                p.requiere_preparacion,
                p.categoria_preparacion
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
            WHERE vd.venta_id = ?
            ORDER BY vd.numero_linea
        `, [venta_id]);

        // Obtener pagos realizados - ESQUEMA CORREGIDO
        const [pagos] = await pool.query(`
            SELECT
                pv.*,
                fp.nombre_forma_pago,
                fp.tipo_pago,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as empleado_cajero
            FROM pagos_ventas pv
            INNER JOIN formas_pago fp ON pv.forma_pago_id = fp.id
            LEFT JOIN empleados e ON pv.empleado_cajero_id = e.id
            WHERE pv.venta_id = ?
            ORDER BY pv.fecha_procesamiento
        `, [venta_id]);

        // Obtener propinas asociadas - ESQUEMA CORREGIDO
        const [propinas] = await pool.query(`
            SELECT
                pe.*,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as empleado_receptor,
                fp.nombre_forma_pago as forma_pago_propina
            FROM propinas_empleados pe
            INNER JOIN empleados e ON pe.empleado_receptor_id = e.id
            LEFT JOIN formas_pago fp ON pe.forma_pago_id = fp.id
            WHERE pe.venta_id = ?
            ORDER BY pe.fecha_propina
        `, [venta_id]);

        // Obtener historial de cambios de estado (logs)
        const [logs] = await pool.query(`
            SELECT
                lc.*,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as empleado_accion,
                p.nombre_producto
            FROM logs_cocina lc
            LEFT JOIN empleados e ON lc.empleado_id = e.id
            LEFT JOIN productos p ON lc.producto_id = p.id
            WHERE lc.venta_id = ?
            ORDER BY lc.timestamp_accion
        `, [venta_id]);

        res.json({
            success: true,
            data: {
                venta: ventas[0],
                lineas: lineas,
                pagos: pagos,
                propinas: propinas,
                logs_cocina: logs,
                resumen: {
                    total_productos: lineas.length,
                    total_pagos: pagos.length,
                    total_propinas: propinas.reduce((sum, p) => sum + parseFloat(p.monto_propina), 0),
                    estado_actual: ventas[0].estado_venta
                }
            }
        });

    } catch (error) {
        console.error('Error al obtener detalle de venta:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener detalle de venta',
            detalle: error.message
        });
    }
}

/**
 * Obtener estadísticas de un período - CORREGIDO
 * @route GET /api/historial/estadisticas
 */
async function obtenerEstadisticas(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            empleado_id,
            mesa_id
        } = req.query;

        // Validar fechas requeridas
        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        let whereClause = 'WHERE DATE(vp.fecha_venta) BETWEEN ? AND ? AND vp.estado_venta IN ("PAGADA", "CERRADA")';
        let params = [fecha_desde, fecha_hasta];

        if (empleado_id) {
            whereClause += ' AND vp.empleado_vendedor_id = ?';
            params.push(empleado_id);
        }

        if (mesa_id) {
            whereClause += ' AND vp.mesa_id = ?';
            params.push(mesa_id);
        }

        // Estadísticas generales - ESQUEMA CORREGIDO
        const [estadisticas] = await pool.query(`
            SELECT
                COUNT(DISTINCT vp.id) as total_ventas,
                COALESCE(SUM(vp.total_final), 0) as total_ingresos,
                COALESCE(AVG(vp.total_final), 0) as ticket_promedio,
                COALESCE(MAX(vp.total_final), 0) as venta_maxima,
                COALESCE(MIN(vp.total_final), 0) as venta_minima,
                COUNT(DISTINCT vp.empleado_vendedor_id) as empleados_activos,
                COUNT(DISTINCT vp.mesa_id) as mesas_utilizadas,
                COALESCE(SUM(vp.numero_comensales), 0) as total_comensales,
                COALESCE(AVG(vp.numero_comensales), 0) as promedio_comensales
            FROM ventas_principales vp
            ${whereClause}
        `, params);

        // Top empleados por ventas
        const [topEmpleados] = await pool.query(`
            SELECT
                e.id,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                e.puesto_trabajo,
                COUNT(vp.id) as total_ventas,
                SUM(vp.total_final) as total_vendido,
                AVG(vp.total_final) as ticket_promedio
            FROM ventas_principales vp
            INNER JOIN empleados e ON vp.empleado_vendedor_id = e.id
            ${whereClause}
            GROUP BY e.id, e.nombres, e.apellido_paterno, e.puesto_trabajo
            ORDER BY total_vendido DESC
            LIMIT 10
        `, params);

        // Ventas por forma de pago
        const [porFormaPago] = await pool.query(`
            SELECT
                fp.nombre_forma_pago,
                fp.tipo_pago,
                COUNT(DISTINCT pv.venta_id) as total_ventas,
                SUM(pv.monto_pago) as total_monto,
                AVG(pv.monto_pago) as promedio_monto
            FROM pagos_ventas pv
            INNER JOIN formas_pago fp ON pv.forma_pago_id = fp.id
            INNER JOIN ventas_principales vp ON pv.venta_id = vp.id
            ${whereClause}
            GROUP BY fp.id, fp.nombre_forma_pago, fp.tipo_pago
            ORDER BY total_monto DESC
        `, params);

        res.json({
            success: true,
            data: {
                periodo: { fecha_desde, fecha_hasta },
                resumen: estadisticas[0],
                top_empleados: topEmpleados,
                por_forma_pago: porFormaPago
            }
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas',
            detalle: error.message
        });
    }
}

/**
 * Obtener top productos vendidos - CORREGIDO
 * @route GET /api/historial/top-productos
 */
async function obtenerTopProductos(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            limite = 10
        } = req.query;

        // Validar fechas requeridas
        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        // Validar límite
        if (limite < 1 || limite > 100) {
            return res.status(400).json({
                success: false,
                error: 'El límite debe estar entre 1 y 100'
            });
        }

        const [productos] = await pool.query(`
            SELECT
                p.id,
                p.nombre_producto,
                p.codigo_producto,
                cp.nombre_categoria,
                SUM(vd.cantidad) as total_vendido,
                COUNT(DISTINCT vd.venta_id) as ventas_con_producto,
                SUM(vd.subtotal_linea) as total_ingresos,
                AVG(vd.precio_unitario) as precio_promedio
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            INNER JOIN ventas_principales vp ON vd.venta_id = vp.id
            LEFT JOIN categorias_productos cp ON p.categoria_id = cp.id
            WHERE DATE(vp.fecha_venta) BETWEEN ? AND ?
            AND vp.estado_venta IN ('PAGADA', 'CERRADA')
            GROUP BY p.id, p.nombre_producto, p.codigo_producto, cp.nombre_categoria
            ORDER BY total_vendido DESC
            LIMIT ?
        `, [fecha_desde, fecha_hasta, parseInt(limite)]);

        res.json({
            success: true,
            data: productos
        });

    } catch (error) {
        console.error('Error al obtener top productos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener top productos',
            detalle: error.message
        });
    }
}

/**
 * Obtener rendimiento de empleados - CORREGIDO
 * @route GET /api/historial/rendimiento-empleados
 */
async function obtenerRendimientoEmpleados(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta
        } = req.query;

        // Validar fechas requeridas
        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        const [empleados] = await pool.query(`
            SELECT
                e.id,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                e.puesto_trabajo,
                COUNT(DISTINCT vp.id) as total_ventas,
                SUM(vp.total_final) as total_vendido,
                AVG(vp.total_final) as ticket_promedio,
                COUNT(DISTINCT vp.mesa_id) as mesas_atendidas,
                SUM(vp.numero_comensales) as total_comensales_atendidos,
                COALESCE(SUM(pe.monto_propina), 0) as total_propinas,
                COUNT(DISTINCT DATE(vp.fecha_venta)) as dias_trabajados
            FROM empleados e
            LEFT JOIN ventas_principales vp ON e.id = vp.empleado_vendedor_id
                AND DATE(vp.fecha_venta) BETWEEN ? AND ?
                AND vp.estado_venta IN ('PAGADA', 'CERRADA')
            LEFT JOIN propinas_empleados pe ON e.id = pe.empleado_receptor_id
                AND DATE(pe.fecha_propina) BETWEEN ? AND ?
            WHERE e.activo = 1 AND e.puesto_trabajo IN ('Garzón', 'Mesero', 'Camarero')
            GROUP BY e.id, e.nombres, e.apellido_paterno, e.puesto_trabajo
            HAVING total_ventas > 0
            ORDER BY total_vendido DESC
        `, [fecha_desde, fecha_hasta, fecha_desde, fecha_hasta]);

        res.json({
            success: true,
            data: empleados
        });

    } catch (error) {
        console.error('Error al obtener rendimiento de empleados:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener rendimiento de empleados',
            detalle: error.message
        });
    }
}

/**
 * Obtener ventas por hora del día - CORREGIDO
 * @route GET /api/historial/ventas-por-hora
 */
async function obtenerVentasPorHora(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta
        } = req.query;

        // Validar fechas requeridas
        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        const [ventasPorHora] = await pool.query(`
            SELECT
                HOUR(vp.hora_inicio) as hora,
                COUNT(vp.id) as total_ventas,
                SUM(vp.total_final) as total_ingresos,
                AVG(vp.total_final) as ticket_promedio,
                COUNT(DISTINCT vp.mesa_id) as mesas_utilizadas
            FROM ventas_principales vp
            WHERE DATE(vp.fecha_venta) BETWEEN ? AND ?
            AND vp.estado_venta IN ('PAGADA', 'CERRADA')
            GROUP BY HOUR(vp.hora_inicio)
            ORDER BY hora
        `, [fecha_desde, fecha_hasta]);

        res.json({
            success: true,
            data: ventasPorHora
        });

    } catch (error) {
        console.error('Error al obtener ventas por hora:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener ventas por hora',
            detalle: error.message
        });
    }
}

/**
 * Obtener resumen rápido del día actual - CORREGIDO
 * @route GET /api/historial/resumen-hoy
 */
async function obtenerResumenHoy(req, res) {
    try {
        const hoy = new Date().toISOString().split('T')[0];

        const [resumen] = await pool.query(`
            SELECT
                COUNT(DISTINCT vp.id) as ventas_hoy,
                COALESCE(SUM(vp.total_final), 0) as ingresos_hoy,
                COALESCE(AVG(vp.total_final), 0) as ticket_promedio_hoy,
                COUNT(DISTINCT vp.empleado_vendedor_id) as empleados_activos_hoy,
                COUNT(DISTINCT vp.mesa_id) as mesas_utilizadas_hoy,
                COALESCE(SUM(vp.numero_comensales), 0) as comensales_atendidos_hoy
            FROM ventas_principales vp
            WHERE DATE(vp.fecha_venta) = ? AND vp.estado_venta IN ('PAGADA', 'CERRADA')
        `, [hoy]);

        const [ultimasVentas] = await pool.query(`
            SELECT
                vp.id,
                vp.numero_venta,
                vp.total_final,
                vp.hora_inicio,
                mr.numero_mesa,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as empleado
            FROM ventas_principales vp
            LEFT JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            LEFT JOIN empleados e ON vp.empleado_vendedor_id = e.id
            WHERE DATE(vp.fecha_venta) = ? AND vp.estado_venta IN ('PAGADA', 'CERRADA')
            ORDER BY vp.timestamp_cierre DESC
            LIMIT 5
        `, [hoy]);

        res.json({
            success: true,
            data: {
                resumen: resumen[0],
                ultimas_ventas: ultimasVentas,
                fecha: hoy
            }
        });

    } catch (error) {
        console.error('Error al obtener resumen de hoy:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener resumen de hoy',
            detalle: error.message
        });
    }
}

/**
 * Buscar ventas por número de venta o mesa - CORREGIDO
 * @route GET /api/historial/buscar
 */
async function buscarVentas(req, res) {
    try {
        const { termino } = req.query;

        if (!termino) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere un término de búsqueda'
            });
        }

        // Buscar por ID de venta, número de venta o número de mesa - ESQUEMA CORREGIDO
        const [ventas] = await pool.query(`
            SELECT
                vp.id,
                vp.numero_venta,
                vp.fecha_venta,
                vp.hora_inicio,
                vp.estado_venta,
                vp.total_final,
                mr.numero_mesa,
                mr.descripcion_mesa,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as empleado
            FROM ventas_principales vp
            LEFT JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            LEFT JOIN empleados e ON vp.empleado_vendedor_id = e.id
            WHERE vp.id = ?
               OR vp.numero_venta LIKE ?
               OR mr.numero_mesa LIKE ?
            ORDER BY vp.fecha_venta DESC, vp.hora_inicio DESC
            LIMIT 50
        `, [parseInt(termino) || 0, `%${termino}%`, `%${termino}%`]);

        res.json({
            success: true,
            data: ventas,
            total: ventas.length
        });

    } catch (error) {
        console.error('Error al buscar ventas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al buscar ventas',
            detalle: error.message
        });
    }
}

// =====================================================
// EXPORTAR FUNCIONES - ESQUEMA CORREGIDO
// =====================================================

module.exports = {
    obtenerHistorial,
    obtenerDetalleVenta,
    obtenerEstadisticas,
    obtenerTopProductos,
    obtenerRendimientoEmpleados,
    obtenerVentasPorHora,
    obtenerResumenHoy,
    buscarVentas
};