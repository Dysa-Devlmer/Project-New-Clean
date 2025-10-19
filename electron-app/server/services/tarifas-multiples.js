/**
 * TarifasManager - Sistema de Tarifas Múltiples Empresarial
 * Gestión avanzada de precios diferenciados para restaurantes profesionales
 *
 * Funcionalidad Crítica #4 del Sistema Anterior
 * DYSA Point POS v2.0.14 - Nivel Empresarial
 * Autor: Claude Code
 * Fecha: 2025-10-13
 */

const EventEmitter = require('events');

class TarifasManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.configuracionCache = new Map();
        this.tarifasActivasCache = new Map();
        this.eventosActivosCache = new Map();
        this.lastCacheUpdate = null;
        this.cacheExpireTime = 5 * 60 * 1000; // 5 minutos

        console.log('💰 TarifasManager inicializado correctamente');
    }

    /**
     * Aplicar tarifas automáticamente a una venta
     */
    async aplicarTarifasAutomaticas(ventaId, mesa, usuarioId, productos) {
        try {
            console.log(`💰 Aplicando tarifas automáticas a venta ${ventaId}`);

            // Verificar configuración
            const config = await this.obtenerConfiguracion('global');
            if (!config || !config.aplicacion_automatica) {
                return { aplicadas: [], mensaje: 'Aplicación automática deshabilitada' };
            }

            // Obtener tarifas aplicables
            const tarifasAplicables = await this.obtenerTarifasAplicables(mesa, productos);

            if (!tarifasAplicables || tarifasAplicables.length === 0) {
                return { aplicadas: [], mensaje: 'No hay tarifas aplicables' };
            }

            // Ordenar por prioridad
            tarifasAplicables.sort((a, b) => b.prioridad - a.prioridad);

            const tarifasAplicadas = [];
            const productosConTarifa = new Map();

            for (const tarifa of tarifasAplicables) {
                try {
                    // Verificar si se puede aplicar la tarifa
                    const puedeAplicar = await this.verificarCondicionesTarifa(tarifa, mesa, productos, usuarioId);

                    if (!puedeAplicar.valido) {
                        continue;
                    }

                    // Aplicar tarifa según su tipo
                    const resultadoAplicacion = await this.aplicarTarifaEspecifica(
                        ventaId, tarifa, productos, usuarioId, productosConTarifa
                    );

                    if (resultadoAplicacion.exito) {
                        tarifasAplicadas.push(resultadoAplicacion);

                        // Emitir evento
                        this.emit('tarifaAplicada', {
                            ventaId,
                            tarifaId: tarifa.id,
                            usuarioId,
                            metodo: 'automatico',
                            resultado: resultadoAplicacion
                        });
                    }

                } catch (error) {
                    console.error(`Error aplicando tarifa ${tarifa.id}:`, error);
                }
            }

            return {
                aplicadas: tarifasAplicadas,
                total_descuentos: tarifasAplicadas.reduce((sum, t) => sum + t.descuento_aplicado, 0),
                mensaje: `${tarifasAplicadas.length} tarifas aplicadas automáticamente`
            };

        } catch (error) {
            console.error('Error en aplicarTarifasAutomaticas:', error);
            throw error;
        }
    }

    /**
     * Aplicar tarifa manualmente
     */
    async aplicarTarifaManual(ventaId, tarifaId, usuarioId, productos, codigoCliente = null) {
        try {
            console.log(`💰 Aplicando tarifa manual ${tarifaId} a venta ${ventaId}`);

            // Verificar permisos
            const config = await this.obtenerConfiguracion('usuario', usuarioId);
            if (!config.permitir_aplicacion_manual) {
                throw new Error('Usuario no tiene permisos para aplicar tarifas manualmente');
            }

            // Obtener tarifa
            const [tarifaResult] = await this.database.connection.execute(
                'SELECT * FROM tarifas_multiples WHERE id = ? AND activa = TRUE',
                [tarifaId]
            );

            if (!tarifaResult || tarifaResult.length === 0) {
                throw new Error('Tarifa no encontrada o inactiva');
            }

            const tarifa = tarifaResult[0];

            // Verificar autorización si es necesaria
            if (tarifa.requiere_autorizacion) {
                const autorizacion = await this.verificarAutorizacion(usuarioId, tarifa.nivel_autorizacion);
                if (!autorizacion.autorizado) {
                    throw new Error(`Requiere autorización de ${tarifa.nivel_autorizacion}`);
                }
            }

            // Aplicar tarifa
            const resultado = await this.aplicarTarifaEspecifica(
                ventaId, tarifa, productos, usuarioId, new Map(), 'manual', codigoCliente
            );

            if (resultado.exito) {
                // Emitir evento
                this.emit('tarifaAplicadaManual', {
                    ventaId,
                    tarifaId,
                    usuarioId,
                    codigoCliente,
                    resultado
                });
            }

            return resultado;

        } catch (error) {
            console.error('Error en aplicarTarifaManual:', error);
            throw error;
        }
    }

    /**
     * Aplicar código de promoción
     */
    async aplicarCodigoPromocion(ventaId, codigo, usuarioId, productos) {
        try {
            console.log(`🎫 Aplicando código promoción: ${codigo}`);

            // Verificar código
            const [codigoResult] = await this.database.connection.execute(`
                SELECT cp.*, tm.*
                FROM codigos_promocion cp
                INNER JOIN tarifas_multiples tm ON cp.tarifa_id = tm.id
                WHERE cp.codigo = ? AND cp.activo = TRUE AND tm.activa = TRUE
                AND (cp.fecha_inicio IS NULL OR cp.fecha_inicio <= CURDATE())
                AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURDATE())
                AND (cp.usos_maximos IS NULL OR cp.usos_actuales < cp.usos_maximos)
            `, [codigo]);

            if (!codigoResult || codigoResult.length === 0) {
                throw new Error('Código de promoción inválido o expirado');
            }

            const promocion = codigoResult[0];

            // Verificar usos por cliente (si aplica)
            if (promocion.usos_por_cliente > 0) {
                const [usosCliente] = await this.database.connection.execute(`
                    SELECT COUNT(*) as usos
                    FROM historial_tarifas_aplicadas
                    WHERE codigo_cliente = ? AND usuario_aplicacion = ? AND estado = 'aplicada'
                `, [codigo, usuarioId]);

                if (usosCliente[0].usos >= promocion.usos_por_cliente) {
                    throw new Error('Ha excedido el límite de usos para este código');
                }
            }

            // Aplicar la tarifa asociada
            const resultado = await this.aplicarTarifaEspecifica(
                ventaId, promocion, productos, usuarioId, new Map(), 'codigo_cliente', codigo
            );

            if (resultado.exito) {
                // Actualizar contador de usos
                await this.database.connection.execute(
                    'UPDATE codigos_promocion SET usos_actuales = usos_actuales + 1 WHERE id = ?',
                    [promocion.id]
                );

                // Emitir evento
                this.emit('codigoPromocionAplicado', {
                    ventaId,
                    codigo,
                    tarifaId: promocion.tarifa_id,
                    usuarioId,
                    resultado
                });
            }

            return resultado;

        } catch (error) {
            console.error('Error en aplicarCodigoPromocion:', error);
            throw error;
        }
    }

    /**
     * Obtener tarifas aplicables según condiciones actuales
     */
    async obtenerTarifasAplicables(mesa, productos = []) {
        try {
            const ahora = new Date();
            const horaActual = ahora.toTimeString().split(' ')[0];
            const diaActual = this.obtenerDiaSemana(ahora.getDay());
            const fechaActual = ahora.toISOString().split('T')[0];

            let query = `
                SELECT tm.*,
                       CASE WHEN tm.aplica_por_horario = TRUE THEN
                           CASE WHEN ? BETWEEN tm.horario_inicio AND tm.horario_fin THEN 1 ELSE 0 END
                       ELSE 1 END as horario_valido,
                       CASE WHEN tm.aplica_por_dia_semana = TRUE THEN
                           CASE WHEN FIND_IN_SET(?, tm.dias_semana) > 0 THEN 1 ELSE 0 END
                       ELSE 1 END as dia_valido,
                       CASE WHEN tm.fecha_inicio IS NOT NULL AND tm.fecha_fin IS NOT NULL THEN
                           CASE WHEN ? BETWEEN tm.fecha_inicio AND tm.fecha_fin THEN 1 ELSE 0 END
                       ELSE 1 END as fecha_valida
                FROM tarifas_multiples tm
                WHERE tm.activa = TRUE
                HAVING horario_valido = 1 AND dia_valido = 1 AND fecha_valida = 1
                ORDER BY tm.prioridad DESC
            `;

            const [result] = await this.database.connection.execute(query, [
                horaActual, diaActual, fechaActual
            ]);

            // Filtrar tarifas según otros criterios (mesa, productos, etc.)
            const tarifasFiltradas = [];

            for (const tarifa of result) {
                let aplicable = true;

                // Verificar mesa
                if (tarifa.aplica_por_mesa && tarifa.mesas_incluidas) {
                    const mesasIncluidas = JSON.parse(tarifa.mesas_incluidas);
                    if (!mesasIncluidas.includes(mesa)) {
                        aplicable = false;
                    }
                }

                if (tarifa.mesas_excluidas) {
                    const mesasExcluidas = JSON.parse(tarifa.mesas_excluidas);
                    if (mesasExcluidas.includes(mesa)) {
                        aplicable = false;
                    }
                }

                // Verificar productos
                if (productos.length > 0 && tarifa.aplica_por_producto) {
                    const productosIds = productos.map(p => p.id);

                    if (tarifa.productos_incluidos) {
                        const productosIncluidos = JSON.parse(tarifa.productos_incluidos);
                        const tieneProductoIncluido = productosIds.some(id => productosIncluidos.includes(id));
                        if (!tieneProductoIncluido) {
                            aplicable = false;
                        }
                    }

                    if (tarifa.productos_excluidos) {
                        const productosExcluidos = JSON.parse(tarifa.productos_excluidos);
                        const tieneProductoExcluido = productosIds.some(id => productosExcluidos.includes(id));
                        if (tieneProductoExcluido) {
                            aplicable = false;
                        }
                    }
                }

                if (aplicable) {
                    tarifasFiltradas.push(tarifa);
                }
            }

            return tarifasFiltradas;

        } catch (error) {
            console.error('Error en obtenerTarifasAplicables:', error);
            throw error;
        }
    }

    /**
     * Aplicar tarifa específica
     */
    async aplicarTarifaEspecifica(ventaId, tarifa, productos, usuarioId, productosConTarifa, metodo = 'automatico', codigoCliente = null) {
        try {
            let totalDescuento = 0;
            const lineasAfectadas = [];

            for (const producto of productos) {
                // Verificar si el producto ya tiene tarifa (si no es combinable)
                if (!tarifa.es_combinable && productosConTarifa.has(producto.id)) {
                    continue;
                }

                // Calcular descuento/recargo
                let valorAplicado = 0;
                let precioFinal = producto.precio_unitario;

                switch (tarifa.tipo_tarifa) {
                    case 'descuento':
                        if (tarifa.es_porcentaje) {
                            valorAplicado = (producto.precio_unitario * tarifa.valor_tarifa) / 100;
                        } else {
                            valorAplicado = tarifa.valor_tarifa;
                        }
                        precioFinal = Math.max(0, producto.precio_unitario - valorAplicado);
                        break;

                    case 'recargo':
                        if (tarifa.es_porcentaje) {
                            valorAplicado = (producto.precio_unitario * tarifa.valor_tarifa) / 100;
                        } else {
                            valorAplicado = tarifa.valor_tarifa;
                        }
                        precioFinal = producto.precio_unitario + valorAplicado;
                        break;

                    case 'precio_fijo':
                        valorAplicado = producto.precio_unitario - tarifa.valor_tarifa;
                        precioFinal = tarifa.valor_tarifa;
                        break;

                    case 'precio_especial':
                        valorAplicado = producto.precio_unitario - tarifa.valor_tarifa;
                        precioFinal = tarifa.valor_tarifa;
                        break;
                }

                // Verificar límites
                if (tarifa.monto_maximo_descuento && valorAplicado > tarifa.monto_maximo_descuento) {
                    valorAplicado = tarifa.monto_maximo_descuento;
                    precioFinal = producto.precio_unitario - valorAplicado;
                }

                // Registrar en historial
                const [historialResult] = await this.database.connection.execute(`
                    INSERT INTO historial_tarifas_aplicadas (
                        tarifa_id, id_venta, id_linea_venta, usuario_aplicacion, metodo_aplicacion,
                        valor_original, valor_tarifa_aplicada, valor_final, descuento_aplicado, codigo_cliente
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    tarifa.id, ventaId, producto.id_linea || null, usuarioId, metodo,
                    producto.precio_unitario, tarifa.valor_tarifa, precioFinal, valorAplicado, codigoCliente
                ]);

                totalDescuento += valorAplicado * (producto.cantidad || 1);
                lineasAfectadas.push({
                    producto_id: producto.id,
                    precio_original: producto.precio_unitario,
                    precio_final: precioFinal,
                    descuento: valorAplicado,
                    historial_id: historialResult.insertId
                });

                // Marcar producto como con tarifa aplicada
                productosConTarifa.set(producto.id, tarifa.id);
            }

            return {
                exito: true,
                tarifa_id: tarifa.id,
                tarifa_nombre: tarifa.nombre,
                metodo_aplicacion: metodo,
                descuento_aplicado: totalDescuento,
                lineas_afectadas: lineasAfectadas,
                codigo_utilizado: codigoCliente
            };

        } catch (error) {
            console.error('Error en aplicarTarifaEspecifica:', error);
            return {
                exito: false,
                error: error.message
            };
        }
    }

    /**
     * Anular tarifa aplicada
     */
    async anularTarifaAplicada(historialId, usuarioId, motivo) {
        try {
            console.log(`💰 Anulando tarifa aplicada ${historialId}`);

            // Verificar permisos
            const config = await this.obtenerConfiguracion('usuario', usuarioId);
            if (!config.permitir_anulacion) {
                throw new Error('Usuario no tiene permisos para anular tarifas');
            }

            // Obtener información de la tarifa aplicada
            const [tarifaResult] = await this.database.connection.execute(
                'SELECT * FROM historial_tarifas_aplicadas WHERE id = ? AND estado = "aplicada"',
                [historialId]
            );

            if (!tarifaResult || tarifaResult.length === 0) {
                throw new Error('Tarifa no encontrada o ya anulada');
            }

            const tarifa = tarifaResult[0];

            // Verificar tiempo límite
            const tiempoTranscurrido = Date.now() - new Date(tarifa.fecha_aplicacion).getTime();
            const tiempoLimite = config.tiempo_limite_anulacion * 60 * 1000; // minutos a ms

            if (tiempoTranscurrido > tiempoLimite) {
                throw new Error(`Tiempo límite excedido. Máximo ${config.tiempo_limite_anulacion} minutos`);
            }

            // Anular tarifa
            await this.database.connection.execute(`
                UPDATE historial_tarifas_aplicadas
                SET estado = 'anulada', fecha_anulacion = NOW(), usuario_anulacion = ?, motivo_anulacion = ?
                WHERE id = ?
            `, [usuarioId, motivo, historialId]);

            // Emitir evento
            this.emit('tarifaAnulada', {
                historialId,
                ventaId: tarifa.id_venta,
                tarifaId: tarifa.tarifa_id,
                usuarioId,
                motivo
            });

            return {
                exito: true,
                mensaje: 'Tarifa anulada exitosamente',
                monto_revertido: tarifa.descuento_aplicado
            };

        } catch (error) {
            console.error('Error en anularTarifaAplicada:', error);
            throw error;
        }
    }

    /**
     * Obtener configuración del sistema
     */
    async obtenerConfiguracion(tipoConfig = 'global', idReferencia = null) {
        try {
            const cacheKey = `${tipoConfig}_${idReferencia || 'null'}`;

            // Verificar cache
            if (this.configuracionCache.has(cacheKey) &&
                Date.now() - this.lastCacheUpdate < this.cacheExpireTime) {
                return this.configuracionCache.get(cacheKey);
            }

            const [result] = await this.database.connection.execute(`
                SELECT * FROM configuracion_tarifas
                WHERE tipo_config = ? AND (id_referencia = ? OR id_referencia IS NULL) AND activo = TRUE
                ORDER BY
                    CASE WHEN id_referencia = ? THEN 1 ELSE 2 END,
                    CASE WHEN tipo_config = 'usuario' THEN 1
                         WHEN tipo_config = 'rol' THEN 2
                         ELSE 3 END
                LIMIT 1
            `, [tipoConfig, idReferencia, idReferencia]);

            let config = result && result.length > 0 ? result[0] : null;

            // Si no hay configuración específica, usar global
            if (!config) {
                const [globalResult] = await this.database.connection.execute(
                    'SELECT * FROM configuracion_tarifas WHERE tipo_config = "global" AND activo = TRUE LIMIT 1'
                );
                config = globalResult && globalResult.length > 0 ? globalResult[0] : null;
            }

            // Cache resultado
            this.configuracionCache.set(cacheKey, config);
            this.lastCacheUpdate = Date.now();

            return config;

        } catch (error) {
            console.error('Error en obtenerConfiguracion:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas de tarifas
     */
    async obtenerEstadisticas(fechaDesde, fechaHasta, usuarioId = null) {
        try {
            let filtroUsuario = '';
            let params = [fechaDesde, fechaHasta];

            if (usuarioId) {
                filtroUsuario = 'AND hta.usuario_aplicacion = ?';
                params.push(usuarioId);
            }

            const [estadisticas] = await this.database.connection.execute(`
                SELECT
                    COUNT(*) as total_aplicaciones,
                    COUNT(DISTINCT hta.id_venta) as ventas_con_tarifas,
                    SUM(hta.descuento_aplicado) as total_descuentos,
                    AVG(hta.descuento_aplicado) as promedio_descuento,
                    COUNT(CASE WHEN hta.metodo_aplicacion = 'automatico' THEN 1 END) as aplicaciones_automaticas,
                    COUNT(CASE WHEN hta.metodo_aplicacion = 'manual' THEN 1 END) as aplicaciones_manuales,
                    COUNT(CASE WHEN hta.metodo_aplicacion = 'codigo_cliente' THEN 1 END) as aplicaciones_codigo,
                    COUNT(CASE WHEN hta.estado = 'anulada' THEN 1 END) as anulaciones
                FROM historial_tarifas_aplicadas hta
                WHERE DATE(hta.fecha_aplicacion) BETWEEN ? AND ?
                ${filtroUsuario}
            `, params);

            const [tarifasMasUsadas] = await this.database.connection.execute(`
                SELECT
                    tm.nombre,
                    tm.codigo,
                    COUNT(*) as usos,
                    SUM(hta.descuento_aplicado) as total_descuento
                FROM historial_tarifas_aplicadas hta
                INNER JOIN tarifas_multiples tm ON hta.tarifa_id = tm.id
                WHERE DATE(hta.fecha_aplicacion) BETWEEN ? AND ? ${filtroUsuario}
                AND hta.estado = 'aplicada'
                GROUP BY hta.tarifa_id
                ORDER BY usos DESC
                LIMIT 10
            `, params);

            return {
                resumen: estadisticas[0],
                tarifas_mas_usadas: tarifasMasUsadas,
                fecha_consulta: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error en obtenerEstadisticas:', error);
            throw error;
        }
    }

    /**
     * Obtener dashboard de tarifas
     */
    async obtenerDashboard() {
        try {
            const hoy = new Date().toISOString().split('T')[0];
            const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

            // Estadísticas del día
            const [estadisticasHoy] = await this.database.connection.execute(`
                SELECT
                    COUNT(*) as aplicaciones_hoy,
                    SUM(descuento_aplicado) as descuentos_hoy,
                    COUNT(DISTINCT id_venta) as ventas_con_tarifa_hoy
                FROM historial_tarifas_aplicadas
                WHERE DATE(fecha_aplicacion) = ? AND estado = 'aplicada'
            `, [hoy]);

            // Estadísticas del mes
            const [estadisticasMes] = await this.database.connection.execute(`
                SELECT
                    COUNT(*) as aplicaciones_mes,
                    SUM(descuento_aplicado) as descuentos_mes,
                    COUNT(DISTINCT id_venta) as ventas_con_tarifa_mes
                FROM historial_tarifas_aplicadas
                WHERE DATE(fecha_aplicacion) >= ? AND estado = 'aplicada'
            `, [inicioMes]);

            // Tarifas activas
            const [tarifasActivas] = await this.database.connection.execute(
                'SELECT COUNT(*) as total_activas FROM tarifas_multiples WHERE activa = TRUE'
            );

            // Eventos activos
            const [eventosActivos] = await this.database.connection.execute(`
                SELECT COUNT(*) as eventos_activos
                FROM eventos_tarifas_especiales
                WHERE activo = TRUE AND NOW() BETWEEN fecha_inicio AND fecha_fin
            `);

            return {
                estadisticas_hoy: estadisticasHoy[0],
                estadisticas_mes: estadisticasMes[0],
                tarifas_activas: tarifasActivas[0].total_activas,
                eventos_activos: eventosActivos[0].eventos_activos,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error en obtenerDashboard:', error);
            throw error;
        }
    }

    /**
     * Métodos auxiliares
     */
    obtenerDiaSemana(numeroDia) {
        const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        return dias[numeroDia];
    }

    async verificarCondicionesTarifa(tarifa, mesa, productos, usuarioId) {
        // Verificar monto mínimo
        if (tarifa.monto_minimo_compra) {
            const totalVenta = productos.reduce((sum, p) => sum + (p.precio_unitario * p.cantidad), 0);
            if (totalVenta < tarifa.monto_minimo_compra) {
                return { valido: false, razon: 'Monto mínimo no alcanzado' };
            }
        }

        // Verificar límite de aplicaciones
        if (tarifa.cantidad_maxima_aplicaciones) {
            const [aplicaciones] = await this.database.connection.execute(
                'SELECT COUNT(*) as total FROM historial_tarifas_aplicadas WHERE tarifa_id = ? AND estado = "aplicada"',
                [tarifa.id]
            );

            if (aplicaciones[0].total >= tarifa.cantidad_maxima_aplicaciones) {
                return { valido: false, razon: 'Límite de aplicaciones excedido' };
            }
        }

        return { valido: true };
    }

    async verificarAutorizacion(usuarioId, nivelRequerido) {
        // Implementar lógica de autorización según el nivel
        // Por ahora retornamos autorizado para simplificar
        return { autorizado: true };
    }

    /**
     * Limpieza de recursos
     */
    cleanup() {
        console.log('🧹 TarifasManager: Limpiando recursos...');
        this.configuracionCache.clear();
        this.tarifasActivasCache.clear();
        this.eventosActivosCache.clear();
        this.removeAllListeners();
    }
}

module.exports = TarifasManager;