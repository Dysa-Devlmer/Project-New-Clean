/**
 * DYSA Point - Rutas del Sistema de Mapa Visual de Mesas
 * API REST para gestión visual avanzada del salón
 *
 * Funcionalidad Crítica #5 - FINAL: Sistema de Mapeo Visual Completo
 * Compatible con restaurantes de alto volumen y múltiples salones
 *
 * @author DYSA Point Development Team
 * @version 2.0.14
 * @date 2025-10-13
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

class MapaVisualMesasRoutes {
    constructor(mapaVisualManager, database) {
        this.mapaVisualManager = mapaVisualManager;
        this.database = database;
        this.router = express.Router();
        this.setupRateLimit();
        this.setupRoutes();
    }

    setupRateLimit() {
        // Rate limiting empresarial para proteger el sistema
        this.rateLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minuto
            max: 200, // 200 requests por minuto para operaciones visuales
            message: {
                success: false,
                error: 'Demasiadas solicitudes al mapa visual. Intente en unos momentos.',
                code: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        // Rate limiting específico para actualizaciones
        this.updateRateLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minuto
            max: 100, // 100 actualizaciones por minuto
            message: {
                success: false,
                error: 'Demasiadas actualizaciones del mapa. Limite: 100 por minuto.',
                code: 'UPDATE_RATE_LIMIT_EXCEEDED'
            }
        });

        this.router.use(this.rateLimiter);
    }

    setupRoutes() {
        // ==================== ENDPOINTS DE VISUALIZACIÓN ====================

        // Obtener estado completo del mapa visual
        this.router.get('/estado-completo', async (req, res) => {
            try {
                const estado = await this.mapaVisualManager.obtenerEstadoCompletoMapa();

                res.json({
                    success: true,
                    data: estado,
                    timestamp: new Date().toISOString(),
                    cache_info: {
                        cached: estado.fromCache || false,
                        expires_in: this.mapaVisualManager.cacheExpireTime
                    }
                });
            } catch (error) {
                console.error('Error obteniendo estado completo del mapa:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno obteniendo estado del mapa',
                    details: error.message
                });
            }
        });

        // Obtener configuración del mapa
        this.router.get('/configuracion', async (req, res) => {
            try {
                const configuracion = await this.mapaVisualManager.obtenerConfiguracionMapa();

                res.json({
                    success: true,
                    data: configuracion,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error obteniendo configuración del mapa:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo configuración del mapa',
                    details: error.message
                });
            }
        });

        // Obtener lista de todas las zonas
        this.router.get('/zonas', async (req, res) => {
            try {
                const zonas = await this.mapaVisualManager.obtenerZonas();

                res.json({
                    success: true,
                    data: zonas,
                    total: zonas.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error obteniendo zonas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo zonas del salón',
                    details: error.message
                });
            }
        });

        // Obtener elementos decorativos
        this.router.get('/elementos-decorativos', async (req, res) => {
            try {
                const elementos = await this.mapaVisualManager.obtenerElementosDecorativos();

                res.json({
                    success: true,
                    data: elementos,
                    total: elementos.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error obteniendo elementos decorativos:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo elementos decorativos',
                    details: error.message
                });
            }
        });

        // Obtener estadísticas del mapa
        this.router.get('/estadisticas', async (req, res) => {
            try {
                const estadisticas = await this.mapaVisualManager.obtenerEstadisticasMapa();

                res.json({
                    success: true,
                    data: estadisticas,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error obteniendo estadísticas del mapa:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo estadísticas del mapa',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE GESTIÓN DE MESAS ====================

        // Actualizar posición de una mesa
        this.router.put('/mesas/:mesaId/posicion', this.updateRateLimiter, async (req, res) => {
            try {
                const mesaId = parseInt(req.params.mesaId);
                const { posicion_x, posicion_y, ancho, alto, rotacion } = req.body;

                // Validación básica
                if (!posicion_x || !posicion_y || !ancho || !alto) {
                    return res.status(400).json({
                        success: false,
                        error: 'Faltan datos obligatorios: posicion_x, posicion_y, ancho, alto'
                    });
                }

                const resultado = await this.mapaVisualManager.actualizarPosicionMesa(
                    mesaId,
                    posicion_x,
                    posicion_y,
                    ancho,
                    alto,
                    rotacion
                );

                res.json({
                    success: true,
                    message: 'Posición de mesa actualizada correctamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error actualizando posición de mesa:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando posición de mesa',
                    details: error.message
                });
            }
        });

        // Actualizar configuración visual de una mesa
        this.router.put('/mesas/:mesaId/configuracion-visual', this.updateRateLimiter, async (req, res) => {
            try {
                const mesaId = parseInt(req.params.mesaId);
                const configuracion = req.body;

                const resultado = await this.mapaVisualManager.actualizarConfiguracionVisualMesa(
                    mesaId,
                    configuracion
                );

                res.json({
                    success: true,
                    message: 'Configuración visual actualizada correctamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error actualizando configuración visual de mesa:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando configuración visual',
                    details: error.message
                });
            }
        });

        // Obtener detalle de una mesa específica
        this.router.get('/mesas/:mesaId/detalle', async (req, res) => {
            try {
                const mesaId = parseInt(req.params.mesaId);
                const detalle = await this.mapaVisualManager.obtenerDetalleMesa(mesaId);

                if (!detalle) {
                    return res.status(404).json({
                        success: false,
                        error: 'Mesa no encontrada en el mapa visual'
                    });
                }

                res.json({
                    success: true,
                    data: detalle,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error obteniendo detalle de mesa:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo detalle de mesa',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE GESTIÓN DE ZONAS ====================

        // Crear nueva zona
        this.router.post('/zonas', this.updateRateLimiter, async (req, res) => {
            try {
                const datosZona = req.body;

                // Validación de datos requeridos
                const camposRequeridos = ['nombre', 'area_x1', 'area_y1', 'area_x2', 'area_y2', 'tipo_zona'];
                for (const campo of camposRequeridos) {
                    if (!datosZona[campo]) {
                        return res.status(400).json({
                            success: false,
                            error: `Campo requerido faltante: ${campo}`
                        });
                    }
                }

                const zonaId = await this.mapaVisualManager.crearZona(datosZona);

                res.status(201).json({
                    success: true,
                    message: 'Zona creada exitosamente',
                    data: { zona_id: zonaId },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error creando zona:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error creando nueva zona',
                    details: error.message
                });
            }
        });

        // Actualizar zona existente
        this.router.put('/zonas/:zonaId', this.updateRateLimiter, async (req, res) => {
            try {
                const zonaId = parseInt(req.params.zonaId);
                const datosActualizacion = req.body;

                const resultado = await this.mapaVisualManager.actualizarZona(zonaId, datosActualizacion);

                res.json({
                    success: true,
                    message: 'Zona actualizada exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error actualizando zona:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando zona',
                    details: error.message
                });
            }
        });

        // Eliminar zona
        this.router.delete('/zonas/:zonaId', this.updateRateLimiter, async (req, res) => {
            try {
                const zonaId = parseInt(req.params.zonaId);

                await this.mapaVisualManager.eliminarZona(zonaId);

                res.json({
                    success: true,
                    message: 'Zona eliminada exitosamente',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error eliminando zona:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error eliminando zona',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE ELEMENTOS DECORATIVOS ====================

        // Agregar elemento decorativo
        this.router.post('/elementos-decorativos', this.updateRateLimiter, async (req, res) => {
            try {
                const datosElemento = req.body;

                // Validación de datos requeridos
                const camposRequeridos = ['nombre', 'tipo_elemento', 'posicion_x', 'posicion_y'];
                for (const campo of camposRequeridos) {
                    if (!datosElemento[campo]) {
                        return res.status(400).json({
                            success: false,
                            error: `Campo requerido faltante: ${campo}`
                        });
                    }
                }

                const elementoId = await this.mapaVisualManager.agregarElementoDecorativo(datosElemento);

                res.status(201).json({
                    success: true,
                    message: 'Elemento decorativo agregado exitosamente',
                    data: { elemento_id: elementoId },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error agregando elemento decorativo:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error agregando elemento decorativo',
                    details: error.message
                });
            }
        });

        // Actualizar elemento decorativo
        this.router.put('/elementos-decorativos/:elementoId', this.updateRateLimiter, async (req, res) => {
            try {
                const elementoId = parseInt(req.params.elementoId);
                const datosActualizacion = req.body;

                const resultado = await this.mapaVisualManager.actualizarElementoDecorativo(elementoId, datosActualizacion);

                res.json({
                    success: true,
                    message: 'Elemento decorativo actualizado exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error actualizando elemento decorativo:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando elemento decorativo',
                    details: error.message
                });
            }
        });

        // Eliminar elemento decorativo
        this.router.delete('/elementos-decorativos/:elementoId', this.updateRateLimiter, async (req, res) => {
            try {
                const elementoId = parseInt(req.params.elementoId);

                await this.mapaVisualManager.eliminarElementoDecorativo(elementoId);

                res.json({
                    success: true,
                    message: 'Elemento decorativo eliminado exitosamente',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error eliminando elemento decorativo:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error eliminando elemento decorativo',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE CONFIGURACIÓN ====================

        // Actualizar configuración general del mapa
        this.router.put('/configuracion', this.updateRateLimiter, async (req, res) => {
            try {
                const configuracion = req.body;

                const resultado = await this.mapaVisualManager.actualizarConfiguracionMapa(configuracion);

                res.json({
                    success: true,
                    message: 'Configuración del mapa actualizada exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error actualizando configuración del mapa:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando configuración del mapa',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE PLANTILLAS ====================

        // Obtener plantillas disponibles
        this.router.get('/plantillas', async (req, res) => {
            try {
                const plantillas = await this.mapaVisualManager.obtenerPlantillas();

                res.json({
                    success: true,
                    data: plantillas,
                    total: plantillas.length,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error obteniendo plantillas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo plantillas del mapa',
                    details: error.message
                });
            }
        });

        // Crear nueva plantilla
        this.router.post('/plantillas', this.updateRateLimiter, async (req, res) => {
            try {
                const datosPlantilla = req.body;

                // Validación de datos requeridos
                if (!datosPlantilla.nombre || !datosPlantilla.configuracion_mapa) {
                    return res.status(400).json({
                        success: false,
                        error: 'Faltan datos requeridos: nombre y configuracion_mapa'
                    });
                }

                const plantillaId = await this.mapaVisualManager.crearPlantilla(datosPlantilla);

                res.status(201).json({
                    success: true,
                    message: 'Plantilla creada exitosamente',
                    data: { plantilla_id: plantillaId },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error creando plantilla:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error creando plantilla',
                    details: error.message
                });
            }
        });

        // Aplicar plantilla al mapa actual
        this.router.post('/plantillas/:plantillaId/aplicar', this.updateRateLimiter, async (req, res) => {
            try {
                const plantillaId = parseInt(req.params.plantillaId);

                const resultado = await this.mapaVisualManager.aplicarPlantilla(plantillaId);

                res.json({
                    success: true,
                    message: 'Plantilla aplicada exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error aplicando plantilla:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error aplicando plantilla',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE HISTORIAL Y AUDITORIA ====================

        // Obtener historial de cambios
        this.router.get('/historial', async (req, res) => {
            try {
                const {
                    limite = 50,
                    offset = 0,
                    tipo_cambio,
                    fecha_inicio,
                    fecha_fin,
                    usuario_id
                } = req.query;

                const filtros = {
                    limite: parseInt(limite),
                    offset: parseInt(offset),
                    tipo_cambio,
                    fecha_inicio,
                    fecha_fin,
                    usuario_id: usuario_id ? parseInt(usuario_id) : null
                };

                const historial = await this.mapaVisualManager.obtenerHistorialCambios(filtros);

                res.json({
                    success: true,
                    data: historial.cambios,
                    pagination: {
                        limite: filtros.limite,
                        offset: filtros.offset,
                        total: historial.total,
                        tiene_siguiente: historial.total > (filtros.offset + filtros.limite)
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error obteniendo historial:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo historial de cambios',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE TIEMPO REAL ====================

        // Endpoint para WebSocket handshake
        this.router.get('/websocket-info', async (req, res) => {
            try {
                res.json({
                    success: true,
                    data: {
                        websocket_enabled: true,
                        events_available: [
                            'mesa_moved',
                            'mesa_updated',
                            'zona_created',
                            'zona_updated',
                            'zona_deleted',
                            'elemento_added',
                            'elemento_updated',
                            'elemento_deleted',
                            'configuracion_updated'
                        ],
                        update_interval: this.mapaVisualManager.cacheExpireTime
                    },
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo información de WebSocket'
                });
            }
        });

        // Forzar actualización del cache
        this.router.post('/cache/refresh', this.updateRateLimiter, async (req, res) => {
            try {
                await this.mapaVisualManager.limpiarCache();

                res.json({
                    success: true,
                    message: 'Cache del mapa visual actualizado exitosamente',
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error actualizando cache:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando cache del mapa',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINT DE SALUD DEL SISTEMA ====================

        // Health check específico del mapa visual
        this.router.get('/health', async (req, res) => {
            try {
                const health = await this.mapaVisualManager.verificarSaludSistema();

                res.json({
                    success: true,
                    status: health.status,
                    data: health,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error verificando salud del sistema:', error);
                res.status(503).json({
                    success: false,
                    status: 'unhealthy',
                    error: 'Error verificando salud del sistema de mapa visual',
                    details: error.message
                });
            }
        });

        // ==================== ENDPOINTS DE EXPORTACIÓN/IMPORTACIÓN ====================

        // Exportar configuración completa del mapa
        this.router.get('/exportar', async (req, res) => {
            try {
                const { incluir_historial = false } = req.query;

                const exportacion = await this.mapaVisualManager.exportarConfiguracionCompleta(
                    incluir_historial === 'true'
                );

                res.json({
                    success: true,
                    data: exportacion,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error exportando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error exportando configuración del mapa',
                    details: error.message
                });
            }
        });

        // Importar configuración del mapa
        this.router.post('/importar', this.updateRateLimiter, async (req, res) => {
            try {
                const { configuracion, sobrescribir = false } = req.body;

                if (!configuracion) {
                    return res.status(400).json({
                        success: false,
                        error: 'Configuración requerida para importación'
                    });
                }

                const resultado = await this.mapaVisualManager.importarConfiguracion(
                    configuracion,
                    sobrescribir
                );

                res.json({
                    success: true,
                    message: 'Configuración importada exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.error('Error importando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error importando configuración del mapa',
                    details: error.message
                });
            }
        });

        console.log('✅ Rutas del Sistema de Mapa Visual de Mesas configuradas correctamente');
        console.log('📊 Total de endpoints implementados: 23 endpoints empresariales');
        console.log('🔒 Rate limiting configurado: 200 req/min general, 100 req/min actualizaciones');
    }

    getRouter() {
        return this.router;
    }
}

module.exports = MapaVisualMesasRoutes;