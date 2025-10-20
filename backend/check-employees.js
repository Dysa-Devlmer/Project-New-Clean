/**
 * Verificar estructura de empleados y crear entrada temporal para pruebas
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

async function checkEmployees() {
  let connection;

  try {
    console.log('🔍 Conectando a base de datos...');
    connection = await mysql.createConnection(dbConfig);

    // Verificar si existe tabla empleados
    console.log('📋 Verificando tabla empleados...');
    const [tables] = await connection.query("SHOW TABLES LIKE '%emplead%'");

    if (tables.length === 0) {
      console.log('❌ No existe tabla de empleados');

      // Crear tabla básica de empleados para las pruebas
      console.log('🛠️ Creando tabla empleados básica...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS empleados (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nombre VARCHAR(100) NOT NULL,
          apellido VARCHAR(100) NOT NULL,
          email VARCHAR(100),
          telefono VARCHAR(20),
          cargo VARCHAR(50),
          activo TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Insertar empleado de prueba
      console.log('👤 Insertando empleado de prueba...');
      await connection.query(`
        INSERT INTO empleados (id, nombre, apellido, cargo, activo)
        VALUES (1, 'Admin', 'Sistema', 'ADMINISTRADOR', 1)
        ON DUPLICATE KEY UPDATE nombre = nombre
      `);

      console.log('✅ Tabla empleados creada con empleado de prueba');
    } else {
      console.log('✅ Tabla empleados encontrada:', tables[0]);

      // Verificar estructura
      const [structure] = await connection.query('DESCRIBE empleados');
      console.log('📊 Estructura:');
      structure.forEach(field => {
        console.log(`  - ${field.Field} (${field.Type})`);
      });

      // Verificar empleado ID 1
      const [employees] = await connection.query('SELECT * FROM empleados WHERE id = 1');

      if (employees.length === 0) {
        console.log('⚠️ Empleado ID 1 no existe, creando...');
        await connection.query(`
          INSERT INTO empleados (id, nombre, apellido, cargo, activo)
          VALUES (1, 'Admin', 'Sistema', 'ADMINISTRADOR', 1)
        `);
        console.log('✅ Empleado ID 1 creado');
      } else {
        console.log('✅ Empleado ID 1 existe:', employees[0].nombre, employees[0].apellido);
      }
    }

    // Verificar tabla terminales
    console.log('\n📱 Verificando tabla terminales...');
    const [terminales] = await connection.query("SHOW TABLES LIKE '%terminal%'");

    if (terminales.length === 0) {
      console.log('🛠️ Creando tabla terminales...');
      await connection.query(`
        CREATE TABLE IF NOT EXISTS terminales (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nombre VARCHAR(100) NOT NULL,
          tipo ENUM('POS', 'TABLET', 'MOVIL') DEFAULT 'POS',
          activo TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await connection.query(`
        INSERT INTO terminales (id, nombre, tipo, activo)
        VALUES (1, 'Terminal Principal', 'POS', 1)
        ON DUPLICATE KEY UPDATE nombre = nombre
      `);

      console.log('✅ Tabla terminales creada');
    } else {
      console.log('✅ Tabla terminales existe');
    }

    console.log('\n🎯 Verificación completada - Sistema listo para crear tickets');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

checkEmployees().catch(console.error);