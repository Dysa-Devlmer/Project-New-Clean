/**
 * DYSA Point - Sistema de Autenticación y Autorización
 * Middleware profesional para manejo de sesiones y permisos
 *
 * Características:
 * - Autenticación JWT robusta
 * - Manejo de sesiones concurrentes
 * - Autorización granular por permisos
 * - Logging de seguridad completo
 * - Protección contra ataques comunes
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const rateLimit = require('express-rate-limit');

class AuthenticationManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.JWT_SECRET = process.env.JWT_SECRET || 'dysa_point_secret_2024_v2.0.14';
        this.JWT_EXPIRATION = '8h'; // Sesión de 8 horas
        this.REFRESH_EXPIRATION = '7d'; // Refresh token de 7 días
        this.activeSessions = new Map(); // Mapa de sesiones activas
    }

    /**
     * Rate limiting para login
     */
    getLoginRateLimit() {
        return rateLimit({
            windowMs: 15 * 60 * 1000, // 15 minutos
            max: 5, // máximo 5 intentos por IP
            message: {
                success: false,
                error: 'Demasiados intentos de login. Intente nuevamente en 15 minutos.',
                code: 'RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false,
        });
    }

    /**
     * Autenticar usuario con credenciales
     */
    async authenticateUser(username, password, clientInfo = {}) {
        try {
            console.log(`🔐 Intento de autenticación para usuario: ${username}`);

            // Buscar usuario en la base de datos
            const [users] = await this.db.connection.execute(`
                SELECT u.*, r.codigo as role_codigo, r.nombre as role_nombre,
                       r.nivel as role_nivel, r.permisos as role_permisos
                FROM usuarios u
                INNER JOIN roles r ON u.role_id = r.id
                WHERE (u.username = ? OR u.email = ?) AND u.activo = 1
            `, [username, username]);

            if (users.length === 0) {
                console.log(`❌ Usuario no encontrado: ${username}`);
                await this.logSecurityEvent('LOGIN_FAILED', username, 'Usuario no encontrado', clientInfo);
                return {
                    success: false,
                    error: 'Credenciales inválidas',
                    code: 'INVALID_CREDENTIALS'
                };
            }

            const user = users[0];

            // Verificar contraseña
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                console.log(`❌ Contraseña incorrecta para usuario: ${username}`);
                await this.logSecurityEvent('LOGIN_FAILED', username, 'Contraseña incorrecta', clientInfo);

                // Incrementar intentos fallidos
                await this.incrementFailedAttempts(user.id);

                return {
                    success: false,
                    error: 'Credenciales inválidas',
                    code: 'INVALID_CREDENTIALS'
                };
            }

            // Verificar si el usuario está bloqueado
            if (user.intentos_fallidos >= 5) {
                const lastAttempt = new Date(user.ultimo_intento_fallido);
                const blockTime = 30 * 60 * 1000; // 30 minutos de bloqueo

                if (Date.now() - lastAttempt.getTime() < blockTime) {
                    console.log(`🚫 Usuario bloqueado temporalmente: ${username}`);
                    await this.logSecurityEvent('LOGIN_BLOCKED', username, 'Usuario bloqueado por intentos fallidos', clientInfo);

                    return {
                        success: false,
                        error: 'Cuenta bloqueada temporalmente. Intente en 30 minutos.',
                        code: 'ACCOUNT_BLOCKED'
                    };
                }
            }

            // Verificar sesiones concurrentes
            const maxSessions = this.getMaxSessionsForRole(user.role_codigo);
            const activeSessions = await this.getActiveSessionsForUser(user.id);

            if (activeSessions.length >= maxSessions) {
                // Cerrar la sesión más antigua
                await this.closeOldestSession(user.id);
            }

            // Limpiar intentos fallidos exitosos
            await this.clearFailedAttempts(user.id);

            // Generar tokens
            const sessionData = await this.generateTokens(user, clientInfo);

            // Registrar sesión activa
            await this.registerActiveSession(user.id, sessionData.sessionId, clientInfo);

            // Log de login exitoso
            await this.logSecurityEvent('LOGIN_SUCCESS', username, 'Login exitoso', clientInfo);

            // Actualizar último login
            await this.updateLastLogin(user.id);

            console.log(`✅ Usuario autenticado exitosamente: ${username}`);

            return {
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    role: {
                        codigo: user.role_codigo,
                        nombre: user.role_nombre,
                        nivel: user.role_nivel,
                        permisos: JSON.parse(user.role_permisos || '[]')
                    }
                },
                tokens: {
                    accessToken: sessionData.accessToken,
                    refreshToken: sessionData.refreshToken
                },
                sessionId: sessionData.sessionId
            };

        } catch (error) {
            console.error('❌ Error en autenticación:', error);
            await this.logSecurityEvent('LOGIN_ERROR', username, error.message, clientInfo);

            return {
                success: false,
                error: 'Error interno del sistema',
                code: 'INTERNAL_ERROR'
            };
        }
    }

    /**
     * Generar tokens JWT y de refresh
     */
    async generateTokens(user, clientInfo) {
        const sessionId = this.generateSessionId();
        const now = Date.now();

        const payload = {
            userId: user.id,
            username: user.username,
            role: user.role_codigo,
            sessionId: sessionId,
            iat: Math.floor(now / 1000)
        };

        const accessToken = jwt.sign(payload, this.JWT_SECRET, {
            expiresIn: this.JWT_EXPIRATION,
            issuer: 'dysa-point',
            audience: 'restaurant-pos'
        });

        const refreshPayload = {
            userId: user.id,
            sessionId: sessionId,
            type: 'refresh',
            iat: Math.floor(now / 1000)
        };

        const refreshToken = jwt.sign(refreshPayload, this.JWT_SECRET, {
            expiresIn: this.REFRESH_EXPIRATION,
            issuer: 'dysa-point',
            audience: 'restaurant-pos'
        });

        return {
            sessionId,
            accessToken,
            refreshToken
        };
    }

    /**
     * Middleware de verificación de token
     */
    verifyToken() {
        return async (req, res, next) => {
            try {
                const authHeader = req.headers.authorization;

                if (!authHeader || !authHeader.startsWith('Bearer ')) {
                    return res.status(401).json({
                        success: false,
                        error: 'Token de acceso requerido',
                        code: 'NO_TOKEN'
                    });
                }

                const token = authHeader.substring(7);

                // Verificar token JWT
                const decoded = jwt.verify(token, this.JWT_SECRET, {
                    issuer: 'dysa-point',
                    audience: 'restaurant-pos'
                });

                // Verificar que la sesión esté activa
                const sessionActive = await this.isSessionActive(decoded.userId, decoded.sessionId);
                if (!sessionActive) {
                    return res.status(401).json({
                        success: false,
                        error: 'Sesión expirada o inválida',
                        code: 'SESSION_EXPIRED'
                    });
                }

                // Obtener información completa del usuario
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

                // Agregar información del usuario a la request
                req.user = {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    nombre: user.nombre,
                    apellido: user.apellido,
                    role: {
                        codigo: user.role_codigo,
                        nombre: user.role_nombre,
                        nivel: user.role_nivel,
                        permisos: JSON.parse(user.role_permisos || '[]')
                    },
                    sessionId: decoded.sessionId
                };

                // Actualizar actividad de la sesión
                await this.updateSessionActivity(decoded.userId, decoded.sessionId);

                next();

            } catch (error) {
                if (error.name === 'TokenExpiredError') {
                    return res.status(401).json({
                        success: false,
                        error: 'Token expirado',
                        code: 'TOKEN_EXPIRED'
                    });
                } else if (error.name === 'JsonWebTokenError') {
                    return res.status(401).json({
                        success: false,
                        error: 'Token inválido',
                        code: 'INVALID_TOKEN'
                    });
                }

                console.error('❌ Error verificando token:', error);
                return res.status(500).json({
                    success: false,
                    error: 'Error de autenticación',
                    code: 'AUTH_ERROR'
                });
            }
        };
    }

    /**
     * Middleware de verificación de permisos
     */
    requirePermission(permission) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado',
                    code: 'NOT_AUTHENTICATED'
                });
            }

            const userPermissions = req.user.role.permisos;

            if (!userPermissions.includes(permission) && !userPermissions.includes('*')) {
                console.log(`🚫 Acceso denegado - Usuario: ${req.user.username}, Permiso requerido: ${permission}`);

                return res.status(403).json({
                    success: false,
                    error: 'Permisos insuficientes',
                    code: 'INSUFFICIENT_PERMISSIONS',
                    required: permission
                });
            }

            next();
        };
    }

    /**
     * Middleware de verificación de rol mínimo
     */
    requireMinRole(minLevel) {
        return (req, res, next) => {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    error: 'Usuario no autenticado',
                    code: 'NOT_AUTHENTICATED'
                });
            }

            if (req.user.role.nivel < minLevel) {
                console.log(`🚫 Acceso denegado - Usuario: ${req.user.username}, Nivel requerido: ${minLevel}, Nivel actual: ${req.user.role.nivel}`);

                return res.status(403).json({
                    success: false,
                    error: 'Nivel de acceso insuficiente',
                    code: 'INSUFFICIENT_ROLE_LEVEL',
                    required: minLevel,
                    current: req.user.role.nivel
                });
            }

            next();
        };
    }

    /**
     * Cerrar sesión de usuario
     */
    async logout(userId, sessionId) {
        try {
            console.log(`🚪 Cerrando sesión - Usuario: ${userId}, Sesión: ${sessionId}`);

            // Marcar sesión como cerrada en BD
            await this.db.connection.execute(`
                UPDATE sesiones_usuario
                SET activa = 0, fecha_cierre = CURRENT_TIMESTAMP
                WHERE usuario_id = ? AND session_id = ? AND activa = 1
            `, [userId, sessionId]);

            // Remover de sesiones activas en memoria
            this.activeSessions.delete(`${userId}_${sessionId}`);

            await this.logSecurityEvent('LOGOUT', userId, 'Logout exitoso');

            return { success: true };

        } catch (error) {
            console.error('❌ Error cerrando sesión:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Cerrar todas las sesiones de un usuario
     */
    async logoutAllSessions(userId) {
        try {
            console.log(`🚪 Cerrando todas las sesiones - Usuario: ${userId}`);

            // Cerrar todas las sesiones en BD
            await this.db.connection.execute(`
                UPDATE sesiones_usuario
                SET activa = 0, fecha_cierre = CURRENT_TIMESTAMP
                WHERE usuario_id = ? AND activa = 1
            `, [userId]);

            // Remover sesiones de memoria
            for (const [key, session] of this.activeSessions.entries()) {
                if (session.userId === userId) {
                    this.activeSessions.delete(key);
                }
            }

            await this.logSecurityEvent('LOGOUT_ALL', userId, 'Cierre de todas las sesiones');

            return { success: true };

        } catch (error) {
            console.error('❌ Error cerrando todas las sesiones:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Métodos de utilidad y helpers
     */
    generateSessionId() {
        return require('crypto').randomBytes(32).toString('hex');
    }

    getMaxSessionsForRole(roleCode) {
        const limits = {
            'ADMIN': 3,
            'CAJERO': 2,
            'JEFE_GARZON': 2,
            'GARZON': 1,
            'COCINA': 1
        };
        return limits[roleCode] || 1;
    }

    async incrementFailedAttempts(userId) {
        await this.db.connection.execute(`
            UPDATE usuarios
            SET intentos_fallidos = intentos_fallidos + 1,
                ultimo_intento_fallido = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [userId]);
    }

    async clearFailedAttempts(userId) {
        await this.db.connection.execute(`
            UPDATE usuarios
            SET intentos_fallidos = 0,
                ultimo_intento_fallido = NULL
            WHERE id = ?
        `, [userId]);
    }

    async updateLastLogin(userId) {
        await this.db.connection.execute(`
            UPDATE usuarios
            SET ultimo_login = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [userId]);
    }

    async registerActiveSession(userId, sessionId, clientInfo) {
        await this.db.connection.execute(`
            INSERT INTO sesiones_usuario (
                usuario_id, session_id, ip_address, user_agent,
                fecha_inicio, ultima_actividad, activa
            ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
        `, [
            userId,
            sessionId,
            clientInfo.ip || 'unknown',
            clientInfo.userAgent || 'unknown'
        ]);

        // Guardar en memoria para acceso rápido
        this.activeSessions.set(`${userId}_${sessionId}`, {
            userId,
            sessionId,
            lastActivity: Date.now()
        });
    }

    async isSessionActive(userId, sessionId) {
        // Verificar primero en memoria
        const memorySession = this.activeSessions.get(`${userId}_${sessionId}`);
        if (!memorySession) {
            return false;
        }

        // Verificar en base de datos para casos edge
        const [sessions] = await this.db.connection.execute(`
            SELECT id FROM sesiones_usuario
            WHERE usuario_id = ? AND session_id = ? AND activa = 1
        `, [userId, sessionId]);

        return sessions.length > 0;
    }

    async updateSessionActivity(userId, sessionId) {
        // Actualizar en memoria
        const sessionKey = `${userId}_${sessionId}`;
        if (this.activeSessions.has(sessionKey)) {
            this.activeSessions.get(sessionKey).lastActivity = Date.now();
        }

        // Actualizar en BD cada 5 minutos para no sobrecargar
        const now = Date.now();
        const lastUpdate = this.activeSessions.get(sessionKey)?.lastDbUpdate || 0;

        if (now - lastUpdate > 5 * 60 * 1000) { // 5 minutos
            await this.db.connection.execute(`
                UPDATE sesiones_usuario
                SET ultima_actividad = CURRENT_TIMESTAMP
                WHERE usuario_id = ? AND session_id = ? AND activa = 1
            `, [userId, sessionId]);

            if (this.activeSessions.has(sessionKey)) {
                this.activeSessions.get(sessionKey).lastDbUpdate = now;
            }
        }
    }

    async getActiveSessionsForUser(userId) {
        const [sessions] = await this.db.connection.execute(`
            SELECT session_id FROM sesiones_usuario
            WHERE usuario_id = ? AND activa = 1
            ORDER BY fecha_inicio DESC
        `, [userId]);

        return sessions;
    }

    async closeOldestSession(userId) {
        const [oldestSession] = await this.db.connection.execute(`
            SELECT session_id FROM sesiones_usuario
            WHERE usuario_id = ? AND activa = 1
            ORDER BY fecha_inicio ASC
            LIMIT 1
        `, [userId]);

        if (oldestSession.length > 0) {
            await this.logout(userId, oldestSession[0].session_id);
        }
    }

    async logSecurityEvent(event, username, details, clientInfo = {}) {
        try {
            await this.db.connection.execute(`
                INSERT INTO logs_seguridad (
                    evento, username, detalles, ip_address, user_agent, fecha
                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [
                event,
                username,
                details,
                clientInfo.ip || 'unknown',
                clientInfo.userAgent || 'unknown'
            ]);
        } catch (error) {
            console.error('❌ Error registrando evento de seguridad:', error);
        }
    }

    /**
     * Limpieza automática de sesiones expiradas
     */
    startSessionCleanup() {
        setInterval(async () => {
            try {
                // Limpiar sesiones expiradas (más de 24 horas inactivas)
                await this.db.connection.execute(`
                    UPDATE sesiones_usuario
                    SET activa = 0, fecha_cierre = CURRENT_TIMESTAMP
                    WHERE activa = 1 AND ultima_actividad < DATE_SUB(NOW(), INTERVAL 24 HOUR)
                `);

                // Limpiar memoria de sesiones inactivas
                const now = Date.now();
                for (const [key, session] of this.activeSessions.entries()) {
                    if (now - session.lastActivity > 24 * 60 * 60 * 1000) {
                        this.activeSessions.delete(key);
                    }
                }

                console.log('🧹 Limpieza de sesiones completada');
            } catch (error) {
                console.error('❌ Error en limpieza de sesiones:', error);
            }
        }, 60 * 60 * 1000); // Cada hora
    }
}

module.exports = AuthenticationManager;