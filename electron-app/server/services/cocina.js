/**
 * DYSA Point - Sistema de Comandas por Estación de Cocina
 * Manejo profesional de comandas por estaciones con prioridades y tiempos
 *
 * Funcionalidades:
 * - Separación automática de comandas por estación
 * - Sistema de prioridades (normal, urgente, crítica)
 * - Estados de preparación detallados
 * - Notificaciones automáticas a garzones
 * - Métricas de tiempo de preparación
 * - Impresión automática por estación
 */

const { EventEmitter } = require('events');

class CocinaManager extends EventEmitter {
    constructor(database) {
        super();
        this.db = database;
        this.connection = database.connection;

        // Estados de comandas
        this.ESTADOS_COMANDA = {
            PENDIENTE: 'pendiente',
            RECIBIDA: 'recibida',
            EN_PREPARACION: 'en_preparacion',
            LISTA: 'lista',
            SERVIDA: 'servida',
            CANCELADA: 'cancelada'
        };

        // Prioridades de comandas
        this.PRIORIDADES = {
            NORMAL: 'normal',
            URGENTE: 'urgente',
            CRITICA: 'critica'
        };

        // Cache de comandas activas por estación
        this.comandasActivas = new Map();

        // Timers de tiempo de preparación
        this.timersPreparacion = new Map();

        // Intervalos de actualización
        this.intervaloActualizacion = null;

        console.log('👨‍🍳 CocinaManager inicializado correctamente');
        this.inicializarCache();
    }

    /**
     * Inicializar cache de comandas activas
     */
    async inicializarCache() {
        try {
            const [comandas] = await this.connection.execute(`
                SELECT
                    cc.*,
                    vi.producto_id,
                    vi.cantidad,
                    vi.observaciones as item_observaciones,
                    p.nombre as producto_nombre,
                    p.tiempo_preparacion,
                    ec.nombre as estacion_nombre,
                    ec.color as estacion_color,
                    v.mesa_id,
                    m.nombre as mesa_nombre,
                    u.nombre as garzon_nombre,
                    u.apellido as garzon_apellido
                FROM comandas_cocina cc
                JOIN venta_items vi ON cc.item_id = vi.id
                JOIN productos p ON vi.producto_id = p.id
                JOIN estaciones_cocina ec ON cc.estacion_id = ec.id
                JOIN ventas v ON vi.venta_id = v.id
                JOIN mesas m ON v.mesa_id = m.id
                JOIN usuarios u ON v.usuario_id = u.id
                WHERE cc.estado NOT IN ('servida', 'cancelada')
                ORDER BY cc.prioridad DESC, cc.created_at ASC
            `);

            // Agrupar por estación
            const comandasPorEstacion = new Map();

            for (const comanda of comandas) {
                const estacionId = comanda.estacion_id;

                if (!comandasPorEstacion.has(estacionId)) {
                    comandasPorEstacion.set(estacionId, {
                        estacion: {
                            id: estacionId,
                            nombre: comanda.estacion_nombre,
                            color: comanda.estacion_color
                        },
                        comandas: []
                    });
                }

                // Calcular tiempo transcurrido
                const tiempoTranscurrido = Date.now() - new Date(comanda.created_at).getTime();
                const tiempoEstimado = (comanda.tiempo_preparacion || 15) * 60000; // convertir a ms

                comandasPorEstacion.get(estacionId).comandas.push({
                    ...comanda,
                    tiempo_transcurrido: tiempoTranscurrido,
                    tiempo_estimado: tiempoEstimado,
                    progreso_porcentaje: Math.min(100, (tiempoTranscurrido / tiempoEstimado) * 100),
                    tiempo_excedido: tiempoTranscurrido > tiempoEstimado
                });

                // Iniciar timer si está en preparación
                if (comanda.estado === this.ESTADOS_COMANDA.EN_PREPARACION) {
                    this.iniciarTimerPreparacion(comanda.id, new Date(comanda.fecha_inicio_preparacion));
                }
            }

            this.comandasActivas = comandasPorEstacion;

            console.log(`✅ Cache de comandas inicializado: ${comandas.length} comandas activas en ${comandasPorEstacion.size} estaciones`);

        } catch (error) {
            console.error('❌ Error inicializando cache de comandas:', error);
        }
    }

    /**
     * Crear nueva comanda automáticamente desde una venta
     */
    async crearComandaDesdeVenta(itemId, estacionId, prioridad = this.PRIORIDADES.NORMAL) {
        try {
            // Verificar si ya existe comanda para este ítem
            const [existing] = await this.connection.execute(`
                SELECT id FROM comandas_cocina WHERE item_id = ?
            `, [itemId]);

            if (existing.length > 0) {
                console.log(`⚠️ Comanda ya existe para ítem ${itemId}`);
                return { success: true, comanda_id: existing[0].id, existia: true };
            }

            // Crear nueva comanda
            const [resultado] = await this.connection.execute(`
                INSERT INTO comandas_cocina (
                    item_id, estacion_id, estado, prioridad,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [itemId, estacionId, this.ESTADOS_COMANDA.PENDIENTE, prioridad]);

            const comandaId = resultado.insertId;

            // Actualizar cache
            await this.actualizarCacheComanda(comandaId);

            // Emitir evento de nueva comanda
            this.emit('nueva_comanda', {
                comanda_id: comandaId,
                estacion_id: estacionId,
                item_id: itemId
            });

            console.log(`✅ Comanda creada: ID ${comandaId} para estación ${estacionId}`);

            return { success: true, comanda_id: comandaId, existia: false };

        } catch (error) {
            console.error('❌ Error creando comanda:', error);
            throw error;
        }
    }

    /**
     * Cambiar estado de una comanda
     */
    async cambiarEstadoComanda(comandaId, nuevoEstado, datos = {}) {
        try {
            const { usuario_codigo, observaciones } = datos;

            // Validar estado
            if (!Object.values(this.ESTADOS_COMANDA).includes(nuevoEstado)) {
                throw new Error(`Estado inválido: ${nuevoEstado}`);
            }

            // Obtener comanda actual
            const [comandas] = await this.connection.execute(`
                SELECT * FROM comandas_cocina WHERE id = ?
            `, [comandaId]);

            if (comandas.length === 0) {
                throw new Error(`Comanda ${comandaId} no encontrada`);
            }

            const comandaActual = comandas[0];
            const estadoAnterior = comandaActual.estado;

            // Validar usuario si se proporciona
            let usuarioInfo = null;
            if (usuario_codigo) {
                const [usuarios] = await this.connection.execute(`
                    SELECT id, nombre, apellido FROM usuarios
                    WHERE codigo_privado = ? AND activo = 1
                `, [usuario_codigo]);

                if (usuarios.length === 0) {
                    throw new Error('Código de usuario inválido');
                }
                usuarioInfo = usuarios[0];
            }

            // Preparar campos de actualización
            const campos = ['estado = ?', 'updated_at = CURRENT_TIMESTAMP'];
            const valores = [nuevoEstado];

            // Agregar campos específicos según el estado
            switch (nuevoEstado) {
                case this.ESTADOS_COMANDA.EN_PREPARACION:
                    campos.push('fecha_inicio_preparacion = CURRENT_TIMESTAMP');
                    if (usuarioInfo) {
                        campos.push('cocinero_id = ?');
                        valores.push(usuarioInfo.id);
                    }
                    break;

                case this.ESTADOS_COMANDA.LISTA:
                    campos.push('fecha_listo = CURRENT_TIMESTAMP');
                    break;

                case this.ESTADOS_COMANDA.SERVIDA:
                    campos.push('fecha_servido = CURRENT_TIMESTAMP');
                    break;

                case this.ESTADOS_COMANDA.CANCELADA:
                    campos.push('fecha_cancelacion = CURRENT_TIMESTAMP');
                    campos.push('motivo_cancelacion = ?');
                    valores.push(observaciones || 'Sin motivo especificado');
                    break;
            }

            // Actualizar base de datos
            valores.push(comandaId);
            await this.connection.execute(`
                UPDATE comandas_cocina
                SET ${campos.join(', ')}
                WHERE id = ?
            `, valores);

            // Manejar cambios específicos de estado
            await this.manejarCambioEstadoComanda(comandaId, estadoAnterior, nuevoEstado, {
                usuario_info: usuarioInfo,
                observaciones
            });

            // Actualizar cache
            await this.actualizarCacheComanda(comandaId);

            // Emitir evento
            this.emit('cambio_estado_comanda', {
                comanda_id: comandaId,
                estacion_id: comandaActual.estacion_id,
                estado_anterior: estadoAnterior,
                estado_nuevo: nuevoEstado
            });

            console.log(`✅ Comanda ${comandaId}: ${estadoAnterior} → ${nuevoEstado}`);

            return {
                success: true,
                comanda_id: comandaId,
                estado_anterior: estadoAnterior,
                estado_nuevo: nuevoEstado
            };

        } catch (error) {
            console.error('❌ Error cambiando estado de comanda:', error);
            throw error;
        }
    }

    /**
     * Obtener comandas por estación
     */
    async obtenerComandasEstacion(estacionId, filtros = {}) {
        try {
            const { estado, prioridad, desde_fecha } = filtros;

            let query = `
                SELECT
                    cc.*,
                    vi.producto_id,
                    vi.cantidad,
                    vi.observaciones as item_observaciones,
                    p.nombre as producto_nombre,
                    p.tiempo_preparacion,
                    ec.nombre as estacion_nombre,
                    ec.color as estacion_color,
                    v.mesa_id,
                    m.nombre as mesa_nombre,
                    u.nombre as garzon_nombre,
                    u.apellido as garzon_apellido,
                    cocinero.nombre as cocinero_nombre
                FROM comandas_cocina cc
                JOIN venta_items vi ON cc.item_id = vi.id
                JOIN productos p ON vi.producto_id = p.id
                JOIN estaciones_cocina ec ON cc.estacion_id = ec.id
                JOIN ventas v ON vi.venta_id = v.id
                JOIN mesas m ON v.mesa_id = m.id
                JOIN usuarios u ON v.usuario_id = u.id
                LEFT JOIN usuarios cocinero ON cc.cocinero_id = cocinero.id
                WHERE cc.estacion_id = ?
            `;

            const params = [estacionId];

            if (estado) {
                query += ` AND cc.estado = ?`;
                params.push(estado);
            } else {
                // Por defecto, excluir servidas y canceladas
                query += ` AND cc.estado NOT IN ('servida', 'cancelada')`;
            }

            if (prioridad) {
                query += ` AND cc.prioridad = ?`;
                params.push(prioridad);
            }

            if (desde_fecha) {
                query += ` AND DATE(cc.created_at) >= ?`;
                params.push(desde_fecha);
            }

            query += ` ORDER BY
                       CASE cc.prioridad
                         WHEN 'critica' THEN 1
                         WHEN 'urgente' THEN 2
                         WHEN 'normal' THEN 3
                       END,
                       cc.created_at ASC`;

            const [comandas] = await this.connection.execute(query, params);

            // Procesar comandas con información adicional
            const comandasProcesadas = comandas.map(comanda => {
                const tiempoTranscurrido = Date.now() - new Date(comanda.created_at).getTime();
                const tiempoEstimado = (comanda.tiempo_preparacion || 15) * 60000;

                return {
                    ...comanda,
                    tiempo_transcurrido: tiempoTranscurrido,
                    tiempo_estimado: tiempoEstimado,
                    tiempo_transcurrido_formateado: this.formatearTiempo(tiempoTranscurrido),
                    tiempo_estimado_formateado: this.formatearTiempo(tiempoEstimado),
                    progreso_porcentaje: Math.min(100, (tiempoTranscurrido / tiempoEstimado) * 100),
                    tiempo_excedido: tiempoTranscurrido > tiempoEstimado,
                    urgente: tiempoTranscurrido > (tiempoEstimado * 0.8) // 80% del tiempo estimado
                };
            });

            return {
                success: true,
                estacion_id: estacionId,
                comandas: comandasProcesadas,
                total: comandasProcesadas.length,
                por_estado: this.agruparComandasPorEstado(comandasProcesadas)
            };

        } catch (error) {
            console.error('❌ Error obteniendo comandas de estación:', error);
            throw error;
        }
    }

    /**
     * Obtener resumen de todas las estaciones
     */
    async obtenerResumenEstaciones() {
        try {
            const [estaciones] = await this.connection.execute(`
                SELECT
                    ec.*,
                    COUNT(cc.id) as total_comandas,
                    COUNT(CASE WHEN cc.estado = 'pendiente' THEN 1 END) as pendientes,
                    COUNT(CASE WHEN cc.estado = 'en_preparacion' THEN 1 END) as en_preparacion,
                    COUNT(CASE WHEN cc.estado = 'lista' THEN 1 END) as listas,
                    COUNT(CASE WHEN cc.prioridad = 'critica' THEN 1 END) as criticas,
                    COUNT(CASE WHEN cc.prioridad = 'urgente' THEN 1 END) as urgentes
                FROM estaciones_cocina ec
                LEFT JOIN comandas_cocina cc ON ec.id = cc.estacion_id
                    AND cc.estado NOT IN ('servida', 'cancelada')
                WHERE ec.activo = 1
                GROUP BY ec.id
                ORDER BY ec.orden ASC
            `);

            // Calcular tiempos promedio por estación
            for (const estacion of estaciones) {
                const tiemposPromedio = await this.calcularTiemposPromedioEstacion(estacion.id);
                estacion.tiempo_promedio_preparacion = tiemposPromedio.promedio_preparacion;
                estacion.tiempo_promedio_espera = tiemposPromedio.promedio_espera;
            }

            return {
                success: true,
                estaciones: estaciones,
                resumen_global: this.calcularResumenGlobal(estaciones),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error obteniendo resumen de estaciones:', error);
            throw error;
        }
    }

    /**
     * Cambiar prioridad de una comanda
     */
    async cambiarPrioridadComanda(comandaId, nuevaPrioridad, usuarioCodigo) {
        try {
            // Validar prioridad
            if (!Object.values(this.PRIORIDADES).includes(nuevaPrioridad)) {
                throw new Error(`Prioridad inválida: ${nuevaPrioridad}`);
            }

            // Validar usuario
            const [usuarios] = await this.connection.execute(`
                SELECT id, nombre FROM usuarios
                WHERE codigo_privado = ? AND activo = 1
            `, [usuarioCodigo]);

            if (usuarios.length === 0) {
                throw new Error('Código de usuario inválido');
            }

            // Obtener prioridad actual
            const [comandas] = await this.connection.execute(`
                SELECT prioridad FROM comandas_cocina WHERE id = ?
            `, [comandaId]);

            if (comandas.length === 0) {
                throw new Error(`Comanda ${comandaId} no encontrada`);
            }

            const prioridadAnterior = comandas[0].prioridad;

            // Actualizar prioridad
            await this.connection.execute(`
                UPDATE comandas_cocina
                SET prioridad = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [nuevaPrioridad, comandaId]);

            // Actualizar cache
            await this.actualizarCacheComanda(comandaId);

            // Emitir evento
            this.emit('cambio_prioridad', {
                comanda_id: comandaId,
                prioridad_anterior: prioridadAnterior,
                prioridad_nueva: nuevaPrioridad
            });

            console.log(`📈 Prioridad comanda ${comandaId}: ${prioridadAnterior} → ${nuevaPrioridad}`);

            return {
                success: true,
                prioridad_anterior: prioridadAnterior,
                prioridad_nueva: nuevaPrioridad
            };

        } catch (error) {
            console.error('❌ Error cambiando prioridad:', error);
            throw error;
        }
    }

    // Métodos auxiliares

    /**
     * Manejar cambios específicos de estado
     */
    async manejarCambioEstadoComanda(comandaId, estadoAnterior, estadoNuevo, datos) {
        try {
            switch (estadoNuevo) {
                case this.ESTADOS_COMANDA.EN_PREPARACION:
                    // Iniciar timer de preparación
                    this.iniciarTimerPreparacion(comandaId);
                    break;

                case this.ESTADOS_COMANDA.LISTA:
                    // Detener timer y notificar a garzón
                    this.detenerTimerPreparacion(comandaId);
                    await this.notificarGarzonPlatoListo(comandaId);
                    break;

                case this.ESTADOS_COMANDA.SERVIDA:
                    // Registrar tiempo total de comanda
                    await this.registrarTiempoTotalComanda(comandaId);
                    break;

                case this.ESTADOS_COMANDA.CANCELADA:
                    // Detener timer y registrar cancelación
                    this.detenerTimerPreparacion(comandaId);
                    break;
            }

        } catch (error) {
            console.error('❌ Error manejando cambio de estado:', error);
        }
    }

    /**
     * Iniciar timer de preparación
     */
    iniciarTimerPreparacion(comandaId, fechaInicio = new Date()) {
        this.detenerTimerPreparacion(comandaId);

        const timer = setInterval(() => {
            this.emit('actualizacion_tiempo_preparacion', {
                comanda_id: comandaId,
                tiempo_transcurrido: Date.now() - fechaInicio.getTime()
            });
        }, 30000); // Actualizar cada 30 segundos

        this.timersPreparacion.set(comandaId, {
            timer: timer,
            fecha_inicio: fechaInicio
        });
    }

    /**
     * Detener timer de preparación
     */
    detenerTimerPreparacion(comandaId) {
        const timerInfo = this.timersPreparacion.get(comandaId);
        if (timerInfo) {
            clearInterval(timerInfo.timer);
            this.timersPreparacion.delete(comandaId);
        }
    }

    /**
     * Actualizar cache de una comanda específica
     */
    async actualizarCacheComanda(comandaId) {
        try {
            const [comandas] = await this.connection.execute(`
                SELECT
                    cc.*,
                    vi.producto_id,
                    vi.cantidad,
                    p.nombre as producto_nombre,
                    ec.nombre as estacion_nombre
                FROM comandas_cocina cc
                JOIN venta_items vi ON cc.item_id = vi.id
                JOIN productos p ON vi.producto_id = p.id
                JOIN estaciones_cocina ec ON cc.estacion_id = ec.id
                WHERE cc.id = ?
            `, [comandaId]);

            if (comandas.length > 0) {
                const comanda = comandas[0];
                const estacionId = comanda.estacion_id;

                if (!this.comandasActivas.has(estacionId)) {
                    this.comandasActivas.set(estacionId, {
                        estacion: { id: estacionId, nombre: comanda.estacion_nombre },
                        comandas: []
                    });
                }

                const estacionData = this.comandasActivas.get(estacionId);
                const comandaIndex = estacionData.comandas.findIndex(c => c.id === comandaId);

                if (comandaIndex >= 0) {
                    estacionData.comandas[comandaIndex] = comanda;
                } else {
                    estacionData.comandas.push(comanda);
                }
            }

        } catch (error) {
            console.error('❌ Error actualizando cache de comanda:', error);
        }
    }

    /**
     * Notificar a garzón que plato está listo
     */
    async notificarGarzonPlatoListo(comandaId) {
        try {
            // Obtener información de la comanda y venta
            const [info] = await this.connection.execute(`
                SELECT
                    v.usuario_id,
                    m.nombre as mesa_nombre,
                    p.nombre as producto_nombre
                FROM comandas_cocina cc
                JOIN venta_items vi ON cc.item_id = vi.id
                JOIN ventas v ON vi.venta_id = v.id
                JOIN mesas m ON v.mesa_id = m.id
                JOIN productos p ON vi.producto_id = p.id
                WHERE cc.id = ?
            `, [comandaId]);

            if (info.length > 0) {
                // Emitir evento de notificación
                this.emit('plato_listo', {
                    garzon_id: info[0].usuario_id,
                    mesa_nombre: info[0].mesa_nombre,
                    producto_nombre: info[0].producto_nombre,
                    comanda_id: comandaId
                });
            }

        } catch (error) {
            console.error('❌ Error notificando garzón:', error);
        }
    }

    /**
     * Registrar tiempo total de preparación de comanda
     */
    async registrarTiempoTotalComanda(comandaId) {
        try {
            await this.connection.execute(`
                UPDATE comandas_cocina
                SET tiempo_total_preparacion = TIMESTAMPDIFF(MINUTE, created_at, fecha_servido)
                WHERE id = ?
            `, [comandaId]);

        } catch (error) {
            console.error('❌ Error registrando tiempo total:', error);
        }
    }

