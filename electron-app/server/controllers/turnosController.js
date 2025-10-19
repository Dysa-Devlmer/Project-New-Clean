/**
 * =====================================================
 * CONTROLADOR DE GESTIÓN DE TURNOS Y ASISTENCIA
 * Descripción: Control completo de turnos, horarios y asistencia de empleados
 * Autor: Devlmer - Dysa
 * Fecha: 2025-10-05 03:26 AM
 * PRODUCCIÓN: Sistema real para restaurante
 * =====================================================
 */

const { pool } = require('../config/database');

// =====================================================
// TURNOS (DEFINICIONES)
// =====================================================

/**
 * Obtener todos los turnos
 * @route GET /api/turnos
 */
async function obtenerTurnos(req, res) {
    try {
        const { activo } = req.query;

        let query = 'SELECT * FROM turnos WHERE 1=1';
        let params = [];

        if (activo !== undefined) {
            query += ' AND activo = ?';
            params.push(activo);
        }

        query += ' ORDER BY hora_inicio';

        const [turnos] = await pool.query(query, params);

        res.json({
            success: true,
            data: turnos
        });

    } catch (error) {
        console.error('Error al obtener turnos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener turnos',
            detalle: error.message
        });
    }
}

/**
 * Obtener turno por ID
 * @route GET /api/turnos/:id_turno
 */
async function obtenerTurnoPorId(req, res) {
    try {
        const { id_turno } = req.params;

        const [turno] = await pool.query(
            'SELECT * FROM turnos WHERE id_turno = ? AND activo = "Y"',
            [id_turno]
        );

        if (turno.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Turno no encontrado'
            });
        }

        res.json({
            success: true,
            data: turno[0]
        });

    } catch (error) {
        console.error('Error al obtener turno:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener turno',
            detalle: error.message
        });
    }
}

/**
 * Crear nuevo turno
 * @route POST /api/turnos
 */
async function crearTurno(req, res) {
    try {
        const {
            nombre,
            hora_inicio,
            hora_fin,
            lunes = 'N',
            martes = 'N',
            miercoles = 'N',
            jueves = 'N',
            viernes = 'N',
            sabado = 'N',
            domingo = 'N',
            minutos_tolerancia = 15,
            color = '#3b82f6',
            descripcion
        } = req.body;

        // Validaciones
        if (!nombre || !hora_inicio || !hora_fin) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren nombre, hora_inicio y hora_fin'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO turnos (
                nombre, hora_inicio, hora_fin,
                lunes, martes, miercoles, jueves, viernes, sabado, domingo,
                minutos_tolerancia, color, descripcion
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                nombre, hora_inicio, hora_fin,
                lunes, martes, miercoles, jueves, viernes, sabado, domingo,
                minutos_tolerancia, color, descripcion
            ]
        );

        res.json({
            success: true,
            data: {
                id_turno: result.insertId,
                mensaje: 'Turno creado exitosamente'
            }
        });

    } catch (error) {
        console.error('Error al crear turno:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear turno',
            detalle: error.message
        });
    }
}

/**
 * Actualizar turno
 * @route PUT /api/turnos/:id_turno
 */
async function actualizarTurno(req, res) {
    try {
        const { id_turno } = req.params;
        const {
            nombre,
            hora_inicio,
            hora_fin,
            lunes,
            martes,
            miercoles,
            jueves,
            viernes,
            sabado,
            domingo,
            minutos_tolerancia,
            color,
            descripcion
        } = req.body;

        await pool.query(
            `UPDATE turnos
             SET nombre = ?,
                 hora_inicio = ?,
                 hora_fin = ?,
                 lunes = ?,
                 martes = ?,
                 miercoles = ?,
                 jueves = ?,
                 viernes = ?,
                 sabado = ?,
                 domingo = ?,
                 minutos_tolerancia = ?,
                 color = ?,
                 descripcion = ?
             WHERE id_turno = ?`,
            [
                nombre, hora_inicio, hora_fin,
                lunes, martes, miercoles, jueves, viernes, sabado, domingo,
                minutos_tolerancia, color, descripcion,
                id_turno
            ]
        );

        res.json({
            success: true,
            mensaje: 'Turno actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar turno:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar turno',
            detalle: error.message
        });
    }
}

