/**
 * =====================================================
 * CONTROLADOR DE HISTORIAL DE VENTAS
 * Descripción: Gestión de consultas históricas de ventas con filtros avanzados
 * Autor: Sistema POS Mistura
 * Fecha: 2025-10-05 02:37 AM
 * =====================================================
 */

const { pool } = require('../config/database');

/**
 * Obtener historial de ventas con filtros y paginación
 * @route GET /api/historial
 * @param {Date} fecha_desde - Fecha inicio (opcional)
 * @param {Date} fecha_hasta - Fecha fin (opcional)
 * @param {Number} id_camarero - ID del camarero (opcional)
 * @param {Number} id_mesa - ID de la mesa (opcional)
 * @param {String} metodo_pago - Método de pago: efectivo, tarjeta, transferencia (opcional)
 * @param {String} estado - Estado: cerrada, cancelada (opcional)
 * @param {Number} pagina - Número de página (default: 1)
 * @param {Number} limite - Registros por página (default: 20)
 */
async function obtenerHistorial(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            id_camarero,
            id_mesa,
            metodo_pago,
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

        // Construir query dinámico
        let whereConditions = ['1=1'];
        let queryParams = [];

        // Filtro de fechas
        if (fecha_desde) {
            whereConditions.push('v.fecha_hora >= ?');
            queryParams.push(fecha_desde);
        }

        if (fecha_hasta) {
            whereConditions.push('v.fecha_hora <= ?');
            queryParams.push(fecha_hasta);
        }

        // Filtro de camarero
        if (id_camarero) {
            whereConditions.push('v.id_camarero = ?');
            queryParams.push(id_camarero);
        }

        // Filtro de mesa
        if (id_mesa) {
            whereConditions.push('v.id_mesa = ?');
            queryParams.push(id_mesa);
        }

        // Filtro de método de pago
        if (metodo_pago) {
            whereConditions.push('v.metodo_pago = ?');
            queryParams.push(metodo_pago);
        }

        // Filtro de estado
        if (estado) {
            whereConditions.push('v.estado = ?');
            queryParams.push(estado);
        } else {
            // Por defecto, solo ventas cerradas
            whereConditions.push('v.estado IN ("cerrada", "cancelada")');
        }

        const whereClause = whereConditions.join(' AND ');

        // Obtener total de registros
        const [countResult] = await pool.query(
            `SELECT COUNT(*) as total
             FROM ventas v
             WHERE ${whereClause}`,
            queryParams
        );

        const totalRegistros = countResult[0].total;
        const totalPaginas = Math.ceil(totalRegistros / limite);
        const offset = (pagina - 1) * limite;

        // Obtener registros paginados
        const [ventas] = await pool.query(
            `SELECT * FROM vista_historial_ventas
             WHERE ${whereClause.replace(/v\./g, '')}
             ORDER BY fecha_hora DESC
             LIMIT ? OFFSET ?`,
            [...queryParams, parseInt(limite), offset]
        );

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
 * Obtener detalle completo de una venta
 * @route GET /api/historial/:id_venta
 */
async function obtenerDetalleVenta(req, res) {
    try {
        const { id_venta } = req.params;

        // Obtener información de la venta
        const [ventas] = await pool.query(
            'SELECT * FROM vista_historial_ventas WHERE id_venta = ?',
            [id_venta]
        );

        if (ventas.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada'
            });
        }

        // Obtener líneas de venta
        const [lineas] = await pool.query(
            'SELECT * FROM vista_detalle_ventas WHERE id_venta = ? ORDER BY id_linea',
            [id_venta]
        );

        // Obtener descuentos aplicados
        const [descuentos] = await pool.query(
            `SELECT
                da.id_aplicacion,
                da.id_descuento,
                d.nombre,
                d.tipo,
                d.valor,
                da.monto_descontado,
                da.motivo,
                da.fecha_aplicacion,
                u.nombre AS usuario_nombre
             FROM descuentos_aplicados da
             INNER JOIN descuentos d ON da.id_descuento = d.id_descuento
             LEFT JOIN usuarios u ON da.id_usuario = u.id_usuario
             WHERE da.id_venta = ?
             ORDER BY da.fecha_aplicacion`,
            [id_venta]
        );

        // Obtener opciones seleccionadas (si las hay)
        const [opciones] = await pool.query(
            `SELECT
                ols.id_seleccion,
                ols.id_linea,
                o.nombre AS opcion_nombre,
                o.precio_adicional
             FROM opciones_lineas_seleccionadas ols
             INNER JOIN opciones o ON ols.id_opcion = o.id_opcion
             WHERE ols.id_linea IN (SELECT id_linea FROM lineas_venta WHERE id_venta = ?)
             ORDER BY ols.id_linea`,
            [id_venta]
        );

        res.json({
            success: true,
            data: {
                venta: ventas[0],
                lineas: lineas,
                descuentos: descuentos,
                opciones: opciones
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
 * Obtener estadísticas de un período
 * @route GET /api/historial/estadisticas
 */
async function obtenerEstadisticas(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            id_camarero,
            id_mesa,
            metodo_pago
        } = req.query;

        // Validar fechas requeridas
        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        const [estadisticas] = await pool.query(
            'CALL sp_estadisticas_periodo(?, ?, ?, ?, ?)',
            [
                fecha_desde,
                fecha_hasta,
                id_camarero || null,
                id_mesa || null,
                metodo_pago || null
            ]
        );

        res.json({
            success: true,
            data: estadisticas[0][0] // El procedimiento devuelve un array de arrays
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
 * Obtener top productos vendidos
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

        const [productos] = await pool.query(
            'CALL sp_top_productos(?, ?, ?)',
            [fecha_desde, fecha_hasta, parseInt(limite)]
        );

        res.json({
            success: true,
            data: productos[0] // El procedimiento devuelve un array de arrays
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
 * Obtener rendimiento de camareros
 * @route GET /api/historial/rendimiento-camareros
 */
async function obtenerRendimientoCamareros(req, res) {
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

        const [camareros] = await pool.query(
            'CALL sp_rendimiento_camareros(?, ?)',
            [fecha_desde, fecha_hasta]
        );

        res.json({
            success: true,
            data: camareros[0] // El procedimiento devuelve un array de arrays
        });

    } catch (error) {
        console.error('Error al obtener rendimiento de camareros:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener rendimiento de camareros',
            detalle: error.message
        });
    }
}

/**
 * Obtener ventas por hora del día
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
                error: 'Se requieren fecha_desde y fecha_hasta (solo fecha, sin hora)'
            });
        }

        const [ventasPorHora] = await pool.query(
            'CALL sp_ventas_por_hora(?, ?)',
            [fecha_desde, fecha_hasta]
        );

        res.json({
            success: true,
            data: ventasPorHora[0] // El procedimiento devuelve un array de arrays
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
 * Obtener resumen rápido del día actual
 * @route GET /api/historial/resumen-hoy
 */
async function obtenerResumenHoy(req, res) {
    try {
        const hoy = new Date();
        const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
        const finHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

        const [estadisticas] = await pool.query(
            'CALL sp_estadisticas_periodo(?, ?, ?, ?, ?)',
            [inicioHoy, finHoy, null, null, null]
        );

        res.json({
            success: true,
            data: estadisticas[0][0]
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
 * Buscar ventas por número de venta o mesa
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

        // Buscar por ID de venta o número de mesa
        const [ventas] = await pool.query(
            `SELECT * FROM vista_historial_ventas
             WHERE id_venta = ?
                OR mesa_numero LIKE ?
             ORDER BY fecha_hora DESC
             LIMIT 50`,
            [parseInt(termino) || 0, `%${termino}%`]
        );

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
// EXPORTAR FUNCIONES
// =====================================================

module.exports = {
    obtenerHistorial,
    obtenerDetalleVenta,
    obtenerEstadisticas,
    obtenerTopProductos,
    obtenerRendimientoCamareros,
    obtenerVentasPorHora,
    obtenerResumenHoy,
    buscarVentas
};
