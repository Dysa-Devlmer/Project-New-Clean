/**
 * DYSA Point - Sistema de Pre-tickets
 * Funcionalidad crítica #3 - Generar tickets preliminares antes del pago final
 *
 * Características del sistema antiguo implementadas:
 * - Generar pre-tickets de ventas activas
 * - Múltiples pre-tickets por venta
 * - Control de impresión automática
 * - Plantillas personalizables
 * - Historial completo de pre-tickets
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

class PreticketManager extends EventEmitter {
    constructor(database) {
        super();
        this.db = database;
        this.connection = database.connection;

        // Estados de pre-tickets
        this.ESTADOS_PRETICKET = {
            GENERADO: 'generado',
            IMPRESO: 'impreso',
            ANULADO: 'anulado'
        };

        // Tipos de pre-tickets
        this.TIPOS_PRETICKET = {
            PARCIAL: 'parcial',
            TOTAL: 'total',
            RESUMEN: 'resumen'
        };

        // Formatos de impresión
        this.FORMATOS_IMPRESION = {
            TICKET: 'ticket',
            CUENTA: 'cuenta',
            RESUMEN: 'resumen'
        };

        console.log('🎫 PreticketManager inicializado correctamente');
    }

    /**
     * Generar pre-ticket para una venta
     */
    async generarPreticket(ventaId, usuarioId, opciones = {}) {
        try {
            console.log(`🎫 Generando pre-ticket - Venta: ${ventaId} - Usuario: ${usuarioId}`);

            const {
                tipo = this.TIPOS_PRETICKET.TOTAL,
                formato = this.FORMATOS_IMPRESION.TICKET,
                imprimirAutomatico = true,
                lineasEspecificas = null, // Array de IDs de líneas específicas para pre-ticket parcial
                observaciones = null
            } = opciones;

            // Verificar que la venta existe y está activa
            const [ventas] = await this.connection.execute(`
                SELECT id_venta, Num_Mesa, total, comensales, cerrada
                FROM ventadirecta
                WHERE id_venta = ? AND cerrada = 'N'
            `, [ventaId]);

            if (ventas.length === 0) {
                throw new Error(`Venta ${ventaId} no encontrada o no está activa`);
            }

            const venta = ventas[0];

            // Verificar permisos del usuario
            const puedeGenerar = await this.verificarPermisos(usuarioId, 'generar');
            if (!puedeGenerar) {
                throw new Error('Usuario no tiene permisos para generar pre-tickets');
            }

            // Obtener configuración
            const config = await this.obtenerConfiguracion('usuario', usuarioId);

            // Verificar límite de pre-tickets por venta
            const [preticketsExistentes] = await this.connection.execute(`
                SELECT COUNT(*) as total FROM pretickets
                WHERE id_venta = ? AND estado != 'anulado'
            `, [ventaId]);

            if (preticketsExistentes[0].total >= config.maximo_pretickets_venta) {
                throw new Error(`Se ha alcanzado el límite máximo de ${config.maximo_pretickets_venta} pre-tickets para esta venta`);
            }

            // Generar número de pre-ticket
            const numeroPreticket = await this.generarNumeroPreticket(venta);

            // Obtener productos de la venta
            let consultaProductos = `
                SELECT vc.id_linea, vc.id_complementog, cg.alias as producto_nombre,
                       vc.cantidad, vc.precio_unitario, vc.observaciones,
                       (vc.cantidad * vc.precio_unitario) as subtotal_linea
                FROM ventadir_comg vc
                JOIN complementog cg ON vc.id_complementog = cg.id_complementog
                WHERE vc.id_venta = ?
            `;

            const params = [ventaId];

            // Si es parcial y se especificaron líneas específicas
            if (tipo === this.TIPOS_PRETICKET.PARCIAL && lineasEspecificas && lineasEspecificas.length > 0) {
                const placeholders = lineasEspecificas.map(() => '?').join(',');
                consultaProductos += ` AND vc.id_linea IN (${placeholders})`;
                params.push(...lineasEspecificas);
            }

            consultaProductos += ` ORDER BY vc.id_linea ASC`;

            const [productos] = await this.connection.execute(consultaProductos, params);

            if (productos.length === 0) {
                throw new Error('No hay productos en la venta para generar pre-ticket');
            }

            // Calcular totales
            const subtotal = productos.reduce((sum, p) => sum + parseFloat(p.subtotal_linea), 0);
            const impuestos = subtotal * 0.19; // IVA 19%
            const total = subtotal + impuestos;

            // Generar hash del contenido para detectar cambios
            const contenidoHash = this.generarHashContenido(productos, total);

            // Crear el pre-ticket
            const [resultadoPreticket] = await this.connection.execute(`
                INSERT INTO pretickets (
                    id_venta, numero_preticket, usuario_generacion, tipo_preticket,
                    subtotal, impuestos, total, comensales, formato_impresion,
                    observaciones, hash_contenido
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                ventaId, numeroPreticket, usuarioId, tipo,
                subtotal, impuestos, total, venta.comensales, formato,
                observaciones, contenidoHash
            ]);

            const preticketId = resultadoPreticket.insertId;

            // Insertar líneas del pre-ticket
            for (const producto of productos) {
                await this.connection.execute(`
                    INSERT INTO pretickets_lineas (
                        preticket_id, id_linea_venta, id_complementog,
                        producto_nombre, cantidad, precio_unitario, subtotal_linea,
                        observaciones_linea
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    preticketId, producto.id_linea, producto.id_complementog,
                    producto.producto_nombre, producto.cantidad, producto.precio_unitario,
                    producto.subtotal_linea, producto.observaciones
                ]);
            }

            // Imprimir automáticamente si está configurado
            if (imprimirAutomatico && config.impresion_automatica) {
                await this.imprimirPreticket(preticketId, usuarioId);
            }

            // Emitir evento
            this.emit('preticket_generado', {
                preticket_id: preticketId,
                venta_id: ventaId,
                numero_preticket: numeroPreticket,
                usuario: usuarioId,
                tipo: tipo,
                total: total,
                productos: productos.length
            });

            console.log(`✅ Pre-ticket ${numeroPreticket} generado exitosamente`);

            return {
                success: true,
                preticket_id: preticketId,
                numero_preticket: numeroPreticket,
                tipo: tipo,
                total: total,
                productos: productos.length,
                hash_contenido: contenidoHash,
                impreso_automatico: imprimirAutomatico && config.impresion_automatica
            };

        } catch (error) {
            console.error(`❌ Error generando pre-ticket para venta ${ventaId}:`, error);
            throw error;
        }
    }

    /**
     * Imprimir pre-ticket
     */
    async imprimirPreticket(preticketId, usuarioId, impresoraId = null) {
        try {
            console.log(`🖨️ Imprimiendo pre-ticket ${preticketId} - Usuario: ${usuarioId}`);

            // Obtener datos del pre-ticket
            const [pretickets] = await this.connection.execute(`
                SELECT p.*, vd.Num_Mesa, m.descripcion as mesa_nombre,
                       c.nombre as camarero_nombre
                FROM pretickets p
                JOIN ventadirecta vd ON p.id_venta = vd.id_venta
                JOIN mesa m ON vd.Num_Mesa = m.Num_Mesa
                JOIN camareros c ON vd.id_camarero = c.id_camarero
                WHERE p.id = ? AND p.estado != 'anulado'
            `, [preticketId]);

            if (pretickets.length === 0) {
                throw new Error(`Pre-ticket ${preticketId} no encontrado o está anulado`);
            }

            const preticket = pretickets[0];

            // Obtener líneas del pre-ticket
            const [lineas] = await this.connection.execute(`
                SELECT * FROM pretickets_lineas
                WHERE preticket_id = ? AND incluido_preticket = TRUE
                ORDER BY id ASC
            `, [preticketId]);

            // Obtener plantilla de impresión
            const plantilla = await this.obtenerPlantillaImpresion(preticket.formato_impresion);

            // Generar contenido HTML para impresión
            const contenidoHTML = await this.generarContenidoImpresion(preticket, lineas, plantilla);

            // Actualizar estado a impreso
            await this.connection.execute(`
                UPDATE pretickets
                SET estado = ?, fecha_impresion = CURRENT_TIMESTAMP,
                    copias_impresas = copias_impresas + 1,
                    impresora_id = ?
                WHERE id = ?
            `, [this.ESTADOS_PRETICKET.IMPRESO, impresoraId, preticketId]);

            // Emitir evento de impresión
            this.emit('preticket_impreso', {
                preticket_id: preticketId,
                numero_preticket: preticket.numero_preticket,
                venta_id: preticket.id_venta,
                usuario: usuarioId,
                impresora: impresoraId
            });

            console.log(`✅ Pre-ticket ${preticket.numero_preticket} impreso exitosamente`);

            return {
                success: true,
                preticket_id: preticketId,
                numero_preticket: preticket.numero_preticket,
                contenido_html: contenidoHTML,
                impresora_id: impresoraId
            };

        } catch (error) {
            console.error(`❌ Error imprimiendo pre-ticket ${preticketId}:`, error);
            throw error;
        }
    }

    /**
     * Anular pre-ticket
     */
    async anularPreticket(preticketId, usuarioId, motivo) {
        try {
            console.log(`❌ Anulando pre-ticket ${preticketId} - Usuario: ${usuarioId}`);

            // Verificar permisos
            const puedeAnular = await this.verificarPermisos(usuarioId, 'anular');
            if (!puedeAnular) {
                throw new Error('Usuario no tiene permisos para anular pre-tickets');
            }

            // Verificar que el pre-ticket existe
            const [pretickets] = await this.connection.execute(`
                SELECT id, numero_preticket, fecha_generacion, estado
                FROM pretickets
                WHERE id = ? AND estado != 'anulado'
            `, [preticketId]);

            if (pretickets.length === 0) {
                throw new Error(`Pre-ticket ${preticketId} no encontrado o ya está anulado`);
            }

            const preticket = pretickets[0];

            // Verificar límite de tiempo para anulación
            const config = await this.obtenerConfiguracion('usuario', usuarioId);
            const minutosTranscurridos = this.calcularMinutosTranscurridos(preticket.fecha_generacion);

            if (minutosTranscurridos > config.tiempo_limite_anulacion) {
                throw new Error(`No se puede anular: han transcurrido ${minutosTranscurridos} minutos (límite: ${config.tiempo_limite_anulacion})`);
            }

            // Anular el pre-ticket
            await this.connection.execute(`
                UPDATE pretickets
                SET estado = ?, usuario_anulacion = ?, motivo_anulacion = ?,
                    fecha_anulacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [this.ESTADOS_PRETICKET.ANULADO, usuarioId, motivo, preticketId]);

            // Emitir evento
            this.emit('preticket_anulado', {
                preticket_id: preticketId,
                numero_preticket: preticket.numero_preticket,
                usuario: usuarioId,
                motivo: motivo
            });

            console.log(`✅ Pre-ticket ${preticket.numero_preticket} anulado exitosamente`);

            return {
                success: true,
                preticket_id: preticketId,
                numero_preticket: preticket.numero_preticket,
                motivo: motivo
            };

        } catch (error) {
            console.error(`❌ Error anulando pre-ticket ${preticketId}:`, error);
            throw error;
        }
    }

    /**
     * Obtener pre-tickets de una venta
     */
    async obtenerPreticketsVenta(ventaId) {
        try {
            const [pretickets] = await this.connection.execute(`
                SELECT * FROM vista_pretickets_resumen
                WHERE id_venta = ?
                ORDER BY fecha_generacion DESC
            `, [ventaId]);

            return {
                success: true,
                venta_id: ventaId,
                pretickets: pretickets,
                total: pretickets.length
            };

        } catch (error) {
            console.error(`❌ Error obteniendo pre-tickets de venta ${ventaId}:`, error);
            throw error;
        }
    }

    /**
     * Obtener configuración de pre-tickets
     */
    async obtenerConfiguracion(tipo = 'global', idReferencia = null) {
        try {
            const [configs] = await this.connection.execute(`
                SELECT * FROM configuracion_pretickets
                WHERE tipo_config = ? AND (id_referencia = ? OR id_referencia IS NULL)
                AND activo = TRUE
                ORDER BY id_referencia IS NULL ASC
                LIMIT 1
            `, [tipo, idReferencia]);

            if (configs.length > 0) {
                return configs[0];
            }

            // Configuración por defecto
            return {
                numeracion_automatica: true,
                permite_multiples: true,
                maximo_pretickets_venta: 5,
                bloquear_venta_tras_preticket: false,
                impresion_automatica: true,
                copias_predeterminadas: 1,
                tiempo_limite_anulacion: 60,
                puede_generar: true,
                puede_anular: false,
                puede_reimprimir: true
            };

        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error);
            throw error;
        }
    }

    // Métodos auxiliares

    /**
     * Generar número único de pre-ticket
     */
    async generarNumeroPreticket(venta) {
        try {
            const ahora = new Date();
            const year = ahora.getFullYear();
            const month = String(ahora.getMonth() + 1).padStart(2, '0');
            const day = String(ahora.getDate()).padStart(2, '0');

            // Obtener siguiente número del día
            const [contadores] = await this.connection.execute(`
                SELECT COUNT(*) as total FROM pretickets
                WHERE DATE(fecha_generacion) = CURDATE()
            `);

            const siguienteNumero = String(contadores[0].total + 1).padStart(3, '0');

            return `PT${year}${month}${day}-${siguienteNumero}`;

        } catch (error) {
            console.error('❌ Error generando número de pre-ticket:', error);
            // Fallback a timestamp
            return `PT${Date.now()}`;
        }
    }

    /**
     * Generar hash MD5 del contenido
     */
    generarHashContenido(productos, total) {
        const contenido = JSON.stringify({
            productos: productos.map(p => ({
                id: p.id_complementog,
                cantidad: p.cantidad,
                precio: p.precio_unitario
            })),
            total: total
        });

        return crypto.createHash('md5').update(contenido).digest('hex');
    }

    /**
     * Verificar permisos de usuario
     */
    async verificarPermisos(usuarioId, accion) {
        try {
            const config = await this.obtenerConfiguracion('usuario', usuarioId);

            switch (accion) {
                case 'generar':
                    return config.puede_generar !== false;
                case 'anular':
                    return config.puede_anular === true;
                case 'reimprimir':
                    return config.puede_reimprimir !== false;
                default:
                    return false;
            }
        } catch (error) {
            console.warn('⚠️ Error verificando permisos, permitiendo por defecto:', error.message);
            return accion === 'anular' ? false : true;
        }
    }

    /**
     * Calcular minutos transcurridos
     */
    calcularMinutosTranscurridos(fechaInicio) {
        const ahora = new Date();
        const inicio = new Date(fechaInicio);
        const diferenciaMs = ahora - inicio;
        return Math.floor(diferenciaMs / (1000 * 60));
    }

    /**
     * Obtener plantilla de impresión
     */
    async obtenerPlantillaImpresion(formato) {
        try {
            const [plantillas] = await this.connection.execute(`
                SELECT * FROM plantillas_pretickets
                WHERE tipo_plantilla = ? AND activa = TRUE
                ORDER BY predeterminada DESC, id ASC
                LIMIT 1
            `, [formato]);

            if (plantillas.length > 0) {
                return plantillas[0];
            }

            // Plantilla básica por defecto
            return {
                template_html: `
                    <div style="font-family: monospace; font-size: 12px;">
                        <div style="text-align: center; font-weight: bold;">{{restaurante_nombre}}</div>
                        <div style="text-align: center;">PRE-TICKET</div>
                        <hr>
                        <div>Mesa: {{mesa}} | {{fecha}}</div>
                        <div>Camarero: {{camarero}}</div>
                        <hr>
                        {{productos}}
                        <hr>
                        <div style="font-weight: bold;">TOTAL: {{total}}</div>
                        <div style="text-align: center;">{{numero_preticket}}</div>
                    </div>
                `
            };
        } catch (error) {
            console.error('❌ Error obteniendo plantilla:', error);
            return { template_html: '<div>Error al cargar plantilla</div>' };
        }
    }

    /**
     * Generar contenido HTML para impresión
     */
    async generarContenidoImpresion(preticket, lineas, plantilla) {
        try {
            let html = plantilla.template_html;

            // Reemplazar variables básicas
            html = html.replace(/{{restaurante_nombre}}/g, 'DYSA Point Restaurant');
            html = html.replace(/{{numero_preticket}}/g, preticket.numero_preticket);
            html = html.replace(/{{mesa}}/g, preticket.mesa_nombre || preticket.Num_Mesa);
            html = html.replace(/{{camarero}}/g, preticket.camarero_nombre || '');
            html = html.replace(/{{fecha}}/g, new Date(preticket.fecha_generacion).toLocaleString());
            html = html.replace(/{{total}}/g, `$${parseFloat(preticket.total).toFixed(2)}`);

            // Generar lista de productos
            let productosHtml = '';
            for (const linea of lineas) {
                productosHtml += `
                    <div>${linea.cantidad}x ${linea.producto_nombre} - $${parseFloat(linea.subtotal_linea).toFixed(2)}</div>
                `;
            }

            html = html.replace(/{{productos}}/g, productosHtml);

            return html;

        } catch (error) {
            console.error('❌ Error generando contenido de impresión:', error);
            return '<div>Error generando contenido</div>';
        }
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 PreticketManager: Limpiando recursos...');
        this.removeAllListeners();
    }
}

module.exports = PreticketManager;