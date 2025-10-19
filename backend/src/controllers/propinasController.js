/**
 * =====================================================
 * CONTROLADOR DE GESTIÓN DE PROPINAS - SISTEMA REAL COMPLETAMENTE CORREGIDO
 * Descripción: Gestión completa de propinas del restaurante
 * Autor: Devlmer - Dysa - CORREGIDO POR CLAUDE CODE
 * Fecha: 2025-10-18 - VERSIÓN CORREGIDA
 * PRODUCCIÓN: Sistema real para restaurante - ESQUEMA CORREGIDO
 * =====================================================
 */

const { pool } = require('../config/database');

/**
 * Registrar propina de una venta - CORREGIDO
 * @route POST /api/propinas/registrar
 */
async function registrarPropina(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            venta_id,
            empleado_receptor_id,
            monto_propina,
            forma_pago_id = 1, // Efectivo por defecto
            empleado_registra_id,
            observaciones_propina
        } = req.body;

        // Validaciones
        if (!venta_id) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere venta_id'
            });
        }

        if (!monto_propina || monto_propina <= 0) {
            return res.status(400).json({
                success: false,
                error: 'El monto debe ser mayor a 0'
            });
        }

        if (!empleado_receptor_id) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere empleado_receptor_id'
            });
        }

        // Verificar que la venta existe
        const [venta] = await connection.execute(
            'SELECT * FROM ventas_principales WHERE id = ?',
            [venta_id]
        );

        if (venta.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada'
            });
        }

        // Verificar que el empleado existe
        const [empleado] = await connection.execute(
            'SELECT * FROM empleados WHERE id = ? AND activo = 1',
            [empleado_receptor_id]
        );

        if (empleado.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Empleado receptor no encontrado'
            });
        }

        // Registrar la propina en el esquema real
        const [result] = await connection.execute(`
            INSERT INTO propinas_empleados
            (venta_id, empleado_receptor_id, monto_propina, fecha_propina,
             forma_pago_id, empleado_registra_id, observaciones_propina, estado_entrega)
            VALUES (?, ?, ?, CURRENT_DATE, ?, ?, ?, 'PENDIENTE')
        `, [venta_id, empleado_receptor_id, monto_propina, forma_pago_id, empleado_registra_id, observaciones_propina]);

        await connection.commit();

        res.json({
            success: true,
            data: {
                id_propina: result.insertId,
                mensaje: 'Propina registrada exitosamente',
                venta_id,
                empleado_receptor: empleado[0].nombres + ' ' + empleado[0].apellido_paterno,
                monto_propina
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar propina:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar propina',
            detalle: error.message
        });
    } finally {
        connection.release();
    }
}

/**
 * Obtener propinas consolidadas - CORREGIDO
 * @route GET /api/propinas
 */
async function obtenerPropinas(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            empleado_id,
            estado,
            limite = 100
        } = req.query;

        let query = `
            SELECT
                pe.*,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                e.puesto_trabajo,
                vp.numero_venta,
                mr.numero_mesa,
                fp.nombre_forma_pago
            FROM propinas_empleados pe
            INNER JOIN empleados e ON pe.empleado_receptor_id = e.id
            INNER JOIN ventas_principales vp ON pe.venta_id = vp.id
            LEFT JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            LEFT JOIN formas_pago fp ON pe.forma_pago_id = fp.id
            WHERE 1=1
        `;
        let params = [];

        if (fecha_desde) {
            query += ' AND DATE(pe.fecha_propina) >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ' AND DATE(pe.fecha_propina) <= ?';
            params.push(fecha_hasta);
        }

        if (empleado_id) {
            query += ' AND pe.empleado_receptor_id = ?';
            params.push(empleado_id);
        }

        if (estado) {
            query += ' AND pe.estado_entrega = ?';
            params.push(estado);
        }

        query += ' ORDER BY pe.fecha_propina DESC, pe.id DESC LIMIT ?';
        params.push(parseInt(limite));

        const [propinas] = await pool.query(query, params);

        res.json({
            success: true,
            data: propinas
        });

    } catch (error) {
        console.error('Error al obtener propinas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener propinas',
            detalle: error.message
        });
    }
}

/**
 * Obtener propinas por empleado (resumen) - CORREGIDO
 * @route GET /api/propinas/empleados
 */
