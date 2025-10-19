#!/usr/bin/env node

/**
 * DYSA Point - Sistema de Control de Personal y Asistencias
 *
 * Este servicio maneja el control avanzado de personal y asistencias
 * Basado en el análisis del sistema SYSME original
 *
 * Funcionalidades:
 * - Control de entrada y salida de personal
 * - Cálculo automático de horas trabajadas
 * - Gestión de horarios programados
 * - Solicitudes de cambio de turno
 * - Reportes de asistencia y puntualidad
 * - Auditoría completa de accesos
 */

const moment = require('moment-timezone');

class ControlPersonalManager {
    constructor(database) {
        this.database = database;
        this.nombre = 'ControlPersonalManager';
        this.version = '1.0.0';
        this.inicializado = false;

        // Cache de empleados activos
        this.empleadosActivos = new Map();
        this.sesionesActivas = new Map();

        console.log(`👥 Inicializando ${this.nombre} v${this.version}...`);
        this.inicializar();
    }

    async inicializar() {
        try {
            await this.crearTablasNecesarias();
            await this.verificarConfiguracionInicial();
            await this.cargarEmpleadosActivos();
            this.inicializado = true;
            console.log(`✅ ${this.nombre} inicializado correctamente`);
        } catch (error) {
            console.error(`❌ Error inicializando ${this.nombre}:`, error);
            throw error;
        }
    }

