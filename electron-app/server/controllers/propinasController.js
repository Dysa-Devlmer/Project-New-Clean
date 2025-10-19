/**
 * =====================================================
 * CONTROLADOR DE GESTIÓN DE PROPINAS
 * Descripción: Gestión completa de propinas del restaurante
 * Autor: Devlmer - Dysa
 * Fecha: 2025-10-05 03:05 AM
 * PRODUCCIÓN: Sistema real para restaurante
 * =====================================================
 */

const { pool } = require('../config/database');

/**
 * Registrar propina de una venta
 * @route POST /api/propinas/registrar
 */
async function registrarPropina(req, res) {
    try {
        const {
            id_venta,
            monto,
            metodo_pago = 'efectivo',
            observaciones
        } = req.body;

        // Validaciones
        if (!id_venta) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere id_venta'
            });
        }

        if (!monto || monto <= 0) {
            return res.status(400).json({
                success: false,
                error: 'El monto debe ser mayor a 0'
            });
        }

        const [result] = await pool.query(
            'CALL sp_registrar_propina(?, ?, ?, ?, @id_propina, @mensaje)',
            [id_venta, monto, metodo_pago, observaciones]
        );

        const [output] = await pool.query(
            'SELECT @id_propina AS id_propina, @mensaje AS mensaje'
        );

        if (output[0].id_propina > 0) {
            res.json({
                success: true,
                data: {
                    id_propina: output[0].id_propina,
                    mensaje: output[0].mensaje
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: output[0].mensaje
            });
        }

    } catch (error) {
        console.error('Error al registrar propina:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar propina',
            detalle: error.message
        });
    }
}

/**
 * Obtener propinas consolidadas
 * @route GET /api/propinas
 */
async function obtenerPropinas(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            id_camarero,
            estado,
            limite = 100
        } = req.query;

        let query = 'SELECT * FROM vista_propinas_consolidadas WHERE 1=1';
        let params = [];

        if (fecha_desde) {
            query += ' AND DATE(fecha_registro) >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ' AND DATE(fecha_registro) <= ?';
            params.push(fecha_hasta);
        }

        if (id_camarero) {
            query += ' AND id_camarero = ?';
            params.push(id_camarero);
        }

        if (estado) {
            query += ' AND estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY fecha_registro DESC LIMIT ?';
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
 * Obtener propinas por camarero
 * @route GET /api/propinas/camarero
 */
async function obtenerPropinasPorCamarero(req, res) {
    try {
        const [camareros] = await pool.query(
            'SELECT * FROM vista_propinas_camarero ORDER BY total_propinas DESC'
        );

        res.json({
            success: true,
            data: camareros
        });

    } catch (error) {
        console.error('Error al obtener propinas por camarero:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener propinas por camarero',
            detalle: error.message
        });
    }
}

/**
 * Obtener propinas de un camarero específico
 * @route GET /api/propinas/camarero/:id_camarero
 */
async function obtenerPropinasCamarero(req, res) {
    try {
        const { id_camarero } = req.params;
        const { fecha_desde, fecha_hasta, estado } = req.query;

        let query = `
            SELECT * FROM vista_propinas_consolidadas
            WHERE id_camarero = ?
        `;
        let params = [id_camarero];

        if (fecha_desde) {
            query += ' AND DATE(fecha_registro) >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ' AND DATE(fecha_registro) <= ?';
            params.push(fecha_hasta);
        }

        if (estado) {
            query += ' AND estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY fecha_registro DESC';

        const [propinas] = await pool.query(query, params);

        // Calcular totales
        const totales = {
            total: propinas.reduce((sum, p) => sum + Number(p.monto), 0),
            pendientes: propinas.filter(p => p.estado === 'pendiente').reduce((sum, p) => sum + Number(p.monto), 0),
            distribuidas: propinas.filter(p => p.estado === 'distribuida').reduce((sum, p) => sum + Number(p.monto), 0),
            entregadas: propinas.filter(p => p.estado === 'entregada').reduce((sum, p) => sum + Number(p.monto), 0)
        };

        res.json({
            success: true,
            data: {
                propinas,
                totales
            }
        });

    } catch (error) {
        console.error('Error al obtener propinas del camarero:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener propinas del camarero',
            detalle: error.message
        });
    }
}

