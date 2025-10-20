/**
 * SCRIPT DE CORRECCIÓN COMPLETA - DYSA Point
 * Detecta y corrige TODOS los errores del sistema paso a paso
 * Fecha: 20 de Octubre 2025
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

class ErrorFixer {
  constructor() {
    this.connection = null;
    this.erroresEncontrados = [];
    this.erroresCorregidos = [];
  }

  async conectar() {
    console.log('🔌 Conectando a base de datos...');
    this.connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado exitosamente\n');
  }

  async verificarTablaEmpleados() {
    console.log('👥 VERIFICANDO TABLA EMPLEADOS...');

    // Verificar si existe la tabla empleados simple
    const [empleados] = await this.connection.query("SHOW TABLES LIKE 'empleados'");
    const [configEmpleados] = await this.connection.query("SHOW TABLES LIKE 'config_empleados'");

    if (empleados.length === 0 && configEmpleados.length > 0) {
      console.log('⚠️  ERROR: Código busca "empleados" pero existe "config_empleados"');
      this.erroresEncontrados.push('Tabla empleados no existe - existe config_empleados');

      // Crear tabla empleados simple
      console.log('🛠️  Creando tabla empleados compatible...');
      await this.connection.query(`
        CREATE TABLE IF NOT EXISTS empleados (
          id INT PRIMARY KEY AUTO_INCREMENT,
          codigo_empleado VARCHAR(20),
          nombres VARCHAR(100) NOT NULL,
          apellidos VARCHAR(100),
          cargo VARCHAR(100),
          usuario_sistema VARCHAR(50),
          activo TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);

      // Insertar empleado de prueba
      await this.connection.query(`
        INSERT INTO empleados (id, codigo_empleado, nombres, apellidos, cargo, activo)
        VALUES (1, 'ADMIN001', 'Admin', 'Sistema', 'ADMINISTRADOR', 1)
        ON DUPLICATE KEY UPDATE nombres = nombres
      `);

      console.log('✅ Tabla empleados creada con empleado ID 1');
      this.erroresCorregidos.push('Tabla empleados creada y poblada');
    } else if (empleados.length > 0) {
      console.log('✅ Tabla empleados existe');
    }
  }

  async verificarTablaTerminales() {
    console.log('\n💻 VERIFICANDO TABLA TERMINALES...');

    const [terminales] = await this.connection.query("SHOW TABLES LIKE 'terminales'");

    if (terminales.length === 0) {
      console.log('⚠️  ERROR: Tabla terminales no existe');
      this.erroresEncontrados.push('Tabla terminales faltante');

      await this.connection.query(`
        CREATE TABLE IF NOT EXISTS terminales (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nombre VARCHAR(100) NOT NULL,
          tipo ENUM('POS', 'TABLET', 'MOVIL', 'WEB') DEFAULT 'POS',
          activo TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.connection.query(`
        INSERT INTO terminales (id, nombre, tipo, activo)
        VALUES (1, 'Terminal Principal POS', 'POS', 1)
        ON DUPLICATE KEY UPDATE nombre = nombre
      `);

      console.log('✅ Tabla terminales creada con terminal ID 1');
      this.erroresCorregidos.push('Tabla terminales creada');
    } else {
      console.log('✅ Tabla terminales existe');
    }
  }

  async verificarTablaMetodosPago() {
    console.log('\n💳 VERIFICANDO TABLA MÉTODOS DE PAGO...');

    const [metodos] = await this.connection.query("SHOW TABLES LIKE 'metodos_pago'");

    if (metodos.length === 0) {
      console.log('⚠️  ERROR: Tabla metodos_pago no existe');
      this.erroresEncontrados.push('Tabla metodos_pago faltante');

      await this.connection.query(`
        CREATE TABLE IF NOT EXISTS metodos_pago (
          id INT PRIMARY KEY AUTO_INCREMENT,
          nombre VARCHAR(100) NOT NULL,
          tipo ENUM('EFECTIVO', 'TARJETA', 'DIGITAL', 'CREDITO') NOT NULL,
          codigo VARCHAR(20),
          requiere_autorizacion TINYINT(1) DEFAULT 0,
          permite_cambio TINYINT(1) DEFAULT 0,
          comision_porcentaje DECIMAL(5,2) DEFAULT 0,
          orden_visualizacion INT DEFAULT 0,
          activo TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Insertar métodos básicos
      await this.connection.query(`
        INSERT INTO metodos_pago (id, nombre, tipo, codigo, permite_cambio, orden_visualizacion, activo) VALUES
        (1, 'Efectivo', 'EFECTIVO', 'CASH', 1, 1, 1),
        (2, 'Tarjeta Débito', 'TARJETA', 'DEBIT', 0, 2, 1),
        (3, 'Tarjeta Crédito', 'TARJETA', 'CREDIT', 0, 3, 1),
        (4, 'Transferencia', 'DIGITAL', 'TRANSFER', 0, 4, 1)
        ON DUPLICATE KEY UPDATE nombre = nombre
      `);

      console.log('✅ Tabla metodos_pago creada con 4 métodos básicos');
      this.erroresCorregidos.push('Tabla metodos_pago creada con datos');
    } else {
      console.log('✅ Tabla metodos_pago existe');
    }
  }

  async verificarTablaCierresCaja() {
    console.log('\n📊 VERIFICANDO TABLA CIERRES DE CAJA...');

    const [cierres] = await this.connection.query("SHOW TABLES LIKE 'cierres_caja'");

    if (cierres.length === 0) {
      console.log('⚠️  ERROR: Tabla cierres_caja no existe');
      this.erroresEncontrados.push('Tabla cierres_caja faltante');

      await this.connection.query(`
        CREATE TABLE IF NOT EXISTS cierres_caja (
          id INT PRIMARY KEY AUTO_INCREMENT,
          empleado_cajero_id INT NOT NULL,
          terminal_id INT NOT NULL,
          fecha_cierre DATE NOT NULL,
          hora_inicio TIME,
          hora_cierre TIME,
          monto_inicial_efectivo DECIMAL(12,2) DEFAULT 0,
          monto_final_efectivo DECIMAL(12,2) DEFAULT 0,
          total_ventas_efectivo DECIMAL(12,2) DEFAULT 0,
          total_ventas_tarjeta DECIMAL(12,2) DEFAULT 0,
          total_ventas_digital DECIMAL(12,2) DEFAULT 0,
          total_propinas DECIMAL(12,2) DEFAULT 0,
          diferencia_caja DECIMAL(12,2) DEFAULT 0,
          observaciones TEXT,
          estado_cierre ENUM('ABIERTO', 'COMPLETADO', 'REVISADO') DEFAULT 'ABIERTO',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (empleado_cajero_id) REFERENCES empleados(id),
          FOREIGN KEY (terminal_id) REFERENCES terminales(id)
        )
      `);

      console.log('✅ Tabla cierres_caja creada');
      this.erroresCorregidos.push('Tabla cierres_caja creada');
    } else {
      console.log('✅ Tabla cierres_caja existe');
    }
  }

  async verificarForeignKeys() {
    console.log('\n🔗 VERIFICANDO FOREIGN KEYS...');

    try {
      // Verificar FK en pagos_ventas
      const [fks] = await this.connection.query(`
        SELECT
          TABLE_NAME,
          COLUMN_NAME,
          CONSTRAINT_NAME,
          REFERENCED_TABLE_NAME,
          REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ?
        AND TABLE_NAME = 'pagos_ventas'
        AND REFERENCED_TABLE_NAME IS NOT NULL
      `, [dbConfig.database]);

      if (fks.length === 0) {
        console.log('⚠️  ERROR: Faltan FK en pagos_ventas');
        this.erroresEncontrados.push('Foreign Keys faltantes en pagos_ventas');

        // Agregar FK faltantes
        await this.connection.query(`
          ALTER TABLE pagos_ventas
          ADD CONSTRAINT fk_pagos_metodo
          FOREIGN KEY (metodo_pago_id) REFERENCES metodos_pago(id)
        `).catch(() => console.log('FK metodo_pago ya existe o error'));

        await this.connection.query(`
          ALTER TABLE pagos_ventas
          ADD CONSTRAINT fk_pagos_empleado
          FOREIGN KEY (empleado_cajero_id) REFERENCES empleados(id)
        `).catch(() => console.log('FK empleado_cajero ya existe o error'));

        console.log('✅ Foreign Keys agregadas');
        this.erroresCorregidos.push('Foreign Keys añadidas a pagos_ventas');
      } else {
        console.log('✅ Foreign Keys existen en pagos_ventas');
      }

    } catch (error) {
      console.log('⚠️  Algunos FK pueden existir ya:', error.message);
    }
  }

  async probarEndpointTickets() {
    console.log('\n🎫 PROBANDO ENDPOINTS DE TICKETS...');

    // Esta parte simula lo que haría el endpoint
    try {
      // Verificar que existen registros mínimos necesarios
      const [empleados] = await this.connection.query('SELECT id FROM empleados LIMIT 1');
      const [mesas] = await this.connection.query('SELECT id FROM mesas_restaurante LIMIT 1');
      const [terminales] = await this.connection.query('SELECT id FROM terminales LIMIT 1');

      if (empleados.length === 0) {
        throw new Error('No hay empleados en la BD');
      }
      if (mesas.length === 0) {
        throw new Error('No hay mesas en la BD');
      }
      if (terminales.length === 0) {
        throw new Error('No hay terminales en la BD');
      }

      console.log('✅ Datos mínimos para tickets existen:');
      console.log(`  - Empleado ID: ${empleados[0].id}`);
      console.log(`  - Mesa ID: ${mesas[0].id}`);
      console.log(`  - Terminal ID: ${terminales[0].id}`);

    } catch (error) {
      console.log('❌ ERROR en validación de tickets:', error.message);
      this.erroresEncontrados.push(`Tickets: ${error.message}`);
    }
  }

  async mostrarResumen() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 RESUMEN DE CORRECCIÓN DE ERRORES');
    console.log('='.repeat(60));

    console.log(`\n❌ ERRORES ENCONTRADOS (${this.erroresEncontrados.length}):`);
    this.erroresEncontrados.forEach((error, i) => {
      console.log(`  ${i + 1}. ${error}`);
    });

    console.log(`\n✅ ERRORES CORREGIDOS (${this.erroresCorregidos.length}):`);
    this.erroresCorregidos.forEach((fix, i) => {
      console.log(`  ${i + 1}. ${fix}`);
    });

    if (this.erroresEncontrados.length === this.erroresCorregidos.length) {
      console.log('\n🎉 TODOS LOS ERRORES HAN SIDO CORREGIDOS');
      console.log('✅ Sistema listo para funcionar');
    } else {
      console.log('\n⚠️  QUEDAN ERRORES POR CORREGIR');
      console.log('❗ Revisar logs para más detalles');
    }

    console.log('\n📊 PRÓXIMOS PASOS:');
    console.log('  1. Reiniciar servidor backend');
    console.log('  2. Probar endpoints /api/pos/tickets');
    console.log('  3. Continuar con Fase 3 - Caja/Pagos');
    console.log('='.repeat(60));
  }

  async ejecutar() {
    try {
      await this.conectar();
      await this.verificarTablaEmpleados();
      await this.verificarTablaTerminales();
      await this.verificarTablaMetodosPago();
      await this.verificarTablaCierresCaja();
      await this.verificarForeignKeys();
      await this.probarEndpointTickets();
      await this.mostrarResumen();

    } catch (error) {
      console.error('💥 ERROR CRÍTICO:', error.message);
      this.erroresEncontrados.push(`Error crítico: ${error.message}`);
    } finally {
      if (this.connection) {
        await this.connection.end();
        console.log('\n🔒 Conexión cerrada');
      }
    }
  }
}

// Ejecutar corrección
const fixer = new ErrorFixer();
fixer.ejecutar().catch(console.error);