async function obtenerPropinasPorEmpleado(req, res) {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        let whereClause = 'WHERE 1=1';
        let params = [];

        if (fecha_desde && fecha_hasta) {
            whereClause += ' AND DATE(pe.fecha_propina) BETWEEN ? AND ?';
            params.push(fecha_desde, fecha_hasta);
        }

        const [empleados] = await pool.query(`
            SELECT
                e.id,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                e.puesto_trabajo,
                COUNT(pe.id) as total_propinas,
                COALESCE(SUM(pe.monto_propina), 0) as total_monto,
                COALESCE(AVG(pe.monto_propina), 0) as promedio_propina,
                SUM(CASE WHEN pe.estado_entrega = 'PENDIENTE' THEN pe.monto_propina ELSE 0 END) as monto_pendiente,
                SUM(CASE WHEN pe.estado_entrega = 'ENTREGADA' THEN pe.monto_propina ELSE 0 END) as monto_entregado
            FROM empleados e
            LEFT JOIN propinas_empleados pe ON e.id = pe.empleado_receptor_id ${whereClause.replace('WHERE 1=1', '')}
            WHERE e.activo = 1 AND e.puesto_trabajo IN ('Garzón', 'Mesero', 'Camarero')
            GROUP BY e.id, e.nombres, e.apellido_paterno, e.puesto_trabajo
            HAVING total_propinas > 0
            ORDER BY total_monto DESC
        `, params);

        res.json({
            success: true,
            data: empleados
        });

    } catch (error) {
        console.error('Error al obtener propinas por empleado:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener propinas por empleado',
            detalle: error.message
        });
    }
}

/**
 * Obtener propinas de un empleado específico - CORREGIDO
 * @route GET /api/propinas/empleado/:empleado_id
 */
async function obtenerPropinasEmpleado(req, res) {
    try {
        const { empleado_id } = req.params;
        const { fecha_desde, fecha_hasta, estado } = req.query;

        let query = `
            SELECT
                pe.*,
                vp.numero_venta,
                mr.numero_mesa,
                fp.nombre_forma_pago,
                CONCAT(er.nombres, ' ', er.apellido_paterno) as empleado_registra
            FROM propinas_empleados pe
            INNER JOIN ventas_principales vp ON pe.venta_id = vp.id
            LEFT JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            LEFT JOIN formas_pago fp ON pe.forma_pago_id = fp.id
            LEFT JOIN empleados er ON pe.empleado_registra_id = er.id
            WHERE pe.empleado_receptor_id = ?
        `;
        let params = [empleado_id];

        if (fecha_desde) {
            query += ' AND DATE(pe.fecha_propina) >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ' AND DATE(pe.fecha_propina) <= ?';
            params.push(fecha_hasta);
        }

        if (estado) {
            query += ' AND pe.estado_entrega = ?';
            params.push(estado);
        }

        query += ' ORDER BY pe.fecha_propina DESC';

        const [propinas] = await pool.query(query, params);

        // Calcular totales
        const totales = {
            total: propinas.reduce((sum, p) => sum + Number(p.monto_propina), 0),
            pendientes: propinas.filter(p => p.estado_entrega === 'PENDIENTE').reduce((sum, p) => sum + Number(p.monto_propina), 0),
            entregadas: propinas.filter(p => p.estado_entrega === 'ENTREGADA').reduce((sum, p) => sum + Number(p.monto_propina), 0),
            cantidad_total: propinas.length,
            cantidad_pendientes: propinas.filter(p => p.estado_entrega === 'PENDIENTE').length,
            cantidad_entregadas: propinas.filter(p => p.estado_entrega === 'ENTREGADA').length
        };

        res.json({
            success: true,
            data: {
                propinas,
                totales
            }
        });

    } catch (error) {
        console.error('Error al obtener propinas del empleado:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener propinas del empleado',
            detalle: error.message
        });
    }
}

/**
 * Marcar propinas como entregadas - CORREGIDO
 * @route POST /api/propinas/entregar
 */
