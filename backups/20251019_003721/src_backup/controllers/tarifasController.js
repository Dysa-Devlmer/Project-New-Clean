/**
 * CONTROLADOR DE TARIFAS (CORREGIDO)
 *
 * Gestiona el sistema de tarifas múltiples para productos
 * Permite diferentes precios según la tarifa (Happy Hour, VIP, etc.)
 *
 * @author Claude Code
 * @date 2025-10-12
 */

const db = require('../config/database');

/**
 * Obtener todas las tarifas activas
 */
exports.obtenerTarifas = async (req, res) => {
    try {
        const tarifas = await db.query(
            `SELECT
                id_tarifa,
                nombre,
                descripcion,
                defecto,
                activo,
                fecha_creacion
            FROM tarifa
            WHERE activo = 'Y'
            ORDER BY
                CASE WHEN defecto = 'Y' THEN 0 ELSE 1 END,
                nombre`
        );

        res.json({
            success: true,
            tarifas
        });
    } catch (error) {
        console.error('Error al obtener tarifas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tarifas',
            error: error.message
        });
    }
};

/**
 * Obtener tarifa por ID
 */
exports.obtenerTarifaPorId = async (req, res) => {
    try {
        const { id } = req.params;

        const tarifas = await db.query(
            `SELECT
                id_tarifa,
                nombre,
                descripcion,
                defecto,
                activo,
                fecha_creacion
            FROM tarifa
            WHERE id_tarifa = ?`,
            [id]
        );

        if (tarifas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarifa no encontrada'
            });
        }

        // Obtener productos con precios específicos para esta tarifa
        const productos = await db.query(
            `SELECT
                pt.id,
                pt.id_producto,
                c.alias as producto_nombre,
                c.precio as precio_normal,
                pt.precio_tarifa,
                pt.activo
            FROM producto_tarifa pt
            INNER JOIN complementog c ON pt.id_producto = c.id_complementog
            WHERE pt.id_tarifa = ?
            AND pt.activo = 'Y'
            ORDER BY c.alias`,
            [id]
        );

        res.json({
            success: true,
            tarifa: tarifas[0],
            productos
        });
    } catch (error) {
        console.error('Error al obtener tarifa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener tarifa',
            error: error.message
        });
    }
};

/**
 * Crear nueva tarifa
 */
exports.crearTarifa = async (req, res) => {
    try {
        const { nombre, descripcion, defecto = 'N' } = req.body;

        // Validaciones
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la tarifa es obligatorio'
            });
        }

        // Si es tarifa por defecto, desmarcar las demás
        if (defecto === 'Y') {
            await db.query(
                'UPDATE tarifa SET defecto = ? WHERE defecto = ?',
                ['N', 'Y']
            );
        }

        // Insertar tarifa
        const result = await db.query(
            `INSERT INTO tarifa (nombre, descripcion, defecto, activo)
            VALUES (?, ?, ?, ?)`,
            [nombre.trim(), descripcion || null, defecto, 'Y']
        );

        res.status(201).json({
            success: true,
            message: 'Tarifa creada exitosamente',
            id_tarifa: result.insertId
        });
    } catch (error) {
        console.error('Error al crear tarifa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear tarifa',
            error: error.message
        });
    }
};

/**
 * Actualizar tarifa
 */
exports.actualizarTarifa = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, defecto } = req.body;

        // Validaciones
        if (!nombre || nombre.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la tarifa es obligatorio'
            });
        }

        // Verificar que existe
        const tarifas = await db.query(
            'SELECT id_tarifa FROM tarifa WHERE id_tarifa = ?',
            [id]
        );

        if (tarifas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarifa no encontrada'
            });
        }

        // Si se marca como defecto, desmarcar las demás
        if (defecto === 'Y') {
            await db.query(
                'UPDATE tarifa SET defecto = ? WHERE id_tarifa != ? AND defecto = ?',
                ['N', id, 'Y']
            );
        }

        // Actualizar tarifa
        await db.query(
            `UPDATE tarifa
            SET nombre = ?,
                descripcion = ?,
                defecto = ?
            WHERE id_tarifa = ?`,
            [nombre.trim(), descripcion || null, defecto || 'N', id]
        );

        res.json({
            success: true,
            message: 'Tarifa actualizada exitosamente'
        });
    } catch (error) {
        console.error('Error al actualizar tarifa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar tarifa',
            error: error.message
        });
    }
};

