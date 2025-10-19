/**
 * DYSA Point - Sistema Avanzado de Ventas y Comandas
 * Manejo profesional de órdenes, ítems y cálculos automáticos
 *
 * Funcionalidades:
 * - Creación y modificación de órdenes
 * - Gestión de ítems por mesa
 * - Cálculo automático de totales
 * - Integración con códigos de garzón
 * - Estados de comanda y seguimiento
 * - Modificadores y observaciones
 */

const { promisify } = require('util');

class VentasManager {
    constructor(database) {
        this.db = database;
        this.connection = database.connection;

        // Estados válidos de venta
        this.ESTADOS_VENTA = {
            NUEVA: 'nueva',
            CONFIRMADA: 'confirmada',
            EN_COCINA: 'en_cocina',
            LISTA: 'lista',
            SERVIDA: 'servida',
            CERRADA: 'cerrada',
            CANCELADA: 'cancelada'
        };

        // Estados de ítems
        this.ESTADOS_ITEM = {
            PENDIENTE: 'pendiente',
            CONFIRMADO: 'confirmado',
            EN_PREPARACION: 'en_preparacion',
            LISTO: 'listo',
            SERVIDO: 'servido',
            CANCELADO: 'cancelado'
        };

        console.log('📝 VentasManager inicializado correctamente');
    }

    /**
     * Crear una nueva venta para una mesa
     */
    async crearVenta(datos) {
        try {
            const {
                mesa_id,
                garzon_id,
                garzon_codigo,
                observaciones = null,
                tipo_orden = 'mesa' // mesa, para_llevar, delivery
            } = datos;

            // Validar que la mesa existe y esté disponible
            const mesa = await this.validarMesa(mesa_id);
            if (!mesa.valida) {
                throw new Error(`Mesa no válida: ${mesa.error}`);
            }

            // Validar garzón por código
            const garzon = await this.validarGarzon(garzon_codigo);
            if (!garzon.valido) {
                throw new Error(`Garzón no válido: ${garzon.error}`);
            }

            // Verificar si hay venta activa en la mesa
            const ventaActiva = await this.obtenerVentaActivaPorMesa(mesa_id);
            if (ventaActiva) {
                console.log(`ℹ️ Mesa ${mesa_id} ya tiene venta activa. ID: ${ventaActiva.id}`);
                return {
                    success: true,
                    venta: ventaActiva,
                    esNueva: false
                };
            }

            // Obtener sesión de punto de venta activa
            const sesionPV = await this.obtenerSesionPuntoVentaActiva();
            if (!sesionPV) {
                throw new Error('No hay sesión de punto de venta activa');
            }

            // Crear nueva venta
            const [resultado] = await this.connection.execute(`
                INSERT INTO ventas (
                    mesa_id, usuario_id, sesion_pv_id, tipo_orden,
                    estado, subtotal, impuestos, descuento, total,
                    observaciones, fecha_apertura, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                mesa_id,
                garzon.id,
                sesionPV.id,
                tipo_orden,
                this.ESTADOS_VENTA.NUEVA,
                0, // subtotal inicial
                0, // impuestos inicial
                0, // descuento inicial
                0, // total inicial
                observaciones
            ]);

            const ventaId = resultado.insertId;

            // Actualizar estado de la mesa
            await this.connection.execute(`
                UPDATE mesas SET estado = 'ocupada', updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [mesa_id]);

            // Registrar auditoría
            await this.registrarAuditoria({
                usuario_id: garzon.id,
                accion: 'crear_venta',
                tabla: 'ventas',
                registro_id: ventaId,
                detalles: JSON.stringify({
                    mesa_id,
                    tipo_orden,
                    garzon_codigo
                })
            });

            // Obtener la venta creada con detalles
            const ventaCreada = await this.obtenerVentaPorId(ventaId);

            console.log(`✅ Venta creada exitosamente. ID: ${ventaId}, Mesa: ${mesa_id}`);

            return {
                success: true,
                venta: ventaCreada,
                esNueva: true
            };

        } catch (error) {
            console.error('❌ Error creando venta:', error);
            throw error;
        }
    }

    /**
     * Agregar ítem a una venta
     */
    async agregarItem(ventaId, itemData) {
        try {
            const {
                producto_id,
                cantidad,
                precio_unitario = null, // Si no se proporciona, se toma del producto
                modificadores = [], // Array de modificadores
                observaciones = null,
                garzon_codigo
            } = itemData;

            // Validar venta
            const venta = await this.obtenerVentaPorId(ventaId);
            if (!venta) {
                throw new Error(`Venta ${ventaId} no encontrada`);
            }

            if (venta.estado === this.ESTADOS_VENTA.CERRADA) {
                throw new Error('No se pueden agregar ítems a una venta cerrada');
            }

            // Validar producto
            const producto = await this.obtenerProductoPorId(producto_id);
            if (!producto || !producto.activo) {
                throw new Error(`Producto ${producto_id} no válido o inactivo`);
            }

            // Validar garzón
            const garzon = await this.validarGarzon(garzon_codigo);
            if (!garzon.valido) {
                throw new Error(`Garzón no válido: ${garzon.error}`);
            }

            // Usar precio del producto si no se proporciona
            const precioFinal = precio_unitario || producto.precio;
            const subtotalItem = cantidad * precioFinal;

            // Insertar ítem principal
            const [resultado] = await this.connection.execute(`
                INSERT INTO venta_items (
                    venta_id, producto_id, cantidad, precio_unitario, subtotal,
                    estado, observaciones, usuario_id, estacion_id,
                    requiere_cocina, tiempo_estimado, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [
                ventaId,
                producto_id,
                cantidad,
                precioFinal,
                subtotalItem,
                this.ESTADOS_ITEM.PENDIENTE,
                observaciones,
                garzon.id,
                producto.estacion_id,
                producto.requiere_cocina,
                producto.tiempo_preparacion || 0
            ]);

            const itemId = resultado.insertId;

            // Procesar modificadores si existen
            if (modificadores && modificadores.length > 0) {
                await this.procesarModificadores(itemId, modificadores);
            }

            // Recalcular totales de la venta
            await this.recalcularTotales(ventaId);

            // Registrar auditoría
            await this.registrarAuditoria({
                usuario_id: garzon.id,
                accion: 'agregar_item',
                tabla: 'venta_items',
                registro_id: itemId,
                detalles: JSON.stringify({
                    venta_id: ventaId,
                    producto: producto.nombre,
                    cantidad,
                    precio: precioFinal
                })
            });

            // Si requiere cocina, crear registro en comandas de cocina
            if (producto.requiere_cocina) {
                await this.crearComandaCocina(itemId, producto.estacion_id);
            }

            console.log(`✅ Ítem agregado: ${producto.nombre} x${cantidad} - Venta: ${ventaId}`);

            return {
                success: true,
                item_id: itemId,
                subtotal_item: subtotalItem,
                requiere_cocina: producto.requiere_cocina
            };

        } catch (error) {
            console.error('❌ Error agregando ítem:', error);
            throw error;
        }
    }

    /**
     * Modificar cantidad de un ítem
     */
    async modificarCantidadItem(itemId, nuevaCantidad, garzonCodigo) {
        try {
            // Validar garzón
            const garzon = await this.validarGarzon(garzonCodigo);
            if (!garzon.valido) {
                throw new Error(`Garzón no válido: ${garzon.error}`);
            }

            // Obtener ítem actual
            const [items] = await this.connection.execute(`
                SELECT vi.*, p.nombre as producto_nombre
                FROM venta_items vi
                JOIN productos p ON vi.producto_id = p.id
                WHERE vi.id = ?
            `, [itemId]);

            if (items.length === 0) {
                throw new Error(`Ítem ${itemId} no encontrado`);
            }

            const item = items[0];

            if (item.estado === this.ESTADOS_ITEM.SERVIDO) {
                throw new Error('No se puede modificar un ítem ya servido');
            }

            // Calcular nuevo subtotal
            const nuevoSubtotal = nuevaCantidad * item.precio_unitario;

            // Actualizar ítem
            await this.connection.execute(`
                UPDATE venta_items
                SET cantidad = ?, subtotal = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [nuevaCantidad, nuevoSubtotal, itemId]);

            // Recalcular totales de la venta
            await this.recalcularTotales(item.venta_id);

            // Registrar auditoría
            await this.registrarAuditoria({
                usuario_id: garzon.id,
                accion: 'modificar_cantidad',
                tabla: 'venta_items',
                registro_id: itemId,
                detalles: JSON.stringify({
                    producto: item.producto_nombre,
                    cantidad_anterior: item.cantidad,
                    cantidad_nueva: nuevaCantidad
                })
            });

            console.log(`✅ Cantidad modificada: ${item.producto_nombre} ${item.cantidad} → ${nuevaCantidad}`);

            return {
                success: true,
                cantidad_anterior: item.cantidad,
                cantidad_nueva: nuevaCantidad,
                subtotal_nuevo: nuevoSubtotal
            };

        } catch (error) {
            console.error('❌ Error modificando cantidad:', error);
            throw error;
        }
    }

    /**
     * Eliminar ítem de una venta
     */
    async eliminarItem(itemId, garzonCodigo, motivo = null) {
        try {
            // Validar garzón
            const garzon = await this.validarGarzon(garzonCodigo);
            if (!garzon.valido) {
                throw new Error(`Garzón no válido: ${garzon.error}`);
            }

            // Obtener ítem
            const [items] = await this.connection.execute(`
                SELECT vi.*, p.nombre as producto_nombre
                FROM venta_items vi
                JOIN productos p ON vi.producto_id = p.id
                WHERE vi.id = ?
            `, [itemId]);

            if (items.length === 0) {
                throw new Error(`Ítem ${itemId} no encontrado`);
            }

            const item = items[0];

            if (item.estado === this.ESTADOS_ITEM.SERVIDO) {
                throw new Error('No se puede eliminar un ítem ya servido');
            }

            // Marcar como cancelado en lugar de eliminar
            await this.connection.execute(`
                UPDATE venta_items
                SET estado = ?, observaciones = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                this.ESTADOS_ITEM.CANCELADO,
                motivo ? `CANCELADO: ${motivo}` : 'CANCELADO',
                itemId
            ]);

            // Recalcular totales de la venta
            await this.recalcularTotales(item.venta_id);

            // Registrar auditoría
            await this.registrarAuditoria({
                usuario_id: garzon.id,
                accion: 'eliminar_item',
                tabla: 'venta_items',
                registro_id: itemId,
                detalles: JSON.stringify({
                    producto: item.producto_nombre,
                    cantidad: item.cantidad,
                    motivo: motivo
                })
            });

            console.log(`✅ Ítem eliminado: ${item.producto_nombre} - Motivo: ${motivo || 'No especificado'}`);

            return {
                success: true,
                item_eliminado: item.producto_nombre,
                cantidad: item.cantidad
            };

        } catch (error) {
            console.error('❌ Error eliminando ítem:', error);
            throw error;
        }
    }

    /**
     * Obtener detalles completos de una venta
     */
    async obtenerVentaCompleta(ventaId) {
        try {
            // Obtener venta principal
            const venta = await this.obtenerVentaPorId(ventaId);
            if (!venta) {
                throw new Error(`Venta ${ventaId} no encontrada`);
            }

            // Obtener ítems de la venta
            const [items] = await this.connection.execute(`
                SELECT
                    vi.*,
                    p.codigo as producto_codigo,
                    p.nombre as producto_nombre,
                    p.descripcion as producto_descripcion,
                    c.nombre as categoria_nombre,
                    ec.nombre as estacion_nombre,
                    u.nombre as garzon_nombre
                FROM venta_items vi
                JOIN productos p ON vi.producto_id = p.id
                LEFT JOIN categorias c ON p.categoria_id = c.id
                LEFT JOIN estaciones_cocina ec ON vi.estacion_id = ec.id
                LEFT JOIN usuarios u ON vi.usuario_id = u.id
                WHERE vi.venta_id = ? AND vi.estado != ?
                ORDER BY vi.created_at ASC
            `, [ventaId, this.ESTADOS_ITEM.CANCELADO]);

            // Obtener modificadores de cada ítem
            for (let item of items) {
                const [modificadores] = await this.connection.execute(`
                    SELECT vim.*, p.nombre as modificador_nombre, p.precio as modificador_precio
                    FROM venta_item_modificadores vim
                    JOIN productos p ON vim.modificador_id = p.id
                    WHERE vim.item_id = ?
                `, [item.id]);

                item.modificadores = modificadores;
            }

            return {
                ...venta,
                items: items
            };

        } catch (error) {
            console.error('❌ Error obteniendo venta completa:', error);
            throw error;
        }
    }

    /**
     * Recalcular totales de una venta
     */
    async recalcularTotales(ventaId) {
        try {
            // Obtener suma de ítems activos
            const [totales] = await this.connection.execute(`
                SELECT
                    COALESCE(SUM(vi.subtotal), 0) as subtotal_items,
                    COALESCE(SUM(vim.precio_total), 0) as subtotal_modificadores
                FROM venta_items vi
                LEFT JOIN (
                    SELECT item_id, SUM(cantidad * precio_unitario) as precio_total
                    FROM venta_item_modificadores
                    GROUP BY item_id
                ) vim ON vi.id = vim.item_id
                WHERE vi.venta_id = ? AND vi.estado != ?
            `, [ventaId, this.ESTADOS_ITEM.CANCELADO]);

            const subtotal = parseFloat(totales[0].subtotal_items || 0) + parseFloat(totales[0].subtotal_modificadores || 0);

            // Calcular impuestos (19% IVA)
            const impuestos = subtotal * 0.19;

            // Por ahora no aplicamos descuentos automáticos
            const descuento = 0;

            const total = subtotal + impuestos - descuento;

            // Actualizar venta
            await this.connection.execute(`
                UPDATE ventas
                SET subtotal = ?, impuestos = ?, descuento = ?, total = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [subtotal, impuestos, descuento, total, ventaId]);

            console.log(`💰 Totales recalculados - Venta ${ventaId}: Subtotal: $${subtotal}, Total: $${total}`);

            return {
                subtotal: subtotal,
                impuestos: impuestos,
                descuento: descuento,
                total: total
            };

        } catch (error) {
            console.error('❌ Error recalculando totales:', error);
            throw error;
        }
    }

    // Métodos auxiliares
    async validarMesa(mesaId) {
        try {
            const [mesas] = await this.connection.execute(`
                SELECT id, nombre, estado, activo FROM mesas WHERE id = ?
            `, [mesaId]);

            if (mesas.length === 0) {
                return { valida: false, error: 'Mesa no encontrada' };
            }

            const mesa = mesas[0];

            if (!mesa.activo) {
                return { valida: false, error: 'Mesa inactiva' };
            }

            return { valida: true, mesa: mesa };

        } catch (error) {
            return { valida: false, error: error.message };
        }
    }

    async validarGarzon(codigo) {
        try {
            const [usuarios] = await this.connection.execute(`
                SELECT id, username, nombre, apellido, role_id FROM usuarios
                WHERE codigo_privado = ? AND activo = 1
            `, [codigo]);

            if (usuarios.length === 0) {
                return { valido: false, error: 'Código de garzón inválido' };
            }

            return { valido: true, ...usuarios[0] };

        } catch (error) {
            return { valido: false, error: error.message };
        }
    }

    async obtenerVentaActivaPorMesa(mesaId) {
        try {
            const [ventas] = await this.connection.execute(`
                SELECT * FROM ventas
                WHERE mesa_id = ? AND estado NOT IN (?, ?)
                ORDER BY created_at DESC LIMIT 1
            `, [mesaId, this.ESTADOS_VENTA.CERRADA, this.ESTADOS_VENTA.CANCELADA]);

            return ventas.length > 0 ? ventas[0] : null;

        } catch (error) {
            console.error('❌ Error obteniendo venta activa:', error);
            return null;
        }
    }

