// Controlador de Pagos y Formas de Pago
const { pool } = require('../config/database');

// Obtener formas de pago disponibles
async function obtenerFormasPago(req, res) {
    try {
        const [formas] = await pool.query(`
            SELECT * FROM modo_pago
            WHERE activo = true
            ORDER BY id_modo_pago
        `);

        res.json({ success: true, formas_pago: formas });
    } catch (error) {
        console.error('Error al obtener formas de pago:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Procesar pago de venta
async function procesarPago(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            id_venta,
            id_camarero,
            pagos // Array de { id_modo_pago, importe, cambio }
        } = req.body;

        // Verificar que la venta existe y no está cerrada
        const [venta] = await connection.query(
            'SELECT * FROM ventadirecta WHERE id_venta = ?',
            [id_venta]
        );

        if (venta.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada'
            });
        }

        if (venta[0].cerrada === 'Y') {
            return res.status(400).json({
                success: false,
                error: 'Esta venta ya fue cerrada'
            });
        }

        const total_venta = parseFloat(venta[0].total);

        // Calcular total pagado
        let total_pagado = 0;
        for (const pago of pagos) {
            total_pagado += parseFloat(pago.importe);
        }

        // Verificar que el total pagado sea suficiente
        if (total_pagado < total_venta) {
            return res.status(400).json({
                success: false,
                error: `Total pagado ($${total_pagado}) es menor al total de la venta ($${total_venta})`
            });
        }

        // Registrar cada forma de pago
        for (const pago of pagos) {
            await connection.query(`
                INSERT INTO pagoscobros
                (id_venta, id_forma_pago, importe, cambio, id_camarero)
                VALUES (?, ?, ?, ?, ?)
            `, [
                id_venta,
                pago.id_modo_pago,
                pago.importe,
                pago.cambio || 0,
                id_camarero
            ]);
        }

        // Marcar venta como cerrada
        await connection.query(
            "UPDATE ventadirecta SET cerrada = 'Y' WHERE id_venta = ?",
            [id_venta]
        );

        // Generar número de ticket
        const fecha_hoy = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const numero_ticket = `T${fecha_hoy}-${id_venta}`;

        // Obtener ID de apertura actual
        const [apertura] = await connection.query(`
            SELECT id_apertura FROM apcajas
            WHERE id_caja = ? AND DATE(fecha_apertura) = CURDATE() AND cerrada = 'N'
        `, [venta[0].id_caja]);

        const id_apertura = apertura.length > 0 ? apertura[0].id_apertura : null;

        // Registrar ticket generado
        if (id_apertura) {
            await connection.query(`
                INSERT INTO tickets_generados
                (numero_ticket, id_venta, id_apertura, tipo)
                VALUES (?, ?, ?, 'venta')
            `, [numero_ticket, id_venta, id_apertura]);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Pago procesado exitosamente',
            numero_ticket,
            total_venta,
            total_pagado,
            cambio: total_pagado - total_venta
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al procesar pago:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Obtener historial de pagos de una venta
async function obtenerPagosVenta(req, res) {
    try {
        const { id_venta } = req.params;

        const [pagos] = await pool.query(`
            SELECT
                p.*,
                mp.descripcion as forma_pago,
                c.nombre as camarero
            FROM pagoscobros p
            INNER JOIN modo_pago mp ON p.id_forma_pago = mp.id_modo_pago
            INNER JOIN camareros c ON p.id_camarero = c.id_camarero
            WHERE p.id_venta = ?
            ORDER BY p.fecha_pago
        `, [id_venta]);

        const total_pagado = pagos.reduce((sum, p) => sum + parseFloat(p.importe), 0);

        res.json({
            success: true,
            pagos,
            total_pagado
        });

    } catch (error) {
        console.error('Error al obtener pagos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    obtenerFormasPago,
    procesarPago,
    obtenerPagosVenta
};
