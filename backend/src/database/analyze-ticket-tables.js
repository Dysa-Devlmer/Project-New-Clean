/**
 * Análisis de Tablas de Tickets - DYSA Point
 * Verifica estructura y datos existentes para migración
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'devlmer',
  password: process.env.DB_PASS || 'devlmer2025',
  database: process.env.DB_NAME || 'dysa_point',
  charset: 'utf8mb4'
};

async function analyzeTicketTables() {
  let connection;

  try {
    console.log('🔍 Conectando a base de datos...');
    connection = await mysql.createConnection(dbConfig);

    console.log('✅ Conectado exitosamente');
    console.log('📊 Analizando tablas relacionadas con tickets...\n');

    // Verificar tablas existentes
    const [allTables] = await connection.query('SHOW TABLES');
    const tables = allTables.filter(table => {
      const tableName = Object.values(table)[0];
      return tableName.includes('venta') ||
             tableName.includes('ticket') ||
             tableName.includes('producto') ||
             tableName.includes('mesa');
    });

    console.log('📋 TABLAS ENCONTRADAS:');
    console.log('=====================');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`${index + 1}. ${tableName}`);
    });
    console.log('');

    // Analizar tabla ventas_principales
    try {
      console.log('🎫 ANALIZANDO: ventas_principales');
      console.log('=================================');

      const [structure] = await connection.query('DESCRIBE ventas_principales');
      console.log('Estructura:');
      structure.forEach(field => {
        console.log(`  - ${field.Field} (${field.Type}) ${field.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${field.Key ? field.Key : ''}`);
      });

      const [count] = await connection.query('SELECT COUNT(*) as total FROM ventas_principales');
      console.log(`Registros: ${count[0].total}`);

      if (count[0].total > 0) {
        const [sample] = await connection.query('SELECT * FROM ventas_principales LIMIT 3');
        console.log('Muestra de datos:');
        sample.forEach((row, i) => {
          console.log(`  ${i + 1}. ID:${row.id} Número:${row.numero_venta} Estado:${row.estado_venta} Total:$${row.total_final}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log('❌ Tabla ventas_principales no existe o tiene problemas');
      console.log(`Error: ${error.message}\n`);
    }

    // Analizar tabla venta_detalles
    try {
      console.log('📝 ANALIZANDO: venta_detalles');
      console.log('=============================');

      const [structure] = await connection.query('DESCRIBE venta_detalles');
      console.log('Estructura:');
      structure.forEach(field => {
        console.log(`  - ${field.Field} (${field.Type}) ${field.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${field.Key ? field.Key : ''}`);
      });

      const [count] = await connection.query('SELECT COUNT(*) as total FROM venta_detalles');
      console.log(`Registros: ${count[0].total}`);

      if (count[0].total > 0) {
        const [sample] = await connection.query('SELECT * FROM venta_detalles LIMIT 3');
        console.log('Muestra de datos:');
        sample.forEach((row, i) => {
          console.log(`  ${i + 1}. ID:${row.id} Venta:${row.venta_id} Producto:${row.producto_id} Cantidad:${row.cantidad}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log('❌ Tabla venta_detalles no existe o tiene problemas');
      console.log(`Error: ${error.message}\n`);
    }

    // Analizar tabla productos
    try {
      console.log('🍽️ ANALIZANDO: productos');
      console.log('========================');

      const [structure] = await connection.query('DESCRIBE productos');
      console.log('Estructura:');
      structure.forEach(field => {
        console.log(`  - ${field.Field} (${field.Type}) ${field.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${field.Key ? field.Key : ''}`);
      });

      const [count] = await connection.query('SELECT COUNT(*) as total FROM productos');
      console.log(`Registros: ${count[0].total}`);

      if (count[0].total > 0) {
        const [sample] = await connection.query('SELECT * FROM productos LIMIT 3');
        console.log('Muestra de datos:');
        sample.forEach((row, i) => {
          console.log(`  ${i + 1}. ID:${row.id} Nombre:${row.nombre_producto} Precio:$${row.precio_venta}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log('❌ Tabla productos no existe o tiene problemas');
      console.log(`Error: ${error.message}\n`);
    }

    // Analizar tabla mesas_restaurante
    try {
      console.log('🪑 ANALIZANDO: mesas_restaurante');
      console.log('===============================');

      const [structure] = await connection.query('DESCRIBE mesas_restaurante');
      console.log('Estructura:');
      structure.forEach(field => {
        console.log(`  - ${field.Field} (${field.Type}) ${field.Null === 'NO' ? 'NOT NULL' : 'NULL'} ${field.Key ? field.Key : ''}`);
      });

      const [count] = await connection.query('SELECT COUNT(*) as total FROM mesas_restaurante');
      console.log(`Registros: ${count[0].total}`);

      if (count[0].total > 0) {
        const [sample] = await connection.query('SELECT * FROM mesas_restaurante LIMIT 3');
        console.log('Muestra de datos:');
        sample.forEach((row, i) => {
          console.log(`  ${i + 1}. ID:${row.id} Número:${row.numero_mesa} Estado:${row.estado_mesa} Capacidad:${row.capacidad_personas}`);
        });
      }
      console.log('');
    } catch (error) {
      console.log('❌ Tabla mesas_restaurante no existe o tiene problemas');
      console.log(`Error: ${error.message}\n`);
    }

    console.log('✅ Análisis completado');

  } catch (error) {
    console.error('❌ Error durante el análisis:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔒 Conexión cerrada');
    }
  }
}

// Ejecutar análisis
analyzeTicketTables().catch(console.error);