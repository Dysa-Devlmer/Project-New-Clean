/**
 * DYSA Point - Rutas de Gestión de Mesas
 * API endpoints para manejo completo del estado del salón en tiempo real
 *
 * Endpoints incluidos:
 * - GET /salon - Estado completo del salón por zonas
 * - PUT /:id/estado - Cambiar estado de mesa
 * - POST /:id/asignar - Asignar mesa a garzón
 * - GET /garzon/:codigo - Mesas asignadas a garzón
 * - GET /estadisticas - Estadísticas de ocupación
 * - PUT /:id/liberar - Liberar mesa
 * - GET /tiempo-real - WebSocket para actualizaciones en tiempo real
 */

const express = require('express');
const router = express.Router();

class MesasRoutes {
    constructor(mesasManager, database) {
        this.mesasManager = mesasManager;
        this.db = database;
        this.setupRoutes();
        this.setupWebSocketHandlers();
    }

    setupRoutes() {
        // Obtener estado completo del salón
        router.get('/salon', async (req, res) => {
            try {
                const estadoSalon = await this.mesasManager.obtenerEstadoSalon();
                res.json(estadoSalon);

            } catch (error) {
                console.error('❌ Error obteniendo estado del salón:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Cambiar estado de una mesa
        router.put('/:id/estado', async (req, res) => {
            try {
                const mesaId = parseInt(req.params.id);
                const {
                    nuevo_estado,
                    garzon_codigo,
                    observaciones,
                    tiempo_estimado
                } = req.body;

                if (!nuevo_estado) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nuevo estado es requerido'
                    });
                }

                const resultado = await this.mesasManager.cambiarEstadoMesa(mesaId, nuevo_estado, {
                    garzon_codigo,
                    observaciones,
                    tiempo_estimado: tiempo_estimado ? parseInt(tiempo_estimado) : null
                });

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error cambiando estado de mesa:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Asignar mesa a garzón
        router.post('/:id/asignar', async (req, res) => {
            try {
                const mesaId = parseInt(req.params.id);
                const { garzon_codigo, tipo_asignacion = 'manual' } = req.body;

                if (!garzon_codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Código de garzón es requerido'
                    });
                }

                const resultado = await this.mesasManager.asignarMesaGarzon(
                    mesaId,
                    garzon_codigo,
                    tipo_asignacion
                );

                res.json(resultado);

            } catch (error) {
                console.error('❌ Error asignando mesa:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener mesas asignadas a un garzón
        router.get('/garzon/:codigo', async (req, res) => {
            try {
                const garzonCodigo = req.params.codigo;

                if (!garzonCodigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Código de garzón es requerido'
                    });
                }

                const resultado = await this.mesasManager.obtenerMesasGarzon(garzonCodigo);
                res.json(resultado);

            } catch (error) {
                console.error('❌ Error obteniendo mesas de garzón:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener estadísticas de ocupación
        router.get('/estadisticas', async (req, res) => {
            try {
                const estadisticas = await this.mesasManager.obtenerEstadisticasOcupacion();
                res.json(estadisticas);

            } catch (error) {
                console.error('❌ Error obteniendo estadísticas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Liberar mesa
        router.put('/:id/liberar', async (req, res) => {
            try {
                const mesaId = parseInt(req.params.id);
                const { garzon_codigo } = req.body;

                if (!garzon_codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Código de garzón es requerido'
                    });
                }

                const resultado = await this.mesasManager.liberarMesa(mesaId, garzon_codigo);
                res.json(resultado);

            } catch (error) {
                console.error('❌ Error liberando mesa:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener historial de ocupación de una mesa
        router.get('/:id/historial', async (req, res) => {
            try {
                const mesaId = parseInt(req.params.id);
                const { fecha_desde, fecha_hasta, limite = 50 } = req.query;

                let query = `
                    SELECT
                        om.*,
                        m.nombre as mesa_nombre,
                        u.nombre as garzon_nombre,
                        v.total as venta_total
                    FROM ocupacion_mesas om
                    JOIN mesas m ON om.mesa_id = m.id
                    LEFT JOIN usuarios u ON om.usuario_id = u.id
                    LEFT JOIN ventas v ON om.venta_id = v.id
                    WHERE om.mesa_id = ?
                `;

                const params = [mesaId];

                if (fecha_desde) {
                    query += ` AND DATE(om.fecha_inicio) >= ?`;
                    params.push(fecha_desde);
                }

                if (fecha_hasta) {
                    query += ` AND DATE(om.fecha_inicio) <= ?`;
                    params.push(fecha_hasta);
                }

                query += ` ORDER BY om.fecha_inicio DESC LIMIT ?`;
                params.push(parseInt(limite));

                const [historial] = await this.db.connection.execute(query, params);

                res.json({
                    success: true,
                    historial: historial,
                    total: historial.length
                });

            } catch (error) {
                console.error('❌ Error obteniendo historial:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Crear nueva mesa
        router.post('/crear', async (req, res) => {
            try {
                const {
                    nombre,
                    capacidad,
                    zona_id,
                    posicion_x = 0,
                    posicion_y = 0,
                    observaciones = null
                } = req.body;

                if (!nombre || !capacidad || !zona_id) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre, capacidad y zona son requeridos'
                    });
                }

                // Verificar que la zona existe
                const [zonas] = await this.db.connection.execute(`
                    SELECT id FROM zonas WHERE id = ? AND activo = 1
                `, [zona_id]);

                if (zonas.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Zona no encontrada o inactiva'
                    });
                }

                // Crear mesa
                const [resultado] = await this.db.connection.execute(`
                    INSERT INTO mesas (nombre, capacidad, zona_id, posicion_x, posicion_y, estado, observaciones, activo, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'libre', ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [nombre, capacidad, zona_id, posicion_x, posicion_y, observaciones]);

                const mesaId = resultado.insertId;

                // Actualizar cache del manager
                await this.mesasManager.inicializarCache();

                res.json({
                    success: true,
                    mesa_id: mesaId,
                    mensaje: 'Mesa creada exitosamente'
                });

            } catch (error) {
                console.error('❌ Error creando mesa:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Obtener zonas disponibles
        router.get('/zonas', async (req, res) => {
            try {
                const [zonas] = await this.db.connection.execute(`
                    SELECT * FROM zonas WHERE activo = 1 ORDER BY orden ASC
                `);

                res.json({
                    success: true,
                    zonas: zonas
                });

            } catch (error) {
                console.error('❌ Error obteniendo zonas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Crear nueva zona
        router.post('/zonas', async (req, res) => {
            try {
                const {
                    nombre,
                    descripcion = '',
                    color = '#2196F3',
                    orden = 1
                } = req.body;

                if (!nombre) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre de zona es requerido'
                    });
                }

                const [resultado] = await this.db.connection.execute(`
                    INSERT INTO zonas (nombre, descripcion, color, orden, activo, created_at, updated_at)
                    VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [nombre, descripcion, color, orden]);

                res.json({
                    success: true,
                    zona_id: resultado.insertId,
                    mensaje: 'Zona creada exitosamente'
                });

            } catch (error) {
                console.error('❌ Error creando zona:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });

        // Endpoint para notificaciones en tiempo real
        router.get('/notificaciones', async (req, res) => {
            try {
                // Configurar Server-Sent Events
                res.writeHead(200, {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Cache-Control'
                });

                // Función para enviar datos
                const enviarEvento = (tipo, datos) => {
                    res.write(`event: ${tipo}\n`);
                    res.write(`data: ${JSON.stringify(datos)}\n\n`);
                };

                // Enviar estado inicial
                const estadoInicial = await this.mesasManager.obtenerEstadoSalon();
                enviarEvento('estado_inicial', estadoInicial);

                // Configurar listeners de eventos
                const onCambioEstado = (datos) => enviarEvento('cambio_estado', datos);
                const onAsignacion = (datos) => enviarEvento('asignacion', datos);
                const onActualizacionTiempo = (datos) => enviarEvento('tiempo_actualizado', datos);

                this.mesasManager.on('cambio_estado_mesa', onCambioEstado);
                this.mesasManager.on('asignacion_mesa', onAsignacion);
                this.mesasManager.on('actualizacion_tiempo', onActualizacionTiempo);

                // Limpiar listeners cuando se cierre la conexión
                req.on('close', () => {
                    this.mesasManager.removeListener('cambio_estado_mesa', onCambioEstado);
                    this.mesasManager.removeListener('asignacion_mesa', onAsignacion);
                    this.mesasManager.removeListener('actualizacion_tiempo', onActualizacionTiempo);
                    res.end();
                });

            } catch (error) {
                console.error('❌ Error configurando notificaciones:', error);
                res.status(500).json({
                    success: false,
                    error: error.message
                });
            }
        });
    }

    setupWebSocketHandlers() {
        // Configurar manejadores de WebSocket si está disponible
        // Esto se puede expandir más tarde para WebSocket real
        console.log('📡 Handlers de WebSocket configurados para mesas');
    }

    getRouter() {
        return router;
    }
}

module.exports = MesasRoutes;