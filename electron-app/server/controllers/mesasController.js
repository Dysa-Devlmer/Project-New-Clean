// Controlador de Mesas - SISTEMA REAL
const { pool } = require('../config/database');

// Obtener todas las mesas
async function obtenerMesas(req, res) {
    try {
        const [mesas] = await pool.query(
            'SELECT * FROM mesa WHERE activa = true ORDER BY Num_Mesa'
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
                m.Num_Mesa,
                m.descripcion,
                m.capacidad,
                m.zona,
                v.id_venta,
                v.comensales,
                v.total,
                v.cerrada,
                c.nombre as nombre_camarero
            FROM mesa m
            LEFT JOIN (
                SELECT v1.*
                FROM ventadirecta v1
                WHERE v1.cerrada = 'N'
                AND v1.id_venta = (
                    SELECT MAX(v2.id_venta)
                    FROM ventadirecta v2
                    WHERE v2.Num_Mesa = v1.Num_Mesa
                    AND v2.cerrada = 'N'
                )
            ) v ON m.Num_Mesa = v.Num_Mesa
            LEFT JOIN camareros c ON v.id_camarero = c.id_camarero
            WHERE m.activa = true
            ORDER BY m.Num_Mesa
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
        const { Num_Mesa, descripcion, capacidad, zona } = req.body;

        await pool.query(
            'INSERT INTO mesa (Num_Mesa, descripcion, capacidad, zona) VALUES (?, ?, ?, ?)',
            [Num_Mesa, descripcion, capacidad, zona]
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