/**
 * Crear distribución de propinas
 * @route POST /api/propinas/distribuir
 */
async function crearDistribucion(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            metodo_distribucion = 'equitativa',
            id_usuario
        } = req.body;

        // Validaciones
        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        if (!['equitativa', 'por_ventas'].includes(metodo_distribucion)) {
            return res.status(400).json({
                success: false,
                error: 'Método de distribución inválido. Usar: equitativa o por_ventas'
            });
        }

        if (!id_usuario) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere id_usuario'
            });
        }

        const [result] = await pool.query(
            'CALL sp_crear_distribucion(?, ?, ?, ?, @id_distribucion, @mensaje)',
            [fecha_desde, fecha_hasta, metodo_distribucion, id_usuario]
        );

        const [output] = await pool.query(
            'SELECT @id_distribucion AS id_distribucion, @mensaje AS mensaje'
        );

        if (output[0].id_distribucion > 0) {
            // Obtener detalle de la distribución
            const [detalle] = await pool.query(
                `SELECT
                    d.id_camarero,
                    u.nombre AS camarero,
                    d.porcentaje_asignado,
                    d.monto_asignado,
                    d.total_ventas_camarero,
                    d.numero_ventas
                 FROM detalle_distribucion_propinas d
                 INNER JOIN usuarios u ON d.id_camarero = u.id_usuario
                 WHERE d.id_distribucion = ?
                 ORDER BY d.monto_asignado DESC`,
                [output[0].id_distribucion]
            );

            res.json({
                success: true,
                data: {
                    id_distribucion: output[0].id_distribucion,
                    mensaje: output[0].mensaje,
                    detalle
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: output[0].mensaje
            });
        }

    } catch (error) {
        console.error('Error al crear distribución:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear distribución',
            detalle: error.message
        });
    }
}

/**
 * Obtener distribuciones de propinas
 * @route GET /api/propinas/distribuciones
 */
async function obtenerDistribuciones(req, res) {
    try {
        const { estado, limite = 20 } = req.query;

        let query = `
            SELECT
                d.*,
                u.nombre AS usuario_nombre,
                (SELECT COUNT(*) FROM detalle_distribucion_propinas WHERE id_distribucion = d.id_distribucion) AS total_beneficiarios,
                (SELECT COUNT(*) FROM detalle_distribucion_propinas WHERE id_distribucion = d.id_distribucion AND estado_entrega = 'entregada') AS entregados
            FROM distribuciones_propinas d
            INNER JOIN usuarios u ON d.id_usuario_crea = u.id_usuario
            WHERE 1=1
        `;
        let params = [];

        if (estado) {
            query += ' AND d.estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY d.fecha_creacion DESC LIMIT ?';
        params.push(parseInt(limite));

        const [distribuciones] = await pool.query(query, params);

        res.json({
            success: true,
            data: distribuciones
        });

    } catch (error) {
        console.error('Error al obtener distribuciones:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener distribuciones',
            detalle: error.message
        });
    }
}

/**
 * Obtener detalle de una distribución
 * @route GET /api/propinas/distribuciones/:id_distribucion
 */
