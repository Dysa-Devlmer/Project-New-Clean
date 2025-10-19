/**
 * DYSA Point POS v2.0.14 - Rutas de Actualizaciones Automáticas
 *
 * Sistema de rutas especializadas para la gestión de actualizaciones
 * automáticas del software en restaurantes de producción.
 *
 * Endpoints especializados para:
 * - Verificación manual y automática de actualizaciones
 * - Instalación controlada de nuevas versiones
 * - Gestión de backups y rollbacks automáticos
 * - Configuración de ventanas de mantenimiento
 * - Monitoreo del estado de actualizaciones
 * - Gestión de políticas de actualización empresarial
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;

class ActualizacionesAutomaticasRoutes {
    constructor(actualizacionesManager) {
        this.router = express.Router();
        this.actualizacionesManager = actualizacionesManager;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Rate limiting diferenciado para actualizaciones
        this.rateLimiters = {
            // Límite para operaciones críticas (instalación, rollback)
            operaciones_criticas: rateLimit({
                windowMs: 60 * 60 * 1000, // 1 hora
                max: 3, // 3 operaciones críticas por hora
                message: {
                    error: 'Demasiadas operaciones críticas',
                    limite: '3 operaciones cada hora',
                    reintentar_en: '1 hora'
                },
                standardHeaders: true,
                legacyHeaders: false
            }),

            // Límite para verificaciones
            verificaciones: rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutos
                max: 10, // 10 verificaciones por ventana
                message: {
                    error: 'Demasiadas verificaciones de actualización',
                    limite: '10 verificaciones cada 5 minutos'
                }
            }),

            // Límite para consultas generales
            consultas: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 30, // 30 consultas por minuto
                message: {
                    error: 'Demasiadas consultas de actualizaciones',
                    limite: '30 consultas por minuto'
                }
            })
        };

        // Middleware de validación de parámetros
        this.router.use((req, res, next) => {
            // Logging de requests de actualizaciones
            console.log(`🔄 ActualizacionesAutomaticas API: ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Endpoint: Verificar actualizaciones disponibles
        this.router.post('/verificar', this.rateLimiters.verificaciones, async (req, res) => {
            try {
                console.log('🔍 Verificación manual de actualizaciones solicitada...');

                const startTime = Date.now();
                const actualizacion = await this.actualizacionesManager.forzarVerificacion();

                const tiempoVerificacion = Date.now() - startTime;

                if (actualizacion) {
                    res.json({
                        success: true,
                        actualizacion_disponible: true,
                        actualizacion: {
                            version: actualizacion.version,
                            changelog: actualizacion.changelog,
                            compatibilidad: actualizacion.compatibilidad,
                            fecha_disponible: actualizacion.fecha_disponible
                        },
                        tiempo_verificacion_ms: tiempoVerificacion,
                        mensaje: `Nueva versión ${actualizacion.version} disponible`,
                        timestamp: new Date().toISOString()
                    });
                } else {
                    res.json({
                        success: true,
                        actualizacion_disponible: false,
                        mensaje: 'Sistema actualizado a la última versión',
                        tiempo_verificacion_ms: tiempoVerificacion,
                        timestamp: new Date().toISOString()
                    });
                }

                console.log(`✅ Verificación completada en ${tiempoVerificacion}ms`);

            } catch (error) {
                console.error('❌ Error verificando actualizaciones:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error verificando actualizaciones',
                    mensaje: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Endpoint: Instalar actualización específica
        this.router.post('/instalar/:version', this.rateLimiters.operaciones_criticas, async (req, res) => {
            try {
                const { version } = req.params;
                const { forzar = false } = req.body;

                console.log(`🔄 Instalación manual de versión ${version} solicitada...`);

                // Validar formato de versión
                if (!this.validarVersionSemver(version)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Formato de versión inválido',
                        version_solicitada: version,
                        formato_esperado: 'x.y.z (semver)'
                    });
                }

                // Verificar que no estemos ya instalando
                const estado = await this.actualizacionesManager.obtenerEstadoCompleto();
                if (estado.instalando) {
                    return res.status(409).json({
                        success: false,
                        error: 'Instalación ya en progreso',
                        estado_actual: 'instalando'
                    });
                }

                // Verificar ventana de mantenimiento si no se fuerza
                if (!forzar && !estado.en_ventana_mantenimiento) {
                    return res.status(423).json({
                        success: false,
                        error: 'Fuera de ventana de mantenimiento',
                        ventana_mantenimiento: this.actualizacionesManager.configuracion.ventana_mantenimiento,
                        usar_forzar: 'Agregar {"forzar": true} al body para instalar fuera de ventana'
                    });
                }

                // Ejecutar instalación en background
                this.ejecutarInstalacionEnBackground(version, res);

            } catch (error) {
                console.error('❌ Error iniciando instalación:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error iniciando instalación',
                    mensaje: error.message
                });
            }
        });

        // Endpoint: Obtener estado completo del sistema de actualizaciones
        this.router.get('/estado', this.rateLimiters.consultas, async (req, res) => {
            try {
                const estado = await this.actualizacionesManager.obtenerEstadoCompleto();

                res.json({
                    success: true,
                    estado: {
                        version_actual: estado.version_actual,
                        version_disponible: estado.version_disponible,
                        verificando: estado.verificando,
                        descargando: estado.descargando,
                        instalando: estado.instalando,
                        ultima_verificacion: estado.ultima_verificacion,
                        proxima_verificacion: estado.proxima_verificacion,
                        actualizaciones_pendientes: estado.actualizaciones_pendientes.length,
                        rollback_disponible: estado.rollback_disponible,
                        en_ventana_mantenimiento: estado.en_ventana_mantenimiento,
                        espacio_disco_mb: estado.espacio_disco_mb
                    },
                    configuracion: {
                        verificar_cada_horas: estado.configuracion.verificar_cada_horas,
                        auto_instalar: estado.configuracion.auto_instalar,
                        ventana_mantenimiento: estado.configuracion.ventana_mantenimiento
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error obteniendo estado:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo estado de actualizaciones'
                });
            }
        });

        // Endpoint: Listar actualizaciones pendientes
        this.router.get('/pendientes', this.rateLimiters.consultas, async (req, res) => {
            try {
                const estado = await this.actualizacionesManager.obtenerEstadoCompleto();

                const actualizacionesPendientes = estado.actualizaciones_pendientes.map(act => ({
                    version: act.version,
                    fecha_disponible: act.fecha_disponible,
                    instalada: act.instalada,
                    changelog: act.changelog ? act.changelog.substring(0, 200) + '...' : null,
                    compatibilidad: act.compatibilidad
                }));

                res.json({
                    success: true,
                    actualizaciones_pendientes: actualizacionesPendientes,
                    total: actualizacionesPendientes.length,
                    pendientes_instalacion: actualizacionesPendientes.filter(a => !a.instalada).length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error listando actualizaciones pendientes:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo actualizaciones pendientes'
                });
            }
        });

        // Endpoint: Ejecutar rollback manual
        this.router.post('/rollback', this.rateLimiters.operaciones_criticas, async (req, res) => {
            try {
                console.log('🔄 Rollback manual solicitado...');

                const estado = await this.actualizacionesManager.obtenerEstadoCompleto();

                if (!estado.rollback_disponible) {
                    return res.status(404).json({
                        success: false,
                        error: 'No hay backup disponible para rollback',
                        mensaje: 'Ejecute una actualización primero para generar backup'
                    });
                }

                if (estado.instalando) {
                    return res.status(409).json({
                        success: false,
                        error: 'No se puede ejecutar rollback durante instalación',
                        estado_actual: 'instalando'
                    });
                }

                // Ejecutar rollback en background
                this.ejecutarRollbackEnBackground(res);

            } catch (error) {
                console.error('❌ Error iniciando rollback:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error iniciando rollback',
                    mensaje: error.message
                });
            }
        });

        // Endpoint: Obtener configuración actual
        this.router.get('/configuracion', this.rateLimiters.consultas, async (req, res) => {
            try {
                const configuracion = this.actualizacionesManager.configuracion;

                res.json({
                    success: true,
                    configuracion: {
                        servidor_actualizaciones: configuracion.servidor_actualizaciones,
                        verificar_cada_horas: configuracion.verificar_cada_horas,
                        ventana_mantenimiento: configuracion.ventana_mantenimiento,
                        auto_instalar: configuracion.auto_instalar,
                        backup_antes_actualizar: configuracion.backup_antes_actualizar,
                        rollback_automatico: configuracion.rollback_automatico,
                        tiempo_espera_rollback: configuracion.tiempo_espera_rollback,
                        verificar_integridad: configuracion.verificar_integridad,
                        notificar_actualizaciones: configuracion.notificar_actualizaciones,
                        modo_silencioso: configuracion.modo_silencioso
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error obteniendo configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo configuración de actualizaciones'
                });
            }
        });

        // Endpoint: Actualizar configuración
        this.router.put('/configuracion', this.rateLimiters.consultas, async (req, res) => {
            try {
                const {
                    verificar_cada_horas,
                    ventana_mantenimiento,
                    auto_instalar,
                    backup_antes_actualizar,
                    rollback_automatico,
                    tiempo_espera_rollback,
                    verificar_integridad,
                    notificar_actualizaciones,
                    modo_silencioso
                } = req.body;

                const nuevaConfiguracion = {};

                // Validar y aplicar cambios
                if (typeof verificar_cada_horas === 'number' && verificar_cada_horas >= 1 && verificar_cada_horas <= 168) {
                    nuevaConfiguracion.verificar_cada_horas = verificar_cada_horas;
                } else if (verificar_cada_horas !== undefined) {
                    return res.status(400).json({
                        success: false,
                        error: 'verificar_cada_horas debe ser un número entre 1 y 168'
                    });
                }

                if (ventana_mantenimiento && typeof ventana_mantenimiento === 'object') {
                    if (this.validarVentanaMantenimiento(ventana_mantenimiento)) {
                        nuevaConfiguracion.ventana_mantenimiento = ventana_mantenimiento;
                    } else {
                        return res.status(400).json({
                            success: false,
                            error: 'Ventana de mantenimiento inválida',
                            formato_esperado: {
                                inicio: 'HH:MM',
                                fin: 'HH:MM',
                                zona_horaria: 'America/Santiago'
                            }
                        });
                    }
                }

                // Aplicar configuraciones boolean
                const configsBoolean = {
                    auto_instalar,
                    backup_antes_actualizar,
                    rollback_automatico,
                    verificar_integridad,
                    notificar_actualizaciones,
                    modo_silencioso
                };

                Object.entries(configsBoolean).forEach(([key, value]) => {
                    if (typeof value === 'boolean') {
                        nuevaConfiguracion[key] = value;
                    }
                });

                if (typeof tiempo_espera_rollback === 'number' && tiempo_espera_rollback >= 60 && tiempo_espera_rollback <= 3600) {
                    nuevaConfiguracion.tiempo_espera_rollback = tiempo_espera_rollback;
                } else if (tiempo_espera_rollback !== undefined) {
                    return res.status(400).json({
                        success: false,
                        error: 'tiempo_espera_rollback debe ser un número entre 60 y 3600 segundos'
                    });
                }

                // Aplicar configuración
                await this.actualizacionesManager.actualizarConfiguracion(nuevaConfiguracion);

                res.json({
                    success: true,
                    mensaje: 'Configuración actualizada exitosamente',
                    configuracion_aplicada: nuevaConfiguracion,
                    timestamp: new Date().toISOString()
                });

                console.log('⚙️ Configuración de actualizaciones actualizada');

            } catch (error) {
                console.error('❌ Error actualizando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando configuración de actualizaciones'
                });
            }
        });

        // Endpoint: Obtener changelog de versión específica
        this.router.get('/changelog/:version', this.rateLimiters.consultas, async (req, res) => {
            try {
                const { version } = req.params;

                if (!this.validarVersionSemver(version)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Formato de versión inválido'
                    });
                }

                const estado = await this.actualizacionesManager.obtenerEstadoCompleto();
                const actualizacion = estado.actualizaciones_pendientes.find(a => a.version === version);

                if (!actualizacion) {
                    return res.status(404).json({
                        success: false,
                        error: 'Versión no encontrada en actualizaciones pendientes',
                        version_solicitada: version
                    });
                }

                res.json({
                    success: true,
                    version,
                    changelog: actualizacion.changelog,
                    fecha_disponible: actualizacion.fecha_disponible,
                    compatibilidad: actualizacion.compatibilidad,
                    instalada: actualizacion.instalada
                });

            } catch (error) {
                console.error('❌ Error obteniendo changelog:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo changelog'
                });
            }
        });

        // Endpoint: Obtener historial de actualizaciones
        this.router.get('/historial', this.rateLimiters.consultas, async (req, res) => {
            try {
                const { limit = 10 } = req.query;

                // Simular historial basado en actualizaciones pendientes instaladas
                const estado = await this.actualizacionesManager.obtenerEstadoCompleto();
                const historial = estado.actualizaciones_pendientes
                    .filter(a => a.instalada)
                    .sort((a, b) => new Date(b.fecha_disponible) - new Date(a.fecha_disponible))
                    .slice(0, parseInt(limit))
                    .map(act => ({
                        version: act.version,
                        fecha_instalacion: act.fecha_disponible,
                        changelog_resumen: act.changelog ? act.changelog.substring(0, 100) + '...' : null
                    }));

                res.json({
                    success: true,
                    historial_actualizaciones: historial,
                    version_actual: estado.version_actual,
                    total_mostradas: historial.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error obteniendo historial:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo historial de actualizaciones'
                });
            }
        });

        // Endpoint: Programar actualización para ventana específica
        this.router.post('/programar', this.rateLimiters.consultas, async (req, res) => {
            try {
                const { version, fecha_programada } = req.body;

                if (!this.validarVersionSemver(version)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Formato de versión inválido'
                    });
                }

                const fechaProgramada = new Date(fecha_programada);
                if (isNaN(fechaProgramada.getTime()) || fechaProgramada <= new Date()) {
                    return res.status(400).json({
                        success: false,
                        error: 'Fecha programada inválida o en el pasado'
                    });
                }

                // Esta funcionalidad se implementaría completamente en una versión posterior
                res.json({
                    success: true,
                    mensaje: 'Actualización programada (funcionalidad en desarrollo)',
                    version,
                    fecha_programada: fechaProgramada,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error programando actualización:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error programando actualización'
                });
            }
        });

        // Endpoint: Health check del sistema de actualizaciones
        this.router.get('/health', this.rateLimiters.consultas, async (req, res) => {
            try {
                const health = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: '2.0.14'
                };

                // Verificar servicios críticos
                const checks = {
                    actualizaciones_manager: !!this.actualizacionesManager,
                    directorio_updates: false,
                    directorio_backups: false,
                    configuracion_cargada: !!this.actualizacionesManager.configuracion,
                    jobs_programados: false
                };

                // Verificar directorios
                try {
                    await fs.access(this.actualizacionesManager.updatePath);
                    checks.directorio_updates = true;
                } catch (error) {
                    health.status = 'degraded';
                }

                try {
                    await fs.access(this.actualizacionesManager.backupPath);
                    checks.directorio_backups = true;
                } catch (error) {
                    health.status = 'degraded';
                }

                // Verificar jobs programados
                checks.jobs_programados = this.actualizacionesManager.cronJobs.size > 0;

                // Verificar dependencias críticas
                const dependencias = {
                    semver: false,
                    yauzl: false,
                    archiver: false,
                    node_cron: false
                };

                try {
                    require('semver');
                    dependencias.semver = true;
                } catch (error) {
                    health.status = 'unhealthy';
                }

                try {
                    require('yauzl');
                    dependencias.yauzl = true;
                } catch (error) {
                    health.status = 'degraded';
                }

                try {
                    require('archiver');
                    dependencias.archiver = true;
                } catch (error) {
                    health.status = 'degraded';
                }

                try {
                    require('node-cron');
                    dependencias.node_cron = true;
                } catch (error) {
                    health.status = 'unhealthy';
                }

                // Determinar estado final
                const checksPassed = Object.values(checks).filter(Boolean).length;
                const totalChecks = Object.values(checks).length;
                const dependenciasPassed = Object.values(dependencias).filter(Boolean).length;
                const totalDependencias = Object.values(dependencias).length;

                if (checksPassed < totalChecks * 0.5 || dependenciasPassed < totalDependencias * 0.5) {
                    health.status = 'unhealthy';
                } else if (checksPassed < totalChecks || dependenciasPassed < totalDependencias) {
                    health.status = 'degraded';
                }

                health.checks = checks;
                health.dependencias = dependencias;
                health.score = {
                    checks: `${checksPassed}/${totalChecks}`,
                    dependencias: `${dependenciasPassed}/${totalDependencias}`,
                    porcentaje_salud: Math.round((checksPassed + dependenciasPassed) / (totalChecks + totalDependencias) * 100)
                };

                const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
                res.status(statusCode).json({
                    success: health.status !== 'unhealthy',
                    health
                });

            } catch (error) {
                console.error('❌ Error en health check:', error);
                res.status(503).json({
                    success: false,
                    health: {
                        status: 'unhealthy',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });
    }

    // Métodos auxiliares
    validarVersionSemver(version) {
        try {
            const semver = require('semver');
            return semver.valid(version) !== null;
        } catch (error) {
            return false;
        }
    }

    validarVentanaMantenimiento(ventana) {
        if (!ventana.inicio || !ventana.fin) return false;

        const regexHora = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regexHora.test(ventana.inicio) && regexHora.test(ventana.fin);
    }

    async ejecutarInstalacionEnBackground(version, res) {
        // Responder inmediatamente
        res.json({
            success: true,
            mensaje: 'Instalación iniciada en background',
            version,
            estado: 'iniciando',
            timestamp: new Date().toISOString()
        });

        try {
            // Ejecutar instalación en background
            await this.actualizacionesManager.instalarActualizacionManual(version);
            console.log(`✅ Instalación de ${version} completada exitosamente`);
        } catch (error) {
            console.error(`❌ Error en instalación de ${version}:`, error);
        }
    }

    async ejecutarRollbackEnBackground(res) {
        // Responder inmediatamente
        res.json({
            success: true,
            mensaje: 'Rollback iniciado en background',
            estado: 'iniciando',
            timestamp: new Date().toISOString()
        });

        try {
            // Ejecutar rollback en background
            const resultado = await this.actualizacionesManager.ejecutarRollback();
            if (resultado) {
                console.log('✅ Rollback completado exitosamente');
            } else {
                console.error('❌ Rollback falló');
            }
        } catch (error) {
            console.error('❌ Error en rollback:', error);
        }
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ActualizacionesAutomaticasRoutes;