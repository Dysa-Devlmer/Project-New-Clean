/**
 * CONTROLADOR DE PERMISOS GRANULARES
 *
 * Gestiona los 7 permisos específicos por usuario
 * Registra auditoría de validaciones de permisos
 *
 * @author Claude Code
 * @date 2025-10-04
 */

const db = require('../config/database');

/**
 * Verificar si un usuario tiene un permiso específico
 */
exports.verificarPermiso = async (req, res) => {
    try {
        const { id_usuario, permiso } = req.query;

        if (!id_usuario || !permiso) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros: id_usuario y permiso son requeridos'
            });
        }

        const permisosValidos = [
            'borrar_linea',
            'modificar_ticket',
            'modificar_tras_precuenta',
            'finalizar_ventas',
            'cancelar_ticket',
            'precio_manual',
            'cambiar_tarifa',
            'generar_precuenta'
        ];

        if (!permisosValidos.includes(permiso)) {
            return res.status(400).json({
                success: false,
                message: 'Permiso no válido'
            });
        }

        const campo = `permiso_${permiso}`;

        const [usuarios] = await db.execute(
            `SELECT ${campo} as tiene_permiso, nombre, rol
            FROM usuarios
            WHERE id_usuario = ? AND activo = 'Y'`,
            [id_usuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const tienePermiso = usuarios[0].tiene_permiso === 'Y';

        res.json({
            success: true,
            tiene_permiso: tienePermiso,
            usuario: usuarios[0].nombre,
            rol: usuarios[0].rol,
            permiso
        });
    } catch (error) {
        console.error('Error al verificar permiso:', error);
        res.status(500).json({
            success: false,
            message: 'Error al verificar permiso',
            error: error.message
        });
    }
};

/**
 * Obtener todos los permisos de un usuario
 */
exports.obtenerPermisosUsuario = async (req, res) => {
    try {
        const { id_usuario } = req.params;

        const [usuarios] = await db.execute(
            `SELECT
                id_usuario,
                nombre,
                rol,
                permiso_borrar_linea,
                permiso_modificar_ticket,
                permiso_modificar_tras_precuenta,
                permiso_finalizar_ventas,
                permiso_cancelar_ticket,
                permiso_precio_manual,
                permiso_cambiar_tarifa,
                permiso_generar_precuenta
            FROM usuarios
            WHERE id_usuario = ? AND activo = 'Y'`,
            [id_usuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        const usuario = usuarios[0];
        const permisos = {
            borrar_linea: usuario.permiso_borrar_linea === 'Y',
            modificar_ticket: usuario.permiso_modificar_ticket === 'Y',
            modificar_tras_precuenta: usuario.permiso_modificar_tras_precuenta === 'Y',
            finalizar_ventas: usuario.permiso_finalizar_ventas === 'Y',
            cancelar_ticket: usuario.permiso_cancelar_ticket === 'Y',
            precio_manual: usuario.permiso_precio_manual === 'Y',
            cambiar_tarifa: usuario.permiso_cambiar_tarifa === 'Y',
            generar_precuenta: usuario.permiso_generar_precuenta === 'Y'
        };

        res.json({
            success: true,
            usuario: {
                id_usuario: usuario.id_usuario,
                nombre: usuario.nombre,
                rol: usuario.rol
            },
            permisos
        });
    } catch (error) {
        console.error('Error al obtener permisos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener permisos del usuario',
            error: error.message
        });
    }
};

/**
 * Actualizar permisos de un usuario
 */
exports.actualizarPermisos = async (req, res) => {
    try {
        const { id_usuario } = req.params;
        const permisos = req.body;

        // Verificar que usuario existe
        const [usuarios] = await db.execute(
            'SELECT id_usuario FROM usuarios WHERE id_usuario = ? AND activo = \'Y\'',
            [id_usuario]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuario no encontrado'
            });
        }

        // Construir UPDATE dinámicamente solo con permisos válidos
        const camposPermitidos = [
            'permiso_borrar_linea',
            'permiso_modificar_ticket',
            'permiso_modificar_tras_precuenta',
            'permiso_finalizar_ventas',
            'permiso_cancelar_ticket',
            'permiso_precio_manual',
            'permiso_cambiar_tarifa',
            'permiso_generar_precuenta'
        ];

        const updates = [];
        const values = [];

        for (const campo of camposPermitidos) {
            const key = campo.replace('permiso_', '');
            if (permisos.hasOwnProperty(key)) {
                updates.push(`${campo} = ?`);
                values.push(permisos[key] ? 'Y' : 'N');
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No se proporcionaron permisos para actualizar'
            });
        }

        values.push(id_usuario);

        await db.execute(
            `UPDATE usuarios SET ${updates.join(', ')} WHERE id_usuario = ?`,
            values
        );

        res.json({
            success: true,
            message: 'Permisos actualizados exitosamente'
        });
    } catch (error) {
        console.error('Error al actualizar permisos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar permisos',
            error: error.message
        });
    }
};

