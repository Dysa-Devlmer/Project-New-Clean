// Controlador de Caja - Apertura y Cierre
const { pool } = require('../config/database');

// Abrir caja del día
async function abrirCaja(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_caja, id_camarero, monto_inicial, observaciones } = req.body;

        // Verificar si ya hay apertura del día
        const fecha_hoy = new Date().toISOString().split('T')[0];
        const [aperturaExistente] = await connection.query(`
            SELECT * FROM apcajas
            WHERE id_caja = ? AND fecha_apertura = ? AND cerrada = 'N'
        `, [id_caja, fecha_hoy]);

        if (aperturaExistente.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe una apertura de caja para hoy'
            });
        }

        // Crear apertura
        const hora_actual = new Date().toTimeString().split(' ')[0];
        const [result] = await connection.query(`
            INSERT INTO apcajas
            (id_caja, id_camarero, fecha_apertura, hora_apertura, monto_inicial, observaciones, cerrada)
            VALUES (?, ?, ?, ?, ?, ?, 'N')
        `, [id_caja, id_camarero, fecha_hoy, hora_actual, monto_inicial, observaciones]);

        const id_apertura = result.insertId;

        await connection.commit();

        res.json({
            success: true,
            message: 'Caja abierta exitosamente',
            id_apertura,
            fecha: fecha_hoy,
            hora: hora_actual,
            monto_inicial
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al abrir caja:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Cerrar caja (Z-Report)
async function cerrarCaja(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_apertura, id_camarero, total_real, observaciones } = req.body;

        // Obtener datos de la apertura
        const [apertura] = await connection.query(
            'SELECT * FROM apcajas WHERE id_apertura = ?',
            [id_apertura]
        );

        if (apertura.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Apertura no encontrada'
            });
        }

        if (apertura[0].cerrada === 'Y') {
            return res.status(400).json({
                success: false,
                error: 'Esta caja ya fue cerrada'
            });
        }

        const id_caja = apertura[0].id_caja;
        const monto_inicial = apertura[0].monto_inicial;

        // Calcular totales de ventas del día
        const [ventasDelDia] = await connection.query(`
            SELECT
                COUNT(*) as numero_ventas,
                SUM(total) as total_ventas
            FROM ventadirecta
            WHERE id_caja = ?
            AND DATE(fecha_venta) = ?
            AND cerrada = 'Y'
        `, [id_caja, apertura[0].fecha_apertura]);

        const numero_ventas = ventasDelDia[0].numero_ventas || 0;
        const total_ventas = parseFloat(ventasDelDia[0].total_ventas) || 0;

        // Calcular totales por forma de pago
        const [pagos] = await connection.query(`
            SELECT
                mp.descripcion,
                SUM(p.importe) as total
            FROM pagoscobros p
            INNER JOIN modo_pago mp ON p.id_forma_pago = mp.id_modo_pago
            INNER JOIN ventadirecta v ON p.id_venta = v.id_venta
            WHERE v.id_caja = ?
            AND DATE(p.fecha_pago) = ?
            GROUP BY mp.descripcion
        `, [id_caja, apertura[0].fecha_apertura]);

        let total_efectivo = 0;
        let total_tarjeta = 0;
        let total_transferencia = 0;
        let total_otros = 0;

        pagos.forEach(pago => {
            const total = parseFloat(pago.total);
            if (pago.descripcion.toLowerCase().includes('efectivo')) {
                total_efectivo += total;
            } else if (pago.descripcion.toLowerCase().includes('tarjeta') ||
                       pago.descripcion.toLowerCase().includes('débito') ||
                       pago.descripcion.toLowerCase().includes('crédito')) {
                total_tarjeta += total;
            } else if (pago.descripcion.toLowerCase().includes('transferencia')) {
                total_transferencia += total;
            } else {
                total_otros += total;
            }
        });

        const total_esperado = monto_inicial + total_efectivo;
        const diferencia = total_real - total_esperado;

        const fecha_cierre = new Date().toISOString().split('T')[0];
        const hora_cierre = new Date().toTimeString().split(' ')[0];

        // Crear registro de cierre Z
        const [resultZ] = await connection.query(`
            INSERT INTO registroz
            (id_apertura, id_caja, id_camarero, fecha_cierre, hora_cierre,
             monto_inicial, total_ventas, total_efectivo, total_tarjeta,
             total_transferencia, total_otros, total_esperado, total_real,
             diferencia, numero_ventas, observaciones)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            id_apertura, id_caja, id_camarero, fecha_cierre, hora_cierre,
            monto_inicial, total_ventas, total_efectivo, total_tarjeta,
            total_transferencia, total_otros, total_esperado, total_real,
            diferencia, numero_ventas, observaciones
        ]);

        // Marcar apertura como cerrada
        await connection.query(
            "UPDATE apcajas SET cerrada = 'Y' WHERE id_apertura = ?",
            [id_apertura]
        );

        await connection.commit();

        res.json({
            success: true,
            message: 'Caja cerrada exitosamente',
            id_cierre: resultZ.insertId,
            datos_cierre: {
                fecha: fecha_cierre,
                hora: hora_cierre,
                monto_inicial,
                total_ventas,
                total_efectivo,
                total_tarjeta,
                total_transferencia,
                total_otros,
                numero_ventas,
                total_esperado,
                total_real,
                diferencia
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al cerrar caja:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Obtener apertura actual
async function obtenerAperturaActual(req, res) {
    try {
        const { id_caja } = req.params;
        const fecha_hoy = new Date().toISOString().split('T')[0];

        const [apertura] = await pool.query(`
            SELECT
                a.*,
                c.nombre as nombre_camarero
            FROM apcajas a
            INNER JOIN camareros c ON a.id_camarero = c.id_camarero
            WHERE a.id_caja = ?
            AND a.fecha_apertura = ?
            AND a.cerrada = 'N'
        `, [id_caja, fecha_hoy]);

        if (apertura.length === 0) {
            return res.json({
                success: true,
                apertura_activa: false
            });
        }

        res.json({
            success: true,
            apertura_activa: true,
            apertura: apertura[0]
        });

    } catch (error) {
        console.error('Error al obtener apertura:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener ventas del día en tiempo real
async function obtenerVentasDelDia(req, res) {
    try {
        const { id_caja } = req.params;
        const fecha_hoy = new Date().toISOString().split('T')[0];

        const [ventas] = await pool.query(`
            SELECT
                COUNT(*) as numero_ventas,
                SUM(total) as total_ventas,
                AVG(total) as ticket_promedio,
                COUNT(DISTINCT Num_Mesa) as mesas_atendidas
            FROM ventadirecta
            WHERE id_caja = ?
            AND DATE(fecha_venta) = ?
        `, [id_caja, fecha_hoy]);

        const [porFormaPago] = await pool.query(`
            SELECT
                mp.descripcion as forma_pago,
                COUNT(DISTINCT p.id_venta) as numero_ventas,
                SUM(p.importe) as total_importe
            FROM pagoscobros p
            INNER JOIN modo_pago mp ON p.id_forma_pago = mp.id_modo_pago
            INNER JOIN ventadirecta v ON p.id_venta = v.id_venta
            WHERE v.id_caja = ?
            AND DATE(p.fecha_pago) = ?
            GROUP BY mp.descripcion
        `, [id_caja, fecha_hoy]);

        res.json({
            success: true,
            ventas: ventas[0],
            formas_pago: porFormaPago
        });

    } catch (error) {
        console.error('Error al obtener ventas del día:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    abrirCaja,
    cerrarCaja,
    obtenerAperturaActual,
    obtenerVentasDelDia
};
