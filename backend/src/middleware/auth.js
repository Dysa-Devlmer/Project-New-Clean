/**
 * SYSME Backend - Middleware de Autenticación
 * Verificación de tokens JWT para proteger rutas
 * Fecha: 18 de Octubre 2025
 */

const jwt = require('jsonwebtoken');
const { executeQuery } = require('../config/database');

/**
 * Middleware para verificar autenticación JWT
 */
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) {
            return res.status(401).json({
                success: false,
                error: 'Token de acceso requerido',
                code: 'MISSING_TOKEN'
            });
        }

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sysme_secret_key');

        // Verificar que el empleado sigue activo
        const result = await executeQuery(
            'SELECT id, usuario_sistema, nombres, cargo, activo FROM empleados WHERE id = ? AND activo = 1',
            [decoded.id]
        );

        if (!result.success || result.data.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Token inválido o empleado inactivo',
                code: 'INVALID_TOKEN'
            });
        }

        // Agregar información del empleado al request
        req.empleado = result.data[0];
        req.empleado.terminal = decoded.terminal || 1;

        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                error: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                error: 'Token inválido',
                code: 'INVALID_TOKEN'
            });
        }

        console.error('❌ Error en middleware de autenticación:', error);
        return res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'AUTH_ERROR'
        });
    }
};

/**
 * Middleware para verificar rol específico
 */
const requireRole = (requiredRoles) => {
    return (req, res, next) => {
        if (!req.empleado) {
            return res.status(401).json({
                success: false,
                error: 'No autenticado',
                code: 'NOT_AUTHENTICATED'
            });
        }

        const userRole = req.empleado.cargo;
        const allowedRoles = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];

        if (!allowedRoles.includes(userRole)) {
            return res.status(403).json({
                success: false,
                error: 'Permisos insuficientes',
                code: 'INSUFFICIENT_PERMISSIONS',
                required: requiredRoles,
                current: userRole
            });
        }

        next();
    };
};

/**
 * Middleware opcional de autenticación (no bloquea si no hay token)
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sysme_secret_key');

            const result = await executeQuery(
                'SELECT id, usuario_sistema, nombres, cargo, activo FROM empleados WHERE id = ? AND activo = 1',
                [decoded.id]
            );

            if (result.success && result.data.length > 0) {
                req.empleado = result.data[0];
                req.empleado.terminal = decoded.terminal || 1;
            }
        }

        next();

    } catch (error) {
        // En autenticación opcional, los errores no bloquean la request
        next();
    }
};

module.exports = {
    authenticateToken,
    requireRole,
    optionalAuth
};