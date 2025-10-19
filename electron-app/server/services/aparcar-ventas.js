/**
 * DYSA Point - Sistema de Aparcar Ventas
 * Funcionalidad crítica #2 - Pausar y recuperar ventas temporalmente
 *
 * Características del sistema antiguo implementadas:
 * - Aparcar ventas sin cerrarlas definitivamente
 * - Liberar mesa temporalmente
 * - Recuperar venta aparcada en cualquier mesa
 * - Mantener integridad de productos y datos
 * - Control de tiempos y permisos de aparcamiento
 */

const { EventEmitter } = require('events');

class AparcamientoManager extends EventEmitter {
    constructor(database) {
        super();
        this.db = database;
        this.connection = database.connection;

        // Estados de venta (usando columna 'cerrada' existente)
        this.ESTADOS_VENTA = {
            NUEVA: 'N',          // Nueva venta (abierta)
            APARCADA: 'M',       // Aparcada temporalmente (M = "en espera")
            CERRADA: 'Y'         // Cerrada definitivamente
        };

        // Configuraciones por defecto
        this.TIEMPO_MAXIMO_APARCAMIENTO = 120; // minutos
        this.TIEMPO_NOTIFICACION = 15; // minutos antes del límite

        console.log('🅿️ AparcamientoManager inicializado correctamente');
    }

    /**
     * Aparcar una venta - Pausa temporalmente la venta liberando la mesa
     */
    async aparcarVenta(ventaId, usuarioId, motivo = null) {
        try {
            console.log(`🅿️ Aparcando venta ${ventaId} - Usuario: ${usuarioId}`);

            // Verificar que la venta existe y está activa
            const [ventas] = await this.connection.execute(`
                SELECT id_venta, Num_Mesa, cerrada, total, id_camarero
                FROM ventadirecta
                WHERE id_venta = ? AND cerrada = ?
            `, [ventaId, this.ESTADOS_VENTA.NUEVA]);

            if (ventas.length === 0) {
                throw new Error(`Venta ${ventaId} no encontrada o no está activa`);
            }

            const venta = ventas[0];

            // Verificar permisos del usuario
            const puedeAparcar = await this.verificarPermisos(usuarioId, 'aparcar');
            if (!puedeAparcar) {
                throw new Error('Usuario no tiene permisos para aparcar ventas');
            }

            // Contar productos en la venta
            const [productos] = await this.connection.execute(`
                SELECT COUNT(*) as total_productos
                FROM ventadir_comg
                WHERE id_venta = ?
            `, [ventaId]);

            const totalProductos = productos[0].total_productos;

            // Aparcar la venta
            await this.connection.execute(`
                UPDATE ventadirecta
                SET cerrada = ?,
                    fecha_aparcamiento = CURRENT_TIMESTAMP,
                    usuario_aparcamiento = ?,
                    motivo_aparcamiento = ?
                WHERE id_venta = ?
            `, [this.ESTADOS_VENTA.APARCADA, usuarioId, motivo, ventaId]);

            // Liberar la mesa
            await this.connection.execute(`
                UPDATE mesa
                SET estado = 'libre'
                WHERE Num_Mesa = ?
            `, [venta.Num_Mesa]);

            // Registrar en historial
            await this.connection.execute(`
                INSERT INTO historial_aparcamientos (
                    id_venta, accion, usuario_accion, motivo,
                    productos_antes, mesa_anterior, total_venta
                ) VALUES (?, 'aparcar', ?, ?, ?, ?, ?)
            `, [ventaId, usuarioId, motivo, totalProductos, venta.Num_Mesa, venta.total]);

            // Emitir evento
            this.emit('venta_aparcada', {
                venta_id: ventaId,
                mesa_liberada: venta.Num_Mesa,
                usuario: usuarioId,
                productos: totalProductos,
                total: venta.total
            });

            console.log(`✅ Venta ${ventaId} aparcada exitosamente`);

            return {
                success: true,
                venta_id: ventaId,
                mesa_liberada: venta.Num_Mesa,
                productos_aparcados: totalProductos,
                tiempo_maximo: this.TIEMPO_MAXIMO_APARCAMIENTO
            };

        } catch (error) {
            console.error(`❌ Error aparcando venta ${ventaId}:`, error);
            throw error;
        }
    }

