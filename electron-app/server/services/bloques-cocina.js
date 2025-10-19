/**
 * DYSA Point - Sistema de Bloques de Cocina
 * Funcionalidad crítica #1 - Envío escalonado de productos a cocina
 *
 * Características del sistema antiguo implementadas:
 * - Bloques de cocina numerados (1, 2, 3, 4)
 * - Envío por separado de cada bloque
 * - Control de productos enviados/pendientes
 * - Configuración personalizada por mesa/usuario
 * - Historial completo de envíos
 */

const { EventEmitter } = require('events');

class BloquesCocinaManager extends EventEmitter {
    constructor(database) {
        super();
        this.db = database;
        this.connection = database.connection;

        // Estados de bloques
        this.ESTADOS_BLOQUE = {
            ENVIADO: 'enviado',
            EN_PREPARACION: 'en_preparacion',
            LISTO: 'listo',
            SERVIDO: 'servido'
        };

        // Configuraciones por defecto
        this.BLOQUES_MAX = 4;
        this.TIEMPO_ENTRE_BLOQUES = 5; // minutos

        console.log('🍳 BloquesCocinaManager inicializado correctamente');
    }

    /**
     * Asignar productos de una venta a bloques específicos
     */
    async asignarProductosABloques(ventaId, configuracionBloques) {
        try {
            console.log(`🔢 Asignando productos a bloques - Venta: ${ventaId}`);

            const {
                distribucionBloques, // { 1: [id_linea1, id_linea2], 2: [id_linea3], ... }
                autoEnviarPrimero = true
            } = configuracionBloques;

            // Obtener productos de la venta
            const [productos] = await this.connection.execute(`
                SELECT id_linea, id_complementog, complementog, cantidad, bloque_cocina
                FROM ventadir_comg
                WHERE id_venta = ?
                ORDER BY id_linea ASC
            `, [ventaId]);

            if (productos.length === 0) {
                throw new Error(`No hay productos en la venta ${ventaId}`);
            }

            let totalBloques = 0;

            // Asignar productos a bloques
            for (const [numeroBloque, lineasIds] of Object.entries(distribucionBloques)) {
                const bloque = parseInt(numeroBloque);

                if (bloque < 1 || bloque > this.BLOQUES_MAX) {
                    throw new Error(`Número de bloque inválido: ${bloque}. Debe ser entre 1 y ${this.BLOQUES_MAX}`);
                }

                totalBloques = Math.max(totalBloques, bloque);

                // Actualizar líneas con el bloque asignado
                if (lineasIds.length > 0) {
                    const placeholders = lineasIds.map(() => '?').join(',');
                    await this.connection.execute(`
                        UPDATE ventadir_comg
                        SET bloque_cocina = ?, enviado_cocina = FALSE
                        WHERE id_venta = ? AND id_linea IN (${placeholders})
                    `, [bloque, ventaId, ...lineasIds]);
                }
            }

            // Actualizar total de bloques en la venta
            await this.connection.execute(`
                UPDATE ventadirecta
                SET bloques_total = ?, bloques_enviados = 0, ultimo_bloque_enviado = 0
                WHERE id_venta = ?
            `, [totalBloques, ventaId]);

            // Auto-enviar primer bloque si está configurado
            if (autoEnviarPrimero && totalBloques > 0) {
                await this.enviarBloqueACocina(ventaId, 1);
            }

            console.log(`✅ Productos asignados a ${totalBloques} bloques - Venta: ${ventaId}`);

            return {
                success: true,
                total_bloques: totalBloques,
                productos_asignados: productos.length,
                primer_bloque_enviado: autoEnviarPrimero
            };

        } catch (error) {
            console.error('❌ Error asignando productos a bloques:', error);
            throw error;
        }
    }

