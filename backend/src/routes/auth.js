/**
 * SYSME Backend - Rutas de Autenticación
 * Sistema de login para empleados del restaurante
 * Compatible con sistema antiguo de SYSME
 * Fecha: 18 de Octubre 2025
 */

const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { executeQuery, queries } = require('../config/database');

const router = express.Router();

/**
 * POST /api/auth/login
 * Login de empleados - Compatible con sistema antiguo
 */
router.post('/login', async (req, res) => {
    try {
        const { usuario, password } = req.body;

        console.log(`🔐 Intento de login: ${usuario}`);

        if (!usuario || !password) {
            return res.status(400).json({
                success: false,
                error: 'Usuario y contraseña son requeridos',
                code: 'MISSING_CREDENTIALS'
            });
        }

        // Buscar empleado en base de datos
        const result = await executeQuery(queries.getEmpleadoByCredentials, [usuario]);

        if (!result.success || result.data.length === 0) {
            console.log(`❌ Usuario no encontrado: ${usuario}`);
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const empleado = result.data[0];

        // Verificar contraseña
        let passwordValid = false;

        // Para desarrollo: verificar si la contraseña coincide directamente
        if (empleado.password_hash && empleado.password_hash.length < 50) {
            // Contraseña en texto plano (desarrollo)
            passwordValid = (password === empleado.password_hash);
        }
        // Contraseña con bcrypt (producción)
        else if (empleado.password_hash && empleado.password_hash.startsWith('$2b$')) {
            passwordValid = await bcrypt.compare(password, empleado.password_hash);
        }
        // Fallback: usuario = contraseña para desarrollo
        else {
            passwordValid = (password === empleado.usuario_sistema);
        }

        if (!passwordValid) {
            console.log(`❌ Contraseña incorrecta para: ${usuario}`);
            return res.status(401).json({
                success: false,
                error: 'Credenciales inválidas',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Generar JWT token
        const token = jwt.sign(
            {
                id: empleado.id,
                usuario: empleado.usuario_sistema,
                nombre: empleado.nombres,
                apellido: empleado.apellido_paterno,
                cargo: empleado.cargo,
                terminal: 1 // Terminal por defecto
            },
            process.env.JWT_SECRET || 'sysme_secret_key',
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Actualizar último acceso (CORREGIDO: columna real)
        await executeQuery(
            'UPDATE empleados SET ultimo_acceso_exitoso = NOW() WHERE id = ?',
            [empleado.id]
        );

        console.log(`✅ Login exitoso: ${usuario} (${empleado.nombres})`);

        res.json({
            success: true,
            message: 'Login exitoso',
            data: {
                token,
                empleado: {
                    id: empleado.id,
                    usuario: empleado.usuario_sistema,
                    nombre: empleado.nombres,
                    apellido: empleado.apellido_paterno,
                    cargo: empleado.cargo,
                    activo: empleado.activo,
                    ultimo_login: new Date().toISOString()
                }
            }
        });

    } catch (error) {
        console.error('❌ Error en login:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'LOGIN_ERROR'
        });
    }
});

/**
 * POST /api/auth/verify
 * Verificar token JWT
 */
router.post('/verify', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({
                success: false,
                error: 'Token requerido',
                code: 'MISSING_TOKEN'
            });
        }

        // Verificar token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sysme_secret_key');

        // Verificar que el empleado sigue activo
        const result = await executeQuery(
            'SELECT * FROM empleados WHERE id = ? AND activo = 1',
            [decoded.id]
        );

        if (!result.success || result.data.length === 0) {
            return res.status(401).json({
                success: false,
                error: 'Token inválido o empleado inactivo',
                code: 'INVALID_TOKEN'
            });
        }

        const empleado = result.data[0];

        res.json({
            success: true,
            valid: true,
            data: {
                empleado: {
                    id: empleado.id,
                    usuario: empleado.usuario_sistema,
                    nombre: empleado.nombres,
                    apellido: empleado.apellido_paterno,
                    cargo: empleado.cargo,
                    terminal_asignado: 1 // Por defecto
                }
            }
        });

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

        console.error('❌ Error verificando token:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'VERIFY_ERROR'
        });
    }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
router.post('/logout', async (req, res) => {
    try {
        // En un sistema más avanzado, aquí podríamos invalidar el token
        // Por ahora, simplemente confirmamos el logout

        res.json({
            success: true,
            message: 'Sesión cerrada exitosamente'
        });

    } catch (error) {
        console.error('❌ Error en logout:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor',
            code: 'LOGOUT_ERROR'
        });
    }
});

/**
 * GET /api/auth/empleados
 * Listar empleados activos (solo para admin)
 */
router.get('/empleados', async (req, res) => {
    try {
        const result = await executeQuery(
            'SELECT id, usuario, nombre, apellido, rol_id, activo, created_at FROM empleados WHERE activo = 1 ORDER BY nombre',
            []
        );

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener empleados'
            });
        }

        res.json({
            success: true,
            data: result.data
        });

    } catch (error) {
        console.error('❌ Error obteniendo empleados:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

module.exports = router;