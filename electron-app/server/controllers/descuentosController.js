// Controlador de Descuentos - DYSA Point
const { pool } = require('../config/database');

/**
 * Obtener todos los descuentos
 */
const obtenerDescuentos = async (req, res) => {
    try {
        const [descuentos] = await pool.query(
            `SELECT * FROM descuentos WHERE activo = 1 ORDER BY nombre`
        );
        res.json({ success: true, descuentos });
    } catch (error) {
        console.error('Error al obtener descuentos:', error);
        res.status(500).json({ success: false, error: 'Error al obtener descuentos' });
    }
};

/**
 * Obtener descuentos disponibles para una venta
 */
const obtenerDescuentosDisponibles = async (req, res) => {
    try {
        const [descuentos] = await pool.query(
            `SELECT * FROM descuentos
             WHERE activo = 1
             AND (fecha_fin IS NULL OR fecha_fin >= CURDATE())
             ORDER BY nombre`
        );
        res.json({ success: true, descuentos });
    } catch (error) {
        console.error('Error al obtener descuentos disponibles:', error);
        res.status(500).json({ success: false, error: 'Error al obtener descuentos' });
    }
};

/**
 * Obtener estadísticas de descuentos
 */
const obtenerEstadisticas = async (req, res) => {
    try {
        const [stats] = await pool.query(
            `SELECT
                COUNT(*) as total_descuentos,
                SUM(CASE WHEN activo = 1 THEN 1 ELSE 0 END) as activos,
                SUM(CASE WHEN activo = 0 THEN 1 ELSE 0 END) as inactivos
             FROM descuentos`
        );
        res.json({ success: true, estadisticas: stats[0] });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, error: 'Error al obtener estadísticas' });
    }
};

/**
 * Obtener descuento por ID
 */
const obtenerDescuentoPorId = async (req, res) => {
    try {
        const { id_descuento } = req.params;
        const [descuento] = await pool.query(
            'SELECT * FROM descuentos WHERE id_descuento = ?',
            [id_descuento]
        );

        if (descuento.length === 0) {
            return res.status(404).json({ success: false, error: 'Descuento no encontrado' });
        }

        res.json({ success: true, descuento: descuento[0] });
    } catch (error) {
        console.error('Error al obtener descuento:', error);
        res.status(500).json({ success: false, error: 'Error al obtener descuento' });
    }
};

/**
 * Crear descuento
 */
const crearDescuento = async (req, res) => {
    try {
        const { nombre, tipo, valor, fecha_inicio, fecha_fin, activo } = req.body;

        const [result] = await pool.query(
            `INSERT INTO descuentos (nombre, tipo, valor, fecha_inicio, fecha_fin, activo)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [nombre, tipo, valor, fecha_inicio || null, fecha_fin || null, activo !== undefined ? activo : 1]
        );

        res.json({
            success: true,
            message: 'Descuento creado exitosamente',
            id_descuento: result.insertId
        });
    } catch (error) {
        console.error('Error al crear descuento:', error);
        res.status(500).json({ success: false, error: 'Error al crear descuento' });
    }
};

/**
 * Actualizar descuento
 */
const actualizarDescuento = async (req, res) => {
    try {
        const { id_descuento } = req.params;
        const { nombre, tipo, valor, fecha_inicio, fecha_fin, activo } = req.body;

        await pool.query(
            `UPDATE descuentos
             SET nombre = ?, tipo = ?, valor = ?,
                 fecha_inicio = ?, fecha_fin = ?, activo = ?
             WHERE id_descuento = ?`,
            [nombre, tipo, valor, fecha_inicio || null, fecha_fin || null, activo, id_descuento]
        );

        res.json({ success: true, message: 'Descuento actualizado exitosamente' });
    } catch (error) {
        console.error('Error al actualizar descuento:', error);
        res.status(500).json({ success: false, error: 'Error al actualizar descuento' });
    }
};

/**
 * Eliminar descuento (soft delete)
 */
const eliminarDescuento = async (req, res) => {
    try {
        const { id_descuento } = req.params;

        await pool.query(
            'UPDATE descuentos SET activo = 0 WHERE id_descuento = ?',
            [id_descuento]
        );

        res.json({ success: true, message: 'Descuento eliminado exitosamente' });
    } catch (error) {
        console.error('Error al eliminar descuento:', error);
        res.status(500).json({ success: false, error: 'Error al eliminar descuento' });
    }
};

/**
 * Aplicar descuento a una venta
 */
const aplicarDescuento = async (req, res) => {
    try {
        const { id_venta, id_descuento } = req.body;

        // Obtener descuento
        const [descuento] = await pool.query(
            'SELECT * FROM descuentos WHERE id_descuento = ? AND activo = 1',
            [id_descuento]
        );

        if (descuento.length === 0) {
            return res.status(404).json({ success: false, error: 'Descuento no encontrado o inactivo' });
        }

        // Obtener total de venta
        const [venta] = await pool.query(
            'SELECT total FROM ventas WHERE id_venta = ?',
            [id_venta]
        );

        if (venta.length === 0) {
            return res.status(404).json({ success: false, error: 'Venta no encontrada' });
        }

        const desc = descuento[0];
        let monto_descuento = 0;

        if (desc.tipo === 'PORCENTAJE') {
            monto_descuento = (venta[0].total * desc.valor) / 100;
        } else if (desc.tipo === 'FIJO') {
            monto_descuento = desc.valor;
        }

        // Aplicar descuento a la venta
        await pool.query(
            `UPDATE ventas
             SET descuento = ?, total = total - ?
             WHERE id_venta = ?`,
            [monto_descuento, monto_descuento, id_venta]
        );

        res.json({
            success: true,
            message: 'Descuento aplicado exitosamente',
            monto_descuento
        });
    } catch (error) {
        console.error('Error al aplicar descuento:', error);
        res.status(500).json({ success: false, error: 'Error al aplicar descuento' });
    }
};

/**
 * Obtener descuentos aplicados a una venta
 */
const obtenerDescuentosVenta = async (req, res) => {
    try {
        const { id_venta } = req.params;

        const [venta] = await pool.query(
            'SELECT descuento FROM ventas WHERE id_venta = ?',
            [id_venta]
        );

        if (venta.length === 0) {
            return res.status(404).json({ success: false, error: 'Venta no encontrada' });
        }

        res.json({
            success: true,
            descuento: venta[0].descuento || 0
        });
    } catch (error) {
        console.error('Error al obtener descuentos de venta:', error);
        res.status(500).json({ success: false, error: 'Error al obtener descuentos' });
    }
};

module.exports = {
    obtenerDescuentos,
    obtenerDescuentosDisponibles,
    obtenerEstadisticas,
    obtenerDescuentoPorId,
    crearDescuento,
    actualizarDescuento,
    eliminarDescuento,
    aplicarDescuento,
    obtenerDescuentosVenta
};
