/**
 * DYSA Point - Sistema de Backup Automático de Base de Datos
 * Backup empresarial automático con compresión y rotación
 *
 * Sistema de Producción - Backup Automático Empresarial
 * Compatible con MySQL y protección de datos críticos
 *
 * @author DYSA Point Development Team
 * @version 2.0.14
 * @date 2025-10-13
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const zlib = require('zlib');
const { EventEmitter } = require('events');
const cron = require('node-cron');

class BackupAutomaticoManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.backupPath = path.join(__dirname, '..', '..', 'backups', 'database');
        this.configPath = path.join(__dirname, '..', '..', 'config');
        this.cronJobs = new Map();
        this.backupConfig = {
            frecuencia_horas: 6,
            retention_dias: 30,
            compresion: true,
            max_backups: 100,
            verificar_integridad: true
        };
        this.estadisticas = {
            backups_completados: 0,
            backups_fallidos: 0,
            ultimo_backup: null,
            proximo_backup: null,
            tamano_total: 0
        };
    }

    /**
     * Inicializar sistema de backup automático
     */
    async inicializar() {
        console.log('🔄 Inicializando sistema de backup automático...');

        try {
            // Crear directorio de backups si no existe
            await this.crearDirectorioBackup();

            // Cargar configuración personalizada
            await this.cargarConfiguracion();

            // Programar backup automático
            await this.programarBackupAutomatico();

            // Limpiar backups antiguos al iniciar
            await this.limpiarBackupsAntiguos();

            // Cargar estadísticas existentes
            await this.cargarEstadisticas();

            console.log('✅ Sistema de backup automático inicializado');

            this.emit('sistema_inicializado', {
                config: this.backupConfig,
                proximo_backup: this.estadisticas.proximo_backup
            });

            return true;

        } catch (error) {
            console.error('❌ Error inicializando sistema de backup:', error);
            throw error;
        }
    }

    /**
     * Crear directorio de backup
     */
    async crearDirectorioBackup() {
        try {
            await fs.mkdir(this.backupPath, { recursive: true });

            // Crear subdirectorios por tipo
            const subdirectorios = ['database', 'config', 'logs', 'temp'];
            for (const subdir of subdirectorios) {
                await fs.mkdir(path.join(this.backupPath, '..', subdir), { recursive: true });
            }

            console.log(`📁 Directorio de backup creado: ${this.backupPath}`);

        } catch (error) {
            throw new Error(`Error creando directorio de backup: ${error.message}`);
        }
    }

    /**
     * Cargar configuración de backup
     */
    async cargarConfiguracion() {
        try {
            const configFile = path.join(this.configPath, 'backup.json');

            try {
                const configContent = await fs.readFile(configFile, 'utf8');
                const customConfig = JSON.parse(configContent);
                this.backupConfig = { ...this.backupConfig, ...customConfig };
            } catch {
                // Si no existe configuración, crear una por defecto
                await this.guardarConfiguracion();
            }

            console.log('⚙️ Configuración de backup cargada:', this.backupConfig);

        } catch (error) {
            console.warn('⚠️ Error cargando configuración de backup, usando valores por defecto');
        }
    }

    /**
     * Guardar configuración de backup
     */
    async guardarConfiguracion() {
        try {
            const configFile = path.join(this.configPath, 'backup.json');
            await fs.writeFile(configFile, JSON.stringify(this.backupConfig, null, 2));
        } catch (error) {
            console.error('Error guardando configuración de backup:', error);
        }
    }

    /**
     * Programar backup automático
     */
    async programarBackupAutomatico() {
        try {
            // Detener jobs existentes
            this.cronJobs.forEach(job => job.stop());
            this.cronJobs.clear();

            // Programar backup según frecuencia
            const cronExpression = this.generarExpresionCron(this.backupConfig.frecuencia_horas);

            const backupJob = cron.schedule(cronExpression, async () => {
                console.log('🕒 Ejecutando backup programado...');
                await this.ejecutarBackupCompleto();
            }, {
                scheduled: true,
                timezone: 'America/Santiago'
            });

            this.cronJobs.set('backup_automatico', backupJob);

            // Calcular próximo backup
            this.calcularProximoBackup();

            console.log(`⏰ Backup programado cada ${this.backupConfig.frecuencia_horas} horas`);
            console.log(`📅 Próximo backup: ${this.estadisticas.proximo_backup}`);

        } catch (error) {
            throw new Error(`Error programando backup automático: ${error.message}`);
        }
    }

    /**
     * Generar expresión cron según frecuencia
     */
    generarExpresionCron(frecuenciaHoras) {
        if (frecuenciaHoras === 1) {
            return '0 * * * *'; // Cada hora
        } else if (frecuenciaHoras === 6) {
            return '0 */6 * * *'; // Cada 6 horas
        } else if (frecuenciaHoras === 12) {
            return '0 */12 * * *'; // Cada 12 horas
        } else if (frecuenciaHoras === 24) {
            return '0 2 * * *'; // Diario a las 2 AM
        } else {
            return `0 */${frecuenciaHoras} * * *`; // Frecuencia personalizada
        }
    }

    /**
     * Ejecutar backup completo
     */
    async ejecutarBackupCompleto() {
        const inicioBackup = Date.now();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupName = `dysa_point_${timestamp}`;

        console.log(`🚀 Iniciando backup completo: ${backupName}`);

        try {
            // 1. Backup de base de datos
            const dbBackupFile = await this.ejecutarBackupBaseDatos(backupName);

            // 2. Backup de configuración
            const configBackupFile = await this.ejecutarBackupConfiguracion(backupName);

            // 3. Verificar integridad si está habilitado
            if (this.backupConfig.verificar_integridad) {
                await this.verificarIntegridadBackup(dbBackupFile);
            }

            // 4. Comprimir si está habilitado
            let archivoFinal = dbBackupFile;
            if (this.backupConfig.compresion) {
                archivoFinal = await this.comprimirBackup(dbBackupFile);
                // Eliminar archivo sin comprimir
                await fs.unlink(dbBackupFile);
            }

            // 5. Actualizar estadísticas
            await this.actualizarEstadisticas(archivoFinal, true, Date.now() - inicioBackup);

            // 6. Limpiar backups antiguos
            await this.limpiarBackupsAntiguos();

            console.log(`✅ Backup completado exitosamente: ${archivoFinal}`);

            this.emit('backup_completado', {
                nombre: backupName,
                archivo: archivoFinal,
                duracion_ms: Date.now() - inicioBackup,
                timestamp: new Date()
            });

            return {
                success: true,
                archivo: archivoFinal,
                duracion: Date.now() - inicioBackup
            };

        } catch (error) {
            await this.actualizarEstadisticas(null, false, Date.now() - inicioBackup);

            console.error(`❌ Error en backup completo: ${error.message}`);

            this.emit('backup_fallido', {
                nombre: backupName,
                error: error.message,
                timestamp: new Date()
            });

            throw error;
        }
    }

    /**
     * Ejecutar backup de base de datos
     */
    async ejecutarBackupBaseDatos(backupName) {
        return new Promise((resolve, reject) => {
            const backupFile = path.join(this.backupPath, `${backupName}.sql`);
            const tempFile = path.join(this.backupPath, '..', 'temp', `${backupName}_temp.sql`);

            // Configuración de mysqldump
            const mysqldumpPath = this.obtenerRutaMysqldump();
            const args = [
                '-u', 'devlmer',
                '-pdevlmer2025',
                '--single-transaction',
                '--routines',
                '--triggers',
                '--events',
                '--complete-insert',
                '--extended-insert',
                '--add-drop-table',
                '--add-locks',
                '--create-options',
                '--quick',
                '--lock-tables=false',
                'dysa_point'
            ];

            console.log(`📤 Ejecutando backup de base de datos...`);

            const mysqldump = spawn(mysqldumpPath, args);
            const writeStream = require('fs').createWriteStream(tempFile);

            mysqldump.stdout.pipe(writeStream);

            let errorOutput = '';
            mysqldump.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            mysqldump.on('close', async (code) => {
                try {
                    if (code !== 0) {
                        throw new Error(`mysqldump falló con código ${code}: ${errorOutput}`);
                    }

                    // Mover archivo temporal al definitivo
                    await fs.rename(tempFile, backupFile);

                    // Verificar que el archivo no esté vacío
                    const stats = await fs.stat(backupFile);
                    if (stats.size < 1000) { // Menos de 1KB es sospechoso
                        throw new Error('Backup generado está vacío o es muy pequeño');
                    }

                    console.log(`✅ Backup de BD completado: ${stats.size} bytes`);
                    resolve(backupFile);

                } catch (error) {
                    // Limpiar archivo temporal si existe
                    try {
                        await fs.unlink(tempFile);
                    } catch {}

                    reject(new Error(`Error procesando backup de BD: ${error.message}`));
                }
            });

            mysqldump.on('error', (error) => {
                reject(new Error(`Error ejecutando mysqldump: ${error.message}`));
            });
        });
    }

    /**
     * Obtener ruta de mysqldump
     */
    obtenerRutaMysqldump() {
        const rutasPosibles = [
            'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
            'C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin\\mysqldump.exe',
            '/usr/bin/mysqldump',
            '/usr/local/bin/mysqldump',
            'mysqldump' // En PATH
        ];

        // Por ahora usar la ruta conocida, en producción se puede detectar automáticamente
        return rutasPosibles[0];
    }

    /**
     * Ejecutar backup de configuración
     */
    async ejecutarBackupConfiguracion(backupName) {
        try {
            const configBackupFile = path.join(this.backupPath, '..', 'config', `config_${backupName}.json`);

            // Recopilar toda la configuración
            const configuracionCompleta = {
                sistema: await this.obtenerConfiguracionSistema(),
                backup: this.backupConfig,
                estadisticas: this.estadisticas,
                timestamp: new Date().toISOString(),
                version: '2.0.14'
            };

            await fs.writeFile(configBackupFile, JSON.stringify(configuracionCompleta, null, 2));

            console.log(`✅ Backup de configuración completado: ${configBackupFile}`);
            return configBackupFile;

        } catch (error) {
            console.error('Error en backup de configuración:', error);
            throw error;
        }
    }

    /**
     * Obtener configuración del sistema
     */
    async obtenerConfiguracionSistema() {
        try {
            const configFile = path.join(this.configPath, 'sistema.json');
            const configContent = await fs.readFile(configFile, 'utf8');
            return JSON.parse(configContent);
        } catch {
            return { error: 'Configuración no disponible' };
        }
    }

    /**
     * Verificar integridad del backup
     */
    async verificarIntegridadBackup(backupFile) {
        try {
            console.log('🔍 Verificando integridad del backup...');

            const content = await fs.readFile(backupFile, 'utf8');

            // Verificaciones básicas
            if (!content.includes('-- MySQL dump')) {
                throw new Error('Backup no contiene encabezado válido de MySQL');
            }

            if (!content.includes('CREATE TABLE')) {
                throw new Error('Backup no contiene estructuras de tablas');
            }

            if (!content.includes('UNLOCK TABLES')) {
                throw new Error('Backup parece incompleto');
            }

            // Contar líneas aproximadamente
            const lineas = content.split('\n').length;
            if (lineas < 100) {
                throw new Error('Backup parece demasiado pequeño');
            }

            console.log(`✅ Verificación de integridad exitosa: ${lineas} líneas`);
            return true;

        } catch (error) {
            throw new Error(`Error verificando integridad: ${error.message}`);
        }
    }

    /**
     * Comprimir backup
     */
    async comprimirBackup(backupFile) {
        return new Promise((resolve, reject) => {
            const archivoComprimido = `${backupFile}.gz`;

            console.log('🗜️ Comprimiendo backup...');

            const readStream = require('fs').createReadStream(backupFile);
            const writeStream = require('fs').createWriteStream(archivoComprimido);
            const gzip = zlib.createGzip({ level: 9 }); // Máxima compresión

            readStream.pipe(gzip).pipe(writeStream);

            writeStream.on('close', async () => {
                try {
                    const statsOriginal = await fs.stat(backupFile);
                    const statsComprimido = await fs.stat(archivoComprimido);

                    const reduccion = ((1 - statsComprimido.size / statsOriginal.size) * 100).toFixed(1);

                    console.log(`✅ Compresión completada: ${reduccion}% reducido`);
                    resolve(archivoComprimido);
                } catch (error) {
                    reject(error);
                }
            });

            readStream.on('error', reject);
            writeStream.on('error', reject);
            gzip.on('error', reject);
        });
    }

    /**
     * Limpiar backups antiguos
     */
    async limpiarBackupsAntiguos() {
        try {
            console.log('🧹 Limpiando backups antiguos...');

            const archivos = await fs.readdir(this.backupPath);
            const backups = archivos
                .filter(archivo => archivo.startsWith('dysa_point_') && (archivo.endsWith('.sql') || archivo.endsWith('.sql.gz')))
                .map(archivo => ({
                    nombre: archivo,
                    ruta: path.join(this.backupPath, archivo),
                    fecha: this.extraerFechaDeNombre(archivo)
                }))
                .filter(backup => backup.fecha)
                .sort((a, b) => b.fecha - a.fecha); // Más recientes primero

            const fechaLimite = new Date();
            fechaLimite.setDate(fechaLimite.getDate() - this.backupConfig.retention_dias);

            const backupsAEliminar = backups.filter(backup =>
                backup.fecha < fechaLimite || backups.indexOf(backup) >= this.backupConfig.max_backups
            );

            for (const backup of backupsAEliminar) {
                await fs.unlink(backup.ruta);
                console.log(`🗑️ Backup eliminado: ${backup.nombre}`);
            }

            if (backupsAEliminar.length > 0) {
                console.log(`✅ ${backupsAEliminar.length} backups antiguos eliminados`);
            }

        } catch (error) {
            console.error('Error limpiando backups antiguos:', error);
        }
    }

    /**
     * Extraer fecha del nombre del archivo de backup
     */
    extraerFechaDeNombre(nombreArchivo) {
        try {
            // Formato: dysa_point_2025-10-13T20-30-00-000Z.sql.gz
            const match = nombreArchivo.match(/dysa_point_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
            if (match) {
                const fechaString = match[1].replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/, 'T$1:$2:$3.$4Z');
                return new Date(fechaString);
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Actualizar estadísticas
     */
    async actualizarEstadisticas(archivoBackup, exitoso, duracion) {
        try {
            if (exitoso) {
                this.estadisticas.backups_completados++;
                this.estadisticas.ultimo_backup = new Date().toISOString();

                if (archivoBackup) {
                    const stats = await fs.stat(archivoBackup);
                    this.estadisticas.tamano_total += stats.size;
                }
            } else {
                this.estadisticas.backups_fallidos++;
            }

            this.calcularProximoBackup();

            // Guardar estadísticas
            const statsFile = path.join(this.configPath, 'backup_stats.json');
            await fs.writeFile(statsFile, JSON.stringify(this.estadisticas, null, 2));

        } catch (error) {
            console.error('Error actualizando estadísticas:', error);
        }
    }

    /**
     * Cargar estadísticas existentes
     */
    async cargarEstadisticas() {
        try {
            const statsFile = path.join(this.configPath, 'backup_stats.json');
            const statsContent = await fs.readFile(statsFile, 'utf8');
            this.estadisticas = { ...this.estadisticas, ...JSON.parse(statsContent) };
        } catch {
            // Si no existen estadísticas, usar valores por defecto
        }
    }

    /**
     * Calcular próximo backup
     */
    calcularProximoBackup() {
        const ahora = new Date();
        const proximoBackup = new Date(ahora.getTime() + (this.backupConfig.frecuencia_horas * 60 * 60 * 1000));
        this.estadisticas.proximo_backup = proximoBackup.toISOString();
    }

    /**
     * Obtener estadísticas del sistema
     */
    obtenerEstadisticas() {
        return {
            ...this.estadisticas,
            configuracion: this.backupConfig,
            jobs_activos: this.cronJobs.size,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Actualizar configuración
     */
    async actualizarConfiguracion(nuevaConfig) {
        this.backupConfig = { ...this.backupConfig, ...nuevaConfig };
        await this.guardarConfiguracion();

        // Reprogramar jobs si la frecuencia cambió
        if (nuevaConfig.frecuencia_horas) {
            await this.programarBackupAutomatico();
        }

        console.log('✅ Configuración de backup actualizada');
    }

    /**
     * Ejecutar backup manual
     */
    async ejecutarBackupManual() {
        console.log('🔧 Ejecutando backup manual...');
        return await this.ejecutarBackupCompleto();
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 BackupAutomaticoManager: Limpiando recursos...');

        // Detener todos los cron jobs
        this.cronJobs.forEach(job => job.stop());
        this.cronJobs.clear();

        this.removeAllListeners();
    }
}

module.exports = BackupAutomaticoManager;