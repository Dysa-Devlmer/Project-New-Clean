/**
 * DYSA Point - Rutas de Garzones
 * API endpoints para manejo de códigos de garzón y autenticación simple
 *
 * Endpoints incluidos:
 * - POST /validate-code - Validar código de garzón
 * - POST /create-session - Crear sesión temporal
 * - GET /active - Listar garzones activos
 * - POST /create - Crear nuevo garzón
 * - PUT /:id/code - Actualizar código de garzón
 * - GET /:id/activity - Ver actividad de garzón
 */

const express = require('express');
const router = express.Router();

class GarzonRoutes {
    constructor(garzonAuthManager, databaseManager) {
        this.garzonAuth = garzonAuthManager;
        this.db = databaseManager;
        this.setupRoutes();
    }

    setupRoutes() {
        /**
         * POST /garzones/validate-code
         * Validar código de garzón para una acción específica
         */
        router.post('/validate-code', async (req, res) => {
            try {
                const { codigo, accion = 'comandar' } = req.body;

                if (!codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Código de garzón requerido',
                        code: 'MISSING_CODE'
                    });
                }

                const result = await this.garzonAuth.validateGarzonCode(codigo, accion);

                if (!result.success) {
                    return res.status(401).json(result);
                }

                res.json({
                    success: true,
                    message: 'Código válido',
                    garzon: result.garzon,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error validando código:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error de validación',
                    code: 'VALIDATION_ERROR'
                });
            }
        });

        /**
         * POST /garzones/create-session
         * Crear sesión temporal para múltiples operaciones
         */
        router.post('/create-session', async (req, res) => {
            try {
                const { codigo, duracionMinutos = 30 } = req.body;

                if (!codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Código de garzón requerido',
                        code: 'MISSING_CODE'
                    });
                }

                // Validar código primero
                const validation = await this.garzonAuth.validateGarzonCode(codigo, 'comandar');
                if (!validation.success) {
                    return res.status(401).json(validation);
                }

                // Crear sesión temporal
                const session = this.garzonAuth.createTemporarySession(
                    validation.garzon.id,
                    Math.min(duracionMinutos, 120) // máximo 2 horas
                );

                res.json({
                    success: true,
                    message: 'Sesión temporal creada',
                    garzon: validation.garzon,
                    session
                });

            } catch (error) {
                console.error('❌ Error creando sesión:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error creando sesión',
                    code: 'SESSION_CREATE_ERROR'
                });
            }
        });

        /**
         * POST /garzones/validate-session
         * Validar sesión temporal existente
         */
        router.post('/validate-session', async (req, res) => {
            try {
                const { sessionId, garzonId } = req.body;

                if (!sessionId || !garzonId) {
                    return res.status(400).json({
                        success: false,
                        error: 'Session ID y Garzón ID requeridos',
                        code: 'MISSING_PARAMETERS'
                    });
                }

                const result = this.garzonAuth.validateTemporarySession(sessionId, garzonId);

                if (!result.success) {
                    return res.status(401).json(result);
                }

                // Obtener información del garzón
                const garzon = this.garzonAuth.getGarzonById(garzonId);

                res.json({
                    success: true,
                    message: 'Sesión válida',
                    garzon,
                    session: result.session
                });

            } catch (error) {
                console.error('❌ Error validando sesión:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error validando sesión',
                    code: 'SESSION_VALIDATION_ERROR'
                });
            }
        });

        /**
         * DELETE /garzones/session/:sessionId
         * Cerrar sesión temporal
         */
        router.delete('/session/:sessionId', async (req, res) => {
            try {
                const { sessionId } = req.params;
                const success = this.garzonAuth.closeTemporarySession(sessionId);

                if (success) {
                    res.json({
                        success: true,
                        message: 'Sesión cerrada exitosamente'
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        error: 'Sesión no encontrada',
                        code: 'SESSION_NOT_FOUND'
                    });
                }

            } catch (error) {
                console.error('❌ Error cerrando sesión:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error cerrando sesión',
                    code: 'SESSION_CLOSE_ERROR'
                });
            }
        });

        /**
         * GET /garzones/active
         * Obtener lista de garzones activos
         */
        router.get('/active', async (req, res) => {
            try {
                const garzones = this.garzonAuth.getActiveGarzones();

                res.json({
                    success: true,
                    garzones: garzones.map(garzon => ({
                        id: garzon.id,
                        nombre: garzon.nombre,
                        apellido: garzon.apellido,
                        nombreCompleto: garzon.nombreCompleto,
                        role: garzon.role,
                        nivel: garzon.nivel
                        // Nota: NO incluimos el código por seguridad
                    })),
                    total: garzones.length
                });

            } catch (error) {
                console.error('❌ Error obteniendo garzones:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo garzones',
                    code: 'GET_GARZONES_ERROR'
                });
            }
        });

        /**
         * POST /garzones/create
         * Crear nuevo garzón (solo para administradores)
         */
        router.post('/create', async (req, res) => {
            try {
                const {
                    nombre,
                    apellido,
                    email,
                    telefono,
                    roleCodigo = 'GARZON',
                    codigoPrivado
                } = req.body;

                // Validaciones básicas
                if (!nombre || !apellido) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre y apellido son requeridos',
                        code: 'MISSING_REQUIRED_FIELDS'
                    });
                }

                // Obtener ID del rol
                const [roles] = await this.db.connection.execute(
                    'SELECT id FROM roles WHERE codigo = ?',
                    [roleCodigo]
                );

                if (roles.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Rol no válido',
                        code: 'INVALID_ROLE'
                    });
                }

                // Crear garzón
                const result = await this.garzonAuth.createGarzon({
                    nombre,
                    apellido,
                    email,
                    telefono,
                    roleId: roles[0].id,
                    codigoPrivado
                });

                if (!result.success) {
                    return res.status(400).json(result);
                }

                res.status(201).json({
                    success: true,
                    message: 'Garzón creado exitosamente',
                    garzon: result.garzon
                });

            } catch (error) {
                console.error('❌ Error creando garzón:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error creando garzón',
                    code: 'CREATE_GARZON_ERROR'
                });
            }
        });

        /**
         * PUT /garzones/:id/code
         * Actualizar código privado de garzón
         */
        router.put('/:id/code', async (req, res) => {
            try {
                const { id } = req.params;
                const { nuevoCodigo } = req.body;

                if (!nuevoCodigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nuevo código requerido',
                        code: 'MISSING_CODE'
                    });
                }

                // Validar formato del código (4-6 dígitos)
                if (!/^\d{4,6}$/.test(nuevoCodigo)) {
                    return res.status(400).json({
                        success: false,
                        error: 'El código debe tener entre 4 y 6 dígitos',
                        code: 'INVALID_CODE_FORMAT'
                    });
                }

                const result = await this.garzonAuth.updateGarzonCode(
                    parseInt(id),
                    nuevoCodigo
                );

                if (!result.success) {
                    return res.status(400).json(result);
                }

                res.json({
                    success: true,
                    message: 'Código actualizado exitosamente'
                });

            } catch (error) {
                console.error('❌ Error actualizando código:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando código',
                    code: 'UPDATE_CODE_ERROR'
                });
            }
        });

        /**
         * GET /garzones/:id/activity
         * Obtener actividad reciente de un garzón
         */
        router.get('/:id/activity', async (req, res) => {
            try {
                const { id } = req.params;
                const { limite = 50 } = req.query;

                const activities = await this.garzonAuth.getGarzonActivity(
                    parseInt(id),
                    parseInt(limite)
                );

                res.json({
                    success: true,
                    garzonId: parseInt(id),
                    activities,
                    total: activities.length
                });

            } catch (error) {
                console.error('❌ Error obteniendo actividad:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo actividad',
                    code: 'GET_ACTIVITY_ERROR'
                });
            }
        });

        /**
         * GET /garzones/stats
         * Estadísticas generales de actividad de garzones
         */
        router.get('/stats', async (req, res) => {
            try {
                const [stats] = await this.db.connection.execute(`
                    SELECT
                        COUNT(DISTINCT g.garzon_id) as garzones_activos,
                        COUNT(g.id) as total_actividades,
                        DATE(g.fecha) as fecha,
                        g.accion,
                        COUNT(*) as cantidad
                    FROM actividad_garzones g
                    WHERE g.fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY DATE(g.fecha), g.accion
                    ORDER BY fecha DESC, cantidad DESC
                `);

                const [topGarzones] = await this.db.connection.execute(`
                    SELECT
                        u.nombre,
                        u.apellido,
                        COUNT(g.id) as total_actividades,
                        MAX(g.fecha) as ultima_actividad
                    FROM actividad_garzones g
                    INNER JOIN usuarios u ON g.garzon_id = u.id
                    WHERE g.fecha >= DATE_SUB(NOW(), INTERVAL 7 DAY)
                    GROUP BY u.id, u.nombre, u.apellido
                    ORDER BY total_actividades DESC
                    LIMIT 10
                `);

                res.json({
                    success: true,
                    estadisticas: {
                        actividadPorDia: stats,
                        topGarzones,
                        totalGarzonesActivos: this.garzonAuth.getActiveGarzones().length
                    }
                });

            } catch (error) {
                console.error('❌ Error obteniendo estadísticas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo estadísticas',
                    code: 'GET_STATS_ERROR'
                });
            }
        });

        /**
         * POST /garzones/reload
         * Recargar cache de garzones (para administradores)
         */
        router.post('/reload', async (req, res) => {
            try {
                const success = await this.garzonAuth.loadGarzones();

                if (success) {
                    res.json({
                        success: true,
                        message: 'Cache de garzones recargado exitosamente',
                        totalGarzones: this.garzonAuth.getActiveGarzones().length
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        error: 'Error recargando cache',
                        code: 'RELOAD_ERROR'
                    });
                }

            } catch (error) {
                console.error('❌ Error recargando cache:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error recargando cache',
                    code: 'RELOAD_ERROR'
                });
            }
        });
    }

    getRouter() {
        return router;
    }
}

module.exports = GarzonRoutes;