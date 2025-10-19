/**
 * Script para analizar estructura de tablas de tickets/ventas
 */

const mysql = require('mysql2/promise');

async function analyzeTicketTables() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'devlmer',
      password: process.env.DB_PASS || 'devlmer2025',
      database: process.env.DB_NAME || 'dysa_point'
    });

    console.log('🔍 ANALIZANDO ESTRUCTURA DE TABLAS PARA TICKETS/VENTAS\n');

    // Analizar tablas principales
    const tablesToAnalyze = [
      'ventas_principales',
      'venta_detalles',
      'productos',
      'mesas_restaurante',
      'categorias',
      'formas_pago',
      'pagos_ventas'
    ];

    for (const table of tablesToAnalyze) {
      console.log(`\n=== TABLA: ${table.toUpperCase()} ===`);

      try {
        // Estructura de la tabla
        const [columns] = await connection.execute(`DESCRIBE ${table}`);
        console.log('Columnas:');
        columns.forEach(col => {
          console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${col.Key ? `[${col.Key}]` : ''} ${col.Default ? `DEFAULT: ${col.Default}` : ''}`);
        });

        // Datos de ejemplo
        const [sample] = await connection.execute(`SELECT * FROM ${table} LIMIT 2`);
        if (sample.length > 0) {
          console.log('\nDatos ejemplo:');
          console.log(JSON.stringify(sample, null, 2));
        } else {
          console.log('\nTabla vacía');
        }

      } catch (error) {
        console.log(`❌ Error analizando ${table}: ${error.message}`);
      }
    }

    // Verificar relaciones
    console.log('\n=== ANÁLISIS DE RELACIONES ===');

    try {
      const [foreignKeys] = await connection.execute(`
        SELECT
          TABLE_NAME,
          COLUMN_NAME,
          CONSTRAINT_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_SCHEMA = 'dysa_point'
        AND TABLE_NAME IN ('ventas_principales', 'venta_detalles', 'pagos_ventas')
        ORDER BY TABLE_NAME, COLUMN_NAME
      `);

      foreignKeys.forEach(fk => {
        console.log(`${fk.TABLE_NAME}.${fk.COLUMN_NAME} -> ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
      });

    } catch (error) {
      console.log('❌ Error analizando foreign keys:', error.message);
    }

    await connection.end();
    console.log('\n✅ Análisis completado');

  } catch (error) {
    console.error('❌ Error de conexión:', error.message);
  }
}

analyzeTicketTables();