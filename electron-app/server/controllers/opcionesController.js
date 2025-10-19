// Controller para opciones de productos
const { pool } = require('../config/database');

// Obtener opciones disponibles para un producto
async function obtenerOpcionesProducto(req, res) {
    try {
        const { id_complementog } = req.params;

        // Obtener opciones específicas del producto
        const [opcionesProducto] = await pool.query(`
            SELECT
                o.id_opcion,
                o.nombre,
                o.descripcion,
                o.orden
            FROM opciones_producto o
            INNER JOIN producto_opciones po ON o.id_opcion = po.id_opcion
            WHERE po.id_complementog = ?
            AND o.activo = 'Y'
            ORDER BY o.orden, o.nombre
        `, [id_complementog]);

        // Si el producto no tiene opciones específicas, obtener opciones generales
        if (opcionesProducto.length === 0) {
            const [opcionesGenerales] = await pool.query(`
                SELECT
                    id_opcion,
                    nombre,
                    descripcion,
                    orden
                FROM opciones_producto
                WHERE activo = 'Y'
                AND nombre IN ('PARA LLEVAR', 'AVISO', 'URGENTE')
                ORDER BY orden, nombre
            `);

            return res.json({
                success: true,
                opciones: opcionesGenerales,
                cantidad: opcionesGenerales.length
            });
        }

        res.json({
            success: true,
            opciones: opcionesProducto,
            cantidad: opcionesProducto.length
        });

    } catch (error) {
        console.error('Error al obtener opciones del producto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener todas las opciones disponibles
async function obtenerTodasOpciones(req, res) {
    try {
        const [opciones] = await pool.query(`
            SELECT
                id_opcion,
                nombre,
                descripcion,
                orden,
                activo
            FROM opciones_producto
            WHERE activo = 'Y'
            ORDER BY orden, nombre
        `);

        res.json({
            success: true,
            opciones,
            cantidad: opciones.length
        });

    } catch (error) {
        console.error('Error al obtener opciones:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Actualizar línea de pedido con opciones y observaciones
async function actualizarLineaPedido(req, res) {
    try {
        const { id_venta, id_linea, opciones, observaciones, cantidad } = req.body;

        // Validar datos requeridos
        if (!id_venta || !id_linea) {
            return res.status(400).json({
                success: false,
                error: 'id_venta e id_linea son requeridos'
            });
        }

        // Construir campo "nota" con opciones seleccionadas
        let notaTexto = '';
        if (opciones && Array.isArray(opciones) && opciones.length > 0) {
            // Obtener nombres de opciones
            const placeholders = opciones.map(() => '?').join(',');
            const [opcionesData] = await pool.query(`
                SELECT nombre
                FROM opciones_producto
                WHERE id_opcion IN (${placeholders})
                ORDER BY orden
            `, opciones);

            notaTexto = opcionesData.map(o => ` * ${o.nombre}`).join('');
        }

        // Actualizar línea
        const cantidadFinal = cantidad || 1;

        await pool.query(`
            UPDATE ventadir_comg
            SET
                nota = ?,
                observaciones = ?,
                cantidad = ?
            WHERE id_venta = ? AND id_linea = ?
        `, [notaTexto, observaciones || '', cantidadFinal, id_venta, id_linea]);

        res.json({
            success: true,
            message: 'Línea actualizada correctamente',
            nota: notaTexto,
            observaciones: observaciones || ''
        });

    } catch (error) {
        console.error('Error al actualizar línea:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Crear nueva opción
async function crearOpcion(req, res) {
    try {
        const { nombre, descripcion, orden, activo } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                success: false,
                error: 'El nombre es requerido'
            });
        }

        const [result] = await pool.query(`
            INSERT INTO opciones_producto (nombre, descripcion, orden, activo)
            VALUES (?, ?, ?, ?)
        `, [nombre.trim().toUpperCase(), descripcion || null, orden || 0, activo || 'Y']);

        res.json({
            success: true,
            message: 'Opción creada exitosamente',
            id_opcion: result.insertId
        });

    } catch (error) {
        console.error('Error al crear opción:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Actualizar opción existente
async function actualizarOpcion(req, res) {
    try {
        const { id_opcion } = req.params;
        const { nombre, descripcion, orden, activo } = req.body;

        // Construir query dinámicamente basado en campos presentes
        const updates = [];
        const values = [];

        if (nombre !== undefined) {
            updates.push('nombre = ?');
            values.push(nombre.trim().toUpperCase());
        }
        if (descripcion !== undefined) {
            updates.push('descripcion = ?');
            values.push(descripcion || null);
        }
        if (orden !== undefined) {
            updates.push('orden = ?');
            values.push(orden);
        }
        if (activo !== undefined) {
            updates.push('activo = ?');
            values.push(activo);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay campos para actualizar'
            });
        }

        values.push(id_opcion);

        await pool.query(`
            UPDATE opciones_producto
            SET ${updates.join(', ')}
            WHERE id_opcion = ?
        `, values);

        res.json({
            success: true,
            message: 'Opción actualizada exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar opción:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Eliminar opción (soft delete - solo desactivar)
async function eliminarOpcion(req, res) {
    try {
        const { id_opcion } = req.params;

        await pool.query(`
            UPDATE opciones_producto
            SET activo = 'N'
            WHERE id_opcion = ?
        `, [id_opcion]);

        res.json({
            success: true,
            message: 'Opción eliminada exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar opción:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    obtenerOpcionesProducto,
    obtenerTodasOpciones,
    actualizarLineaPedido,
    crearOpcion,
    actualizarOpcion,
    eliminarOpcion
};
