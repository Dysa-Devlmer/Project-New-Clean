/**
 * DYSA Point - Sistema de Gestión de Mesas en Tiempo Real
 * Manejo profesional del estado del salón y asignación de mesas
 *
 * Funcionalidades:
 * - Estados de mesa en tiempo real (libre/ocupada/reservada/sucia)
 * - Visualización completa del salón por zonas
 * - Asignación automática y manual de garzones
 * - Tiempo de ocupación y rotación de mesas
 * - Notificaciones de cambios de estado
 * - Estadísticas de ocupación
 */

const { EventEmitter } = require('events');

class MesasManager extends EventEmitter {
    constructor(database) {
        super();
        this.db = database;
        this.connection = database.connection;

        // Estados válidos de mesa
        this.ESTADOS_MESA = {
            LIBRE: 'libre',
            OCUPADA: 'ocupada',
            RESERVADA: 'reservada',
            SUCIA: 'sucia',
            MANTENIMIENTO: 'mantenimiento',
            BLOQUEADA: 'bloqueada'
        };

        // Cache de estados en memoria para acceso rápido
        this.estadosCache = new Map();

        // Timers de ocupación por mesa
        this.timersOcupacion = new Map();

        // Intervalos de actualización
        this.intervaloActualizacion = null;

        console.log('🏠 MesasManager inicializado correctamente');
        this.inicializarCache();
    }

    /**
     * Inicializar cache de estados de mesas
     */
    async inicializarCache() {
        try {
            const [mesas] = await this.connection.execute(`
                SELECT
                    m.*,
                    z.nombre as zona_nombre,
                    z.color as zona_color,
                    v.id as venta_id,
                    v.estado as venta_estado,
                    v.fecha_apertura,
                    u.nombre as garzon_nombre,
                    u.apellido as garzon_apellido
                FROM mesas m
                LEFT JOIN zonas z ON m.zona_id = z.id
                LEFT JOIN ventas v ON m.id = v.mesa_id AND v.estado NOT IN ('cerrada', 'cancelada')
                LEFT JOIN usuarios u ON v.usuario_id = u.id
                WHERE m.activo = 1
                ORDER BY z.orden ASC, m.nombre ASC
            `);

            // Cargar en cache
            for (const mesa of mesas) {
                this.estadosCache.set(mesa.id, {
                    ...mesa,
                    tiempo_ocupacion: mesa.fecha_apertura ?
                        Date.now() - new Date(mesa.fecha_apertura).getTime() : 0,
                    ultima_actualizacion: Date.now()
                });

                // Iniciar timer de ocupación si está ocupada
                if (mesa.estado === this.ESTADOS_MESA.OCUPADA && mesa.fecha_apertura) {
                    this.iniciarTimerOcupacion(mesa.id, new Date(mesa.fecha_apertura));
                }
            }

            console.log(`✅ Cache de mesas inicializado: ${mesas.length} mesas cargadas`);

        } catch (error) {
            console.error('❌ Error inicializando cache de mesas:', error);
        }
    }

