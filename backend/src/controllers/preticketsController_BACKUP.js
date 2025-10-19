const { pool } = require('../config/database');

/**
 * CONTROLADOR DE PRE-TICKETS
 * Maneja la funcionalidad de tickets temporales antes de confirmar
 */

// Obtener todos los pre-tickets activos
const obtenerPretickets = async (req, res) => {
    try {
        const { mesa, estado } = req.query;

        let query = `
            SELECT
                vp.id_preticket,
                vp.Num_Mesa,
                vp.id_camarero,
                c.nombre as nombre_camarero,
                vp.total,
                vp.estado,
                vp.observaciones,
                vp.fecha_creacion,
                vp.fecha_confirmacion,
                vp.id_tarifa,
                vp.nombre_tarifa,
                m.descripcion as descripcion_mesa
            FROM venta_preticket vp
            INNER JOIN camareros c ON vp.id_camarero = c.id_camarero
            INNER JOIN mesa m ON vp.Num_Mesa = m.Num_Mesa
            WHERE 1=1
        `;

        const params = [];

        if (mesa) {
            query += ' AND vp.Num_Mesa = ?';
            params.push(mesa);
        }

        if (estado) {
            query += ' AND vp.estado = ?';
            params.push(estado);
        }

        query += ' ORDER BY vp.fecha_creacion DESC';

        const [pretickets] = await pool.query(query, params);

        res.json({
            success: true,
            data: pretickets
        });

    } catch (error) {
        console.error('Error al obtener pre-tickets:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Obtener un pre-ticket específico con sus productos
const obtenerPreticket = async (req, res) => {
    try {
        const { id } = req.params;

        // Obtener datos del pre-ticket
        const [preticket] = await pool.query(`
            SELECT
                vp.*,
                c.nombre as nombre_camarero,
                m.descripcion as descripcion_mesa
            FROM venta_preticket vp
            INNER JOIN camareros c ON vp.id_camarero = c.id_camarero
            INNER JOIN mesa m ON vp.Num_Mesa = m.Num_Mesa
            WHERE vp.id_preticket = ?
        `, [id]);

        if (preticket.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pre-ticket no encontrado'
            });
        }

        // Obtener productos del pre-ticket
        const [productos] = await pool.query(`
            SELECT
                pp.*,
                cg.alias as nombre_producto,
                cg.precio as precio_base
            FROM preticket_productos pp
            INNER JOIN complementog cg ON pp.id_complementog = cg.id_complementog
            WHERE pp.id_preticket = ?
            ORDER BY pp.fecha_agregado
        `, [id]);

        res.json({
            success: true,
            data: {
                ...preticket[0],
                productos: productos
            }
        });

    } catch (error) {
        console.error('Error al obtener pre-ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Crear nuevo pre-ticket
const crearPreticket = async (req, res) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const {
            Num_Mesa,
            id_camarero,
            productos = [],
            observaciones = null,
            id_tarifa = null,
            nombre_tarifa = null
        } = req.body;

        // Validaciones básicas
        if (!Num_Mesa || !id_camarero) {
            return res.status(400).json({
                success: false,
                message: 'Mesa y camarero son requeridos'
            });
        }

        // Crear el pre-ticket
        const [result] = await conn.execute(`
            INSERT INTO venta_preticket (
                Num_Mesa, id_camarero, observaciones, id_tarifa, nombre_tarifa
            ) VALUES (?, ?, ?, ?, ?)
        `, [Num_Mesa, id_camarero, observaciones, id_tarifa, nombre_tarifa]);

        const id_preticket = result.insertId;

        // Agregar productos si se proporcionaron
        for (const producto of productos) {
            const { id_complementog, cantidad, observaciones_producto = null } = producto;

            // Obtener precio del producto según tarifa
            let precio_unitario;
            if (id_tarifa) {
                const [precioTarifa] = await conn.execute(`
                    SELECT obtener_precio_producto(?, ?) as precio
                `, [id_complementog, id_tarifa]);
                precio_unitario = precioTarifa[0].precio;
            } else {
                const [precioNormal] = await conn.execute(`
                    SELECT precio FROM complementog WHERE id_complementog = ?
                `, [id_complementog]);
                precio_unitario = precioNormal[0].precio;
            }

            const subtotal = cantidad * precio_unitario;

            await conn.execute(`
                INSERT INTO preticket_productos (
                    id_preticket, id_complementog, cantidad,
                    precio_unitario, subtotal, observaciones
                ) VALUES (?, ?, ?, ?, ?, ?)
            `, [id_preticket, id_complementog, cantidad, precio_unitario, subtotal, observaciones_producto]);
        }

        await conn.commit();

        // Obtener el pre-ticket creado completo
        const [preticketCreado] = await pool.query(`
            SELECT vp.*, c.nombre as nombre_camarero
            FROM venta_preticket vp
            INNER JOIN camareros c ON vp.id_camarero = c.id_camarero
            WHERE vp.id_preticket = ?
        `, [id_preticket]);

        res.status(201).json({
            success: true,
            message: 'Pre-ticket creado exitosamente',
            data: preticketCreado[0]
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error al crear pre-ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    } finally {
        conn.release();
    }
};

// Agregar producto a pre-ticket existente
const agregarProducto = async (req, res) => {
    try {
        const { id } = req.params;
        const { id_complementog, cantidad, observaciones = null } = req.body;

        // Verificar que el pre-ticket existe y está en borrador
        const [preticket] = await pool.query(`
            SELECT * FROM venta_preticket
            WHERE id_preticket = ? AND estado = 'BORRADOR'
        `, [id]);

        if (preticket.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pre-ticket no encontrado o ya confirmado'
            });
        }

        // Obtener precio según tarifa
        const id_tarifa = preticket[0].id_tarifa;
        let precio_unitario;

        if (id_tarifa) {
            const [precioTarifa] = await pool.query(`
                SELECT obtener_precio_producto(?, ?) as precio
            `, [id_complementog, id_tarifa]);
            precio_unitario = precioTarifa[0].precio;
        } else {
            const [precioNormal] = await pool.query(`
                SELECT precio FROM complementog WHERE id_complementog = ?
            `, [id_complementog]);
            precio_unitario = precioNormal[0].precio;
        }

        const subtotal = cantidad * precio_unitario;

        // Insertar producto
        await pool.query(`
            INSERT INTO preticket_productos (
                id_preticket, id_complementog, cantidad,
                precio_unitario, subtotal, observaciones
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [id, id_complementog, cantidad, precio_unitario, subtotal, observaciones]);

        res.json({
            success: true,
            message: 'Producto agregado exitosamente'
        });

    } catch (error) {
        console.error('Error al agregar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Confirmar pre-ticket (convertirlo en venta real)
const confirmarPreticket = async (req, res) => {
    try {
        const { id } = req.params;

        // Usar el procedimiento almacenado
        const [result] = await pool.query(`
            CALL confirmar_preticket(?, @id_venta, @resultado)
        `, [id]);

        const [output] = await pool.query(`
            SELECT @id_venta as id_venta, @resultado as resultado
        `);

        const { id_venta, resultado } = output[0];

        if (id_venta) {
            res.json({
                success: true,
                message: resultado,
                data: { id_venta }
            });
        } else {
            res.status(400).json({
                success: false,
                message: resultado
            });
        }

    } catch (error) {
        console.error('Error al confirmar pre-ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Cancelar pre-ticket
const cancelarPreticket = async (req, res) => {
    try {
        const { id } = req.params;

        const [result] = await pool.query(`
            UPDATE venta_preticket
            SET estado = 'CANCELADO'
            WHERE id_preticket = ? AND estado = 'BORRADOR'
        `, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Pre-ticket no encontrado o ya procesado'
            });
        }

        res.json({
            success: true,
            message: 'Pre-ticket cancelado exitosamente'
        });

    } catch (error) {
        console.error('Error al cancelar pre-ticket:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

// Eliminar producto de pre-ticket
const eliminarProducto = async (req, res) => {
    try {
        const { id, id_producto } = req.params;

        // Verificar que el pre-ticket está en borrador
        const [preticket] = await pool.query(`
            SELECT estado FROM venta_preticket WHERE id_preticket = ?
        `, [id]);

        if (preticket.length === 0 || preticket[0].estado !== 'BORRADOR') {
            return res.status(400).json({
                success: false,
                message: 'No se puede modificar este pre-ticket'
            });
        }

        const [result] = await pool.query(`
            DELETE FROM preticket_productos
            WHERE id = ? AND id_preticket = ?
        `, [id_producto, id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: 'Producto no encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Producto eliminado exitosamente'
        });

    } catch (error) {
        console.error('Error al eliminar producto:', error);
        res.status(500).json({
            success: false,
            message: 'Error interno del servidor',
            error: error.message
        });
    }
};

module.exports = {
    obtenerPretickets,
    obtenerPreticket,
    crearPreticket,
    agregarProducto,
    confirmarPreticket,
    cancelarPreticket,
    eliminarProducto
};