/**
 * DYSA Point - Sistema de Autenticación de Garzones
 * Sistema simple y práctico para identificación de garzones en el restaurante
 *
 * Funcionalidades:
 * - Códigos privados de 4-6 dígitos por garzón
 * - Validación rápida para apertura de mesas
 * - Tracking de comandas por garzón
 * - Sistema de permisos básico por rol
 * - Cache en memoria para acceso rápido
 */

class GarzonAuthManager {
    constructor(databaseManager) {
        this.db = databaseManager;
        this.garzonesCache = new Map(); // Cache para acceso rápido
        this.sessionTimeouts = new Map(); // Timeouts de sesiones temporales
        this.loadGarzones(); // Cargar garzones al inicializar
    }

    /**
     * Cargar todos los garzones activos en memoria
     */
    async loadGarzones() {
        try {
            const [garzones] = await this.db.connection.execute(`
                SELECT u.id, u.nombre, u.apellido, u.codigo_privado,
                       r.codigo as role_codigo, r.nombre as role_nombre,
                       r.nivel as role_nivel, r.permisos as role_permisos
                FROM usuarios u
                INNER JOIN roles r ON u.role_id = r.id
                WHERE u.activo = 1 AND r.codigo IN ('GARZON', 'JEFE_GARZON', 'CAJERO', 'ADMIN')
                ORDER BY r.nivel DESC, u.nombre ASC
            `);

            this.garzonesCache.clear();

            for (const garzon of garzones) {
                this.garzonesCache.set(garzon.codigo_privado, {
                    id: garzon.id,
                    nombre: garzon.nombre,
                    apellido: garzon.apellido,
                    nombreCompleto: `${garzon.nombre} ${garzon.apellido}`,
                    codigo: garzon.codigo_privado,
                    role: {
                        codigo: garzon.role_codigo,
                        nombre: garzon.role_nombre,
                        nivel: garzon.role_nivel,
                        permisos: JSON.parse(garzon.role_permisos || '[]')
                    }
                });
            }

            console.log(`✅ ${garzones.length} garzones cargados en memoria`);
            return true;

        } catch (error) {
            console.error('❌ Error cargando garzones:', error);
            return false;
        }
    }

    /**
     * Validar código de garzón y retornar información
     */
    async validateGarzonCode(codigo, accion = 'comandar') {
        try {
            // Verificar en cache primero
            const garzon = this.garzonesCache.get(codigo);

            if (!garzon) {
                console.log(`❌ Código de garzón inválido: ${codigo}`);
                return {
                    success: false,
                    error: 'Código de garzón inválido',
                    code: 'INVALID_GARZON_CODE'
                };
            }

            // Verificar permisos para la acción
            if (!this.hasPermissionForAction(garzon, accion)) {
                console.log(`🚫 Garzón ${garzon.nombreCompleto} sin permisos para: ${accion}`);
                return {
                    success: false,
                    error: 'No tiene permisos para esta acción',
                    code: 'INSUFFICIENT_PERMISSIONS'
                };
            }

            // Registrar actividad del garzón
            await this.logGarzonActivity(garzon.id, accion);

            console.log(`✅ Código validado - Garzón: ${garzon.nombreCompleto} - Acción: ${accion}`);

            return {
                success: true,
                garzon: {
                    id: garzon.id,
                    nombre: garzon.nombre,
                    apellido: garzon.apellido,
                    nombreCompleto: garzon.nombreCompleto,
                    role: garzon.role
                }
            };

        } catch (error) {
            console.error('❌ Error validando código de garzón:', error);
            return {
                success: false,
                error: 'Error de validación',
                code: 'VALIDATION_ERROR'
            };
        }
    }

    /**
     * Verificar permisos del garzón para una acción específica
     */
    hasPermissionForAction(garzon, accion) {
        const permisos = garzon.role.permisos;
        const roleCode = garzon.role.codigo;

        // Mapa de acciones y permisos requeridos
        const accionPermisos = {
            'comandar': ['ventas.crear', 'mesas.usar'],
            'abrir_mesa': ['ventas.crear', 'mesas.abrir'],
            'cerrar_mesa': ['ventas.cerrar', 'mesas.cerrar'],
            'cancelar_producto': ['ventas.cancelar'],
            'modificar_comanda': ['ventas.modificar'],
            'ver_ventas': ['ventas.ver'],
            'imprimir_comanda': ['impresion.cocina'],
            'imprimir_cuenta': ['impresion.cuenta'],
            'abrir_caja': ['caja.abrir'],
            'cerrar_caja': ['caja.cerrar'],
            'ver_reportes': ['reportes.ver'],
            'administrar_usuarios': ['admin.usuarios'],
            'configurar_sistema': ['admin.config']
        };

        const permisosRequeridos = accionPermisos[accion] || [];

        // Super admin tiene todos los permisos
        if (permisos.includes('*') || roleCode === 'ADMIN') {
            return true;
        }

        // Verificar si tiene los permisos específicos
        return permisosRequeridos.every(permiso =>
            permisos.includes(permiso) || permisos.includes(permiso.split('.')[0] + '.*')
        );
    }

