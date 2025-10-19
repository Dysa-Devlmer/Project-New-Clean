/**
 * 📋 DYSA Point - Sistema de Logs Empresariales
 *
 * Sistema completo de logging empresarial para auditoría, monitoreo
 * y análisis de todas las operaciones críticas del restaurante
 *
 * Funcionalidades principales:
 * - Logging automático de todas las operaciones críticas
 * - Sistema de auditoría para cumplimiento normativo
 * - Dashboard de logs con filtros avanzados y búsqueda
 * - Alertas automáticas basadas en patrones de logs
 * - Análisis de comportamiento y detección de anomalías
 * - Rotación automática y archivo de logs históricos
 * - Integración con sistema de monitoreo existente
 * - Exportación de logs para análisis externos
 *
 * @autor DYSA Point Development Team
 * @version 2.0.14
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const moment = require('moment-timezone');

class LogsEmpresarialesManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.isInitialized = false;

        // Configuración del sistema de logs
        this.configuracion = {
            zona_horaria: 'America/Santiago',
            nivel_minimo: 'info',
            rotacion_dias: 30,
            max_tamanio_mb: 100,
            archivo_automatico: true,
            alertas_activas: true,
            analisis_anomalias: true,
            integridad_verificacion: true,
            formato_logs: 'json'
        };

        // Niveles de log empresariales
        this.niveles = {
            emergency: 0,   // Sistema inutilizable
            alert: 1,       // Acción requerida inmediatamente
            critical: 2,    // Condiciones críticas
            error: 3,       // Condiciones de error
            warning: 4,     // Condiciones de advertencia
            notice: 5,      // Condición normal pero significativa
            info: 6,        // Mensajes informativos
            debug: 7        // Mensajes de depuración
        };

        // Categorías de logs empresariales
        this.categorias = {
            VENTA: 'Operaciones de Venta',
            PAGO: 'Procesamiento de Pagos',
            COCINA: 'Operaciones de Cocina',
            MESA: 'Gestión de Mesas',
            USUARIO: 'Gestión de Usuarios',
            SISTEMA: 'Sistema y Configuración',
            SEGURIDAD: 'Eventos de Seguridad',
            INVENTARIO: 'Gestión de Inventario',
            CAJA: 'Operaciones de Caja',
            BACKUP: 'Operaciones de Backup',
            ERROR: 'Errores del Sistema',
            AUDITORIA: 'Eventos de Auditoría'
        };

        // Cache de logs recientes para dashboard
        this.logsRecientes = [];
        this.maxLogsCache = 1000;

        // Patrones de anomalías
        this.patronesAnomalias = new Map();

        // Estado del sistema de logs
        this.estado = {
            logs_totales: 0,
            logs_por_nivel: {},
            logs_por_categoria: {},
            alertas_activas: 0,
            anomalias_detectadas: 0,
            ultimo_archivo: null,
            espacio_usado_mb: 0
        };

        // Directorio base de logs
        this.directorioLogs = path.join(__dirname, '..', '..', 'logs');
        this.directorioArchivo = path.join(this.directorioLogs, 'archivo');

        console.log('📋 LogsEmpresarialesManager inicializado');
    }

    async inicializar() {
        try {
            console.log('📋 Inicializando sistema de logs empresariales...');

            // Crear directorios de logs
            await this.crearDirectoriosLogs();

            // Inicializar base de datos de logs
            await this.inicializarBaseDatos();

            // Configurar rotación automática
            await this.configurarRotacionAutomatica();

            // Inicializar análisis de anomalías
            await this.inicializarAnalisisAnomalias();

            // Cargar configuración personalizada si existe
            await this.cargarConfiguracion();

            // Inicializar métricas
            await this.inicializarMetricas();

            // Configurar limpieza automática
            this.configurarLimpiezaAutomatica();

            // Registrar eventos del sistema
            this.configurarEventosGlobales();

            this.isInitialized = true;

            // Log de inicialización del sistema
            await this.registrarLog('info', 'SISTEMA', 'Sistema de Logs Empresariales inicializado correctamente', {
                version: '2.0.14',
                configuracion: this.configuracion,
                categorias_disponibles: Object.keys(this.categorias).length
            });

            console.log('✅ Sistema de logs empresariales inicializado correctamente');
            return true;

        } catch (error) {
            console.error('❌ Error inicializando sistema de logs:', error);
            throw error;
        }
    }

    async crearDirectoriosLogs() {
        try {
            // Crear directorio principal de logs
            await fs.mkdir(this.directorioLogs, { recursive: true });

            // Crear subdirectorios especializados
            const subdirectorios = [
                'archivo',
                'auditoria',
                'seguridad',
                'errores',
                'alertas',
                'analytics'
            ];

            for (const subdir of subdirectorios) {
                await fs.mkdir(path.join(this.directorioLogs, subdir), { recursive: true });
            }

            console.log('📁 Directorios de logs creados correctamente');

        } catch (error) {
            console.error('❌ Error creando directorios de logs:', error);
            throw error;
        }
    }

    async inicializarBaseDatos() {
        try {
            if (!this.database?.connection) {
                console.warn('⚠️ Base de datos no disponible para logs, usando solo archivos');
                return false;
            }

            // Crear tabla de logs si no existe
            const createLogsTable = `
                CREATE TABLE IF NOT EXISTS logs_empresariales (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    timestamp DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
                    nivel ENUM('emergency','alert','critical','error','warning','notice','info','debug') NOT NULL,
                    categoria VARCHAR(20) NOT NULL,
                    mensaje TEXT NOT NULL,
                    contexto JSON,
                    usuario_id INT,
                    sesion_id VARCHAR(100),
                    ip_address VARCHAR(45),
                    user_agent TEXT,
                    request_id VARCHAR(100),
                    hash_integridad VARCHAR(64),
                    procesado BOOLEAN DEFAULT FALSE,
                    archived BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_timestamp (timestamp),
                    INDEX idx_nivel (nivel),
                    INDEX idx_categoria (categoria),
                    INDEX idx_usuario (usuario_id),
                    INDEX idx_procesado (procesado),
                    INDEX idx_archived (archived)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `;

            await this.database.connection.execute(createLogsTable);

            // Crear tabla de alertas de logs
            const createAlertasTable = `
                CREATE TABLE IF NOT EXISTS logs_alertas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    nombre VARCHAR(100) NOT NULL,
                    descripcion TEXT,
                    patron_busqueda TEXT NOT NULL,
                    nivel_minimo ENUM('emergency','alert','critical','error','warning','notice','info','debug') DEFAULT 'error',
                    categoria VARCHAR(20),
                    umbral_cantidad INT DEFAULT 1,
                    ventana_tiempo_minutos INT DEFAULT 60,
                    activa BOOLEAN DEFAULT TRUE,
                    notificar_email BOOLEAN DEFAULT FALSE,
                    notificar_webhook BOOLEAN DEFAULT FALSE,
                    webhook_url VARCHAR(500),
                    ultima_activacion DATETIME,
                    activaciones_total INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_nombre (nombre),
                    INDEX idx_activa (activa),
                    INDEX idx_categoria (categoria)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `;

            await this.database.connection.execute(createAlertasTable);

            // Crear tabla de métricas de logs
            const createMetricasTable = `
                CREATE TABLE IF NOT EXISTS logs_metricas (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    fecha DATE NOT NULL,
                    hora TINYINT NOT NULL,
                    categoria VARCHAR(20) NOT NULL,
                    nivel VARCHAR(10) NOT NULL,
                    cantidad INT DEFAULT 0,
                    tamanio_bytes BIGINT DEFAULT 0,
                    tiempo_promedio_ms DECIMAL(8,2) DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    UNIQUE KEY unique_metrica (fecha, hora, categoria, nivel),
                    INDEX idx_fecha (fecha),
                    INDEX idx_categoria (categoria)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `;

            await this.database.connection.execute(createMetricasTable);

            console.log('✅ Tablas de logs empresariales creadas correctamente');
            return true;

        } catch (error) {
            console.error('❌ Error inicializando base de datos de logs:', error);
            return false;
        }
    }

    async configurarRotacionAutomatica() {
        try {
            const cron = require('node-cron');

            // Rotación diaria a las 2:00 AM
            cron.schedule('0 2 * * *', async () => {
                await this.ejecutarRotacionLogs();
            }, {
                scheduled: true,
                timezone: this.configuracion.zona_horaria
            });

            // Limpieza semanal de logs antiguos (domingos a las 3:00 AM)
            cron.schedule('0 3 * * 0', async () => {
                await this.limpiarLogsAntiguos();
            }, {
                scheduled: true,
                timezone: this.configuracion.zona_horaria
            });

            console.log('⏰ Rotación automática de logs configurada');

        } catch (error) {
            console.error('❌ Error configurando rotación automática:', error);
        }
    }

    async inicializarAnalisisAnomalias() {
        try {
            // Patrones básicos de anomalías
            this.patronesAnomalias.set('errores_masivos', {
                descripcion: 'Múltiples errores en corto tiempo',
                patron: { nivel: 'error', ventana_minutos: 5, umbral: 10 }
            });

            this.patronesAnomalias.set('intentos_login_fallidos', {
                descripcion: 'Múltiples intentos de login fallidos',
                patron: { categoria: 'SEGURIDAD', mensaje_contiene: 'login failed', ventana_minutos: 15, umbral: 5 }
            });

            this.patronesAnomalias.set('operaciones_sospechosas', {
                descripcion: 'Operaciones inusuales de alta frecuencia',
                patron: { categoria: 'VENTA', ventana_minutos: 10, umbral: 50 }
            });

            this.patronesAnomalias.set('errores_criticos', {
                descripcion: 'Errores críticos del sistema',
                patron: { nivel: 'critical', ventana_minutos: 60, umbral: 1 }
            });

            // Análisis cada 5 minutos
            const cron = require('node-cron');
            cron.schedule('*/5 * * * *', async () => {
                await this.analizarAnomalias();
            }, {
                scheduled: true,
                timezone: this.configuracion.zona_horaria
            });

            console.log('🔍 Análisis de anomalías inicializado');

        } catch (error) {
            console.error('❌ Error inicializando análisis de anomalías:', error);
        }
    }

    async cargarConfiguracion() {
        try {
            const configPath = path.join(this.directorioLogs, 'config.json');

            try {
                const configData = await fs.readFile(configPath, 'utf8');
                const config = JSON.parse(configData);

                // Merge con configuración por defecto
                this.configuracion = { ...this.configuracion, ...config };

                console.log('⚙️ Configuración personalizada cargada');
            } catch (error) {
                // No existe configuración personalizada, usar por defecto
                await this.guardarConfiguracion();
            }

        } catch (error) {
            console.error('❌ Error cargando configuración:', error);
        }
    }

    async guardarConfiguracion() {
        try {
            const configPath = path.join(this.directorioLogs, 'config.json');
            await fs.writeFile(configPath, JSON.stringify(this.configuracion, null, 2));

        } catch (error) {
            console.error('❌ Error guardando configuración:', error);
        }
    }

    async inicializarMetricas() {
        try {
            // Inicializar contadores de estado
            for (const nivel of Object.keys(this.niveles)) {
                this.estado.logs_por_nivel[nivel] = 0;
            }

            for (const categoria of Object.keys(this.categorias)) {
                this.estado.logs_por_categoria[categoria] = 0;
            }

            // Cargar métricas desde base de datos si está disponible
            if (this.database?.connection) {
                await this.cargarMetricasIniciales();
            }

        } catch (error) {
            console.error('❌ Error inicializando métricas:', error);
        }
    }

    async cargarMetricasIniciales() {
        try {
            // Cargar contadores de hoy
            const [metricas] = await this.database.connection.execute(`
                SELECT
                    nivel,
                    categoria,
                    SUM(cantidad) as total
                FROM logs_metricas
                WHERE fecha = CURDATE()
                GROUP BY nivel, categoria
            `);

            for (const metrica of metricas) {
                this.estado.logs_por_nivel[metrica.nivel] =
                    (this.estado.logs_por_nivel[metrica.nivel] || 0) + metrica.total;

                this.estado.logs_por_categoria[metrica.categoria] =
                    (this.estado.logs_por_categoria[metrica.categoria] || 0) + metrica.total;
            }

        } catch (error) {
            console.error('❌ Error cargando métricas iniciales:', error);
        }
    }

    configurarLimpiezaAutomatica() {
        try {
            // Limpieza del cache cada hora
            setInterval(() => {
                this.limpiarCache();
            }, 3600000); // 1 hora

            // Actualización de métricas cada 15 minutos
            setInterval(async () => {
                await this.actualizarMetricas();
            }, 900000); // 15 minutos

        } catch (error) {
            console.error('❌ Error configurando limpieza automática:', error);
        }
    }

    configurarEventosGlobales() {
        try {
            // Escuchar eventos de cierre para flush final
            process.on('SIGINT', async () => {
                await this.flushLogsFinales();
            });

            process.on('SIGTERM', async () => {
                await this.flushLogsFinales();
            });

        } catch (error) {
            console.error('❌ Error configurando eventos globales:', error);
        }
    }

    // ==================== MÉTODOS PRINCIPALES DE LOGGING ====================

    async registrarLog(nivel, categoria, mensaje, contexto = {}, metadata = {}) {
        try {
            if (!this.isInitialized) {
                console.warn('⚠️ Sistema de logs no inicializado, saltando log');
                return null;
            }

            // Validar nivel y categoría
            if (!(nivel in this.niveles)) {
                throw new Error(`Nivel de log inválido: ${nivel}`);
            }

            if (!(categoria in this.categorias)) {
                throw new Error(`Categoría de log inválida: ${categoria}`);
            }

            // Verificar nivel mínimo
            if (this.niveles[nivel] > this.niveles[this.configuracion.nivel_minimo]) {
                return null; // Log por debajo del nivel mínimo
            }

            const timestamp = moment().tz(this.configuracion.zona_horaria);
            const requestId = metadata.request_id || this.generarRequestId();

            // Crear entry de log
            const logEntry = {
                id: null, // Se asignará en base de datos
                timestamp: timestamp.format('YYYY-MM-DD HH:mm:ss.SSS'),
                nivel,
                categoria,
                mensaje,
                contexto: JSON.stringify(contexto),
                usuario_id: metadata.usuario_id || null,
                sesion_id: metadata.sesion_id || null,
                ip_address: metadata.ip_address || null,
                user_agent: metadata.user_agent || null,
                request_id: requestId,
                hash_integridad: null
            };

            // Calcular hash de integridad
            logEntry.hash_integridad = this.calcularHashIntegridad(logEntry);

            // Guardar en base de datos si está disponible
            let logId = null;
            if (this.database?.connection) {
                logId = await this.guardarLogBD(logEntry);
                logEntry.id = logId;
            }

            // Guardar en archivo
            await this.guardarLogArchivo(logEntry);

            // Agregar al cache de logs recientes
            this.agregarACache(logEntry);

            // Actualizar métricas
            this.actualizarEstado(nivel, categoria);

            // Verificar alertas
            await this.verificarAlertas(logEntry);

            // Emitir evento para otros sistemas
            this.emit('nuevo_log', logEntry);

            return logEntry;

        } catch (error) {
            console.error('❌ Error registrando log:', error);

            // Fallback: guardar error en archivo de emergencia
            await this.guardarLogEmergencia(nivel, categoria, mensaje, contexto, error);

            return null;
        }
    }

    async guardarLogBD(logEntry) {
        try {
            const [result] = await this.database.connection.execute(`
                INSERT INTO logs_empresariales (
                    timestamp, nivel, categoria, mensaje, contexto,
                    usuario_id, sesion_id, ip_address, user_agent,
                    request_id, hash_integridad
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                logEntry.timestamp,
                logEntry.nivel,
                logEntry.categoria,
                logEntry.mensaje,
                logEntry.contexto,
                logEntry.usuario_id,
                logEntry.sesion_id,
                logEntry.ip_address,
                logEntry.user_agent,
                logEntry.request_id,
                logEntry.hash_integridad
            ]);

            return result.insertId;

        } catch (error) {
            console.error('❌ Error guardando log en BD:', error);
            throw error;
        }
    }

    async guardarLogArchivo(logEntry) {
        try {
            const fechaArchivo = moment().tz(this.configuracion.zona_horaria).format('YYYY-MM-DD');
            const nombreArchivo = `logs-${fechaArchivo}.jsonl`;
            const rutaArchivo = path.join(this.directorioLogs, nombreArchivo);

            let linea;
            if (this.configuracion.formato_logs === 'json') {
                linea = JSON.stringify(logEntry) + '\n';
            } else {
                // Formato texto legible
                linea = `[${logEntry.timestamp}] ${logEntry.nivel.toUpperCase()} ${logEntry.categoria}: ${logEntry.mensaje}\n`;
            }

            await fs.appendFile(rutaArchivo, linea);

        } catch (error) {
            console.error('❌ Error guardando log en archivo:', error);
            throw error;
        }
    }

    async guardarLogEmergencia(nivel, categoria, mensaje, contexto, error) {
        try {
            const timestamp = new Date().toISOString();
            const archivoEmergencia = path.join(this.directorioLogs, 'emergency.log');

            const logEmergencia = {
                timestamp,
                nivel,
                categoria,
                mensaje,
                contexto,
                error_logging: error.message,
                emergency: true
            };

            await fs.appendFile(archivoEmergencia, JSON.stringify(logEmergencia) + '\n');

        } catch (emergencyError) {
            console.error('❌ Error crítico guardando log de emergencia:', emergencyError);
        }
    }

    // ==================== MÉTODOS DE CONVENIENCIA ====================

    async emergency(categoria, mensaje, contexto, metadata) {
        return await this.registrarLog('emergency', categoria, mensaje, contexto, metadata);
    }

    async alert(categoria, mensaje, contexto, metadata) {
        return await this.registrarLog('alert', categoria, mensaje, contexto, metadata);
    }

    async critical(categoria, mensaje, contexto, metadata) {
        return await this.registrarLog('critical', categoria, mensaje, contexto, metadata);
    }

    async error(categoria, mensaje, contexto, metadata) {
        return await this.registrarLog('error', categoria, mensaje, contexto, metadata);
    }

    async warning(categoria, mensaje, contexto, metadata) {
        return await this.registrarLog('warning', categoria, mensaje, contexto, metadata);
    }

    async notice(categoria, mensaje, contexto, metadata) {
        return await this.registrarLog('notice', categoria, mensaje, contexto, metadata);
    }

    async info(categoria, mensaje, contexto, metadata) {
        return await this.registrarLog('info', categoria, mensaje, contexto, metadata);
    }

    async debug(categoria, mensaje, contexto, metadata) {
        return await this.registrarLog('debug', categoria, mensaje, contexto, metadata);
    }

    // ==================== MÉTODOS DE CONSULTA ====================

    async obtenerLogs(filtros = {}, paginacion = { page: 1, limit: 100 }) {
        try {
            if (!this.database?.connection) {
                return await this.obtenerLogsArchivo(filtros, paginacion);
            }

            const { page, limit } = paginacion;
            const offset = (page - 1) * limit;

            let whereClause = 'WHERE 1=1';
            let params = [];

            // Construir filtros
            if (filtros.nivel) {
                whereClause += ' AND nivel = ?';
                params.push(filtros.nivel);
            }

            if (filtros.categoria) {
                whereClause += ' AND categoria = ?';
                params.push(filtros.categoria);
            }

            if (filtros.fecha_desde) {
                whereClause += ' AND timestamp >= ?';
                params.push(filtros.fecha_desde);
            }

            if (filtros.fecha_hasta) {
                whereClause += ' AND timestamp <= ?';
                params.push(filtros.fecha_hasta);
            }

            if (filtros.usuario_id) {
                whereClause += ' AND usuario_id = ?';
                params.push(filtros.usuario_id);
            }

            if (filtros.buscar) {
                whereClause += ' AND (mensaje LIKE ? OR contexto LIKE ?)';
                params.push(`%${filtros.buscar}%`, `%${filtros.buscar}%`);
            }

            // Consulta principal
            const [logs] = await this.database.connection.execute(`
                SELECT * FROM logs_empresariales
                ${whereClause}
                ORDER BY timestamp DESC
                LIMIT ? OFFSET ?
            `, [...params, limit, offset]);

            // Contar total
            const [countResult] = await this.database.connection.execute(`
                SELECT COUNT(*) as total FROM logs_empresariales ${whereClause}
            `, params);

            return {
                logs: logs.map(log => ({
                    ...log,
                    contexto: JSON.parse(log.contexto || '{}')
                })),
                total: countResult[0].total,
                page,
                limit,
                totalPages: Math.ceil(countResult[0].total / limit)
            };

        } catch (error) {
            console.error('❌ Error obteniendo logs:', error);
            throw error;
        }
    }

    async obtenerEstadisticas(filtros = {}) {
        try {
            if (!this.database?.connection) {
                return this.estado;
            }

            let whereClause = 'WHERE 1=1';
            let params = [];

            if (filtros.fecha_desde) {
                whereClause += ' AND timestamp >= ?';
                params.push(filtros.fecha_desde);
            }

            if (filtros.fecha_hasta) {
                whereClause += ' AND timestamp <= ?';
                params.push(filtros.fecha_hasta);
            }

            // Estadísticas por nivel
            const [estatsPorNivel] = await this.database.connection.execute(`
                SELECT nivel, COUNT(*) as cantidad
                FROM logs_empresariales ${whereClause}
                GROUP BY nivel
                ORDER BY cantidad DESC
            `, params);

            // Estadísticas por categoría
            const [estatsPorCategoria] = await this.database.connection.execute(`
                SELECT categoria, COUNT(*) as cantidad
                FROM logs_empresariales ${whereClause}
                GROUP BY categoria
                ORDER BY cantidad DESC
            `, params);

            // Tendencia por hora (últimas 24 horas)
            const [tendenciaHoras] = await this.database.connection.execute(`
                SELECT
                    HOUR(timestamp) as hora,
                    COUNT(*) as cantidad,
                    nivel
                FROM logs_empresariales
                WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY HOUR(timestamp), nivel
                ORDER BY hora ASC
            `);

            return {
                total_logs: this.estado.logs_totales,
                por_nivel: estatsPorNivel.reduce((acc, curr) => {
                    acc[curr.nivel] = curr.cantidad;
                    return acc;
                }, {}),
                por_categoria: estatsPorCategoria.reduce((acc, curr) => {
                    acc[curr.categoria] = curr.cantidad;
                    return acc;
                }, {}),
                tendencia_24h: tendenciaHoras,
                alertas_activas: this.estado.alertas_activas,
                anomalias_detectadas: this.estado.anomalias_detectadas,
                ultimo_archivo: this.estado.ultimo_archivo,
                espacio_usado_mb: this.estado.espacio_usado_mb
            };

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            throw error;
        }
    }

    // ==================== MÉTODOS DE ALERTAS ====================

    async verificarAlertas(logEntry) {
        try {
            if (!this.configuracion.alertas_activas || !this.database?.connection) {
                return;
            }

            // Obtener alertas activas que pueden aplicar
            const [alertas] = await this.database.connection.execute(`
                SELECT * FROM logs_alertas
                WHERE activa = TRUE
                AND (categoria IS NULL OR categoria = ?)
                AND nivel_minimo >= ?
            `, [logEntry.categoria, this.niveles[logEntry.nivel]]);

            for (const alerta of alertas) {
                await this.evaluarAlerta(alerta, logEntry);
            }

        } catch (error) {
            console.error('❌ Error verificando alertas:', error);
        }
    }

    async evaluarAlerta(alerta, logEntry) {
        try {
            // Verificar si el log coincide con el patrón de búsqueda
            const patronCoincide = this.evaluarPatronBusqueda(alerta.patron_busqueda, logEntry);

            if (!patronCoincide) {
                return;
            }

            // Verificar umbral en ventana de tiempo
            const ventanaDesde = moment().subtract(alerta.ventana_tiempo_minutos, 'minutes').format('YYYY-MM-DD HH:mm:ss');

            const [countResult] = await this.database.connection.execute(`
                SELECT COUNT(*) as cantidad
                FROM logs_empresariales
                WHERE timestamp >= ?
                AND categoria = ?
                AND nivel <= ?
                AND mensaje LIKE ?
            `, [
                ventanaDesde,
                logEntry.categoria,
                this.niveles[logEntry.nivel],
                `%${alerta.patron_busqueda}%`
            ]);

            if (countResult[0].cantidad >= alerta.umbral_cantidad) {
                await this.activarAlerta(alerta, countResult[0].cantidad);
            }

        } catch (error) {
            console.error('❌ Error evaluando alerta:', error);
        }
    }

    async activarAlerta(alerta, cantidad) {
        try {
            // Actualizar última activación
            await this.database.connection.execute(`
                UPDATE logs_alertas
                SET ultima_activacion = NOW(), activaciones_total = activaciones_total + 1
                WHERE id = ?
            `, [alerta.id]);

            // Registrar la activación de alerta
            await this.registrarLog('alert', 'SISTEMA', `Alerta activada: ${alerta.nombre}`, {
                alerta_id: alerta.id,
                descripcion: alerta.descripcion,
                cantidad_eventos: cantidad,
                umbral: alerta.umbral_cantidad,
                ventana_minutos: alerta.ventana_tiempo_minutos
            });

            this.estado.alertas_activas++;

            // Emitir evento de alerta
            this.emit('alerta_activada', {
                alerta,
                cantidad,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('❌ Error activando alerta:', error);
        }
    }

    // ==================== ANÁLISIS DE ANOMALÍAS ====================

    async analizarAnomalias() {
        try {
            if (!this.configuracion.analisis_anomalias) {
                return;
            }

            for (const [nombre, patron] of this.patronesAnomalias) {
                await this.detectarAnomalia(nombre, patron);
            }

        } catch (error) {
            console.error('❌ Error analizando anomalías:', error);
        }
    }

    async detectarAnomalia(nombre, patron) {
        try {
            if (!this.database?.connection) {
                return;
            }

            const ventanaDesde = moment().subtract(patron.patron.ventana_minutos, 'minutes').format('YYYY-MM-DD HH:mm:ss');

            let whereClause = 'WHERE timestamp >= ?';
            let params = [ventanaDesde];

            if (patron.patron.nivel) {
                whereClause += ' AND nivel = ?';
                params.push(patron.patron.nivel);
            }

            if (patron.patron.categoria) {
                whereClause += ' AND categoria = ?';
                params.push(patron.patron.categoria);
            }

            if (patron.patron.mensaje_contiene) {
                whereClause += ' AND mensaje LIKE ?';
                params.push(`%${patron.patron.mensaje_contiene}%`);
            }

            const [countResult] = await this.database.connection.execute(`
                SELECT COUNT(*) as cantidad
                FROM logs_empresariales ${whereClause}
            `, params);

            if (countResult[0].cantidad >= patron.patron.umbral) {
                await this.registrarAnomalia(nombre, patron, countResult[0].cantidad);
            }

        } catch (error) {
            console.error('❌ Error detectando anomalía:', error);
        }
    }

    async registrarAnomalia(nombre, patron, cantidad) {
        try {
            await this.registrarLog('warning', 'SISTEMA', `Anomalía detectada: ${nombre}`, {
                patron_nombre: nombre,
                descripcion: patron.descripcion,
                cantidad_eventos: cantidad,
                umbral: patron.patron.umbral,
                ventana_minutos: patron.patron.ventana_minutos,
                tipo: 'anomalia_detectada'
            });

            this.estado.anomalias_detectadas++;

            // Emitir evento de anomalía
            this.emit('anomalia_detectada', {
                nombre,
                patron,
                cantidad,
                timestamp: new Date()
            });

        } catch (error) {
            console.error('❌ Error registrando anomalía:', error);
        }
    }

    // ==================== MÉTODOS AUXILIARES ====================

    generarRequestId() {
        return crypto.randomBytes(16).toString('hex');
    }

    calcularHashIntegridad(logEntry) {
        const data = `${logEntry.timestamp}${logEntry.nivel}${logEntry.categoria}${logEntry.mensaje}`;
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    evaluarPatronBusqueda(patron, logEntry) {
        try {
            return logEntry.mensaje.toLowerCase().includes(patron.toLowerCase());
        } catch (error) {
            return false;
        }
    }

    agregarACache(logEntry) {
        this.logsRecientes.unshift(logEntry);

        if (this.logsRecientes.length > this.maxLogsCache) {
            this.logsRecientes = this.logsRecientes.slice(0, this.maxLogsCache);
        }
    }

    actualizarEstado(nivel, categoria) {
        this.estado.logs_totales++;
        this.estado.logs_por_nivel[nivel]++;
        this.estado.logs_por_categoria[categoria]++;
    }

    limpiarCache() {
        // Mantener solo logs de las últimas 2 horas en cache
        const hace2Horas = moment().subtract(2, 'hours');

        this.logsRecientes = this.logsRecientes.filter(log => {
            const timestamp = moment(log.timestamp);
            return timestamp.isAfter(hace2Horas);
        });
    }

    async actualizarMetricas() {
        try {
            if (!this.database?.connection) {
                return;
            }

            // Actualizar métricas por hora actual
            const ahora = moment().tz(this.configuracion.zona_horaria);
            const fecha = ahora.format('YYYY-MM-DD');
            const hora = ahora.hour();

            for (const categoria of Object.keys(this.categorias)) {
                for (const nivel of Object.keys(this.niveles)) {
                    const [result] = await this.database.connection.execute(`
                        SELECT COUNT(*) as cantidad,
                               COALESCE(AVG(TIMESTAMPDIFF(MICROSECOND, timestamp, NOW())/1000), 0) as tiempo_promedio
                        FROM logs_empresariales
                        WHERE DATE(timestamp) = ?
                        AND HOUR(timestamp) = ?
                        AND categoria = ?
                        AND nivel = ?
                    `, [fecha, hora, categoria, nivel]);

                    if (result[0].cantidad > 0) {
                        await this.database.connection.execute(`
                            INSERT INTO logs_metricas (fecha, hora, categoria, nivel, cantidad, tiempo_promedio_ms)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON DUPLICATE KEY UPDATE
                            cantidad = VALUES(cantidad),
                            tiempo_promedio_ms = VALUES(tiempo_promedio_ms),
                            updated_at = CURRENT_TIMESTAMP
                        `, [fecha, hora, categoria, nivel, result[0].cantidad, result[0].tiempo_promedio]);
                    }
                }
            }

        } catch (error) {
            console.error('❌ Error actualizando métricas:', error);
        }
    }

    async ejecutarRotacionLogs() {
        try {
            console.log('🔄 Ejecutando rotación de logs...');

            const fechaAyer = moment().subtract(1, 'day').format('YYYY-MM-DD');
            const archivoOrigen = path.join(this.directorioLogs, `logs-${fechaAyer}.jsonl`);
            const archivoDestino = path.join(this.directorioArchivo, `logs-${fechaAyer}.jsonl`);

            try {
                await fs.access(archivoOrigen);
                await fs.rename(archivoOrigen, archivoDestino);

                this.estado.ultimo_archivo = fechaAyer;

                await this.registrarLog('info', 'SISTEMA', 'Rotación de logs completada', {
                    fecha_archivo: fechaAyer,
                    archivo_origen: archivoOrigen,
                    archivo_destino: archivoDestino
                });

            } catch (error) {
                // Archivo no existe, continuar
            }

        } catch (error) {
            console.error('❌ Error ejecutando rotación de logs:', error);
        }
    }

    async limpiarLogsAntiguos() {
        try {
            console.log('🧹 Ejecutando limpieza de logs antiguos...');

            const fechaLimite = moment().subtract(this.configuracion.rotacion_dias, 'days');
            let archivosEliminados = 0;

            // Limpiar archivos
            const archivos = await fs.readdir(this.directorioArchivo);

            for (const archivo of archivos) {
                const match = archivo.match(/logs-(\d{4}-\d{2}-\d{2})\.jsonl/);
                if (match) {
                    const fechaArchivo = moment(match[1]);
                    if (fechaArchivo.isBefore(fechaLimite)) {
                        await fs.unlink(path.join(this.directorioArchivo, archivo));
                        archivosEliminados++;
                    }
                }
            }

            // Limpiar base de datos
            if (this.database?.connection) {
                const [result] = await this.database.connection.execute(`
                    DELETE FROM logs_empresariales
                    WHERE timestamp < ? AND archived = TRUE
                `, [fechaLimite.format('YYYY-MM-DD HH:mm:ss')]);

                await this.registrarLog('info', 'SISTEMA', 'Limpieza de logs antiguos completada', {
                    archivos_eliminados: archivosEliminados,
                    registros_bd_eliminados: result.affectedRows,
                    fecha_limite: fechaLimite.format('YYYY-MM-DD')
                });
            }

        } catch (error) {
            console.error('❌ Error limpiando logs antiguos:', error);
        }
    }

    async flushLogsFinales() {
        try {
            console.log('💾 Haciendo flush final de logs...');

            // Procesar logs pendientes en cache
            if (this.logsRecientes.length > 0) {
                await this.registrarLog('info', 'SISTEMA', 'Sistema de logs cerrando', {
                    logs_en_cache: this.logsRecientes.length,
                    estado_final: this.estado
                });
            }

        } catch (error) {
            console.error('❌ Error en flush final de logs:', error);
        }
    }

    async cleanup() {
        try {
            await this.flushLogsFinales();
            this.removeAllListeners();

        } catch (error) {
            console.error('❌ Error en cleanup de logs:', error);
        }
    }

    getEstado() {
        return {
            inicializado: this.isInitialized,
            configuracion: this.configuracion,
            estado: this.estado,
            logs_recientes: this.logsRecientes.slice(0, 10),
            categorias_disponibles: this.categorias,
            niveles_disponibles: this.niveles
        };
    }
}

module.exports = LogsEmpresarialesManager;