/**
 * Eliminar tarifa (soft delete)
 */
exports.eliminarTarifa = async (req, res) => {
    try {
        const { id } = req.params;

        // Verificar que existe
        const tarifas = await db.query(
            'SELECT defecto FROM tarifa WHERE id_tarifa = ?',
            [id]
        );

        if (tarifas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarifa no encontrada'
            });
        }

        // No permitir eliminar tarifa por defecto
        if (tarifas[0].defecto === 'Y') {
            return res.status(400).json({
                success: false,
                message: 'No se puede eliminar la tarifa por defecto'
            });
        }

        // Verificar si está asignada a mesas
        const mesas = await db.query(
            'SELECT COUNT(*) as total FROM mesa WHERE id_tarifa = ?',
            [id]
        );

        if (mesas[0].total > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar la tarifa porque está asignada a ${mesas[0].total} mesa(s)`
            });
        }

        // Soft delete
        await db.query(
            'UPDATE tarifa SET activo = ? WHERE id_tarifa = ?',
            ['N', id]
        );

        // Desactivar precios asociados
        await db.query(
            'UPDATE producto_tarifa SET activo = ? WHERE id_tarifa = ?',
            ['N', id]
        );

        res.json({
            success: true,
            message: 'Tarifa eliminada exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar tarifa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar tarifa',
            error: error.message
        });
    }
};

/**
 * Asignar precio de producto para una tarifa
 */
exports.asignarPrecioProducto = async (req, res) => {
    try {
        const { id_producto, id_tarifa, precio_tarifa } = req.body;

        // Validaciones
        if (!id_producto || !id_tarifa || !precio_tarifa) {
            return res.status(400).json({
                success: false,
                message: 'Faltan campos obligatorios'
            });
        }

        if (precio_tarifa < 0) {
            return res.status(400).json({
                success: false,
                message: 'El precio no puede ser negativo'
            });
        }

        // Verificar que producto existe
        const productos = await db.query(
            'SELECT id_complementog FROM complementog WHERE id_complementog = ? AND activo = 1',
            [id_producto]
        );

        if (productos.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        // Verificar que tarifa existe
        const tarifas = await db.query(
            'SELECT id_tarifa FROM tarifa WHERE id_tarifa = ? AND activo = ?',
            [id_tarifa, 'Y']
        );

        if (tarifas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarifa no encontrada'
            });
        }

        // Insertar o actualizar precio
        await db.query(
            `INSERT INTO producto_tarifa (id_producto, id_tarifa, precio_tarifa, activo)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                precio_tarifa = VALUES(precio_tarifa),
                activo = ?`,
            [id_producto, id_tarifa, precio_tarifa, 'Y', 'Y']
        );

        res.json({
            success: true,
            message: 'Precio asignado exitosamente'
        });
    } catch (error) {
        console.error('Error al asignar precio:', error);
        res.status(500).json({
            success: false,
            message: 'Error al asignar precio',
            error: error.message
        });
    }
};

/**
 * Eliminar precio de producto para una tarifa
 */
exports.eliminarPrecioProducto = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'UPDATE producto_tarifa SET activo = ? WHERE id = ?',
            ['N', id]
        );

        res.json({
            success: true,
            message: 'Precio eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar precio:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar precio',
            error: error.message
        });
    }
};

/**
 * Obtener precio de un producto según tarifa
 */
exports.obtenerPrecioProducto = async (req, res) => {
    try {
        const { id_producto, id_tarifa } = req.query;

        if (!id_producto || !id_tarifa) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros'
            });
        }

        // Intentar obtener precio específico para la tarifa
        const precios = await db.query(
            `SELECT precio_tarifa as precio
            FROM producto_tarifa
            WHERE id_producto = ?
              AND id_tarifa = ?
              AND activo = ?
            LIMIT 1`,
            [id_producto, id_tarifa, 'Y']
        );

        if (precios.length > 0) {
            return res.json({
                success: true,
                precio: precios[0].precio,
                tipo: 'tarifa_especial'
            });
        }

        // Si no hay precio específico, usar precio normal
        const productos = await db.query(
            `SELECT precio
            FROM complementog
            WHERE id_complementog = ?
              AND activo = 1
            LIMIT 1`,
            [id_producto]
        );

        if (productos.length > 0) {
            return res.json({
                success: true,
                precio: productos[0].precio,
                tipo: 'precio_normal'
            });
        }

        res.status(404).json({
            success: false,
            message: 'Producto no encontrado'
        });
    } catch (error) {
        console.error('Error al obtener precio:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener precio',
            error: error.message
        });
    }
};

/**
 * Cambiar tarifa de una venta
 * Recalcula todos los precios según la nueva tarifa
 */
exports.cambiarTarifaVenta = async (req, res) => {
    try {
        const { id_venta, id_tarifa } = req.body;

        if (!id_venta || !id_tarifa) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros'
            });
        }

        // Verificar que venta existe y está abierta
        const ventas = await db.query(
            'SELECT id_venta FROM ventadirecta WHERE id_venta = ? AND cerrada = ?',
            [id_venta, 'N']
        );

        if (ventas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Venta no encontrada o ya está cerrada'
            });
        }

        // Obtener nombre de la tarifa
        const tarifas = await db.query(
            'SELECT nombre FROM tarifa WHERE id_tarifa = ? AND activo = ?',
            [id_tarifa, 'Y']
        );

        if (tarifas.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Tarifa no encontrada'
            });
        }

        // Actualizar tarifa en la venta
        await db.query(
            'UPDATE ventadirecta SET id_tarifa = ?, nombre_tarifa = ? WHERE id_venta = ?',
            [id_tarifa, tarifas[0].nombre, id_venta]
        );

        // Recalcular precios de todas las líneas según la nueva tarifa
        const lineas = await db.query(
            `SELECT id_linea, id_complementog, cantidad
            FROM ventadir_comg
            WHERE id_venta = ?`,
            [id_venta]
        );

        for (const linea of lineas) {
            // Buscar precio específico para esta tarifa
            const preciosTarifa = await db.query(
                `SELECT precio_tarifa
                FROM producto_tarifa
                WHERE id_producto = ?
                  AND id_tarifa = ?
                  AND activo = ?
                LIMIT 1`,
                [linea.id_complementog, id_tarifa, 'Y']
            );

            let nuevoPrecio;

            if (preciosTarifa.length > 0) {
                nuevoPrecio = preciosTarifa[0].precio_tarifa;
            } else {
                // Usar precio normal
                const productos = await db.query(
                    'SELECT precio FROM complementog WHERE id_complementog = ?',
                    [linea.id_complementog]
                );
                nuevoPrecio = productos[0].precio;
            }

            // Actualizar precio de la línea
            await db.query(
                `UPDATE ventadir_comg
                SET precio_unitario = ?
                WHERE id_linea = ?`,
                [nuevoPrecio, linea.id_linea]
            );
        }

        res.json({
            success: true,
            message: 'Tarifa cambiada y precios recalculados exitosamente',
            nombre_tarifa: tarifas[0].nombre
        });
    } catch (error) {
        console.error('Error al cambiar tarifa:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar tarifa',
            error: error.message
        });
    }
};
