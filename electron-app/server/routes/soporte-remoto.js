#!/usr/bin/env node

/**
 * ⚡ DYSA Point - Rutas API Sistema de Soporte Remoto
 *
 * Endpoints completos para gestión de soporte técnico remoto
 * - Gestión de tickets de soporte
 * - Sesiones remotas seguras
 * - Chat en tiempo real
 * - Base de conocimientos
 * - Estadísticas y métricas
 * - Configuración del sistema
 *
 * Autor: DYSA Point Team
 * Fecha: 2025-01-13
 * Versión: 1.0.0 - Sistema Empresarial
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const path = require('path');
const moment = require('moment-timezone');

// Configurar multer para archivos adjuntos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '..', '..', 'temp', 'adjuntos'));
    },
    filename: (req, file, cb) => {
        const timestamp = moment().format('YYYYMMDD_HHmmss');
        cb(null, `${timestamp}_${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB máximo
    },
    fileFilter: (req, file, cb) => {
        // Tipos de archivo permitidos para soporte
        const tiposPermitidos = [
            'image/jpeg', 'image/png', 'image/gif',
            'application/pdf', 'text/plain',
            'application/zip', 'application/x-rar-compressed'
        ];

        if (tiposPermitidos.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipo de archivo no permitido'), false);
        }
    }
});

// Rate limiting especializado para soporte remoto
const limiteTickers = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo 10 tickets por 15 minutos por IP
    message: {
        error: 'Demasiados tickets creados. Intente más tarde.',
        retry_after: 15
    },
    standardHeaders: true,
    legacyHeaders: false
});

const limiteConsultas = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30, // 30 consultas por minuto
    message: {
        error: 'Demasiadas consultas. Intente más tarde.',
        retry_after: 1
    }
});

const limiteSesiones = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 5, // Máximo 5 sesiones remotas por 5 minutos
    message: {
        error: 'Demasiadas sesiones remotas iniciadas. Intente más tarde.',
        retry_after: 5
    }
});

function configurarRutasSoporteRemoto(app, soporteRemotoManager) {
    console.log('🛠️  Configurando rutas de Soporte Remoto...');

    // ============================================
    // GESTIÓN DE TICKETS
    // ============================================

    // Crear nuevo ticket de soporte
    app.post('/api/soporte/tickets', limiteTickers, upload.array('adjuntos', 5), async (req, res) => {
        try {
            const datosTicket = {
                titulo: req.body.titulo,
                descripcion: req.body.descripcion,
                prioridad: req.body.prioridad || 'media',
                categoria: req.body.categoria || 'general',
                cliente_id: req.body.cliente_id,
                restaurante: req.body.restaurante,
                ip_cliente: req.ip,
                version_sistema: req.body.version_sistema,
                navegador: req.get('User-Agent'),
                sistema_operativo: req.body.sistema_operativo
            };

            const ticket = await soporteRemotoManager.crearTicket(datosTicket);

            // Procesar archivos adjuntos si existen
            if (req.files && req.files.length > 0) {
                ticket.archivos_adjuntos = req.files.map(file => ({
                    nombre: file.originalname,
                    ruta: file.path,
                    tamaño: file.size,
                    tipo: file.mimetype,
                    fecha_subida: moment().tz('America/Santiago').format()
                }));

                await soporteRemotoManager.actualizarTicket(ticket.id, {
                    archivos_adjuntos: ticket.archivos_adjuntos
                });
            }

            res.status(201).json({
                success: true,
                message: 'Ticket creado exitosamente',
                data: {
                    ticket_id: ticket.id,
                    estado: ticket.estado,
                    prioridad: ticket.prioridad,
                    tiempo_respuesta_objetivo: ticket.tiempo_respuesta_objetivo,
                    agente_asignado: ticket.agente_asignado,
                    diagnostico_automatico: ticket.diagnostico_automatico
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error creando ticket:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno'
            });
        }
    });

    // Obtener tickets con filtros
    app.get('/api/soporte/tickets', limiteConsultas, async (req, res) => {
        try {
            const filtros = {
                estado: req.query.estado,
                prioridad: req.query.prioridad,
                agente_id: req.query.agente_id,
                categoria: req.query.categoria
            };

            const tickets = await soporteRemotoManager.obtenerTickets(filtros);

            res.json({
                success: true,
                data: {
                    tickets: tickets.map(ticket => ({
                        id: ticket.id,
                        titulo: ticket.titulo,
                        prioridad: ticket.prioridad,
                        estado: ticket.estado,
                        categoria: ticket.categoria,
                        fecha_creacion: ticket.fecha_creacion,
                        agente_asignado: ticket.agente_asignado,
                        tiempo_transcurrido: moment().diff(moment(ticket.fecha_creacion), 'minutes')
                    })),
                    total: tickets.length
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo tickets:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    });

    // Obtener ticket específico
    app.get('/api/soporte/tickets/:ticketId', limiteConsultas, async (req, res) => {
        try {
            const ticket = await soporteRemotoManager.obtenerTicketPorId(req.params.ticketId);

            if (!ticket) {
                return res.status(404).json({
                    success: false,
                    message: 'Ticket no encontrado'
                });
            }

            res.json({
                success: true,
                data: ticket,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo ticket:', error.message);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor'
            });
        }
    });

    // Actualizar ticket
    app.put('/api/soporte/tickets/:ticketId', limiteConsultas, async (req, res) => {
        try {
            const actualizacion = {
                estado: req.body.estado,
                prioridad: req.body.prioridad,
                agente_id: req.body.agente_id,
                comentario: req.body.comentario
            };

            // Filtrar campos undefined
            Object.keys(actualizacion).forEach(key => {
                if (actualizacion[key] === undefined) {
                    delete actualizacion[key];
                }
            });

            const ticket = await soporteRemotoManager.actualizarTicket(req.params.ticketId, actualizacion);

            res.json({
                success: true,
                message: 'Ticket actualizado exitosamente',
                data: ticket,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error actualizando ticket:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Resolver ticket
    app.post('/api/soporte/tickets/:ticketId/resolver', limiteConsultas, async (req, res) => {
        try {
            const solucion = {
                descripcion: req.body.descripcion,
                pasos_realizados: req.body.pasos_realizados,
                tiempo_empleado: req.body.tiempo_empleado,
                agente_id: req.body.agente_id,
                requiere_seguimiento: req.body.requiere_seguimiento || false
            };

            const ticket = await soporteRemotoManager.resolverTicket(req.params.ticketId, solucion);

            res.json({
                success: true,
                message: 'Ticket resuelto exitosamente',
                data: {
                    ticket_id: ticket.id,
                    estado: ticket.estado,
                    tiempo_resolucion: ticket.tiempo_resolucion,
                    solucion: ticket.solucion_propuesta
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error resolviendo ticket:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // ============================================
    // SESIONES REMOTAS
    // ============================================

    // Iniciar sesión remota
    app.post('/api/soporte/sesiones', limiteSesiones, async (req, res) => {
        try {
            const { ticket_id, tipo_sesion } = req.body;

            const sesion = await soporteRemotoManager.iniciarSesionRemota(ticket_id, tipo_sesion);

            res.status(201).json({
                success: true,
                message: 'Sesión remota iniciada exitosamente',
                data: {
                    sesion_id: sesion.id,
                    ticket_id: sesion.ticket_id,
                    tipo: sesion.tipo,
                    token_acceso: sesion.token_acceso,
                    configuracion: sesion.configuracion,
                    url_conexion: `/soporte/sesion/${sesion.id}?token=${sesion.token_acceso}`
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error iniciando sesión remota:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Obtener estado de sesión
    app.get('/api/soporte/sesiones/:sesionId', limiteConsultas, async (req, res) => {
        try {
            const sesion = await soporteRemotoManager.obtenerSesionPorId(req.params.sesionId);

            if (!sesion) {
                return res.status(404).json({
                    success: false,
                    message: 'Sesión no encontrada'
                });
            }

            res.json({
                success: true,
                data: {
                    id: sesion.id,
                    estado: sesion.estado,
                    tipo: sesion.tipo,
                    duracion_actual: sesion.estado === 'activa' ?
                        moment().diff(moment(sesion.fecha_inicio), 'minutes') :
                        sesion.duracion_minutos,
                    configuracion: sesion.configuracion,
                    participantes: {
                        agente: sesion.agente_id,
                        cliente: sesion.cliente_id
                    }
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo sesión:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Finalizar sesión remota
    app.post('/api/soporte/sesiones/:sesionId/finalizar', limiteConsultas, async (req, res) => {
        try {
            const sesion = await soporteRemotoManager.finalizarSesionRemota(req.params.sesionId);

            res.json({
                success: true,
                message: 'Sesión remota finalizada exitosamente',
                data: {
                    sesion_id: sesion.id,
                    duracion_total: sesion.duracion_minutos,
                    fecha_inicio: sesion.fecha_inicio,
                    fecha_fin: sesion.fecha_fin
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error finalizando sesión:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // ============================================
    // BASE DE CONOCIMIENTOS
    // ============================================

    // Buscar en base de conocimientos
    app.get('/api/soporte/conocimientos/buscar', limiteConsultas, async (req, res) => {
        try {
            const consulta = req.query.q;

            if (!consulta || consulta.trim().length < 3) {
                return res.status(400).json({
                    success: false,
                    message: 'La consulta debe tener al menos 3 caracteres'
                });
            }

            const resultados = await soporteRemotoManager.buscarEnBaseConocimientos(consulta);

            res.json({
                success: true,
                data: {
                    consulta: consulta,
                    resultados: resultados,
                    total_resultados: resultados.length
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error en búsqueda:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Obtener base de conocimientos completa
    app.get('/api/soporte/conocimientos', limiteConsultas, async (req, res) => {
        try {
            const baseConocimientos = await soporteRemotoManager.obtenerBaseConocimientos();

            res.json({
                success: true,
                data: baseConocimientos,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo base de conocimientos:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Obtener problema frecuente específico
    app.get('/api/soporte/conocimientos/problema/:problemaId', limiteConsultas, async (req, res) => {
        try {
            const baseConocimientos = await soporteRemotoManager.obtenerBaseConocimientos();
            const problema = baseConocimientos.problemas_frecuentes.find(
                p => p.id === req.params.problemaId
            );

            if (!problema) {
                return res.status(404).json({
                    success: false,
                    message: 'Problema no encontrado'
                });
            }

            res.json({
                success: true,
                data: problema,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo problema:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // ============================================
    // AGENTES Y ASIGNACIÓN
    // ============================================

    // Obtener agentes disponibles
    app.get('/api/soporte/agentes', limiteConsultas, async (req, res) => {
        try {
            const agentes = await soporteRemotoManager.obtenerAgentesDisponibles();

            res.json({
                success: true,
                data: {
                    agentes: agentes,
                    total_disponibles: agentes.length
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo agentes:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Asignar agente a ticket
    app.post('/api/soporte/tickets/:ticketId/asignar', limiteConsultas, async (req, res) => {
        try {
            const { agente_id } = req.body;

            const ticket = await soporteRemotoManager.actualizarTicket(req.params.ticketId, {
                agente_asignado: { id: agente_id },
                agente_id: agente_id
            });

            res.json({
                success: true,
                message: 'Agente asignado exitosamente',
                data: {
                    ticket_id: ticket.id,
                    agente_asignado: ticket.agente_asignado
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error asignando agente:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // ============================================
    // ESTADÍSTICAS Y MÉTRICAS
    // ============================================

    // Obtener estadísticas generales
    app.get('/api/soporte/estadisticas', limiteConsultas, async (req, res) => {
        try {
            const estadisticas = await soporteRemotoManager.obtenerEstadisticas();

            res.json({
                success: true,
                data: estadisticas,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Métricas de rendimiento del soporte
    app.get('/api/soporte/metricas/rendimiento', limiteConsultas, async (req, res) => {
        try {
            const tickets = await soporteRemotoManager.obtenerTickets();
            const estadisticas = await soporteRemotoManager.obtenerEstadisticas();

            const metricas = {
                tickets_por_estado: {
                    abiertos: tickets.filter(t => t.estado === 'abierto').length,
                    en_progreso: tickets.filter(t => t.estado === 'en_progreso').length,
                    resueltos: tickets.filter(t => t.estado === 'resuelto').length,
                    cerrados: tickets.filter(t => t.estado === 'cerrado').length
                },
                tickets_por_prioridad: {
                    baja: tickets.filter(t => t.prioridad === 'baja').length,
                    media: tickets.filter(t => t.prioridad === 'media').length,
                    alta: tickets.filter(t => t.prioridad === 'alta').length,
                    critica: tickets.filter(t => t.prioridad === 'critica').length
                },
                tiempo_promedio_resolucion: estadisticas.tickets.tiempo_promedio_resolucion,
                tasa_resolucion: tickets.length > 0 ?
                    Math.round((estadisticas.tickets.resueltos / tickets.length) * 100) : 0,
                sesiones_activas: estadisticas.sesiones.activas,
                uptime_sistema: estadisticas.sistema.uptime_horas
            };

            res.json({
                success: true,
                data: metricas,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo métricas:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // ============================================
    // DIAGNÓSTICO Y HERRAMIENTAS
    // ============================================

    // Ejecutar diagnóstico manual
    app.post('/api/soporte/diagnostico', limiteConsultas, async (req, res) => {
        try {
            const ticketSimulado = {
                id: 'DIAGNOSTICO_' + Date.now(),
                categoria: req.body.categoria || 'general',
                prioridad: 'media'
            };

            const diagnostico = await soporteRemotoManager.ejecutarDiagnosticoAutomatico(ticketSimulado);

            res.json({
                success: true,
                message: 'Diagnóstico ejecutado exitosamente',
                data: diagnostico,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error ejecutando diagnóstico:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Verificar estado del sistema
    app.get('/api/soporte/sistema/estado', limiteConsultas, async (req, res) => {
        try {
            const estado = {
                servicios: await soporteRemotoManager.verificarEstadoServicios(),
                recursos: await soporteRemotoManager.verificarRecursos(),
                conectividad: await soporteRemotoManager.verificarConectividad(),
                base_datos: await soporteRemotoManager.verificarBaseDatos(),
                timestamp: moment().tz('America/Santiago').format()
            };

            res.json({
                success: true,
                data: estado,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error verificando estado:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // ============================================
    // CONFIGURACIÓN
    // ============================================

    // Obtener configuración actual
    app.get('/api/soporte/configuracion', limiteConsultas, async (req, res) => {
        try {
            const configuracion = await soporteRemotoManager.obtenerConfiguracion();

            res.json({
                success: true,
                data: {
                    configuracion_actual: configuracion,
                    opciones_disponibles: {
                        soporte_24_7: 'Soporte disponible 24/7',
                        max_sesiones_simultaneas: 'Máximo de sesiones simultaneas',
                        tiempo_sesion_max: 'Tiempo máximo por sesión (segundos)',
                        escalacion_automatica: 'Escalación automática de tickets',
                        chat_tiempo_real: 'Chat en tiempo real habilitado',
                        screen_sharing_enabled: 'Compartir pantalla habilitado',
                        diagnostico_automatico: 'Diagnóstico automático habilitado'
                    }
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // Actualizar configuración
    app.put('/api/soporte/configuracion', limiteConsultas, async (req, res) => {
        try {
            const nuevaConfig = await soporteRemotoManager.actualizarConfiguracion(req.body);

            res.json({
                success: true,
                message: 'Configuración actualizada exitosamente',
                data: nuevaConfig,
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error actualizando configuración:', error.message);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    });

    // ============================================
    // ENDPOINTS DE SALUD Y ESTADO
    // ============================================

    // Health check del sistema de soporte
    app.get('/api/soporte/health', limiteConsultas, async (req, res) => {
        try {
            const estadisticas = await soporteRemotoManager.obtenerEstadisticas();

            res.json({
                success: true,
                status: 'healthy',
                version: '1.0.0',
                sistema: 'Soporte Remoto DYSA Point',
                estadisticas_resumen: {
                    tickets_activos: estadisticas.tickets.pendientes,
                    sesiones_activas: estadisticas.sesiones.activas,
                    agentes_disponibles: estadisticas.agentes.virtuales_disponibles,
                    uptime_horas: estadisticas.sistema.uptime_horas
                },
                timestamp: moment().tz('America/Santiago').format()
            });

        } catch (error) {
            console.error('❌ Error en health check:', error.message);
            res.status(503).json({
                success: false,
                status: 'unhealthy',
                error: error.message
            });
        }
    });

    console.log('✅ Rutas de Soporte Remoto configuradas correctamente');
    console.log('📊 Endpoints disponibles:');
    console.log('   • POST /api/soporte/tickets - Crear ticket');
    console.log('   • GET /api/soporte/tickets - Listar tickets');
    console.log('   • GET /api/soporte/tickets/:id - Obtener ticket');
    console.log('   • PUT /api/soporte/tickets/:id - Actualizar ticket');
    console.log('   • POST /api/soporte/tickets/:id/resolver - Resolver ticket');
    console.log('   • POST /api/soporte/sesiones - Iniciar sesión remota');
    console.log('   • GET /api/soporte/sesiones/:id - Estado sesión');
    console.log('   • POST /api/soporte/sesiones/:id/finalizar - Finalizar sesión');
    console.log('   • GET /api/soporte/conocimientos/buscar - Buscar conocimientos');
    console.log('   • GET /api/soporte/conocimientos - Base conocimientos');
    console.log('   • GET /api/soporte/agentes - Agentes disponibles');
    console.log('   • GET /api/soporte/estadisticas - Estadísticas generales');
    console.log('   • GET /api/soporte/metricas/rendimiento - Métricas rendimiento');
    console.log('   • POST /api/soporte/diagnostico - Ejecutar diagnóstico');
    console.log('   • GET /api/soporte/sistema/estado - Estado sistema');
    console.log('   • GET /api/soporte/configuracion - Configuración actual');
    console.log('   • PUT /api/soporte/configuracion - Actualizar configuración');
    console.log('   • GET /api/soporte/health - Health check');
}

module.exports = configurarRutasSoporteRemoto;