    /**
     * Crear sesión temporal para acciones múltiples
     */
    createTemporarySession(garzonId, duracionMinutos = 30) {
        const sessionId = require('crypto').randomBytes(16).toString('hex');
        const expiration = Date.now() + (duracionMinutos * 60 * 1000);

        // Limpiar sesión anterior si existe
        this.clearGarzonSessions(garzonId);

        // Crear nueva sesión
        const timeout = setTimeout(() => {
            this.sessionTimeouts.delete(sessionId);
            console.log(`⏰ Sesión temporal expirada para garzón: ${garzonId}`);
        }, duracionMinutos * 60 * 1000);

        this.sessionTimeouts.set(sessionId, {
            garzonId,
            expiration,
            timeout
        });

        console.log(`🕐 Sesión temporal creada para garzón: ${garzonId} (${duracionMinutos} min)`);

        return {
            sessionId,
            expiresAt: new Date(expiration).toISOString(),
            durationMinutes: duracionMinutos
        };
    }

    /**
     * Validar sesión temporal
     */
    validateTemporarySession(sessionId, garzonId) {
        const session = this.sessionTimeouts.get(sessionId);

        if (!session) {
            return {
                success: false,
                error: 'Sesión no encontrada o expirada',
                code: 'SESSION_NOT_FOUND'
            };
        }

        if (session.garzonId !== garzonId) {
            return {
                success: false,
                error: 'Sesión no válida para este garzón',
                code: 'SESSION_MISMATCH'
            };
        }

        if (Date.now() > session.expiration) {
            // Limpiar sesión expirada
            clearTimeout(session.timeout);
            this.sessionTimeouts.delete(sessionId);

            return {
                success: false,
                error: 'Sesión expirada',
                code: 'SESSION_EXPIRED'
            };
        }

        return {
            success: true,
            session: {
                sessionId,
                garzonId: session.garzonId,
                expiresAt: new Date(session.expiration).toISOString()
            }
        };
    }

    /**
     * Cerrar sesión temporal
     */
    closeTemporarySession(sessionId) {
        const session = this.sessionTimeouts.get(sessionId);
        if (session) {
            clearTimeout(session.timeout);
            this.sessionTimeouts.delete(sessionId);
            console.log(`🚪 Sesión temporal cerrada: ${sessionId}`);
            return true;
        }
        return false;
    }

    /**
     * Limpiar todas las sesiones de un garzón
     */
    clearGarzonSessions(garzonId) {
        for (const [sessionId, session] of this.sessionTimeouts.entries()) {
            if (session.garzonId === garzonId) {
                clearTimeout(session.timeout);
                this.sessionTimeouts.delete(sessionId);
            }
        }
    }

    /**
     * Obtener lista de garzones activos
     */
    getActiveGarzones() {
        const garzones = Array.from(this.garzonesCache.values());
        return garzones.map(garzon => ({
            id: garzon.id,
            nombre: garzon.nombre,
            apellido: garzon.apellido,
            nombreCompleto: garzon.nombreCompleto,
            role: garzon.role.nombre,
            nivel: garzon.role.nivel
        }));
    }

    /**
     * Obtener información de un garzón por ID
     */
    getGarzonById(garzonId) {
        for (const garzon of this.garzonesCache.values()) {
            if (garzon.id === garzonId) {
                return garzon;
            }
        }
        return null;
    }

    /**
     * Generar código privado único para nuevo garzón
     */
    async generateUniqueCode() {
        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            // Generar código de 4 dígitos
            const codigo = Math.floor(1000 + Math.random() * 9000).toString();

            // Verificar que no exista
            if (!this.garzonesCache.has(codigo)) {
                // Verificar en base de datos para estar seguro
                const [existing] = await this.db.connection.execute(
                    'SELECT id FROM usuarios WHERE codigo_privado = ?',
                    [codigo]
                );

                if (existing.length === 0) {
                    return codigo;
                }
            }

            attempts++;
        }