/**
 * Eliminar turno (soft delete)
 * @route DELETE /api/turnos/:id_turno
 */
async function eliminarTurno(req, res) {
    try {
        const { id_turno } = req.params;

        await pool.query(
            'UPDATE turnos SET activo = "N" WHERE id_turno = ?',
            [id_turno]
        );

        res.json({
            success: true,
            mensaje: 'Turno eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar turno:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar turno',
            detalle: error.message
        });
    }
}

// =====================================================
// HORARIOS (ASIGNACIÓN EMPLEADO-TURNO)
// =====================================================

/**
 * Obtener horarios
 * @route GET /api/horarios
 */
async function obtenerHorarios(req, res) {
    try {
        const { id_usuario, activo } = req.query;

        let query = 'SELECT * FROM vista_horarios_activos WHERE 1=1';
        let params = [];

        if (id_usuario) {
            query += ' AND id_usuario = ?';
            params.push(id_usuario);
        }

        if (activo !== undefined) {
            query += ' AND estado_vigencia = ?';
            params.push(activo === 'Y' ? 'Activo' : 'Vencido');
        }

        const [horarios] = await pool.query(query, params);

        res.json({
            success: true,
            data: horarios
        });

    } catch (error) {
        console.error('Error al obtener horarios:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener horarios',
            detalle: error.message
        });
    }
}

/**
 * Asignar horario a empleado
 * @route POST /api/horarios
 */
async function asignarHorario(req, res) {
    try {
        const {
            id_usuario,
            id_turno,
            fecha_inicio,
            fecha_fin,
            es_permanente = 'Y',
            observaciones
        } = req.body;

        // Validaciones
        if (!id_usuario || !id_turno || !fecha_inicio) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_usuario, id_turno y fecha_inicio'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO horarios (
                id_usuario, id_turno, fecha_inicio, fecha_fin,
                es_permanente, observaciones
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [id_usuario, id_turno, fecha_inicio, fecha_fin, es_permanente, observaciones]
        );

        res.json({
            success: true,
            data: {
                id_horario: result.insertId,
                mensaje: 'Horario asignado exitosamente'
            }
        });

    } catch (error) {
        console.error('Error al asignar horario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al asignar horario',
            detalle: error.message
        });
    }
}

/**
 * Actualizar horario
 * @route PUT /api/horarios/:id_horario
 */
async function actualizarHorario(req, res) {
    try {
        const { id_horario } = req.params;
        const {
            id_turno,
            fecha_inicio,
            fecha_fin,
            es_permanente,
            observaciones
        } = req.body;

        await pool.query(
            `UPDATE horarios
             SET id_turno = ?,
                 fecha_inicio = ?,
                 fecha_fin = ?,
                 es_permanente = ?,
                 observaciones = ?
             WHERE id_horario = ?`,
            [id_turno, fecha_inicio, fecha_fin, es_permanente, observaciones, id_horario]
        );

        res.json({
            success: true,
            mensaje: 'Horario actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar horario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al actualizar horario',
            detalle: error.message
        });
    }
}

/**
 * Eliminar horario (soft delete)
 * @route DELETE /api/horarios/:id_horario
 */
async function eliminarHorario(req, res) {
    try {
        const { id_horario } = req.params;

        await pool.query(
            'UPDATE horarios SET activo = "N" WHERE id_horario = ?',
            [id_horario]
        );

        res.json({
            success: true,
            mensaje: 'Horario eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar horario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al eliminar horario',
            detalle: error.message
        });
    }
}

// =====================================================
// ASISTENCIAS (REGISTRO DE ENTRADA/SALIDA)
// =====================================================

/**
 * Registrar entrada
 * @route POST /api/asistencias/entrada
 */
async function registrarEntrada(req, res) {
    try {
        const {
            id_usuario,
            fecha,
            hora_entrada
        } = req.body;

        // Validaciones
        if (!id_usuario || !fecha || !hora_entrada) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_usuario, fecha y hora_entrada'
            });
        }

        const [result] = await pool.query(
            'CALL sp_registrar_entrada(?, ?, ?, @id_asistencia, @mensaje)',
            [id_usuario, fecha, hora_entrada]
        );

        const [output] = await pool.query(
            'SELECT @id_asistencia AS id_asistencia, @mensaje AS mensaje'
        );

        if (output[0].id_asistencia > 0) {
            res.json({
                success: true,
                data: {
                    id_asistencia: output[0].id_asistencia,
                    mensaje: output[0].mensaje
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: output[0].mensaje
            });
        }

    } catch (error) {
        console.error('Error al registrar entrada:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar entrada',
            detalle: error.message
        });
    }
}

/**
 * Registrar salida
 * @route POST /api/asistencias/salida
 */
async function registrarSalida(req, res) {
    try {
        const {
            id_usuario,
            fecha,
            hora_salida
        } = req.body;

        // Validaciones
        if (!id_usuario || !fecha || !hora_salida) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_usuario, fecha y hora_salida'
            });
        }

        const [result] = await pool.query(
            'CALL sp_registrar_salida(?, ?, ?, @mensaje)',
            [id_usuario, fecha, hora_salida]
        );

        const [output] = await pool.query('SELECT @mensaje AS mensaje');

        if (output[0].mensaje.includes('registrada')) {
            res.json({
                success: true,
                mensaje: output[0].mensaje
            });
        } else {
            res.status(400).json({
                success: false,
                error: output[0].mensaje
            });
        }

    } catch (error) {
        console.error('Error al registrar salida:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar salida',
            detalle: error.message
        });
    }
}

/**
 * Obtener asistencias
 * @route GET /api/asistencias
 */
async function obtenerAsistencias(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            id_usuario,
            estado
        } = req.query;

        let query = 'SELECT * FROM vista_asistencias_consolidadas WHERE 1=1';
        let params = [];

        if (fecha_desde) {
            query += ' AND fecha >= ?';
            params.push(fecha_desde);
        }

        if (fecha_hasta) {
            query += ' AND fecha <= ?';
            params.push(fecha_hasta);
        }

        if (id_usuario) {
            query += ' AND id_usuario = ?';
            params.push(id_usuario);
        }

        if (estado) {
            query += ' AND estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY fecha DESC, hora_entrada DESC';

        const [asistencias] = await pool.query(query, params);

        res.json({
            success: true,
            data: asistencias
        });

    } catch (error) {
        console.error('Error al obtener asistencias:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener asistencias',
            detalle: error.message
        });
    }
}

/**
 * Obtener asistencias de un usuario (mes específico)
 * @route GET /api/asistencias/usuario/:id_usuario
 */
async function obtenerAsistenciasUsuario(req, res) {
    try {
        const { id_usuario } = req.params;
        const { mes, año } = req.query;

        const [asistencias] = await pool.query(
            'CALL sp_obtener_asistencias_mes(?, ?, ?)',
            [id_usuario, mes, año]
        );

        res.json({
            success: true,
            data: asistencias[0]
        });

    } catch (error) {
        console.error('Error al obtener asistencias de usuario:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener asistencias de usuario',
            detalle: error.message
        });
    }
}

/**
 * Obtener estadísticas de asistencia
 * @route GET /api/asistencias/estadisticas
 */
