/**
 * CONTROLADOR DE COMBINADOS Y EXTRAS
 *
 * Gestiona los 3 tipos de combinados:
 * - Tipo 1: COMBOS (elegir 1 opción - radio buttons)
 * - Tipo 2: EXTRAS GRATIS (múltiples sin costo - checkboxes)
 * - Tipo 3: EXTRAS PAGADOS (múltiples con costo - checkboxes)
 *
 * @author Claude Code
 * @date 2025-10-04 03:31 AM (Chile)
 */

const db = require('../config/database');

/**
 * Obtener todos los combinados de un producto
 */
exports.obtenerCombinadosProducto = async (req, res) => {
    try {
        const { id_producto } = req.params;

        const [combinados] = await db.execute(
            `SELECT * FROM v_combinados_producto
            WHERE id_producto_padre = ?
            ORDER BY tipo_combinado, nombre_grupo, orden`,
            [id_producto]
        );

        // Agrupar por tipo y nombre_grupo
        const agrupados = {
            combos: [],
            extras_gratis: [],
            extras_pagados: []
        };

        combinados.forEach(c => {
            const item = {
                id_combinado: c.id_combinado,
                id_producto_opcion: c.id_producto_opcion,
                producto_opcion_nombre: c.producto_opcion_nombre,
                precio_extra: parseFloat(c.precio_extra),
                nombre_grupo: c.nombre_grupo,
                orden: c.orden
            };

            switch (c.tipo_combinado) {
                case 1:
                    // Agrupar combos por nombre_grupo
                    let grupoCombos = agrupados.combos.find(g => g.nombre_grupo === c.nombre_grupo);
                    if (!grupoCombos) {
                        grupoCombos = {
                            nombre_grupo: c.nombre_grupo,
                            tipo: 'COMBO',
                            tipo_numero: 1,
                            opciones: []
                        };
                        agrupados.combos.push(grupoCombos);
                    }
                    grupoCombos.opciones.push(item);
                    break;
                case 2:
                    // Agrupar extras gratis por nombre_grupo
                    let grupoGratis = agrupados.extras_gratis.find(g => g.nombre_grupo === c.nombre_grupo);
                    if (!grupoGratis) {
                        grupoGratis = {
                            nombre_grupo: c.nombre_grupo,
                            tipo: 'EXTRA GRATIS',
                            tipo_numero: 2,
                            opciones: []
                        };
                        agrupados.extras_gratis.push(grupoGratis);
                    }
                    grupoGratis.opciones.push(item);
                    break;
                case 3:
                    // Agrupar extras pagados por nombre_grupo
                    let grupoPagados = agrupados.extras_pagados.find(g => g.nombre_grupo === c.nombre_grupo);
                    if (!grupoPagados) {
                        grupoPagados = {
                            nombre_grupo: c.nombre_grupo,
                            tipo: 'EXTRA PAGADO',
                            tipo_numero: 3,
                            opciones: []
                        };
                        agrupados.extras_pagados.push(grupoPagados);
                    }
                    grupoPagados.opciones.push(item);
                    break;
            }
        });

        res.json({
            success: true,
            tiene_combinados: combinados.length > 0,
            total: combinados.length,
            combinados: agrupados
        });
    } catch (error) {
        console.error('Error al obtener combinados:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener combinados del producto',
            error: error.message
        });
    }
};

/**
 * Obtener todas las configuraciones de combinados (para admin)
 */
exports.obtenerTodosCombinados = async (req, res) => {
    try {
        const { tipo_combinado, id_producto_padre } = req.query;

        let query = 'SELECT * FROM v_combinados_producto WHERE 1=1';
        const params = [];

        if (tipo_combinado) {
            query += ' AND tipo_combinado = ?';
            params.push(tipo_combinado);
        }

        if (id_producto_padre) {
            query += ' AND id_producto_padre = ?';
            params.push(id_producto_padre);
        }

        query += ' ORDER BY producto_padre_nombre, tipo_combinado, nombre_grupo, orden';

        const [combinados] = await db.execute(query, params);

        res.json({
            success: true,
            combinados,
            total: combinados.length
        });
    } catch (error) {
        console.error('Error al obtener combinados:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener combinados',
            error: error.message
        });
    }
};