    /**
     * Recuperar venta aparcada - Reactiva la venta en una mesa disponible
     */
    async recuperarVenta(ventaId, nuevaMesa, usuarioId) {
        try {
            console.log(`🔄 Recuperando venta ${ventaId} en mesa ${nuevaMesa} - Usuario: ${usuarioId}`);

            // Verificar que la venta está aparcada
            const [ventas] = await this.connection.execute(`
                SELECT id_venta, Num_Mesa, fecha_aparcamiento, total, id_camarero
                FROM ventadirecta
                WHERE id_venta = ? AND cerrada = ?
            `, [ventaId, this.ESTADOS_VENTA.APARCADA]);

            if (ventas.length === 0) {
                throw new Error(`Venta ${ventaId} no encontrada o no está aparcada`);
            }

            const venta = ventas[0];

            // Verificar permisos
            const puedeRecuperar = await this.verificarPermisos(usuarioId, 'recuperar');
            if (!puedeRecuperar) {
                throw new Error('Usuario no tiene permisos para recuperar ventas');
            }

            // Verificar que la nueva mesa está libre
            const [mesa] = await this.connection.execute(`
                SELECT Num_Mesa, estado
                FROM mesa
                WHERE Num_Mesa = ?
            `, [nuevaMesa]);

            if (mesa.length === 0) {
                throw new Error(`Mesa ${nuevaMesa} no encontrada`);
            }

            if (mesa[0].estado !== 'libre') {
                throw new Error(`Mesa ${nuevaMesa} no está disponible`);
            }

            // Verificar tiempo de aparcamiento
            const tiempoAparcada = await this.calcularTiempoAparcamiento(venta.fecha_aparcamiento);
            if (tiempoAparcada > this.TIEMPO_MAXIMO_APARCAMIENTO) {
                console.warn(`⚠️ Venta ${ventaId} excedió tiempo máximo de aparcamiento: ${tiempoAparcada} minutos`);
            }

            // Contar productos
            const [productos] = await this.connection.execute(`
                SELECT COUNT(*) as total_productos
                FROM ventadir_comg
                WHERE id_venta = ?
            `, [ventaId]);

            const totalProductos = productos[0].total_productos;

            // Recuperar la venta
            await this.connection.execute(`
                UPDATE ventadirecta
                SET cerrada = ?,
                    Num_Mesa = ?,
                    fecha_aparcamiento = NULL,
                    usuario_aparcamiento = NULL,
                    motivo_aparcamiento = NULL
                WHERE id_venta = ?
            `, [this.ESTADOS_VENTA.NUEVA, nuevaMesa, ventaId]);

            // Ocupar la nueva mesa
            await this.connection.execute(`
                UPDATE mesa
                SET estado = 'ocupada'
                WHERE Num_Mesa = ?
            `, [nuevaMesa]);

            // Registrar en historial
            await this.connection.execute(`
                INSERT INTO historial_aparcamientos (
                    id_venta, accion, usuario_accion,
                    productos_despues, mesa_anterior, mesa_nueva, total_venta
                ) VALUES (?, 'recuperar', ?, ?, ?, ?, ?)
            `, [ventaId, usuarioId, totalProductos, venta.Num_Mesa, nuevaMesa, venta.total]);

            // Emitir evento
            this.emit('venta_recuperada', {
                venta_id: ventaId,
                mesa_anterior: venta.Num_Mesa,
                mesa_nueva: nuevaMesa,
                usuario: usuarioId,
                productos: totalProductos,
                tiempo_aparcada: tiempoAparcada
            });

            console.log(`✅ Venta ${ventaId} recuperada exitosamente en mesa ${nuevaMesa}`);

            return {
                success: true,
                venta_id: ventaId,
                mesa_anterior: venta.Num_Mesa,
                mesa_nueva: nuevaMesa,
                productos_recuperados: totalProductos,
                tiempo_aparcada: tiempoAparcada
            };

        } catch (error) {
            console.error(`❌ Error recuperando venta ${ventaId}:`, error);
            throw error;
        }
    }