    /**
     * Obtener estado completo del salón por zonas
     */
    async obtenerEstadoSalon() {
        try {
            const [zonas] = await this.connection.execute(`
                SELECT
                    z.*,
                    COUNT(m.id) as total_mesas,
                    COUNT(CASE WHEN m.estado = 'libre' THEN 1 END) as mesas_libres,
                    COUNT(CASE WHEN m.estado = 'ocupada' THEN 1 END) as mesas_ocupadas,
                    COUNT(CASE WHEN m.estado = 'reservada' THEN 1 END) as mesas_reservadas,
                    COUNT(CASE WHEN m.estado = 'sucia' THEN 1 END) as mesas_sucias
                FROM zonas z
                LEFT JOIN mesas m ON z.id = m.zona_id AND m.activo = 1
                WHERE z.activo = 1
                GROUP BY z.id
                ORDER BY z.orden ASC
            `);

            // Obtener mesas de cada zona con detalles
            for (const zona of zonas) {
                const mesasZona = Array.from(this.estadosCache.values())
                    .filter(mesa => mesa.zona_id === zona.id)
                    .map(mesa => ({
                        ...mesa,
                        tiempo_ocupacion_formateado: this.formatearTiempo(mesa.tiempo_ocupacion)
                    }));

                zona.mesas = mesasZona;
            }

            return {
                success: true,
                zonas: zonas,
                resumen: this.calcularResumenSalon(zonas),
                ultima_actualizacion: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error obteniendo estado del salón:', error);
            throw error;
        }
    }

    /**
     * Cambiar estado de una mesa
     */
    async cambiarEstadoMesa(mesaId, nuevoEstado, datos = {}) {
        try {
            const { garzon_codigo, observaciones, tiempo_estimado } = datos;

            // Validar estado
            if (!Object.values(this.ESTADOS_MESA).includes(nuevoEstado)) {
                throw new Error(`Estado inválido: ${nuevoEstado}`);
            }

            // Obtener mesa actual
            const mesaActual = this.estadosCache.get(mesaId);
            if (!mesaActual) {
                throw new Error(`Mesa ${mesaId} no encontrada`);
            }

            const estadoAnterior = mesaActual.estado;

            // Validar garzón si es requerido
            let garzonInfo = null;
            if (garzon_codigo) {
                const [garzones] = await this.connection.execute(`
                    SELECT id, nombre, apellido FROM usuarios
                    WHERE codigo_privado = ? AND activo = 1
                `, [garzon_codigo]);

                if (garzones.length === 0) {
                    throw new Error('Código de garzón inválido');
                }
                garzonInfo = garzones[0];
            }

            // Actualizar en base de datos
            await this.connection.execute(`
                UPDATE mesas
                SET estado = ?, observaciones = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [nuevoEstado, observaciones, mesaId]);

            // Manejar cambios de estado específicos
            await this.manejarCambioEstado(mesaId, estadoAnterior, nuevoEstado, {
                garzon_info: garzonInfo,
                observaciones,
                tiempo_estimado
            });

            // Actualizar cache
            const mesaActualizada = {
                ...mesaActual,
                estado: nuevoEstado,
                observaciones: observaciones,
                garzon_nombre: garzonInfo?.nombre,
                garzon_apellido: garzonInfo?.apellido,
                ultima_actualizacion: Date.now()
            };

            this.estadosCache.set(mesaId, mesaActualizada);

            // Emitir evento de cambio de estado
            this.emit('cambio_estado_mesa', {
                mesa_id: mesaId,
                estado_anterior: estadoAnterior,
                estado_nuevo: nuevoEstado,
                mesa: mesaActualizada
            });

            console.log(`✅ Mesa ${mesaActual.nombre}: ${estadoAnterior} → ${nuevoEstado}`);

            return {
                success: true,
                estado_anterior: estadoAnterior,
                estado_nuevo: nuevoEstado,
                mesa: mesaActualizada
            };

        } catch (error) {
            console.error('❌ Error cambiando estado de mesa:', error);
            throw error;
        }
    }

    /**
     * Asignar mesa a garzón específico
     */
    async asignarMesaGarzon(mesaId, garzonCodigo, tipoAsignacion = 'manual') {
        try {
            // Validar garzón
            const [garzones] = await this.connection.execute(`
                SELECT id, nombre, apellido, role_id FROM usuarios
                WHERE codigo_privado = ? AND activo = 1
            `, [garzonCodigo]);

            if (garzones.length === 0) {
                throw new Error('Código de garzón inválido');
            }

            const garzon = garzones[0];
            const mesa = this.estadosCache.get(mesaId);

            if (!mesa) {
                throw new Error(`Mesa ${mesaId} no encontrada`);
            }

            // Crear o actualizar asignación
            await this.connection.execute(`
                INSERT INTO mesa_asignaciones (mesa_id, usuario_id, tipo_asignacion, fecha_asignacion, activo)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP, 1)
                ON DUPLICATE KEY UPDATE
                usuario_id = VALUES(usuario_id),
                tipo_asignacion = VALUES(tipo_asignacion),
                fecha_asignacion = CURRENT_TIMESTAMP,
                activo = 1
            `, [mesaId, garzon.id, tipoAsignacion]);

            // Actualizar cache
            const mesaActualizada = {
                ...mesa,
                garzon_asignado_id: garzon.id,
                garzon_nombre: garzon.nombre,
                garzon_apellido: garzon.apellido,
                tipo_asignacion: tipoAsignacion,
                ultima_actualizacion: Date.now()
            };

            this.estadosCache.set(mesaId, mesaActualizada);

            // Emitir evento
            this.emit('asignacion_mesa', {
                mesa_id: mesaId,
                garzon: garzon,
                tipo_asignacion: tipoAsignacion
            });

            console.log(`👤 Mesa ${mesa.nombre} asignada a ${garzon.nombre} ${garzon.apellido}`);

            return {
                success: true,
                mesa: mesaActualizada,
                garzon: garzon
            };

        } catch (error) {
            console.error('❌ Error asignando mesa:', error);
            throw error;
        }
    }

    /**
     * Obtener mesas asignadas a un garzón
     */
    async obtenerMesasGarzon(garzonCodigo) {
        try {
            const [garzones] = await this.connection.execute(`
                SELECT id FROM usuarios WHERE codigo_privado = ? AND activo = 1
            `, [garzonCodigo]);

            if (garzones.length === 0) {
                throw new Error('Código de garzón inválido');
            }

            const garzonId = garzones[0].id;

            // Obtener mesas desde cache
            const mesasGarzon = Array.from(this.estadosCache.values())
                .filter(mesa =>
                    mesa.garzon_asignado_id === garzonId ||
                    mesa.usuario_id === garzonId
                )
                .map(mesa => ({
                    ...mesa,
                    tiempo_ocupacion_formateado: this.formatearTiempo(mesa.tiempo_ocupacion)
                }));

            return {
                success: true,
                mesas: mesasGarzon,
                total: mesasGarzon.length
            };

        } catch (error) {
            console.error('❌ Error obteniendo mesas de garzón:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de ocupación en tiempo real
     */
    async obtenerEstadisticasOcupacion() {
        try {
            const estadoSalon = await this.obtenerEstadoSalon();
            const mesasTodas = Array.from(this.estadosCache.values());

            // Calcular promedios
            const mesasOcupadas = mesasTodas.filter(m => m.estado === this.ESTADOS_MESA.OCUPADA);
            const tiempoPromedioOcupacion = mesasOcupadas.length > 0 ?
                mesasOcupadas.reduce((sum, m) => sum + m.tiempo_ocupacion, 0) / mesasOcupadas.length : 0;

            // Estadísticas por zona
            const estadisticasPorZona = estadoSalon.zonas.map(zona => ({
                zona_id: zona.id,
                zona_nombre: zona.nombre,
                total_mesas: zona.total_mesas,
                ocupacion_porcentaje: Math.round((zona.mesas_ocupadas / zona.total_mesas) * 100),
                tiempo_promedio_ocupacion: this.calcularTiempoPromedioZona(zona.mesas)
            }));

            return {
                success: true,
                resumen_general: {
                    total_mesas: mesasTodas.length,
                    mesas_ocupadas: mesasOcupadas.length,
                    porcentaje_ocupacion: Math.round((mesasOcupadas.length / mesasTodas.length) * 100),
                    tiempo_promedio_ocupacion: this.formatearTiempo(tiempoPromedioOcupacion),
                    mesas_disponibles: mesasTodas.filter(m => m.estado === this.ESTADOS_MESA.LIBRE).length
                },
                por_zona: estadisticasPorZona,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            throw error;
        }
    }

    /**
     * Liberar mesa automáticamente
     */
    async liberarMesa(mesaId, garzonCodigo) {
        try {
            const resultado = await this.cambiarEstadoMesa(mesaId, this.ESTADOS_MESA.LIBRE, {
                garzon_codigo: garzonCodigo,
                observaciones: 'Mesa liberada manualmente'
            });

            // Detener timer de ocupación
            this.detenerTimerOcupacion(mesaId);

            return resultado;

        } catch (error) {
            console.error('❌ Error liberando mesa:', error);
            throw error;
        }
    }

    // Métodos auxiliares

    /**
     * Manejar cambios específicos de estado
     */
    async manejarCambioEstado(mesaId, estadoAnterior, estadoNuevo, datos) {
        try {
            switch (estadoNuevo) {
                case this.ESTADOS_MESA.OCUPADA:
                    if (estadoAnterior === this.ESTADOS_MESA.LIBRE) {
                        // Iniciar timer de ocupación
                        this.iniciarTimerOcupacion(mesaId);
                    }
                    break;

                case this.ESTADOS_MESA.LIBRE:
                    if (estadoAnterior === this.ESTADOS_MESA.OCUPADA) {
                        // Detener timer de ocupación
                        this.detenerTimerOcupacion(mesaId);
                        // Registrar tiempo total de ocupación
                        await this.registrarTiempoOcupacion(mesaId);
                    }
                    break;

                case this.ESTADOS_MESA.RESERVADA:
                    // Programar liberación automática si tiene tiempo estimado
                    if (datos.tiempo_estimado) {
                        this.programarLiberacionAutomatica(mesaId, datos.tiempo_estimado);
                    }
                    break;
            }

        } catch (error) {
            console.error('❌ Error manejando cambio de estado:', error);
        }
    }

    /**
     * Iniciar timer de ocupación para una mesa
     */
    iniciarTimerOcupacion(mesaId, fechaInicio = new Date()) {
        // Limpiar timer existente si hay uno
        this.detenerTimerOcupacion(mesaId);

        // Crear nuevo timer que actualiza cada minuto
        const timer = setInterval(() => {
            const mesa = this.estadosCache.get(mesaId);
            if (mesa && mesa.estado === this.ESTADOS_MESA.OCUPADA) {
                const tiempoOcupacion = Date.now() - fechaInicio.getTime();

                // Actualizar cache
                this.estadosCache.set(mesaId, {
                    ...mesa,
                    tiempo_ocupacion: tiempoOcupacion,
                    ultima_actualizacion: Date.now()
                });

                // Emitir evento de actualización
                this.emit('actualizacion_tiempo', {
                    mesa_id: mesaId,
                    tiempo_ocupacion: tiempoOcupacion
                });
            } else {
                // Mesa ya no está ocupada, detener timer
                this.detenerTimerOcupacion(mesaId);
            }
        }, 60000); // Actualizar cada minuto

        this.timersOcupacion.set(mesaId, {
            timer: timer,
            fecha_inicio: fechaInicio
        });
    }

    /**
     * Detener timer de ocupación
     */
    detenerTimerOcupacion(mesaId) {
        const timerInfo = this.timersOcupacion.get(mesaId);
        if (timerInfo) {
            clearInterval(timerInfo.timer);
            this.timersOcupacion.delete(mesaId);
        }
    }

    /**
     * Registrar tiempo total de ocupación en BD
     */
    async registrarTiempoOcupacion(mesaId) {
        try {
            const timerInfo = this.timersOcupacion.get(mesaId);
            if (timerInfo) {
                const tiempoTotal = Date.now() - timerInfo.fecha_inicio.getTime();

                await this.connection.execute(`
                    INSERT INTO ocupacion_mesas (mesa_id, fecha_inicio, fecha_fin, tiempo_total_minutos)
                    VALUES (?, ?, CURRENT_TIMESTAMP, ?)
                `, [mesaId, timerInfo.fecha_inicio, Math.round(tiempoTotal / 60000)]);
            }

        } catch (error) {
            console.error('❌ Error registrando tiempo de ocupación:', error);
        }
    }

    /**
     * Formatear tiempo en formato legible
     */
    formatearTiempo(milisegundos) {
        const minutos = Math.floor(milisegundos / 60000);
        const horas = Math.floor(minutos / 60);
        const minutosRestantes = minutos % 60;

        if (horas > 0) {
            return `${horas}h ${minutosRestantes}m`;
        } else {
            return `${minutos}m`;
        }
    }

    /**
     * Calcular resumen del salón
     */
    calcularResumenSalon(zonas) {
        const totales = zonas.reduce((acc, zona) => {
            acc.total += zona.total_mesas || 0;
            acc.libres += zona.mesas_libres || 0;
            acc.ocupadas += zona.mesas_ocupadas || 0;
            acc.reservadas += zona.mesas_reservadas || 0;
            acc.sucias += zona.mesas_sucias || 0;
            return acc;
        }, { total: 0, libres: 0, ocupadas: 0, reservadas: 0, sucias: 0 });

        return {
            ...totales,
            porcentaje_ocupacion: totales.total > 0 ?
                Math.round((totales.ocupadas / totales.total) * 100) : 0
        };
    }

    /**
     * Calcular tiempo promedio de zona
     */
    calcularTiempoPromedioZona(mesas) {
        const mesasOcupadas = mesas.filter(m => m.estado === this.ESTADOS_MESA.OCUPADA);
        if (mesasOcupadas.length === 0) return '0m';

        const promedio = mesasOcupadas.reduce((sum, m) => sum + m.tiempo_ocupacion, 0) / mesasOcupadas.length;
        return this.formatearTiempo(promedio);
    }

    /**
     * Programar liberación automática de mesa reservada
     */
    programarLiberacionAutomatica(mesaId, minutos) {
        setTimeout(async () => {
            try {
                const mesa = this.estadosCache.get(mesaId);
                if (mesa && mesa.estado === this.ESTADOS_MESA.RESERVADA) {
                    await this.cambiarEstadoMesa(mesaId, this.ESTADOS_MESA.LIBRE, {
                        observaciones: 'Liberación automática por tiempo de reserva vencido'
                    });
                }
            } catch (error) {
                console.error('❌ Error en liberación automática:', error);
            }
        }, minutos * 60000);
    }

    /**
     * Iniciar actualizaciones periódicas
     */
    iniciarActualizacionesPeriodicas() {
        if (this.intervaloActualizacion) {
            clearInterval(this.intervaloActualizacion);
        }

        // Actualizar cache cada 30 segundos
        this.intervaloActualizacion = setInterval(async () => {
            try {
                await this.sincronizarCacheConBD();
            } catch (error) {
                console.error('❌ Error en actualización periódica:', error);
            }
        }, 30000);
    }

    /**
     * Sincronizar cache con base de datos
     */
    async sincronizarCacheConBD() {
        try {
            const [mesas] = await this.connection.execute(`
                SELECT
                    m.*,
                    v.id as venta_id,
                    v.estado as venta_estado,
                    v.fecha_apertura,
                    u.nombre as garzon_nombre
                FROM mesas m
                LEFT JOIN ventas v ON m.id = v.mesa_id AND v.estado NOT IN ('cerrada', 'cancelada')
                LEFT JOIN usuarios u ON v.usuario_id = u.id
                WHERE m.activo = 1
            `);

            // Actualizar solo las mesas que han cambiado
            for (const mesa of mesas) {
                const mesaCache = this.estadosCache.get(mesa.id);
                if (!mesaCache || mesaCache.updated_at < mesa.updated_at) {
                    this.estadosCache.set(mesa.id, {
                        ...mesa,
                        tiempo_ocupacion: mesa.fecha_apertura ?
                            Date.now() - new Date(mesa.fecha_apertura).getTime() : 0,
                        ultima_actualizacion: Date.now()
                    });
                }
            }

        } catch (error) {
            console.error('❌ Error sincronizando cache:', error);
        }
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 MesasManager: Limpiando recursos...');

        // Limpiar todos los timers de ocupación
        for (const [mesaId, timerInfo] of this.timersOcupacion) {
            clearInterval(timerInfo.timer);
        }
        this.timersOcupacion.clear();

        // Limpiar intervalo de actualización
        if (this.intervaloActualizacion) {
            clearInterval(this.intervaloActualizacion);
        }

        // Limpiar cache
        this.estadosCache.clear();

        // Remover todos los listeners
        this.removeAllListeners();
    }
}

module.exports = MesasManager;