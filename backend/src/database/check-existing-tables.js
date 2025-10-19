const mysql = require('mysql2/promise');

async function checkExistingTables() {
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

    // Verificar si existe configuracion_empresa
    const [tables] = await connection.query("SHOW TABLES LIKE 'configuracion_empresa'");

    if (tables.length > 0) {
      console.log("✅ Tabla configuracion_empresa existe");

      // Obtener estructura de la tabla
      const [columns] = await connection.query("DESCRIBE configuracion_empresa");
      console.log("\nEstructura actual de configuracion_empresa:");
      columns.forEach(col => {
        console.log(`  - ${col.Field} (${col.Type}) ${col.Null} ${col.Key} ${col.Default || ''}`);
      });

      // Verificar si tiene datos
      const [rows] = await connection.query("SELECT COUNT(*) as count FROM configuracion_empresa");
      console.log(`\nFilas existentes: ${rows[0].count}`);

    } else {
      console.log("❌ Tabla configuracion_empresa NO existe");
    }

    // Listar todas las tablas
    const [allTables] = await connection.query("SHOW TABLES");
    console.log(`\nTodas las tablas (${allTables.length}):`);
    allTables.forEach(table => {
      console.log(`  - ${table[Object.keys(table)[0]]}`);
    });

  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    if (connection) await connection.end();
  }
}

checkExistingTables();