/**
 * DYSA Point POS v2.0.14 - Rutas de Documentación Técnica
 *
 * Sistema de rutas especializadas para la generación automática de
 * documentación técnica empresarial para restaurantes.
 *
 * Endpoints especializados para:
 * - Generación de documentación completa
 * - Exportación a múltiples formatos
 * - Gestión de plantillas personalizadas
 * - Configuración de tipos de restaurante
 * - Descarga de paquetes de documentación
 * - Estadísticas de uso y generación
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs').promises;

class DocumentacionTecnicaRoutes {
    constructor(documentacionManager) {
        this.router = express.Router();
        this.documentacionManager = documentacionManager;
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Rate limiting diferenciado para documentación
        this.rateLimiters = {
            // Límite para generación de documentación completa (intensivo)
            generacion: rateLimit({
                windowMs: 15 * 60 * 1000, // 15 minutos
                max: 3, // 3 generaciones por ventana
                message: {
                    error: 'Demasiadas solicitudes de generación',
                    limite: '3 generaciones cada 15 minutos',
                    reintentar_en: '15 minutos'
                },
                standardHeaders: true,
                legacyHeaders: false
            }),

            // Límite para consultas y configuración
            consultas: rateLimit({
                windowMs: 1 * 60 * 1000, // 1 minuto
                max: 30, // 30 consultas por minuto
                message: {
                    error: 'Demasiadas consultas de documentación',
                    limite: '30 consultas por minuto'
                }
            }),

            // Límite para descargas
            descargas: rateLimit({
                windowMs: 5 * 60 * 1000, // 5 minutos
                max: 10, // 10 descargas por ventana
                message: {
                    error: 'Demasiadas descargas',
                    limite: '10 descargas cada 5 minutos'
                }
            })
        };

        // Middleware de validación de parámetros
        this.router.use((req, res, next) => {
            // Logging de requests de documentación
            console.log(`📚 DocumentacionTecnica API: ${req.method} ${req.path}`);
            next();
        });
    }

    setupRoutes() {
        // Endpoint principal: Generar documentación completa
        this.router.post('/generar', this.rateLimiters.generacion, async (req, res) => {
            try {
                const startTime = Date.now();
                console.log('📚 Iniciando generación de documentación completa...');

                const {
                    tipo_restaurante = 'casual',
                    idioma = 'es',
                    formatos = ['pdf', 'html', 'markdown'],
                    incluir_screenshots = true,
                    incluir_diagramas = true,
                    personalizar_marca = false,
                    datos_restaurante = {},
                    configuracion_especial = {}
                } = req.body;

                // Validar parámetros
                const tiposValidos = ['casual', 'fino', 'rapido', 'bar', 'cafeteria'];
                if (!tiposValidos.includes(tipo_restaurante)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tipo de restaurante no válido',
                        tipos_validos: tiposValidos
                    });
                }

                const idiomasValidos = ['es', 'en', 'pt'];
                if (!idiomasValidos.includes(idioma)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Idioma no soportado',
                        idiomas_validos: idiomasValidos
                    });
                }

                const formatosValidos = ['pdf', 'html', 'markdown', 'word'];
                const formatosInvalidos = formatos.filter(f => !formatosValidos.includes(f));
                if (formatosInvalidos.length > 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'Formatos no válidos detectados',
                        formatos_invalidos: formatosInvalidos,
                        formatos_validos: formatosValidos
                    });
                }

                // Configuración de generación
                const configuracion = {
                    tipo_restaurante,
                    idioma,
                    formatos,
                    incluir_screenshots,
                    incluir_diagramas,
                    personalizar_marca,
                    datos_restaurante,
                    configuracion_especial
                };

                // Ejecutar generación
                const resultados = await this.documentacionManager.generarDocumentacionCompleta(configuracion);

                const tiempoTotal = Date.now() - startTime;

                res.json({
                    success: true,
                    mensaje: 'Documentación generada exitosamente',
                    configuracion,
                    resultados: {
                        ...resultados,
                        tiempo_total_ms: tiempoTotal,
                        tiempo_total_readable: `${Math.round(tiempoTotal / 1000)}s`
                    },
                    timestamp: new Date().toISOString()
                });

                console.log(`✅ Documentación completa generada en ${Math.round(tiempoTotal / 1000)}s`);

            } catch (error) {
                console.error('❌ Error generando documentación:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error interno generando documentación',
                    mensaje: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Endpoint: Generar documento específico
        this.router.post('/generar/:tipo', this.rateLimiters.consultas, async (req, res) => {
            try {
                const { tipo } = req.params;
                const {
                    tipo_restaurante = 'casual',
                    idioma = 'es',
                    formato = 'markdown'
                } = req.body;

                // Validar tipo de documento
                const tiposDisponibles = Object.keys(this.documentacionManager.tiposDocumentacion);
                if (!tiposDisponibles.includes(tipo)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tipo de documento no válido',
                        tipos_disponibles: tiposDisponibles
                    });
                }

                const configuracion = { tipo_restaurante, idioma };
                const documento = await this.documentacionManager.generarDocumento(tipo, configuracion);
                const archivoExportado = await this.documentacionManager.exportarDocumento(documento, formato, configuracion);

                res.json({
                    success: true,
                    documento: {
                        id: documento.id,
                        tipo: documento.tipo,
                        titulo: documento.titulo,
                        fecha_generacion: documento.fecha_generacion
                    },
                    archivo_generado: archivoExportado,
                    configuracion
                });

            } catch (error) {
                console.error('❌ Error generando documento específico:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error generando documento específico',
                    mensaje: error.message
                });
            }
        });

        // Endpoint: Obtener tipos de documentación disponibles
        this.router.get('/tipos', this.rateLimiters.consultas, async (req, res) => {
            try {
                const tipos = this.documentacionManager.tiposDocumentacion;

                res.json({
                    success: true,
                    tipos_documentacion: Object.entries(tipos).map(([id, info]) => ({
                        id,
                        nombre: info.nombre,
                        descripcion: info.descripcion,
                        audiencia: info.audiencia,
                        prioridad: info.prioridad
                    })),
                    total: Object.keys(tipos).length
                });

            } catch (error) {
                console.error('❌ Error obteniendo tipos de documentación:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo tipos de documentación'
                });
            }
        });

        // Endpoint: Obtener plantillas por tipo de restaurante
        this.router.get('/plantillas/:tipo_restaurante', this.rateLimiters.consultas, async (req, res) => {
            try {
                const { tipo_restaurante } = req.params;

                const tiposValidos = ['casual', 'fino', 'rapido', 'bar', 'cafeteria'];
                if (!tiposValidos.includes(tipo_restaurante)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Tipo de restaurante no válido',
                        tipos_validos: tiposValidos
                    });
                }

                // Obtener configuraciones específicas para el tipo de restaurante
                const plantillas = {
                    configuraciones_especificas: this.obtenerConfiguracionesPorTipo(tipo_restaurante),
                    parametros_recomendados: this.obtenerParametrosRecomendados(tipo_restaurante),
                    hardware_sugerido: this.obtenerHardwareSugerido(tipo_restaurante),
                    optimizaciones: this.obtenerOptimizaciones(tipo_restaurante)
                };

                res.json({
                    success: true,
                    tipo_restaurante,
                    plantillas,
                    aplicable_para: this.getDescripcionTipoRestaurante(tipo_restaurante)
                });

            } catch (error) {
                console.error('❌ Error obteniendo plantillas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo plantillas'
                });
            }
        });

        // Endpoint: Listar archivos de documentación generados
        this.router.get('/archivos', this.rateLimiters.consultas, async (req, res) => {
            try {
                const { formato, tipo_restaurante, dias = 30 } = req.query;

                const outputPath = this.documentacionManager.outputPath;
                const archivos = [];

                const directorios = ['pdf', 'html', 'markdown', 'paquetes'];
                const limiteFecha = new Date();
                limiteFecha.setDate(limiteFecha.getDate() - parseInt(dias));

                for (const directorio of directorios) {
                    try {
                        const dirPath = path.join(outputPath, directorio);
                        const files = await fs.readdir(dirPath);

                        for (const file of files) {
                            const filePath = path.join(dirPath, file);
                            const stats = await fs.stat(filePath);

                            // Filtrar por fecha
                            if (stats.mtime < limiteFecha) continue;

                            // Filtrar por formato si se especifica
                            if (formato && directorio !== formato) continue;

                            // Filtrar por tipo de restaurante si se especifica
                            if (tipo_restaurante && !file.includes(tipo_restaurante)) continue;

                            archivos.push({
                                nombre: file,
                                directorio,
                                tamaño: stats.size,
                                fecha_creacion: stats.mtime,
                                ruta_descarga: `/api/documentacion/descargar/${directorio}/${file}`
                            });
                        }
                    } catch (error) {
                        console.warn(`⚠️ Error accediendo directorio ${directorio}:`, error.message);
                    }
                }

                // Ordenar por fecha de creación (más recientes primero)
                archivos.sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion));

                res.json({
                    success: true,
                    archivos,
                    total: archivos.length,
                    filtros_aplicados: {
                        formato: formato || 'todos',
                        tipo_restaurante: tipo_restaurante || 'todos',
                        dias_antiguedad: parseInt(dias)
                    }
                });

            } catch (error) {
                console.error('❌ Error listando archivos:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error listando archivos de documentación'
                });
            }
        });

        // Endpoint: Descargar archivo específico
        this.router.get('/descargar/:directorio/:archivo', this.rateLimiters.descargas, async (req, res) => {
            try {
                const { directorio, archivo } = req.params;

                // Validar directorio permitido
                const directoriosPermitidos = ['pdf', 'html', 'markdown', 'paquetes', 'screenshots', 'diagramas'];
                if (!directoriosPermitidos.includes(directorio)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Directorio no permitido',
                        directorios_permitidos: directoriosPermitidos
                    });
                }

                // Validar que el archivo existe
                const filePath = path.join(this.documentacionManager.outputPath, directorio, archivo);

                try {
                    await fs.access(filePath);
                } catch (error) {
                    return res.status(404).json({
                        success: false,
                        error: 'Archivo no encontrado',
                        archivo: archivo,
                        directorio: directorio
                    });
                }

                // Obtener información del archivo
                const stats = await fs.stat(filePath);

                // Configurar headers para descarga
                res.setHeader('Content-Disposition', `attachment; filename="${archivo}"`);
                res.setHeader('Content-Length', stats.size);

                // Determinar content-type basado en extensión
                const ext = path.extname(archivo).toLowerCase();
                const contentTypes = {
                    '.pdf': 'application/pdf',
                    '.html': 'text/html',
                    '.md': 'text/markdown',
                    '.zip': 'application/zip',
                    '.png': 'image/png',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg'
                };
                res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream');

                // Enviar archivo
                res.sendFile(filePath);

                console.log(`📁 Descarga iniciada: ${archivo} (${Math.round(stats.size / 1024)} KB)`);

            } catch (error) {
                console.error('❌ Error en descarga:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error procesando descarga'
                });
            }
        });

        // Endpoint: Obtener configuración actual del sistema de documentación
        this.router.get('/configuracion', this.rateLimiters.consultas, async (req, res) => {
            try {
                const configuracion = this.documentacionManager.configuracion;

                res.json({
                    success: true,
                    configuracion: {
                        idiomas_soportados: configuracion.idiomas,
                        formatos_soportados: configuracion.formatos,
                        tipos_restaurante_soportados: configuracion.tipos_restaurante,
                        incluir_screenshots: configuracion.incluir_screenshots,
                        incluir_diagramas: configuracion.incluir_diagramas,
                        versionado_activo: configuracion.versionado
                    },
                    rutas_archivos: {
                        documentacion: this.documentacionManager.docsPath,
                        plantillas: this.documentacionManager.templatesPath,
                        salida: this.documentacionManager.outputPath
                    },
                    sistema: {
                        version: '2.0.14',
                        tipos_documentacion: Object.keys(this.documentacionManager.tiposDocumentacion).length,
                        plantillas_cargadas: Object.keys(this.documentacionManager.plantillasBase).length
                    }
                });

            } catch (error) {
                console.error('❌ Error obteniendo configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo configuración de documentación'
                });
            }
        });

        // Endpoint: Actualizar configuración del sistema
        this.router.put('/configuracion', this.rateLimiters.consultas, async (req, res) => {
            try {
                const {
                    idiomas,
                    formatos,
                    incluir_screenshots,
                    incluir_diagramas,
                    versionado,
                    configuraciones_especiales
                } = req.body;

                const nuevaConfiguracion = {};

                // Validar y aplicar cambios de idiomas
                if (idiomas) {
                    const idiomasValidos = ['es', 'en', 'pt'];
                    const idiomasInvalidos = idiomas.filter(i => !idiomasValidos.includes(i));
                    if (idiomasInvalidos.length > 0) {
                        return res.status(400).json({
                            success: false,
                            error: 'Idiomas no válidos',
                            idiomas_invalidos: idiomasInvalidos,
                            idiomas_validos: idiomasValidos
                        });
                    }
                    nuevaConfiguracion.idiomas = idiomas;
                }

                // Validar y aplicar cambios de formatos
                if (formatos) {
                    const formatosValidos = ['pdf', 'html', 'markdown', 'word'];
                    const formatosInvalidos = formatos.filter(f => !formatosValidos.includes(f));
                    if (formatosInvalidos.length > 0) {
                        return res.status(400).json({
                            success: false,
                            error: 'Formatos no válidos',
                            formatos_invalidos: formatosInvalidos,
                            formatos_validos: formatosValidos
                        });
                    }
                    nuevaConfiguracion.formatos = formatos;
                }

                // Aplicar otras configuraciones
                if (typeof incluir_screenshots === 'boolean') {
                    nuevaConfiguracion.incluir_screenshots = incluir_screenshots;
                }

                if (typeof incluir_diagramas === 'boolean') {
                    nuevaConfiguracion.incluir_diagramas = incluir_diagramas;
                }

                if (typeof versionado === 'boolean') {
                    nuevaConfiguracion.versionado = versionado;
                }

                if (configuraciones_especiales) {
                    nuevaConfiguracion.configuraciones_especiales = configuraciones_especiales;
                }

                // Actualizar configuración
                await this.documentacionManager.actualizarConfiguracion(nuevaConfiguracion);

                res.json({
                    success: true,
                    mensaje: 'Configuración actualizada exitosamente',
                    configuracion_aplicada: nuevaConfiguracion,
                    timestamp: new Date().toISOString()
                });

                console.log('⚙️ Configuración de documentación actualizada');

            } catch (error) {
                console.error('❌ Error actualizando configuración:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error actualizando configuración de documentación'
                });
            }
        });

        // Endpoint: Obtener estadísticas del sistema de documentación
        this.router.get('/estadisticas', this.rateLimiters.consultas, async (req, res) => {
            try {
                const estadisticas = await this.documentacionManager.obtenerEstadisticas();

                // Obtener estadísticas adicionales de archivos
                const outputPath = this.documentacionManager.outputPath;
                const estadisticasArchivos = {};

                const directorios = ['pdf', 'html', 'markdown', 'paquetes', 'screenshots', 'diagramas'];
                let totalArchivos = 0;
                let totalTamaño = 0;

                for (const directorio of directorios) {
                    try {
                        const dirPath = path.join(outputPath, directorio);
                        const files = await fs.readdir(dirPath);

                        let tamañoDirectorio = 0;
                        for (const file of files) {
                            const filePath = path.join(dirPath, file);
                            const stats = await fs.stat(filePath);
                            tamañoDirectorio += stats.size;
                        }

                        estadisticasArchivos[directorio] = {
                            cantidad: files.length,
                            tamaño_bytes: tamañoDirectorio,
                            tamaño_mb: Math.round(tamañoDirectorio / 1024 / 1024 * 100) / 100
                        };

                        totalArchivos += files.length;
                        totalTamaño += tamañoDirectorio;
                    } catch (error) {
                        estadisticasArchivos[directorio] = { cantidad: 0, tamaño_bytes: 0, tamaño_mb: 0 };
                    }
                }

                res.json({
                    success: true,
                    estadisticas_sistema: estadisticas,
                    estadisticas_archivos: {
                        ...estadisticasArchivos,
                        total: {
                            archivos: totalArchivos,
                            tamaño_bytes: totalTamaño,
                            tamaño_mb: Math.round(totalTamaño / 1024 / 1024 * 100) / 100,
                            tamaño_gb: Math.round(totalTamaño / 1024 / 1024 / 1024 * 100) / 100
                        }
                    },
                    uso_espacio: {
                        recomendacion_limpieza: totalTamaño > 1024 * 1024 * 1024, // > 1GB
                        archivos_antiguos: totalArchivos > 100
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('❌ Error obteniendo estadísticas:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error obteniendo estadísticas de documentación'
                });
            }
        });

        // Endpoint: Limpiar archivos antiguos
        this.router.delete('/limpiar', this.rateLimiters.consultas, async (req, res) => {
            try {
                const { dias = 30 } = req.query;

                if (isNaN(parseInt(dias)) || parseInt(dias) < 1) {
                    return res.status(400).json({
                        success: false,
                        error: 'Parámetro dias debe ser un número mayor a 0'
                    });
                }

                const archivosEliminados = await this.documentacionManager.limpiarArchivosAntiguos(parseInt(dias));

                res.json({
                    success: true,
                    mensaje: 'Limpieza completada exitosamente',
                    archivos_eliminados: archivosEliminados,
                    criterio_limpieza: `Archivos anteriores a ${dias} días`,
                    timestamp: new Date().toISOString()
                });

                console.log(`🧹 Limpieza de documentación completada: ${archivosEliminados} archivos eliminados`);

            } catch (error) {
                console.error('❌ Error en limpieza:', error);
                res.status(500).json({
                    success: false,
                    error: 'Error ejecutando limpieza de archivos'
                });
            }
        });

        // Endpoint: Health check del sistema de documentación
        this.router.get('/health', this.rateLimiters.consultas, async (req, res) => {
            try {
                const health = {
                    status: 'healthy',
                    timestamp: new Date().toISOString(),
                    version: '2.0.14'
                };

                // Verificar servicios críticos
                const checks = {
                    documentacion_manager: !!this.documentacionManager,
                    directorio_salida: false,
                    directorio_plantillas: false,
                    configuracion_cargada: !!this.documentacionManager.configuracion,
                    plantillas_disponibles: false
                };

                // Verificar directorios
                try {
                    await fs.access(this.documentacionManager.outputPath);
                    checks.directorio_salida = true;
                } catch (error) {
                    health.status = 'degraded';
                }

                try {
                    await fs.access(this.documentacionManager.templatesPath);
                    checks.directorio_plantillas = true;
                } catch (error) {
                    health.status = 'degraded';
                }

                // Verificar plantillas
                checks.plantillas_disponibles = Object.keys(this.documentacionManager.plantillasBase).length > 0;

                // Verificar dependencias críticas
                const dependencias = {
                    puppeteer: false,
                    marked: false,
                    archiver: false
                };

                try {
                    require('puppeteer');
                    dependencias.puppeteer = true;
                } catch (error) {
                    health.status = 'degraded';
                }

                try {
                    require('marked');
                    dependencias.marked = true;
                } catch (error) {
                    health.status = 'unhealthy';
                }

                try {
                    require('archiver');
                    dependencias.archiver = true;
                } catch (error) {
                    health.status = 'degraded';
                }

                // Determinar estado final
                const checksPassed = Object.values(checks).filter(Boolean).length;
                const totalChecks = Object.values(checks).length;
                const dependenciasPassed = Object.values(dependencias).filter(Boolean).length;
                const totalDependencias = Object.values(dependencias).length;

                if (checksPassed < totalChecks * 0.5 || dependenciasPassed < totalDependencias * 0.5) {
                    health.status = 'unhealthy';
                } else if (checksPassed < totalChecks || dependenciasPassed < totalDependencias) {
                    health.status = 'degraded';
                }

                health.checks = checks;
                health.dependencias = dependencias;
                health.score = {
                    checks: `${checksPassed}/${totalChecks}`,
                    dependencias: `${dependenciasPassed}/${totalDependencias}`,
                    porcentaje_salud: Math.round((checksPassed + dependenciasPassed) / (totalChecks + totalDependencias) * 100)
                };

                const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
                res.status(statusCode).json({
                    success: health.status !== 'unhealthy',
                    health
                });

            } catch (error) {
                console.error('❌ Error en health check:', error);
                res.status(503).json({
                    success: false,
                    health: {
                        status: 'unhealthy',
                        error: error.message,
                        timestamp: new Date().toISOString()
                    }
                });
            }
        });
    }

    // Métodos auxiliares para plantillas por tipo de restaurante
    obtenerConfiguracionesPorTipo(tipo) {
        const configuraciones = {
            casual: {
                tiempo_servicio: { max: 90, alerta: 60, promedio: 15 },
                bloques_cocina: ['11:00-14:30', '14:30-17:00', '17:00-20:30', '20:30-23:00'],
                promociones: { hora_feliz: '15:00-18:00', menu_ejecutivo: '12:00-15:00' }
            },
            fino: {
                tiempo_servicio: { max: 180, alerta: 120, promedio: 30 },
                reservas: { requeridas: true, anticipacion: 24 },
                servicios_especiales: ['menu_degustacion', 'carta_vinos', 'sommelier']
            },
            rapido: {
                tiempo_servicio: { max: 8, alerta: 10, objetivo: 5 },
                modalidades: ['para_llevar', 'delivery', 'autoservicio', 'drive_through'],
                optimizaciones: ['combos_automaticos', 'upselling_inteligente']
            },
            bar: {
                horarios_especiales: { happy_hour: '17:00-20:00', nocturno: '20:00-02:00' },
                servicios: ['barra', 'entretenimiento', 'eventos'],
                controles: ['edad', 'limite_alcohol']
            },
            cafeteria: {
                productos: ['cafe_especialidad', 'panaderia', 'opciones_veganas'],
                horarios: ['06:00-11:00', '11:00-16:00', '16:00-19:00', '19:00-22:00'],
                servicios: ['wifi_gratuito', 'trabajo_estudio']
            }
        };

        return configuraciones[tipo] || configuraciones.casual;
    }

    obtenerParametrosRecomendados(tipo) {
        const parametros = {
            casual: {
                cpu_alerta: 70, memoria_alerta: 75, disco_alerta: 80,
                tiempo_respuesta_max: 3000, transacciones_por_minuto: 30
            },
            fino: {
                cpu_alerta: 60, memoria_alerta: 70, disco_alerta: 75,
                tiempo_respuesta_max: 2000, transacciones_por_minuto: 15,
                monitoreo_personalizado: true
            },
            rapido: {
                cpu_alerta: 80, memoria_alerta: 85, disco_alerta: 85,
                tiempo_respuesta_max: 1000, transacciones_por_minuto: 120
            },
            bar: {
                cpu_alerta: 65, memoria_alerta: 70, disco_alerta: 80,
                tiempo_respuesta_max: 2500, horario_nocturno: true
            },
            cafeteria: {
                cpu_alerta: 60, memoria_alerta: 65, disco_alerta: 75,
                tiempo_respuesta_max: 3500, horarios_extendidos: true
            }
        };

        return parametros[tipo] || parametros.casual;
    }

    obtenerHardwareSugerido(tipo) {
        const hardware = {
            casual: {
                cpu: 'Intel i3 / AMD Ryzen 3', ram: '8 GB',
                almacenamiento: '250 GB SSD', impresoras: 2, terminales: '2-3 POS'
            },
            fino: {
                cpu: 'Intel i5 / AMD Ryzen 5', ram: '16 GB',
                almacenamiento: '500 GB SSD', impresoras: 3, terminales: '3-4 POS + tablets'
            },
            rapido: {
                cpu: 'Intel i5 / AMD Ryzen 5', ram: '16 GB',
                almacenamiento: '1 TB SSD', impresoras: '4+', terminales: '6+ POS'
            },
            bar: {
                cpu: 'Intel i3 / AMD Ryzen 3', ram: '8 GB',
                almacenamiento: '250 GB SSD', impresoras: 2, equipos_especiales: ['audio', 'luces']
            },
            cafeteria: {
                cpu: 'Intel i3 / AMD Ryzen 3', ram: '8 GB',
                almacenamiento: '250 GB SSD', impresoras: 2, wifi: 'Enterprise grade'
            }
        };

        return hardware[tipo] || hardware.casual;
    }

    obtenerOptimizaciones(tipo) {
        const optimizaciones = {
            casual: {
                cache: { productos: 300, mesas: 30, precios: 600 },
                rate_limiting: { ventas: 100, consultas: 200 }
            },
            fino: {
                cache: { productos: 60, personalizacion: 300, reportes: 1800 },
                rate_limiting: { ventas: 50, consultas: 100, reportes: 50 }
            },
            rapido: {
                cache: { productos: 600, mesas: 10, promociones: 60 },
                rate_limiting: { ventas: 300, consultas: 500 }
            },
            bar: {
                cache: { bebidas: 600, eventos: 300, promociones: 120 },
                rate_limiting: { ventas: 80, consultas: 150 }
            },
            cafeteria: {
                cache: { productos: 180, especialidades: 300, wifi: 60 },
                rate_limiting: { ventas: 60, consultas: 120 }
            }
        };

        return optimizaciones[tipo] || optimizaciones.casual;
    }

    getDescripcionTipoRestaurante(tipo) {
        const descripciones = {
            casual: 'Restaurante familiar con servicio rápido y menú variado',
            fino: 'Restaurante gourmet con servicio premium y experiencia gastronómica',
            rapido: 'Establecimiento de comida rápida con alto volumen de transacciones',
            bar: 'Bar/pub con enfoque en bebidas y entretenimiento nocturno',
            cafeteria: 'Cafetería con ambiente relajado y productos de panadería'
        };

        return descripciones[tipo] || descripciones.casual;
    }

    getRouter() {
        return this.router;
    }
}

module.exports = DocumentacionTecnicaRoutes;