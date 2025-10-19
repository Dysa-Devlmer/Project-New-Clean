const mysql = require('mysql2/promise');

async function colExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [process.env.DB_NAME || 'dysa_point', table, column]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn, table, ddl) {
  try {
    // ddl = "ADD COLUMN nombre_col ... AFTER otra_col"
    await conn.query(`ALTER TABLE \`${table}\` ${ddl}`);
    console.log(`✅ Agregada columna a ${table}: ${ddl}`);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log(`ℹ️  Columna ya existe en ${table}`);
    } else {
      throw error;
    }
  }
}

async function run() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'devlmer',
    password: process.env.DB_PASS || 'devlmer2025',
    database: process.env.DB_NAME || 'dysa_point',
    charset: 'utf8mb4'
  });

  try {
    console.log('🔧 Adaptando esquema a nombres v2…');
    console.log(`📡 Conectando a: ${process.env.DB_USER || 'devlmer'}@${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME || 'dysa_point'}`);

    // 1) configuracion_empresa: faltan nombres v2 respecto a tu BD
    //   - en tu BD existe: rut_empresa, direccion, telefono_principal, email_principal
    //   - v2 espera:       rut_nif,     direccion_fiscal, telefono,            email
    console.log('\n1️⃣ Adaptando configuracion_empresa...');

    if (!(await colExists(conn, 'configuracion_empresa', 'rut_nif'))) {
      await addColumnIfMissing(conn, 'configuracion_empresa', 'ADD COLUMN rut_nif VARCHAR(50) NULL AFTER nombre_comercial');
      await conn.query('UPDATE configuracion_empresa SET rut_nif = rut_empresa WHERE rut_nif IS NULL AND rut_empresa IS NOT NULL');
      console.log('   ↳ Migrado rut_empresa → rut_nif');
    }

    if (!(await colExists(conn, 'configuracion_empresa', 'direccion_fiscal'))) {
      await addColumnIfMissing(conn, 'configuracion_empresa', 'ADD COLUMN direccion_fiscal VARCHAR(255) NULL AFTER rut_nif');
      await conn.query('UPDATE configuracion_empresa SET direccion_fiscal = direccion WHERE direccion_fiscal IS NULL AND direccion IS NOT NULL');
      console.log('   ↳ Migrado direccion → direccion_fiscal');
    }

    if (!(await colExists(conn, 'configuracion_empresa', 'telefono'))) {
      await addColumnIfMissing(conn, 'configuracion_empresa', 'ADD COLUMN telefono VARCHAR(50) NULL AFTER direccion_fiscal');
      await conn.query('UPDATE configuracion_empresa SET telefono = telefono_principal WHERE telefono IS NULL AND telefono_principal IS NOT NULL');
      console.log('   ↳ Migrado telefono_principal → telefono');
    }

    if (!(await colExists(conn, 'configuracion_empresa', 'email'))) {
      await addColumnIfMissing(conn, 'configuracion_empresa', 'ADD COLUMN email VARCHAR(150) NULL AFTER telefono');
      await conn.query('UPDATE configuracion_empresa SET email = email_principal WHERE email IS NULL AND email_principal IS NOT NULL');
      console.log('   ↳ Migrado email_principal → email');
    }

    if (!(await colExists(conn, 'configuracion_empresa', 'sitio_web'))) {
      await addColumnIfMissing(conn, 'configuracion_empresa', 'ADD COLUMN sitio_web VARCHAR(200) NULL AFTER email');
    }

    if (!(await colExists(conn, 'configuracion_empresa', 'logo_url'))) {
      await addColumnIfMissing(conn, 'configuracion_empresa', 'ADD COLUMN logo_url VARCHAR(255) NULL AFTER sitio_web');
    }

    // 2) configuracion_fiscal: tu BD usa simbolo_moneda; v2 espera moneda_simbolo
    console.log('\n2️⃣ Adaptando configuracion_fiscal...');

    if (!(await colExists(conn, 'configuracion_fiscal', 'moneda_simbolo'))) {
      await addColumnIfMissing(conn, 'configuracion_fiscal', 'ADD COLUMN moneda_simbolo VARCHAR(5) NULL AFTER moneda_principal');
      // copiar de simbolo_moneda si existe
      const hasSimbolo = await colExists(conn, 'configuracion_fiscal', 'simbolo_moneda');
      if (hasSimbolo) {
        await conn.query('UPDATE configuracion_fiscal SET moneda_simbolo = simbolo_moneda WHERE moneda_simbolo IS NULL AND simbolo_moneda IS NOT NULL');
        console.log('   ↳ Migrado simbolo_moneda → moneda_simbolo');
      }
    }

    // 3) config_restaurante: tu BD usa tipo_restaurante; v2 espera tipo_establecimiento
    console.log('\n3️⃣ Adaptando config_restaurante...');

    if (!(await colExists(conn, 'config_restaurante', 'tipo_establecimiento'))) {
      await addColumnIfMissing(conn, 'config_restaurante', 'ADD COLUMN tipo_establecimiento VARCHAR(50) NULL AFTER nombre_establecimiento');
      const hasTipoRest = await colExists(conn, 'config_restaurante', 'tipo_restaurante');
      if (hasTipoRest) {
        await conn.query('UPDATE config_restaurante SET tipo_establecimiento = tipo_restaurante WHERE tipo_establecimiento IS NULL AND tipo_restaurante IS NOT NULL');
        console.log('   ↳ Migrado tipo_restaurante → tipo_establecimiento');
      }
    }

    // 4) config_sistema: v2 espera columna version (entre otras)
    console.log('\n4️⃣ Adaptando config_sistema...');

    if (!(await colExists(conn, 'config_sistema', 'version'))) {
      await addColumnIfMissing(conn, 'config_sistema', "ADD COLUMN version VARCHAR(20) NULL AFTER empresa_id");
      // set valor por defecto razonable
      await conn.query("UPDATE config_sistema SET version = '3.0.0' WHERE version IS NULL");
      console.log('   ↳ Agregada columna version con valor 3.0.0');
    }

    if (!(await colExists(conn, 'config_sistema', 'ambiente'))) {
      await addColumnIfMissing(conn, 'config_sistema', "ADD COLUMN ambiente VARCHAR(20) NULL AFTER version");
      await conn.query("UPDATE config_sistema SET ambiente = COALESCE(ambiente, 'production')");
    }

    if (!(await colExists(conn, 'config_sistema', 'modo_mantenimiento'))) {
      await addColumnIfMissing(conn, 'config_sistema', "ADD COLUMN modo_mantenimiento TINYINT(1) NOT NULL DEFAULT 0 AFTER ambiente");
    }

    if (!(await colExists(conn, 'config_sistema', 'backup_automatico'))) {
      await addColumnIfMissing(conn, 'config_sistema', "ADD COLUMN backup_automatico TINYINT(1) NOT NULL DEFAULT 1 AFTER modo_mantenimiento");
    }

    if (!(await colExists(conn, 'config_sistema', 'backup_frecuencia'))) {
      await addColumnIfMissing(conn, 'config_sistema', "ADD COLUMN backup_frecuencia VARCHAR(20) NULL AFTER backup_automatico");
      await conn.query("UPDATE config_sistema SET backup_frecuencia = COALESCE(backup_frecuencia, 'diario')");
    }

    if (!(await colExists(conn, 'config_sistema', 'ultimo_backup'))) {
      await addColumnIfMissing(conn, 'config_sistema', "ADD COLUMN ultimo_backup DATETIME NULL AFTER backup_frecuencia");
    }

    if (!(await colExists(conn, 'config_sistema', 'debug_mode'))) {
      await addColumnIfMissing(conn, 'config_sistema', "ADD COLUMN debug_mode TINYINT(1) NOT NULL DEFAULT 0 AFTER ultimo_backup");
    }

    if (!(await colExists(conn, 'config_sistema', 'ssl_activo'))) {
      await addColumnIfMissing(conn, 'config_sistema', "ADD COLUMN ssl_activo TINYINT(1) NOT NULL DEFAULT 0 AFTER debug_mode");
    }

    // 5) configuracion_operativa: asegurar JSON sin DEFAULT y columnas v2
    console.log('\n5️⃣ Adaptando configuracion_operativa...');

    if (!(await colExists(conn, 'configuracion_operativa', 'idioma_predeterminado'))) {
      await addColumnIfMissing(conn, 'configuracion_operativa', "ADD COLUMN idioma_predeterminado VARCHAR(10) NOT NULL DEFAULT 'es' AFTER formato_hora");
    }

    if (!(await colExists(conn, 'configuracion_operativa', 'idiomas_disponibles'))) {
      await addColumnIfMissing(conn, 'configuracion_operativa', "ADD COLUMN idiomas_disponibles JSON NULL AFTER idioma_predeterminado");
      await conn.query("UPDATE configuracion_operativa SET idiomas_disponibles = JSON_ARRAY('es','en') WHERE idiomas_disponibles IS NULL");
      console.log('   ↳ Agregada columna idiomas_disponibles con JSON por defecto');
    }

    console.log('\n✅ Adaptador de esquema: OK');
    console.log('🎯 Esquema normalizado. Ahora ejecuta las migraciones v2.');

    await conn.end();
  } catch (e) {
    console.error('❌ Error en schema-adapter:', e.message);
    console.error('Stack:', e.stack);
    process.exit(1);
  }
}

run();