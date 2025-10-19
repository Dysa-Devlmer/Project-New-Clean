/**
 * ⚡ DYSA Point - Routes del Sistema de Optimización para Alto Volumen
 *
 * Endpoints empresariales especializados para gestión de rendimiento
 * y optimización de restaurantes de alto volumen (500+ órdenes/día)
 *
 * @autor DYSA Point Development Team
 * @version 2.0.14
 * @target Restaurantes de alto volumen con múltiples terminales
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const cluster = require('cluster');

class OptimizacionAltoVolumenRoutes {
    constructor(optimizacionManager, database) {
        this.optimizacionManager = optimizacionManager;
        this.database = database;
        this.router = express.Router();

        // Rate limiting ultra-especializado para alto volumen
        this.rateLimiters = {
            consultas_criticas: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 200, // 200 requests por minuto para consultas críticas
                message: 'Límite de consultas críticas excedido',
                standardHeaders: true,
                legacyHeaders: false,
                keyGenerator: (req) => `${req.ip}:${req.user?.id || 'anonymous'}`
            }),
            operaciones_escritura: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 500, // 500 operaciones de escritura por minuto
                message: 'Límite de operaciones de escritura excedido',
                standardHeaders: true,
                legacyHeaders: false
            }),
            metricas_performance: rateLimit({
                windowMs: 30 * 1000, // 30 segundos
                max: 60, // 60 requests cada 30 segundos
                message: 'Límite de consultas de métricas excedido',
                standardHeaders: true,
                legacyHeaders: false
            }),
            administracion: rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutos
                max: 50, // 50 operaciones administrativas cada 5 minutos
                message: 'Límite de operaciones administrativas excedido',
                standardHeaders: true,
                legacyHeaders: false
            })
        };

        this.setupRoutes();
        console.log('⚡ OptimizacionAltoVolumenRoutes configuradas correctamente');
    }

    setupRoutes() {
        // ==================== ENDPOINTS DE MONITOREO ====================

        /**
         * GET /api/performance/health
         * Health check ultra-rápido del sistema optimizado
         */
        this.router.get('/health', async (req, res) => {
            try {
                const estado = this.optimizacionManager.obtenerEstadisticas();
                const isHealthy = estado.inicializado &&
                                 estado.performance_metrics.memory_usage_mb < 2048 &&
                                 estado.performance_metrics.cache_hit_ratio > 0.7;

                res.json({
                    success: true,
                    healthy: isHealthy,
                    performance: {
                        memory_mb: estado.performance_metrics.memory_usage_mb.toFixed(2),
                        cache_hit_ratio: estado.performance_metrics.cache_hit_ratio.toFixed(3),
                        active_connections: estado.pool_stats.active,
                        workers_active: estado.worker_stats.active_workers
                    },
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
         * GET /api/performance/metricas
         * Métricas detalladas de performance en tiempo real
         */
        this.router.get('/metricas', this.rateLimiters.metricas_performance, async (req, res) => {
            try {
                const estadisticas = this.optimizacionManager.obtenerEstadisticas();

                res.json({
                    success: true,
                    data: {
                        performance_metrics: estadisticas.performance_metrics,
                        pool_stats: estadisticas.pool_stats,
                        cache_stats: {
                            ...estadisticas.cache_stats,
                            hit_ratio: estadisticas.cache_stats.hits / Math.max(estadisticas.cache_stats.hits + estadisticas.cache_stats.misses, 1),
                            memory_usage_mb: (estadisticas.cache_stats.memory_usage || 0) / 1024 / 1024
                        },
                        worker_stats: estadisticas.worker_stats,
                        circuit_breakers: estadisticas.circuit_breakers,
                        system_info: {
                            cache_entries: estadisticas.cache_size,
                            prepared_queries: estadisticas.prepared_queries,
                            uptime_seconds: process.uptime(),
                            node_version: process.version
                        }
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo métricas performance:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/performance/estadisticas-completas
         * Estadísticas completas del sistema incluyendo histórico
         */
        this.router.get('/estadisticas-completas', this.rateLimiters.consultas_criticas, async (req, res) => {
            try {
                const estadisticas = this.optimizacionManager.obtenerEstadisticas();

                // Obtener métricas adicionales del sistema
                const memoryUsage = process.memoryUsage();
                const cpuUsage = process.cpuUsage();

                res.json({
                    success: true,
                    data: {
                        sistema: {
                            version: '2.0.14',
                            modo: 'alto_volumen',
                            inicializado: estadisticas.inicializado,
                            uptime_segundos: process.uptime(),
                            workers_disponibles: require('os').cpus().length
                        },
                        memoria: {
                            heap_usado_mb: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
                            heap_total_mb: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
                            rss_mb: (memoryUsage.rss / 1024 / 1024).toFixed(2),
                            external_mb: (memoryUsage.external / 1024 / 1024).toFixed(2),
                            limite_configurado_mb: estadisticas.configuracion.memory_threshold_mb
                        },
                        base_datos: {
                            conexiones_activas: estadisticas.pool_stats.active,
                            conexiones_idle: estadisticas.pool_stats.idle,
                            total_queries: estadisticas.pool_stats.total_acquired,
                            errores_conexion: estadisticas.pool_stats.errors,
                            timeouts: estadisticas.pool_stats.timeouts,
                            pool_size_max: estadisticas.configuracion.pool_size_max
                        },
                        cache: {
                            entradas_totales: estadisticas.cache_size,
                            hits: estadisticas.cache_stats.hits,
                            misses: estadisticas.cache_stats.misses,
                            hit_ratio: (estadisticas.cache_stats.hits / Math.max(estadisticas.cache_stats.hits + estadisticas.cache_stats.misses, 1)).toFixed(3),
                            evictions: estadisticas.cache_stats.evictions,
                            memoria_configurada_mb: estadisticas.configuracion.cache_max_memory_mb
                        },
                        workers: {
                            activos: estadisticas.worker_stats.active_workers,
                            configurados: estadisticas.configuracion.workers_count,
                            total_requests: estadisticas.worker_stats.total_requests,
                            failed_requests: estadisticas.worker_stats.failed_requests,
                            reiniciados: estadisticas.worker_stats.restarted_workers,
                            habilitados: estadisticas.configuracion.workers_enabled
                        },
                        circuit_breakers: estadisticas.circuit_breakers,
                        performance: estadisticas.performance_metrics
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo estadísticas completas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE CACHE ====================

        /**
         * GET /api/performance/cache/estado
         * Estado detallado del sistema de cache
         */
        this.router.get('/cache/estado', this.rateLimiters.metricas_performance, async (req, res) => {
            try {
                const estadisticas = this.optimizacionManager.obtenerEstadisticas();
                const cacheStats = estadisticas.cache_stats;

                res.json({
                    success: true,
                    data: {
                        estado: 'activo',
                        configuracion: {
                            habilitado: estadisticas.configuracion.cache_enabled,
                            ttl_segundos: estadisticas.configuracion.cache_ttl_seconds,
                            memoria_max_mb: estadisticas.configuracion.cache_max_memory_mb,
                            compresion: estadisticas.configuracion.cache_compression
                        },
                        metricas: {
                            entradas_totales: estadisticas.cache_size,
                            hits: cacheStats.hits,
                            misses: cacheStats.misses,
                            sets: cacheStats.sets,
                            deletes: cacheStats.deletes,
                            evictions: cacheStats.evictions,
                            hit_ratio: (cacheStats.hits / Math.max(cacheStats.hits + cacheStats.misses, 1)).toFixed(4),
                            memoria_estimada_mb: (cacheStats.memory_usage / 1024 / 1024).toFixed(2)
                        },
                        rendimiento: {
                            operaciones_por_segundo: Math.round((cacheStats.hits + cacheStats.misses) / process.uptime()),
                            eficiencia: cacheStats.hits > 0 ? 'alta' : 'baja'
                        }
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo estado cache:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * DELETE /api/performance/cache/limpiar
         * Limpiar cache manualmente (operación administrativa)
         */
        this.router.delete('/cache/limpiar', this.rateLimiters.administracion, async (req, res) => {
            try {
                const tipo = req.query.tipo || 'expirados';

                switch (tipo) {
                    case 'expirados':
                        await this.optimizacionManager.limpiarCache();
                        break;
                    case 'todo':
                        await this.optimizacionManager.cache.clear();
                        break;
                    case 'compactar':
                        await this.optimizacionManager.compactarCache();
                        break;
                    default:
                        return res.status(400).json({
                            success: false,
                            error: 'Tipo de limpieza inválido. Use: expirados, todo, compactar'
                        });
                }

                res.json({
                    success: true,
                    message: `Cache ${tipo} limpiado exitosamente`,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error limpiando cache:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE QUERIES OPTIMIZADAS ====================

        /**
         * GET /api/performance/queries/mesas-rapido
         * Consulta ultra-optimizada de estado de mesas
         */
        this.router.get('/queries/mesas-rapido', this.rateLimiters.consultas_criticas, async (req, res) => {
            try {
                // Intentar obtener del cache primero
                const cacheKey = 'mesas_rapido';
                let mesas = await this.optimizacionManager.obtenerDeCache(cacheKey);

                if (!mesas) {
                    // Ejecutar query optimizada
                    const [result] = await this.optimizacionManager.ejecutarQueryOptimizada('listar_mesas_rapido');
                    mesas = result;

                    // Guardar en cache por 30 segundos
                    await this.optimizacionManager.guardarEnCache(cacheKey, mesas, 30000);
                }

                res.json({
                    success: true,
                    data: mesas,
                    cache_hit: mesas._fromCache || false,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error en consulta mesas rápido:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/performance/queries/metricas-tiempo-real
         * Métricas de negocio en tiempo real ultra-optimizadas
         */
        this.router.get('/queries/metricas-tiempo-real', this.rateLimiters.metricas_performance, async (req, res) => {
            try {
                const cacheKey = 'metricas_tiempo_real';
                let metricas = await this.optimizacionManager.obtenerDeCache(cacheKey);

                if (!metricas) {
                    const [result] = await this.optimizacionManager.ejecutarQueryOptimizada('metricas_tiempo_real');
                    metricas = result[0];

                    // Cache por 15 segundos para métricas tiempo real
                    await this.optimizacionManager.guardarEnCache(cacheKey, metricas, 15000);
                }

                res.json({
                    success: true,
                    data: {
                        ventas_hoy: parseInt(metricas.ventas_hoy) || 0,
                        ordenes_activas: parseInt(metricas.ordenes_activas) || 0,
                        mesas_ocupadas: parseInt(metricas.mesas_ocupadas) || 0,
                        tiempo_promedio_minutos: parseFloat(metricas.tiempo_promedio_minutos) || 0,
                        ingresos_hoy: parseFloat(metricas.ingresos_hoy) || 0
                    },
                    cache_hit: metricas._fromCache || false,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error en métricas tiempo real:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/performance/queries/productos-activos
         * Lista optimizada de productos disponibles
         */
        this.router.get('/queries/productos-activos', this.rateLimiters.consultas_criticas, async (req, res) => {
            try {
                const cacheKey = 'productos_activos';
                let productos = await this.optimizacionManager.obtenerDeCache(cacheKey);

                if (!productos) {
                    const [result] = await this.optimizacionManager.ejecutarQueryOptimizada('obtener_productos_activos');
                    productos = result;

                    // Cache por 2 minutos
                    await this.optimizacionManager.guardarEnCache(cacheKey, productos, 120000);
                }

                res.json({
                    success: true,
                    data: productos,
                    total: productos.length,
                    cache_hit: productos._fromCache || false,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo productos activos:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE OPERACIONES CRÍTICAS ====================

        /**
         * POST /api/performance/venta/crear-optimizada
         * Crear venta con optimizaciones de alto volumen
         */
        this.router.post('/venta/crear-optimizada', this.rateLimiters.operaciones_escritura, async (req, res) => {
            try {
                const { num_mesa, usuario_id } = req.body;

                if (!num_mesa) {
                    return res.status(400).json({
                        success: false,
                        error: 'Número de mesa requerido'
                    });
                }

                // Verificar mesa disponible usando query optimizada
                const [estadoMesa] = await this.optimizacionManager.ejecutarQueryOptimizada('obtener_mesa_estado', [num_mesa]);

                if (estadoMesa.length > 0 && estadoMesa[0].venta_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'Mesa ya tiene una venta activa',
                        venta_activa: estadoMesa[0].venta_id
                    });
                }

                // Crear venta con query optimizada
                const [result] = await this.optimizacionManager.ejecutarQueryOptimizada('crear_venta_optimizada', [
                    num_mesa,
                    usuario_id || null
                ]);

                const ventaId = result.insertId;

                // Invalidar cache relacionado
                await this.optimizacionManager.cache.delete('mesas_rapido');
                await this.optimizacionManager.cache.delete('metricas_tiempo_real');

                res.status(201).json({
                    success: true,
                    data: {
                        id_venta: ventaId,
                        num_mesa: num_mesa,
                        estado: 'activa',
                        fecha_creacion: new Date().toISOString()
                    },
                    message: 'Venta creada exitosamente'
                });

            } catch (error) {
                console.error('Error creando venta optimizada:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * POST /api/performance/venta/agregar-item
         * Agregar ítem a venta con optimizaciones
         */
        this.router.post('/venta/agregar-item', this.rateLimiters.operaciones_escritura, async (req, res) => {
            try {
                const { id_venta, id_producto, cantidad, precio_unitario, observaciones } = req.body;

                if (!id_venta || !id_producto || !cantidad || !precio_unitario) {
                    return res.status(400).json({
                        success: false,
                        error: 'Campos requeridos: id_venta, id_producto, cantidad, precio_unitario'
                    });
                }

                // Agregar ítem con query optimizada
                await this.optimizacionManager.ejecutarQueryOptimizada('agregar_item_venta', [
                    id_venta,
                    id_producto,
                    cantidad,
                    precio_unitario,
                    observaciones || null
                ]);

                // Actualizar total de venta
                await this.optimizacionManager.ejecutarQueryOptimizada('actualizar_total_venta', [id_venta]);

                // Invalidar caches
                await this.optimizacionManager.cache.delete('mesas_rapido');
                await this.optimizacionManager.cache.delete('metricas_tiempo_real');
                await this.optimizacionManager.cache.delete(`venta_${id_venta}`);

                res.status(201).json({
                    success: true,
                    message: 'Ítem agregado exitosamente',
                    data: {
                        id_venta,
                        id_producto,
                        cantidad,
                        precio_unitario
                    }
                });

            } catch (error) {
                console.error('Error agregando ítem:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * POST /api/performance/venta/cerrar-rapida
         * Cerrar venta con proceso ultra-optimizado
         */
        this.router.post('/venta/cerrar-rapida', this.rateLimiters.operaciones_escritura, async (req, res) => {
            try {
                const { id_venta } = req.body;

                if (!id_venta) {
                    return res.status(400).json({
                        success: false,
                        error: 'ID de venta requerido'
                    });
                }

                // Cerrar venta con query optimizada
                const [result] = await this.optimizacionManager.ejecutarQueryOptimizada('cerrar_venta_rapida', [id_venta]);

                if (result.affectedRows === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Venta no encontrada o ya cerrada'
                    });
                }

                // Invalidar caches críticos
                await this.optimizacionManager.cache.delete('mesas_rapido');
                await this.optimizacionManager.cache.delete('metricas_tiempo_real');
                await this.optimizacionManager.cache.delete(`venta_${id_venta}`);

                res.json({
                    success: true,
                    message: 'Venta cerrada exitosamente',
                    data: {
                        id_venta,
                        fecha_cierre: new Date().toISOString(),
                        estado: 'cerrada'
                    }
                });

            } catch (error) {
                console.error('Error cerrando venta:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE ADMINISTRACIÓN ====================

        /**
         * GET /api/performance/configuracion
         * Obtener configuración del sistema de optimización
         */
        this.router.get('/configuracion', this.rateLimiters.administracion, async (req, res) => {
            try {
                const estadisticas = this.optimizacionManager.obtenerEstadisticas();

                res.json({
                    success: true,
                    data: {
                        configuracion_actual: estadisticas.configuracion,
                        limites_sistema: {
                            max_workers: require('os').cpus().length,
                            memoria_total_mb: require('os').totalmem() / 1024 / 1024,
                            memoria_libre_mb: require('os').freemem() / 1024 / 1024
                        },
                        estado_inicializacion: {
                            inicializado: estadisticas.inicializado,
                            pool_conexiones: estadisticas.pool_stats.active >= 0,
                            cache_activo: estadisticas.cache_size >= 0,
                            workers_activos: estadisticas.worker_stats.active_workers > 0
                        }
                    },
                    timestamp: new Date().toISOString()
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
         * PUT /api/performance/configuracion
         * Actualizar configuración de optimización (operación crítica)
         */
        this.router.put('/configuracion', this.rateLimiters.administracion, async (req, res) => {
            try {
                const nuevaConfig = req.body;

                // Campos permitidos para actualización en caliente
                const camposPermitidos = [
                    'cache_ttl_seconds',
                    'cache_max_memory_mb',
                    'query_timeout_ms',
                    'performance_alerts',
                    'slow_query_threshold_ms',
                    'gc_interval_minutes',
                    'memory_threshold_mb'
                ];

                const configValida = {};
                for (const [campo, valor] of Object.entries(nuevaConfig)) {
                    if (camposPermitidos.includes(campo)) {
                        configValida[campo] = valor;
                    }
                }

                if (Object.keys(configValida).length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'No se proporcionaron campos válidos para actualizar',
                        campos_permitidos: camposPermitidos
                    });
                }

                // Actualizar configuración
                Object.assign(this.optimizacionManager.configuracion, configValida);

                res.json({
                    success: true,
                    message: 'Configuración actualizada exitosamente',
                    data: {
                        campos_actualizados: Object.keys(configValida),
                        configuracion_nueva: configValida
                    },
                    advertencia: 'Algunos cambios requieren reinicio del sistema para tomar efecto completo'
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

        /**
         * POST /api/performance/gc/forzar
         * Forzar garbage collection (operación administrativa crítica)
         */
        this.router.post('/gc/forzar', this.rateLimiters.administracion, async (req, res) => {
            try {
                if (!global.gc) {
                    return res.status(503).json({
                        success: false,
                        error: 'Garbage collection no disponible. Inicie Node.js con --expose-gc'
                    });
                }

                const memoriaAntes = process.memoryUsage();

                // Ejecutar GC
                global.gc();

                const memoriaDespues = process.memoryUsage();
                const memoriaLiberada = (memoriaAntes.heapUsed - memoriaDespues.heapUsed) / 1024 / 1024;

                res.json({
                    success: true,
                    message: 'Garbage collection ejecutado exitosamente',
                    data: {
                        memoria_antes_mb: (memoriaAntes.heapUsed / 1024 / 1024).toFixed(2),
                        memoria_despues_mb: (memoriaDespues.heapUsed / 1024 / 1024).toFixed(2),
                        memoria_liberada_mb: memoriaLiberada.toFixed(2)
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error ejecutando GC:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });

        /**
         * GET /api/performance/circuit-breakers
         * Estado de todos los circuit breakers
         */
        this.router.get('/circuit-breakers', this.rateLimiters.metricas_performance, async (req, res) => {
            try {
                const estadisticas = this.optimizacionManager.obtenerEstadisticas();

                res.json({
                    success: true,
                    data: estadisticas.circuit_breakers,
                    resumen: {
                        total: Object.keys(estadisticas.circuit_breakers).length,
                        abiertos: Object.values(estadisticas.circuit_breakers).filter(cb => cb.state === 'OPEN').length,
                        cerrados: Object.values(estadisticas.circuit_breakers).filter(cb => cb.state === 'CLOSED').length,
                        semi_abiertos: Object.values(estadisticas.circuit_breakers).filter(cb => cb.state === 'HALF_OPEN').length
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo circuit breakers:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    message: error.message
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = OptimizacionAltoVolumenRoutes;