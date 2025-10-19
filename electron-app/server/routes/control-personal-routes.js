#!/usr/bin/env node

/**
 * DYSA Point - API Routes para Control de Personal
 *
 * Endpoints especializados para el control de personal y asistencias
 * Implementación basada en análisis del sistema SYSME original
 *
 * Funcionalidades API:
 * - Marcaje de entrada y salida de empleados
 * - Gestión de horarios programados
 * - Reportes de asistencia y puntualidad
 * - Control de empleados presentes
 * - Auditoría de accesos
 */

const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');

module.exports = (controlPersonalManager, databaseManager) => {

    // ========================================
    // ENDPOINTS DE MARCAJE
    // ========================================

    /**
     * POST /api/control-personal/marcar-entrada
     * Marcar entrada de empleado
     */
    router.post('/marcar-entrada', async (req, res) => {
        try {
            const {
                id_empleado,
                pin_acceso
            } = req.body;

            // Validaciones de entrada
            if (!id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de empleado es requerido'
                });
            }

            const resultado = await controlPersonalManager.marcarEntrada(
                parseInt(id_empleado),
                pin_acceso
            );

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error marcando entrada:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * POST /api/control-personal/marcar-salida
     * Marcar salida de empleado
     */
    router.post('/marcar-salida', async (req, res) => {
        try {
            const {
                id_empleado,
                pin_acceso
            } = req.body;

            // Validaciones de entrada
            if (!id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de empleado es requerido'
                });
            }

            const resultado = await controlPersonalManager.marcarSalida(
                parseInt(id_empleado),
                pin_acceso
            );

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error marcando salida:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE CONSULTA
    // ========================================

    /**
     * GET /api/control-personal/empleados-presentes
     * Obtener empleados actualmente presentes
     */
    router.get('/empleados-presentes', async (req, res) => {
        try {
            const presentes = await controlPersonalManager.obtenerEmpleadosPresentes();

            res.json({
                success: true,
                data: presentes,
                total: presentes.length,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo empleados presentes:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/control-personal/empleados
     * Obtener lista de empleados activos
     */
    router.get('/empleados', async (req, res) => {
        try {
            const { departamento, cargo, activo = true } = req.query;

            let whereClause = [];
            let params = [];

            if (activo !== undefined) {
                whereClause.push('activo = ?');
                params.push(activo === 'true' ? 1 : 0);
            }

            if (departamento) {
                whereClause.push('departamento = ?');
                params.push(departamento);
            }

            if (cargo) {
                whereClause.push('cargo = ?');
                params.push(cargo);
            }

            const whereStr = whereClause.length > 0 ? `WHERE ${whereClause.join(' AND ')}` : '';

            const [empleados] = await databaseManager.query(`
                SELECT
                    id,
                    codigo_empleado,
                    nombre,
                    apellidos,
                    rut,
                    email,
                    telefono,
                    cargo,
                    departamento,
                    fecha_ingreso,
                    activo,
                    requiere_marcaje
                FROM empleados
                ${whereStr}
                ORDER BY nombre, apellidos
            `, params);

            res.json({
                success: true,
                data: empleados,
                total: empleados.length,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo empleados:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/control-personal/asistencia/:id_empleado?
     * Obtener asistencias de un empleado o todas
     */
    router.get('/asistencia/:id_empleado?', async (req, res) => {
        try {
            const id_empleado = req.params.id_empleado ? parseInt(req.params.id_empleado) : null;
            const {
                fecha_inicio,
                fecha_fin,
                limite = 50
            } = req.query;

            let whereClause = ['1=1'];
            let params = [];

            if (id_empleado) {
                whereClause.push('a.id_empleado = ?');
                params.push(id_empleado);
            }

            if (fecha_inicio) {
                whereClause.push('a.fecha >= ?');
                params.push(fecha_inicio);
            }

            if (fecha_fin) {
                whereClause.push('a.fecha <= ?');
                params.push(fecha_fin);
            }

            params.push(parseInt(limite));

            const [asistencias] = await databaseManager.query(`
                SELECT
                    a.id_asistencia,
                    a.fecha,
                    a.hora_entrada,
                    a.hora_salida,
                    a.minutos_atraso,
                    a.horas_trabajadas,
                    a.horas_extra,
                    a.estado,
                    a.observaciones,
                    e.codigo_empleado,
                    e.nombre,
                    e.apellidos,
                    e.cargo
                FROM asistencias a
                INNER JOIN empleados e ON a.id_empleado = e.id
                WHERE ${whereClause.join(' AND ')}
                ORDER BY a.fecha DESC, e.nombre
                LIMIT ?
            `, params);

            res.json({
                success: true,
                data: asistencias,
                total: asistencias.length,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo asistencias:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE HORARIOS
    // ========================================

    /**
     * POST /api/control-personal/crear-horario
     * Crear horario para un empleado
     */
    router.post('/crear-horario', async (req, res) => {
        try {
            const {
                id_empleado,
                horarios,
                fecha_vigencia_inicio,
                fecha_vigencia_fin
            } = req.body;

            // Validaciones
            if (!id_empleado || !horarios || !Array.isArray(horarios)) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de empleado y horarios son requeridos'
                });
            }

            if (!fecha_vigencia_inicio) {
                return res.status(400).json({
                    success: false,
                    error: 'Fecha de vigencia de inicio es requerida'
                });
            }

            const resultado = await controlPersonalManager.crearHorarioEmpleado({
                id_empleado: parseInt(id_empleado),
                horarios,
                fecha_vigencia_inicio,
                fecha_vigencia_fin
            });

            res.json({
                success: true,
                data: resultado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error creando horario:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/control-personal/horarios/:id_empleado
     * Obtener horarios de un empleado
     */
    router.get('/horarios/:id_empleado', async (req, res) => {
        try {
            const id_empleado = parseInt(req.params.id_empleado);

            if (!id_empleado) {
                return res.status(400).json({
                    success: false,
                    error: 'ID de empleado requerido'
                });
            }

            const [horarios] = await databaseManager.query(`
                SELECT
                    id_horario,
                    dia_semana,
                    hora_entrada,
                    hora_salida,
                    horas_descanso,
                    fecha_vigencia_inicio,
                    fecha_vigencia_fin,
                    activo
                FROM horarios
                WHERE id_empleado = ?
                ORDER BY
                    CASE dia_semana
                        WHEN 'lunes' THEN 1
                        WHEN 'martes' THEN 2
                        WHEN 'miercoles' THEN 3
                        WHEN 'jueves' THEN 4
                        WHEN 'viernes' THEN 5
                        WHEN 'sabado' THEN 6
                        WHEN 'domingo' THEN 7
                    END,
                    fecha_vigencia_inicio DESC
            `, [id_empleado]);

            res.json({
                success: true,
                data: horarios,
                total: horarios.length,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo horarios:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE REPORTES
    // ========================================

    /**
     * GET /api/control-personal/reporte-asistencia
     * Generar reporte de asistencia
     */
    router.get('/reporte-asistencia', async (req, res) => {
        try {
            const filtros = {
                id_empleado: req.query.id_empleado ? parseInt(req.query.id_empleado) : null,
                fecha_inicio: req.query.fecha_inicio,
                fecha_fin: req.query.fecha_fin,
                departamento: req.query.departamento,
                estado: req.query.estado
            };

            const reporte = await controlPersonalManager.generarReporteAsistencia(filtros);

            res.json({
                success: true,
                data: reporte,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error generando reporte:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    /**
     * GET /api/control-personal/estadisticas-hoy
     * Estadísticas del día actual
     */
    router.get('/estadisticas-hoy', async (req, res) => {
        try {
            const fecha = moment().tz('America/Santiago').format('YYYY-MM-DD');

            const [estadisticas] = await databaseManager.query(`
                SELECT
                    COUNT(*) as total_empleados,
                    SUM(CASE WHEN a.hora_entrada IS NOT NULL THEN 1 ELSE 0 END) as marcaron_entrada,
                    SUM(CASE WHEN a.hora_entrada IS NOT NULL AND a.hora_salida IS NOT NULL THEN 1 ELSE 0 END) as completaron_jornada,
                    SUM(CASE WHEN a.hora_entrada IS NOT NULL AND a.hora_salida IS NULL THEN 1 ELSE 0 END) as presentes_ahora,
                    SUM(CASE WHEN a.estado = 'tardanza' THEN 1 ELSE 0 END) as llegaron_tarde,
                    COALESCE(AVG(a.minutos_atraso), 0) as promedio_atraso,
                    COALESCE(SUM(a.horas_trabajadas), 0) as total_horas_trabajadas,
                    COALESCE(SUM(a.horas_extra), 0) as total_horas_extra
                FROM empleados e
                LEFT JOIN asistencias a ON e.id = a.id_empleado AND a.fecha = ?
                WHERE e.activo = TRUE AND e.requiere_marcaje = TRUE
            `, [fecha]);

            res.json({
                success: true,
                data: {
                    fecha,
                    estadisticas: estadisticas[0]
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE TURNOS
    // ========================================

    /**
     * GET /api/control-personal/turnos
     * Obtener turnos disponibles
     */
    router.get('/turnos', async (req, res) => {
        try {
            const [turnos] = await databaseManager.query(`
                SELECT
                    id_turno,
                    nombre_turno,
                    hora_inicio,
                    hora_fin,
                    descripcion,
                    color,
                    activo
                FROM turnos
                WHERE activo = TRUE
                ORDER BY hora_inicio
            `);

            res.json({
                success: true,
                data: turnos,
                total: turnos.length,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo turnos:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    // ========================================
    // ENDPOINTS DE SALUD Y ESTADO
    // ========================================

    /**
     * GET /api/control-personal/health
     * Health check del servicio
     */
    router.get('/health', async (req, res) => {
        try {
            const estado = await controlPersonalManager.obtenerEstadoServicio();

            res.json({
                success: true,
                data: estado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            });
        }
    });

    return router;
};