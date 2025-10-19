/**
 * =====================================================
 * CONTROLADOR DE IMPRESIÓN DE FACTURAS
 * Descripción: Gestión completa de emisión de facturas según normativa chilena
 * Autor: Devlmer - Dysa
 * Fecha: 2025-10-05 03:17 AM
 * PRODUCCIÓN: Sistema real para restaurante
 * =====================================================
 */

const { pool } = require('../config/database');

/**
 * Emitir factura para una venta
 * @route POST /api/facturas/emitir
 */
async function emitirFactura(req, res) {
    try {
        const {
            id_venta,
            tipo_documento = 'boleta',
            rut_cliente,
            nombre_cliente,
            direccion_cliente,
            giro_cliente,
            id_usuario
        } = req.body;

        // Validaciones
        if (!id_venta) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere id_venta'
            });
        }

        if (!id_usuario) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere id_usuario'
            });
        }

        if (tipo_documento === 'factura' && !rut_cliente) {
            return res.status(400).json({
                success: false,
                error: 'Para facturas se requiere RUT del cliente'
            });
        }

        const [result] = await pool.query(
            'CALL sp_emitir_factura(?, ?, ?, ?, ?, ?, ?, @id_factura, @numero_factura, @mensaje)',
            [
                id_venta,
                tipo_documento,
                rut_cliente || null,
                nombre_cliente || null,
                direccion_cliente || null,
                giro_cliente || null,
                id_usuario
            ]
        );

        const [output] = await pool.query(
            'SELECT @id_factura AS id_factura, @numero_factura AS numero_factura, @mensaje AS mensaje'
        );

        if (output[0].id_factura > 0) {
            res.json({
                success: true,
                data: {
                    id_factura: output[0].id_factura,
                    numero_factura: output[0].numero_factura,
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
        console.error('Error al emitir factura:', error);
        res.status(500).json({
            success: false,
            error: 'Error al emitir factura',
            detalle: error.message
        });
    }
}

/**
 * Obtener facturas
 * @route GET /api/facturas
 */
async function obtenerFacturas(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            tipo_documento,
            anulada,
            limite = 100
        } = req.query;

        let query = 'SELECT * FROM vista_facturas_consolidadas WHERE 1=1';
        let params = [];

        if (fecha_desde) {
            query += ' AND DATE(fecha_emision) >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ' AND DATE(fecha_emision) <= ?';
            params.push(fecha_hasta);
        }

        if (tipo_documento) {
            query += ' AND tipo_documento = ?';
            params.push(tipo_documento);
        }

        if (anulada !== undefined) {
            query += ' AND anulada = ?';
            params.push(anulada);
        }

        query += ' ORDER BY fecha_emision DESC LIMIT ?';
        params.push(parseInt(limite));

        const [facturas] = await pool.query(query, params);

        res.json({
            success: true,
            data: facturas
        });

    } catch (error) {
        console.error('Error al obtener facturas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener facturas',
            detalle: error.message
        });
    }
}

/**
 * Obtener detalle de una factura
 * @route GET /api/facturas/:id_factura
 */
async function obtenerDetalleFactura(req, res) {
    try {
        const { id_factura } = req.params;

        // Información de la factura
        const [factura] = await pool.query(
            'SELECT * FROM vista_facturas_consolidadas WHERE id_factura = ?',
            [id_factura]
        );

        if (factura.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Factura no encontrada'
            });
        }

        // Detalle de productos
        const [detalle] = await pool.query(
            'SELECT * FROM detalle_facturas WHERE id_factura = ? ORDER BY orden',
            [id_factura]
        );

        // Configuración del restaurante
        const [config] = await pool.query(
            'SELECT * FROM configuracion_restaurante WHERE activo = "Y" LIMIT 1'
        );

        res.json({
            success: true,
            data: {
                factura: factura[0],
                detalle: detalle,
                configuracion: config[0] || null
            }
        });

    } catch (error) {
        console.error('Error al obtener detalle de factura:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener detalle de factura',
            detalle: error.message
        });
    }
}

/**
 * Anular factura
 * @route POST /api/facturas/anular
 */
async function anularFactura(req, res) {
    try {
        const {
            id_factura,
            motivo,
            id_usuario
        } = req.body;

        // Validaciones
        if (!id_factura || !motivo || !id_usuario) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_factura, motivo e id_usuario'
            });
        }

        const [result] = await pool.query(
            'CALL sp_anular_factura(?, ?, ?, @mensaje)',
            [id_factura, motivo, id_usuario]
        );

        const [output] = await pool.query('SELECT @mensaje AS mensaje');

        if (output[0].mensaje.includes('exitosamente')) {
            res.json({
                success: true,
                mensaje: output[0].mensaje
            });
        } else {
            res.status(400).json({
                success: false,
                error: output[0].mensaje
            });
        }

    } catch (error) {
        console.error('Error al anular factura:', error);
        res.status(500).json({
            success: false,
            error: 'Error al anular factura',
            detalle: error.message
        });
    }
}

/**
 * Registrar impresión de factura
 * @route POST /api/facturas/imprimir
 */
async function registrarImpresion(req, res) {
    try {
        const { id_factura } = req.body;

        if (!id_factura) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere id_factura'
            });
        }

        await pool.query('CALL sp_registrar_impresion(?)', [id_factura]);

        res.json({
            success: true,
            mensaje: 'Impresión registrada'
        });

    } catch (error) {
        console.error('Error al registrar impresión:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar impresión',
            detalle: error.message
        });
    }
}

