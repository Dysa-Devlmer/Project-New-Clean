/**
 * DYSA Point - Rutas del Sistema de Backup Automático
 * API REST para gestión de backup empresarial automático
 *
 * Sistema de Producción - Backup Automático Empresarial
 * Compatible con MySQL y protección de datos críticos
 *
 * @author DYSA Point Development Team
 * @version 2.0.14
 * @date 2025-10-13
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const fs = require('fs').promises;
const path = require('path');

class BackupAutomaticoRoutes {
    constructor(backupAutomaticoManager, database) {
        this.backupAutomaticoManager = backupAutomaticoManager;
        this.database = database;
        this.router = express.Router();
        this.setupRateLimit();
        this.setupRoutes();
    }

    setupRateLimit() {
        // Rate limiting para backup (más restrictivo para operaciones de backup)
        this.backupRateLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minuto
            max: 5, // Solo 5 operaciones de backup por minuto
            message: {
                success: false,
                error: 'Demasiadas operaciones de backup. Límite: 5 por minuto.',
                code: 'BACKUP_RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        // Rate limiting general
        this.generalRateLimiter = rateLimit({
            windowMs: 60 * 1000,
            max: 30,
            message: {
                success: false,
                error: 'Demasiadas solicitudes. Límite: 30 por minuto.',
                code: 'RATE_LIMIT_EXCEEDED'
            }
        });

        this.router.use('/ejecutar', this.backupRateLimiter);
        this.router.use('/configurar', this.backupRateLimiter);
        this.router.use(this.generalRateLimiter);
    }

    setupRoutes() {
        // ==================== ENDPOINTS DE GESTIÓN DE BACKUP ====================

        // Obtener estadísticas del sistema de backup
        this.router.get('/estadisticas', async (req, res) => {
            try {
                const estadisticas = this.backupAutomaticoManager.obtenerEstadisticas();

                res.json({
                    success: true,
                    data: estadisticas,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo estadísticas de backup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo estadísticas de backup',
                    details: error.message
                });
            }
        });

        // Ejecutar backup manual
        this.router.post('/ejecutar', async (req, res) => {
            try {
                console.log('🔧 Iniciando backup manual por API...');

                const resultado = await this.backupAutomaticoManager.ejecutarBackupManual();

                res.json({
                    success: true,
                    message: 'Backup ejecutado exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error ejecutando backup manual:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error ejecutando backup manual',
                    details: error.message
                });
            }
        });

        // Obtener configuración actual de backup
        this.router.get('/configuracion', async (req, res) => {
            try {
                const estadisticas = this.backupAutomaticoManager.obtenerEstadisticas();

                res.json({
                    success: true,
                    data: {
                        configuracion: estadisticas.configuracion,
                        proximo_backup: estadisticas.proximo_backup,
                        jobs_activos: estadisticas.jobs_activos
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo configuración de backup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo configuración de backup',
                    details: error.message
                });
            }
        });

        // Actualizar configuración de backup
        this.router.put('/configuracion', async (req, res) => {
            try {
                const nuevaConfig = req.body;

                // Validación básica
                if (nuevaConfig.frecuencia_horas && (nuevaConfig.frecuencia_horas < 1 || nuevaConfig.frecuencia_horas > 168)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Frecuencia debe estar entre 1 y 168 horas (1 semana)'
                    });
                }

                if (nuevaConfig.retention_dias && (nuevaConfig.retention_dias < 1 || nuevaConfig.retention_dias > 365)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Retención debe estar entre 1 y 365 días'
                    });
                }

                await this.backupAutomaticoManager.actualizarConfiguracion(nuevaConfig);

                res.json({
                    success: true,
                    message: 'Configuración de backup actualizada exitosamente',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error actualizando configuración de backup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando configuración de backup',
                    details: error.message
                });
            }
        });

        // Listar backups disponibles
        this.router.get('/archivos', async (req, res) => {
            try {
                const { limite = 50, offset = 0 } = req.query;

                const backups = await this.listarBackupsDisponibles(parseInt(limite), parseInt(offset));

                res.json({
                    success: true,
                    data: backups,
                    pagination: {
                        limite: parseInt(limite),
                        offset: parseInt(offset),
                        total: backups.length
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error listando backups:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error listando backups disponibles',
                    details: error.message
                });
            }
        });

        // Descargar backup específico
        this.router.get('/descargar/:archivo', async (req, res) => {
            try {
                const nombreArchivo = req.params.archivo;

                // Validar nombre de archivo por seguridad
                if (!/^dysa_point_[\d\-T:Z]+\.sql(\.gz)?$/.test(nombreArchivo)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre de archivo inválido'
                    });
                }

                const backupPath = path.join(__dirname, '..', '..', 'backups', 'database');
                const archivoCompleto = path.join(backupPath, nombreArchivo);

                // Verificar que el archivo existe
                try {
                    await fs.access(archivoCompleto);
                } catch {
                    return res.status(404).json({
                        success: false,
                        error: 'Archivo de backup no encontrado'
                    });
                }

                // Configurar headers para descarga
                res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
                res.setHeader('Content-Type', 'application/octet-stream');

                // Enviar archivo
                res.sendFile(archivoCompleto);

            } catch (error) {
                console.error('Error descargando backup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error descargando backup',
                    details: error.message
                });
            }
        });

        // Eliminar backup específico
        this.router.delete('/archivos/:archivo', async (req, res) => {
            try {
                const nombreArchivo = req.params.archivo;

                // Validar nombre de archivo por seguridad
                if (!/^dysa_point_[\d\-T:Z]+\.sql(\.gz)?$/.test(nombreArchivo)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre de archivo inválido'
                    });
                }

                const backupPath = path.join(__dirname, '..', '..', 'backups', 'database');
                const archivoCompleto = path.join(backupPath, nombreArchivo);

                // Verificar que el archivo existe
                try {
                    await fs.access(archivoCompleto);
                } catch {
                    return res.status(404).json({
                        success: false,
                        error: 'Archivo de backup no encontrado'
                    });
                }

                // Eliminar archivo
                await fs.unlink(archivoCompleto);

                res.json({
                    success: true,
                    message: `Backup ${nombreArchivo} eliminado exitosamente`,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error eliminando backup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error eliminando backup',
                    details: error.message
                });
            }
        });

        // Verificar integridad de backup específico
        this.router.post('/verificar/:archivo', async (req, res) => {
            try {
                const nombreArchivo = req.params.archivo;

                // Validar nombre de archivo por seguridad
                if (!/^dysa_point_[\d\-T:Z]+\.sql(\.gz)?$/.test(nombreArchivo)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre de archivo inválido'
                    });
                }

                const resultado = await this.verificarIntegridadArchivo(nombreArchivo);

                res.json({
                    success: true,
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error verificando backup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error verificando integridad del backup',
                    details: error.message
                });
            }
        });

        // Restaurar desde backup específico (PELIGROSO - requiere confirmación)
        this.router.post('/restaurar/:archivo', async (req, res) => {
            try {
                const nombreArchivo = req.params.archivo;
                const { confirmar = false, backup_actual = false } = req.body;

                if (!confirmar) {
                    return res.status(400).json({
                        success: false,
                        error: 'Restauración requiere confirmación explícita',
                        warning: 'Esta operación reemplazará todos los datos actuales'
                    });
                }

                // Validar nombre de archivo por seguridad
                if (!/^dysa_point_[\d\-T:Z]+\.sql(\.gz)?$/.test(nombreArchivo)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre de archivo inválido'
                    });
                }

                // Crear backup actual si se solicita
                if (backup_actual) {
                    await this.backupAutomaticoManager.ejecutarBackupManual();
                }

                const resultado = await this.restaurarDesdeBackup(nombreArchivo);

                res.json({
                    success: true,
                    message: 'Restauración completada exitosamente',
                    data: resultado,
                    warning: 'Sistema reiniciado con datos restaurados',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error restaurando backup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error restaurando desde backup',
                    details: error.message
                });
            }
        });

        // Obtener espacio en disco utilizado por backups
        this.router.get('/espacio-disco', async (req, res) => {
            try {
                const espacioDisco = await this.obtenerEspacioDisco();

                res.json({
                    success: true,
                    data: espacioDisco,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo espacio en disco:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo información de espacio en disco',
                    details: error.message
                });
            }
        });

        // Health check del sistema de backup
        this.router.get('/health', async (req, res) => {
            try {
                const health = await this.verificarSaludSistemaBackup();

                res.json({
                    success: true,
                    status: health.status,
                    data: health,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error verificando salud del sistema de backup:', error);
                res.status(503).json({
                    success: false,
                    status: 'unhealthy',
                    error: 'Error verificando salud del sistema de backup',
                    details: error.message
                });
            }
        });

        console.log('✅ Rutas del Sistema de Backup Automático configuradas');
        console.log('💾 Total de endpoints implementados: 10 endpoints especializados');
    }

    /**
     * Listar backups disponibles
     */
    async listarBackupsDisponibles(limite, offset) {
        const backupPath = path.join(__dirname, '..', '..', 'backups', 'database');

        try {
            const archivos = await fs.readdir(backupPath);
            const backups = [];

            for (const archivo of archivos) {
                if (archivo.startsWith('dysa_point_') && (archivo.endsWith('.sql') || archivo.endsWith('.sql.gz'))) {
                    const archivoCompleto = path.join(backupPath, archivo);
                    const stats = await fs.stat(archivoCompleto);

                    const fecha = this.extraerFechaDeNombre(archivo);

                    backups.push({
                        nombre: archivo,
                        tamaño: stats.size,
                        tamaño_formateado: this.formatearTamano(stats.size),
                        fecha_creacion: fecha ? fecha.toISOString() : stats.birthtime.toISOString(),
                        fecha_modificacion: stats.mtime.toISOString(),
                        comprimido: archivo.endsWith('.gz'),
                        tipo: 'database'
                    });
                }
            }

            // Ordenar por fecha (más recientes primero)
            backups.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

            // Aplicar paginación
            return backups.slice(offset, offset + limite);

        } catch (error) {
            throw new Error(`Error listando backups: ${error.message}`);
        }
    }

    /**
     * Extraer fecha del nombre del archivo
     */
    extraerFechaDeNombre(nombreArchivo) {
        try {
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
     * Formatear tamaño de archivo
     */
    formatearTamano(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Verificar integridad de archivo de backup
     */
    async verificarIntegridadArchivo(nombreArchivo) {
        const backupPath = path.join(__dirname, '..', '..', 'backups', 'database');
        const archivoCompleto = path.join(backupPath, nombreArchivo);

        try {
            const stats = await fs.stat(archivoCompleto);

            let contenido;
            if (nombreArchivo.endsWith('.gz')) {
                // Descomprimir para verificar
                const zlib = require('zlib');
                const compressed = await fs.readFile(archivoCompleto);
                contenido = zlib.gunzipSync(compressed).toString('utf8', 0, 5000); // Solo los primeros 5KB
            } else {
                contenido = await fs.readFile(archivoCompleto, 'utf8');
                contenido = contenido.substring(0, 5000); // Solo los primeros 5KB para verificación
            }

            const verificaciones = {
                tamaño_valido: stats.size > 1000,
                header_mysql: contenido.includes('-- MySQL dump'),
                tablas_presentes: contenido.includes('CREATE TABLE'),
                datos_presentes: contenido.includes('INSERT INTO'),
                estructura_completa: contenido.includes('-- Dump completed')
            };

            const integridad = Object.values(verificaciones).every(v => v);

            return {
                archivo: nombreArchivo,
                tamaño: stats.size,
                tamaño_formateado: this.formatearTamano(stats.size),
                verificaciones: verificaciones,
                integro: integridad,
                fecha_verificacion: new Date().toISOString()
            };

        } catch (error) {
            throw new Error(`Error verificando archivo: ${error.message}`);
        }
    }

    /**
     * Restaurar desde backup (PELIGROSO)
     */
    async restaurarDesdeBackup(nombreArchivo) {
        const backupPath = path.join(__dirname, '..', '..', 'backups', 'database');
        const archivoCompleto = path.join(backupPath, nombreArchivo);

        console.log(`⚠️ RESTAURANDO DESDE BACKUP: ${nombreArchivo}`);

        // Esta es una operación muy peligrosa - en producción debería tener más validaciones
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');

            let comando, args;

            if (nombreArchivo.endsWith('.gz')) {
                // Restaurar archivo comprimido
                comando = 'zcat'; // En Windows podría ser diferente
                args = [archivoCompleto];
            } else {
                comando = 'cat';
                args = [archivoCompleto];
            }

            const mysqlPath = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysql.exe';
            const mysqlArgs = [
                '-u', 'devlmer',
                '-pdevlmer2025',
                'dysa_point'
            ];

            const catProcess = spawn(comando, args);
            const mysqlProcess = spawn(mysqlPath, mysqlArgs);

            catProcess.stdout.pipe(mysqlProcess.stdin);

            let errorOutput = '';
            mysqlProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            mysqlProcess.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error(`Error en restauración: ${errorOutput}`));
                } else {
                    resolve({
                        archivo: nombreArchivo,
                        mensaje: 'Restauración completada exitosamente',
                        timestamp: new Date().toISOString()
                    });
                }
            });

            catProcess.on('error', reject);
            mysqlProcess.on('error', reject);
        });
    }

    /**
     * Obtener información de espacio en disco
     */
    async obtenerEspacioDisco() {
        const backupPath = path.join(__dirname, '..', '..', 'backups');

        try {
            const calcularTamanoDirectorio = async (directorio) => {
                let tamanoTotal = 0;
                let cantidadArchivos = 0;

                const archivos = await fs.readdir(directorio);

                for (const archivo of archivos) {
                    const rutaCompleta = path.join(directorio, archivo);
                    const stats = await fs.stat(rutaCompleta);

                    if (stats.isDirectory()) {
                        const subInfo = await calcularTamanoDirectorio(rutaCompleta);
                        tamanoTotal += subInfo.tamaño;
                        cantidadArchivos += subInfo.archivos;
                    } else {
                        tamanoTotal += stats.size;
                        cantidadArchivos++;
                    }
                }

                return { tamaño: tamanoTotal, archivos: cantidadArchivos };
            };

            const info = await calcularTamanoDirectorio(backupPath);

            return {
                directorio: backupPath,
                tamaño_total: info.tamaño,
                tamaño_formateado: this.formatearTamano(info.tamaño),
                cantidad_archivos: info.archivos,
                subdirectorios: {
                    database: await this.obtenerInfoSubdirectorio(path.join(backupPath, 'database')),
                    config: await this.obtenerInfoSubdirectorio(path.join(backupPath, 'config')),
                    logs: await this.obtenerInfoSubdirectorio(path.join(backupPath, 'logs'))
                }
            };

        } catch (error) {
            throw new Error(`Error calculando espacio: ${error.message}`);
        }
    }

    /**
     * Obtener información de subdirectorio
     */
    async obtenerInfoSubdirectorio(directorio) {
        try {
            await fs.access(directorio);
            const archivos = await fs.readdir(directorio);

            let tamanoTotal = 0;
            for (const archivo of archivos) {
                const stats = await fs.stat(path.join(directorio, archivo));
                tamanoTotal += stats.size;
            }

            return {
                existe: true,
                archivos: archivos.length,
                tamaño: tamanoTotal,
                tamaño_formateado: this.formatearTamano(tamanoTotal)
            };
        } catch {
            return {
                existe: false,
                archivos: 0,
                tamaño: 0,
                tamaño_formateado: '0 Bytes'
            };
        }
    }

    /**
     * Verificar salud del sistema de backup
     */
    async verificarSaludSistemaBackup() {
        const health = {
            status: 'healthy',
            checks: {}
        };

        // Verificar directorio de backup
        try {
            const backupPath = path.join(__dirname, '..', '..', 'backups', 'database');
            await fs.access(backupPath);
            health.checks.backup_directory = { status: 'ok' };
        } catch {
            health.checks.backup_directory = { status: 'error', message: 'Directorio de backup no accesible' };
            health.status = 'unhealthy';
        }

        // Verificar último backup
        const estadisticas = this.backupAutomaticoManager.obtenerEstadisticas();
        if (estadisticas.ultimo_backup) {
            const ultimoBackup = new Date(estadisticas.ultimo_backup);
            const horasDesdeUltimo = (Date.now() - ultimoBackup.getTime()) / (1000 * 60 * 60);

            if (horasDesdeUltimo > estadisticas.configuracion.frecuencia_horas * 2) {
                health.checks.ultimo_backup = {
                    status: 'warning',
                    message: `Último backup hace ${horasDesdeUltimo.toFixed(1)} horas`
                };
                health.status = 'degraded';
            } else {
                health.checks.ultimo_backup = { status: 'ok' };
            }
        } else {
            health.checks.ultimo_backup = {
                status: 'warning',
                message: 'No hay registro de backups'
            };
            health.status = 'degraded';
        }

        // Verificar jobs programados
        health.checks.jobs_programados = {
            status: estadisticas.jobs_activos > 0 ? 'ok' : 'warning',
            jobs_activos: estadisticas.jobs_activos
        };

        return health;
    }

    getRouter() {
        return this.router;
    }
}

module.exports = BackupAutomaticoRoutes;