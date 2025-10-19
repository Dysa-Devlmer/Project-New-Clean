const mysql = require('mysql2/promise');

async function checkRestauranteTable() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'devlmer',
    password: process.env.DB_PASS || 'devlmer2025',
    database: process.env.DB_NAME || 'dysa_point'
  };

  let connection;
  try {
    connection = await mysql.createConnection(config);

    // Verificar si existe config_restaurante
    const [tables] = await connection.query("SHOW TABLES LIKE 'config_restaurante'");

    if (tables.length > 0) {
      console.log("✅ Tabla config_restaurante existe");

      // Obtener estructura de la tabla
      const [columns] = await connection.query("DESCRIBE config_restaurante");
      console.log("\nEstructura actual de config_restaurante:");
      columns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Null} ${col.Key} ${col.Default || ''}`);
      });

      // Verificar si tiene datos
      const [rows] = await connection.query("SELECT COUNT(*) as count FROM config_restaurante");
      console.log(`\nFilas existentes: ${rows[0].count}`);

    } else {
      console.log("❌ Tabla config_restaurante NO existe");
    }

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkRestauranteTable();