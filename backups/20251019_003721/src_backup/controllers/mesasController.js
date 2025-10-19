// Controlador de Mesas - SISTEMA REAL
const { pool } = require('../config/database');

// Obtener todas las mesas
async function obtenerMesas(req, res) {
    try {
        const [mesas] = await pool.query(
            'SELECT * FROM mesas_restaurante WHERE mesa_activa = true ORDER BY numero_mesa'
        );
        res.json({ success: true, mesas });
    } catch (error) {
        console.error('Error al obtener mesas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener estado de mesas con ventas activas
async function obtenerEstadoMesas(req, res) {
    try {
        const [mesas] = await pool.query(`
            SELECT
                m.numero_mesa,
                m.capacidad_personas,
                m.zona_id,
                m.estado_mesa,
                v.id as id_venta,
                v.total_final,
                v.estado_venta,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_camarero
            FROM mesas_restaurante m
            LEFT JOIN (
                SELECT v1.*
                FROM ventas_principales v1
                WHERE v1.estado_venta = 'ABIERTA'
                AND v1.id = (
                    SELECT MAX(v2.id)
                    FROM ventas_principales v2
                    WHERE v2.mesa_id = v1.mesa_id
                    AND v2.estado_venta = 'ABIERTA'
                )
            ) v ON m.id = v.mesa_id
            LEFT JOIN empleados e ON v.empleado_vendedor_id = e.id
            WHERE m.mesa_activa = true
            ORDER BY m.numero_mesa
        `);

        // Clasificar mesas
        const mesasConEstado = mesas.map(mesa => ({
            ...mesa,
            estado: mesa.id_venta ? 'ocupada' : 'libre'
        }));

        res.json({ success: true, mesas: mesasConEstado });
    } catch (error) {
        console.error('Error al obtener estado de mesas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Crear nueva mesa
async function crearMesa(req, res) {
    try {
        const { numero_mesa, capacidad_personas, zona_id } = req.body;

        await pool.query(
            'INSERT INTO mesas_restaurante (numero_mesa, capacidad_personas, zona_id) VALUES (?, ?, ?)',
            [numero_mesa, capacidad_personas, zona_id]
        );

        res.json({ success: true, message: 'Mesa creada exitosamente' });
    } catch (error) {
        console.error('Error al crear mesa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    obtenerMesas,
    obtenerEstadoMesas,
    crearMesa
};