/**
 * Crear nuevo combinado
 */
exports.crearCombinado = async (req, res) => {
    try {
        const {
            id_producto_padre,
            id_producto_opcion,
            tipo_combinado,
            precio_extra = 0,
            nombre_grupo,
            orden = 0
        } = req.body;

        if (!id_producto_padre || !id_producto_opcion || !tipo_combinado) {
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros: id_producto_padre, id_producto_opcion y tipo_combinado son requeridos'
            });
        }

        if (![1, 2, 3].includes(tipo_combinado)) {
            return res.status(400).json({
                success: false,
                message: 'tipo_combinado debe ser 1 (COMBO), 2 (EXTRA GRATIS) o 3 (EXTRA PAGADO)'
            });
        }

        // Si es tipo 2 (EXTRA GRATIS), forzar precio_extra a 0
        const precioFinal = tipo_combinado === 2 ? 0 : parseFloat(precio_extra);

        const [result] = await db.execute(
            `INSERT INTO combinados (
                id_producto_padre,
                id_producto_opcion,
                tipo_combinado,
                precio_extra,
                nombre_grupo,
                orden
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            [id_producto_padre, id_producto_opcion, tipo_combinado, precioFinal, nombre_grupo, orden]
        );

        res.json({
            success: true,
            message: 'Combinado creado exitosamente',
            id_combinado: result.insertId
        });
    } catch (error) {
        console.error('Error al crear combinado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear combinado',
            error: error.message
        });
    }
};

/**
 * Actualizar combinado
 */
exports.actualizarCombinado = async (req, res) => {
    try {
        const { id_combinado } = req.params;
        const {
            id_producto_opcion,
            tipo_combinado,
            precio_extra,
            nombre_grupo,
            orden,
            activo
        } = req.body;

        const updates = [];
        const values = [];

        if (id_producto_opcion !== undefined) {
            updates.push('id_producto_opcion = ?');
            values.push(id_producto_opcion);
        }

        if (tipo_combinado !== undefined) {
            if (![1, 2, 3].includes(tipo_combinado)) {
                return res.status(400).json({
                    success: false,
                    message: 'tipo_combinado debe ser 1, 2 o 3'
                });
            }
            updates.push('tipo_combinado = ?');
            values.push(tipo_combinado);
        }

        if (precio_extra !== undefined) {
            updates.push('precio_extra = ?');
            values.push(parseFloat(precio_extra));
        }

        if (nombre_grupo !== undefined) {
            updates.push('nombre_grupo = ?');
            values.push(nombre_grupo);
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
                message: 'No se proporcionaron campos para actualizar'
            });
        }

        values.push(id_combinado);

        await db.execute(
            `UPDATE combinados SET ${updates.join(', ')} WHERE id_combinado = ?`,
            values
        );

        res.json({
            success: true,
            message: 'Combinado actualizado exitosamente'
        });
    } catch (error) {
        console.error('Error al actualizar combinado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar combinado',
            error: error.message
        });
    }
};

/**
 * Eliminar combinado (soft delete)
 */
exports.eliminarCombinado = async (req, res) => {
    try {
        const { id_combinado } = req.params;

        await db.execute(
            'UPDATE combinados SET activo = ? WHERE id_combinado = ?',
            ['N', id_combinado]
        );

        res.json({
            success: true,
            message: 'Combinado eliminado exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar combinado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar combinado',
            error: error.message
        });
    }
};

/**
 * Agregar combinado a línea de venta (usa stored procedure)
 */
exports.agregarCombinadoVenta = async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            id_linea,
            combinados_seleccionados // Array de {id_combinado, id_producto_opcion}
        } = req.body;

        if (!id_linea || !Array.isArray(combinados_seleccionados)) {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                message: 'Faltan parámetros: id_linea y combinados_seleccionados (array) son requeridos'
            });
        }

        // Agregar cada combinado usando el stored procedure
        for (const combinado of combinados_seleccionados) {
            await connection.execute(
                'CALL sp_agregar_combinado_venta(?, ?, ?)',
                [id_linea, combinado.id_combinado, combinado.id_producto_opcion]
            );
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Combinados agregados exitosamente',
            total_agregados: combinados_seleccionados.length
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error al agregar combinados:', error);
        res.status(500).json({
            success: false,
            message: 'Error al agregar combinados a la venta',
            error: error.message
        });
    } finally {
        connection.release();
    }
};

/**
 * Obtener combinados de una línea de venta
 */
exports.obtenerCombinadosLinea = async (req, res) => {
    try {
        const { id_linea } = req.params;

        const [combinados] = await db.execute(
            `SELECT * FROM v_venta_combinados_detalle
            WHERE id_linea = ?
            ORDER BY tipo_combinado, nombre_grupo`,
            [id_linea]
        );

        res.json({
            success: true,
            combinados,
            total: combinados.length
        });
    } catch (error) {
        console.error('Error al obtener combinados de línea:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener combinados de la línea',
            error: error.message
        });
    }
};

/**
 * Eliminar combinado de una línea de venta
 */
exports.eliminarCombinadoLinea = async (req, res) => {
    try {
        const { id_venta_combinado } = req.params;

        await db.execute(
            'DELETE FROM venta_combinados WHERE id_venta_combinado = ?',
            [id_venta_combinado]
        );

        res.json({
            success: true,
            message: 'Combinado eliminado de la línea exitosamente'
        });
    } catch (error) {
        console.error('Error al eliminar combinado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar combinado de la línea',
            error: error.message
        });
    }
};

/**
 * Obtener estadísticas de combinados
 */
exports.obtenerEstadisticas = async (req, res) => {
    try {
        // Total de combinados por tipo
        const [porTipo] = await db.execute(
            `SELECT
                tipo_combinado,
                CASE tipo_combinado
                    WHEN 1 THEN 'COMBOS'
                    WHEN 2 THEN 'EXTRAS GRATIS'
                    WHEN 3 THEN 'EXTRAS PAGADOS'
                END as tipo_nombre,
                COUNT(*) as total
            FROM combinados
            WHERE activo = 'Y'
            GROUP BY tipo_combinado
            ORDER BY tipo_combinado`
        );

        // Productos con más combinados
        const [productosMas] = await db.execute(
            `SELECT
                p.id_producto,
                p.nombre as producto_nombre,
                COUNT(c.id_combinado) as total_combinados
            FROM productos p
            INNER JOIN combinados c ON p.id_producto = c.id_producto_padre
            WHERE c.activo = 'Y' AND p.activo = 'Y'
            GROUP BY p.id_producto, p.nombre
            ORDER BY total_combinados DESC
            LIMIT 10`
        );

        // Combinados más usados en ventas (últimos 30 días)
        const [masUsados] = await db.execute(
            `SELECT
                c.id_combinado,
                p_padre.nombre as producto_padre,
                p_opcion.nombre as producto_opcion,
                c.tipo_combinado,
                c.nombre_grupo,
                COUNT(vc.id_venta_combinado) as veces_usado
            FROM venta_combinados vc
            INNER JOIN combinados c ON vc.id_combinado = c.id_combinado
            INNER JOIN productos p_padre ON c.id_producto_padre = p_padre.id_producto
            INNER JOIN productos p_opcion ON c.id_producto_opcion = p_opcion.id_producto
            WHERE vc.fecha_registro >= DATE_SUB(NOW(), INTERVAL 30 DAY)
            GROUP BY c.id_combinado, p_padre.nombre, p_opcion.nombre, c.tipo_combinado, c.nombre_grupo
            ORDER BY veces_usado DESC
            LIMIT 10`
        );

        res.json({
            success: true,
            estadisticas: {
                por_tipo: porTipo,
                productos_mas_combinados: productosMas,
                combinados_mas_usados: masUsados
            }
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estadísticas de combinados',
            error: error.message
        });
    }
};