    /**
     * Calcular tiempos promedio de una estación
     */
    async calcularTiemposPromedioEstacion(estacionId) {
        try {
            const [promedios] = await this.connection.execute(`
                SELECT
                    AVG(TIMESTAMPDIFF(MINUTE, created_at, fecha_listo)) as promedio_preparacion,
                    AVG(TIMESTAMPDIFF(MINUTE, fecha_listo, fecha_servido)) as promedio_espera
                FROM comandas_cocina
                WHERE estacion_id = ?
                AND estado = 'servida'
                AND DATE(created_at) = CURDATE()
            `, [estacionId]);

            return {
                promedio_preparacion: Math.round(promedios[0]?.promedio_preparacion || 0),
                promedio_espera: Math.round(promedios[0]?.promedio_espera || 0)
            };

        } catch (error) {
            return { promedio_preparacion: 0, promedio_espera: 0 };
        }
    }

    /**
     * Agrupar comandas por estado
     */
    agruparComandasPorEstado(comandas) {
        return comandas.reduce((acc, comanda) => {
            const estado = comanda.estado;
            if (!acc[estado]) acc[estado] = [];
            acc[estado].push(comanda);
            return acc;
        }, {});
    }

    /**
     * Calcular resumen global de estaciones
     */
    calcularResumenGlobal(estaciones) {
        return estaciones.reduce((acc, est) => {
            acc.total_comandas += est.total_comandas;
            acc.pendientes += est.pendientes;
            acc.en_preparacion += est.en_preparacion;
            acc.listas += est.listas;
            acc.criticas += est.criticas;
            acc.urgentes += est.urgentes;
            return acc;
        }, {
            total_comandas: 0,
            pendientes: 0,
            en_preparacion: 0,
            listas: 0,
            criticas: 0,
            urgentes: 0
        });
    }

    /**
     * Formatear tiempo en formato legible
     */
    formatearTiempo(milisegundos) {
        const minutos = Math.floor(milisegundos / 60000);
        if (minutos < 60) {
            return `${minutos}m`;
        } else {
            const horas = Math.floor(minutos / 60);
            const mins = minutos % 60;
            return `${horas}h ${mins}m`;
        }
    }

    /**
     * Iniciar actualizaciones periódicas
     */
    iniciarActualizacionesPeriodicas() {
        if (this.intervaloActualizacion) {
            clearInterval(this.intervaloActualizacion);
        }

        this.intervaloActualizacion = setInterval(async () => {
            try {
                await this.inicializarCache();
            } catch (error) {
                console.error('❌ Error en actualización periódica de cocina:', error);
            }
        }, 45000); // Actualizar cada 45 segundos
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 CocinaManager: Limpiando recursos...');

        // Limpiar timers de preparación
        for (const [comandaId, timerInfo] of this.timersPreparacion) {
            clearInterval(timerInfo.timer);
        }
        this.timersPreparacion.clear();

        // Limpiar intervalo de actualización
        if (this.intervaloActualizacion) {
            clearInterval(this.intervaloActualizacion);
        }

        // Limpiar cache
        this.comandasActivas.clear();

        // Remover listeners
        this.removeAllListeners();
    }
}

module.exports = CocinaManager;