/**
 * Registrar log de validación de permiso (auditoría)
 */
exports.registrarLogPermiso = async (req, res) => {
    try {
        const {
            id_usuario,
            accion,
            permiso_requerido,
            permitido,
            id_venta = null,
            id_linea = null,
            detalles = null
        } = req.body;

        if (!id_usuario || !accion || !permiso_requerido || !permitido) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos obligatorios'
            });
        }

        const ip_address = req.ip || req.connection.remoteAddress;

        await db.execute(
            `INSERT INTO log_permisos (
                id_usuario,
                accion,
                permiso_requerido,
                permitido,
                id_venta,
                id_linea,
                detalles,
                ip_address
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [id_usuario, accion, permiso_requerido, permitido, id_venta, id_linea, detalles, ip_address]
        );

        res.json({
            success: true,
            message: 'Log de permiso registrado'
        });
    } catch (error) {
        console.error('Error al registrar log:', error);
        res.status(500).json({
            success: false,
            message: 'Error al registrar log de permiso',
            error: error.message
        });
    }
};

/**
 * Obtener logs de permisos (auditoría)
 */
exports.obtenerLogsPermisos = async (req, res) => {
    try {
        const { id_usuario, fecha_desde, fecha_hasta, permiso, limite = 100 } = req.query;

        let query = `
            SELECT
                lp.id_log,
                lp.id_usuario,
                u.nombre as usuario_nombre,
                lp.accion,
                lp.permiso_requerido,
                lp.permitido,
                lp.id_venta,
                lp.id_linea,
                lp.detalles,
                lp.fecha_hora,
                lp.ip_address
            FROM log_permisos lp
            LEFT JOIN usuarios u ON lp.id_usuario = u.id_usuario
            WHERE 1=1
        `;
        const params = [];

        if (id_usuario) {
            query += ' AND lp.id_usuario = ?';
            params.push(id_usuario);
        }

        if (fecha_desde) {
            query += ' AND lp.fecha_hora >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ' AND lp.fecha_hora <= ?';
            params.push(fecha_hasta);
        }

        if (permiso) {
            query += ' AND lp.permiso_requerido = ?';
            params.push(permiso);
        }

        query += ' ORDER BY lp.fecha_hora DESC LIMIT ?';
        params.push(parseInt(limite));

        const [logs] = await db.execute(query, params);

        res.json({
            success: true,
            logs,
            total: logs.length
        });
    } catch (error) {
        console.error('Error al obtener logs:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener logs de permisos',
            error: error.message
        });
    }
};

/**
 * Obtener plantillas de permisos por rol
 */
exports.obtenerPlantillasPorRol = async (req, res) => {
    try {
        const plantillas = {
            admin: {
                nombre: 'Administrador',
                descripcion: 'Acceso total al sistema',
                permisos: {
                    borrar_linea: true,
                    modificar_ticket: true,
                    modificar_tras_precuenta: true,
                    finalizar_ventas: true,
                    cancelar_ticket: true,
                    precio_manual: true,
                    cambiar_tarifa: true,
                    generar_precuenta: true
                }
            },
            garzon_senior: {
                nombre: 'Garzón Senior',
                descripcion: 'Garzón con permisos extendidos',
                permisos: {
                    borrar_linea: true,
                    modificar_ticket: true,
                    modificar_tras_precuenta: false,
                    finalizar_ventas: true,
                    cancelar_ticket: false,
                    precio_manual: false,
                    cambiar_tarifa: false,
                    generar_precuenta: false
                }
            },
            garzon: {
                nombre: 'Garzón',
                descripcion: 'Garzón estándar',
                permisos: {
                    borrar_linea: false,
                    modificar_ticket: false,
                    modificar_tras_precuenta: false,
                    finalizar_ventas: true,
                    cancelar_ticket: false,
                    precio_manual: false,
                    cambiar_tarifa: false,
                    generar_precuenta: false
                }
            },
            cajero: {
                nombre: 'Cajero',
                descripcion: 'Personal de caja',
                permisos: {
                    borrar_linea: false,
                    modificar_ticket: true,
                    modificar_tras_precuenta: true,
                    finalizar_ventas: true,
                    cancelar_ticket: true,
                    precio_manual: true,
                    cambiar_tarifa: false,
                    generar_precuenta: true
                }
            }
        };

        res.json({
            success: true,
            plantillas
        });
    } catch (error) {
        console.error('Error al obtener plantillas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener plantillas de permisos',
            error: error.message
        });
    }
};
