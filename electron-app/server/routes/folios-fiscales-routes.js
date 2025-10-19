#!/usr/bin/env node

/**
 * DYSA Point - API Routes para Folios Fiscales Correlativos
 *
 * Endpoints especializados para el manejo de numeración fiscal
 * Implementación basada en análisis del sistema SYSME original
 *
 * Funcionalidades API:
 * - Obtención de números correlativos
 * - Emisión de documentos fiscales
 * - Anulación y control de documentos
 * - Validación de integridad secuencial
 * - Estadísticas y reportes fiscales
 */

const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');

module.exports = (foliosFiscalesManager, databaseManager) => {

    // ========================================
    // ENDPOINTS DE NUMERACIÓN
    // ========================================

    /**
     * POST /api/folios-fiscales/siguiente-numero
     * Obtener el siguiente número correlativo
     */
    router.post('/siguiente-numero', async (req, res) => {
        try {
            const {
                tipo_documento,
                serie = 'A',
                id_empleado
            } = req.body;

            // Validaciones de entrada
            if (!tipo_documento) {
                return res.status(400).json({
                    success: false,
                    error: 'Tipo de documento es requerido'
                });
            }

            if (!id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de empleado es requerido'
                });
            }

            // Tipos válidos
            const tiposValidos = ['ticket', 'factura', 'boleta', 'nota_credito', 'nota_debito'];
            if (!tiposValidos.includes(tipo_documento)) {
                return res.status(400).json({
                    success: false,
                    error: `Tipo de documento debe ser uno de: ${tiposValidos.join(', ')}`
                });
            }

            const resultado = await foliosFiscalesManager.obtenerSiguienteNumero(
                tipo_documento,
                serie,
                id_empleado
            );

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo siguiente número:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE DOCUMENTOS FISCALES
    // ========================================

    /**
     * POST /api/folios-fiscales/emitir-documento
     * Emitir documento fiscal completo
     */
    router.post('/emitir-documento', async (req, res) => {
        try {
            const {
                tipo_documento,
                serie = 'A',
                id_venta,
                id_cliente,
                monto_total,
                monto_neto,
                monto_iva,
                id_empleado,
                observaciones
            } = req.body;

            // Validaciones de entrada
            if (!tipo_documento || !monto_total || !id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'Tipo de documento, monto total e ID de empleado son requeridos'
                });
            }

            if (monto_total <= 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Monto total debe ser mayor a 0'
                });
            }

            const resultado = await foliosFiscalesManager.emitirDocumentoFiscal({
                tipo_documento,
                serie,
                id_venta,
                id_cliente,
                monto_total: parseFloat(monto_total),
                monto_neto: monto_neto ? parseFloat(monto_neto) : null,
                monto_iva: monto_iva ? parseFloat(monto_iva) : null,
                id_empleado,
                observaciones
            });

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error emitiendo documento:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * POST /api/folios-fiscales/anular-documento
     * Anular un documento fiscal emitido
     */
    router.post('/anular-documento', async (req, res) => {
        try {
            const {
                id_documento,
                motivo,
                id_empleado
            } = req.body;

            // Validaciones
            if (!id_documento || !motivo || !id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de documento, motivo e ID de empleado son requeridos'
                });
            }

            if (motivo.length < 10) {
                return res.status(400).json({
                    success: false,
                    error: 'El motivo debe tener al menos 10 caracteres'
                });
            }

            const resultado = await foliosFiscalesManager.anularDocumento(
                parseInt(id_documento),
                motivo,
                id_empleado
            );

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error anulando documento:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE CONSULTA
    // ========================================

    /**
     * GET /api/folios-fiscales/documento/:id
     * Obtener información de un documento específico
     */
    router.get('/documento/:id', async (req, res) => {
        try {
            const id_documento = parseInt(req.params.id);

            if (!id_documento) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de documento requerido'
                });
            }

            const [documentos] = await databaseManager.query(`
                SELECT
                    df.*,
                    ff.prefijo,
                    ff.longitud_numero
                FROM documentos_fiscales df
                LEFT JOIN folios_facturas ff ON df.id_folio = ff.id_folio
                WHERE df.id_documento = ?
            `, [id_documento]);

            if (documentos.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: 'Documento no encontrado'
                });
            }

            res.json({
                success: true,
                data: documentos[0],
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error consultando documento:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/folios-fiscales/buscar
     * Buscar documentos por criterios
     */
    router.get('/buscar', async (req, res) => {
        try {
            const {
                tipo_documento,
                serie,
                numero_completo,
                id_venta,
                estado,
                fecha_inicio,
                fecha_fin,
                limite = 50
            } = req.query;

            let whereClause = ['1=1'];
            let params = [];

            if (tipo_documento) {
                whereClause.push('df.tipo_documento = ?');
                params.push(tipo_documento);
            }

            if (serie) {
                whereClause.push('df.serie = ?');
                params.push(serie);
            }

            if (numero_completo) {
                whereClause.push('df.numero_completo LIKE ?');
                params.push(`%${numero_completo}%`);
            }

            if (id_venta) {
                whereClause.push('df.id_venta = ?');
                params.push(parseInt(id_venta));
            }

            if (estado) {
                whereClause.push('df.estado = ?');
                params.push(estado);
            }

            if (fecha_inicio) {
                whereClause.push('DATE(df.fecha_emision) >= ?');
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                whereClause.push('DATE(df.fecha_emision) <= ?');
                params.push(fecha_fin);
            }

            params.push(parseInt(limite));

            const [documentos] = await databaseManager.query(`
                SELECT
                    df.id_documento,
                    df.tipo_documento,
                    df.serie,
                    df.numero,
                    df.numero_completo,
                    df.id_venta,
                    df.monto_total,
                    df.estado,
                    df.fecha_emision,
                    df.observaciones
                FROM documentos_fiscales df
                WHERE ${whereClause.join(' AND ')}
                ORDER BY df.fecha_emision DESC
                LIMIT ?
            `, params);

            res.json({
                success: true,
                data: documentos,
                total: documentos.length,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error buscando documentos:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE CONFIGURACIÓN
    // ========================================

    /**
     * GET /api/folios-fiscales/configuracion
     * Obtener configuración actual de folios
     */
    router.get('/configuracion', async (req, res) => {
        try {
            const [folios] = await databaseManager.query(`
                SELECT
                    id_folio,
                    tipo_documento,
                    serie,
                    numero_actual,
                    numero_minimo,
                    numero_maximo,
                    prefijo,
                    sufijo,
                    longitud_numero,
                    activo
                FROM folios_facturas
                ORDER BY tipo_documento, serie
            `);

            res.json({
                success: true,
                data: folios,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * PUT /api/folios-fiscales/configuracion/:id
     * Actualizar configuración de un folio
     */
    router.put('/configuracion/:id', async (req, res) => {
        try {
            const id_folio = parseInt(req.params.id);
            const {
                numero_maximo,
                prefijo,
                sufijo,
                longitud_numero,
                activo
            } = req.body;

            if (!id_folio) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de folio requerido'
                });
            }

            const setClauses = [];
            const params = [];

            if (numero_maximo !== undefined) {
                setClauses.push('numero_maximo = ?');
                params.push(parseInt(numero_maximo));
            }

            if (prefijo !== undefined) {
                setClauses.push('prefijo = ?');
                params.push(prefijo);
            }

            if (sufijo !== undefined) {
                setClauses.push('sufijo = ?');
                params.push(sufijo);
            }

            if (longitud_numero !== undefined) {
                setClauses.push('longitud_numero = ?');
                params.push(parseInt(longitud_numero));
            }

            if (activo !== undefined) {
                setClauses.push('activo = ?');
                params.push(activo === true || activo === 'true' ? 1 : 0);
            }

            if (setClauses.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Debe proporcionar al menos un campo para actualizar'
                });
            }

            setClauses.push('updated_at = NOW()');
            params.push(id_folio);

            await databaseManager.query(`
                UPDATE folios_facturas
                SET ${setClauses.join(', ')}
                WHERE id_folio = ?
            `, params);

            // Recargar cache
            await foliosFiscalesManager.cargarCacheNumeros();

            res.json({
                success: true,
                mensaje: 'Configuración actualizada correctamente',
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error actualizando configuración:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE VALIDACIÓN Y AUDITORÍA
    // ========================================

    /**
     * GET /api/folios-fiscales/validar-integridad/:tipo/:serie?
     * Validar integridad secuencial de documentos
     */
    router.get('/validar-integridad/:tipo/:serie?', async (req, res) => {
        try {
            const tipo_documento = req.params.tipo;
            const serie = req.params.serie || 'A';

            const resultado = await foliosFiscalesManager.validarIntegridadSecuencial(
                tipo_documento,
                serie
            );

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error validando integridad:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/folios-fiscales/estadisticas
     * Obtener estadísticas fiscales
     */
    router.get('/estadisticas', async (req, res) => {
        try {
            const {
                fecha_inicio,
                fecha_fin
            } = req.query;

            const estadisticas = await foliosFiscalesManager.obtenerEstadisticasFiscales(
                fecha_inicio,
                fecha_fin
            );

            res.json({
                success: true,
                data: estadisticas,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE SALUD Y ESTADO
    // ========================================

    /**
     * GET /api/folios-fiscales/health
     * Health check del servicio
     */
    router.get('/health', async (req, res) => {
        try {
            const estado = await foliosFiscalesManager.obtenerEstadoServicio();

            res.json({
                success: true,
                data: estado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/folios-fiscales/log
     * Obtener log de operaciones fiscales
     */
    router.get('/log', async (req, res) => {
        try {
            const {
                operacion,
                tipo_documento,
                fecha_inicio,
                limite = 100
            } = req.query;

            let whereClause = ['1=1'];
            let params = [];

            if (operacion) {
                whereClause.push('operacion = ?');
                params.push(operacion);
            }

            if (tipo_documento) {
                whereClause.push('tipo_documento = ?');
                params.push(tipo_documento);
            }

            if (fecha_inicio) {
                whereClause.push('DATE(fecha_operacion) >= ?');
                params.push(fecha_inicio);
            }

            params.push(parseInt(limite));

            const [logs] = await databaseManager.query(`
                SELECT
                    id_log,
                    operacion,
                    tipo_documento,
                    serie,
                    numero_anterior,
                    numero_nuevo,
                    descripcion,
                    fecha_operacion,
                    ip_terminal
                FROM log_folios_fiscales
                WHERE ${whereClause.join(' AND ')}
                ORDER BY fecha_operacion DESC
                LIMIT ?
            `, params);

            res.json({
                success: true,
                data: logs,
                total: logs.length,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo log:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    return router;
};