async function entregarPropinas(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            empleado_receptor_id,
            fecha_desde,
            fecha_hasta,
            empleado_entrega_id,
            observaciones_entrega,
            propinas_ids // Array de IDs específicos o null para todas en el rango
        } = req.body;

        // Validaciones
        if (!empleado_receptor_id || !empleado_entrega_id) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren empleado_receptor_id y empleado_entrega_id'
            });
        }

        let query = `
            UPDATE propinas_empleados
            SET estado_entrega = 'ENTREGADA',
                fecha_entrega = CURRENT_TIMESTAMP,
                empleado_entrega_id = ?,
                observaciones_entrega = ?
            WHERE empleado_receptor_id = ?
            AND estado_entrega = 'PENDIENTE'
        `;
        let params = [empleado_entrega_id, observaciones_entrega, empleado_receptor_id];

        if (propinas_ids && propinas_ids.length > 0) {
            // Entregar propinas específicas
            const placeholders = propinas_ids.map(() => '?').join(',');
            query += ` AND id IN (${placeholders})`;
            params.push(...propinas_ids);
        } else if (fecha_desde && fecha_hasta) {
            // Entregar por rango de fechas
            query += ' AND DATE(fecha_propina) BETWEEN ? AND ?';
            params.push(fecha_desde, fecha_hasta);
        }

        const [result] = await connection.execute(query, params);

        if (result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se encontraron propinas pendientes para entregar'
            });
        }

        // Obtener el total entregado
        const [totales] = await connection.execute(`
            SELECT
                COUNT(*) as propinas_entregadas,
                SUM(monto_propina) as monto_total_entregado
            FROM propinas_empleados
            WHERE empleado_receptor_id = ?
            AND empleado_entrega_id = ?
            AND DATE(fecha_entrega) = CURRENT_DATE
        `, [empleado_receptor_id, empleado_entrega_id]);

        await connection.commit();

        res.json({
            success: true,
            data: {
                propinas_entregadas: result.affectedRows,
                monto_total_entregado: totales[0].monto_total_entregado || 0,
                mensaje: `Se entregaron ${result.affectedRows} propinas exitosamente`
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al entregar propinas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al entregar propinas',
            detalle: error.message
        });
    } finally {
        connection.release();
    }
}

/**
 * Obtener reporte de propinas - CORREGIDO
 * @route GET /api/propinas/reporte
 */
async function obtenerReporte(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            empleado_id
        } = req.query;

        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        let whereClause = 'WHERE DATE(pe.fecha_propina) BETWEEN ? AND ?';
        let params = [fecha_desde, fecha_hasta];

        if (empleado_id) {
            whereClause += ' AND pe.empleado_receptor_id = ?';
            params.push(empleado_id);
        }

        // Reporte resumen
        const [resumen] = await pool.query(`
            SELECT
                COUNT(DISTINCT pe.empleado_receptor_id) as total_empleados,
                COUNT(pe.id) as total_propinas,
                SUM(pe.monto_propina) as total_monto,
                AVG(pe.monto_propina) as promedio_propina,
                MAX(pe.monto_propina) as propina_maxima,
                MIN(pe.monto_propina) as propina_minima,
                SUM(CASE WHEN pe.estado_entrega = 'PENDIENTE' THEN pe.monto_propina ELSE 0 END) as monto_pendiente,
                SUM(CASE WHEN pe.estado_entrega = 'ENTREGADA' THEN pe.monto_propina ELSE 0 END) as monto_entregado,
                COUNT(CASE WHEN pe.estado_entrega = 'PENDIENTE' THEN 1 END) as propinas_pendientes,
                COUNT(CASE WHEN pe.estado_entrega = 'ENTREGADA' THEN 1 END) as propinas_entregadas
            FROM propinas_empleados pe
            ${whereClause}
        `, params);

        // Reporte por empleado
        const [porEmpleado] = await pool.query(`
            SELECT
                e.id,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                e.puesto_trabajo,
                COUNT(pe.id) as total_propinas,
                SUM(pe.monto_propina) as total_monto,
                AVG(pe.monto_propina) as promedio_propina,
                SUM(CASE WHEN pe.estado_entrega = 'PENDIENTE' THEN pe.monto_propina ELSE 0 END) as monto_pendiente,
                SUM(CASE WHEN pe.estado_entrega = 'ENTREGADA' THEN pe.monto_propina ELSE 0 END) as monto_entregado
            FROM empleados e
            INNER JOIN propinas_empleados pe ON e.id = pe.empleado_receptor_id
            ${whereClause}
            GROUP BY e.id, e.nombres, e.apellido_paterno, e.puesto_trabajo
            ORDER BY total_monto DESC
        `, params);

        // Reporte por forma de pago
        const [porFormaPago] = await pool.query(`
            SELECT
                fp.nombre_forma_pago,
                COUNT(pe.id) as total_propinas,
                SUM(pe.monto_propina) as total_monto
            FROM propinas_empleados pe
            INNER JOIN formas_pago fp ON pe.forma_pago_id = fp.id
            ${whereClause}
            GROUP BY fp.id, fp.nombre_forma_pago
            ORDER BY total_monto DESC
        `, params);

        res.json({
            success: true,
            data: {
                periodo: { fecha_desde, fecha_hasta },
                resumen: resumen[0],
                por_empleado: porEmpleado,
                por_forma_pago: porFormaPago
            }
        });

    } catch (error) {
        console.error('Error al obtener reporte:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener reporte',
            detalle: error.message
        });
    }
}

