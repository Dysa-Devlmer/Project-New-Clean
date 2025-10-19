/**
 * Rutas API para Sistema de Pre-tickets
 * Endpoints RESTful para generar, imprimir y gestionar pre-tickets
 *
 * Funcionalidad Crítica #3 del Sistema Anterior
 * Autor: Claude Code
 * Fecha: 2025-10-13
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

class PreticketRoutes {
    constructor(preticketManager, database) {
        this.preticketManager = preticketManager;
        this.database = database;
        this.router = express.Router();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Rate limiting para evitar spam de generación de pre-tickets
        this.generateLimit = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minuto
            max: 10, // máximo 10 generaciones por minuto
            message: {
                success: false,
                error: 'Demasiadas solicitudes de generación. Intente más tarde.'
            }
        });

        this.printLimit = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minuto
            max: 20, // máximo 20 impresiones por minuto
            message: {
                success: false,
                error: 'Demasiadas solicitudes de impresión. Intente más tarde.'
            }
        });
    }

    setupRoutes() {
        // Generar nuevo pre-ticket para una venta
        this.router.post('/:venta_id/generar', this.generateLimit, async (req, res) => {
            try {
                const { venta_id } = req.params;
                const {
                    usuario_id,
                    tipo_preticket = 'total',
                    productos_seleccionados = null,
                    motivo = null,
                    impresion_automatica = true
                } = req.body;

                if (!usuario_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario ID es requerido'
                    });
                }

                const resultado = await this.preticketManager.generarPreticket(
                    parseInt(venta_id),
                    parseInt(usuario_id),
                    tipo_preticket,
                    productos_seleccionados,
                    motivo,
                    impresion_automatica
                );

                res.json({
                    success: true,
                    message: 'Pre-ticket generado exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error generando pre-ticket:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al generar pre-ticket'
                });
            }
        });

        // Imprimir pre-ticket específico
        this.router.post('/:preticket_id/imprimir', this.printLimit, async (req, res) => {
            try {
                const { preticket_id } = req.params;
                const {
                    usuario_id,
                    plantilla_id = null,
                    copias = 1,
                    impresora_id = null
                } = req.body;

                if (!usuario_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario ID es requerido'
                    });
                }

                const resultado = await this.preticketManager.imprimirPreticket(
                    parseInt(preticket_id),
                    parseInt(usuario_id),
                    plantilla_id ? parseInt(plantilla_id) : null,
                    parseInt(copias),
                    impresora_id ? parseInt(impresora_id) : null
                );

                res.json({
                    success: true,
                    message: 'Pre-ticket impreso exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error imprimiendo pre-ticket:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al imprimir pre-ticket'
                });
            }
        });

        // Anular pre-ticket
        this.router.post('/:preticket_id/anular', async (req, res) => {
            try {
                const { preticket_id } = req.params;
                const { usuario_id, motivo } = req.body;

                if (!usuario_id || !motivo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario ID y motivo son requeridos'
                    });
                }

                const resultado = await this.preticketManager.anularPreticket(
                    parseInt(preticket_id),
                    parseInt(usuario_id),
                    motivo
                );

                res.json({
                    success: true,
                    message: 'Pre-ticket anulado exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error anulando pre-ticket:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al anular pre-ticket'
                });
            }
        });

        // Obtener pre-tickets de una venta específica
        this.router.get('/venta/:venta_id', async (req, res) => {
            try {
                const { venta_id } = req.params;
                const { incluir_anulados = false } = req.query;

                const pretickets = await this.preticketManager.obtenerPreticketsPorVenta(
                    parseInt(venta_id),
                    incluir_anulados === 'true'
                );

                res.json({
                    success: true,
                    data: pretickets,
                    total: pretickets.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo pre-tickets por venta:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener pre-tickets'
                });
            }
        });

        // Obtener detalle de pre-ticket específico
        this.router.get('/:preticket_id/detalle', async (req, res) => {
            try {
                const { preticket_id } = req.params;

                const detalle = await this.preticketManager.obtenerDetallePreticket(
                    parseInt(preticket_id)
                );

                if (!detalle) {
                    return res.status(404).json({
                        success: false,
                        error: 'Pre-ticket no encontrado'
                    });
                }

                res.json({
                    success: true,
                    data: detalle,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo detalle de pre-ticket:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener detalle'
                });
            }
        });

        // Listar pre-tickets con filtros
        this.router.get('/lista', async (req, res) => {
            try {
                const {
                    fecha_desde,
                    fecha_hasta,
                    estado,
                    tipo_preticket,
                    usuario_id,
                    mesa,
                    limit = 50,
                    offset = 0
                } = req.query;

                const filtros = {};
                if (fecha_desde) filtros.fecha_desde = fecha_desde;
                if (fecha_hasta) filtros.fecha_hasta = fecha_hasta;
                if (estado) filtros.estado = estado;
                if (tipo_preticket) filtros.tipo_preticket = tipo_preticket;
                if (usuario_id) filtros.usuario_id = parseInt(usuario_id);
                if (mesa) filtros.mesa = parseInt(mesa);

                const resultado = await this.preticketManager.obtenerListaPretickets(
                    filtros,
                    parseInt(limit),
                    parseInt(offset)
                );

                res.json({
                    success: true,
                    data: resultado.pretickets,
                    total: resultado.total,
                    filtros: filtros,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo lista de pre-tickets:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener lista'
                });
            }
        });

        // Obtener estadísticas de pre-tickets
        this.router.get('/estadisticas', async (req, res) => {
            try {
                const {
                    fecha_desde,
                    fecha_hasta,
                    usuario_id
                } = req.query;

                const estadisticas = await this.preticketManager.obtenerEstadisticas(
                    fecha_desde,
                    fecha_hasta,
                    usuario_id ? parseInt(usuario_id) : null
                );

                res.json({
                    success: true,
                    data: estadisticas,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo estadísticas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener estadísticas'
                });
            }
        });

        // Obtener configuración de pre-tickets
        this.router.get('/configuracion', async (req, res) => {
            try {
                const { tipo_config = 'global', id_referencia = null } = req.query;

                const configuracion = await this.preticketManager.obtenerConfiguracion(
                    tipo_config,
                    id_referencia ? parseInt(id_referencia) : null
                );

                res.json({
                    success: true,
                    data: configuracion,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo configuración:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener configuración'
                });
            }
        });

        // Actualizar configuración de pre-tickets
        this.router.put('/configuracion', async (req, res) => {
            try {
                const {
                    tipo_config = 'global',
                    id_referencia = null,
                    configuracion
                } = req.body;

                if (!configuracion) {
                    return res.status(400).json({
                        success: false,
                        error: 'Configuración es requerida'
                    });
                }

                const resultado = await this.preticketManager.actualizarConfiguracion(
                    tipo_config,
                    id_referencia,
                    configuracion
                );

                res.json({
                    success: true,
                    message: 'Configuración actualizada exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error actualizando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al actualizar configuración'
                });
            }
        });

        // Obtener plantillas disponibles
        this.router.get('/plantillas', async (req, res) => {
            try {
                const { tipo_plantilla, activa_solamente = true } = req.query;

                const plantillas = await this.preticketManager.obtenerPlantillas(
                    tipo_plantilla,
                    activa_solamente === 'true'
                );

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
                    error: error.message || 'Error interno al obtener plantillas'
                });
            }
        });

        // Previsualizar pre-ticket
        this.router.post('/:preticket_id/preview', async (req, res) => {
            try {
                const { preticket_id } = req.params;
                const { plantilla_id = null } = req.body;

                const preview = await this.preticketManager.previsualizarPreticket(
                    parseInt(preticket_id),
                    plantilla_id ? parseInt(plantilla_id) : null
                );

                res.json({
                    success: true,
                    data: preview,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error generando preview:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al generar preview'
                });
            }
        });

        // Dashboard resumen para gestión
        this.router.get('/dashboard', async (req, res) => {
            try {
                const dashboard = await this.preticketManager.obtenerDashboard();

                res.json({
                    success: true,
                    data: dashboard,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo dashboard:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener dashboard'
                });
            }
        });

        // Verificar permisos de usuario
        this.router.get('/permisos/:usuario_id', async (req, res) => {
            try {
                const { usuario_id } = req.params;

                const permisos = await this.preticketManager.verificarPermisos(
                    parseInt(usuario_id),
                    'todas' // Verificar todos los permisos
                );

                res.json({
                    success: true,
                    data: permisos,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error verificando permisos:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al verificar permisos'
                });
            }
        });

        // Endpoint de salud del sistema
        this.router.get('/health', async (req, res) => {
            try {
                const health = {
                    sistema: 'Pre-tickets',
                    estado: 'funcionando',
                    version: '1.0.0',
                    inicializado: this.preticketManager ? true : false,
                    base_datos_conectada: this.database ? true : false,
                    timestamp: new Date().toISOString()
                };

                // Verificar conectividad a base de datos
                if (this.database) {
                    try {
                        await this.database.connection.execute('SELECT 1');
                        health.conexion_bd = 'OK';
                    } catch (error) {
                        health.conexion_bd = 'ERROR';
                        health.error_bd = error.message;
                    }
                }

                res.json({
                    success: true,
                    data: health
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: 'Error verificando salud del sistema'
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = PreticketRoutes;