    async obtenerVentaPorId(ventaId) {
        try {
            const [ventas] = await this.connection.execute(`
                SELECT
                    v.*,
                    m.nombre as mesa_nombre,
                    u.nombre as garzon_nombre,
                    u.apellido as garzon_apellido
                FROM ventas v
                JOIN mesas m ON v.mesa_id = m.id
                JOIN usuarios u ON v.usuario_id = u.id
                WHERE v.id = ?
            `, [ventaId]);

            return ventas.length > 0 ? ventas[0] : null;

        } catch (error) {
            console.error('❌ Error obteniendo venta:', error);
            return null;
        }
    }

    async obtenerProductoPorId(productoId) {
        try {
            const [productos] = await this.connection.execute(`
                SELECT * FROM productos WHERE id = ?
            `, [productoId]);

            return productos.length > 0 ? productos[0] : null;

        } catch (error) {
            console.error('❌ Error obteniendo producto:', error);
            return null;
        }
    }

    async obtenerSesionPuntoVentaActiva() {
        try {
            const [sesiones] = await this.connection.execute(`
                SELECT * FROM punto_venta_sesiones
                WHERE estado = 'abierta'
                ORDER BY fecha_apertura DESC LIMIT 1
            `);

            return sesiones.length > 0 ? sesiones[0] : null;

        } catch (error) {
            console.error('❌ Error obteniendo sesión PV:', error);
            return null;
        }
    }

    async procesarModificadores(itemId, modificadores) {
        try {
            for (const mod of modificadores) {
                const { modificador_id, cantidad = 1, precio_unitario = null } = mod;

                // Obtener precio del modificador si no se proporciona
                let precio = precio_unitario;
                if (!precio) {
                    const producto = await this.obtenerProductoPorId(modificador_id);
                    precio = producto ? producto.precio : 0;
                }

                await this.connection.execute(`
                    INSERT INTO venta_item_modificadores (
                        item_id, modificador_id, cantidad, precio_unitario, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [itemId, modificador_id, cantidad, precio]);
            }

        } catch (error) {
            console.error('❌ Error procesando modificadores:', error);
            throw error;
        }
    }

    async crearComandaCocina(itemId, estacionId) {
        try {
            await this.connection.execute(`
                INSERT INTO comandas_cocina (
                    item_id, estacion_id, estado, prioridad,
                    created_at, updated_at
                ) VALUES (?, ?, 'pendiente', 'normal', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [itemId, estacionId]);

        } catch (error) {
            console.error('❌ Error creando comanda cocina:', error);
            // No lanzar error, es auxiliar
        }
    }

    async registrarAuditoria(datos) {
        try {
            await this.connection.execute(`
                INSERT INTO auditoria_acciones (
                    usuario_id, accion, tabla, registro_id, detalles, created_at
                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [datos.usuario_id, datos.accion, datos.tabla, datos.registro_id, datos.detalles]);

        } catch (error) {
            console.error('❌ Error registrando auditoría:', error);
            // No lanzar error, es auxiliar
        }
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 VentasManager: Limpiando recursos...');
        // Limpiar timeouts, intervalos, etc.
    }
}

module.exports = VentasManager;