/**
 * Obtener estadísticas de propinas - CORREGIDO
 * @route GET /api/propinas/estadisticas
 */
async function obtenerEstadisticas(req, res) {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        let whereClause = '1=1';
        let params = [];

        if (fecha_desde && fecha_hasta) {
            whereClause = 'DATE(fecha_propina) BETWEEN ? AND ?';
            params = [fecha_desde, fecha_hasta];
        }

        const [stats] = await pool.query(`
            SELECT
                COUNT(*) AS total_propinas,
                COALESCE(SUM(monto_propina), 0) AS total_monto,
                COALESCE(AVG(monto_propina), 0) AS promedio_propina,
                COALESCE(MAX(monto_propina), 0) AS propina_maxima,
                COALESCE(MIN(monto_propina), 0) AS propina_minima,
                COUNT(CASE WHEN estado_entrega = 'PENDIENTE' THEN 1 END) AS propinas_pendientes,
                COUNT(CASE WHEN estado_entrega = 'ENTREGADA' THEN 1 END) AS propinas_entregadas,
                COALESCE(SUM(CASE WHEN estado_entrega = 'PENDIENTE' THEN monto_propina ELSE 0 END), 0) AS monto_pendiente,
                COALESCE(SUM(CASE WHEN estado_entrega = 'ENTREGADA' THEN monto_propina ELSE 0 END), 0) AS monto_entregado,
                COUNT(DISTINCT empleado_receptor_id) as empleados_con_propinas,
                COUNT(DISTINCT venta_id) as ventas_con_propinas
             FROM propinas_empleados
             WHERE ${whereClause}
        `, params);

        res.json({
            success: true,
            data: stats[0]
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
 * Configurar porcentaje de propina por defecto - NUEVA FUNCIÓN EMPRESARIAL
 * @route POST /api/propinas/configurar-porcentaje
 */
async function configurarPorcentajePropina(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { porcentaje_default, empleado_configura_id } = req.body;

        if (!porcentaje_default || porcentaje_default < 0 || porcentaje_default > 100) {
            return res.status(400).json({
                success: false,
                error: 'El porcentaje debe estar entre 0 y 100'
            });
        }

        // Actualizar configuración del sistema
        await connection.execute(`
            INSERT INTO configuracion_sistema (clave, valor, descripcion_config, empleado_modifica_id)
            VALUES ('propina_porcentaje_default', ?, 'Porcentaje de propina por defecto del sistema', ?)
            ON DUPLICATE KEY UPDATE
                valor = VALUES(valor),
                empleado_modifica_id = VALUES(empleado_modifica_id),
                fecha_actualizacion = CURRENT_TIMESTAMP
        `, [porcentaje_default.toString(), empleado_configura_id]);

        await connection.commit();

        res.json({
            success: true,
            data: {
                porcentaje_default,
                mensaje: 'Porcentaje de propina configurado exitosamente'
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al configurar porcentaje:', error);
        res.status(500).json({
            success: false,
            error: 'Error al configurar porcentaje',
            detalle: error.message
        });
    } finally {
        connection.release();
    }
}

// =====================================================
// EXPORTAR FUNCIONES - ESQUEMA CORREGIDO
// =====================================================

module.exports = {
    registrarPropina,
    obtenerPropinas,
    obtenerPropinasPorEmpleado,
    obtenerPropinasEmpleado,
    entregarPropinas,
    obtenerReporte,
    obtenerEstadisticas,
    configurarPorcentajePropina
};