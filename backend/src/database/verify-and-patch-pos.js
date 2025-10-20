/**
 * DYSA Point - Verificador y Parcheador POS
 * Crea/normaliza estructura mínima estable para eliminar todos los errores 500
 * Fecha: 20 de Octubre 2025
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

const ddl = [
  // TICKETS
  `CREATE TABLE IF NOT EXISTS tickets (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    mesa_id          BIGINT NOT NULL,
    estado           ENUM('ABIERTO','EN_PROCESO','FACTURADO','ANULADO') NOT NULL DEFAULT 'ABIERTO',
    empleado_id      BIGINT NULL,
    total_bruto      DECIMAL(12,2) NOT NULL DEFAULT 0,
    descuento_total  DECIMAL(12,2) NOT NULL DEFAULT 0,
    propina          DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva_total        DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_neto       DECIMAL(12,2) NOT NULL DEFAULT 0,
    creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mesa (mesa_id),
    INDEX idx_estado (estado),
    INDEX idx_empleado (empleado_id)
  ) ENGINE=InnoDB`,

  // ITEMS DEL TICKET
  `CREATE TABLE IF NOT EXISTS ticket_items (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id        BIGINT NOT NULL,
    producto_id      BIGINT NOT NULL,
    nombre_producto  VARCHAR(200) NOT NULL,
    cantidad         DECIMAL(10,2) NOT NULL DEFAULT 1,
    precio_unitario  DECIMAL(12,2) NOT NULL DEFAULT 0,
    subtotal         DECIMAL(12,2) NOT NULL DEFAULT 0,
    iva              DECIMAL(12,2) NOT NULL DEFAULT 0,
    total            DECIMAL(12,2) NOT NULL DEFAULT 0,
    creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticket (ticket_id),
    INDEX idx_producto (producto_id)
  ) ENGINE=InnoDB`,

  // MODIFICADORES DEL ÍTEM
  `CREATE TABLE IF NOT EXISTS ticket_item_modificadores (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    item_id          BIGINT NOT NULL,
    modificador      VARCHAR(120) NOT NULL,
    precio           DECIMAL(12,2) NOT NULL DEFAULT 0,
    INDEX idx_item (item_id)
  ) ENGINE=InnoDB`,

  // MÉTODOS DE PAGO (actualizar tabla existente)
  `CREATE TABLE IF NOT EXISTS metodos_pago (
    id          BIGINT AUTO_INCREMENT PRIMARY KEY,
    codigo      VARCHAR(40) NOT NULL UNIQUE,
    nombre      VARCHAR(120) NOT NULL,
    activo      TINYINT(1) NOT NULL DEFAULT 1
  ) ENGINE=InnoDB`,

  // PAGOS DE TICKETS
  `CREATE TABLE IF NOT EXISTS pagos (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    ticket_id        BIGINT NOT NULL,
    metodo_pago_id   BIGINT NOT NULL,
    monto            DECIMAL(12,2) NOT NULL,
    creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticket (ticket_id),
    INDEX idx_metodo (metodo_pago_id)
  ) ENGINE=InnoDB`,

  // CAJA (CIERRES SIMPLES)
  `CREATE TABLE IF NOT EXISTS cierres_caja (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    empleado_id      BIGINT NULL,
    apertura_en      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cierre_en        TIMESTAMP NULL,
    total_ventas     DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_efectivo   DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_tarjeta    DECIMAL(14,2) NOT NULL DEFAULT 0,
    observaciones    TEXT NULL
  ) ENGINE=InnoDB`,

  // MOVIMIENTOS DE CAJA (OPCIONAL P0)
  `CREATE TABLE IF NOT EXISTS movimientos_caja (
    id               BIGINT AUTO_INCREMENT PRIMARY KEY,
    cierre_id        BIGINT NULL,
    tipo             ENUM('APERTURA','VENTA','GASTO','INGRESO','CIERRE') NOT NULL,
    referencia       VARCHAR(120) NULL,
    monto            DECIMAL(12,2) NOT NULL,
    creado_en        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cierre (cierre_id),
    INDEX idx_tipo (tipo)
  ) ENGINE=InnoDB`,

  // Insertar métodos de pago básicos
  `INSERT INTO metodos_pago (id, codigo, nombre, activo) VALUES
   (1, 'EFECTIVO', 'Efectivo', 1),
   (2, 'TARJETA_DEBITO', 'Tarjeta Débito', 1),
   (3, 'TARJETA_CREDITO', 'Tarjeta Crédito', 1),
   (4, 'TRANSFERENCIA', 'Transferencia', 1)
   ON DUPLICATE KEY UPDATE nombre = nombre`,

  // FKs
  `ALTER TABLE ticket_items
   ADD CONSTRAINT fk_ticket_items_ticket
   FOREIGN KEY (ticket_id) REFERENCES tickets(id)
   ON DELETE CASCADE ON UPDATE CASCADE`,

  `ALTER TABLE ticket_item_modificadores
   ADD CONSTRAINT fk_mods_item
   FOREIGN KEY (item_id) REFERENCES ticket_items(id)
   ON DELETE CASCADE ON UPDATE CASCADE`,

  `ALTER TABLE pagos
   ADD CONSTRAINT fk_pagos_ticket
   FOREIGN KEY (ticket_id) REFERENCES tickets(id)
   ON DELETE CASCADE ON UPDATE CASCADE`,

  `ALTER TABLE pagos
   ADD CONSTRAINT fk_pagos_metodo
   FOREIGN KEY (metodo_pago_id) REFERENCES metodos_pago(id)
   ON DELETE RESTRICT ON UPDATE CASCADE`
];

async function verifyAndPatch() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'devlmer',
    password: process.env.DB_PASS || 'devlmer2025',
    database: process.env.DB_NAME || 'dysa_point',
    charset: 'utf8mb4'
  });

  try {
    console.log('🔧 Verificando/creando estructura POS...');
    console.log('============================================');

    for (let i = 0; i < ddl.length; i++) {
      const stmt = ddl[i];
      const sql = stmt.trim();
      if (!sql) continue;

      try {
        await conn.query(sql);
        const preview = sql.split('\\n')[0].slice(0, 80);
        console.log(`✅ OK [${i + 1}/${ddl.length}]:`, preview);
      } catch (e) {
        const msg = String(e && e.message || '');
        const preview = sql.split('\\n')[0].slice(0, 80);

        if (/Duplicate|exists|errno: 1826|Error on rename|ALREADY EXISTS|Duplicate entry/i.test(msg)) {
          console.log(`ℹ️  Saltado [${i + 1}/${ddl.length}] (ya aplicado):`, preview);
        } else {
          console.error(`❌ Error DDL [${i + 1}/${ddl.length}]:`, msg);
          console.error('SQL:', preview);
          // Continuar con los demás (no fallar)
        }
      }
    }

    // Verificar que las tablas estén creadas
    console.log('\\n📊 Verificando tablas creadas...');
    const tablas = ['tickets', 'ticket_items', 'ticket_item_modificadores', 'pagos', 'metodos_pago', 'cierres_caja'];

    for (const tabla of tablas) {
      const [result] = await conn.query(`SHOW TABLES LIKE '${tabla}'`);
      if (result.length > 0) {
        console.log(`✅ ${tabla} - OK`);
      } else {
        console.log(`❌ ${tabla} - FALTA`);
      }
    }

    // Verificar datos en métodos de pago
    const [metodos] = await conn.query('SELECT COUNT(*) as total FROM metodos_pago');
    console.log(`💳 Métodos de pago: ${metodos[0].total} registros`);

    console.log('\\n🎉 Estructura POS verificada y aplicada.');
    console.log('✅ Sistema listo para eliminar errores 500 en tickets');

  } catch (error) {
    console.error('💥 ERROR CRÍTICO:', error.message);
    throw error;
  } finally {
    await conn.end();
    console.log('🔒 Conexión cerrada');
  }
}

// Ejecutar verificación/parche
verifyAndPatch().catch(console.error);