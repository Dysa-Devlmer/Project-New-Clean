// Configuración de conexión a MySQL - PRODUCCIÓN
const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de conexiones para mejor rendimiento
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'sysme',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
});

// Verificar conexión
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexión exitosa a MySQL');
        console.log(`   Base de datos: ${process.env.DB_NAME || 'sysme'}`);
        console.log(`   Host: ${process.env.DB_HOST || 'localhost'}`);
        connection.release();
        return true;
    } catch (error) {
        console.error('❌ Error de conexión a MySQL:', error.message);
        return false;
    }
}

module.exports = { pool, testConnection };