    /**
     * Obtener lista de ventas aparcadas
     */
    async obtenerVentasAparcadas() {
        try {
            const [ventas] = await this.connection.execute(`
                SELECT
                    vd.id_venta,
                    vd.Num_Mesa as mesa_original,
                    m.descripcion as mesa_descripcion,
                    vd.fecha_venta,
                    vd.fecha_aparcamiento,
                    vd.motivo_aparcamiento,
                    vd.total,
                    vd.comensales,
                    c.nombre as camarero_nombre,
                    ua.nombre as usuario_aparcamiento_nombre,
                    TIMESTAMPDIFF(MINUTE, vd.fecha_aparcamiento, NOW()) as minutos_aparcada,
                    COUNT(vc.id_linea) as productos_total
                FROM ventadirecta vd
                JOIN mesa m ON vd.Num_Mesa = m.Num_Mesa
                JOIN camareros c ON vd.id_camarero = c.id_camarero
                LEFT JOIN camareros ua ON vd.usuario_aparcamiento = ua.id_camarero
                LEFT JOIN ventadir_comg vc ON vd.id_venta = vc.id_venta
                WHERE vd.cerrada = ?
                GROUP BY vd.id_venta, vd.Num_Mesa, m.descripcion, vd.fecha_venta,
                         vd.fecha_aparcamiento, vd.motivo_aparcamiento, vd.total,
                         vd.comensales, c.nombre, ua.nombre
                ORDER BY vd.fecha_aparcamiento ASC
            `, [this.ESTADOS_VENTA.APARCADA]);

            // Calcular alertas por tiempo
            const ventasConAlertas = ventas.map(venta => ({
                ...venta,
                tiempo_restante: this.TIEMPO_MAXIMO_APARCAMIENTO - venta.minutos_aparcada,
                alerta_tiempo: venta.minutos_aparcada >= (this.TIEMPO_MAXIMO_APARCAMIENTO - this.TIEMPO_NOTIFICACION),
                tiempo_excedido: venta.minutos_aparcada > this.TIEMPO_MAXIMO_APARCAMIENTO
            }));

            return {
                success: true,
                ventas_aparcadas: ventasConAlertas,
                total: ventasConAlertas.length,
                con_alerta: ventasConAlertas.filter(v => v.alerta_tiempo).length,
                excedidas: ventasConAlertas.filter(v => v.tiempo_excedido).length
            };

        } catch (error) {
            console.error('❌ Error obteniendo ventas aparcadas:', error);
            throw error;
        }
    }

    /**
     * Obtener historial de aparcamientos
     */
    async obtenerHistorialAparcamientos(fechaDesde = null, fechaHasta = null, limit = 50) {
        try {
            let query = `
                SELECT
                    ha.*,
                    vd.Num_Mesa,
                    c.nombre as usuario_nombre,
                    CASE
                        WHEN ha.accion = 'recuperar'
                        THEN TIMESTAMPDIFF(MINUTE,
                            (SELECT fecha_accion FROM historial_aparcamientos ha2
                             WHERE ha2.id_venta = ha.id_venta AND ha2.accion = 'aparcar'
                             ORDER BY ha2.fecha_accion DESC LIMIT 1),
                            ha.fecha_accion)
                        ELSE NULL
                    END as tiempo_aparcamiento_minutos
                FROM historial_aparcamientos ha
                JOIN ventadirecta vd ON ha.id_venta = vd.id_venta
                JOIN camareros c ON ha.usuario_accion = c.id_camarero
                WHERE 1=1
            `;

            const params = [];

            if (fechaDesde) {
                query += ` AND DATE(ha.fecha_accion) >= ?`;
                params.push(fechaDesde);
            }

            if (fechaHasta) {
                query += ` AND DATE(ha.fecha_accion) <= ?`;
                params.push(fechaHasta);
            }

            query += ` ORDER BY ha.fecha_accion DESC LIMIT ?`;
            params.push(parseInt(limit));

            const [historial] = await this.connection.execute(query, params);

            return {
                success: true,
                historial: historial,
                total: historial.length
            };

        } catch (error) {
            console.error('❌ Error obteniendo historial:', error);
            throw error;
        }
    }

