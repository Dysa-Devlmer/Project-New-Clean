// backend/src/database/print-tables.js
require('dotenv').config();
const mysql = require('mysql2/promise');

(async () => {
  try {
    const cfg = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || 'devlmer',
      password: process.env.DB_PASS || 'devlmer2025',
      database: process.env.DB_NAME || 'dysa_point',
      charset: 'utf8mb4'
    };

    console.log("=== VERIFICACIÓN DE BASE DE DATOS ===");
    console.log(`Conectando a: ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);

    const conn = await mysql.createConnection(cfg);

    const [rows] = await conn.query(
      `SELECT
         TABLE_NAME,
         CREATE_TIME,
         TABLE_ROWS,
         ROUND((DATA_LENGTH+INDEX_LENGTH)/1024/1024,2) AS SIZE_MB
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [cfg.database]
    );

    console.log("\n=== TABLAS EN BASE DE DATOS ===");
    console.log("Tabla".padEnd(34), "Filas".padStart(7), "Tamaño".padStart(10), "Creada".padStart(21));
    console.log("─".repeat(80));

    for (const r of rows) {
      const name = String(r.TABLE_NAME ?? '').padEnd(34);
      const cnt  = String(r.TABLE_ROWS ?? '').padStart(7);
      const mb   = ((r.SIZE_MB ?? 0) + " MB").padStart(10);
      const cAt  = r.CREATE_TIME ? new Date(r.CREATE_TIME).toISOString().slice(0,19).replace('T',' ') : "-".padStart(21);
      console.log(name, cnt, mb, cAt);
    }

    console.log("\nTotal:", rows.length, "tablas");

    // Verificar tablas específicas de configuración
    console.log("\n=== VERIFICACIÓN TABLAS CONFIGURACIÓN ===");
    const configTables = [
      'configuracion_empresa',
      'configuracion_fiscal',
      'configuracion_operativa',
      'config_restaurante',
      'config_ventas',
      'config_sistema',
      'config_empleados',
      'config_impresion',
      'config_seguridad',
      'config_estado_runtime',
      'categorias'
    ];

    let foundTables = 0;
    for (const tableName of configTables) {
      const found = rows.find(t => t.TABLE_NAME === tableName);
      if (found) {
        console.log(`✅ ${tableName} (${found.TABLE_ROWS || 0} filas)`);
        foundTables++;
      } else {
        console.log(`❌ ${tableName} - NO ENCONTRADA`);
      }
    }

    console.log(`\nTablas de configuración encontradas: ${foundTables}/${configTables.length}`);

    // Verificar datos de ejemplo
    if (foundTables > 0) {
      console.log('\n=== DATOS DE EJEMPLO ===');
      try {
        const [empresaData] = await conn.query('SELECT razon_social, nombre_comercial FROM configuracion_empresa LIMIT 1');
        if (empresaData.length > 0) {
          console.log(`Empresa: ${empresaData[0].razon_social} (${empresaData[0].nombre_comercial})`);
        }

        const [categorias] = await conn.query('SELECT COUNT(*) as total FROM categorias');
        console.log(`Categorías: ${categorias[0].total} registros`);
      } catch (err) {
        console.log('No se pudieron obtener datos de ejemplo:', err.message);
      }
    }

    await conn.end();
  } catch (e) {
    console.error("❌ Error al verificar tablas:", e.message);
    console.log("Verifique las variables de entorno de BD:\n  DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME");
    console.log("\nValores actuales detectados:", {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_USER: process.env.DB_USER,
      DB_NAME: process.env.DB_NAME
    });
    process.exit(1);
  }
})();