/**
 * MapaVisualManager - Sistema de Mapa Visual de Mesas Empresarial
 * Gestión visual avanzada del salón con actualización en tiempo real
 *
 * Funcionalidad Crítica #5 del Sistema Anterior - FINAL
 * DYSA Point POS v2.0.14 - Nivel Empresarial
 * Autor: Claude Code
 * Fecha: 2025-10-13
 */

const EventEmitter = require('events');

class MapaVisualManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.configuracionCache = new Map();
        this.mesasEstadoCache = new Map();
        this.zonasCache = new Map();
        this.elementosDecorativosCache = new Map();
        this.lastCacheUpdate = null;
        this.cacheExpireTime = 2 * 1000; // 2 segundos para tiempo real
        this.actualizacionInterval = null;
        this.socketConnections = new Set();

        this.iniciarActualizacionesTiempoReal();
        console.log('🗺️ MapaVisualManager inicializado correctamente');
    }

    /**
     * Obtener configuración completa del mapa visual
     */
    async obtenerConfiguracionMapa() {
        try {
            const cacheKey = 'configuracion_mapa';

            // Verificar cache
            if (this.configuracionCache.has(cacheKey) &&
                Date.now() - this.lastCacheUpdate < this.cacheExpireTime) {
                return this.configuracionCache.get(cacheKey);
            }

            const [config] = await this.database.connection.execute(
                'SELECT * FROM configuracion_mapa_visual WHERE activo = TRUE ORDER BY id DESC LIMIT 1'
            );

            const configuracion = config && config.length > 0 ? config[0] : null;

            // Cache resultado
            this.configuracionCache.set(cacheKey, configuracion);
            this.lastCacheUpdate = Date.now();

            return configuracion;

        } catch (error) {
            console.error('Error obteniendo configuración del mapa:', error);
            throw error;
        }
    }

    /**
     * Obtener estado completo del mapa con todas las mesas
     */
    async obtenerEstadoCompletoMapa() {
        try {
            console.log('🗺️ Obteniendo estado completo del mapa visual');

            // Usar la vista optimizada
            const [mesas] = await this.database.connection.execute(`
                SELECT * FROM vista_mapa_completo
                ORDER BY Num_Mesa
            `);

            // Obtener zonas
            const [zonas] = await this.database.connection.execute(
                'SELECT * FROM zonas_salon WHERE activa = TRUE ORDER BY nombre'
            );

            // Obtener elementos decorativos
            const [elementos] = await this.database.connection.execute(
                'SELECT * FROM elementos_decorativos_mapa WHERE visible = TRUE ORDER BY capa_visual, nombre'
            );

            // Obtener configuración
            const configuracion = await this.obtenerConfiguracionMapa();

            const estadoCompleto = {
                configuracion,
                mesas: mesas.map(mesa => ({
                    ...mesa,
                    // Calcular color basado en estado
                    color_calculado: this.calcularColorMesa(mesa.estado_visual, configuracion),
                    // Información adicional de estado
                    estado_detallado: this.calcularEstadoDetallado(mesa),
                    // Tiempo formateado
                    tiempo_ocupacion_texto: this.formatearTiempoOcupacion(mesa.minutos_ocupada)
                })),
                zonas,
                elementos_decorativos: elementos,
                timestamp: new Date().toISOString(),
                total_mesas: mesas.length,
                resumen_estados: this.calcularResumenEstados(mesas)
            };

            // Emitir evento de actualización
            this.emit('estadoMapaActualizado', estadoCompleto);

            return estadoCompleto;

        } catch (error) {
            console.error('Error obteniendo estado completo del mapa:', error);
            throw error;
        }
    }

    /**
     * Actualizar posición de mesa
     */
    async actualizarPosicionMesa(mesaId, nuevaPosicion, usuarioId) {
        try {
            console.log(`🗺️ Actualizando posición de mesa ${mesaId}`);

            const { posicion_x, posicion_y, ancho, alto, rotacion } = nuevaPosicion;

            // Validar posición dentro de los límites del salón
            const configuracion = await this.obtenerConfiguracionMapa();
            if (posicion_x < 0 || posicion_x > configuracion.ancho_salon ||
                posicion_y < 0 || posicion_y > configuracion.alto_salon) {
                throw new Error('Posición fuera de los límites del salón');
            }

            // Verificar permisos
            await this.verificarPermisosEdicion(usuarioId);

            // Obtener posición anterior para historial
            const [posicionAnterior] = await this.database.connection.execute(
                'SELECT * FROM mesas_posicion_visual WHERE mesa_id = ?',
                [mesaId]
            );

            // Actualizar posición
            await this.database.connection.execute(`
                UPDATE mesas_posicion_visual
                SET posicion_x = ?, posicion_y = ?, ancho = ?, alto = ?, rotacion = ?, updated_at = NOW()
                WHERE mesa_id = ?
            `, [posicion_x, posicion_y, ancho || 80, alto || 80, rotacion || 0, mesaId]);

            // Registrar en historial
            await this.registrarCambioEnHistorial(
                'mesa_movida',
                mesaId,
                'mesas_posicion_visual',
                posicionAnterior[0],
                nuevaPosicion,
                usuarioId
            );

            // Limpiar cache
            this.limpiarCache();

            // Emitir evento
            this.emit('mesaMovida', {
                mesaId,
                posicionAnterior: posicionAnterior[0],
                posicionNueva: nuevaPosicion,
                usuarioId,
                timestamp: new Date().toISOString()
            });

            return {
                exito: true,
                mensaje: 'Posición de mesa actualizada exitosamente'
            };

        } catch (error) {
            console.error('Error actualizando posición de mesa:', error);
            throw error;
        }
    }

    /**
     * Crear nueva zona en el salón
     */
    async crearZona(datosZona, usuarioId) {
        try {
            console.log('🗺️ Creando nueva zona en el salón');

            // Verificar permisos
            await this.verificarPermisosEdicion(usuarioId);

            const {
                nombre, descripcion, area_x1, area_y1, area_x2, area_y2,
                tipo_zona, color_zona, camarero_asignado, requiere_reserva
            } = datosZona;

            // Validar que las coordenadas estén dentro del salón
            const configuracion = await this.obtenerConfiguracionMapa();
            if (area_x1 < 0 || area_x2 > configuracion.ancho_salon ||
                area_y1 < 0 || area_y2 > configuracion.alto_salon) {
                throw new Error('Las coordenadas de la zona están fuera de los límites del salón');
            }

            // Crear zona
            const [result] = await this.database.connection.execute(`
                INSERT INTO zonas_salon (
                    nombre, descripcion, area_x1, area_y1, area_x2, area_y2,
                    tipo_zona, color_zona, camarero_asignado, requiere_reserva
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                nombre, descripcion, area_x1, area_y1, area_x2, area_y2,
                tipo_zona, color_zona, camarero_asignado, requiere_reserva
            ]);

            // Registrar en historial
            await this.registrarCambioEnHistorial(
                'zona_creada',
                result.insertId,
                'zonas_salon',
                null,
                datosZona,
                usuarioId
            );

            // Limpiar cache
            this.limpiarCache();

            // Emitir evento
            this.emit('zonaCreada', {
                zonaId: result.insertId,
                datos: datosZona,
                usuarioId,
                timestamp: new Date().toISOString()
            });

            return {
                exito: true,
                zona_id: result.insertId,
                mensaje: 'Zona creada exitosamente'
            };

        } catch (error) {
            console.error('Error creando zona:', error);
            throw error;
        }
    }

    /**
     * Agregar elemento decorativo al mapa
     */
    async agregarElementoDecorativo(datosElemento, usuarioId) {
        try {
            console.log('🗺️ Agregando elemento decorativo al mapa');

            // Verificar permisos
            await this.verificarPermisosEdicion(usuarioId);

            const {
                nombre, tipo_elemento, posicion_x, posicion_y, ancho, alto,
                color, texto, imagen_url, capa_visual
            } = datosElemento;

            // Crear elemento
            const [result] = await this.database.connection.execute(`
                INSERT INTO elementos_decorativos_mapa (
                    nombre, tipo_elemento, posicion_x, posicion_y, ancho, alto,
                    color, texto, imagen_url, capa_visual
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                nombre, tipo_elemento, posicion_x, posicion_y, ancho, alto,
                color, texto, imagen_url, capa_visual || 0
            ]);

            // Registrar en historial
            await this.registrarCambioEnHistorial(
                'elemento_agregado',
                result.insertId,
                'elementos_decorativos_mapa',
                null,
                datosElemento,
                usuarioId
            );

            // Limpiar cache
            this.limpiarCache();

            // Emitir evento
            this.emit('elementoAgregado', {
                elementoId: result.insertId,
                datos: datosElemento,
                usuarioId,
                timestamp: new Date().toISOString()
            });

            return {
                exito: true,
                elemento_id: result.insertId,
                mensaje: 'Elemento decorativo agregado exitosamente'
            };

        } catch (error) {
            console.error('Error agregando elemento decorativo:', error);
            throw error;
        }
    }

    /**
     * Actualizar configuración del mapa
     */
    async actualizarConfiguracionMapa(nuevaConfiguracion, usuarioId) {
        try {
            console.log('🗺️ Actualizando configuración del mapa');

            // Verificar permisos de administración
            await this.verificarPermisosAdministracion(usuarioId);

            // Obtener configuración anterior
            const configuracionAnterior = await this.obtenerConfiguracionMapa();

            // Construir query de actualización
            const camposPermitidos = [
                'nombre_salon', 'ancho_salon', 'alto_salon', 'color_fondo', 'imagen_fondo',
                'escala_zoom', 'mostrar_numeros_mesa', 'mostrar_capacidad', 'mostrar_estado_tiempo',
                'mostrar_camarero', 'mostrar_total_cuenta', 'color_mesa_libre', 'color_mesa_ocupada',
                'color_mesa_reservada', 'color_mesa_limpieza', 'color_mesa_mantenimiento',
                'color_mesa_aparcada', 'intervalo_actualizacion', 'actualizar_automaticamente',
                'permitir_drag_drop', 'permitir_redimensionar', 'mostrar_grid', 'snap_to_grid',
                'grid_size', 'solo_lectura', 'requiere_permisos_edicion', 'nivel_permiso_edicion'
            ];

            const setClauses = [];
            const valores = [];

            for (const [campo, valor] of Object.entries(nuevaConfiguracion)) {
                if (camposPermitidos.includes(campo)) {
                    setClauses.push(`${campo} = ?`);
                    valores.push(valor);
                }
            }

            if (setClauses.length === 0) {
                throw new Error('No hay campos válidos para actualizar');
            }

            valores.push(configuracionAnterior.id);

            await this.database.connection.execute(`
                UPDATE configuracion_mapa_visual
                SET ${setClauses.join(', ')}, updated_at = NOW()
                WHERE id = ?
            `, valores);

            // Registrar en historial
            await this.registrarCambioEnHistorial(
                'configuracion_cambiada',
                configuracionAnterior.id,
                'configuracion_mapa_visual',
                configuracionAnterior,
                nuevaConfiguracion,
                usuarioId
            );

            // Limpiar cache
            this.limpiarCache();

            // Reiniciar actualizaciones si cambió el intervalo
            if (nuevaConfiguracion.intervalo_actualizacion) {
                this.reiniciarActualizacionesTiempoReal(nuevaConfiguracion.intervalo_actualizacion);
            }

            // Emitir evento
            this.emit('configuracionActualizada', {
                configuracionAnterior,
                configuracionNueva: nuevaConfiguracion,
                usuarioId,
                timestamp: new Date().toISOString()
            });

            return {
                exito: true,
                mensaje: 'Configuración del mapa actualizada exitosamente'
            };

        } catch (error) {
            console.error('Error actualizando configuración del mapa:', error);
            throw error;
        }
    }

    /**
     * Obtener historial de cambios del mapa
     */
    async obtenerHistorialCambios(filtros = {}) {
        try {
            const {
                fecha_desde, fecha_hasta, tipo_cambio, usuario_id,
                limit = 50, offset = 0
            } = filtros;

            let whereClause = 'WHERE 1=1';
            let params = [];

            if (fecha_desde && fecha_hasta) {
                whereClause += ' AND DATE(hcm.fecha_cambio) BETWEEN ? AND ?';
                params.push(fecha_desde, fecha_hasta);
            }

            if (tipo_cambio) {
                whereClause += ' AND hcm.tipo_cambio = ?';
                params.push(tipo_cambio);
            }

            if (usuario_id) {
                whereClause += ' AND hcm.usuario_cambio = ?';
                params.push(usuario_id);
            }

            const [historial] = await this.database.connection.execute(`
                SELECT
                    hcm.*,
                    c.nombre as usuario_nombre
                FROM historial_cambios_mapa hcm
                INNER JOIN camareros c ON hcm.usuario_cambio = c.id_camarero
                ${whereClause}
                ORDER BY hcm.fecha_cambio DESC
                LIMIT ? OFFSET ?
            `, [...params, parseInt(limit), parseInt(offset)]);

            return {
                historial,
                filtros,
                total: historial.length
            };

        } catch (error) {
            console.error('Error obteniendo historial de cambios:', error);
            throw error;
        }
    }

    /**
     * Crear plantilla del mapa actual
     */
    async crearPlantillaMapa(datosPlantilla, usuarioId) {
        try {
            console.log('🗺️ Creando plantilla del mapa actual');

            const { nombre, descripcion, tipo_restaurante, es_plantilla_base } = datosPlantilla;

            // Obtener configuración actual
            const configuracion = await this.obtenerConfiguracionMapa();

            // Obtener posiciones de mesas
            const [posicionesMesas] = await this.database.connection.execute(
                'SELECT * FROM mesas_posicion_visual WHERE visible = TRUE'
            );

            // Obtener zonas
            const [zonas] = await this.database.connection.execute(
                'SELECT * FROM zonas_salon WHERE activa = TRUE'
            );

            // Obtener elementos decorativos
            const [elementos] = await this.database.connection.execute(
                'SELECT * FROM elementos_decorativos_mapa WHERE visible = TRUE'
            );

            // Calcular capacidad estimada
            const [capacidad] = await this.database.connection.execute(
                'SELECT SUM(capacidad) as total FROM mesa WHERE activa = TRUE'
            );

            // Crear plantilla
            const [result] = await this.database.connection.execute(`
                INSERT INTO plantillas_mapa_visual (
                    nombre, descripcion, configuracion_mapa, posiciones_mesas,
                    zonas_definidas, elementos_decorativos, tipo_restaurante,
                    capacidad_estimada, es_plantilla_base, created_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                nombre, descripcion,
                JSON.stringify(configuracion),
                JSON.stringify(posicionesMesas),
                JSON.stringify(zonas),
                JSON.stringify(elementos),
                tipo_restaurante,
                capacidad[0].total,
                es_plantilla_base || false,
                usuarioId
            ]);

            // Emitir evento
            this.emit('plantillaCreada', {
                plantillaId: result.insertId,
                datos: datosPlantilla,
                usuarioId,
                timestamp: new Date().toISOString()
            });

            return {
                exito: true,
                plantilla_id: result.insertId,
                mensaje: 'Plantilla del mapa creada exitosamente'
            };

        } catch (error) {
            console.error('Error creando plantilla del mapa:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas del mapa
     */
    async obtenerEstadisticasMapa() {
        try {
            // Estadísticas de ocupación
            const [estadisticasOcupacion] = await this.database.connection.execute(`
                SELECT
                    COUNT(*) as total_mesas,
                    SUM(CASE WHEN estado_visual = 'libre' THEN 1 ELSE 0 END) as mesas_libres,
                    SUM(CASE WHEN estado_visual = 'ocupada' THEN 1 ELSE 0 END) as mesas_ocupadas,
                    SUM(CASE WHEN estado_visual = 'aparcada' THEN 1 ELSE 0 END) as mesas_aparcadas,
                    SUM(CASE WHEN estado_visual = 'reservada' THEN 1 ELSE 0 END) as mesas_reservadas,
                    AVG(CASE WHEN minutos_ocupada IS NOT NULL THEN minutos_ocupada ELSE 0 END) as promedio_tiempo_ocupacion
                FROM vista_mapa_completo
            `);

            // Estadísticas por zona
            const [estadisticasZonas] = await this.database.connection.execute(`
                SELECT
                    zs.nombre as zona_nombre,
                    zs.tipo_zona,
                    COUNT(vmc.Num_Mesa) as total_mesas_zona,
                    SUM(CASE WHEN vmc.estado_visual = 'ocupada' THEN 1 ELSE 0 END) as ocupadas_zona,
                    AVG(vmc.capacidad) as capacidad_promedio_zona
                FROM zonas_salon zs
                LEFT JOIN vista_mapa_completo vmc ON zs.id = vmc.zona_id
                WHERE zs.activa = TRUE
                GROUP BY zs.id, zs.nombre, zs.tipo_zona
            `);

            // Ingresos por zona (si disponible)
            const [ingresosZonas] = await this.database.connection.execute(`
                SELECT
                    zs.nombre as zona_nombre,
                    COUNT(vd.id_venta) as ventas_hoy,
                    SUM(vd.total) as ingresos_hoy
                FROM zonas_salon zs
                LEFT JOIN vista_mapa_completo vmc ON zs.id = vmc.zona_id
                LEFT JOIN ventadirecta vd ON vmc.Num_Mesa = vd.Num_Mesa
                    AND DATE(vd.created_at) = CURDATE()
                    AND vd.cerrada = 'Y'
                WHERE zs.activa = TRUE
                GROUP BY zs.id, zs.nombre
            `);

            return {
                ocupacion: estadisticasOcupacion[0],
                por_zonas: estadisticasZonas,
                ingresos_zonas: ingresosZonas,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error obteniendo estadísticas del mapa:', error);
            throw error;
        }
    }

    /**
     * Métodos auxiliares
     */
    calcularColorMesa(estadoVisual, configuracion) {
        if (!configuracion) return '#f8f9fa';

        switch (estadoVisual) {
            case 'libre': return configuracion.color_mesa_libre;
            case 'ocupada': return configuracion.color_mesa_ocupada;
            case 'aparcada': return configuracion.color_mesa_aparcada;
            case 'reservada': return configuracion.color_mesa_reservada;
            case 'limpieza': return configuracion.color_mesa_limpieza;
            case 'mantenimiento': return configuracion.color_mesa_mantenimiento;
            default: return configuracion.color_mesa_libre;
        }
    }

    calcularEstadoDetallado(mesa) {
        return {
            tiene_venta_activa: mesa.id_venta ? true : false,
            tiempo_ocupacion: mesa.minutos_ocupada,
            camarero_asignado: mesa.camarero_nombre,
            total_cuenta: mesa.venta_total,
            zona_asignada: mesa.zona_nombre,
            estado_base: mesa.estado_visual
        };
    }

    formatearTiempoOcupacion(minutos) {
        if (!minutos) return null;

        const horas = Math.floor(minutos / 60);
        const mins = minutos % 60;

        if (horas > 0) {
            return `${horas}h ${mins}m`;
        } else {
            return `${mins}m`;
        }
    }

    calcularResumenEstados(mesas) {
        const resumen = {
            libre: 0,
            ocupada: 0,
            aparcada: 0,
            reservada: 0,
            limpieza: 0,
            mantenimiento: 0
        };

        mesas.forEach(mesa => {
            if (resumen[mesa.estado_visual] !== undefined) {
                resumen[mesa.estado_visual]++;
            }
        });

        return resumen;
    }

    async verificarPermisosEdicion(usuarioId) {
        const configuracion = await this.obtenerConfiguracionMapa();
        if (configuracion.solo_lectura) {
            throw new Error('El mapa está en modo solo lectura');
        }
        // Aquí se podría agregar lógica adicional de permisos
    }

    async verificarPermisosAdministracion(usuarioId) {
        // Verificar permisos de administración
        // Por ahora permitimos todas las operaciones
        return true;
    }

    async registrarCambioEnHistorial(tipoCambio, elementoId, tablaElemento, cambiosAnteriores, cambiosNuevos, usuarioId) {
        try {
            await this.database.connection.execute(`
                INSERT INTO historial_cambios_mapa (
                    tipo_cambio, elemento_id, tabla_elemento,
                    cambios_anteriores, cambios_nuevos, usuario_cambio
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                tipoCambio, elementoId, tablaElemento,
                cambiosAnteriores ? JSON.stringify(cambiosAnteriores) : null,
                cambiosNuevos ? JSON.stringify(cambiosNuevos) : null,
                usuarioId
            ]);
        } catch (error) {
            console.error('Error registrando cambio en historial:', error);
        }
    }

    limpiarCache() {
        this.configuracionCache.clear();
        this.mesasEstadoCache.clear();
        this.zonasCache.clear();
        this.elementosDecorativosCache.clear();
        this.lastCacheUpdate = null;
    }

    iniciarActualizacionesTiempoReal() {
        this.actualizacionInterval = setInterval(async () => {
            try {
                const estadoActualizado = await this.obtenerEstadoCompletoMapa();
                this.emit('actualizacionTiempoReal', estadoActualizado);
            } catch (error) {
                console.error('Error en actualización tiempo real:', error);
            }
        }, 3000); // 3 segundos por defecto
    }

    reiniciarActualizacionesTiempoReal(nuevoIntervalo) {
        if (this.actualizacionInterval) {
            clearInterval(this.actualizacionInterval);
        }

        this.actualizacionInterval = setInterval(async () => {
            try {
                const estadoActualizado = await this.obtenerEstadoCompletoMapa();
                this.emit('actualizacionTiempoReal', estadoActualizado);
            } catch (error) {
                console.error('Error en actualización tiempo real:', error);
            }
        }, nuevoIntervalo * 1000);
    }

    /**
     * Limpieza de recursos
     */
    cleanup() {
        console.log('🧹 MapaVisualManager: Limpiando recursos...');

        if (this.actualizacionInterval) {
            clearInterval(this.actualizacionInterval);
        }

        this.limpiarCache();
        this.socketConnections.clear();
        this.removeAllListeners();
    }
}

module.exports = MapaVisualManager;