async function obtenerDetalleDistribucion(req, res) {
    try {
        const { id_distribucion } = req.params;

        // Información de la distribución
        const [distribucion] = await pool.query(
            `SELECT
                d.*,
                u.nombre AS usuario_nombre
             FROM distribuciones_propinas d
             INNER JOIN usuarios u ON d.id_usuario_crea = u.id_usuario
             WHERE d.id_distribucion = ?`,
            [id_distribucion]
        );

        if (distribucion.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Distribución no encontrada'
            });
        }

        // Detalle por camarero
        const [detalle] = await pool.query(
            `SELECT
                d.id_detalle,
                d.id_camarero,
                u.nombre AS camarero,
                d.total_ventas_camarero,
                d.numero_ventas,
                d.porcentaje_asignado,
                d.monto_asignado,
                d.estado_entrega,
                d.fecha_entrega,
                ue.nombre AS usuario_entrega
             FROM detalle_distribucion_propinas d
             INNER JOIN usuarios u ON d.id_camarero = u.id_usuario
             LEFT JOIN usuarios ue ON d.id_usuario_entrega = ue.id_usuario
             WHERE d.id_distribucion = ?
             ORDER BY d.monto_asignado DESC`,
            [id_distribucion]
        );

        res.json({
            success: true,
            data: {
                distribucion: distribucion[0],
                detalle
            }
        });

    } catch (error) {
        console.error('Error al obtener detalle de distribución:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener detalle de distribución',
            detalle: error.message
        });
    }
}

/**
 * Entregar propinas a un camarero
 * @route POST /api/propinas/entregar
 */
async function entregarPropinas(req, res) {
    try {
        const {
            id_distribucion,
            id_camarero,
            id_usuario_entrega,
            firma_digital
        } = req.body;

        // Validaciones
        if (!id_distribucion || !id_camarero || !id_usuario_entrega) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_distribucion, id_camarero e id_usuario_entrega'
            });
        }

        const [result] = await pool.query(
            'CALL sp_entregar_propinas_camarero(?, ?, ?, ?, @monto_entregado, @mensaje)',
            [id_distribucion, id_camarero, id_usuario_entrega, firma_digital || null]
        );

        const [output] = await pool.query(
            'SELECT @monto_entregado AS monto_entregado, @mensaje AS mensaje'
        );

        if (output[0].monto_entregado > 0) {
            res.json({
                success: true,
                data: {
                    monto_entregado: output[0].monto_entregado,
                    mensaje: output[0].mensaje
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: output[0].mensaje
            });
        }

    } catch (error) {
        console.error('Error al entregar propinas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al entregar propinas',
            detalle: error.message
        });
    }
}

/**
 * Obtener reporte de propinas
 * @route GET /api/propinas/reporte
 */
async function obtenerReporte(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            id_camarero
        } = req.query;

        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        const [reporte] = await pool.query(
            'CALL sp_reporte_propinas(?, ?, ?)',
            [fecha_desde, fecha_hasta, id_camarero || null]
        );

        res.json({
            success: true,
            data: reporte[0]
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
 * Obtener estadísticas de propinas
 * @route GET /api/propinas/estadisticas
 */
async function obtenerEstadisticas(req, res) {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        let whereClause = '1=1';
        let params = [];

        if (fecha_desde && fecha_hasta) {
            whereClause = 'DATE(fecha_registro) BETWEEN ? AND ?';
            params = [fecha_desde, fecha_hasta];
        }

        const [stats] = await pool.query(
            `SELECT
                COUNT(*) AS total_propinas,
                COALESCE(SUM(monto), 0) AS total_monto,
                COALESCE(AVG(monto), 0) AS promedio_propina,
                COALESCE(MAX(monto), 0) AS propina_maxima,
                COALESCE(MIN(monto), 0) AS propina_minima,
                COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) AS propinas_pendientes,
                COUNT(CASE WHEN estado = 'distribuida' THEN 1 END) AS propinas_distribuidas,
                COUNT(CASE WHEN estado = 'entregada' THEN 1 END) AS propinas_entregadas,
                COALESCE(SUM(CASE WHEN estado = 'pendiente' THEN monto ELSE 0 END), 0) AS monto_pendiente,
                COALESCE(SUM(CASE WHEN estado = 'entregada' THEN monto ELSE 0 END), 0) AS monto_entregado
             FROM propinas
             WHERE ${whereClause} AND activo = 'Y'`,
            params
        );

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

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================

module.exports = {
    registrarPropina,
    obtenerPropinas,
    obtenerPropinasPorCamarero,
    obtenerPropinasCamarero,
    crearDistribucion,
    obtenerDistribuciones,
    obtenerDetalleDistribucion,
    entregarPropinas,
    obtenerReporte,
    obtenerEstadisticas
};
