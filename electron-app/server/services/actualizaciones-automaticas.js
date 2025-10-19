/**
 * DYSA Point POS v2.0.14 - Sistema de Actualizaciones Automáticas
 *
 * Sistema empresarial de actualizaciones automáticas para mantenimiento
 * continuo en restaurantes de producción. Garantiza que el sistema se
 * mantenga actualizado con las últimas mejoras y parches de seguridad.
 *
 * Características Empresariales:
 * - Verificación automática de actualizaciones remotas
 * - Descarga e instalación automatizada de nuevas versiones
 * - Sistema de rollback automático en caso de fallas
 * - Ventanas de mantenimiento programables
 * - Backup automático antes de actualizaciones
 * - Verificación de integridad de archivos
 * - Notificaciones multi-canal de actualizaciones
 * - Gestión de dependencias y compatibilidad
 * - Logs detallados de todo el proceso
 * - Modo de actualización silenciosa para horarios no críticos
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');
const archiver = require('archiver');
const yauzl = require('yauzl');
const semver = require('semver');
const cron = require('node-cron');

class ActualizacionesAutomaticasManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.configPath = path.join(__dirname, '..', '..', 'config');
        this.updatePath = path.join(__dirname, '..', '..', 'updates');
        this.backupPath = path.join(__dirname, '..', '..', 'backup-updates');
        this.tempPath = path.join(__dirname, '..', '..', 'temp-updates');

        // Configuración del sistema de actualizaciones
        this.configuracion = {
            servidor_actualizaciones: 'https://updates.dysapoint.com',
            servidor_fallback: 'https://updates-backup.dysapoint.com',
            verificar_cada_horas: 6,
            ventana_mantenimiento: {
                inicio: '02:00',
                fin: '05:00',
                zona_horaria: 'America/Santiago'
            },
            auto_instalar: false,
            backup_antes_actualizar: true,
            rollback_automatico: true,
            tiempo_espera_rollback: 300, // 5 minutos
            verificar_integridad: true,
            notificar_actualizaciones: true,
            modo_silencioso: true
        };

        // Estado del sistema de actualizaciones
        this.estado = {
            verificando: false,
            descargando: false,
            instalando: false,
            version_actual: '2.0.14',
            version_disponible: null,
            ultima_verificacion: null,
            proximo_mantenimiento: null,
            actualizaciones_pendientes: [],
            rollback_disponible: false
        };

        // Jobs programados
        this.cronJobs = new Map();

        // Cache de verificaciones
        this.cache = new Map();

        this.inicializar();
    }

    async inicializar() {
        try {
            console.log('🔄 Inicializando ActualizacionesAutomaticasManager...');

            // Crear directorios necesarios
            await this.crearDirectorios();

            // Cargar configuración
            await this.cargarConfiguracion();

            // Verificar dependencias
            await this.verificarDependencias();

            // Programar verificaciones automáticas
            await this.programarVerificaciones();

            // Verificar estado de rollback
            await this.verificarRollbackDisponible();

            console.log('✅ ActualizacionesAutomaticasManager inicializado correctamente');
            this.emit('sistema-inicializado', { timestamp: new Date() });

        } catch (error) {
            console.error('❌ Error inicializando ActualizacionesAutomaticasManager:', error);
            this.emit('error-inicializacion', { error, timestamp: new Date() });
            throw error;
        }
    }

    async crearDirectorios() {
        const directorios = [
            this.updatePath,
            this.backupPath,
            this.tempPath,
            path.join(this.updatePath, 'downloads'),
            path.join(this.updatePath, 'staging'),
            path.join(this.backupPath, 'pre-update'),
            path.join(this.backupPath, 'rollback')
        ];

        for (const directorio of directorios) {
            try {
                await fs.mkdir(directorio, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }

    async cargarConfiguracion() {
        const configFile = path.join(this.configPath, 'actualizaciones-config.json');

        try {
            const configData = await fs.readFile(configFile, 'utf8');
            const config = JSON.parse(configData);
            this.configuracion = { ...this.configuracion, ...config };
        } catch (error) {
            // Si no existe config, usar valores por defecto y crear archivo
            await this.guardarConfiguracion();
        }
    }

    async guardarConfiguracion() {
        const configFile = path.join(this.configPath, 'actualizaciones-config.json');
        await fs.writeFile(configFile, JSON.stringify(this.configuracion, null, 2));
    }

    async verificarDependencias() {
        const dependencias = ['semver', 'yauzl'];

        for (const dep of dependencias) {
            try {
                require(dep);
            } catch (error) {
                console.warn(`⚠️ Dependencia ${dep} no encontrada, instalando...`);
                try {
                    execSync(`npm install ${dep}`, { stdio: 'inherit' });
                } catch (installError) {
                    throw new Error(`No se pudo instalar dependencia ${dep}: ${installError.message}`);
                }
            }
        }
    }

    async programarVerificaciones() {
        // Programar verificación cada N horas
        const cronExpression = `0 */${this.configuracion.verificar_cada_horas} * * *`;

        const verificacionJob = cron.schedule(cronExpression, async () => {
            if (!this.estado.verificando) {
                await this.verificarActualizaciones();
            }
        }, {
            scheduled: false,
            timezone: this.configuracion.ventana_mantenimiento.zona_horaria
        });

        this.cronJobs.set('verificacion-automatica', verificacionJob);

        // Programar ventana de mantenimiento
        const [horaInicio] = this.configuracion.ventana_mantenimiento.inicio.split(':');
        const mantenimientoCron = `0 ${horaInicio} * * *`;

        const mantenimientoJob = cron.schedule(mantenimientoCron, async () => {
            await this.ejecutarMantenimientoProgramado();
        }, {
            scheduled: false,
            timezone: this.configuracion.ventana_mantenimiento.zona_horaria
        });

        this.cronJobs.set('ventana-mantenimiento', mantenimientoJob);

        // Iniciar jobs
        verificacionJob.start();
        mantenimientoJob.start();

        console.log('⏰ Verificaciones automáticas programadas correctamente');
    }

    async verificarActualizaciones() {
        if (this.estado.verificando) {
            console.log('⚠️ Verificación ya en progreso');
            return null;
        }

        this.estado.verificando = true;
        this.estado.ultima_verificacion = new Date();

        try {
            console.log('🔍 Verificando actualizaciones disponibles...');

            const versionInfo = await this.consultarServidorActualizaciones();

            if (!versionInfo) {
                console.log('ℹ️ No se pudo conectar al servidor de actualizaciones');
                return null;
            }

            const { version, changelog, download_url, checksum, compatibilidad } = versionInfo;

            // Verificar si hay nueva versión
            if (semver.gt(version, this.estado.version_actual)) {
                console.log(`🆕 Nueva versión disponible: ${version} (actual: ${this.estado.version_actual})`);

                const actualizacion = {
                    version,
                    changelog,
                    download_url,
                    checksum,
                    compatibilidad,
                    fecha_disponible: new Date(),
                    instalada: false
                };

                // Verificar compatibilidad
                if (await this.verificarCompatibilidad(compatibilidad)) {
                    this.estado.version_disponible = version;
                    this.estado.actualizaciones_pendientes.push(actualizacion);

                    console.log('✅ Actualización compatible encontrada');
                    this.emit('actualizacion-disponible', actualizacion);

                    // Auto-instalar si está configurado y estamos en ventana de mantenimiento
                    if (this.configuracion.auto_instalar && await this.estaEnVentanaMantenimiento()) {
                        await this.descargarEInstalarActualizacion(actualizacion);
                    }

                    return actualizacion;
                } else {
                    console.log('⚠️ Actualización no compatible con el sistema actual');
                    this.emit('actualizacion-incompatible', actualizacion);
                }
            } else {
                console.log('✅ Sistema actualizado a la última versión');
            }

            return null;

        } catch (error) {
            console.error('❌ Error verificando actualizaciones:', error);
            this.emit('error-verificacion', { error, timestamp: new Date() });
            throw error;
        } finally {
            this.estado.verificando = false;
        }
    }

    async consultarServidorActualizaciones() {
        const servidores = [
            this.configuracion.servidor_actualizaciones,
            this.configuracion.servidor_fallback
        ];

        for (const servidor of servidores) {
            try {
                const url = `${servidor}/api/updates/check?version=${this.estado.version_actual}&platform=${process.platform}`;
                const response = await this.realizarPeticionHTTP(url);

                if (response.success) {
                    return response.data;
                }
            } catch (error) {
                console.warn(`⚠️ Error consultando servidor ${servidor}:`, error.message);
                continue;
            }
        }

        return null;
    }

    async realizarPeticionHTTP(url) {
        return new Promise((resolve, reject) => {
            const isHttps = url.startsWith('https:');
            const client = isHttps ? https : http;

            const options = {
                timeout: 30000,
                headers: {
                    'User-Agent': `DYSA-Point-POS/${this.estado.version_actual}`,
                    'Content-Type': 'application/json'
                }
            };

            const req = client.get(url, options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve(jsonData);
                    } catch (error) {
                        reject(new Error('Respuesta inválida del servidor'));
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Timeout en petición HTTP'));
            });

            req.on('error', (error) => {
                reject(error);
            });
        });
    }

    async verificarCompatibilidad(compatibilidad) {
        if (!compatibilidad) return true;

        // Verificar versión de Node.js
        if (compatibilidad.node_version) {
            const nodeVersion = process.version;
            if (!semver.satisfies(nodeVersion, compatibilidad.node_version)) {
                console.log(`❌ Versión de Node.js no compatible. Requerida: ${compatibilidad.node_version}, actual: ${nodeVersion}`);
                return false;
            }
        }

        // Verificar plataforma
        if (compatibilidad.platforms && !compatibilidad.platforms.includes(process.platform)) {
            console.log(`❌ Plataforma no soportada: ${process.platform}`);
            return false;
        }

        // Verificar espacio en disco
        if (compatibilidad.disk_space_mb) {
            const espacioDisponible = await this.obtenerEspacioDisponible();
            if (espacioDisponible < compatibilidad.disk_space_mb) {
                console.log(`❌ Espacio insuficiente. Requerido: ${compatibilidad.disk_space_mb}MB, disponible: ${espacioDisponible}MB`);
                return false;
            }
        }

        return true;
    }

    async obtenerEspacioDisponible() {
        try {
            const stats = await fs.statfs(process.cwd());
            return Math.round(stats.bavail * stats.bsize / 1024 / 1024); // MB
        } catch (error) {
            console.warn('⚠️ No se pudo verificar espacio en disco');
            return Infinity; // Asumir espacio suficiente si no se puede verificar
        }
    }

    async descargarEInstalarActualizacion(actualizacion) {
        try {
            console.log(`📥 Iniciando descarga de actualización ${actualizacion.version}...`);
            this.estado.descargando = true;

            // Crear backup antes de actualizar
            if (this.configuracion.backup_antes_actualizar) {
                await this.crearBackupPreActualizacion();
            }

            // Descargar archivo de actualización
            const archivoDescarga = await this.descargarArchivo(actualizacion);

            // Verificar integridad
            if (this.configuracion.verificar_integridad) {
                await this.verificarIntegridad(archivoDescarga, actualizacion.checksum);
            }

            // Extraer archivos
            const directorioStaging = await this.extraerActualizacion(archivoDescarga);

            // Instalar actualización
            await this.instalarActualizacion(directorioStaging, actualizacion);

            console.log(`✅ Actualización ${actualizacion.version} instalada exitosamente`);
            this.emit('actualizacion-instalada', actualizacion);

            return true;

        } catch (error) {
            console.error('❌ Error instalando actualización:', error);
            this.emit('error-actualizacion', { error, actualizacion });

            // Rollback automático si está configurado
            if (this.configuracion.rollback_automatico) {
                await this.ejecutarRollback();
            }

            throw error;
        } finally {
            this.estado.descargando = false;
            this.estado.instalando = false;
        }
    }

    async descargarArchivo(actualizacion) {
        return new Promise((resolve, reject) => {
            const fileName = `update-${actualizacion.version}.zip`;
            const filePath = path.join(this.updatePath, 'downloads', fileName);
            const file = require('fs').createWriteStream(filePath);

            const isHttps = actualizacion.download_url.startsWith('https:');
            const client = isHttps ? https : http;

            const request = client.get(actualizacion.download_url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Error HTTP: ${response.statusCode}`));
                    return;
                }

                const totalSize = parseInt(response.headers['content-length'], 10);
                let downloadedSize = 0;

                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    const progress = Math.round((downloadedSize / totalSize) * 100);

                    if (downloadedSize % (1024 * 1024) === 0) { // Cada MB
                        console.log(`📥 Descargando: ${progress}% (${Math.round(downloadedSize / 1024 / 1024)}MB)`);
                    }
                });

                response.pipe(file);

                file.on('finish', () => {
                    file.close();
                    console.log('✅ Descarga completada');
                    resolve(filePath);
                });
            });

            request.on('error', (error) => {
                fs.unlink(filePath).catch(() => {}); // Limpiar archivo parcial
                reject(error);
            });

            file.on('error', (error) => {
                fs.unlink(filePath).catch(() => {});
                reject(error);
            });
        });
    }

    async verificarIntegridad(archivoPath, checksumEsperado) {
        if (!checksumEsperado) {
            console.log('⚠️ No se proporcionó checksum, saltando verificación');
            return true;
        }

        console.log('🔍 Verificando integridad del archivo...');

        const fileBuffer = await fs.readFile(archivoPath);
        const hash = crypto.createHash('sha256');
        hash.update(fileBuffer);
        const checksumCalculado = hash.digest('hex');

        if (checksumCalculado !== checksumEsperado) {
            throw new Error(`Checksum inválido. Esperado: ${checksumEsperado}, calculado: ${checksumCalculado}`);
        }

        console.log('✅ Integridad del archivo verificada');
        return true;
    }

    async extraerActualizacion(archivoZip) {
        const directorioStaging = path.join(this.updatePath, 'staging', `update-${Date.now()}`);
        await fs.mkdir(directorioStaging, { recursive: true });

        return new Promise((resolve, reject) => {
            yauzl.open(archivoZip, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    reject(err);
                    return;
                }

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if (/\/$/.test(entry.fileName)) {
                        // Directorio
                        const dirPath = path.join(directorioStaging, entry.fileName);
                        fs.mkdir(dirPath, { recursive: true }).then(() => {
                            zipfile.readEntry();
                        }).catch(reject);
                    } else {
                        // Archivo
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            const filePath = path.join(directorioStaging, entry.fileName);
                            const writeStream = require('fs').createWriteStream(filePath);

                            readStream.pipe(writeStream);

                            writeStream.on('close', () => {
                                zipfile.readEntry();
                            });

                            writeStream.on('error', reject);
                        });
                    }
                });

                zipfile.on('end', () => {
                    console.log('✅ Archivos extraídos correctamente');
                    resolve(directorioStaging);
                });

                zipfile.on('error', reject);
            });
        });
    }

    async instalarActualizacion(directorioStaging, actualizacion) {
        console.log('🔧 Instalando actualización...');
        this.estado.instalando = true;

        try {
            // Verificar que existe script de instalación
            const scriptInstalacion = path.join(directorioStaging, 'install.js');
            const existeScript = await fs.access(scriptInstalacion).then(() => true).catch(() => false);

            if (existeScript) {
                // Ejecutar script de instalación personalizado
                await this.ejecutarScriptInstalacion(scriptInstalacion, actualizacion);
            } else {
                // Instalación estándar
                await this.instalacionEstandar(directorioStaging, actualizacion);
            }

            // Actualizar versión en estado
            this.estado.version_actual = actualizacion.version;

            // Marcar actualización como instalada
            const actualizacionIndex = this.estado.actualizaciones_pendientes.findIndex(
                a => a.version === actualizacion.version
            );
            if (actualizacionIndex !== -1) {
                this.estado.actualizaciones_pendientes[actualizacionIndex].instalada = true;
            }

            // Programar verificación de estabilidad
            setTimeout(() => {
                this.verificarEstabilidadPostActualizacion(actualizacion);
            }, this.configuracion.tiempo_espera_rollback * 1000);

        } catch (error) {
            console.error('❌ Error en instalación:', error);
            throw error;
        }
    }

    async ejecutarScriptInstalacion(scriptPath, actualizacion) {
        return new Promise((resolve, reject) => {
            const child = spawn('node', [scriptPath], {
                cwd: path.dirname(scriptPath),
                env: {
                    ...process.env,
                    UPDATE_VERSION: actualizacion.version,
                    INSTALL_PATH: process.cwd()
                },
                stdio: 'pipe'
            });

            let output = '';

            child.stdout.on('data', (data) => {
                const texto = data.toString();
                output += texto;
                console.log(`📦 [Install]: ${texto.trim()}`);
            });

            child.stderr.on('data', (data) => {
                const texto = data.toString();
                output += texto;
                console.error(`📦 [Install Error]: ${texto.trim()}`);
            });

            child.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Script de instalación ejecutado exitosamente');
                    resolve(output);
                } else {
                    reject(new Error(`Script de instalación falló con código ${code}`));
                }
            });

            child.on('error', (error) => {
                reject(new Error(`Error ejecutando script: ${error.message}`));
            });
        });
    }

    async instalacionEstandar(directorioStaging, actualizacion) {
        console.log('📦 Ejecutando instalación estándar...');

        // Copiar archivos nuevos/modificados
        const manifestPath = path.join(directorioStaging, 'manifest.json');
        let manifest = null;

        try {
            const manifestData = await fs.readFile(manifestPath, 'utf8');
            manifest = JSON.parse(manifestData);
        } catch (error) {
            console.warn('⚠️ No se encontró manifest, copiando todos los archivos');
        }

        if (manifest && manifest.files) {
            // Copiar archivos según manifest
            for (const fileInfo of manifest.files) {
                await this.copiarArchivoConVerificacion(
                    path.join(directorioStaging, fileInfo.path),
                    path.join(process.cwd(), fileInfo.path),
                    fileInfo
                );
            }
        } else {
            // Copiar todos los archivos
            await this.copiarDirectorioRecursivo(directorioStaging, process.cwd());
        }

        console.log('✅ Instalación estándar completada');
    }

    async copiarArchivoConVerificacion(origen, destino, fileInfo) {
        try {
            // Crear directorio destino si no existe
            const dirDestino = path.dirname(destino);
            await fs.mkdir(dirDestino, { recursive: true });

            // Copiar archivo
            await fs.copyFile(origen, destino);

            // Verificar permisos si se especifican
            if (fileInfo.permissions) {
                await fs.chmod(destino, parseInt(fileInfo.permissions, 8));
            }

            console.log(`📁 Copiado: ${fileInfo.path}`);
        } catch (error) {
            console.error(`❌ Error copiando ${fileInfo.path}:`, error.message);
            throw error;
        }
    }

    async copiarDirectorioRecursivo(origen, destino) {
        const entradas = await fs.readdir(origen, { withFileTypes: true });

        for (const entrada of entradas) {
            const origenPath = path.join(origen, entrada.name);
            const destinoPath = path.join(destino, entrada.name);

            if (entrada.isDirectory()) {
                await fs.mkdir(destinoPath, { recursive: true });
                await this.copiarDirectorioRecursivo(origenPath, destinoPath);
            } else {
                await fs.copyFile(origenPath, destinoPath);
            }
        }
    }

    async crearBackupPreActualizacion() {
        console.log('💾 Creando backup pre-actualización...');

        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const backupDir = path.join(this.backupPath, 'pre-update', `backup-${timestamp}`);

        await fs.mkdir(backupDir, { recursive: true });

        // Crear archivo ZIP con backup
        const backupZip = path.join(this.backupPath, 'pre-update', `backup-${timestamp}.zip`);

        return new Promise((resolve, reject) => {
            const output = require('fs').createWriteStream(backupZip);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                console.log(`✅ Backup creado: ${Math.round(archive.pointer() / 1024 / 1024)}MB`);
                this.estado.rollback_disponible = true;
                resolve(backupZip);
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // Incluir archivos críticos del sistema
            const directoriosIncluir = [
                'server',
                'config',
                'package.json',
                'package-lock.json'
            ];

            for (const dir of directoriosIncluir) {
                const dirPath = path.join(process.cwd(), dir);
                if (require('fs').existsSync(dirPath)) {
                    archive.directory(dirPath, dir);
                }
            }

            archive.finalize();
        });
    }

    async verificarEstabilidadPostActualizacion(actualizacion) {
        console.log('🔍 Verificando estabilidad post-actualización...');

        try {
            // Verificar que el servidor responde
            const healthCheck = await this.realizarHealthCheck();

            if (healthCheck.success) {
                console.log('✅ Sistema estable después de actualización');
                this.emit('actualizacion-estable', actualizacion);

                // Limpiar archivos temporales
                await this.limpiarArchivosTemporales();
            } else {
                console.log('❌ Sistema inestable, ejecutando rollback automático');
                await this.ejecutarRollback();
            }
        } catch (error) {
            console.error('❌ Error verificando estabilidad:', error);
            if (this.configuracion.rollback_automatico) {
                await this.ejecutarRollback();
            }
        }
    }

    async realizarHealthCheck() {
        try {
            const response = await this.realizarPeticionHTTP('http://localhost:8547/health');
            return { success: response.status === 'OK' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async ejecutarRollback() {
        if (!this.estado.rollback_disponible) {
            console.log('❌ No hay backup disponible para rollback');
            return false;
        }

        console.log('🔄 Ejecutando rollback automático...');

        try {
            // Encontrar el backup más reciente
            const backupFiles = await fs.readdir(path.join(this.backupPath, 'pre-update'));
            const backupMasReciente = backupFiles
                .filter(f => f.endsWith('.zip'))
                .sort()
                .reverse()[0];

            if (!backupMasReciente) {
                throw new Error('No se encontró archivo de backup');
            }

            const backupPath = path.join(this.backupPath, 'pre-update', backupMasReciente);

            // Extraer backup
            const directorioRollback = path.join(this.backupPath, 'rollback', `rollback-${Date.now()}`);
            await this.extraerBackup(backupPath, directorioRollback);

            // Restaurar archivos
            await this.restaurarDesdeBackup(directorioRollback);

            console.log('✅ Rollback ejecutado exitosamente');
            this.emit('rollback-completado', { backup: backupMasReciente });

            return true;

        } catch (error) {
            console.error('❌ Error ejecutando rollback:', error);
            this.emit('rollback-fallido', { error });
            return false;
        }
    }

    async extraerBackup(backupZip, directorioDestino) {
        await fs.mkdir(directorioDestino, { recursive: true });

        return new Promise((resolve, reject) => {
            yauzl.open(backupZip, { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    reject(err);
                    return;
                }

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if (/\/$/.test(entry.fileName)) {
                        const dirPath = path.join(directorioDestino, entry.fileName);
                        fs.mkdir(dirPath, { recursive: true }).then(() => {
                            zipfile.readEntry();
                        }).catch(reject);
                    } else {
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                reject(err);
                                return;
                            }

                            const filePath = path.join(directorioDestino, entry.fileName);
                            const dirPath = path.dirname(filePath);

                            fs.mkdir(dirPath, { recursive: true }).then(() => {
                                const writeStream = require('fs').createWriteStream(filePath);
                                readStream.pipe(writeStream);

                                writeStream.on('close', () => {
                                    zipfile.readEntry();
                                });

                                writeStream.on('error', reject);
                            }).catch(reject);
                        });
                    }
                });

                zipfile.on('end', () => {
                    resolve(directorioDestino);
                });

                zipfile.on('error', reject);
            });
        });
    }

    async restaurarDesdeBackup(directorioRollback) {
        console.log('🔄 Restaurando archivos desde backup...');

        // Restaurar directorios críticos
        const directoriosRestaurar = ['server', 'config'];

        for (const dir of directoriosRestaurar) {
            const origenDir = path.join(directorioRollback, dir);
            const destinoDir = path.join(process.cwd(), dir);

            if (await fs.access(origenDir).then(() => true).catch(() => false)) {
                // Eliminar directorio actual
                await fs.rm(destinoDir, { recursive: true, force: true });

                // Copiar desde backup
                await this.copiarDirectorioRecursivo(origenDir, destinoDir);

                console.log(`📁 Restaurado directorio: ${dir}`);
            }
        }

        // Restaurar archivos críticos
        const archivosRestaurar = ['package.json', 'package-lock.json'];

        for (const archivo of archivosRestaurar) {
            const origenArchivo = path.join(directorioRollback, archivo);
            const destinoArchivo = path.join(process.cwd(), archivo);

            if (await fs.access(origenArchivo).then(() => true).catch(() => false)) {
                await fs.copyFile(origenArchivo, destinoArchivo);
                console.log(`📄 Restaurado archivo: ${archivo}`);
            }
        }

        console.log('✅ Restauración desde backup completada');
    }

    async estaEnVentanaMantenimiento() {
        const ahora = new Date();
        const [horaInicio, minutoInicio] = this.configuracion.ventana_mantenimiento.inicio.split(':').map(Number);
        const [horaFin, minutoFin] = this.configuracion.ventana_mantenimiento.fin.split(':').map(Number);

        const horaActual = ahora.getHours();
        const minutoActual = ahora.getMinutes();

        const minutosActuales = horaActual * 60 + minutoActual;
        const minutosInicio = horaInicio * 60 + minutoInicio;
        const minutosFin = horaFin * 60 + minutoFin;

        if (minutosInicio <= minutosFin) {
            // Ventana en el mismo día
            return minutosActuales >= minutosInicio && minutosActuales <= minutosFin;
        } else {
            // Ventana cruza medianoche
            return minutosActuales >= minutosInicio || minutosActuales <= minutosFin;
        }
    }

    async ejecutarMantenimientoProgramado() {
        console.log('🔧 Ejecutando mantenimiento programado...');

        try {
            // Verificar actualizaciones pendientes
            if (this.estado.actualizaciones_pendientes.length > 0) {
                const actualizacionPendiente = this.estado.actualizaciones_pendientes.find(a => !a.instalada);

                if (actualizacionPendiente) {
                    console.log(`🔄 Instalando actualización pendiente: ${actualizacionPendiente.version}`);
                    await this.descargarEInstalarActualizacion(actualizacionPendiente);
                }
            }

            // Limpiar archivos antiguos
            await this.limpiarArchivosAntiguos();

            // Verificar espacio en disco
            await this.verificarEspacioDisco();

            console.log('✅ Mantenimiento programado completado');

        } catch (error) {
            console.error('❌ Error en mantenimiento programado:', error);
            this.emit('error-mantenimiento', { error, timestamp: new Date() });
        }
    }

    async limpiarArchivosTemporales() {
        console.log('🧹 Limpiando archivos temporales...');

        const directoriosLimpiar = [
            path.join(this.updatePath, 'downloads'),
            path.join(this.updatePath, 'staging'),
            this.tempPath
        ];

        for (const directorio of directoriosLimpiar) {
            try {
                const archivos = await fs.readdir(directorio);
                for (const archivo of archivos) {
                    await fs.rm(path.join(directorio, archivo), { recursive: true, force: true });
                }
                console.log(`🧹 Limpiado: ${path.basename(directorio)}`);
            } catch (error) {
                console.warn(`⚠️ Error limpiando ${directorio}:`, error.message);
            }
        }
    }

    async limpiarArchivosAntiguos() {
        console.log('🧹 Limpiando archivos antiguos de backups...');

        const directorioBackups = path.join(this.backupPath, 'pre-update');
        const diasRetencion = 30;
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasRetencion);

        try {
            const archivos = await fs.readdir(directorioBackups);
            let archivosEliminados = 0;

            for (const archivo of archivos) {
                const archivoPath = path.join(directorioBackups, archivo);
                const stats = await fs.stat(archivoPath);

                if (stats.mtime < fechaLimite) {
                    await fs.unlink(archivoPath);
                    archivosEliminados++;
                }
            }

            console.log(`🧹 Eliminados ${archivosEliminados} backups antiguos`);
        } catch (error) {
            console.warn('⚠️ Error limpiando backups antiguos:', error.message);
        }
    }

    async verificarEspacioDisco() {
        const espacioDisponible = await this.obtenerEspacioDisponible();
        const espacioMinimo = 1024; // 1GB en MB

        if (espacioDisponible < espacioMinimo) {
            console.warn(`⚠️ Espacio en disco bajo: ${espacioDisponible}MB disponibles`);
            this.emit('espacio-disco-bajo', { disponible: espacioDisponible, minimo: espacioMinimo });
        }
    }

    async verificarRollbackDisponible() {
        try {
            const backupFiles = await fs.readdir(path.join(this.backupPath, 'pre-update'));
            this.estado.rollback_disponible = backupFiles.some(f => f.endsWith('.zip'));
        } catch (error) {
            this.estado.rollback_disponible = false;
        }
    }

    async forzarVerificacion() {
        console.log('🔍 Forzando verificación de actualizaciones...');
        return await this.verificarActualizaciones();
    }

    async instalarActualizacionManual(version) {
        const actualizacion = this.estado.actualizaciones_pendientes.find(a => a.version === version);

        if (!actualizacion) {
            throw new Error(`Actualización ${version} no encontrada en pendientes`);
        }

        return await this.descargarEInstalarActualizacion(actualizacion);
    }

    async obtenerEstadoCompleto() {
        return {
            ...this.estado,
            configuracion: this.configuracion,
            en_ventana_mantenimiento: await this.estaEnVentanaMantenimiento(),
            espacio_disco_mb: await this.obtenerEspacioDisco(),
            proxima_verificacion: this.calcularProximaVerificacion()
        };
    }

    calcularProximaVerificacion() {
        if (!this.estado.ultima_verificacion) return null;

        const proxima = new Date(this.estado.ultima_verificacion);
        proxima.setHours(proxima.getHours() + this.configuracion.verificar_cada_horas);

        return proxima;
    }

    async actualizarConfiguracion(nuevaConfig) {
        this.configuracion = { ...this.configuracion, ...nuevaConfig };
        await this.guardarConfiguracion();

        // Re-programar jobs si cambiaron las configuraciones de tiempo
        if (nuevaConfig.verificar_cada_horas || nuevaConfig.ventana_mantenimiento) {
            await this.reprogramarJobs();
        }

        this.emit('configuracion-actualizada', { nuevaConfig });
    }

    async reprogramarJobs() {
        // Detener jobs existentes
        this.cronJobs.forEach(job => job.destroy());
        this.cronJobs.clear();

        // Re-programar con nueva configuración
        await this.programarVerificaciones();
    }

    async cleanup() {
        console.log('🧹 Limpiando ActualizacionesAutomaticasManager...');

        // Detener todos los cron jobs
        this.cronJobs.forEach(job => job.destroy());
        this.cronJobs.clear();

        // Limpiar cache
        this.cache.clear();

        // Emitir evento de limpieza
        this.emit('sistema-limpio', { timestamp: new Date() });

        console.log('✅ ActualizacionesAutomaticasManager limpio');
    }
}

module.exports = ActualizacionesAutomaticasManager;