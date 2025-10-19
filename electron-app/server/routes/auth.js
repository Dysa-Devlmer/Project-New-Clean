/**
 * DYSA Point - Rutas de Autenticación
 * Endpoints profesionales para manejo de sesiones y autenticación
 *
 * Rutas incluidas:
 * - POST /login - Autenticación de usuarios
 * - POST /logout - Cerrar sesión
 * - POST /logout-all - Cerrar todas las sesiones
 * - POST /refresh-token - Renovar token de acceso
 * - GET /profile - Obtener perfil del usuario
 * - GET /sessions - Listar sesiones activas
 * - POST /change-password - Cambiar contraseña
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

class AuthRoutes {
    constructor(authManager, databaseManager) {
        this.auth = authManager;
        this.db = databaseManager;
        this.setupRoutes();
    }

    setupRoutes() {
        // Rate limiting para endpoints sensibles
        const loginLimiter = this.auth.getLoginRateLimit();

        // Middleware para extraer información del cliente
        const extractClientInfo = (req, res, next) => {
            req.clientInfo = {
                ip: req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'],
                userAgent: req.headers['user-agent'] || 'unknown',
                timestamp: new Date().toISOString()
            };
            next();
        };

        // Aplicar middleware a todas las rutas
        router.use(extractClientInfo);

        /**
         * POST /auth/login
         * Autenticar usuario y crear sesión
         */
        router.post('/login', loginLimiter, async (req, res) => {
            try {
                const { username, password, remember = false } = req.body;

                // Validación de entrada
                if (!username || !password) {
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario y contraseña son requeridos',
                        code: 'MISSING_CREDENTIALS'
                    });
                }

                // Validar formato de entrada
                if (username.length < 3 || password.length < 4) {
                    return res.status(400).json({
                        success: false,
                        error: 'Credenciales inválidas',
                        code: 'INVALID_FORMAT'
                    });
                }

                // Intentar autenticación
                const result = await this.auth.authenticateUser(username, password, req.clientInfo);

                if (!result.success) {
                    return res.status(401).json(result);
                }

                // Configurar cookies seguras si se solicita "recordar"
                if (remember) {
                    res.cookie('refreshToken', result.tokens.refreshToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === 'production',
                        sameSite: 'strict',
                        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 días
                    });
                }

                // Respuesta exitosa
                res.json({
                    success: true,
                    message: 'Login exitoso',
                    user: result.user,
                    token: result.tokens.accessToken,
                    sessionId: result.sessionId,
                    expiresIn: '8h'
                });

            } catch (error) {
                console.error('❌ Error en login:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno del servidor',
                    code: 'INTERNAL_ERROR'
                });
            }
        });

        /**
         * POST /auth/logout
         * Cerrar sesión actual
         */
        router.post('/logout', this.auth.verifyToken(), async (req, res) => {
            try {
                const result = await this.auth.logout(req.user.id, req.user.sessionId);

                // Limpiar cookies
                res.clearCookie('refreshToken');

                res.json({
                    success: true,
                    message: 'Sesión cerrada exitosamente'
                });

            } catch (error) {
                console.error('❌ Error en logout:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error cerrando sesión',
                    code: 'LOGOUT_ERROR'
                });
            }
        });

        /**
         * POST /auth/logout-all
         * Cerrar todas las sesiones del usuario
         */
        router.post('/logout-all', this.auth.verifyToken(), async (req, res) => {
            try {
                const result = await this.auth.logoutAllSessions(req.user.id);

                // Limpiar cookies
                res.clearCookie('refreshToken');

                res.json({
                    success: true,
                    message: 'Todas las sesiones han sido cerradas'
                });

            } catch (error) {
                console.error('❌ Error en logout-all:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error cerrando sesiones',
                    code: 'LOGOUT_ALL_ERROR'
                });
            }
        });

        /**
         * POST /auth/refresh-token
         * Renovar token de acceso usando refresh token
         */
        router.post('/refresh-token', async (req, res) => {
            try {
                const { refreshToken } = req.body;
                const cookieRefreshToken = req.cookies?.refreshToken;

                const tokenToUse = refreshToken || cookieRefreshToken;

                if (!tokenToUse) {
                    return res.status(401).json({
                        success: false,
                        error: 'Refresh token requerido',
                        code: 'NO_REFRESH_TOKEN'
                    });
                }

                // Verificar refresh token
                const jwt = require('jsonwebtoken');
                let decoded;

                try {
                    decoded = jwt.verify(tokenToUse, this.auth.JWT_SECRET, {
                        issuer: 'dysa-point',
                        audience: 'restaurant-pos'
                    });
                } catch (error) {
                    return res.status(401).json({
                        success: false,
                        error: 'Refresh token inválido o expirado',
                        code: 'INVALID_REFRESH_TOKEN'
                    });
                }

                // Verificar que sea un refresh token
                if (decoded.type !== 'refresh') {
                    return res.status(401).json({
                        success: false,
                        error: 'Token inválido',
                        code: 'INVALID_TOKEN_TYPE'
                    });
                }

                // Verificar que la sesión esté activa
                const sessionActive = await this.auth.isSessionActive(decoded.userId, decoded.sessionId);
                if (!sessionActive) {
                    return res.status(401).json({
                        success: false,
                        error: 'Sesión expirada',
                        code: 'SESSION_EXPIRED'
                    });
                }

                // Obtener información del usuario
                const [users] = await this.db.connection.execute(`
                    SELECT u.*, r.codigo as role_codigo, r.nombre as role_nombre,
                           r.nivel as role_nivel, r.permisos as role_permisos
                    FROM usuarios u
                    INNER JOIN roles r ON u.role_id = r.id
                    WHERE u.id = ? AND u.activo = 1
                `, [decoded.userId]);

                if (users.length === 0) {
                    return res.status(401).json({
                        success: false,
                        error: 'Usuario no válido',
                        code: 'INVALID_USER'
                    });
                }

                const user = users[0];

                // Generar nuevo access token
                const newTokens = await this.auth.generateTokens(user, req.clientInfo);

                res.json({
                    success: true,
                    token: newTokens.accessToken,
                    expiresIn: '8h'
                });

            } catch (error) {
                console.error('❌ Error renovando token:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error renovando token',
                    code: 'REFRESH_ERROR'
                });
            }
        });

        /**
         * GET /auth/profile
         * Obtener perfil del usuario autenticado
         */
        router.get('/profile', this.auth.verifyToken(), async (req, res) => {
            try {
                // Obtener información completa del perfil
                const [users] = await this.db.connection.execute(`
                    SELECT u.id, u.username, u.email, u.nombre, u.apellido,
                           u.telefono, u.direccion, u.fecha_nacimiento,
                           u.ultimo_login, u.created_at,
                           r.codigo as role_codigo, r.nombre as role_nombre,
                           r.nivel as role_nivel, r.descripcion as role_descripcion
                    FROM usuarios u
                    INNER JOIN roles r ON u.role_id = r.id
                    WHERE u.id = ? AND u.activo = 1
                `, [req.user.id]);

                if (users.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Usuario no encontrado',
                        code: 'USER_NOT_FOUND'
                    });
                }

                const user = users[0];

                // Obtener sesiones activas
                const [sessions] = await this.db.connection.execute(`
                    SELECT session_id, ip_address, user_agent, fecha_inicio, ultima_actividad
                    FROM sesiones_usuario
                    WHERE usuario_id = ? AND activa = 1
                    ORDER BY ultima_actividad DESC
                `, [req.user.id]);

                res.json({
                    success: true,
                    profile: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        nombre: user.nombre,
                        apellido: user.apellido,
                        telefono: user.telefono,
                        direccion: user.direccion,
                        fechaNacimiento: user.fecha_nacimiento,
                        ultimoLogin: user.ultimo_login,
                        fechaCreacion: user.created_at,
                        role: {
                            codigo: user.role_codigo,
                            nombre: user.role_nombre,
                            nivel: user.role_nivel,
                            descripcion: user.role_descripcion
                        }
                    },
                    activeSessions: sessions.map(s => ({
                        sessionId: s.session_id,
                        ipAddress: s.ip_address,
                        userAgent: s.user_agent,
                        fechaInicio: s.fecha_inicio,
                        ultimaActividad: s.ultima_actividad,
                        isCurrentSession: s.session_id === req.user.sessionId
                    }))
                });

            } catch (error) {
                console.error('❌ Error obteniendo perfil:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo perfil',
                    code: 'PROFILE_ERROR'
                });
            }
        });

        /**
         * GET /auth/sessions
         * Listar sesiones activas del usuario
         */
        router.get('/sessions', this.auth.verifyToken(), async (req, res) => {
            try {
                const [sessions] = await this.db.connection.execute(`
                    SELECT session_id, ip_address, user_agent, fecha_inicio, ultima_actividad
                    FROM sesiones_usuario
                    WHERE usuario_id = ? AND activa = 1
                    ORDER BY ultima_actividad DESC
                `, [req.user.id]);

                res.json({
                    success: true,
                    sessions: sessions.map(s => ({
                        sessionId: s.session_id,
                        ipAddress: s.ip_address,
                        userAgent: s.user_agent,
                        fechaInicio: s.fecha_inicio,
                        ultimaActividad: s.ultima_actividad,
                        isCurrentSession: s.session_id === req.user.sessionId
                    }))
                });

            } catch (error) {
                console.error('❌ Error obteniendo sesiones:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo sesiones',
                    code: 'SESSIONS_ERROR'
                });
            }
        });

        /**
         * DELETE /auth/sessions/:sessionId
         * Cerrar una sesión específica
         */
        router.delete('/sessions/:sessionId', this.auth.verifyToken(), async (req, res) => {
            try {
                const { sessionId } = req.params;

                // Verificar que la sesión pertenezca al usuario
                const [sessions] = await this.db.connection.execute(`
                    SELECT id FROM sesiones_usuario
                    WHERE usuario_id = ? AND session_id = ? AND activa = 1
                `, [req.user.id, sessionId]);

                if (sessions.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Sesión no encontrada',
                        code: 'SESSION_NOT_FOUND'
                    });
                }

                // Cerrar la sesión
                await this.auth.logout(req.user.id, sessionId);

                res.json({
                    success: true,
                    message: 'Sesión cerrada exitosamente'
                });

            } catch (error) {
                console.error('❌ Error cerrando sesión específica:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error cerrando sesión',
                    code: 'CLOSE_SESSION_ERROR'
                });
            }
        });

        /**
         * POST /auth/change-password
         * Cambiar contraseña del usuario
         */
        router.post('/change-password', this.auth.verifyToken(), async (req, res) => {
            try {
                const { currentPassword, newPassword, logoutOtherSessions = true } = req.body;

                // Validaciones
                if (!currentPassword || !newPassword) {
                    return res.status(400).json({
                        success: false,
                        error: 'Contraseña actual y nueva son requeridas',
                        code: 'MISSING_PASSWORDS'
                    });
                }

                if (newPassword.length < 6) {
                    return res.status(400).json({
                        success: false,
                        error: 'La nueva contraseña debe tener al menos 6 caracteres',
                        code: 'PASSWORD_TOO_SHORT'
                    });
                }

                // Obtener usuario actual
                const [users] = await this.db.connection.execute(`
                    SELECT password FROM usuarios WHERE id = ?
                `, [req.user.id]);

                if (users.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Usuario no encontrado',
                        code: 'USER_NOT_FOUND'
                    });
                }

                // Verificar contraseña actual
                const bcrypt = require('bcrypt');
                const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password);

                if (!isCurrentPasswordValid) {
                    return res.status(400).json({
                        success: false,
                        error: 'Contraseña actual incorrecta',
                        code: 'INVALID_CURRENT_PASSWORD'
                    });
                }

                // Encriptar nueva contraseña
                const hashedNewPassword = await bcrypt.hash(newPassword, 10);

                // Actualizar contraseña
                await this.db.connection.execute(`
                    UPDATE usuarios
                    SET password = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [hashedNewPassword, req.user.id]);

                // Cerrar otras sesiones si se solicita
                if (logoutOtherSessions) {
                    await this.db.connection.execute(`
                        UPDATE sesiones_usuario
                        SET activa = 0, fecha_cierre = CURRENT_TIMESTAMP
                        WHERE usuario_id = ? AND session_id != ? AND activa = 1
                    `, [req.user.id, req.user.sessionId]);
                }

                // Log del evento
                await this.auth.logSecurityEvent(
                    'PASSWORD_CHANGED',
                    req.user.username,
                    'Contraseña cambiada exitosamente',
                    req.clientInfo
                );

                res.json({
                    success: true,
                    message: 'Contraseña cambiada exitosamente'
                });

            } catch (error) {
                console.error('❌ Error cambiando contraseña:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error cambiando contraseña',
                    code: 'CHANGE_PASSWORD_ERROR'
                });
            }
        });

        /**
         * GET /auth/validate-token
         * Validar si el token actual es válido
         */
        router.get('/validate-token', this.auth.verifyToken(), (req, res) => {
            res.json({
                success: true,
                valid: true,
                user: {
                    id: req.user.id,
                    username: req.user.username,
                    role: req.user.role
                }
            });
        });
    }

    getRouter() {
        return router;
    }
}

module.exports = AuthRoutes;