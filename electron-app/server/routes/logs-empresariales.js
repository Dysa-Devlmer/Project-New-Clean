/**
 * 📋 DYSA Point - Routes del Sistema de Logs Empresariales
 *
 * Endpoints especializados para gestión, consulta y análisis
 * de logs empresariales del sistema POS
 *
 * @autor DYSA Point Development Team
 * @version 2.0.14
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const moment = require('moment-timezone');

class LogsEmpresarialesRoutes {
    constructor(logsManager, database) {
        this.logsManager = logsManager;
        this.database = database;
        this.router = express.Router();

        // Configurar rate limiting específico
        this.rateLimiters = {
            consulta: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 60, // 60 requests por minuto
                message: 'Demasiadas consultas de logs. Intente nuevamente en un minuto.',
                standardHeaders: true,
                legacyHeaders: false
            }),
            escritura: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 100, // 100 logs por minuto
                message: 'Demasiados logs siendo escritos. Intente nuevamente en un minuto.',
                standardHeaders: true,
                legacyHeaders: false
            }),
            exportacion: rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutos
                max: 3, // 3 exportaciones por cada 5 minutos
                message: 'Demasiadas exportaciones. Intente nuevamente en 5 minutos.',
                standardHeaders: true,
                legacyHeaders: false
            }),
            alertas: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 20, // 20 requests por minuto
                message: 'Demasiadas operaciones de alertas. Intente nuevamente en un minuto.',
                standardHeaders: true,
                legacyHeaders: false
            })
        };

        this.setupRoutes();
        console.log('📋 LogsEmpresarialesRoutes configuradas correctamente');
    }

    setupRoutes() {
        // ==================== ENDPOINTS DE CONSULTA ====================

        /**
         * GET /api/logs/estado
         * Obtener estado general del sistema de logs
         */
        this.router.get('/estado', this.rateLimiters.consulta, async (req, res) => {
            try {
                const estado = this.logsManager.getEstado();

                res.json({
                    success: true,
                    data: estado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo estado de logs:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/logs/health
         * Health check específico del sistema de logs
         */
        this.router.get('/health', async (req, res) => {
            try {
                const estado = this.logsManager.getEstado();

                res.json({
                    success: true,
                    healthy: estado.inicializado,
                    logs_totales: estado.estado.logs_totales,
                    alertas_activas: estado.estado.alertas_activas,
                    anomalias_detectadas: estado.estado.anomalias_detectadas,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                res.status(503).json({
                    success: false,
                    healthy: false,
                    error: error.message
                });
            }
        });

        /**
         * GET /api/logs
         * Consultar logs con filtros avanzados y paginación
         */
        this.router.get('/', this.rateLimiters.consulta, async (req, res) => {
            try {
                const filtros = {};
                const paginacion = {
                    page: parseInt(req.query.page) || 1,
                    limit: Math.min(parseInt(req.query.limit) || 100, 1000)
                };

                // Procesar filtros de la query string
                if (req.query.nivel) filtros.nivel = req.query.nivel;
                if (req.query.categoria) filtros.categoria = req.query.categoria;
                if (req.query.usuario_id) filtros.usuario_id = parseInt(req.query.usuario_id);
                if (req.query.buscar) filtros.buscar = req.query.buscar;

                // Filtros de fecha
                if (req.query.fecha_desde) {
                    filtros.fecha_desde = moment(req.query.fecha_desde).format('YYYY-MM-DD HH:mm:ss');
                }
                if (req.query.fecha_hasta) {
                    filtros.fecha_hasta = moment(req.query.fecha_hasta).format('YYYY-MM-DD HH:mm:ss');
                }

                // Si no se especifica fecha, usar últimas 24 horas por defecto
                if (!filtros.fecha_desde && !filtros.fecha_hasta) {
                    filtros.fecha_desde = moment().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss');
                }

                const resultado = await this.logsManager.obtenerLogs(filtros, paginacion);

                res.json({
                    success: true,
                    data: resultado,
                    filtros,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo logs:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/logs/estadisticas
         * Obtener estadísticas y métricas de logs
         */
        this.router.get('/estadisticas', this.rateLimiters.consulta, async (req, res) => {
            try {
                const filtros = {};

                // Filtros de fecha opcionales
                if (req.query.fecha_desde) {
                    filtros.fecha_desde = moment(req.query.fecha_desde).format('YYYY-MM-DD HH:mm:ss');
                }
                if (req.query.fecha_hasta) {
                    filtros.fecha_hasta = moment(req.query.fecha_hasta).format('YYYY-MM-DD HH:mm:ss');
                }

                const estadisticas = await this.logsManager.obtenerEstadisticas(filtros);

                res.json({
                    success: true,
                    data: estadisticas,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo estadísticas de logs:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/logs/recientes
         * Obtener logs más recientes (para dashboard en tiempo real)
         */
        this.router.get('/recientes', this.rateLimiters.consulta, async (req, res) => {
            try {
                const limite = Math.min(parseInt(req.query.limite) || 50, 200);
                const estado = this.logsManager.getEstado();

                res.json({
                    success: true,
                    data: {
                        logs: estado.logs_recientes.slice(0, limite),
                        total_cache: estado.logs_recientes.length,
                        ultimo_update: new Date().toISOString()
                    }
                });

            } catch (error) {
                console.error('Error obteniendo logs recientes:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE ESCRITURA ====================

        /**
         * POST /api/logs
         * Crear un nuevo log manualmente
         */
        this.router.post('/', this.rateLimiters.escritura, async (req, res) => {
            try {
                const { nivel, categoria, mensaje, contexto = {}, metadata = {} } = req.body;

                // Validaciones básicas
                if (!nivel || !categoria || !mensaje) {
                    return res.status(400).json({
                        success: false,
                        error: 'Campos requeridos: nivel, categoria, mensaje'
                    });
                }

                // Agregar metadata de la request
                const requestMetadata = {
                    ...metadata,
                    ip_address: req.ip,
                    user_agent: req.get('User-Agent'),
                    request_id: req.headers['x-request-id'] || undefined
                };

                const logEntry = await this.logsManager.registrarLog(
                    nivel,
                    categoria,
                    mensaje,
                    contexto,
                    requestMetadata
                );

                res.status(201).json({
                    success: true,
                    data: logEntry,
                    message: 'Log registrado exitosamente'
                });

            } catch (error) {
                console.error('Error registrando log:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * POST /api/logs/batch
         * Registrar múltiples logs en lote
         */
        this.router.post('/batch', this.rateLimiters.escritura, async (req, res) => {
            try {
                const { logs } = req.body;

                if (!Array.isArray(logs) || logs.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Se requiere un array de logs válido'
                    });
                }

                if (logs.length > 100) {
                    return res.status(400).json({
                        success: false,
                        error: 'Máximo 100 logs por lote'
                    });
                }

                const resultados = [];
                const errores = [];

                for (let i = 0; i < logs.length; i++) {
                    try {
                        const log = logs[i];
                        const { nivel, categoria, mensaje, contexto = {}, metadata = {} } = log;

                        if (!nivel || !categoria || !mensaje) {
                            errores.push({
                                index: i,
                                error: 'Campos requeridos: nivel, categoria, mensaje'
                            });
                            continue;
                        }

                        const requestMetadata = {
                            ...metadata,
                            ip_address: req.ip,
                            user_agent: req.get('User-Agent'),
                            batch_index: i
                        };

                        const logEntry = await this.logsManager.registrarLog(
                            nivel,
                            categoria,
                            mensaje,
                            contexto,
                            requestMetadata
                        );

                        resultados.push(logEntry);

                    } catch (error) {
                        errores.push({
                            index: i,
                            error: error.message
                        });
                    }
                }

                res.json({
                    success: errores.length === 0,
                    data: {
                        logs_procesados: resultados.length,
                        errores: errores.length,
                        resultados,
                        errores_detalle: errores
                    }
                });

            } catch (error) {
                console.error('Error procesando batch de logs:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE ALERTAS ====================

        /**
         * GET /api/logs/alertas
         * Obtener configuración de alertas
         */
        this.router.get('/alertas', this.rateLimiters.alertas, async (req, res) => {
            try {
                if (!this.database?.connection) {
                    return res.status(503).json({
                        success: false,
                        error: 'Base de datos no disponible'
                    });
                }

                const [alertas] = await this.database.connection.execute(`
                    SELECT * FROM logs_alertas
                    ORDER BY activa DESC, nombre ASC
                `);

                res.json({
                    success: true,
                    data: alertas
                });

            } catch (error) {
                console.error('Error obteniendo alertas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * POST /api/logs/alertas
         * Crear nueva alerta
         */
        this.router.post('/alertas', this.rateLimiters.alertas, async (req, res) => {
            try {
                if (!this.database?.connection) {
                    return res.status(503).json({
                        success: false,
                        error: 'Base de datos no disponible'
                    });
                }

                const {
                    nombre,
                    descripcion,
                    patron_busqueda,
                    nivel_minimo = 'error',
                    categoria,
                    umbral_cantidad = 1,
                    ventana_tiempo_minutos = 60,
                    activa = true
                } = req.body;

                // Validaciones
                if (!nombre || !patron_busqueda) {
                    return res.status(400).json({
                        success: false,
                        error: 'Campos requeridos: nombre, patron_busqueda'
                    });
                }

                const [result] = await this.database.connection.execute(`
                    INSERT INTO logs_alertas (
                        nombre, descripcion, patron_busqueda, nivel_minimo,
                        categoria, umbral_cantidad, ventana_tiempo_minutos, activa
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    nombre, descripcion, patron_busqueda, nivel_minimo,
                    categoria, umbral_cantidad, ventana_tiempo_minutos, activa
                ]);

                await this.logsManager.info('SISTEMA', `Nueva alerta creada: ${nombre}`, {
                    alerta_id: result.insertId,
                    patron: patron_busqueda,
                    usuario_creacion: req.user?.id || 'sistema'
                });

                res.status(201).json({
                    success: true,
                    data: {
                        id: result.insertId,
                        message: 'Alerta creada exitosamente'
                    }
                });

            } catch (error) {
                if (error.code === 'ER_DUP_ENTRY') {
                    res.status(400).json({
                        success: false,
                        error: 'Ya existe una alerta con ese nombre'
                    });
                } else {
                    console.error('Error creando alerta:', error);
                    res.status(500).json({
                        success: false,
                        error: 'Error interno del servidor',
                        message: error.message
                    });
                }
            }
        });

        /**
         * PUT /api/logs/alertas/:id
         * Actualizar alerta existente
         */
        this.router.put('/alertas/:id', this.rateLimiters.alertas, async (req, res) => {
            try {
                if (!this.database?.connection) {
                    return res.status(503).json({
                        success: false,
                        error: 'Base de datos no disponible'
                    });
                }

                const alertaId = parseInt(req.params.id);
                const updates = req.body;

                // Campos actualizables
                const camposPermitidos = [
                    'descripcion', 'patron_busqueda', 'nivel_minimo', 'categoria',
                    'umbral_cantidad', 'ventana_tiempo_minutos', 'activa'
                ];

                const setClauses = [];
                const valores = [];

                for (const [campo, valor] of Object.entries(updates)) {
                    if (camposPermitidos.includes(campo)) {
                        setClauses.push(`${campo} = ?`);
                        valores.push(valor);
                    }
                }

                if (setClauses.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'No se proporcionaron campos válidos para actualizar'
                    });
                }

                valores.push(alertaId);

                const [result] = await this.database.connection.execute(`
                    UPDATE logs_alertas
                    SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, valores);

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Alerta no encontrada'
                    });
                }

                await this.logsManager.info('SISTEMA', `Alerta actualizada: ID ${alertaId}`, {
                    alerta_id: alertaId,
                    campos_actualizados: Object.keys(updates),
                    usuario_actualizacion: req.user?.id || 'sistema'
                });

                res.json({
                    success: true,
                    message: 'Alerta actualizada exitosamente'
                });

            } catch (error) {
                console.error('Error actualizando alerta:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * DELETE /api/logs/alertas/:id
         * Eliminar alerta
         */
        this.router.delete('/alertas/:id', this.rateLimiters.alertas, async (req, res) => {
            try {
                if (!this.database?.connection) {
                    return res.status(503).json({
                        success: false,
                        error: 'Base de datos no disponible'
                    });
                }

                const alertaId = parseInt(req.params.id);

                const [result] = await this.database.connection.execute(`
                    DELETE FROM logs_alertas WHERE id = ?
                `, [alertaId]);

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Alerta no encontrada'
                    });
                }

                await this.logsManager.info('SISTEMA', `Alerta eliminada: ID ${alertaId}`, {
                    alerta_id: alertaId,
                    usuario_eliminacion: req.user?.id || 'sistema'
                });

                res.json({
                    success: true,
                    message: 'Alerta eliminada exitosamente'
                });

            } catch (error) {
                console.error('Error eliminando alerta:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE ANÁLISIS ====================

        /**
         * GET /api/logs/analisis/tendencias
         * Análisis de tendencias de logs
         */
        this.router.get('/analisis/tendencias', this.rateLimiters.consulta, async (req, res) => {
            try {
                if (!this.database?.connection) {
                    return res.status(503).json({
                        success: false,
                        error: 'Base de datos no disponible'
                    });
                }

                const periodo = req.query.periodo || '24h';
                let intervaloPeriodo, formatoFecha, groupBy;

                switch (periodo) {
                    case '1h':
                        intervaloPeriodo = 'INTERVAL 1 HOUR';
                        formatoFecha = '%Y-%m-%d %H:%i';
                        groupBy = 'YEAR(timestamp), MONTH(timestamp), DAY(timestamp), HOUR(timestamp), FLOOR(MINUTE(timestamp)/10)*10';
                        break;
                    case '24h':
                        intervaloPeriodo = 'INTERVAL 24 HOUR';
                        formatoFecha = '%Y-%m-%d %H:00';
                        groupBy = 'YEAR(timestamp), MONTH(timestamp), DAY(timestamp), HOUR(timestamp)';
                        break;
                    case '7d':
                        intervaloPeriodo = 'INTERVAL 7 DAY';
                        formatoFecha = '%Y-%m-%d';
                        groupBy = 'DATE(timestamp)';
                        break;
                    case '30d':
                        intervaloPeriodo = 'INTERVAL 30 DAY';
                        formatoFecha = '%Y-%m-%d';
                        groupBy = 'DATE(timestamp)';
                        break;
                    default:
                        return res.status(400).json({
                            success: false,
                            error: 'Período inválido. Use: 1h, 24h, 7d, 30d'
                        });
                }

                // Tendencia general
                const [tendencia] = await this.database.connection.execute(`
                    SELECT
                        DATE_FORMAT(timestamp, ?) as periodo,
                        nivel,
                        categoria,
                        COUNT(*) as cantidad
                    FROM logs_empresariales
                    WHERE timestamp >= DATE_SUB(NOW(), ${intervaloPeriodo})
                    GROUP BY ${groupBy}, nivel, categoria
                    ORDER BY periodo ASC
                `, [formatoFecha]);

                // Top errores
                const [topErrores] = await this.database.connection.execute(`
                    SELECT
                        mensaje,
                        COUNT(*) as cantidad,
                        MAX(timestamp) as ultimo_ocurrencia
                    FROM logs_empresariales
                    WHERE timestamp >= DATE_SUB(NOW(), ${intervaloPeriodo})
                    AND nivel IN ('error', 'critical', 'alert', 'emergency')
                    GROUP BY mensaje
                    ORDER BY cantidad DESC
                    LIMIT 10
                `);

                res.json({
                    success: true,
                    data: {
                        periodo,
                        tendencia,
                        top_errores: topErrores,
                        generado_en: new Date().toISOString()
                    }
                });

            } catch (error) {
                console.error('Error obteniendo tendencias:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/logs/analisis/anomalias
         * Obtener anomalías detectadas
         */
        this.router.get('/analisis/anomalias', this.rateLimiters.consulta, async (req, res) => {
            try {
                const estado = this.logsManager.getEstado();

                // Obtener logs de anomalías recientes
                const filtros = {
                    categoria: 'SISTEMA',
                    buscar: 'anomalia_detectada',
                    fecha_desde: moment().subtract(24, 'hours').format('YYYY-MM-DD HH:mm:ss')
                };

                const anomalias = await this.logsManager.obtenerLogs(filtros, { page: 1, limit: 50 });

                res.json({
                    success: true,
                    data: {
                        anomalias_detectadas: estado.estado.anomalias_detectadas,
                        anomalias_recientes: anomalias.logs,
                        patrones_monitoreados: Array.from(this.logsManager.patronesAnomalias.keys()),
                        timestamp: new Date().toISOString()
                    }
                });

            } catch (error) {
                console.error('Error obteniendo anomalías:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE EXPORTACIÓN ====================

        /**
         * GET /api/logs/exportar
         * Exportar logs en diferentes formatos
         */
        this.router.get('/exportar', this.rateLimiters.exportacion, async (req, res) => {
            try {
                const formato = req.query.formato || 'json';
                const filtros = {};

                // Procesar filtros
                if (req.query.nivel) filtros.nivel = req.query.nivel;
                if (req.query.categoria) filtros.categoria = req.query.categoria;
                if (req.query.fecha_desde) {
                    filtros.fecha_desde = moment(req.query.fecha_desde).format('YYYY-MM-DD HH:mm:ss');
                }
                if (req.query.fecha_hasta) {
                    filtros.fecha_hasta = moment(req.query.fecha_hasta).format('YYYY-MM-DD HH:mm:ss');
                }

                // Límite máximo para exportación
                const limite = Math.min(parseInt(req.query.limite) || 10000, 50000);

                const logs = await this.logsManager.obtenerLogs(filtros, { page: 1, limit: limite });

                const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
                let filename, contentType, data;

                switch (formato.toLowerCase()) {
                    case 'csv':
                        filename = `logs_${timestamp}.csv`;
                        contentType = 'text/csv';
                        data = this.convertirACSV(logs.logs);
                        break;

                    case 'xlsx':
                        filename = `logs_${timestamp}.xlsx`;
                        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        data = await this.convertirAExcel(logs.logs);
                        break;

                    case 'json':
                    default:
                        filename = `logs_${timestamp}.json`;
                        contentType = 'application/json';
                        data = JSON.stringify({
                            exportacion: {
                                fecha: new Date().toISOString(),
                                filtros,
                                total_logs: logs.total,
                                logs_exportados: logs.logs.length
                            },
                            logs: logs.logs
                        }, null, 2);
                        break;
                }

                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                res.setHeader('Content-Type', contentType);
                res.send(data);

                await this.logsManager.info('SISTEMA', 'Exportación de logs realizada', {
                    formato,
                    filtros,
                    logs_exportados: logs.logs.length,
                    usuario: req.user?.id || 'anonimo'
                });

            } catch (error) {
                console.error('Error exportando logs:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE CONFIGURACIÓN ====================

        /**
         * GET /api/logs/configuracion
         * Obtener configuración actual del sistema de logs
         */
        this.router.get('/configuracion', this.rateLimiters.consulta, async (req, res) => {
            try {
                const estado = this.logsManager.getEstado();

                res.json({
                    success: true,
                    data: {
                        configuracion: estado.configuracion,
                        categorias_disponibles: estado.categorias_disponibles,
                        niveles_disponibles: estado.niveles_disponibles
                    }
                });

            } catch (error) {
                console.error('Error obteniendo configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * PUT /api/logs/configuracion
         * Actualizar configuración del sistema de logs
         */
        this.router.put('/configuracion', this.rateLimiters.alertas, async (req, res) => {
            try {
                const nuevaConfig = req.body;

                // Validar configuración
                const camposPermitidos = [
                    'nivel_minimo', 'rotacion_dias', 'max_tamanio_mb',
                    'archivo_automatico', 'alertas_activas', 'analisis_anomalias',
                    'formato_logs'
                ];

                const configValida = {};
                for (const [campo, valor] of Object.entries(nuevaConfig)) {
                    if (camposPermitidos.includes(campo)) {
                        configValida[campo] = valor;
                    }
                }

                // Actualizar configuración
                Object.assign(this.logsManager.configuracion, configValida);

                // Guardar configuración
                await this.logsManager.guardarConfiguracion();

                await this.logsManager.info('SISTEMA', 'Configuración de logs actualizada', {
                    campos_actualizados: Object.keys(configValida),
                    nueva_configuracion: configValida,
                    usuario: req.user?.id || 'sistema'
                });

                res.json({
                    success: true,
                    message: 'Configuración actualizada exitosamente',
                    data: configValida
                });

            } catch (error) {
                console.error('Error actualizando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });
    }

    // ==================== MÉTODOS AUXILIARES ====================

    convertirACSV(logs) {
        if (logs.length === 0) return 'timestamp,nivel,categoria,mensaje,usuario_id,ip_address\n';

        const headers = 'timestamp,nivel,categoria,mensaje,usuario_id,ip_address\n';
        const rows = logs.map(log => {
            const mensaje = (log.mensaje || '').replace(/"/g, '""');
            return `"${log.timestamp}","${log.nivel}","${log.categoria}","${mensaje}","${log.usuario_id || ''}","${log.ip_address || ''}"`;
        }).join('\n');

        return headers + rows;
    }

    async convertirAExcel(logs) {
        try {
            const ExcelJS = require('exceljs');
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Logs Empresariales');

            // Headers
            worksheet.columns = [
                { header: 'Timestamp', key: 'timestamp', width: 20 },
                { header: 'Nivel', key: 'nivel', width: 10 },
                { header: 'Categoría', key: 'categoria', width: 15 },
                { header: 'Mensaje', key: 'mensaje', width: 50 },
                { header: 'Usuario ID', key: 'usuario_id', width: 12 },
                { header: 'IP Address', key: 'ip_address', width: 15 }
            ];

            // Datos
            logs.forEach(log => {
                worksheet.addRow({
                    timestamp: log.timestamp,
                    nivel: log.nivel,
                    categoria: log.categoria,
                    mensaje: log.mensaje,
                    usuario_id: log.usuario_id,
                    ip_address: log.ip_address
                });
            });

            // Estilo para headers
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };

            return await workbook.xlsx.writeBuffer();

        } catch (error) {
            console.error('Error creando Excel:', error);
            throw error;
        }
    }

    getRouter() {
        return this.router;
    }
}

module.exports = LogsEmpresarialesRoutes;