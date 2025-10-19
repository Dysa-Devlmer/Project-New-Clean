/**
 * SYSME Backend - Configuración de Base de Datos
 * Conexión MySQL optimizada para producción en restaurante
 * Fecha: 18 de Octubre 2025
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración de conexión para dysa_point (CORREGIDA - MySQL2 válida)
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'devlmer',
    password: process.env.DB_PASSWORD || 'devlmer2025',
    database: process.env.DB_NAME || 'dysa_point',
    port: process.env.DB_PORT || 3306,
    charset: 'utf8mb4',
    timezone: '-04:00', // Corregido: formato válido para MySQL2
    connectionLimit: 20,
    // acquireTimeout: REMOVIDO - no válido en MySQL2
    // timeout: REMOVIDO - no válido en MySQL2
    // reconnect: REMOVIDO - no válido en MySQL2

    // Configuraciones específicas para restaurante
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,

    // Pool de conexiones para múltiples terminales
    multipleStatements: false,
    ssl: false,

    // Configuraciones válidas de pool
    waitForConnections: true,
    queueLimit: 0
};

// Crear pool de conexiones
const pool = mysql.createPool(dbConfig);

/**
 * Función para probar la conexión
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión a MySQL exitosa - dysa_point');
        console.log(`📍 Host: ${dbConfig.host}:${dbConfig.port}`);
        console.log(`🗄️ Base de datos: ${dbConfig.database}`);

        // Verificar tablas principales del restaurante
        const [tables] = await connection.execute('SHOW TABLES');
        const tableNames = tables.map(row => Object.values(row)[0]);

        const requiredTables = [
            'mesas_restaurante',
            'ventas_principales',
            'venta_detalles',
            'productos',
            'empleados',
            'categorias_productos'
        ];

        const missingTables = requiredTables.filter(table => !tableNames.includes(table));
        if (missingTables.length > 0) {
            console.log('⚠️ Tablas faltantes:', missingTables);
        } else {
            console.log('✅ Todas las tablas del restaurante están disponibles');
        }

        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a MySQL:', error.message);
        return false;
    }
}

/**
 * Función para ejecutar queries con manejo de errores
 */
async function executeQuery(query, params = []) {
    try {
        const [results] = await pool.execute(query, params);
        return { success: true, data: results };
    } catch (error) {
        console.error('❌ Error en query:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Función para transacciones
 */
async function executeTransaction(queries) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        const results = [];
        for (const { query, params } of queries) {
            const [result] = await connection.execute(query, params || []);
            results.push(result);
        }

        await connection.commit();
        connection.release();
        return { success: true, data: results };
    } catch (error) {
        await connection.rollback();
        connection.release();
        console.error('❌ Error en transacción:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Función para ejecutar múltiples queries sin transacción (para scripts SQL)
 */
async function executeMultipleQueries(sqlScript) {
    const connection = await pool.getConnection();
    try {
        // Separar queries por ';' y filtrar vacíos
        const queries = sqlScript
            .split(';')
            .map(q => q.trim())
            .filter(q => q.length > 0 && !q.startsWith('--'));

        const results = [];
        for (const query of queries) {
            if (query.trim()) {
                const [result] = await connection.execute(query);
                results.push(result);
            }
        }

        connection.release();
        return { success: true, data: results };
    } catch (error) {
        connection.release();
        console.error('❌ Error ejecutando múltiples queries:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Queries específicos para el sistema de restaurante
 */
const queries = {
    // Empleados y autenticación
    getEmpleadoByCredentials: 'SELECT * FROM empleados WHERE usuario_sistema = ? AND activo = 1',

    // Mesas del restaurante
    getAllMesas: 'SELECT * FROM mesas_restaurante WHERE mesa_activa = 1 ORDER BY numero_mesa',
    getMesaById: 'SELECT * FROM mesas_restaurante WHERE id = ?',
    updateEstadoMesa: 'UPDATE mesas_restaurante SET estado_mesa = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',

    // Productos y categorías
    getAllProductos: 'SELECT p.*, c.nombre_categoria as categoria_nombre FROM productos p LEFT JOIN categorias_productos c ON p.categoria_id = c.id WHERE p.producto_activo = 1',
    getProductosByCategoria: 'SELECT * FROM productos WHERE categoria_id = ? AND producto_activo = 1',
    getAllCategorias: 'SELECT * FROM categorias_productos WHERE activa = 1 ORDER BY orden_display',

    // Ventas
    createVenta: `INSERT INTO ventas_principales
        (numero_venta, mesa_id, empleado_vendedor_id, terminal_id, fecha_venta, hora_inicio, tipo_venta, estado_venta)
        VALUES (?, ?, ?, ?, CURDATE(), CURTIME(), ?, 'ABIERTA')`,

    getVentasAbiertas: 'SELECT * FROM ventas_principales WHERE estado_venta = "ABIERTA" ORDER BY timestamp_inicio DESC',

    addDetalleVenta: `INSERT INTO venta_detalles
        (venta_id, numero_linea, producto_id, codigo_producto, nombre_producto, cantidad, precio_unitario, subtotal_linea, subtotal_con_descuento, observaciones_item)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,

    getDetallesVenta: `SELECT vd.*, p.nombre_producto as producto_nombre
        FROM venta_detalles vd
        JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ? ORDER BY vd.created_at`,

    updateTotalVenta: 'UPDATE ventas_principales SET total_final = ? WHERE id = ?',

    cerrarVenta: 'UPDATE ventas_principales SET estado_venta = "CERRADA", timestamp_cierre = CURRENT_TIMESTAMP WHERE id = ?'
};

module.exports = {
    pool,
    testConnection,
    executeQuery,
    executeTransaction,
    executeMultipleQueries,
    queries,
    dbConfig
};
