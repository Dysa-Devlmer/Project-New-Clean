/**
 * SYSME Backend - Ejecutor de Migraciones
 * Sistema para ejecutar migraciones de base de datos de manera segura
 * Fecha: 19 de Octubre 2025
 */

const fs = require('fs').promises;
const path = require('path');
const { executeMultipleQueries, testConnection } = require('../config/database');

class MigrationRunner {
    constructor() {
        this.migrationsPath = path.join(__dirname, 'migrations');
        this.logFile = path.join(__dirname, 'migration-log.txt');
    }

    /**
     * Ejecutar todas las migraciones pendientes
     */
    async runMigrations() {
        try {
            console.log('🚀 Iniciando ejecutor de migraciones...');

            // Verificar conexión a la base de datos
            const connected = await testConnection();
            if (!connected) {
                throw new Error('No se pudo conectar a la base de datos');
            }

            // Obtener lista de archivos de migración
            const migrationFiles = await this.getMigrationFiles();
            console.log(`📁 Encontradas ${migrationFiles.length} migraciones`);

            // Ejecutar cada migración
            const results = [];
            for (const file of migrationFiles) {
                console.log(`\n⚡ Ejecutando: ${file}`);
                const result = await this.runMigration(file);
                results.push({ file, ...result });

                if (!result.success) {
                    console.error(`❌ Error en migración ${file}:`, result.error);
                    throw new Error(`Migración fallida: ${file}`);
                }

                console.log(`✅ Migración completada: ${file}`);
            }

            // Escribir log de resultados
            await this.writeLog(results);

            console.log('\n🎉 Todas las migraciones ejecutadas exitosamente');
            return { success: true, executed: results.length };

        } catch (error) {
            console.error('❌ Error ejecutando migraciones:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Obtener archivos de migración ordenados
     */
    async getMigrationFiles() {
        try {
            const files = await fs.readdir(this.migrationsPath);
            return files
                .filter(file => file.endsWith('.sql'))
                .sort(); // Ordenar por nombre (001_, 002_, etc.)
        } catch (error) {
            throw new Error(`Error leyendo directorio de migraciones: ${error.message}`);
        }
    }

    /**
     * Ejecutar una migración específica
     */
    async runMigration(filename) {
        try {
            const filePath = path.join(this.migrationsPath, filename);
            const sqlContent = await fs.readFile(filePath, 'utf8');

            // Ejecutar el SQL de la migración
            const result = await executeMultipleQueries(sqlContent);

            return {
                success: result.success,
                error: result.error || null,
                executedAt: new Date().toISOString()
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                executedAt: new Date().toISOString()
            };
        }
    }

    /**
     * Escribir log de resultados
     */
    async writeLog(results) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                totalMigrations: results.length,
                successful: results.filter(r => r.success).length,
                failed: results.filter(r => !r.success).length,
                details: results
            };

            const logContent = `
=== MIGRATION LOG ===
Fecha: ${logEntry.timestamp}
Total: ${logEntry.totalMigrations}
Exitosas: ${logEntry.successful}
Fallidas: ${logEntry.failed}

Detalles:
${results.map(r => `${r.file}: ${r.success ? 'OK' : 'ERROR - ' + r.error}`).join('\n')}

====================
`;

            await fs.appendFile(this.logFile, logContent);
        } catch (error) {
            console.warn('⚠️ No se pudo escribir el log:', error.message);
        }
    }

    /**
     * Verificar estado de las tablas después de migración
     */
    async verifyTables() {
        try {
            const { executeQuery } = require('../config/database');

            const expectedTables = [
                'configuracion_empresa',
                'configuracion_fiscal',
                'configuracion_operativa',
                'config_restaurante',
                'config_ventas',
                'config_empleados',
                'config_impresion',
                'config_sistema',
                'config_seguridad',
                'config_estado_runtime',
                'categorias'
            ];

            console.log('\n🔍 Verificando tablas creadas...');

            for (const table of expectedTables) {
                const result = await executeQuery(`SELECT COUNT(*) as count FROM ${table}`);
                if (result.success) {
                    const count = result.data[0].count;
                    console.log(`✅ ${table}: ${count} registros`);
                } else {
                    console.log(`❌ ${table}: Error - ${result.error}`);
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Error verificando tablas:', error.message);
            return false;
        }
    }
}

// Función principal para ejecutar desde línea de comandos
async function main() {
    const runner = new MigrationRunner();

    // Ejecutar migraciones
    const result = await runner.runMigrations();

    if (result.success) {
        // Verificar que las tablas se crearon correctamente
        await runner.verifyTables();
        console.log('\n🎯 Proceso de migración completado exitosamente');
        process.exit(0);
    } else {
        console.error('\n💥 Proceso de migración falló');
        process.exit(1);
    }
}

// Ejecutar si este archivo es llamado directamente
if (require.main === module) {
    main();
}

module.exports = MigrationRunner;