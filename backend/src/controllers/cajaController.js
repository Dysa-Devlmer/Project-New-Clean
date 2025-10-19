// Controlador de Caja - SISTEMA REAL CORREGIDO
const { pool } = require('../config/database');

// Abrir caja del día
async function abrirCaja(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_caja, id_empleado, monto_inicial, observaciones } = req.body;

        // Validaciones
        if (!id_caja || !id_empleado || monto_inicial === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Datos requeridos: id_caja, id_empleado, monto_inicial'
            });
        }

        // Verificar si ya hay apertura del día
        const fecha_hoy = new Date().toISOString().split('T')[0];
        const [aperturaExistente] = await connection.query(`
            SELECT * FROM apcajas
            WHERE id_caja = ? AND DATE(fecha_apertura) = ? AND abierta = 'S'
        `, [id_caja, fecha_hoy]);

        if (aperturaExistente.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe una apertura de caja para hoy',
                apertura_existente: aperturaExistente[0].id_apcajas
            });
        }

        // Crear apertura
        const [result] = await connection.query(`
            INSERT INTO apcajas
            (id_caja, id_empleado_apertura, monto_inicial, observaciones_apertura, abierta, estado)
            VALUES (?, ?, ?, ?, 'S', 'activa')
        `, [id_caja, id_empleado, monto_inicial, observaciones]);

        const id_apertura = result.insertId;

        // Registrar movimiento de apertura
        await connection.query(`
            INSERT INTO movimientos_caja
            (id_apcaja, tipo_movimiento, monto, metodo_pago, descripcion, id_empleado)
            VALUES (?, 'ingreso', ?, 'efectivo', 'Apertura de caja', ?)
        `, [id_apertura, monto_inicial, id_empleado]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Caja abierta exitosamente',
            id_apertura,
            fecha: fecha_hoy,
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

// Cerrar caja (Z-Report) - CORREGIDO
async function cerrarCaja(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_apertura, id_empleado, monto_final, observaciones } = req.body;

        // Validaciones
        if (!id_apertura || !id_empleado || monto_final === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Datos requeridos: id_apertura, id_empleado, monto_final'
            });
        }

        // Obtener datos de la apertura (PK corregido)
        const [apertura] = await connection.query(
            'SELECT * FROM apcajas WHERE id_apcajas = ?',
            [id_apertura]
        );

        if (apertura.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Apertura no encontrada'
            });
        }

        if (apertura[0].abierta === 'N') {
            return res.status(400).json({
                success: false,
                error: 'Esta caja ya fue cerrada'
            });
        }

        const id_caja = apertura[0].id_caja;
        const monto_inicial = apertura[0].monto_inicial;

        // Calcular totales de movimientos del día
        const [movimientos] = await connection.query(`
            SELECT
                tipo_movimiento,
                metodo_pago,
                SUM(monto) as total_monto,
                COUNT(*) as cantidad
            FROM movimientos_caja
            WHERE id_apcaja = ?
            GROUP BY tipo_movimiento, metodo_pago
        `, [id_apertura]);

        let total_ventas = 0;
        let total_efectivo = 0;
        let total_tarjeta = 0;
        let total_transferencia = 0;
        let total_otros = 0;
        let numero_ventas = 0;

        movimientos.forEach(mov => {
            const monto = parseFloat(mov.total_monto);

            if (mov.tipo_movimiento === 'venta') {
                total_ventas += monto;
                numero_ventas += mov.cantidad;

                if (mov.metodo_pago === 'efectivo') {
                    total_efectivo += monto;
                } else if (mov.metodo_pago === 'tarjeta') {
                    total_tarjeta += monto;
                } else if (mov.metodo_pago === 'transferencia') {
                    total_transferencia += monto;
                } else {
                    total_otros += monto;
                }
            }
        });

        const total_sistema = parseFloat(monto_inicial) + total_efectivo;
        const diferencia = monto_final - total_sistema;

        // Marcar como cerrada y actualizar datos
        await connection.query(`
            UPDATE apcajas
            SET abierta = 'N',
                fecha_cierre = CURRENT_TIMESTAMP,
                monto_final = ?,
                monto_sistema = ?,
                diferencia = ?,
                id_empleado_cierre = ?,
                observaciones_cierre = ?,
                numero_movimientos = (SELECT COUNT(*) FROM movimientos_caja WHERE id_apcaja = ?),
                estado = CASE
                    WHEN ABS(?) < 0.01 THEN 'cuadrada'
                    ELSE 'con_diferencia'
                END
            WHERE id_apcajas = ?
        `, [monto_final, total_sistema, diferencia, id_empleado, observaciones, id_apertura, diferencia, id_apertura]);

        // Registrar cierre como movimiento
        await connection.query(`
            INSERT INTO movimientos_caja
            (id_apcaja, tipo_movimiento, monto, metodo_pago, descripcion, id_empleado)
            VALUES (?, 'egreso', ?, 'efectivo', 'Cierre de caja', ?)
        `, [id_apertura, monto_final, id_empleado]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Caja cerrada exitosamente',
            datos_cierre: {
                id_apertura,
                monto_inicial,
                total_ventas,
                total_efectivo,
                total_tarjeta,
                total_transferencia,
                total_otros,
                numero_ventas,
                monto_sistema: total_sistema,
                monto_final,
                diferencia,
                estado: Math.abs(diferencia) < 0.01 ? 'cuadrada' : 'con_diferencia'
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

// Obtener apertura actual - CORREGIDO
async function obtenerAperturaActual(req, res) {
    try {
        const { id_caja } = req.params;
        const fecha_hoy = new Date().toISOString().split('T')[0];

        const [apertura] = await pool.query(`
            SELECT
                a.*,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado
            FROM apcajas a
            INNER JOIN empleados e ON a.id_empleado_apertura = e.id
            WHERE a.id_caja = ?
            AND DATE(a.fecha_apertura) = ?
            AND a.abierta = 'S'
        `, [id_caja, fecha_hoy]);

        if (apertura.length === 0) {
            return res.json({
                success: true,
                apertura_activa: false,
                mensaje: 'No hay apertura activa para hoy'
            });
        }

        // Obtener estadísticas del día
        const [movimientos] = await pool.query(`
            SELECT
                COUNT(*) as total_movimientos,
                SUM(CASE WHEN tipo_movimiento = 'venta' THEN monto ELSE 0 END) as total_ventas,
                SUM(CASE WHEN tipo_movimiento = 'venta' AND metodo_pago = 'efectivo' THEN monto ELSE 0 END) as total_efectivo
            FROM movimientos_caja
            WHERE id_apcaja = ?
        `, [apertura[0].id_apcajas]);

        res.json({
            success: true,
            apertura_activa: true,
            apertura: {
                ...apertura[0],
                estadisticas: movimientos[0]
            }
        });

    } catch (error) {
        console.error('Error al obtener apertura:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener ventas del día en tiempo real - CORREGIDO
async function obtenerVentasDelDia(req, res) {
    try {
        const { id_caja } = req.params;
        const fecha_hoy = new Date().toISOString().split('T')[0];

        // Obtener apertura activa
        const [apertura] = await pool.query(`
            SELECT id_apcajas
            FROM apcajas
            WHERE id_caja = ? AND DATE(fecha_apertura) = ? AND abierta = 'S'
        `, [id_caja, fecha_hoy]);

        if (apertura.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay caja abierta para hoy'
            });
        }

        const id_apertura = apertura[0].id_apcajas;

        // Obtener resumen de movimientos
        const [movimientos] = await pool.query(`
            SELECT
                tipo_movimiento,
                metodo_pago,
                COUNT(*) as cantidad,
                SUM(monto) as total_monto
            FROM movimientos_caja
            WHERE id_apcaja = ? AND DATE(fecha_movimiento) = ?
            GROUP BY tipo_movimiento, metodo_pago
        `, [id_apertura, fecha_hoy]);

        // Procesar estadísticas
        let total_ventas = 0;
        let numero_ventas = 0;
        const formas_pago = {};

        movimientos.forEach(mov => {
            if (mov.tipo_movimiento === 'venta') {
                total_ventas += parseFloat(mov.total_monto);
                numero_ventas += mov.cantidad;

                if (!formas_pago[mov.metodo_pago]) {
                    formas_pago[mov.metodo_pago] = {
                        forma_pago: mov.metodo_pago,
                        numero_ventas: 0,
                        total_importe: 0
                    };
                }

                formas_pago[mov.metodo_pago].numero_ventas += mov.cantidad;
                formas_pago[mov.metodo_pago].total_importe += parseFloat(mov.total_monto);
            }
        });

        const ticket_promedio = numero_ventas > 0 ? total_ventas / numero_ventas : 0;

        res.json({
            success: true,
            ventas: {
                numero_ventas,
                total_ventas,
                ticket_promedio
            },
            formas_pago: Object.values(formas_pago),
            apertura_id: id_apertura
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