    async crearTablasNecesarias() {
        const tablas = [
            // Tabla de empleados ampliada
            `CREATE TABLE IF NOT EXISTS empleados (
                id INT AUTO_INCREMENT PRIMARY KEY,
                codigo_empleado VARCHAR(20) UNIQUE NOT NULL,
                nombre VARCHAR(100) NOT NULL,
                apellidos VARCHAR(100) NOT NULL,
                rut VARCHAR(20) UNIQUE NULL,
                email VARCHAR(100) UNIQUE NULL,
                telefono VARCHAR(20) NULL,
                cargo ENUM('administrador','gerente','supervisor','cajero','garzon','cocinero','ayudante','limpieza') NOT NULL,
                departamento ENUM('administracion','cocina','salon','barra','limpieza','gerencia') NOT NULL,
                fecha_ingreso DATE NOT NULL,
                fecha_salida DATE NULL,
                sueldo_base DECIMAL(10,2) NULL,
                horas_semanales INT DEFAULT 45,
                activo BOOLEAN DEFAULT TRUE,
                requiere_marcaje BOOLEAN DEFAULT TRUE,
                pin_acceso VARCHAR(10) NULL,
                foto_url VARCHAR(255) NULL,
                observaciones TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_codigo (codigo_empleado),
                INDEX idx_activo (activo),
                INDEX idx_cargo (cargo),
                INDEX idx_departamento (departamento)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de horarios programados
            `CREATE TABLE IF NOT EXISTS horarios (
                id_horario INT AUTO_INCREMENT PRIMARY KEY,
                id_empleado INT NOT NULL,
                dia_semana ENUM('lunes','martes','miercoles','jueves','viernes','sabado','domingo') NOT NULL,
                hora_entrada TIME NOT NULL,
                hora_salida TIME NOT NULL,
                horas_descanso DECIMAL(3,2) DEFAULT 0.00,
                activo BOOLEAN DEFAULT TRUE,
                fecha_vigencia_inicio DATE NOT NULL,
                fecha_vigencia_fin DATE NULL,
                observaciones TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_empleado (id_empleado),
                INDEX idx_dia (dia_semana),
                INDEX idx_activo (activo),
                INDEX idx_vigencia (fecha_vigencia_inicio, fecha_vigencia_fin),
                FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de asistencias (registros diarios)
            `CREATE TABLE IF NOT EXISTS asistencias (
                id_asistencia INT AUTO_INCREMENT PRIMARY KEY,
                id_empleado INT NOT NULL,
                fecha DATE NOT NULL,
                hora_entrada TIME NULL,
                hora_salida TIME NULL,
                hora_entrada_programada TIME NULL,
                hora_salida_programada TIME NULL,
                minutos_atraso INT DEFAULT 0,
                horas_trabajadas DECIMAL(4,2) DEFAULT 0.00,
                horas_extra DECIMAL(4,2) DEFAULT 0.00,
                estado ENUM('presente','ausente','tardanza','justificado','vacaciones','licencia') DEFAULT 'presente',
                justificacion TEXT NULL,
                aprobado_por INT NULL,
                observaciones TEXT NULL,
                ip_entrada VARCHAR(50) NULL,
                ip_salida VARCHAR(50) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_empleado_fecha (id_empleado, fecha),
                INDEX idx_fecha (fecha),
                INDEX idx_estado (estado),
                FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE CASCADE,
                UNIQUE KEY unique_empleado_fecha (id_empleado, fecha)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de turnos
            `CREATE TABLE IF NOT EXISTS turnos (
                id_turno INT AUTO_INCREMENT PRIMARY KEY,
                nombre_turno VARCHAR(50) NOT NULL,
                hora_inicio TIME NOT NULL,
                hora_fin TIME NOT NULL,
                descripcion TEXT NULL,
                color VARCHAR(7) DEFAULT '#3498db',
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_activo (activo),
                INDEX idx_horas (hora_inicio, hora_fin)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de solicitudes de cambio de turno
            `CREATE TABLE IF NOT EXISTS solicitudes_cambio_turno (
                id_solicitud INT AUTO_INCREMENT PRIMARY KEY,
                id_empleado_solicitante INT NOT NULL,
                id_empleado_reemplazo INT NULL,
                fecha_cambio DATE NOT NULL,
                turno_original VARCHAR(50) NOT NULL,
                turno_solicitado VARCHAR(50) NOT NULL,
                motivo TEXT NOT NULL,
                estado ENUM('pendiente','aprobado','rechazado','cancelado') DEFAULT 'pendiente',
                aprobado_por INT NULL,
                fecha_aprobacion TIMESTAMP NULL,
                observaciones_aprobacion TEXT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_empleado (id_empleado_solicitante),
                INDEX idx_fecha (fecha_cambio),
                INDEX idx_estado (estado),
                FOREIGN KEY (id_empleado_solicitante) REFERENCES empleados(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de log de accesos y permisos
            `CREATE TABLE IF NOT EXISTS log_accesos (
                id_log INT AUTO_INCREMENT PRIMARY KEY,
                id_empleado INT NOT NULL,
                tipo_acceso ENUM('login','logout','entrada','salida','acceso_denegado') NOT NULL,
                ip_address VARCHAR(50) NULL,
                user_agent TEXT NULL,
                terminal VARCHAR(50) NULL,
                exitoso BOOLEAN DEFAULT TRUE,
                motivo_fallo VARCHAR(255) NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_empleado (id_empleado),
                INDEX idx_timestamp (timestamp),
                INDEX idx_tipo (tipo_acceso),
                FOREIGN KEY (id_empleado) REFERENCES empleados(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        ];

        for (const sql of tablas) {
            await this.database.query(sql);
        }

        console.log('✅ Tablas de control de personal creadas/verificadas');
    }

    async verificarConfiguracionInicial() {
        // Verificar si existe al menos un empleado
        const [empleados] = await this.database.query(
            'SELECT COUNT(*) as total FROM empleados WHERE activo = TRUE'
        );

        if (empleados[0].total === 0) {
            // Crear empleado administrador por defecto
            await this.database.query(`
                INSERT INTO empleados (
                    codigo_empleado,
                    nombre,
                    apellidos,
                    cargo,
                    departamento,
                    fecha_ingreso,
                    pin_acceso
                ) VALUES (
                    'ADMIN001',
                    'Administrador',
                    'Sistema',
                    'administrador',
                    'administracion',
                    CURDATE(),
                    '0000'
                )
            `);

            console.log('✅ Empleado administrador creado por defecto');
        }

        // Verificar turnos básicos
        const [turnos] = await this.database.query(
            'SELECT COUNT(*) as total FROM turnos WHERE activo = TRUE'
        );

        if (turnos[0].total === 0) {
            const turnosBasicos = [
                { nombre_turno: 'Mañana', hora_inicio: '08:00:00', hora_fin: '16:00:00', color: '#f39c12' },
                { nombre_turno: 'Tarde', hora_inicio: '16:00:00', hora_fin: '00:00:00', color: '#e74c3c' },
                { nombre_turno: 'Noche', hora_inicio: '00:00:00', hora_fin: '08:00:00', color: '#9b59b6' },
                { nombre_turno: 'Completo', hora_inicio: '08:00:00', hora_fin: '20:00:00', color: '#27ae60' }
            ];

            for (const turno of turnosBasicos) {
                await this.database.query(`
                    INSERT INTO turnos (nombre_turno, hora_inicio, hora_fin, color)
                    VALUES (?, ?, ?, ?)
                `, [turno.nombre_turno, turno.hora_inicio, turno.hora_fin, turno.color]);
            }

            console.log('✅ Turnos básicos creados');
        }
    }

    async cargarEmpleadosActivos() {
        const [empleados] = await this.database.query(`
            SELECT
                id,
                codigo_empleado,
                nombre,
                apellidos,
                cargo,
                departamento,
                requiere_marcaje
            FROM empleados
            WHERE activo = TRUE
        `);

        this.empleadosActivos.clear();
        for (const emp of empleados) {
            this.empleadosActivos.set(emp.id, emp);
        }

        console.log(`✅ Cache de empleados cargado: ${this.empleadosActivos.size} empleados activos`);
    }

    // ========================================
    // MÉTODOS DE MARCAJE DE ENTRADA/SALIDA
    // ========================================

    async marcarEntrada(id_empleado, pin_acceso = null) {
        try {
            const fecha = moment().tz('America/Santiago').format('YYYY-MM-DD');
            const hora = moment().tz('America/Santiago').format('HH:mm:ss');

            // Verificar empleado
            const empleado = this.empleadosActivos.get(id_empleado);
            if (!empleado) {
                throw new Error('Empleado no encontrado o inactivo');
            }

            // Verificar PIN si está configurado
            if (empleado.pin_acceso && pin_acceso !== empleado.pin_acceso) {
                await this.registrarAcceso(id_empleado, 'acceso_denegado', false, 'PIN incorrecto');
                throw new Error('PIN incorrecto');
            }

            // Verificar si ya marcó entrada hoy
            const [asistenciaExistente] = await this.database.query(`
                SELECT id_asistencia, hora_entrada, hora_salida
                FROM asistencias
                WHERE id_empleado = ? AND fecha = ?
            `, [id_empleado, fecha]);

            if (asistenciaExistente.length > 0 && asistenciaExistente[0].hora_entrada) {
                throw new Error('Ya se registró entrada para hoy');
            }

            // Obtener horario programado
            const horarioProgramado = await this.obtenerHorarioProgramado(id_empleado, fecha);
            const horaEntradaProgramada = horarioProgramado ? horarioProgramado.hora_entrada : null;

            // Calcular atraso
            let minutosAtraso = 0;
            if (horaEntradaProgramada) {
                const momentoEntradaProgramada = moment(`${fecha} ${horaEntradaProgramada}`, 'YYYY-MM-DD HH:mm:ss');
                const momentoEntradaReal = moment(`${fecha} ${hora}`, 'YYYY-MM-DD HH:mm:ss');

                if (momentoEntradaReal.isAfter(momentoEntradaProgramada)) {
                    minutosAtraso = momentoEntradaReal.diff(momentoEntradaProgramada, 'minutes');
                }
            }

            // Crear o actualizar asistencia
            if (asistenciaExistente.length > 0) {
                await this.database.query(`
                    UPDATE asistencias SET
                        hora_entrada = ?,
                        hora_entrada_programada = ?,
                        minutos_atraso = ?,
                        estado = CASE
                            WHEN ? > 15 THEN 'tardanza'
                            ELSE 'presente'
                        END,
                        ip_entrada = ?
                    WHERE id_asistencia = ?
                `, [
                    hora,
                    horaEntradaProgramada,
                    minutosAtraso,
                    minutosAtraso,
                    this.obtenerIPTerminal(),
                    asistenciaExistente[0].id_asistencia
                ]);
            } else {
                await this.database.query(`
                    INSERT INTO asistencias (
                        id_empleado,
                        fecha,
                        hora_entrada,
                        hora_entrada_programada,
                        minutos_atraso,
                        estado,
                        ip_entrada
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    id_empleado,
                    fecha,
                    hora,
                    horaEntradaProgramada,
                    minutosAtraso,
                    minutosAtraso > 15 ? 'tardanza' : 'presente',
                    this.obtenerIPTerminal()
                ]);
            }

            // Registrar acceso exitoso
            await this.registrarAcceso(id_empleado, 'entrada', true);

            // Actualizar sesiones activas
            this.sesionesActivas.set(id_empleado, {
                fecha,
                hora_entrada: hora,
                estado: minutosAtraso > 15 ? 'tardanza' : 'presente'
            });

            console.log(`✅ Entrada marcada: ${empleado.nombre} a las ${hora}`);

            return {
                success: true,
                empleado: `${empleado.nombre} ${empleado.apellidos}`,
                fecha,
                hora_entrada: hora,
                minutos_atraso: minutosAtraso,
                estado: minutosAtraso > 15 ? 'tardanza' : 'presente',
                mensaje: minutosAtraso > 15 ? `Entrada con ${minutosAtraso} minutos de atraso` : 'Entrada registrada correctamente'
            };

        } catch (error) {
            console.error('❌ Error marcando entrada:', error);
            throw error;
        }
    }

    async marcarSalida(id_empleado, pin_acceso = null) {
        try {
            const fecha = moment().tz('America/Santiago').format('YYYY-MM-DD');
            const hora = moment().tz('America/Santiago').format('HH:mm:ss');

            // Verificar empleado
            const empleado = this.empleadosActivos.get(id_empleado);
            if (!empleado) {
                throw new Error('Empleado no encontrado o inactivo');
            }

            // Verificar PIN si está configurado
            if (empleado.pin_acceso && pin_acceso !== empleado.pin_acceso) {
                await this.registrarAcceso(id_empleado, 'acceso_denegado', false, 'PIN incorrecto');
                throw new Error('PIN incorrecto');
            }

            // Verificar asistencia del día
            const [asistencia] = await this.database.query(`
                SELECT id_asistencia, hora_entrada, hora_salida, hora_salida_programada
                FROM asistencias
                WHERE id_empleado = ? AND fecha = ?
            `, [id_empleado, fecha]);

            if (asistencia.length === 0 || !asistencia[0].hora_entrada) {
                throw new Error('Debe marcar entrada antes de la salida');
            }

            if (asistencia[0].hora_salida) {
                throw new Error('Ya se registró salida para hoy');
            }

            const asistenciaActual = asistencia[0];

            // Obtener horario programado si no se tiene
            let horaSalidaProgramada = asistenciaActual.hora_salida_programada;
            if (!horaSalidaProgramada) {
                const horario = await this.obtenerHorarioProgramado(id_empleado, fecha);
                horaSalidaProgramada = horario ? horario.hora_salida : null;
            }

            // Calcular horas trabajadas
            const momentoEntrada = moment(`${fecha} ${asistenciaActual.hora_entrada}`, 'YYYY-MM-DD HH:mm:ss');
            let momentoSalida = moment(`${fecha} ${hora}`, 'YYYY-MM-DD HH:mm:ss');

            // Manejar turnos nocturnos (salida después de medianoche)
            if (momentoSalida.isBefore(momentoEntrada)) {
                momentoSalida.add(1, 'day');
            }

            const horasTrabajadas = momentoSalida.diff(momentoEntrada, 'minutes') / 60;
            const horasTrabajadasRedondeadas = Math.round(horasTrabajadas * 4) / 4; // Redondear a 15 min

            // Calcular horas extra (más de 8 horas por día)
            const horasExtra = Math.max(0, horasTrabajadasRedondeadas - 8);

            // Actualizar asistencia
            await this.database.query(`
                UPDATE asistencias SET
                    hora_salida = ?,
                    hora_salida_programada = ?,
                    horas_trabajadas = ?,
                    horas_extra = ?,
                    ip_salida = ?
                WHERE id_asistencia = ?
            `, [
                hora,
                horaSalidaProgramada,
                horasTrabajadasRedondeadas,
                horasExtra,
                this.obtenerIPTerminal(),
                asistenciaActual.id_asistencia
            ]);

            // Registrar acceso exitoso
            await this.registrarAcceso(id_empleado, 'salida', true);

            // Remover de sesiones activas
            this.sesionesActivas.delete(id_empleado);

            console.log(`✅ Salida marcada: ${empleado.nombre} a las ${hora}`);

            return {
                success: true,
                empleado: `${empleado.nombre} ${empleado.apellidos}`,
                fecha,
                hora_salida: hora,
                horas_trabajadas: horasTrabajadasRedondeadas,
                horas_extra: horasExtra,
                mensaje: `Salida registrada. Trabajó ${horasTrabajadasRedondeadas} horas${horasExtra > 0 ? ` (${horasExtra} horas extra)` : ''}`
            };

        } catch (error) {
            console.error('❌ Error marcando salida:', error);
            throw error;
        }
    }

    // ========================================
    // MÉTODOS DE HORARIOS
    // ========================================

    async obtenerHorarioProgramado(id_empleado, fecha) {
        const diaSemana = moment(fecha).locale('es').format('dddd').toLowerCase();

        const [horarios] = await this.database.query(`
            SELECT
                hora_entrada,
                hora_salida,
                horas_descanso
            FROM horarios
            WHERE id_empleado = ?
            AND dia_semana = ?
            AND activo = TRUE
            AND (fecha_vigencia_inicio <= ? AND (fecha_vigencia_fin IS NULL OR fecha_vigencia_fin >= ?))
            LIMIT 1
        `, [id_empleado, diaSemana, fecha, fecha]);

        return horarios.length > 0 ? horarios[0] : null;
    }

    async crearHorarioEmpleado(datosHorario) {
        try {
            const {
                id_empleado,
                horarios, // Array de objetos con dia_semana, hora_entrada, hora_salida
                fecha_vigencia_inicio,
                fecha_vigencia_fin = null
            } = datosHorario;

            // Desactivar horarios anteriores
            await this.database.query(`
                UPDATE horarios SET
                    activo = FALSE,
                    fecha_vigencia_fin = ?
                WHERE id_empleado = ? AND activo = TRUE
            `, [fecha_vigencia_inicio, id_empleado]);

            // Crear nuevos horarios
            for (const horario of horarios) {
                await this.database.query(`
                    INSERT INTO horarios (
                        id_empleado,
                        dia_semana,
                        hora_entrada,
                        hora_salida,
                        horas_descanso,
                        fecha_vigencia_inicio,
                        fecha_vigencia_fin
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    id_empleado,
                    horario.dia_semana,
                    horario.hora_entrada,
                    horario.hora_salida,
                    horario.horas_descanso || 0,
                    fecha_vigencia_inicio,
                    fecha_vigencia_fin
                ]);
            }

            console.log(`✅ Horario creado para empleado ${id_empleado}`);

            return {
                success: true,
                mensaje: 'Horario creado correctamente',
                empleado: id_empleado,
                horarios_creados: horarios.length
            };

        } catch (error) {
            console.error('❌ Error creando horario:', error);
            throw error;
        }
    }

    // ========================================
    // MÉTODOS DE REPORTES
    // ========================================

    async generarReporteAsistencia(filtros = {}) {
        try {
            const {
                id_empleado = null,
                fecha_inicio,
                fecha_fin,
                departamento = null,
                estado = null
            } = filtros;

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

            if (departamento) {
                whereClause.push('e.departamento = ?');
                params.push(departamento);
            }

            if (estado) {
                whereClause.push('a.estado = ?');
                params.push(estado);
            }

            const [asistencias] = await this.database.query(`
                SELECT
                    a.id_asistencia,
                    a.fecha,
                    a.hora_entrada,
                    a.hora_salida,
                    a.minutos_atraso,
                    a.horas_trabajadas,
                    a.horas_extra,
                    a.estado,
                    a.justificacion,
                    e.codigo_empleado,
                    e.nombre,
                    e.apellidos,
                    e.cargo,
                    e.departamento
                FROM asistencias a
                INNER JOIN empleados e ON a.id_empleado = e.id
                WHERE ${whereClause.join(' AND ')}
                ORDER BY a.fecha DESC, e.nombre
            `, params);

            // Calcular resúmenes
            const resumen = {
                total_registros: asistencias.length,
                total_horas_trabajadas: asistencias.reduce((sum, a) => sum + (a.horas_trabajadas || 0), 0),
                total_horas_extra: asistencias.reduce((sum, a) => sum + (a.horas_extra || 0), 0),
                por_estado: {},
                promedio_atraso: 0
            };

            // Agrupar por estado
            asistencias.forEach(a => {
                if (!resumen.por_estado[a.estado]) {
                    resumen.por_estado[a.estado] = 0;
                }
                resumen.por_estado[a.estado]++;
            });

            // Calcular promedio de atraso
            const registrosConAtraso = asistencias.filter(a => a.minutos_atraso > 0);
            if (registrosConAtraso.length > 0) {
                resumen.promedio_atraso = registrosConAtraso.reduce((sum, a) => sum + a.minutos_atraso, 0) / registrosConAtraso.length;
            }

            return {
                success: true,
                filtros,
                resumen,
                asistencias,
                fecha_generacion: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            console.error('❌ Error generando reporte de asistencia:', error);
            throw error;
        }
    }

    // ========================================
    // MÉTODOS AUXILIARES
    // ========================================

    async registrarAcceso(id_empleado, tipo_acceso, exitoso = true, motivo_fallo = null) {
        await this.database.query(`
            INSERT INTO log_accesos (
                id_empleado,
                tipo_acceso,
                ip_address,
                terminal,
                exitoso,
                motivo_fallo
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            id_empleado,
            tipo_acceso,
            this.obtenerIPTerminal(),
            'DYSA_POS',
            exitoso,
            motivo_fallo
        ]);
    }

    obtenerIPTerminal() {
        const os = require('os');
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            for (const networkInterface of interfaces[name]) {
                if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                    return networkInterface.address;
                }
            }
        }

        return '127.0.0.1';
    }

    async obtenerEmpleadosPresentes() {
        const fecha = moment().tz('America/Santiago').format('YYYY-MM-DD');

        const [presentes] = await this.database.query(`
            SELECT
                e.id,
                e.codigo_empleado,
                e.nombre,
                e.apellidos,
                e.cargo,
                a.hora_entrada,
                a.hora_salida,
                a.estado
            FROM empleados e
            INNER JOIN asistencias a ON e.id = a.id_empleado
            WHERE a.fecha = ?
            AND a.hora_entrada IS NOT NULL
            AND a.hora_salida IS NULL
            AND e.activo = TRUE
            ORDER BY e.nombre
        `, [fecha]);

        return presentes;
    }

    // ========================================
    // MÉTODOS DE ESTADO Y SALUD
    // ========================================

    async obtenerEstadoServicio() {
        try {
            const [empleadosActivos] = await this.database.query(
                'SELECT COUNT(*) as total FROM empleados WHERE activo = TRUE'
            );

            const [asistenciasHoy] = await this.database.query(`
                SELECT COUNT(*) as total FROM asistencias
                WHERE fecha = CURDATE()
            `);

            const [presentesHoy] = await this.database.query(`
                SELECT COUNT(*) as total FROM asistencias
                WHERE fecha = CURDATE() AND hora_entrada IS NOT NULL AND hora_salida IS NULL
            `);

            return {
                servicio: 'ControlPersonalManager',
                version: this.version,
                estado: 'activo',
                inicializado: this.inicializado,
                estadisticas: {
                    empleados_activos: empleadosActivos[0].total,
                    asistencias_hoy: asistenciasHoy[0].total,
                    presentes_ahora: presentesHoy[0].total,
                    empleados_en_cache: this.empleadosActivos.size,
                    sesiones_activas: this.sesionesActivas.size
                },
                timestamp: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            return {
                servicio: 'ControlPersonalManager',
                version: this.version,
                estado: 'error',
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            };
        }
    }
}

module.exports = ControlPersonalManager;