    /**
     * Enviar bloque específico a cocina
     */
    async enviarBloqueACocina(ventaId, numeroBloque, usuarioId = null) {
        try {
            console.log(`🚀 Enviando bloque ${numeroBloque} a cocina - Venta: ${ventaId}`);

            // Validar número de bloque
            if (numeroBloque < 1 || numeroBloque > this.BLOQUES_MAX) {
                throw new Error(`Número de bloque inválido: ${numeroBloque}`);
            }

            // Obtener información de la venta
            const [ventas] = await this.connection.execute(`
                SELECT id_venta, bloques_total, bloques_enviados, ultimo_bloque_enviado
                FROM ventadirecta
                WHERE id_venta = ?
            `, [ventaId]);

            if (ventas.length === 0) {
                throw new Error(`Venta ${ventaId} no encontrada`);
            }

            const venta = ventas[0];

            // Verificar que el bloque no haya sido enviado ya
            const [bloquesEnviados] = await this.connection.execute(`
                SELECT id FROM envios_bloques_cocina
                WHERE id_venta = ? AND bloque_numero = ?
            `, [ventaId, numeroBloque]);

            if (bloquesEnviados.length > 0) {
                console.warn(`⚠️ Bloque ${numeroBloque} ya fue enviado - Venta: ${ventaId}`);
                return { success: false, error: 'Bloque ya enviado' };
            }

            // Obtener productos del bloque
            const [productos] = await this.connection.execute(`
                SELECT id_linea, id_complementog, complementog, cantidad, nota
                FROM ventadir_comg
                WHERE id_venta = ? AND bloque_cocina = ?
                ORDER BY id_linea ASC
            `, [ventaId, numeroBloque]);

            if (productos.length === 0) {
                throw new Error(`No hay productos en el bloque ${numeroBloque} de la venta ${ventaId}`);
            }

            // Marcar productos como enviados
            await this.connection.execute(`
                UPDATE ventadir_comg
                SET enviado_cocina = TRUE, fecha_envio_cocina = CURRENT_TIMESTAMP
                WHERE id_venta = ? AND bloque_cocina = ?
            `, [ventaId, numeroBloque]);

            // Registrar envío del bloque
            const [resultadoEnvio] = await this.connection.execute(`
                INSERT INTO envios_bloques_cocina (
                    id_venta, bloque_numero, usuario_envio, total_productos, productos_pendientes, estado
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [
                ventaId,
                numeroBloque,
                usuarioId || 1, // Usuario por defecto si no se proporciona
                productos.length,
                productos.length,
                this.ESTADOS_BLOQUE.ENVIADO
            ]);

            // Actualizar contador de bloques enviados en la venta
            const nuevosBloqesEnviados = venta.bloques_enviados + 1;
            await this.connection.execute(`
                UPDATE ventadirecta
                SET bloques_enviados = ?, ultimo_bloque_enviado = ?
                WHERE id_venta = ?
            `, [nuevosBloqesEnviados, numeroBloque, ventaId]);

            // Crear comandas de cocina para cada producto
            for (const producto of productos) {
                await this.crearComandaCocina(ventaId, producto);
            }

            // Emitir evento de bloque enviado
            this.emit('bloque_enviado', {
                venta_id: ventaId,
                bloque_numero: numeroBloque,
                productos: productos.length,
                total_bloques: venta.bloques_total,
                bloques_enviados: nuevosBloqesEnviados
            });

            console.log(`✅ Bloque ${numeroBloque} enviado exitosamente - ${productos.length} productos`);

            return {
                success: true,
                bloque_numero: numeroBloque,
                productos_enviados: productos.length,
                bloques_restantes: venta.bloques_total - nuevosBloqesEnviados,
                envio_id: resultadoEnvio.insertId
            };

        } catch (error) {
            console.error(`❌ Error enviando bloque ${numeroBloque}:`, error);
            throw error;
        }
    }

    /**
     * Enviar siguiente bloque automáticamente
     */
    async enviarSiguienteBloque(ventaId, usuarioId = null) {
        try {
            // Obtener información de la venta
            const [ventas] = await this.connection.execute(`
                SELECT bloques_total, bloques_enviados, ultimo_bloque_enviado
                FROM ventadirecta
                WHERE id_venta = ?
            `, [ventaId]);

            if (ventas.length === 0) {
                throw new Error(`Venta ${ventaId} no encontrada`);
            }

            const venta = ventas[0];
            const siguienteBloque = venta.ultimo_bloque_enviado + 1;

            if (siguienteBloque > venta.bloques_total) {
                return {
                    success: false,
                    error: 'No hay más bloques para enviar',
                    bloques_completados: true
                };
            }

            return await this.enviarBloqueACocina(ventaId, siguienteBloque, usuarioId);

        } catch (error) {
            console.error('❌ Error enviando siguiente bloque:', error);
            throw error;
        }
    }

    /**
     * Obtener estado de bloques de una venta
     */
    async obtenerEstadoBloques(ventaId) {
        try {
            // Información general de la venta
            const [ventaInfo] = await this.connection.execute(`
                SELECT id_venta, bloques_total, bloques_enviados, ultimo_bloque_enviado
                FROM ventadirecta
                WHERE id_venta = ?
            `, [ventaId]);

            if (ventaInfo.length === 0) {
                throw new Error(`Venta ${ventaId} no encontrada`);
            }

            const venta = ventaInfo[0];

            // Información detallada de cada bloque
            const [bloques] = await this.connection.execute(`
                SELECT
                    bloque_numero,
                    estado,
                    fecha_envio,
                    total_productos,
                    productos_pendientes,
                    productos_listos,
                    observaciones
                FROM envios_bloques_cocina
                WHERE id_venta = ?
                ORDER BY bloque_numero ASC
            `, [ventaId]);

            // Productos por bloque
            const [productos] = await this.connection.execute(`
                SELECT
                    bloque_cocina,
                    id_linea,
                    complementog as producto_nombre,
                    cantidad,
                    enviado_cocina,
                    fecha_envio_cocina,
                    nota
                FROM ventadir_comg
                WHERE id_venta = ?
                ORDER BY bloque_cocina ASC, id_linea ASC
            `, [ventaId]);

            // Agrupar productos por bloque
            const productosPorBloque = productos.reduce((acc, producto) => {
                const bloque = producto.bloque_cocina;
                if (!acc[bloque]) acc[bloque] = [];
                acc[bloque].push(producto);
                return acc;
            }, {});

            return {
                success: true,
                venta_id: ventaId,
                resumen: {
                    bloques_total: venta.bloques_total,
                    bloques_enviados: venta.bloques_enviados,
                    ultimo_bloque_enviado: venta.ultimo_bloque_enviado,
                    bloques_pendientes: venta.bloques_total - venta.bloques_enviados
                },
                bloques_detalle: bloques,
                productos_por_bloque: productosPorBloque
            };

        } catch (error) {
            console.error('❌ Error obteniendo estado de bloques:', error);
            throw error;
        }
    }

    /**
     * Marcar bloque como listo
     */
    async marcarBloqueComoListo(ventaId, numeroBloque) {
        try {
            const resultado = await this.connection.execute(`
                UPDATE envios_bloques_cocina
                SET estado = ?, productos_listos = total_productos, updated_at = CURRENT_TIMESTAMP
                WHERE id_venta = ? AND bloque_numero = ?
            `, [this.ESTADOS_BLOQUE.LISTO, ventaId, numeroBloque]);

            if (resultado[0].affectedRows === 0) {
                throw new Error(`Bloque ${numeroBloque} no encontrado para venta ${ventaId}`);
            }

            // Emitir evento
            this.emit('bloque_listo', {
                venta_id: ventaId,
                bloque_numero: numeroBloque
            });

            console.log(`✅ Bloque ${numeroBloque} marcado como listo - Venta: ${ventaId}`);

            return { success: true, bloque_numero: numeroBloque, estado: this.ESTADOS_BLOQUE.LISTO };

        } catch (error) {
            console.error('❌ Error marcando bloque como listo:', error);
            throw error;
        }
    }

    /**
     * Obtener configuración de bloques
     */
    async obtenerConfiguracion(tipo = 'global', idReferencia = null) {
        try {
            const [configs] = await this.connection.execute(`
                SELECT * FROM configuracion_bloques
                WHERE tipo_config = ? AND (id_referencia = ? OR id_referencia IS NULL)
                AND activo = TRUE
                ORDER BY id_referencia IS NULL ASC
                LIMIT 1
            `, [tipo, idReferencia]);

            if (configs.length === 0) {
                // Devolver configuración por defecto
                return {
                    bloques_por_defecto: 1,
                    auto_envio_primer_bloque: true,
                    tiempo_entre_bloques: this.TIEMPO_ENTRE_BLOQUES,
                    productos_por_bloque: null
                };
            }

            const config = configs[0];

            return {
                id: config.id,
                bloques_por_defecto: config.bloques_por_defecto,
                auto_envio_primer_bloque: config.auto_envio_primer_bloque,
                tiempo_entre_bloques: config.tiempo_entre_bloques,
                productos_por_bloque: config.productos_por_bloque ? JSON.parse(config.productos_por_bloque) : null
            };

        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error);
            throw error;
        }
    }

    /**
     * Distribución automática de productos en bloques
     */
    async distribucionAutomatica(ventaId, numeroBloques = 2) {
        try {
            // Obtener productos de la venta
            const [productos] = await this.connection.execute(`
                SELECT id_linea, id_complementog, complementog, cantidad
                FROM ventadir_comg
                WHERE id_venta = ?
                ORDER BY id_linea ASC
            `, [ventaId]);

            if (productos.length === 0) {
                throw new Error(`No hay productos en la venta ${ventaId}`);
            }

            // Distribuir productos equitativamente
            const distribucion = {};
            for (let i = 1; i <= numeroBloques; i++) {
                distribucion[i] = [];
            }

            productos.forEach((producto, index) => {
                const bloque = (index % numeroBloques) + 1;
                distribucion[bloque].push(producto.id_linea);
            });

            return {
                success: true,
                distribucion: distribucion,
                total_productos: productos.length,
                bloques_creados: numeroBloques
            };

        } catch (error) {
            console.error('❌ Error en distribución automática:', error);
            throw error;
        }
    }

    // Métodos auxiliares

    /**
     * Crear comanda de cocina para producto
     */
    async crearComandaCocina(ventaId, producto) {
        try {
            // Obtener estación del producto
            const [estaciones] = await this.connection.execute(`
                SELECT estacion_cocina FROM complementog
                WHERE id_complementog = ?
            `, [producto.id_complementog]);

            const estacionId = estaciones.length > 0 ? estaciones[0].estacion_cocina : 1;

            // Crear registro en venta_cocina
            await this.connection.execute(`
                INSERT INTO venta_cocina (
                    id_venta, id_linea, id_complementog, cantidad,
                    bloque_cocina, orden_en_bloque, estacion_id, estado
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendiente')
            `, [
                ventaId,
                producto.id_linea,
                producto.id_complementog,
                producto.cantidad,
                producto.bloque_cocina || 1,
                producto.id_linea,
                estacionId
            ]);

            console.log(`🍳 Comanda creada para producto: ${producto.complementog}`);

        } catch (error) {
            console.error('❌ Error creando comanda de cocina:', error);
            // No lanzar error para no interrumpir el proceso principal
        }
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 BloquesCocinaManager: Limpiando recursos...');
        this.removeAllListeners();
    }
}

module.exports = BloquesCocinaManager;