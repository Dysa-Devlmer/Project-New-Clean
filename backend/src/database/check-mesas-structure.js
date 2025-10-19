require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'devlmer',
      password: process.env.DB_PASS || 'devlmer2025',
      database: process.env.DB_NAME || 'dysa_point',
      charset: 'utf8mb4'
    });

    console.log('=== ESTRUCTURA TABLA mesas_restaurante ===');
    const [columns] = await conn.query('DESCRIBE mesas_restaurante');
    columns.forEach(col => {
      console.log(`${col.Field.padEnd(20)} ${col.Type.padEnd(20)} ${col.Null} ${col.Key} ${col.Default || ''}`);
    });

    console.log('\n=== DATOS EXISTENTES ===');
    const [rows] = await conn.query('SELECT * FROM mesas_restaurante LIMIT 5');
    console.table(rows);

    await conn.end();
  } catch (e) {
    console.error('Error:', e.message);
  }
})();