async function obtenerEstadisticas(req, res) {
    try {
        const {
            id_usuario,
            fecha_desde,
            fecha_hasta
        } = req.query;

        if (!id_usuario || !fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_usuario, fecha_desde y fecha_hasta'
            });
        }

        const [stats] = await pool.query(
            'CALL sp_estadisticas_asistencia(?, ?, ?)',
            [id_usuario, fecha_desde, fecha_hasta]
        );

        res.json({
            success: true,
            data: stats[0][0]
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener estadísticas',
            detalle: error.message
        });
    }
}

/**
 * Registrar asistencia manual
 * @route POST /api/asistencias/manual
 */
async function registrarAsistenciaManual(req, res) {
    try {
        const {
            id_usuario,
            id_turno,
            fecha,
            hora_entrada,
            hora_salida,
            observaciones
        } = req.body;

        // Validaciones
        if (!id_usuario || !fecha || !hora_entrada || !hora_salida) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_usuario, fecha, hora_entrada y hora_salida'
            });
        }

        // Calcular minutos trabajados
        const [horas] = await pool.query(
            'SELECT TIMESTAMPDIFF(MINUTE, ?, ?) AS minutos',
            [hora_entrada, hora_salida]
        );

        const minutos_trabajados = horas[0].minutos;
        const horas_trabajadas = (minutos_trabajados / 60).toFixed(2);

        const [result] = await pool.query(
            `INSERT INTO asistencias (
                id_usuario, id_turno, fecha,
                hora_entrada, hora_salida,
                minutos_trabajados, horas_trabajadas,
                estado, observaciones
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'completado', ?)`,
            [
                id_usuario, id_turno, fecha,
                hora_entrada, hora_salida,
                minutos_trabajados, horas_trabajadas,
                observaciones
            ]
        );

        res.json({
            success: true,
            data: {
                id_asistencia: result.insertId,
                mensaje: 'Asistencia registrada manualmente',
                horas_trabajadas: parseFloat(horas_trabajadas)
            }
        });

    } catch (error) {
        console.error('Error al registrar asistencia manual:', error);
        res.status(500).json({
            success: false,
            error: 'Error al registrar asistencia manual',
            detalle: error.message
        });
    }
}

// =====================================================
// SOLICITUDES DE CAMBIO DE TURNO
// =====================================================

/**
 * Crear solicitud de cambio
 * @route POST /api/turnos/solicitudes
 */
