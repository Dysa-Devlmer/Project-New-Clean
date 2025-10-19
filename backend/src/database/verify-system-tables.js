/**
 * DYSA Point - Verificación de Tablas del Sistema
 * Script para verificar las nuevas tablas de configuración de red e instalación
 * Fecha: 19 de Octubre 2025
 */

const { pool } = require('../config/database');

async function verifySystemTables() {
  console.log('🔍 VERIFICANDO NUEVAS TABLAS DEL SISTEMA DE CONFIGURACIÓN\n');

  try {
    // Verificar tablas del sistema
    const systemTables = [
      'sistema_red',
      'sistema_instalacion',
      'restaurante_duenio',
      'restaurante_sucursal',
      'sistema_logs_config'
    ];

    console.log('=== VERIFICACIÓN DE TABLAS ===');
    for (const table of systemTables) {
      try {
        const [rows] = await pool.execute(`SHOW TABLES LIKE '${table}'`);
        if (rows.length > 0) {
          console.log(`✅ ${table}`);

          // Mostrar cantidad de registros
          const [count] = await pool.execute(`SELECT COUNT(*) as total FROM ${table}`);
          console.log(`   📊 ${count[0].total} registros`);
        } else {
          console.log(`❌ ${table} - NO EXISTE`);
        }
      } catch (error) {
        console.log(`❌ ${table} - ERROR: ${error.message}`);
      }
    }

    // Verificar datos específicos
    console.log('\n=== VERIFICACIÓN DE DATOS INICIALES ===');

    // Configuración de red
    try {
      const [networkConfig] = await pool.execute(`
        SELECT host_principal, puerto_api, ssl_activo, activo
        FROM sistema_red
        WHERE activo = 1
        LIMIT 1
      `);

      if (networkConfig.length > 0) {
        const config = networkConfig[0];
        console.log('🌐 CONFIGURACIÓN DE RED:');
        console.log(`   Host: ${config.host_principal}`);
        console.log(`   Puerto API: ${config.puerto_api}`);
        console.log(`   SSL: ${config.ssl_activo ? 'Activo' : 'Inactivo'}`);
      } else {
        console.log('❌ No hay configuración de red activa');
      }
    } catch (error) {
      console.log(`❌ Error al verificar configuración de red: ${error.message}`);
    }

    // Estado de instalación
    try {
      const [installStatus] = await pool.execute(`
        SELECT instalado, version_instalada, pasos_completados
        FROM sistema_instalacion
        LIMIT 1
      `);

      if (installStatus.length > 0) {
        const status = installStatus[0];
        console.log('\n🔧 ESTADO DE INSTALACIÓN:');
        console.log(`   Instalado: ${status.instalado ? 'SÍ' : 'NO'}`);
        console.log(`   Versión: ${status.version_instalada}`);
        console.log(`   Pasos: ${status.pasos_completados}`);
      } else {
        console.log('❌ No hay registro de estado de instalación');
      }
    } catch (error) {
      console.log(`❌ Error al verificar estado de instalación: ${error.message}`);
    }

    // Información del dueño
    try {
      const [owner] = await pool.execute(`
        SELECT nombre_completo, rut_nif, telefono, ciudad
        FROM restaurante_duenio
        WHERE activo = 1
        LIMIT 1
      `);

      if (owner.length > 0) {
        const duenio = owner[0];
        console.log('\n👤 INFORMACIÓN DEL DUEÑO:');
        console.log(`   Nombre: ${duenio.nombre_completo}`);
        console.log(`   RUT/NIF: ${duenio.rut_nif}`);
        console.log(`   Teléfono: ${duenio.telefono}`);
        console.log(`   Ciudad: ${duenio.ciudad}`);
      } else {
        console.log('❌ No hay información del dueño registrada');
      }
    } catch (error) {
      console.log(`❌ Error al verificar información del dueño: ${error.message}`);
    }

    // Sucursales
    try {
      const [branches] = await pool.execute(`
        SELECT COUNT(*) as total,
               SUM(es_principal) as principales,
               SUM(activo) as activas
        FROM restaurante_sucursal
      `);

      if (branches.length > 0) {
        const stats = branches[0];
        console.log('\n🏪 SUCURSALES:');
        console.log(`   Total: ${stats.total}`);
        console.log(`   Principales: ${stats.principales}`);
        console.log(`   Activas: ${stats.activas}`);
      } else {
        console.log('❌ No hay sucursales registradas');
      }
    } catch (error) {
      console.log(`❌ Error al verificar sucursales: ${error.message}`);
    }

    console.log('\n✅ Verificación completada');

  } catch (error) {
    console.error('❌ Error general:', error.message);
  } finally {
    process.exit(0);
  }
}

// Ejecutar verificación
verifySystemTables();