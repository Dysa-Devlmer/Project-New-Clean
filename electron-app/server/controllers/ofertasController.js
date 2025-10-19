const { pool } = require('../config/database');

/**
 * CONTROLADOR DE OFERTAS Y PROMOCIONES
 * Maneja todas las operaciones relacionadas con ofertas, promociones y descuentos
 */

// Obtener todas las ofertas activas
const obtenerOfertasActivas = async (req, res) => {
    try {
        const [ofertas] = await pool.query(`
            SELECT
                o.*,
                DATE_FORMAT(o.fecha_inicio, '%Y-%m-%d') as fecha_inicio_format,
                DATE_FORMAT(o.fecha_fin, '%Y-%m-%d') as fecha_fin_format,
                CASE
                    WHEN CURDATE() BETWEEN o.fecha_inicio AND o.fecha_fin THEN 'vigente'
                    WHEN CURDATE() < o.fecha_inicio THEN 'proxima'
                    ELSE 'vencida'
                END as estado_vigencia
            FROM ofertas o
            WHERE o.activo = 'Y'
            ORDER BY o.prioridad ASC, o.fecha_inicio DESC
        `);

        res.json({
            success: true,
            data: ofertas
        });
    } catch (error) {
        console.error('Error al obtener ofertas activas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener ofertas vigentes (que se pueden aplicar ahora)
const obtenerOfertasVigentes = async (req, res) => {
    try {
        const ahora = new Date();
        const fecha_actual = ahora.toISOString().split('T')[0];
        const hora_actual = ahora.toTimeString().split(' ')[0];
        const dias_semana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
        const dia_actual = dias_semana[ahora.getDay()];

        const [ofertas] = await pool.query(`
            SELECT
                o.*,
                es_oferta_vigente(o.id_oferta, ?, ?, ?) as esta_vigente
            FROM ofertas o
            WHERE o.activo = 'Y'
              AND ? BETWEEN o.fecha_inicio AND o.fecha_fin
              AND (o.hora_inicio IS NULL OR ? >= o.hora_inicio)
              AND (o.hora_fin IS NULL OR ? <= o.hora_fin)
              AND (o.dias_semana IS NULL OR JSON_CONTAINS(o.dias_semana, ?))
            ORDER BY o.prioridad ASC
        `, [fecha_actual, hora_actual, dia_actual, fecha_actual, hora_actual, hora_actual, JSON.stringify(dia_actual)]);

        res.json({
            success: true,
            data: ofertas.filter(o => o.esta_vigente),
            fecha_actual,
            hora_actual,
            dia_actual
        });
    } catch (error) {
        console.error('Error al obtener ofertas vigentes:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener detalles de una oferta específica
const obtenerOferta = async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener datos de la oferta
        const [oferta] = await pool.query(`
            SELECT * FROM ofertas WHERE id_oferta = ?
        `, [id]);

        if (oferta.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Oferta no encontrada'
            });
        }

        // Obtener productos incluidos
        const [productos] = await pool.query(`
            SELECT
                op.*,
                c.alias as nombre_producto,
                c.precio as precio_normal
            FROM oferta_productos op
            INNER JOIN complementog c ON op.id_complementog = c.id_complementog
            WHERE op.id_oferta = ?
        `, [id]);

        // Obtener categorías incluidas
        const [categorias] = await pool.query(`
            SELECT
                oc.*,
                tc.descripcion as nombre_categoria
            FROM oferta_categorias oc
            INNER JOIN tipo_comg tc ON oc.id_categoria = tc.id_tipo_comg
            WHERE oc.id_oferta = ?
        `, [id]);

        res.json({
            success: true,
            data: {
                ...oferta[0],
                productos,
                categorias
            }
        });
    } catch (error) {
        console.error('Error al obtener oferta:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Crear nueva oferta
const crearOferta = async (req, res) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const {
            nombre, descripcion, tipo_oferta, valor_descuento, precio_especial,
            fecha_inicio, fecha_fin, hora_inicio, hora_fin, dias_semana,
            cantidad_minima, cantidad_maxima, monto_minimo_venta,
            usa_limite_diario, limite_diario, usa_limite_cliente, limite_cliente,
            prioridad, productos = [], categorias = []
        } = req.body;

        // Insertar oferta principal
        const [result] = await conn.execute(`
            INSERT INTO ofertas (
                nombre, descripcion, tipo_oferta, valor_descuento, precio_especial,
                fecha_inicio, fecha_fin, hora_inicio, hora_fin, dias_semana,
                cantidad_minima, cantidad_maxima, monto_minimo_venta,
                usa_limite_diario, limite_diario, usa_limite_cliente, limite_cliente,
                prioridad, activo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Y')
        `, [
            nombre, descripcion, tipo_oferta, valor_descuento, precio_especial,
            fecha_inicio, fecha_fin, hora_inicio, hora_fin, dias_semana ? JSON.stringify(dias_semana) : null,
            cantidad_minima, cantidad_maxima, monto_minimo_venta,
            usa_limite_diario, limite_diario, usa_limite_cliente, limite_cliente,
            prioridad
        ]);

        const id_oferta = result.insertId;

        // Insertar productos asociados
        for (const producto of productos) {
            await conn.execute(`
                INSERT INTO oferta_productos (id_oferta, id_complementog, es_requerido, cantidad_oferta)
                VALUES (?, ?, ?, ?)
            `, [id_oferta, producto.id_complementog, producto.es_requerido || 'N', producto.cantidad_oferta || 1]);
        }

        // Insertar categorías asociadas
        for (const categoria of categorias) {
            await conn.execute(`
                INSERT INTO oferta_categorias (id_oferta, id_categoria)
                VALUES (?, ?)
            `, [id_oferta, categoria.id_categoria]);
        }

        await conn.commit();

        res.status(201).json({
            success: true,
            message: 'Oferta creada exitosamente',
            data: { id_oferta }
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error al crear oferta:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear oferta',
            error: error.message
        });
    } finally {
        conn.release();
    }
};

// Aplicar ofertas a una venta
const aplicarOfertasVenta = async (req, res) => {
    try {
        const { id_venta } = req.body;

        // Llamar al procedimiento almacenado
        await pool.query(`CALL aplicar_ofertas_venta(?, @descuento_total, @ofertas_aplicadas, @resultado)`, [id_venta]);

        const [output] = await pool.query(`
            SELECT @descuento_total as descuento_total, @ofertas_aplicadas as ofertas_aplicadas, @resultado as resultado
        `);

        const resultado = output[0];

        res.json({
            success: true,
            message: resultado.resultado,
            data: {
                descuento_total: parseFloat(resultado.descuento_total) || 0,
                ofertas_aplicadas: parseInt(resultado.ofertas_aplicadas) || 0
            }
        });
    } catch (error) {
        console.error('Error al aplicar ofertas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al aplicar ofertas',
            error: error.message
        });
    }
};

// Obtener ofertas aplicadas a una venta
const obtenerOfertasVenta = async (req, res) => {
    try {
        const { id_venta } = req.params;

        const [ofertas] = await pool.query(`
            SELECT
                vo.*,
                o.nombre as nombre_oferta,
                o.tipo_oferta,
                o.descripcion
            FROM venta_ofertas vo
            INNER JOIN ofertas o ON vo.id_oferta = o.id_oferta
            WHERE vo.id_venta = ?
            ORDER BY vo.fecha_aplicacion DESC
        `, [id_venta]);

        res.json({
            success: true,
            data: ofertas
        });
    } catch (error) {
        console.error('Error al obtener ofertas de venta:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Desactivar oferta
const desactivarOferta = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(`
            UPDATE ofertas SET activo = 'N' WHERE id_oferta = ?
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Oferta no encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Oferta desactivada exitosamente'
        });
    } catch (error) {
        console.error('Error al desactivar oferta:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Estadísticas de uso de ofertas
const obtenerEstadisticasOfertas = async (req, res) => {
    try {
        const { fecha_inicio, fecha_fin } = req.query;

        let whereClause = '';
        let params = [];

        if (fecha_inicio && fecha_fin) {
            whereClause = 'WHERE vo.fecha_aplicacion BETWEEN ? AND ?';
            params = [fecha_inicio, fecha_fin];
        }

        const [estadisticas] = await pool.query(`
            SELECT
                o.id_oferta,
                o.nombre,
                o.tipo_oferta,
                COUNT(vo.id) as total_usos,
                SUM(vo.descuento_aplicado) as descuento_total,
                AVG(vo.descuento_aplicado) as descuento_promedio,
                MIN(vo.fecha_aplicacion) as primera_aplicacion,
                MAX(vo.fecha_aplicacion) as ultima_aplicacion
            FROM ofertas o
            LEFT JOIN venta_ofertas vo ON o.id_oferta = vo.id_oferta
            ${whereClause}
            GROUP BY o.id_oferta, o.nombre, o.tipo_oferta
            ORDER BY total_usos DESC, descuento_total DESC
        `, params);

        res.json({
            success: true,
            data: estadisticas
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = {
    obtenerOfertasActivas,
    obtenerOfertasVigentes,
    obtenerOferta,
    crearOferta,
    aplicarOfertasVenta,
    obtenerOfertasVenta,
    desactivarOferta,
    obtenerEstadisticasOfertas
};