        throw new Error('No se pudo generar un código único después de múltiples intentos');
    }

    /**
     * Crear nuevo garzón con código
     */
    async createGarzon(datos) {
        try {
            const {
                nombre,
                apellido,
                email,
                telefono,
                roleId,
                codigoPrivado = null
            } = datos;

            // Generar código si no se proporciona
            const codigo = codigoPrivado || await this.generateUniqueCode();

            // Validar datos
            if (!nombre || !apellido) {
                throw new Error('Nombre y apellido son requeridos');
            }

            // Insertar en base de datos
            const [result] = await this.db.connection.execute(`
                INSERT INTO usuarios (
                    nombre, apellido, email, telefono, codigo_privado,
                    role_id, activo, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [nombre, apellido, email, telefono, codigo, roleId]);

            // Recargar cache
            await this.loadGarzones();

            console.log(`✅ Garzón creado: ${nombre} ${apellido} - Código: ${codigo}`);

            return {
                success: true,
                garzon: {
                    id: result.insertId,
                    nombre,
                    apellido,
                    codigo
                }
            };

        } catch (error) {
            console.error('❌ Error creando garzón:', error);
            return {
                success: false,
                error: error.message,
                code: 'CREATE_GARZON_ERROR'
            };
        }
    }

    /**
     * Actualizar código de garzón
     */
    async updateGarzonCode(garzonId, nuevoCodigo) {
        try {
            // Verificar que el código no exista
            if (this.garzonesCache.has(nuevoCodigo)) {
                return {
                    success: false,
                    error: 'El código ya está en uso',
                    code: 'CODE_IN_USE'
                };
            }

            // Actualizar en base de datos
            await this.db.connection.execute(
                'UPDATE usuarios SET codigo_privado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                [nuevoCodigo, garzonId]
            );

            // Recargar cache
            await this.loadGarzones();

            console.log(`✅ Código actualizado para garzón ID: ${garzonId} - Nuevo código: ${nuevoCodigo}`);

            return {
                success: true,
                message: 'Código actualizado exitosamente'
            };

        } catch (error) {
            console.error('❌ Error actualizando código:', error);
            return {
                success: false,
                error: error.message,
                code: 'UPDATE_CODE_ERROR'
            };
        }
    }

    /**
     * Registrar actividad del garzón
     */
    async logGarzonActivity(garzonId, accion, detalles = '') {
        try {
            await this.db.connection.execute(`
                INSERT INTO actividad_garzones (
                    garzon_id, accion, detalles, fecha
                ) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            `, [garzonId, accion, detalles]);

        } catch (error) {
            console.error('❌ Error registrando actividad:', error);
        }
    }

    /**
     * Obtener actividad reciente de un garzón
     */
    async getGarzonActivity(garzonId, limite = 50) {
        try {
            const [activities] = await this.db.connection.execute(`
                SELECT accion, detalles, fecha
                FROM actividad_garzones
                WHERE garzon_id = ?
                ORDER BY fecha DESC
                LIMIT ?
            `, [garzonId, limite]);

            return activities;

        } catch (error) {
            console.error('❌ Error obteniendo actividad:', error);
            return [];
        }
    }

    /**
     * Middleware Express para validación de código de garzón
     */
    validateGarzonMiddleware(accion = 'comandar') {
        return async (req, res, next) => {
            try {
                const codigo = req.headers['x-garzon-code'] || req.body.garzonCode;

                if (!codigo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Código de garzón requerido',
                        code: 'GARZON_CODE_REQUIRED'
                    });
                }

                const result = await this.validateGarzonCode(codigo, accion);

                if (!result.success) {
                    return res.status(401).json(result);
                }

                // Agregar información del garzón a la request
                req.garzon = result.garzon;

                next();

            } catch (error) {
                console.error('❌ Error en middleware de garzón:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error de validación',
                    code: 'MIDDLEWARE_ERROR'
                });
            }
        };
    }

    /**
     * Limpiar recursos al cerrar
     */
    cleanup() {
        // Limpiar todos los timeouts
        for (const [sessionId, session] of this.sessionTimeouts.entries()) {
            clearTimeout(session.timeout);
        }
        this.sessionTimeouts.clear();
        this.garzonesCache.clear();
        console.log('🧹 Limpieza de GarzonAuthManager completada');
    }
}

module.exports = GarzonAuthManager;