async function crearSolicitudCambio(req, res) {
    try {
        const {
            id_usuario_solicita,
            id_usuario_acepta,
            id_turno_original,
            id_turno_nuevo,
            fecha_cambio,
            motivo
        } = req.body;

        // Validaciones
        if (!id_usuario_solicita || !id_turno_original || !fecha_cambio) {
            return res.status(400).json({
                success: false,
                error: 'Faltan datos requeridos'
            });
        }

        const [result] = await pool.query(
            `INSERT INTO solicitudes_cambio_turno (
                id_usuario_solicita, id_usuario_acepta,
                id_turno_original, id_turno_nuevo,
                fecha_cambio, motivo
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [
                id_usuario_solicita, id_usuario_acepta,
                id_turno_original, id_turno_nuevo,
                fecha_cambio, motivo
            ]
        );

        res.json({
            success: true,
            data: {
                id_solicitud: result.insertId,
                mensaje: 'Solicitud creada exitosamente'
            }
        });

    } catch (error) {
        console.error('Error al crear solicitud:', error);
        res.status(500).json({
            success: false,
            error: 'Error al crear solicitud',
            detalle: error.message
        });
    }
}

/**
 * Obtener solicitudes
 * @route GET /api/turnos/solicitudes
 */
async function obtenerSolicitudes(req, res) {
    try {
        const { estado, id_usuario } = req.query;

        let query = `
            SELECT
                s.*,
                u1.nombre AS usuario_solicita_nombre,
                u2.nombre AS usuario_acepta_nombre,
                u3.nombre AS usuario_aprueba_nombre,
                t1.nombre AS turno_original_nombre,
                t2.nombre AS turno_nuevo_nombre
            FROM solicitudes_cambio_turno s
            INNER JOIN usuarios u1 ON s.id_usuario_solicita = u1.id_usuario
            LEFT JOIN usuarios u2 ON s.id_usuario_acepta = u2.id_usuario
            LEFT JOIN usuarios u3 ON s.id_usuario_aprueba = u3.id_usuario
            INNER JOIN turnos t1 ON s.id_turno_original = t1.id_turno
            LEFT JOIN turnos t2 ON s.id_turno_nuevo = t2.id_turno
            WHERE s.activo = 'Y'
        `;
        let params = [];

        if (estado) {
            query += ' AND s.estado = ?';
            params.push(estado);
        }

        if (id_usuario) {
            query += ' AND (s.id_usuario_solicita = ? OR s.id_usuario_acepta = ?)';
            params.push(id_usuario, id_usuario);
        }

        query += ' ORDER BY s.fecha_solicitud DESC';

        const [solicitudes] = await pool.query(query, params);

        res.json({
            success: true,
            data: solicitudes
        });

    } catch (error) {
        console.error('Error al obtener solicitudes:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener solicitudes',
            detalle: error.message
        });
    }
}

/**
 * Aprobar solicitud de cambio
 * @route POST /api/turnos/solicitudes/aprobar
 */
async function aprobarSolicitud(req, res) {
    try {
        const {
            id_solicitud,
            id_usuario_aprueba,
            comentarios_aprobacion
        } = req.body;

        if (!id_solicitud || !id_usuario_aprueba) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_solicitud e id_usuario_aprueba'
            });
        }

        await pool.query(
            `UPDATE solicitudes_cambio_turno
             SET estado = 'aprobada',
                 id_usuario_aprueba = ?,
                 fecha_aprobacion = NOW(),
                 comentarios_aprobacion = ?
             WHERE id_solicitud = ?`,
            [id_usuario_aprueba, comentarios_aprobacion, id_solicitud]
        );

        res.json({
            success: true,
            mensaje: 'Solicitud aprobada exitosamente'
        });

    } catch (error) {
        console.error('Error al aprobar solicitud:', error);
        res.status(500).json({
            success: false,
            error: 'Error al aprobar solicitud',
            detalle: error.message
        });
    }
}

/**
 * Rechazar solicitud de cambio
 * @route POST /api/turnos/solicitudes/rechazar
 */
async function rechazarSolicitud(req, res) {
    try {
        const {
            id_solicitud,
            id_usuario_aprueba,
            comentarios_aprobacion
        } = req.body;

        if (!id_solicitud || !id_usuario_aprueba) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren id_solicitud e id_usuario_aprueba'
            });
        }

        await pool.query(
            `UPDATE solicitudes_cambio_turno
             SET estado = 'rechazada',
                 id_usuario_aprueba = ?,
                 fecha_aprobacion = NOW(),
                 comentarios_aprobacion = ?
             WHERE id_solicitud = ?`,
            [id_usuario_aprueba, comentarios_aprobacion, id_solicitud]
        );

        res.json({
            success: true,
            mensaje: 'Solicitud rechazada'
        });

    } catch (error) {
        console.error('Error al rechazar solicitud:', error);
        res.status(500).json({
            success: false,
            error: 'Error al rechazar solicitud',
            detalle: error.message
        });
    }
}

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================

module.exports = {
    // Turnos
    obtenerTurnos,
    obtenerTurnoPorId,
    crearTurno,
    actualizarTurno,
    eliminarTurno,

    // Horarios
    obtenerHorarios,
    asignarHorario,
    actualizarHorario,
    eliminarHorario,

    // Asistencias
    registrarEntrada,
    registrarSalida,
    obtenerAsistencias,
    obtenerAsistenciasUsuario,
    obtenerEstadisticas,
    registrarAsistenciaManual,

    // Solicitudes
    crearSolicitudCambio,
    obtenerSolicitudes,
    aprobarSolicitud,
    rechazarSolicitud
};
