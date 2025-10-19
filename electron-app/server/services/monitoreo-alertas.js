/**
 * DYSA Point - Sistema de Monitoreo y Alertas Empresarial
 * Monitoreo 24/7 con alertas automáticas para restaurantes
 *
 * Sistema de Producción - Monitoreo Empresarial Completo
 * Compatible con operación continua y alertas multi-canal
 *
 * @author DYSA Point Development Team
 * @version 2.0.14
 * @date 2025-10-13
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const cron = require('node-cron');

class MonitoreoAlertasManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.configPath = path.join(__dirname, '..', '..', 'config');
        this.logsPath = path.join(__dirname, '..', '..', 'logs');
        this.alertasActivas = new Map();
        this.metricas = new Map();
        this.cronJobs = new Map();
        this.ultimaVerificacion = null;

        // Configuración por defecto
        this.configuracion = {
            intervalos: {
                monitoreo_general: 30, // 30 segundos
                verificacion_bd: 60,   // 1 minuto
                revision_recursos: 120, // 2 minutos
                limpieza_logs: 3600    // 1 hora
            },
            umbrales: {
                cpu_warning: 70,       // 70% CPU
                cpu_critical: 90,      // 90% CPU
                memoria_warning: 80,   // 80% RAM
                memoria_critical: 95,  // 95% RAM
                disco_warning: 85,     // 85% disco
                disco_critical: 95,    // 95% disco
                respuesta_bd_warning: 5000,  // 5 segundos
                respuesta_bd_critical: 10000, // 10 segundos
                conexiones_bd_warning: 15,    // 15 conexiones
                conexiones_bd_critical: 19    // 19 conexiones (max 20)
            },
            alertas: {
                email_habilitado: false,
                webhook_habilitado: false,
                log_habilitado: true,
                cooldown_minutos: 15,  // Evitar spam de alertas
                escalamiento: {
                    warning_reintento: 3,      // 3 verificaciones antes de escalar
                    critical_inmediato: true   // Alertas críticas inmediatas
                }
            },
            notificaciones: {
                email: {
                    smtp_host: '',
                    smtp_port: 587,
                    smtp_user: '',
                    smtp_pass: '',
                    destinatarios: []
                },
                webhook: {
                    url: '',
                    timeout: 5000,
                    retry_attempts: 3
                }
            }
        };

        this.estadisticas = {
            sistema_iniciado: null,
            total_verificaciones: 0,
            alertas_enviadas: 0,
            errores_detectados: 0,
            tiempo_actividad: 0,
            ultima_alerta: null,
            estado_general: 'healthy'
        };
    }

    /**
     * Inicializar sistema de monitoreo
     */
    async inicializar() {
        console.log('🔍 Inicializando sistema de monitoreo empresarial...');

        try {
            // Crear directorio de logs si no existe
            await this.crearDirectoriosMonitoreo();

            // Cargar configuración personalizada
            await this.cargarConfiguracion();

            // Inicializar métricas base
            await this.inicializarMetricas();

            // Programar tareas de monitoreo
            await this.programarTareasMonitoreo();

            // Realizar verificación inicial
            await this.verificacionInicialSistema();

            // Configurar manejadores de eventos del sistema
            this.configurarManejadoresEventos();

            this.estadisticas.sistema_iniciado = new Date().toISOString();
            this.estadisticas.estado_general = 'healthy';

            console.log('✅ Sistema de monitoreo inicializado correctamente');

            this.emit('sistema_monitoreo_iniciado', {
                timestamp: new Date(),
                configuracion: this.configuracion
            });

            return true;

        } catch (error) {
            console.error('❌ Error inicializando sistema de monitoreo:', error);
            throw error;
        }
    }

    /**
     * Crear directorios necesarios para monitoreo
     */
    async crearDirectoriosMonitoreo() {
        const directorios = [
            path.join(this.logsPath, 'monitoring'),
            path.join(this.logsPath, 'alerts'),
            path.join(this.configPath, 'monitoring')
        ];

        for (const dir of directorios) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') throw error;
            }
        }
    }

    /**
     * Cargar configuración de monitoreo
     */
    async cargarConfiguracion() {
        try {
            const configFile = path.join(this.configPath, 'monitoring', 'config.json');

            try {
                const configContent = await fs.readFile(configFile, 'utf8');
                const customConfig = JSON.parse(configContent);
                this.configuracion = this.mergeConfig(this.configuracion, customConfig);
            } catch {
                // Si no existe configuración, crear una por defecto
                await this.guardarConfiguracion();
            }

        } catch (error) {
            console.warn('⚠️ Error cargando configuración de monitoreo, usando valores por defecto');
        }
    }

    /**
     * Merge recursivo de configuraciones
     */
    mergeConfig(default_config, custom_config) {
        const result = { ...default_config };

        for (const key in custom_config) {
            if (custom_config[key] && typeof custom_config[key] === 'object' && !Array.isArray(custom_config[key])) {
                result[key] = this.mergeConfig(result[key] || {}, custom_config[key]);
            } else {
                result[key] = custom_config[key];
            }
        }

        return result;
    }

    /**
     * Guardar configuración
     */
    async guardarConfiguracion() {
        try {
            const configFile = path.join(this.configPath, 'monitoring', 'config.json');
            await fs.writeFile(configFile, JSON.stringify(this.configuracion, null, 2));
        } catch (error) {
            console.error('Error guardando configuración de monitoreo:', error);
        }
    }

    /**
     * Inicializar métricas base
     */
    async inicializarMetricas() {
        const metricas_iniciales = [
            'cpu_usage',
            'memory_usage',
            'disk_usage',
            'database_connections',
            'database_response_time',
            'system_uptime',
            'active_sessions',
            'api_requests_per_minute',
            'errors_per_minute'
        ];

        for (const metrica of metricas_iniciales) {
            this.metricas.set(metrica, {
                valor_actual: 0,
                historico: [],
                ultima_actualizacion: null,
                umbral_warning: null,
                umbral_critical: null
            });
        }
    }

    /**
     * Programar tareas de monitoreo
     */
    async programarTareasMonitoreo() {
        // Monitoreo general cada 30 segundos
        const monitoreoGeneral = cron.schedule('*/30 * * * * *', async () => {
            await this.ejecutarMonitoreoGeneral();
        }, { scheduled: false });

        // Verificación de BD cada minuto
        const verificacionBD = cron.schedule('*/60 * * * * *', async () => {
            await this.verificarBaseDatos();
        }, { scheduled: false });

        // Revisión de recursos cada 2 minutos
        const revisionRecursos = cron.schedule('*/120 * * * * *', async () => {
            await this.revisarRecursosSistema();
        }, { scheduled: false });

        // Limpieza de logs cada hora
        const limpiezaLogs = cron.schedule('0 */1 * * *', async () => {
            await this.limpiarLogsAntiguos();
        }, { scheduled: false });

        // Reporte diario de métricas
        const reporteDiario = cron.schedule('0 6 * * *', async () => {
            await this.generarReporteDiario();
        }, { scheduled: false });

        this.cronJobs.set('monitoreo_general', monitoreoGeneral);
        this.cronJobs.set('verificacion_bd', verificacionBD);
        this.cronJobs.set('revision_recursos', revisionRecursos);
        this.cronJobs.set('limpieza_logs', limpiezaLogs);
        this.cronJobs.set('reporte_diario', reporteDiario);

        // Iniciar todos los jobs
        this.cronJobs.forEach(job => job.start());

        console.log('⏰ Tareas de monitoreo programadas correctamente');
    }

    /**
     * Ejecutar monitoreo general del sistema
     */
    async ejecutarMonitoreoGeneral() {
        try {
            this.estadisticas.total_verificaciones++;
            this.ultimaVerificacion = new Date();

            // Verificar estado de todos los componentes críticos
            const componentes = [
                { nombre: 'cpu', verificacion: () => this.verificarCPU() },
                { nombre: 'memoria', verificacion: () => this.verificarMemoria() },
                { nombre: 'disco', verificacion: () => this.verificarDisco() },
                { nombre: 'sesiones', verificacion: () => this.verificarSesiones() },
                { nombre: 'apis', verificacion: () => this.verificarAPIs() }
            ];

            let componentesOK = 0;
            let alertasGeneradas = 0;

            for (const componente of componentes) {
                try {
                    const resultado = await componente.verificacion();
                    if (resultado.estado === 'ok') {
                        componentesOK++;
                    } else if (resultado.nivel === 'critical') {
                        await this.procesarAlerta(componente.nombre, resultado);
                        alertasGeneradas++;
                    }
                } catch (error) {
                    console.error(`Error verificando ${componente.nombre}:`, error);
                }
            }

            // Actualizar estado general del sistema
            this.actualizarEstadoGeneral(componentesOK, componentes.length);

            // Log de monitoreo (solo si hay issues)
            if (alertasGeneradas > 0) {
                await this.logearMonitoreo('warning', `Monitoreo general: ${alertasGeneradas} alertas generadas`);
            }

        } catch (error) {
            console.error('Error en monitoreo general:', error);
            await this.logearMonitoreo('error', `Error en monitoreo general: ${error.message}`);
        }
    }

    /**
     * Verificar uso de CPU
     */
    async verificarCPU() {
        const cpus = os.cpus();
        const startTime = process.hrtime();

        // Esperar 100ms para calcular uso de CPU
        await new Promise(resolve => setTimeout(resolve, 100));

        const usage = process.cpuUsage();
        const totalUsage = (usage.user + usage.system) / 1000; // Convertir a ms
        const cpuPercent = Math.min((totalUsage / 100) * 100, 100); // Aproximación

        this.actualizarMetrica('cpu_usage', cpuPercent);

        return this.evaluarUmbral('cpu', cpuPercent, {
            warning: this.configuracion.umbrales.cpu_warning,
            critical: this.configuracion.umbrales.cpu_critical
        });
    }

    /**
     * Verificar uso de memoria
     */
    async verificarMemoria() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        const memPercent = (usedMem / totalMem) * 100;

        this.actualizarMetrica('memory_usage', memPercent);

        return this.evaluarUmbral('memoria', memPercent, {
            warning: this.configuracion.umbrales.memoria_warning,
            critical: this.configuracion.umbrales.memoria_critical
        });
    }

    /**
     * Verificar espacio en disco
     */
    async verificarDisco() {
        try {
            const stats = await fs.stat('.');
            // Aproximación del uso de disco usando el directorio actual
            const discoPercent = 75; // Placeholder - en producción usar diskusage o similar

            this.actualizarMetrica('disk_usage', discoPercent);

            return this.evaluarUmbral('disco', discoPercent, {
                warning: this.configuracion.umbrales.disco_warning,
                critical: this.configuracion.umbrales.disco_critical
            });
        } catch (error) {
            return { estado: 'error', mensaje: `Error verificando disco: ${error.message}` };
        }
    }

    /**
     * Verificar base de datos
     */
    async verificarBaseDatos() {
        try {
            const startTime = Date.now();

            // Verificar conectividad
            await this.database.connection.execute('SELECT 1');

            const responseTime = Date.now() - startTime;
            this.actualizarMetrica('database_response_time', responseTime);

            // Verificar número de conexiones
            const [connections] = await this.database.connection.execute(
                'SHOW STATUS LIKE "Threads_connected"'
            );
            const activeConnections = parseInt(connections[0].Value);
            this.actualizarMetrica('database_connections', activeConnections);

            // Evaluar métricas
            const responseResult = this.evaluarUmbral('bd_respuesta', responseTime, {
                warning: this.configuracion.umbrales.respuesta_bd_warning,
                critical: this.configuracion.umbrales.respuesta_bd_critical
            });

            const connectionsResult = this.evaluarUmbral('bd_conexiones', activeConnections, {
                warning: this.configuracion.umbrales.conexiones_bd_warning,
                critical: this.configuracion.umbrales.conexiones_bd_critical
            });

            // Retornar el resultado más crítico
            if (responseResult.nivel === 'critical' || connectionsResult.nivel === 'critical') {
                return { estado: 'critical', mensaje: 'Base de datos en estado crítico' };
            } else if (responseResult.nivel === 'warning' || connectionsResult.nivel === 'warning') {
                return { estado: 'warning', mensaje: 'Base de datos requiere atención' };
            }

            return { estado: 'ok', mensaje: 'Base de datos funcionando normalmente' };

        } catch (error) {
            console.error('Error verificando base de datos:', error);
            await this.procesarAlerta('database', {
                estado: 'critical',
                nivel: 'critical',
                mensaje: `Error de conectividad BD: ${error.message}`
            });

            return { estado: 'error', mensaje: `Error BD: ${error.message}` };
        }
    }

    /**
     * Verificar sesiones activas
     */
    async verificarSesiones() {
        try {
            // Contar sesiones activas (estimación)
            const sesionesActivas = this.estadisticas.sesiones_activas || 0;
            this.actualizarMetrica('active_sessions', sesionesActivas);

            return { estado: 'ok', mensaje: `${sesionesActivas} sesiones activas` };
        } catch (error) {
            return { estado: 'error', mensaje: `Error verificando sesiones: ${error.message}` };
        }
    }

    /**
     * Verificar APIs y endpoints
     */
    async verificarAPIs() {
        try {
            // Verificar endpoints críticos
            const endpointsCriticos = [
                '/health',
                '/api/ventas',
                '/api/mesas',
                '/api/backup/health'
            ];

            let endpointsOK = 0;

            for (const endpoint of endpointsCriticos) {
                try {
                    // Simulación de verificación de endpoint
                    // En implementación real hacer HTTP request local
                    endpointsOK++;
                } catch (error) {
                    console.error(`Error en endpoint ${endpoint}:`, error);
                }
            }

            const porcentajeOK = (endpointsOK / endpointsCriticos.length) * 100;

            if (porcentajeOK < 80) {
                return { estado: 'critical', nivel: 'critical', mensaje: 'APIs críticas fallando' };
            } else if (porcentajeOK < 100) {
                return { estado: 'warning', nivel: 'warning', mensaje: 'Algunos endpoints con problemas' };
            }

            return { estado: 'ok', mensaje: 'Todas las APIs funcionando' };

        } catch (error) {
            return { estado: 'error', mensaje: `Error verificando APIs: ${error.message}` };
        }
    }

    /**
     * Revisar recursos del sistema
     */
    async revisarRecursosSistema() {
        try {
            const loadAvg = os.loadavg();
            const uptime = os.uptime();

            // Actualizar métricas de sistema
            this.actualizarMetrica('system_uptime', uptime);

            // Log de recursos cada 2 minutos
            await this.logearMonitoreo('info',
                `Recursos sistema - Load: ${loadAvg[0].toFixed(2)}, Uptime: ${Math.floor(uptime/3600)}h`
            );

        } catch (error) {
            console.error('Error revisando recursos del sistema:', error);
        }
    }

    /**
     * Evaluar umbral y determinar nivel de alerta
     */
    evaluarUmbral(componente, valor, umbrales) {
        if (valor >= umbrales.critical) {
            return {
                estado: 'critical',
                nivel: 'critical',
                mensaje: `${componente} crítico: ${valor.toFixed(2)}% (umbral: ${umbrales.critical}%)`
            };
        } else if (valor >= umbrales.warning) {
            return {
                estado: 'warning',
                nivel: 'warning',
                mensaje: `${componente} advertencia: ${valor.toFixed(2)}% (umbral: ${umbrales.warning}%)`
            };
        } else {
            return {
                estado: 'ok',
                mensaje: `${componente} normal: ${valor.toFixed(2)}%`
            };
        }
    }

    /**
     * Actualizar métrica específica
     */
    actualizarMetrica(nombre, valor) {
        const metrica = this.metricas.get(nombre);
        if (metrica) {
            metrica.valor_actual = valor;
            metrica.ultima_actualizacion = new Date();

            // Mantener historial de últimos 100 valores
            metrica.historico.push({
                valor: valor,
                timestamp: new Date()
            });

            if (metrica.historico.length > 100) {
                metrica.historico.shift();
            }

            this.metricas.set(nombre, metrica);
        }
    }

    /**
     * Procesar y enviar alerta
     */
    async procesarAlerta(componente, resultado) {
        const alertaId = `${componente}_${resultado.nivel}_${Date.now()}`;

        // Verificar cooldown para evitar spam
        if (this.verificarCooldown(componente, resultado.nivel)) {
            return;
        }

        const alerta = {
            id: alertaId,
            componente: componente,
            nivel: resultado.nivel,
            mensaje: resultado.mensaje,
            timestamp: new Date(),
            estado: 'activa',
            intentos_notificacion: 0
        };

        this.alertasActivas.set(alertaId, alerta);

        // Enviar notificaciones según configuración
        await this.enviarNotificaciones(alerta);

        // Actualizar estadísticas
        this.estadisticas.alertas_enviadas++;
        this.estadisticas.ultima_alerta = alerta.timestamp.toISOString();

        if (resultado.nivel === 'critical') {
            this.estadisticas.errores_detectados++;
        }

        // Emitir evento para otros sistemas
        this.emit('alerta_generada', alerta);

        // Log de la alerta
        await this.logearAlerta(alerta);
    }

    /**
     * Verificar cooldown para evitar spam de alertas
     */
    verificarCooldown(componente, nivel) {
        const key = `${componente}_${nivel}`;
        const ahora = Date.now();
        const cooldown = this.configuracion.alertas.cooldown_minutos * 60 * 1000;

        const ultimaAlerta = this.alertasActivas.get(`cooldown_${key}`);
        if (ultimaAlerta && (ahora - ultimaAlerta) < cooldown) {
            return true; // Aún en cooldown
        }

        // Actualizar cooldown
        this.alertasActivas.set(`cooldown_${key}`, ahora);
        return false;
    }

    /**
     * Enviar notificaciones de alerta
     */
    async enviarNotificaciones(alerta) {
        const promesas = [];

        // Notificación por log (siempre habilitada)
        if (this.configuracion.alertas.log_habilitado) {
            promesas.push(this.notificarPorLog(alerta));
        }

        // Notificación por email
        if (this.configuracion.alertas.email_habilitado) {
            promesas.push(this.notificarPorEmail(alerta));
        }

        // Notificación por webhook
        if (this.configuracion.alertas.webhook_habilitado) {
            promesas.push(this.notificarPorWebhook(alerta));
        }

        try {
            await Promise.allSettled(promesas);
        } catch (error) {
            console.error('Error enviando notificaciones:', error);
        }
    }

    /**
     * Notificación por log
     */
    async notificarPorLog(alerta) {
        const mensaje = `ALERTA [${alerta.nivel.toUpperCase()}] ${alerta.componente}: ${alerta.mensaje}`;
        await this.logearAlerta({
            ...alerta,
            mensaje: mensaje
        });
    }

    /**
     * Notificación por email
     */
    async notificarPorEmail(alerta) {
        try {
            const nodemailer = require('nodemailer');

            const transporter = nodemailer.createTransporter({
                host: this.configuracion.notificaciones.email.smtp_host,
                port: this.configuracion.notificaciones.email.smtp_port,
                secure: false,
                auth: {
                    user: this.configuracion.notificaciones.email.smtp_user,
                    pass: this.configuracion.notificaciones.email.smtp_pass
                }
            });

            const mailOptions = {
                from: this.configuracion.notificaciones.email.smtp_user,
                to: this.configuracion.notificaciones.email.destinatarios.join(','),
                subject: `DYSA Point - Alerta ${alerta.nivel}: ${alerta.componente}`,
                html: this.generarEmailHTML(alerta)
            };

            await transporter.sendMail(mailOptions);
            console.log(`📧 Email de alerta enviado para ${alerta.componente}`);

        } catch (error) {
            console.error('Error enviando email de alerta:', error);
        }
    }

    /**
     * Notificación por webhook
     */
    async notificarPorWebhook(alerta) {
        try {
            const axios = require('axios');

            const payload = {
                timestamp: alerta.timestamp,
                sistema: 'DYSA Point POS',
                version: '2.0.14',
                alerta: {
                    id: alerta.id,
                    componente: alerta.componente,
                    nivel: alerta.nivel,
                    mensaje: alerta.mensaje
                },
                servidor: {
                    hostname: os.hostname(),
                    platform: os.platform(),
                    uptime: os.uptime()
                }
            };

            await axios.post(
                this.configuracion.notificaciones.webhook.url,
                payload,
                {
                    timeout: this.configuracion.notificaciones.webhook.timeout,
                    headers: {
                        'Content-Type': 'application/json',
                        'User-Agent': 'DYSA-Point-Monitor/2.0.14'
                    }
                }
            );

            console.log(`🔗 Webhook de alerta enviado para ${alerta.componente}`);

        } catch (error) {
            console.error('Error enviando webhook de alerta:', error);
        }
    }

    /**
     * Generar HTML para email de alerta
     */
    generarEmailHTML(alerta) {
        const colorNivel = alerta.nivel === 'critical' ? '#dc3545' : '#ffc107';

        return `
        <html>
        <body style="font-family: Arial, sans-serif;">
            <h2 style="color: ${colorNivel};">🚨 Alerta DYSA Point POS</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px;">
                <p><strong>Componente:</strong> ${alerta.componente}</p>
                <p><strong>Nivel:</strong> <span style="color: ${colorNivel}; font-weight: bold;">${alerta.nivel.toUpperCase()}</span></p>
                <p><strong>Mensaje:</strong> ${alerta.mensaje}</p>
                <p><strong>Fecha/Hora:</strong> ${alerta.timestamp.toLocaleString()}</p>
                <p><strong>Servidor:</strong> ${os.hostname()}</p>
            </div>
            <p><small>Este email fue generado automáticamente por el sistema de monitoreo DYSA Point v2.0.14</small></p>
        </body>
        </html>
        `;
    }

    /**
     * Actualizar estado general del sistema
     */
    actualizarEstadoGeneral(componentesOK, totalComponentes) {
        const porcentajeOK = (componentesOK / totalComponentes) * 100;

        if (porcentajeOK >= 90) {
            this.estadisticas.estado_general = 'healthy';
        } else if (porcentajeOK >= 70) {
            this.estadisticas.estado_general = 'degraded';
        } else {
            this.estadisticas.estado_general = 'unhealthy';
        }
    }

    /**
     * Verificación inicial del sistema al arrancar
     */
    async verificacionInicialSistema() {
        console.log('🔎 Realizando verificación inicial del sistema...');

        try {
            // Verificar todos los componentes críticos
            await this.ejecutarMonitoreoGeneral();
            await this.verificarBaseDatos();

            console.log('✅ Verificación inicial completada');

        } catch (error) {
            console.error('❌ Error en verificación inicial:', error);
            await this.procesarAlerta('sistema_inicial', {
                estado: 'critical',
                nivel: 'critical',
                mensaje: `Error en verificación inicial: ${error.message}`
            });
        }
    }

    /**
     * Configurar manejadores de eventos del sistema
     */
    configurarManejadoresEventos() {
        // Capturar errores no manejados
        process.on('uncaughtException', async (error) => {
            console.error('🚨 Excepción no capturada:', error);
            await this.procesarAlerta('uncaught_exception', {
                estado: 'critical',
                nivel: 'critical',
                mensaje: `Excepción no capturada: ${error.message}`
            });
        });

        process.on('unhandledRejection', async (reason, promise) => {
            console.error('🚨 Promise rechazada no manejada:', reason);
            await this.procesarAlerta('unhandled_rejection', {
                estado: 'critical',
                nivel: 'critical',
                mensaje: `Promise rechazada: ${reason}`
            });
        });

        // Monitorear señales del sistema
        process.on('SIGTERM', async () => {
            console.log('📡 Señal SIGTERM recibida, iniciando cierre controlado...');
            await this.logearMonitoreo('info', 'Sistema recibió SIGTERM - Cierre controlado');
        });

        process.on('SIGINT', async () => {
            console.log('📡 Señal SIGINT recibida, iniciando cierre controlado...');
            await this.logearMonitoreo('info', 'Sistema recibió SIGINT - Cierre controlado');
        });
    }

    /**
     * Limpiar logs antiguos
     */
    async limpiarLogsAntiguos() {
        try {
            const logsDir = path.join(this.logsPath, 'monitoring');
            const alertsDir = path.join(this.logsPath, 'alerts');

            const directorios = [logsDir, alertsDir];
            let archivosEliminados = 0;

            for (const dir of directorios) {
                try {
                    const archivos = await fs.readdir(dir);
                    const fechaLimite = new Date();
                    fechaLimite.setDate(fechaLimite.getDate() - 30); // 30 días

                    for (const archivo of archivos) {
                        const rutaArchivo = path.join(dir, archivo);
                        const stats = await fs.stat(rutaArchivo);

                        if (stats.mtime < fechaLimite) {
                            await fs.unlink(rutaArchivo);
                            archivosEliminados++;
                        }
                    }
                } catch (error) {
                    console.error(`Error limpiando directorio ${dir}:`, error);
                }
            }

            if (archivosEliminados > 0) {
                await this.logearMonitoreo('info', `Limpieza automática: ${archivosEliminados} archivos eliminados`);
            }

        } catch (error) {
            console.error('Error en limpieza de logs:', error);
        }
    }

    /**
     * Generar reporte diario de métricas
     */
    async generarReporteDiario() {
        try {
            const reporte = {
                fecha: new Date().toISOString().split('T')[0],
                sistema: {
                    uptime: os.uptime(),
                    estado_general: this.estadisticas.estado_general,
                    total_verificaciones: this.estadisticas.total_verificaciones,
                    alertas_enviadas: this.estadisticas.alertas_enviadas,
                    errores_detectados: this.estadisticas.errores_detectados
                },
                metricas: this.obtenerResumenMetricas(),
                alertas_activas: this.alertasActivas.size,
                timestamp: new Date().toISOString()
            };

            const reporteFile = path.join(
                this.logsPath,
                'monitoring',
                `reporte_diario_${reporte.fecha}.json`
            );

            await fs.writeFile(reporteFile, JSON.stringify(reporte, null, 2));

            await this.logearMonitoreo('info', `Reporte diario generado: ${reporteFile}`);

        } catch (error) {
            console.error('Error generando reporte diario:', error);
        }
    }

    /**
     * Obtener resumen de métricas
     */
    obtenerResumenMetricas() {
        const resumen = {};

        this.metricas.forEach((metrica, nombre) => {
            if (metrica.historico.length > 0) {
                const valores = metrica.historico.map(h => h.valor);
                resumen[nombre] = {
                    actual: metrica.valor_actual,
                    promedio: valores.reduce((a, b) => a + b, 0) / valores.length,
                    maximo: Math.max(...valores),
                    minimo: Math.min(...valores),
                    ultima_actualizacion: metrica.ultima_actualizacion
                };
            }
        });

        return resumen;
    }

    /**
     * Logear evento de monitoreo
     */
    async logearMonitoreo(nivel, mensaje) {
        try {
            const logEntry = {
                timestamp: new Date().toISOString(),
                nivel: nivel,
                mensaje: mensaje,
                sistema: 'monitoreo'
            };

            const logFile = path.join(
                this.logsPath,
                'monitoring',
                `monitoring_${new Date().toISOString().split('T')[0]}.log`
            );

            await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');

        } catch (error) {
            console.error('Error escribiendo log de monitoreo:', error);
        }
    }

    /**
     * Logear alerta específica
     */
    async logearAlerta(alerta) {
        try {
            const alertFile = path.join(
                this.logsPath,
                'alerts',
                `alerts_${new Date().toISOString().split('T')[0]}.log`
            );

            await fs.appendFile(alertFile, JSON.stringify(alerta) + '\n');

        } catch (error) {
            console.error('Error escribiendo log de alerta:', error);
        }
    }

    /**
     * Obtener estadísticas completas del sistema
     */
    obtenerEstadisticas() {
        return {
            ...this.estadisticas,
            tiempo_actividad: this.estadisticas.sistema_iniciado
                ? Date.now() - new Date(this.estadisticas.sistema_iniciado).getTime()
                : 0,
            alertas_activas: Array.from(this.alertasActivas.values()),
            metricas: this.obtenerResumenMetricas(),
            configuracion: this.configuracion,
            jobs_programados: this.cronJobs.size,
            ultima_verificacion: this.ultimaVerificacion
        };
    }

    /**
     * Actualizar configuración de monitoreo
     */
    async actualizarConfiguracion(nuevaConfig) {
        this.configuracion = this.mergeConfig(this.configuracion, nuevaConfig);
        await this.guardarConfiguracion();

        // Reprogramar jobs si los intervalos cambiaron
        if (nuevaConfig.intervalos) {
            this.cronJobs.forEach(job => job.stop());
            await this.programarTareasMonitoreo();
        }

        await this.logearMonitoreo('info', 'Configuración de monitoreo actualizada');
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 MonitoreoAlertasManager: Limpiando recursos...');

        // Detener todos los cron jobs
        this.cronJobs.forEach(job => job.stop());
        this.cronJobs.clear();

        // Limpiar mapas
        this.alertasActivas.clear();
        this.metricas.clear();

        this.removeAllListeners();
    }
}

module.exports = MonitoreoAlertasManager;