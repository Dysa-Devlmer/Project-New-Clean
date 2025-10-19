/**
 * DYSA Point - Runner de migraciones MySQL mejorado
 * Ejecuta archivos .sql en orden lexicográfico con multipleStatements.
 * Requiere mysql2 y Node >= 16.
 * Basado en recomendaciones para resolver problemas de migraciones.
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'devlmer',
    password: process.env.DB_PASSWORD || 'devlmer2025',
    database: process.env.DB_NAME || 'dysa_point',
    multipleStatements: true, // 🔑 permite ejecutar varios statements
    charset: 'utf8mb4'
  });

  try {
    console.log('🚀 Iniciando migraciones mejoradas…');
    console.log(`📁 Directorio: ${MIGRATIONS_DIR}`);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b)); // 001_, 002_, 003_…

    console.log(`📋 Archivos encontrados: ${files.length}`);
    files.forEach(f => console.log(`   - ${f}`));
    console.log('');

    for (const file of files) {
      const full = path.join(MIGRATIONS_DIR, file);
      const sql = fs.readFileSync(full, 'utf8');

      console.log(`➡️  Ejecutando: ${file}`);

      // Ejecutar con multipleStatements habilitado
      await conn.query(sql);

      console.log(`✅ OK: ${file}`);
    }

    console.log('\n🔍 Verificando tablas creadas...');

    // Verificar tablas config_*
    const [configTables] = await conn.query("SHOW TABLES LIKE 'config%'");
    console.log(`📊 Tablas config_*: ${configTables.length}`);
    configTables.forEach(row => console.log(`   ✅ ${Object.values(row)[0]}`));

    // Verificar tablas configuracion_*
    const [configuracionTables] = await conn.query("SHOW TABLES LIKE 'configuracion_%'");
    console.log(`📊 Tablas configuracion_*: ${configuracionTables.length}`);
    configuracionTables.forEach(row => console.log(`   ✅ ${Object.values(row)[0]}`));

    // Verificar tabla categorias
    const [categoriasTables] = await conn.query("SHOW TABLES LIKE 'categorias'");
    console.log(`📊 Tabla categorias: ${categoriasTables.length}`);
    categoriasTables.forEach(row => console.log(`   ✅ ${Object.values(row)[0]}`));

    const totalTables = configTables.length + configuracionTables.length + categoriasTables.length;
    console.log(`\n🎯 Total tablas de configuración: ${totalTables}`);

    // Verificar si hay datos en las tablas principales
    console.log('\n📈 Verificando datos iniciales...');

    try {
      const [empresaCount] = await conn.query('SELECT COUNT(*) as count FROM configuracion_empresa');
      console.log(`   📊 configuracion_empresa: ${empresaCount[0].count} registros`);
    } catch (e) {
      console.log(`   ⚠️  configuracion_empresa: ${e.message}`);
    }

    try {
      const [categoriasCount] = await conn.query('SELECT COUNT(*) as count FROM categorias');
      console.log(`   📊 categorias: ${categoriasCount[0].count} registros`);
    } catch (e) {
      console.log(`   ⚠️  categorias: ${e.message}`);
    }

    console.log('\n🎉 Migraciones completadas exitosamente');

  } catch (err) {
    console.error('\n💥 Error de migraciones:', err.message);
    console.error('Stack:', err.stack);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
})();