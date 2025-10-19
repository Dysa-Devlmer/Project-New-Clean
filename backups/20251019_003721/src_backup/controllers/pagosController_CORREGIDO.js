// Controlador de Pagos y Formas de Pago - SISTEMA REAL COMPLETAMENTE CORREGIDO
const { pool } = require('../config/database');

// Obtener formas de pago disponibles - CORREGIDO
async function obtenerFormasPago(req, res) {
    try {
        const [formas] = await pool.query(`
            SELECT
                id,
                codigo_forma_pago,
                nombre_forma_pago,
                descripcion_completa,
                tipo_pago,
                aplica_comision,
                porcentaje_comision,
                permite_vuelto,
                acepta_pagos_parciales,
                monto_minimo,
                monto_maximo
            FROM formas_pago
            WHERE activa = 1
            ORDER BY nombre_forma_pago
        `);

        res.json({ success: true, formas_pago: formas });
    } catch (error) {
        console.error('Error al obtener formas de pago:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Procesar pago de venta - COMPLETAMENTE REESCRITO PARA ESQUEMA REAL
async function procesarPago(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            venta_id,
            empleado_cajero_id,
            terminal_id = 1,
            pagos // Array de { forma_pago_id, monto_pago, monto_recibido, observaciones }
        } = req.body;

        // Validaciones de entrada
        if (!venta_id || !empleado_cajero_id || !pagos || pagos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Datos requeridos: venta_id, empleado_cajero_id, pagos'
            });
        }

        // Verificar que la venta existe y puede ser procesada
        const [venta] = await connection.query(
            'SELECT * FROM ventas_principales WHERE id = ?',
            [venta_id]
        );

        if (venta.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Venta no encontrada'
            });
        }

        if (venta[0].estado_venta === 'PAGADA' || venta[0].estado_venta === 'CERRADA') {
            return res.status(400).json({
                success: false,
                error: 'Esta venta ya fue procesada'
            });
        }

        const total_venta = parseFloat(venta[0].total_final);

        // Calcular total pagado y validar formas de pago
        let total_pagado = 0;
        let total_comisiones = 0;

        for (const pago of pagos) {
            // Verificar que la forma de pago existe
            const [formaPago] = await connection.query(
                'SELECT * FROM formas_pago WHERE id = ? AND activa = 1',
                [pago.forma_pago_id]
            );

            if (formaPago.length === 0) {
                return res.status(400).json({
                    success: false,
                    error: `Forma de pago ${pago.forma_pago_id} no válida`
                });
            }

            const monto_pago = parseFloat(pago.monto_pago);
            total_pagado += monto_pago;

            // Calcular comisión si aplica
            if (formaPago[0].aplica_comision) {
                const comision = monto_pago * parseFloat(formaPago[0].porcentaje_comision);
                total_comisiones += comision;
            }
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
            const fecha_actual = new Date();
            const numero_pago = `P${fecha_actual.getFullYear()}${String(fecha_actual.getMonth() + 1).padStart(2, '0')}${String(fecha_actual.getDate()).padStart(2, '0')}-${venta_id}-${Date.now()}`;

            // Obtener datos de la forma de pago para cálculos
            const [formaPago] = await connection.query(
                'SELECT * FROM formas_pago WHERE id = ?',
                [pago.forma_pago_id]
            );

            const monto_pago = parseFloat(pago.monto_pago);
            const monto_recibido = parseFloat(pago.monto_recibido || monto_pago);
            const vuelto = Math.max(0, monto_recibido - monto_pago);
            const porcentaje_comision = parseFloat(formaPago[0].porcentaje_comision || 0);
            const monto_comision = formaPago[0].aplica_comision ? monto_pago * porcentaje_comision : 0;
            const monto_neto = monto_pago - monto_comision;

            await connection.query(`
                INSERT INTO pagos_ventas
                (numero_pago, venta_id, forma_pago_id, monto_pago, monto_recibido, vuelto_entregado,
                 porcentaje_comision, monto_comision, monto_neto, empleado_cajero_id, terminal_pago_id,
                 observaciones_pago, estado_pago, fecha_procesamiento)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APROBADO', CURRENT_TIMESTAMP)
            `, [
                numero_pago, venta_id, pago.forma_pago_id, monto_pago, monto_recibido, vuelto,
                porcentaje_comision, monto_comision, monto_neto, empleado_cajero_id, terminal_id,
                pago.observaciones || null
            ]);

            // Registrar en movimientos de caja si existe apertura activa
            const [apertura] = await connection.query(`
                SELECT id_apcajas FROM apcajas
                WHERE DATE(fecha_apertura) = CURDATE() AND abierta = 'S'
                LIMIT 1
            `);

            if (apertura.length > 0) {
                const metodo_pago = formaPago[0].tipo_pago.toLowerCase().includes('efectivo') ? 'efectivo' :
                                 formaPago[0].tipo_pago.toLowerCase().includes('tarjeta') ? 'tarjeta' :
                                 formaPago[0].tipo_pago.toLowerCase().includes('transferencia') ? 'transferencia' : 'otro';

                await connection.query(`
                    INSERT INTO movimientos_caja
                    (id_apcaja, id_venta, tipo_movimiento, monto, metodo_pago, descripcion, id_empleado)
                    VALUES (?, ?, 'venta', ?, ?, ?, ?)
                `, [
                    apertura[0].id_apcajas, venta_id, monto_neto, metodo_pago,
                    `Venta ${venta[0].numero_venta} - ${formaPago[0].nombre_forma_pago}`, empleado_cajero_id
                ]);
            }
        }

        // Marcar venta como pagada/cerrada
        await connection.query(
            "UPDATE ventas_principales SET estado_venta = 'PAGADA', timestamp_cierre = CURRENT_TIMESTAMP WHERE id = ?",
            [venta_id]
        );

        await connection.commit();

        // Generar número de ticket
        const numero_ticket = `T${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${venta_id}`;

        res.json({
            success: true,
            message: 'Pago procesado exitosamente',
            numero_ticket,
            venta_id,
            total_pagado,
            total_comisiones,
            vuelto_total: total_pagado - total_venta,
            estado_venta: 'PAGADA'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al procesar pago:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Obtener pagos de una venta específica - CORREGIDO
async function obtenerPagosVenta(req, res) {
    try {
        const { venta_id } = req.params;

        const [pagos] = await pool.query(`
            SELECT
                p.id,
                p.numero_pago,
                p.monto_pago,
                p.monto_recibido,
                p.vuelto_entregado,
                p.monto_comision,
                p.monto_neto,
                p.estado_pago,
                p.fecha_procesamiento,
                p.observaciones_pago,
                fp.nombre_forma_pago,
                fp.tipo_pago,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as empleado_cajero
            FROM pagos_ventas p
            INNER JOIN formas_pago fp ON p.forma_pago_id = fp.id
            INNER JOIN empleados e ON p.empleado_cajero_id = e.id
            WHERE p.venta_id = ?
            ORDER BY p.fecha_procesamiento
        `, [venta_id]);

        const total_pagado = pagos.reduce((sum, p) => sum + parseFloat(p.monto_pago), 0);

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