/**
 * Obtener configuración del restaurante
 * @route GET /api/facturas/configuracion
 */
async function obtenerConfiguracion(req, res) {
    try {
        const [config] = await pool.query(
            'SELECT * FROM configuracion_restaurante WHERE activo = "Y" LIMIT 1'
        );

        res.json({
            success: true,
            data: config[0] || null
        });

    } catch (error) {
        console.error('Error al obtener configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener configuración',
            detalle: error.message
        });
    }
}

/**
 * Actualizar configuración del restaurante
 * @route PUT /api/facturas/configuracion
 */
async function actualizarConfiguracion(req, res) {
    try {
        const {
            nombre_comercial,
            razon_social,
            rut,
            giro,
            direccion,
            comuna,
            ciudad,
            telefono,
            email,
            sitio_web,
            tipo_documento,
            resolucion_sii,
            fecha_resolucion,
            mensaje_footer
        } = req.body;

        await pool.query(
            `UPDATE configuracion_restaurante
             SET nombre_comercial = ?,
                 razon_social = ?,
                 rut = ?,
                 giro = ?,
                 direccion = ?,
                 comuna = ?,
                 ciudad = ?,
                 telefono = ?,
                 email = ?,
                 sitio_web = ?,
                 tipo_documento = ?,
                 resolucion_sii = ?,
                 fecha_resolucion = ?,
                 mensaje_footer = ?
             WHERE activo = 'Y'
             LIMIT 1`,
            [
                nombre_comercial,
                razon_social,
                rut,
                giro,
                direccion,
                comuna,
                ciudad,
                telefono,
                email,
                sitio_web,
                tipo_documento,
                resolucion_sii,
                fecha_resolucion,
                mensaje_footer
            ]
        );

        res.json({
            success: true,
            mensaje: 'Configuración actualizada'
        });

    } catch (error) {
        console.error('Error al actualizar configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar configuración',
            detalle: error.message
        });
    }
}

/**
 * Obtener folios
 * @route GET /api/facturas/folios
 */
async function obtenerFolios(req, res) {
    try {
        const { tipo_documento, estado } = req.query;

        let query = 'SELECT * FROM folios_facturas WHERE 1=1';
        let params = [];

        if (tipo_documento) {
            query += ' AND tipo_documento = ?';
            params.push(tipo_documento);
        }

        if (estado) {
            query += ' AND estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY fecha_asignacion DESC';

        const [folios] = await pool.query(query, params);

        res.json({
            success: true,
            data: folios
        });

    } catch (error) {
        console.error('Error al obtener folios:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener folios',
            detalle: error.message
        });
    }
}

/**
 * Crear nuevo folio
 * @route POST /api/facturas/folios
 */
async function crearFolio(req, res) {
    try {
        const {
            tipo_documento,
            numero_desde,
            numero_hasta,
            fecha_asignacion,
            fecha_vencimiento
        } = req.body;

        // Validaciones
        if (!tipo_documento || !numero_desde || !numero_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren tipo_documento, numero_desde y numero_hasta'
            });
        }

        if (numero_desde >= numero_hasta) {
            return res.status(400).json({
                success: false,
                error: 'numero_hasta debe ser mayor que numero_desde'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO folios_facturas (
                tipo_documento,
                numero_desde,
                numero_hasta,
                numero_actual,
                fecha_asignacion,
                fecha_vencimiento
             ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                tipo_documento,
                numero_desde,
                numero_hasta,
                numero_desde,
                fecha_asignacion || new Date(),
                fecha_vencimiento || null
            ]
        );

        res.json({
            success: true,
            data: {
                id_folio: result.insertId,
                mensaje: 'Folio creado exitosamente'
            }
        });

    } catch (error) {
        console.error('Error al crear folio:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear folio',
            detalle: error.message
        });
    }
}

/**
 * Obtener estadísticas de facturas
 * @route GET /api/facturas/estadisticas
 */
async function obtenerEstadisticas(req, res) {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        let whereClause = '1=1';
        let params = [];

        if (fecha_desde && fecha_hasta) {
            whereClause = 'DATE(fecha_emision) BETWEEN ? AND ?';
            params = [fecha_desde, fecha_hasta];
        }

        const [stats] = await pool.query(
            `SELECT
                COUNT(*) AS total_facturas,
                COUNT(CASE WHEN tipo_documento = 'boleta' THEN 1 END) AS total_boletas,
                COUNT(CASE WHEN tipo_documento = 'factura' THEN 1 END) AS total_facturas_formales,
                COUNT(CASE WHEN anulada = 'Y' THEN 1 END) AS total_anuladas,
                COALESCE(SUM(total), 0) AS monto_total,
                COALESCE(SUM(CASE WHEN anulada = 'N' THEN total ELSE 0 END), 0) AS monto_valido,
                COALESCE(AVG(CASE WHEN anulada = 'N' THEN total END), 0) AS promedio_factura
             FROM facturas
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
    emitirFactura,
    obtenerFacturas,
    obtenerDetalleFactura,
    anularFactura,
    registrarImpresion,
    obtenerConfiguracion,
    actualizarConfiguracion,
    obtenerFolios,
    crearFolio,
    obtenerEstadisticas
};