    /**
     * Obtener configuración de aparcamiento
     */
    async obtenerConfiguracion(tipo = 'global', idReferencia = null) {
        try {
            const [configs] = await this.connection.execute(`
                SELECT * FROM configuracion_aparcamiento
                WHERE tipo_config = ? AND (id_referencia = ? OR id_referencia IS NULL)
                AND activo = TRUE
                ORDER BY id_referencia IS NULL ASC
                LIMIT 1
            `, [tipo, idReferencia]);

            if (configs.length > 0) {
                return configs[0];
            }

            // Devolver configuración por defecto si no existe
            return {
                tiempo_maximo_aparcamiento: this.TIEMPO_MAXIMO_APARCAMIENTO,
                permitir_cambio_mesa: true,
                mantener_productos_cocina: true,
                puede_aparcar: true,
                puede_recuperar: true,
                requiere_motivo: false
            };

        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error);
            throw error;
        }
    }

    // Métodos auxiliares

    /**
     * Verificar permisos de usuario
     */
    async verificarPermisos(usuarioId, accion) {
        try {
            // Obtener configuración del usuario
            const config = await this.obtenerConfiguracion('usuario', usuarioId);

            switch (accion) {
                case 'aparcar':
                    return config.puede_aparcar !== false;
                case 'recuperar':
                    return config.puede_recuperar !== false;
                default:
                    return false;
            }
        } catch (error) {
            console.warn('⚠️ Error verificando permisos, permitiendo por defecto:', error.message);
            return true; // Permitir por defecto en caso de error
        }
    }

    /**
     * Calcular tiempo transcurrido desde aparcamiento
     */
    calcularTiempoAparcamiento(fechaAparcamiento) {
        const ahora = new Date();
        const fechaParcamiento = new Date(fechaAparcamiento);
        const diferenciaMs = ahora - fechaParcamiento;
        return Math.floor(diferenciaMs / (1000 * 60)); // minutos
    }

    /**
     * Limpiar ventas aparcadas vencidas
     */
    async limpiarVentasVencidas() {
        try {
            console.log('🧹 Limpiando ventas aparcadas vencidas...');

            const [ventasVencidas] = await this.connection.execute(`
                SELECT id_venta, Num_Mesa, fecha_aparcamiento
                FROM ventadirecta
                WHERE cerrada = ? AND TIMESTAMPDIFF(MINUTE, fecha_aparcamiento, NOW()) > ?
            `, [this.ESTADOS_VENTA.APARCADA, this.TIEMPO_MAXIMO_APARCAMIENTO * 2]); // Doble del tiempo máximo

            for (const venta of ventasVencidas) {
                console.warn(`⚠️ Venta ${venta.id_venta} vencida hace ${this.calcularTiempoAparcamiento(venta.fecha_aparcamiento)} minutos`);

                // Opcional: Cerrar automáticamente o notificar
                this.emit('venta_vencida', {
                    venta_id: venta.id_venta,
                    mesa: venta.Num_Mesa,
                    tiempo_vencida: this.calcularTiempoAparcamiento(venta.fecha_aparcamiento)
                });
            }

            return ventasVencidas.length;

        } catch (error) {
            console.error('❌ Error limpiando ventas vencidas:', error);
            return 0;
        }
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 AparcamientoManager: Limpiando recursos...');
        this.removeAllListeners();
    }
}

module.exports = AparcamientoManager;