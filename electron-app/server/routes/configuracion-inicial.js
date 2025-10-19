/**
 * DYSA Point - Rutas del Sistema de Configuración Inicial
 * API REST para configuración automatizada de restaurantes
 *
 * Sistema de Producción - Configuración Inicial Empresarial
 * Compatible con diferentes tipos de restaurantes
 *
 * @author DYSA Point Development Team
 * @version 2.0.14
 * @date 2025-10-13
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

class ConfiguracionInicialRoutes {
    constructor(configuracionInicialManager, database) {
        this.configuracionInicialManager = configuracionInicialManager;
        this.database = database;
        this.router = express.Router();
        this.setupRateLimit();
        this.setupRoutes();
    }

    setupRateLimit() {
        // Rate limiting para configuración inicial (más restrictivo)
        this.setupRateLimiter = rateLimit({
            windowMs: 60 * 1000, // 1 minuto
            max: 10, // Solo 10 requests por minuto para configuración
            message: {
                success: false,
                error: 'Demasiadas solicitudes de configuración. Intente en unos momentos.',
                code: 'SETUP_RATE_LIMIT_EXCEEDED'
            },
            standardHeaders: true,
            legacyHeaders: false
        });

        // Rate limiting general
        this.generalRateLimiter = rateLimit({
            windowMs: 60 * 1000,
            max: 50,
            message: {
                success: false,
                error: 'Demasiadas solicitudes. Limite: 50 por minuto.',
                code: 'RATE_LIMIT_EXCEEDED'
            }
        });

        this.router.use('/configurar', this.setupRateLimiter);
        this.router.use(this.generalRateLimiter);
    }

    setupRoutes() {
        // ==================== ENDPOINTS DE CONFIGURACIÓN INICIAL ====================

        // Ejecutar configuración inicial completa
        this.router.post('/configurar', async (req, res) => {
            try {
                const datosRestaurante = req.body;

                // Validación de datos requeridos
                const camposRequeridos = [
                    'nombre', 'direccion', 'telefono', 'email',
                    'admin.username', 'admin.password', 'admin.email', 'admin.nombre'
                ];

                for (const campo of camposRequeridos) {
                    const valor = this.obtenerValorAnidado(datosRestaurante, campo);
                    if (!valor) {
                        return res.status(400).json({
                            success: false,
                            error: `Campo requerido faltante: ${campo}`
                        });
                    }
                }

                // Validar formato de email
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(datosRestaurante.email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Formato de email inválido'
                    });
                }

                if (!emailRegex.test(datosRestaurante.admin.email)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Formato de email del administrador inválido'
                    });
                }

                // Validar contraseña del administrador
                if (datosRestaurante.admin.password.length < 8) {
                    return res.status(400).json({
                        success: false,
                        error: 'La contraseña del administrador debe tener al menos 8 caracteres'
                    });
                }

                // Ejecutar configuración
                const resultado = await this.configuracionInicialManager.ejecutarConfiguracionCompleta(datosRestaurante);

                res.status(201).json({
                    success: true,
                    message: 'Sistema configurado exitosamente para producción',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error en configuración inicial:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno en configuración inicial',
                    details: error.message
                });
            }
        });

        // Obtener plantillas de configuración por tipo de restaurante
        this.router.get('/plantillas/:tipo', async (req, res) => {
            try {
                const tipo = req.params.tipo;
                const plantilla = this.obtenerPlantillaConfiguracion(tipo);

                res.json({
                    success: true,
                    data: plantilla,
                    tipo: tipo,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo plantilla:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo plantilla de configuración',
                    details: error.message
                });
            }
        });

        // Verificar estado de configuración actual
        this.router.get('/estado', async (req, res) => {
            try {
                const estado = await this.configuracionInicialManager.obtenerEstadoConfiguracion();

                res.json({
                    success: true,
                    data: estado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error verificando estado:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error verificando estado de configuración',
                    details: error.message
                });
            }
        });

        // Verificar requisitos del sistema
        this.router.get('/requisitos', async (req, res) => {
            try {
                const requisitos = await this.verificarRequisitos();

                res.json({
                    success: true,
                    data: requisitos,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error verificando requisitos:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error verificando requisitos del sistema',
                    details: error.message
                });
            }
        });

        // Obtener configuración actual del sistema
        this.router.get('/configuracion-actual', async (req, res) => {
            try {
                const configuracion = await this.obtenerConfiguracionActual();

                res.json({
                    success: true,
                    data: configuracion,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo configuración actual',
                    details: error.message
                });
            }
        });

        // Actualizar configuración específica
        this.router.put('/actualizar/:seccion', async (req, res) => {
            try {
                const seccion = req.params.seccion;
                const nuevaConfig = req.body;

                const secciones_validas = ['servidor', 'base_datos', 'backup', 'logs', 'seguridad'];
                if (!secciones_validas.includes(seccion)) {
                    return res.status(400).json({
                        success: false,
                        error: `Sección inválida. Válidas: ${secciones_validas.join(', ')}`
                    });
                }

                await this.actualizarSeccionConfiguracion(seccion, nuevaConfig);

                res.json({
                    success: true,
                    message: `Sección ${seccion} actualizada exitosamente`,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error actualizando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando configuración',
                    details: error.message
                });
            }
        });

        // Generar backup de configuración
        this.router.post('/backup-configuracion', async (req, res) => {
            try {
                const backupPath = await this.generarBackupConfiguracion();

                res.json({
                    success: true,
                    message: 'Backup de configuración generado exitosamente',
                    backup_path: backupPath,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error generando backup:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error generando backup de configuración',
                    details: error.message
                });
            }
        });

        // Restaurar configuración desde backup
        this.router.post('/restaurar-configuracion', async (req, res) => {
            try {
                const { backup_path } = req.body;

                if (!backup_path) {
                    return res.status(400).json({
                        success: false,
                        error: 'Ruta del backup requerida'
                    });
                }

                await this.restaurarConfiguracionDesdeBackup(backup_path);

                res.json({
                    success: true,
                    message: 'Configuración restaurada exitosamente',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error restaurando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error restaurando configuración',
                    details: error.message
                });
            }
        });

        // Validar configuración actual
        this.router.post('/validar', async (req, res) => {
            try {
                const validacion = await this.validarConfiguracion();

                res.json({
                    success: true,
                    data: validacion,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error validando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error validando configuración',
                    details: error.message
                });
            }
        });

        // Health check específico de configuración
        this.router.get('/health', async (req, res) => {
            try {
                const health = await this.verificarSaludConfiguracion();

                res.json({
                    success: true,
                    status: health.status,
                    data: health,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error verificando salud:', error);
                res.status(503).json({
                    success: false,
                    status: 'unhealthy',
                    error: 'Error verificando salud del sistema de configuración',
                    details: error.message
                });
            }
        });

        console.log('✅ Rutas del Sistema de Configuración Inicial configuradas');
        console.log('📋 Total de endpoints implementados: 9 endpoints especializados');
    }

    /**
     * Obtener valor anidado de un objeto usando notación de puntos
     */
    obtenerValorAnidado(obj, path) {
        return path.split('.').reduce((current, key) => current && current[key], obj);
    }

    /**
     * Obtener plantilla de configuración según tipo de restaurante
     */
    obtenerPlantillaConfiguracion(tipo) {
        const plantillas = {
            casual: {
                nombre: "Restaurante Casual",
                tipo: "casual",
                mesas: { cantidad: 20, capacidad_default: 4 },
                productos: [
                    { nombre: 'Hamburguesa Clásica', precio: 8500, categoria: 'Platos Principales' },
                    { nombre: 'Pizza Margherita', precio: 12000, categoria: 'Platos Principales' },
                    { nombre: 'Ensalada César', precio: 7500, categoria: 'Ensaladas' }
                ],
                cocina: [
                    { nombre: 'Cocina Principal', bloque_default: 2, activa: true },
                    { nombre: 'Bar', bloque_default: 1, activa: true }
                ]
            },
            fino: {
                nombre: "Restaurante Fino",
                tipo: "fino",
                mesas: { cantidad: 15, capacidad_default: 2 },
                productos: [
                    { nombre: 'Filete Wellington', precio: 25000, categoria: 'Platos Principales' },
                    { nombre: 'Carpaccio de Res', precio: 18000, categoria: 'Entradas' },
                    { nombre: 'Vino Tinto Reserva', precio: 15000, categoria: 'Vinos' }
                ],
                cocina: [
                    { nombre: 'Cocina Gourmet', bloque_default: 3, activa: true },
                    { nombre: 'Pastelería', bloque_default: 2, activa: true }
                ]
            },
            rapido: {
                nombre: "Comida Rápida",
                tipo: "rapido",
                mesas: { cantidad: 25, capacidad_default: 2 },
                productos: [
                    { nombre: 'Hamburguesa Simple', precio: 4500, categoria: 'Hamburguesas' },
                    { nombre: 'Papas Fritas', precio: 3000, categoria: 'Acompañamientos' },
                    { nombre: 'Bebida Grande', precio: 2500, categoria: 'Bebidas' }
                ],
                cocina: [
                    { nombre: 'Parrilla Express', bloque_default: 1, activa: true },
                    { nombre: 'Fritura', bloque_default: 1, activa: true }
                ]
            },
            bar: {
                nombre: "Bar/Pub",
                tipo: "bar",
                mesas: { cantidad: 30, capacidad_default: 4 },
                productos: [
                    { nombre: 'Cerveza Nacional', precio: 3500, categoria: 'Cerveza' },
                    { nombre: 'Pisco Sour', precio: 5500, categoria: 'Cócteles' },
                    { nombre: 'Tabla de Quesos', precio: 8500, categoria: 'Picoteos' }
                ],
                cocina: [
                    { nombre: 'Bar Principal', bloque_default: 1, activa: true },
                    { nombre: 'Cocina Rápida', bloque_default: 1, activa: true }
                ]
            }
        };

        return plantillas[tipo] || plantillas.casual;
    }

    /**
     * Verificar requisitos del sistema
     */
    async verificarRequisitos() {
        const requisitos = {
            node_version: {
                actual: process.version,
                requerida: '>=16.0.0',
                cumple: parseInt(process.version.substring(1)) >= 16
            },
            memoria: {
                actual: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
                requerida: 512,
                cumple: process.memoryUsage().heapTotal >= 512 * 1024 * 1024
            },
            base_datos: {
                conectado: false,
                version: null
            },
            directorios: {
                permisos_escritura: true
            }
        };

        // Verificar conexión a base de datos
        try {
            const [rows] = await this.database.connection.execute('SELECT VERSION() as version');
            requisitos.base_datos.conectado = true;
            requisitos.base_datos.version = rows[0].version;
        } catch (error) {
            requisitos.base_datos.conectado = false;
            requisitos.base_datos.error = error.message;
        }

        return requisitos;
    }

    /**
     * Obtener configuración actual
     */
    async obtenerConfiguracionActual() {
        const fs = require('fs').promises;
        const path = require('path');

        try {
            const configPath = path.join(__dirname, '..', '..', 'config', 'sistema.json');
            const configContent = await fs.readFile(configPath, 'utf8');
            return JSON.parse(configContent);
        } catch (error) {
            return { error: 'Configuración no encontrada o no válida' };
        }
    }

    /**
     * Actualizar sección específica de configuración
     */
    async actualizarSeccionConfiguracion(seccion, nuevaConfig) {
        const fs = require('fs').promises;
        const path = require('path');

        const configPath = path.join(__dirname, '..', '..', 'config', 'sistema.json');
        const configContent = await fs.readFile(configPath, 'utf8');
        const config = JSON.parse(configContent);

        config[seccion] = { ...config[seccion], ...nuevaConfig };
        config.sistema.ultima_actualizacion = new Date().toISOString();

        await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    }

    /**
     * Generar backup de configuración
     */
    async generarBackupConfiguracion() {
        const fs = require('fs').promises;
        const path = require('path');

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '..', '..', 'backups', 'config');
        const backupFile = path.join(backupDir, `config_backup_${timestamp}.json`);

        // Crear directorio si no existe
        try {
            await fs.mkdir(backupDir, { recursive: true });
        } catch {}

        // Copiar configuración actual
        const configPath = path.join(__dirname, '..', '..', 'config', 'sistema.json');
        const configContent = await fs.readFile(configPath, 'utf8');
        await fs.writeFile(backupFile, configContent);

        return backupFile;
    }

    /**
     * Restaurar configuración desde backup
     */
    async restaurarConfiguracionDesdeBackup(backupPath) {
        const fs = require('fs').promises;
        const path = require('path');

        const configPath = path.join(__dirname, '..', '..', 'config', 'sistema.json');
        const backupContent = await fs.readFile(backupPath, 'utf8');
        await fs.writeFile(configPath, backupContent);
    }

    /**
     * Validar configuración actual
     */
    async validarConfiguracion() {
        const config = await this.obtenerConfiguracionActual();

        const validacion = {
            valida: true,
            errores: [],
            advertencias: []
        };

        // Validar campos requeridos
        const camposRequeridos = [
            'sistema.version',
            'restaurante.nombre',
            'servidor.puerto',
            'base_datos.nombre'
        ];

        for (const campo of camposRequeridos) {
            if (!this.obtenerValorAnidado(config, campo)) {
                validacion.valida = false;
                validacion.errores.push(`Campo requerido faltante: ${campo}`);
            }
        }

        // Validar puerto
        const puerto = config.servidor?.puerto;
        if (puerto && (puerto < 1024 || puerto > 65535)) {
            validacion.advertencias.push('Puerto fuera del rango recomendado (1024-65535)');
        }

        return validacion;
    }

    /**
     * Verificar salud del sistema de configuración
     */
    async verificarSaludConfiguracion() {
        const fs = require('fs').promises;
        const path = require('path');

        const health = {
            status: 'healthy',
            checks: {}
        };

        // Verificar archivos de configuración
        try {
            const configPath = path.join(__dirname, '..', '..', 'config', 'sistema.json');
            await fs.access(configPath);
            health.checks.config_file = { status: 'ok' };
        } catch {
            health.checks.config_file = { status: 'error', message: 'Archivo de configuración no encontrado' };
            health.status = 'unhealthy';
        }

        // Verificar directorios
        const directorios = ['config', 'backups', 'logs'];
        for (const dir of directorios) {
            try {
                const dirPath = path.join(__dirname, '..', '..', dir);
                await fs.access(dirPath);
                health.checks[`dir_${dir}`] = { status: 'ok' };
            } catch {
                health.checks[`dir_${dir}`] = { status: 'error', message: `Directorio ${dir} no encontrado` };
                health.status = 'degraded';
            }
        }

        return health;
    }

    getRouter() {
        return this.router;
    }
}

module.exports = ConfiguracionInicialRoutes;