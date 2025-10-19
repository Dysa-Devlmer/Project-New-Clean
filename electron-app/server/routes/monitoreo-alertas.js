/**
 * DYSA Point - Rutas del Sistema de Monitoreo y Alertas
 * API REST para monitoreo empresarial 24/7
 *
 * Sistema de Producción - Monitoreo y Alertas Empresariales
 * Compatible con operación continua y alertas multi-canal
 *
 * @author DYSA Point Development Team
 * @version 2.0.14
 * @date 2025-10-13
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');

class MonitoreoAlertasRoutes {
    constructor(monitoreoAlertasManager, database) {
        this.monitoreoAlertasManager = monitoreoAlertasManager;
        this.database = database;
        this.router = express.Router();
        this.setupRateLimit();
        this.setupRoutes();
    }

    setupRateLimit() {
        // Rate limiting para monitoreo (más permisivo para consultas frecuentes)
        this.consultasRateLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minuto
            max: 100, // 100 consultas por minuto
            message: {
                success: false,
                error: 'Demasiadas consultas de monitoreo. Límite: 100 por minuto.',
                code: 'MONITORING_RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        // Rate limiting para configuración (más restrictivo)
        this.configRateLimiter = rateLimit({
            windowMs: 60 * 1000,
            max: 10, // 10 cambios de configuración por minuto
            message: {
                success: false,
                error: 'Demasiados cambios de configuración. Límite: 10 por minuto.',
                code: 'CONFIG_RATE_LIMIT_EXCEEDED'
            }
        });

        this.router.use('/estadisticas', this.consultasRateLimiter);
        this.router.use('/metricas', this.consultasRateLimiter);
        this.router.use('/alertas', this.consultasRateLimiter);
        this.router.use('/configuracion', this.configRateLimiter);
    }

    setupRoutes() {
        // ==================== ENDPOINTS DE MONITOREO ====================

        // Obtener estadísticas completas del sistema
        this.router.get('/estadisticas', async (req, res) => {
            try {
                const estadisticas = this.monitoreoAlertasManager.obtenerEstadisticas();

                res.json({
                    success: true,
                    data: estadisticas,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo estadísticas de monitoreo:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo estadísticas de monitoreo',
                    details: error.message
                });
            }
        });

        // Obtener métricas específicas en tiempo real
        this.router.get('/metricas/:metrica?', async (req, res) => {
            try {
                const metricaSolicitada = req.params.metrica;
                const { historico = false } = req.query;

                const estadisticas = this.monitoreoAlertasManager.obtenerEstadisticas();

                if (metricaSolicitada) {
                    const metrica = estadisticas.metricas[metricaSolicitada];
                    if (!metrica) {
                        return res.status(404).json({
                            success: false,
                            error: `Métrica '${metricaSolicitada}' no encontrada`
                        });
                    }

                    res.json({
                        success: true,
                        metrica: metricaSolicitada,
                        data: metrica,
                        incluye_historico: historico === 'true',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    res.json({
                        success: true,
                        data: {
                            metricas: estadisticas.metricas,
                            disponibles: Object.keys(estadisticas.metricas)
                        },
                        timestamp: new Date().toISOString()
                    });
                }

            } catch (error) {
                console.error('Error obteniendo métricas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo métricas del sistema',
                    details: error.message
                });
            }
        });

        // Obtener alertas activas
        this.router.get('/alertas', async (req, res) => {
            try {
                const {
                    estado = 'activa',
                    nivel,
                    componente,
                    limite = 50,
                    offset = 0
                } = req.query;

                const estadisticas = this.monitoreoAlertasManager.obtenerEstadisticas();
                let alertas = estadisticas.alertas_activas || [];

                // Aplicar filtros
                if (estado) {
                    alertas = alertas.filter(alerta => alerta.estado === estado);
                }
                if (nivel) {
                    alertas = alertas.filter(alerta => alerta.nivel === nivel);
                }
                if (componente) {
                    alertas = alertas.filter(alerta => alerta.componente === componente);
                }

                // Ordenar por timestamp descendente (más recientes primero)
                alertas.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

                // Aplicar paginación
                const alertasPaginadas = alertas.slice(
                    parseInt(offset),
                    parseInt(offset) + parseInt(limite)
                );

                res.json({
                    success: true,
                    data: alertasPaginadas,
                    pagination: {
                        total: alertas.length,
                        limite: parseInt(limite),
                        offset: parseInt(offset),
                        tiene_siguiente: alertas.length > (parseInt(offset) + parseInt(limite))
                    },
                    filtros_aplicados: { estado, nivel, componente },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo alertas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo alertas del sistema',
                    details: error.message
                });
            }
        });

        // Obtener configuración actual de monitoreo
        this.router.get('/configuracion', async (req, res) => {
            try {
                const estadisticas = this.monitoreoAlertasManager.obtenerEstadisticas();

                res.json({
                    success: true,
                    data: {
                        configuracion: estadisticas.configuracion,
                        jobs_programados: estadisticas.jobs_programados,
                        sistema_iniciado: estadisticas.sistema_iniciado
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo configuración de monitoreo:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo configuración de monitoreo',
                    details: error.message
                });
            }
        });

        // Actualizar configuración de monitoreo
        this.router.put('/configuracion', async (req, res) => {
            try {
                const nuevaConfig = req.body;

                // Validaciones básicas
                if (nuevaConfig.umbrales) {
                    const umbrales = nuevaConfig.umbrales;
                    if (umbrales.cpu_warning && (umbrales.cpu_warning < 0 || umbrales.cpu_warning > 100)) {
                        return res.status(400).json({
                            success: false,
                            error: 'Umbral de CPU warning debe estar entre 0 y 100'
                        });
                    }
                    if (umbrales.cpu_critical && (umbrales.cpu_critical < 0 || umbrales.cpu_critical > 100)) {
                        return res.status(400).json({
                            success: false,
                            error: 'Umbral de CPU critical debe estar entre 0 y 100'
                        });
                    }
                    if (umbrales.cpu_warning && umbrales.cpu_critical && umbrales.cpu_warning >= umbrales.cpu_critical) {
                        return res.status(400).json({
                            success: false,
                            error: 'Umbral de warning debe ser menor que critical'
                        });
                    }
                }

                if (nuevaConfig.intervalos) {
                    const intervalos = nuevaConfig.intervalos;
                    if (intervalos.monitoreo_general && intervalos.monitoreo_general < 10) {
                        return res.status(400).json({
                            success: false,
                            error: 'Intervalo de monitoreo general no puede ser menor a 10 segundos'
                        });
                    }
                }

                await this.monitoreoAlertasManager.actualizarConfiguracion(nuevaConfig);

                res.json({
                    success: true,
                    message: 'Configuración de monitoreo actualizada exitosamente',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error actualizando configuración de monitoreo:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando configuración de monitoreo',
                    details: error.message
                });
            }
        });

        // Obtener dashboard de monitoreo
        this.router.get('/dashboard', async (req, res) => {
            try {
                const estadisticas = this.monitoreoAlertasManager.obtenerEstadisticas();

                // Construir dashboard con datos clave
                const dashboard = {
                    estado_general: {
                        status: estadisticas.estado_general,
                        uptime: Math.floor(estadisticas.tiempo_actividad / 1000),
                        uptime_formateado: this.formatearUptime(estadisticas.tiempo_actividad),
                        ultima_verificacion: estadisticas.ultima_verificacion
                    },
                    metricas_clave: {
                        cpu: estadisticas.metricas.cpu_usage || { actual: 0 },
                        memoria: estadisticas.metricas.memory_usage || { actual: 0 },
                        disco: estadisticas.metricas.disk_usage || { actual: 0 },
                        bd_conexiones: estadisticas.metricas.database_connections || { actual: 0 },
                        bd_respuesta: estadisticas.metricas.database_response_time || { actual: 0 }
                    },
                    alertas: {
                        total_activas: estadisticas.alertas_activas?.length || 0,
                        criticas: estadisticas.alertas_activas?.filter(a => a.nivel === 'critical').length || 0,
                        warnings: estadisticas.alertas_activas?.filter(a => a.nivel === 'warning').length || 0,
                        ultima_alerta: estadisticas.ultima_alerta
                    },
                    actividad: {
                        total_verificaciones: estadisticas.total_verificaciones,
                        alertas_enviadas: estadisticas.alertas_enviadas,
                        errores_detectados: estadisticas.errores_detectados,
                        jobs_programados: estadisticas.jobs_programados
                    },
                    sistema: {
                        hostname: require('os').hostname(),
                        platform: require('os').platform(),
                        node_version: process.version,
                        pid: process.pid,
                        memoria_proceso: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
                    }
                };

                res.json({
                    success: true,
                    data: dashboard,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo dashboard:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo dashboard de monitoreo',
                    details: error.message
                });
            }
        });

        // Obtener historial de logs de monitoreo
        this.router.get('/logs/:tipo?', async (req, res) => {
            try {
                const tipo = req.params.tipo || 'monitoring';
                const { fecha, limite = 100 } = req.query;

                const tiposValidos = ['monitoring', 'alerts'];
                if (!tiposValidos.includes(tipo)) {
                    return res.status(400).json({
                        success: false,
                        error: `Tipo de log inválido. Válidos: ${tiposValidos.join(', ')}`
                    });
                }

                const logs = await this.obtenerLogsMonitoreo(tipo, fecha, parseInt(limite));

                res.json({
                    success: true,
                    tipo: tipo,
                    data: logs,
                    parametros: { fecha, limite },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo logs:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo logs de monitoreo',
                    details: error.message
                });
            }
        });

        // Forzar verificación manual del sistema
        this.router.post('/verificar', async (req, res) => {
            try {
                const { componente } = req.body;

                console.log('🔧 Verificación manual solicitada...');

                // Si se especifica un componente, verificar solo ese
                if (componente) {
                    const componentesValidos = ['cpu', 'memoria', 'disco', 'database', 'apis', 'sesiones'];
                    if (!componentesValidos.includes(componente)) {
                        return res.status(400).json({
                            success: false,
                            error: `Componente inválido. Válidos: ${componentesValidos.join(', ')}`
                        });
                    }

                    // Ejecutar verificación específica
                    let resultado;
                    switch (componente) {
                        case 'database':
                            resultado = await this.monitoreoAlertasManager.verificarBaseDatos();
                            break;
                        default:
                            resultado = { estado: 'ok', mensaje: 'Verificación no implementada para este componente' };
                    }

                    res.json({
                        success: true,
                        message: 'Verificación manual completada',
                        componente: componente,
                        resultado: resultado,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    // Verificación completa del sistema
                    await this.monitoreoAlertasManager.ejecutarMonitoreoGeneral();

                    res.json({
                        success: true,
                        message: 'Verificación manual completa del sistema ejecutada',
                        timestamp: new Date().toISOString()
                    });
                }

            } catch (error) {
                console.error('Error en verificación manual:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error ejecutando verificación manual',
                    details: error.message
                });
            }
        });

        // Resolver/cerrar alerta específica
        this.router.post('/alertas/:alertaId/resolver', async (req, res) => {
            try {
                const alertaId = req.params.alertaId;
                const { motivo = 'Resuelto manualmente' } = req.body;

                // Obtener estadísticas para acceder a alertas activas
                const estadisticas = this.monitoreoAlertasManager.obtenerEstadisticas();
                const alerta = estadisticas.alertas_activas?.find(a => a.id === alertaId);

                if (!alerta) {
                    return res.status(404).json({
                        success: false,
                        error: 'Alerta no encontrada o ya resuelta'
                    });
                }

                // Marcar alerta como resuelta
                alerta.estado = 'resuelta';
                alerta.fecha_resolucion = new Date().toISOString();
                alerta.motivo_resolucion = motivo;

                res.json({
                    success: true,
                    message: 'Alerta marcada como resuelta',
                    alerta_id: alertaId,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error resolviendo alerta:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error resolviendo alerta',
                    details: error.message
                });
            }
        });

        // Obtener reportes diarios
        this.router.get('/reportes', async (req, res) => {
            try {
                const { fecha, limite = 10 } = req.query;

                const reportes = await this.obtenerReportesDiarios(fecha, parseInt(limite));

                res.json({
                    success: true,
                    data: reportes,
                    parametros: { fecha, limite },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo reportes:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo reportes diarios',
                    details: error.message
                });
            }
        });

        // Obtener tendencias de métricas
        this.router.get('/tendencias/:metrica', async (req, res) => {
            try {
                const metrica = req.params.metrica;
                const { periodo = '24h' } = req.query;

                const estadisticas = this.monitoreoAlertasManager.obtenerEstadisticas();
                const datosMetrica = estadisticas.metricas[metrica];

                if (!datosMetrica) {
                    return res.status(404).json({
                        success: false,
                        error: `Métrica '${metrica}' no encontrada`
                    });
                }

                // Calcular tendencias basadas en histórico
                const tendencia = this.calcularTendencia(datosMetrica.historico, periodo);

                res.json({
                    success: true,
                    metrica: metrica,
                    periodo: periodo,
                    data: {
                        valor_actual: datosMetrica.actual,
                        tendencia: tendencia,
                        historico: datosMetrica.historico
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo tendencias:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo tendencias de métrica',
                    details: error.message
                });
            }
        });

        // Health check específico del sistema de monitoreo
        this.router.get('/health', async (req, res) => {
            try {
                const estadisticas = this.monitoreoAlertasManager.obtenerEstadisticas();

                const health = {
                    status: estadisticas.estado_general,
                    checks: {
                        sistema_iniciado: {
                            status: estadisticas.sistema_iniciado ? 'ok' : 'error',
                            timestamp: estadisticas.sistema_iniciado
                        },
                        verificaciones_activas: {
                            status: estadisticas.total_verificaciones > 0 ? 'ok' : 'warning',
                            total: estadisticas.total_verificaciones
                        },
                        jobs_programados: {
                            status: estadisticas.jobs_programados > 0 ? 'ok' : 'error',
                            jobs: estadisticas.jobs_programados
                        },
                        alertas_criticas: {
                            status: estadisticas.alertas_activas?.filter(a => a.nivel === 'critical').length > 0 ? 'warning' : 'ok',
                            count: estadisticas.alertas_activas?.filter(a => a.nivel === 'critical').length || 0
                        },
                        ultima_verificacion: {
                            status: estadisticas.ultima_verificacion ? 'ok' : 'warning',
                            timestamp: estadisticas.ultima_verificacion
                        }
                    },
                    metricas_clave: {
                        cpu: estadisticas.metricas.cpu_usage?.actual || 0,
                        memoria: estadisticas.metricas.memory_usage?.actual || 0,
                        bd_conexiones: estadisticas.metricas.database_connections?.actual || 0
                    },
                    uptime: Math.floor(estadisticas.tiempo_actividad / 1000)
                };

                // Determinar status general basado en checks
                const hasErrors = Object.values(health.checks).some(check => check.status === 'error');
                const hasWarnings = Object.values(health.checks).some(check => check.status === 'warning');

                if (hasErrors) {
                    health.status = 'unhealthy';
                } else if (hasWarnings) {
                    health.status = 'degraded';
                } else {
                    health.status = 'healthy';
                }

                const statusCode = health.status === 'healthy' ? 200 :
                                  health.status === 'degraded' ? 200 : 503;

                res.status(statusCode).json({
                    success: true,
                    status: health.status,
                    data: health,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error verificando salud del sistema de monitoreo:', error);
                res.status(503).json({
                    success: false,
                    status: 'unhealthy',
                    error: 'Error verificando salud del sistema de monitoreo',
                    details: error.message
                });
            }
        });

        console.log('✅ Rutas del Sistema de Monitoreo y Alertas configuradas');
        console.log('📊 Total de endpoints implementados: 12 endpoints especializados');
    }

    /**
     * Formatear tiempo de actividad
     */
    formatearUptime(milliseconds) {
        const segundos = Math.floor(milliseconds / 1000);
        const dias = Math.floor(segundos / 86400);
        const horas = Math.floor((segundos % 86400) / 3600);
        const minutos = Math.floor((segundos % 3600) / 60);

        if (dias > 0) {
            return `${dias}d ${horas}h ${minutos}m`;
        } else if (horas > 0) {
            return `${horas}h ${minutos}m`;
        } else {
            return `${minutos}m`;
        }
    }

    /**
     * Obtener logs de monitoreo
     */
    async obtenerLogsMonitoreo(tipo, fecha, limite) {
        try {
            const fechaArchivo = fecha || new Date().toISOString().split('T')[0];
            const logFile = path.join(
                __dirname, '..', '..', 'logs', tipo,
                `${tipo}_${fechaArchivo}.log`
            );

            try {
                const contenido = await fs.readFile(logFile, 'utf8');
                const lineas = contenido.trim().split('\n').filter(linea => linea.length > 0);

                const logs = lineas
                    .slice(-limite) // Últimos N logs
                    .map(linea => {
                        try {
                            return JSON.parse(linea);
                        } catch {
                            return { mensaje: linea, timestamp: new Date().toISOString() };
                        }
                    })
                    .reverse(); // Más recientes primero

                return logs;

            } catch (error) {
                if (error.code === 'ENOENT') {
                    return []; // Archivo no existe, retornar array vacío
                }
                throw error;
            }

        } catch (error) {
            throw new Error(`Error leyendo logs: ${error.message}`);
        }
    }

    /**
     * Obtener reportes diarios
     */
    async obtenerReportesDiarios(fecha, limite) {
        try {
            const reportsDir = path.join(__dirname, '..', '..', 'logs', 'monitoring');

            try {
                const archivos = await fs.readdir(reportsDir);
                const reportes = archivos
                    .filter(archivo => archivo.startsWith('reporte_diario_') && archivo.endsWith('.json'))
                    .sort()
                    .reverse() // Más recientes primero
                    .slice(0, limite);

                const resultados = [];

                for (const archivo of reportes) {
                    try {
                        const contenido = await fs.readFile(path.join(reportsDir, archivo), 'utf8');
                        const reporte = JSON.parse(contenido);
                        resultados.push(reporte);
                    } catch (error) {
                        console.error(`Error leyendo reporte ${archivo}:`, error);
                    }
                }

                return resultados;

            } catch (error) {
                if (error.code === 'ENOENT') {
                    return []; // Directorio no existe
                }
                throw error;
            }

        } catch (error) {
            throw new Error(`Error obteniendo reportes: ${error.message}`);
        }
    }

    /**
     * Calcular tendencia de métrica
     */
    calcularTendencia(historico, periodo) {
        if (!historico || historico.length < 2) {
            return { direccion: 'estable', porcentaje: 0 };
        }

        // Tomar los últimos valores según el período
        let valores = historico.slice(-10); // Últimos 10 valores para tendencia

        if (valores.length < 2) {
            return { direccion: 'estable', porcentaje: 0 };
        }

        const primerValor = valores[0].valor;
        const ultimoValor = valores[valores.length - 1].valor;
        const diferencia = ultimoValor - primerValor;
        const porcentaje = primerValor !== 0 ? (diferencia / primerValor) * 100 : 0;

        let direccion;
        if (Math.abs(porcentaje) < 5) {
            direccion = 'estable';
        } else if (porcentaje > 0) {
            direccion = 'aumentando';
        } else {
            direccion = 'disminuyendo';
        }

        return {
            direccion,
            porcentaje: Math.round(porcentaje * 100) / 100,
            valores_analizados: valores.length
        };
    }

    getRouter() {
        return this.router;
    }
}

module.exports = MonitoreoAlertasRoutes;