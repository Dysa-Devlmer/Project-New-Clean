// ═══════════════════════════════════════════════════════════════
// DYSA POINT - SERVICIO DE BACKUP AUTOMÁTICO
// Backup diario de base de datos MySQL
// ═══════════════════════════════════════════════════════════════

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const log = require('electron-log');

class BackupService {
    constructor(config = {}) {
        this.config = {
            dbHost: config.dbHost || 'localhost',
            dbPort: config.dbPort || 3306,
            dbUser: config.dbUser || 'devlmer',
            dbPassword: config.dbPassword || 'devlmer2025',
            dbName: config.dbName || 'dysa_point',
            backupDir: config.backupDir || path.join(process.env.APPDATA, 'DYSA Point', 'backups'),
            maxBackups: config.maxBackups || 30, // Mantener últimos 30 backups
            autoBackupHour: config.autoBackupHour || 3 // 3 AM por defecto
        };

        this.backupInterval = null;
        this.mysqldumpPath = this.findMysqldumpPath();

        // Crear directorio de backups si no existe
        if (!fs.existsSync(this.config.backupDir)) {
            fs.mkdirSync(this.config.backupDir, { recursive: true });
            log.info('Directorio de backups creado:', this.config.backupDir);
        }
    }

    /**
     * Encuentra la ruta de mysqldump en el sistema
     */
    findMysqldumpPath() {
        const possiblePaths = [
            'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
            'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysqldump.exe',
            'C:\\Program Files (x86)\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
            'mysqldump' // En PATH del sistema
        ];

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                log.info('mysqldump encontrado en:', p);
                return p;
            }
        }

        log.warn('mysqldump no encontrado en rutas comunes, usando "mysqldump" del PATH');
        return 'mysqldump';
    }

    /**
     * Realiza un backup manual de la base de datos
     * @returns {Promise<string>} Ruta del archivo de backup creado
     */
    async realizarBackup() {
        return new Promise((resolve, reject) => {
            const timestamp = new Date().toISOString()
                .replace(/[:.]/g, '-')
                .substring(0, 19); // YYYY-MM-DDTHH-MM-SS

            const fileName = `dysa_point_backup_${timestamp}.sql`;
            const filePath = path.join(this.config.backupDir, fileName);

            log.info('Iniciando backup de base de datos...');
            log.info('Archivo:', filePath);

            const args = [
                `-h${this.config.dbHost}`,
                `-P${this.config.dbPort}`,
                `-u${this.config.dbUser}`,
                `-p${this.config.dbPassword}`,
                '--single-transaction',
                '--quick',
                '--lock-tables=false',
                '--routines',
                '--triggers',
                this.config.dbName
            ];

            // Crear stream de escritura
            const writeStream = fs.createWriteStream(filePath);

            // Ejecutar mysqldump
            const mysqldump = spawn(this.mysqldumpPath, args, {
                stdio: ['ignore', 'pipe', 'pipe']
            });

            // Pipe stdout al archivo
            mysqldump.stdout.pipe(writeStream);

            let errorOutput = '';
            mysqldump.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            mysqldump.on('error', (error) => {
                log.error('Error al ejecutar mysqldump:', error);
                reject(error);
            });

            mysqldump.on('close', (code) => {
                if (code === 0) {
                    const stats = fs.statSync(filePath);
                    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

                    log.info(`✓ Backup completado: ${fileName} (${sizeMB} MB)`);

                    // Limpiar backups antiguos
                    this.limpiarBackupsAntiguos();

                    resolve(filePath);
                } else {
                    log.error('mysqldump terminó con código:', code);
                    log.error('Error output:', errorOutput);

                    // Eliminar archivo incompleto
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }

                    reject(new Error(`mysqldump falló con código ${code}: ${errorOutput}`));
                }
            });
        });
    }

    /**
     * Elimina backups antiguos, manteniendo solo los últimos N
     */
    limpiarBackupsAntiguos() {
        try {
            const files = fs.readdirSync(this.config.backupDir)
                .filter(f => f.startsWith('dysa_point_backup_') && f.endsWith('.sql'))
                .map(f => ({
                    name: f,
                    path: path.join(this.config.backupDir, f),
                    time: fs.statSync(path.join(this.config.backupDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Más reciente primero

            // Eliminar los que sobren
            if (files.length > this.config.maxBackups) {
                const toDelete = files.slice(this.config.maxBackups);

                toDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    log.info(`Backup antiguo eliminado: ${file.name}`);
                });

                log.info(`Limpieza completada: ${toDelete.length} backups eliminados`);
            }
        } catch (error) {
            log.error('Error al limpiar backups antiguos:', error);
        }
    }

    /**
     * Programa backups automáticos diarios
     */
    iniciarBackupsAutomaticos() {
        log.info('Iniciando servicio de backups automáticos...');
        log.info(`Hora programada: ${this.config.autoBackupHour}:00`);
        log.info(`Backups a mantener: ${this.config.maxBackups}`);

        // Verificar cada hora si es tiempo de hacer backup
        this.backupInterval = setInterval(() => {
            const ahora = new Date();
            const hora = ahora.getHours();

            if (hora === this.config.autoBackupHour && ahora.getMinutes() === 0) {
                log.info('⏰ Iniciando backup automático programado...');
                this.realizarBackup()
                    .then((filePath) => {
                        log.info('✓ Backup automático completado:', filePath);
                    })
                    .catch((error) => {
                        log.error('❌ Error en backup automático:', error);
                    });
            }
        }, 60000); // Verificar cada minuto

        // Hacer un backup inmediato al iniciar (solo si no hay backup de hoy)
        this.verificarBackupHoy().then((tieneBackupHoy) => {
            if (!tieneBackupHoy) {
                log.info('No hay backup de hoy, realizando backup inicial...');
                this.realizarBackup()
                    .then(() => log.info('✓ Backup inicial completado'))
                    .catch((error) => log.error('Error en backup inicial:', error));
            } else {
                log.info('Ya existe un backup de hoy');
            }
        });

        log.info('✓ Servicio de backups automáticos iniciado');
    }

    /**
     * Detiene los backups automáticos
     */
    detenerBackupsAutomaticos() {
        if (this.backupInterval) {
            clearInterval(this.backupInterval);
            this.backupInterval = null;
            log.info('Servicio de backups automáticos detenido');
        }
    }

    /**
     * Verifica si ya existe un backup de hoy
     */
    async verificarBackupHoy() {
        try {
            const hoy = new Date().toISOString().substring(0, 10); // YYYY-MM-DD

            const files = fs.readdirSync(this.config.backupDir)
                .filter(f => f.startsWith('dysa_point_backup_') && f.includes(hoy));

            return files.length > 0;
        } catch (error) {
            log.error('Error al verificar backups de hoy:', error);
            return false;
        }
    }

    /**
     * Obtiene la lista de backups disponibles
     */
    obtenerListaBackups() {
        try {
            const files = fs.readdirSync(this.config.backupDir)
                .filter(f => f.startsWith('dysa_point_backup_') && f.endsWith('.sql'))
                .map(f => {
                    const filePath = path.join(this.config.backupDir, f);
                    const stats = fs.statSync(filePath);

                    return {
                        nombre: f,
                        ruta: filePath,
                        tamaño: stats.size,
                        tamañoMB: (stats.size / (1024 * 1024)).toFixed(2),
                        fecha: stats.mtime
                    };
                })
                .sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

            return files;
        } catch (error) {
            log.error('Error al obtener lista de backups:', error);
            return [];
        }
    }

    /**
     * Restaura la base de datos desde un archivo de backup
     * @param {string} backupFile - Ruta completa al archivo de backup
     */
    async restaurarBackup(backupFile) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(backupFile)) {
                reject(new Error('Archivo de backup no encontrado'));
                return;
            }

            log.info('Restaurando backup:', backupFile);

            const mysqlPath = this.mysqldumpPath.replace('mysqldump.exe', 'mysql.exe');

            const args = [
                `-h${this.config.dbHost}`,
                `-P${this.config.dbPort}`,
                `-u${this.config.dbUser}`,
                `-p${this.config.dbPassword}`,
                this.config.dbName
            ];

            const readStream = fs.createReadStream(backupFile);
            const mysql = spawn(mysqlPath, args, {
                stdio: ['pipe', 'pipe', 'pipe']
            });

            // Pipe el archivo al stdin de mysql
            readStream.pipe(mysql.stdin);

            let errorOutput = '';
            mysql.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            mysql.on('error', (error) => {
                log.error('Error al ejecutar mysql:', error);
                reject(error);
            });

            mysql.on('close', (code) => {
                if (code === 0) {
                    log.info('✓ Backup restaurado correctamente');
                    resolve();
                } else {
                    log.error('mysql terminó con código:', code);
                    log.error('Error output:', errorOutput);
                    reject(new Error(`Restauración falló con código ${code}: ${errorOutput}`));
                }
            });
        });
    }
}

module.exports = BackupService;
