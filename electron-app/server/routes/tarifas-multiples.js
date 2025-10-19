/**
 * Rutas API para Sistema de Tarifas Múltiples
 * Endpoints RESTful para gestión de precios diferenciados empresariales
 *
 * Funcionalidad Crítica #4 del Sistema Anterior
 * DYSA Point POS v2.0.14 - Nivel Empresarial
 * Autor: Claude Code
 * Fecha: 2025-10-13
 */

const express = require('express');
const rateLimit = require('express-rate-limit');

class TarifasMultiplesRoutes {
    constructor(tarifasManager, database) {
        this.tarifasManager = tarifasManager;
        this.database = database;
        this.router = express.Router();
        this.setupMiddleware();
        this.setupRoutes();
    }

    setupMiddleware() {
        // Rate limiting para protección empresarial
        this.aplicacionLimit = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minuto
            max: 50, // máximo 50 aplicaciones por minuto
            message: {
                success: false,
                error: 'Demasiadas solicitudes de aplicación de tarifas. Intente más tarde.'
            }
        });

        this.consultaLimit = rateLimit({
            windowMs: 1 * 60 * 1000, // 1 minuto
            max: 200, // máximo 200 consultas por minuto
            message: {
                success: false,
                error: 'Demasiadas consultas. Intente más tarde.'
            }
        });
    }

    setupRoutes() {
        // Aplicar tarifas automáticamente a una venta
        this.router.post('/:venta_id/aplicar-automaticas', this.aplicacionLimit, async (req, res) => {
            try {
                const { venta_id } = req.params;
                const { mesa, usuario_id, productos } = req.body;

                if (!usuario_id || !productos || !Array.isArray(productos)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario ID y productos son requeridos'
                    });
                }

                const resultado = await this.tarifasManager.aplicarTarifasAutomaticas(
                    parseInt(venta_id),
                    mesa,
                    parseInt(usuario_id),
                    productos
                );

                res.json({
                    success: true,
                    message: 'Tarifas automáticas procesadas',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error aplicando tarifas automáticas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al aplicar tarifas automáticas'
                });
            }
        });

        // Aplicar tarifa específica manualmente
        this.router.post('/:venta_id/aplicar-manual/:tarifa_id', this.aplicacionLimit, async (req, res) => {
            try {
                const { venta_id, tarifa_id } = req.params;
                const { usuario_id, productos, codigo_cliente } = req.body;

                if (!usuario_id || !productos || !Array.isArray(productos)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario ID y productos son requeridos'
                    });
                }

                const resultado = await this.tarifasManager.aplicarTarifaManual(
                    parseInt(venta_id),
                    parseInt(tarifa_id),
                    parseInt(usuario_id),
                    productos,
                    codigo_cliente
                );

                res.json({
                    success: true,
                    message: 'Tarifa manual aplicada exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error aplicando tarifa manual:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al aplicar tarifa manual'
                });
            }
        });

        // Aplicar código de promoción
        this.router.post('/:venta_id/aplicar-codigo', this.aplicacionLimit, async (req, res) => {
            try {
                const { venta_id } = req.params;
                const { codigo, usuario_id, productos } = req.body;

                if (!codigo || !usuario_id || !productos || !Array.isArray(productos)) {
                    return res.status(400).json({
                        success: false,
                        error: 'Código, usuario ID y productos son requeridos'
                    });
                }

                const resultado = await this.tarifasManager.aplicarCodigoPromocion(
                    parseInt(venta_id),
                    codigo,
                    parseInt(usuario_id),
                    productos
                );

                res.json({
                    success: true,
                    message: 'Código de promoción aplicado exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error aplicando código promoción:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al aplicar código de promoción'
                });
            }
        });

        // Anular tarifa aplicada
        this.router.post('/historial/:historial_id/anular', async (req, res) => {
            try {
                const { historial_id } = req.params;
                const { usuario_id, motivo } = req.body;

                if (!usuario_id || !motivo) {
                    return res.status(400).json({
                        success: false,
                        error: 'Usuario ID y motivo son requeridos'
                    });
                }

                const resultado = await this.tarifasManager.anularTarifaAplicada(
                    parseInt(historial_id),
                    parseInt(usuario_id),
                    motivo
                );

                res.json({
                    success: true,
                    message: 'Tarifa anulada exitosamente',
                    data: resultado,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error anulando tarifa:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al anular tarifa'
                });
            }
        });

        // Obtener tarifas aplicables
        this.router.get('/aplicables', this.consultaLimit, async (req, res) => {
            try {
                const { mesa, productos } = req.query;

                let productosArray = [];
                if (productos) {
                    try {
                        productosArray = JSON.parse(productos);
                    } catch (e) {
                        return res.status(400).json({
                            success: false,
                            error: 'Formato de productos inválido'
                        });
                    }
                }

                const tarifas = await this.tarifasManager.obtenerTarifasAplicables(
                    mesa ? parseInt(mesa) : null,
                    productosArray
                );

                res.json({
                    success: true,
                    data: tarifas,
                    total: tarifas.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo tarifas aplicables:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener tarifas aplicables'
                });
            }
        });

        // Obtener todas las tarifas activas
        this.router.get('/activas', this.consultaLimit, async (req, res) => {
            try {
                const { limit = 50, offset = 0, tipo_tarifa, buscar } = req.query;

                let whereClause = 'WHERE activa = TRUE';
                let params = [];

                if (tipo_tarifa) {
                    whereClause += ' AND tipo_tarifa = ?';
                    params.push(tipo_tarifa);
                }

                if (buscar) {
                    whereClause += ' AND (nombre LIKE ? OR codigo LIKE ? OR descripcion LIKE ?)';
                    const searchTerm = `%${buscar}%`;
                    params.push(searchTerm, searchTerm, searchTerm);
                }

                const [tarifas] = await this.database.connection.execute(`
                    SELECT * FROM tarifas_multiples
                    ${whereClause}
                    ORDER BY prioridad DESC, nombre
                    LIMIT ? OFFSET ?
                `, [...params, parseInt(limit), parseInt(offset)]);

                const [total] = await this.database.connection.execute(`
                    SELECT COUNT(*) as total FROM tarifas_multiples ${whereClause}
                `, params);

                res.json({
                    success: true,
                    data: tarifas,
                    total: total[0].total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo tarifas activas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener tarifas activas'
                });
            }
        });

        // Obtener detalle de tarifa específica
        this.router.get('/:tarifa_id/detalle', this.consultaLimit, async (req, res) => {
            try {
                const { tarifa_id } = req.params;

                const [tarifa] = await this.database.connection.execute(
                    'SELECT * FROM tarifas_multiples WHERE id = ?',
                    [tarifa_id]
                );

                if (!tarifa || tarifa.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Tarifa no encontrada'
                    });
                }

                // Obtener estadísticas de uso
                const [estadisticas] = await this.database.connection.execute(`
                    SELECT
                        COUNT(*) as total_aplicaciones,
                        SUM(descuento_aplicado) as total_descuentos,
                        AVG(descuento_aplicado) as promedio_descuento,
                        COUNT(CASE WHEN estado = 'anulada' THEN 1 END) as anulaciones
                    FROM historial_tarifas_aplicadas
                    WHERE tarifa_id = ?
                `, [tarifa_id]);

                res.json({
                    success: true,
                    data: {
                        tarifa: tarifa[0],
                        estadisticas: estadisticas[0]
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo detalle de tarifa:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener detalle de tarifa'
                });
            }
        });

        // Crear nueva tarifa
        this.router.post('/crear', async (req, res) => {
            try {
                const {
                    nombre, codigo, tipo_tarifa, valor_tarifa, es_porcentaje = false,
                    descripcion, prioridad = 0, activa = true,
                    // Condiciones de aplicación
                    aplica_por_horario = false, horario_inicio, horario_fin,
                    aplica_por_dia_semana = false, dias_semana,
                    aplica_por_fecha = false, fecha_inicio, fecha_fin,
                    aplica_por_tipo_cliente = false, tipo_cliente_id,
                    aplica_por_producto = false, productos_incluidos, productos_excluidos,
                    aplica_por_categoria = false, categorias_incluidas, categorias_excluidas,
                    aplica_por_mesa = false, mesas_incluidas, mesas_excluidas,
                    aplica_por_zona = false, zonas_incluidas, zonas_excluidas,
                    // Límites
                    monto_minimo_compra, monto_maximo_descuento,
                    cantidad_maxima_aplicaciones, aplicaciones_por_cliente,
                    // Configuración
                    es_combinable = true, tarifas_incompatibles,
                    requiere_autorizacion = false, nivel_autorizacion = 'camarero',
                    usuario_creacion
                } = req.body;

                if (!nombre || !codigo || !tipo_tarifa || valor_tarifa === undefined) {
                    return res.status(400).json({
                        success: false,
                        error: 'Nombre, código, tipo de tarifa y valor son requeridos'
                    });
                }

                const [result] = await this.database.connection.execute(`
                    INSERT INTO tarifas_multiples (
                        nombre, codigo, tipo_tarifa, valor_tarifa, es_porcentaje,
                        aplica_por_horario, horario_inicio, horario_fin,
                        aplica_por_dia_semana, dias_semana,
                        aplica_por_fecha, fecha_inicio, fecha_fin,
                        aplica_por_tipo_cliente, tipo_cliente_id,
                        aplica_por_producto, productos_incluidos, productos_excluidos,
                        aplica_por_categoria, categorias_incluidas, categorias_excluidas,
                        aplica_por_mesa, mesas_incluidas, mesas_excluidas,
                        aplica_por_zona, zonas_incluidas, zonas_excluidas,
                        monto_minimo_compra, monto_maximo_descuento,
                        cantidad_maxima_aplicaciones, aplicaciones_por_cliente,
                        prioridad, es_combinable, tarifas_incompatibles,
                        requiere_autorizacion, nivel_autorizacion,
                        descripcion, activa, created_by
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    nombre, codigo, tipo_tarifa, valor_tarifa, es_porcentaje,
                    aplica_por_horario, horario_inicio, horario_fin,
                    aplica_por_dia_semana, dias_semana,
                    aplica_por_fecha, fecha_inicio, fecha_fin,
                    aplica_por_tipo_cliente, tipo_cliente_id,
                    aplica_por_producto, productos_incluidos ? JSON.stringify(productos_incluidos) : null, productos_excluidos ? JSON.stringify(productos_excluidos) : null,
                    aplica_por_categoria, categorias_incluidas ? JSON.stringify(categorias_incluidas) : null, categorias_excluidas ? JSON.stringify(categorias_excluidas) : null,
                    aplica_por_mesa, mesas_incluidas ? JSON.stringify(mesas_incluidas) : null, mesas_excluidas ? JSON.stringify(mesas_excluidas) : null,
                    aplica_por_zona, zonas_incluidas ? JSON.stringify(zonas_incluidas) : null, zonas_excluidas ? JSON.stringify(zonas_excluidas) : null,
                    monto_minimo_compra, monto_maximo_descuento,
                    cantidad_maxima_aplicaciones, aplicaciones_por_cliente,
                    prioridad, es_combinable, tarifas_incompatibles ? JSON.stringify(tarifas_incompatibles) : null,
                    requiere_autorizacion, nivel_autorizacion,
                    descripcion, activa, usuario_creacion
                ]);

                res.json({
                    success: true,
                    message: 'Tarifa creada exitosamente',
                    data: { id: result.insertId },
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error creando tarifa:', error);
                if (error.code === 'ER_DUP_ENTRY') {
                    res.status(400).json({
                        success: false,
                        error: 'Ya existe una tarifa con ese código'
                    });
                } else {
                    res.status(500).json({
                        success: false,
                        error: error.message || 'Error interno al crear tarifa'
                    });
                }
            }
        });

        // Actualizar tarifa
        this.router.put('/:tarifa_id', async (req, res) => {
            try {
                const { tarifa_id } = req.params;
                const campos = req.body;

                // Construir query de actualización dinámicamente
                const camposPermitidos = [
                    'nombre', 'tipo_tarifa', 'valor_tarifa', 'es_porcentaje',
                    'aplica_por_horario', 'horario_inicio', 'horario_fin',
                    'aplica_por_dia_semana', 'dias_semana',
                    'aplica_por_fecha', 'fecha_inicio', 'fecha_fin',
                    'aplica_por_tipo_cliente', 'tipo_cliente_id',
                    'aplica_por_producto', 'productos_incluidos', 'productos_excluidos',
                    'aplica_por_categoria', 'categorias_incluidas', 'categorias_excluidas',
                    'aplica_por_mesa', 'mesas_incluidas', 'mesas_excluidas',
                    'aplica_por_zona', 'zonas_incluidas', 'zonas_excluidas',
                    'monto_minimo_compra', 'monto_maximo_descuento',
                    'cantidad_maxima_aplicaciones', 'aplicaciones_por_cliente',
                    'prioridad', 'es_combinable', 'tarifas_incompatibles',
                    'requiere_autorizacion', 'nivel_autorizacion',
                    'descripcion', 'activa', 'updated_by'
                ];

                const setClauses = [];
                const valores = [];

                for (const [campo, valor] of Object.entries(campos)) {
                    if (camposPermitidos.includes(campo)) {
                        setClauses.push(`${campo} = ?`);

                        // Convertir arrays a JSON si es necesario
                        if (['productos_incluidos', 'productos_excluidos', 'categorias_incluidas',
                             'categorias_excluidas', 'mesas_incluidas', 'mesas_excluidas',
                             'zonas_incluidas', 'zonas_excluidas', 'tarifas_incompatibles'].includes(campo) &&
                            Array.isArray(valor)) {
                            valores.push(JSON.stringify(valor));
                        } else {
                            valores.push(valor);
                        }
                    }
                }

                if (setClauses.length === 0) {
                    return res.status(400).json({
                        success: false,
                        error: 'No hay campos válidos para actualizar'
                    });
                }

                valores.push(tarifa_id);

                await this.database.connection.execute(`
                    UPDATE tarifas_multiples
                    SET ${setClauses.join(', ')}, updated_at = NOW()
                    WHERE id = ?
                `, valores);

                res.json({
                    success: true,
                    message: 'Tarifa actualizada exitosamente',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error actualizando tarifa:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al actualizar tarifa'
                });
            }
        });

        // Obtener historial de aplicaciones
        this.router.get('/historial', this.consultaLimit, async (req, res) => {
            try {
                const {
                    fecha_desde, fecha_hasta, tarifa_id, usuario_id, venta_id,
                    estado = 'aplicada', limit = 50, offset = 0
                } = req.query;

                let whereClause = 'WHERE 1=1';
                let params = [];

                if (fecha_desde && fecha_hasta) {
                    whereClause += ' AND DATE(hta.fecha_aplicacion) BETWEEN ? AND ?';
                    params.push(fecha_desde, fecha_hasta);
                }

                if (tarifa_id) {
                    whereClause += ' AND hta.tarifa_id = ?';
                    params.push(tarifa_id);
                }

                if (usuario_id) {
                    whereClause += ' AND hta.usuario_aplicacion = ?';
                    params.push(usuario_id);
                }

                if (venta_id) {
                    whereClause += ' AND hta.id_venta = ?';
                    params.push(venta_id);
                }

                if (estado) {
                    whereClause += ' AND hta.estado = ?';
                    params.push(estado);
                }

                const [historial] = await this.database.connection.execute(`
                    SELECT
                        hta.*,
                        tm.nombre as tarifa_nombre,
                        tm.codigo as tarifa_codigo,
                        c.nombre as usuario_nombre
                    FROM historial_tarifas_aplicadas hta
                    INNER JOIN tarifas_multiples tm ON hta.tarifa_id = tm.id
                    INNER JOIN camareros c ON hta.usuario_aplicacion = c.id_camarero
                    ${whereClause}
                    ORDER BY hta.fecha_aplicacion DESC
                    LIMIT ? OFFSET ?
                `, [...params, parseInt(limit), parseInt(offset)]);

                const [total] = await this.database.connection.execute(`
                    SELECT COUNT(*) as total
                    FROM historial_tarifas_aplicadas hta
                    ${whereClause}
                `, params);

                res.json({
                    success: true,
                    data: historial,
                    total: total[0].total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo historial:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener historial'
                });
            }
        });

        // Obtener estadísticas
        this.router.get('/estadisticas', this.consultaLimit, async (req, res) => {
            try {
                const {
                    fecha_desde = new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
                    fecha_hasta = new Date().toISOString().split('T')[0],
                    usuario_id
                } = req.query;

                const estadisticas = await this.tarifasManager.obtenerEstadisticas(
                    fecha_desde,
                    fecha_hasta,
                    usuario_id ? parseInt(usuario_id) : null
                );

                res.json({
                    success: true,
                    data: estadisticas,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo estadísticas:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener estadísticas'
                });
            }
        });

        // Dashboard de tarifas
        this.router.get('/dashboard', this.consultaLimit, async (req, res) => {
            try {
                const dashboard = await this.tarifasManager.obtenerDashboard();

                res.json({
                    success: true,
                    data: dashboard,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo dashboard:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener dashboard'
                });
            }
        });

        // Obtener configuración
        this.router.get('/configuracion', this.consultaLimit, async (req, res) => {
            try {
                const { tipo_config = 'global', id_referencia } = req.query;

                const configuracion = await this.tarifasManager.obtenerConfiguracion(
                    tipo_config,
                    id_referencia ? parseInt(id_referencia) : null
                );

                res.json({
                    success: true,
                    data: configuracion,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo configuración:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener configuración'
                });
            }
        });

        // Obtener tipos de cliente
        this.router.get('/tipos-cliente', this.consultaLimit, async (req, res) => {
            try {
                const [tipos] = await this.database.connection.execute(
                    'SELECT * FROM tipos_cliente_tarifas WHERE activo = TRUE ORDER BY nombre'
                );

                res.json({
                    success: true,
                    data: tipos,
                    total: tipos.length,
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error obteniendo tipos de cliente:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al obtener tipos de cliente'
                });
            }
        });

        // Validar código de promoción
        this.router.get('/validar-codigo/:codigo', this.consultaLimit, async (req, res) => {
            try {
                const { codigo } = req.params;

                const [codigoResult] = await this.database.connection.execute(`
                    SELECT cp.*, tm.nombre as tarifa_nombre, tm.tipo_tarifa, tm.valor_tarifa, tm.es_porcentaje
                    FROM codigos_promocion cp
                    INNER JOIN tarifas_multiples tm ON cp.tarifa_id = tm.id
                    WHERE cp.codigo = ? AND cp.activo = TRUE AND tm.activa = TRUE
                    AND (cp.fecha_inicio IS NULL OR cp.fecha_inicio <= CURDATE())
                    AND (cp.fecha_fin IS NULL OR cp.fecha_fin >= CURDATE())
                    AND (cp.usos_maximos IS NULL OR cp.usos_actuales < cp.usos_maximos)
                `, [codigo]);

                if (!codigoResult || codigoResult.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Código de promoción inválido o expirado'
                    });
                }

                res.json({
                    success: true,
                    data: codigoResult[0],
                    message: 'Código de promoción válido',
                    timestamp: new Date().toISOString()
                });

            } catch (error) {
                console.error('Error validando código:', error);
                res.status(500).json({
                    success: false,
                    error: error.message || 'Error interno al validar código'
                });
            }
        });

        // Endpoint de salud del sistema
        this.router.get('/health', async (req, res) => {
            try {
                const health = {
                    sistema: 'Tarifas Múltiples',
                    estado: 'funcionando',
                    version: '1.0.0',
                    inicializado: this.tarifasManager ? true : false,
                    base_datos_conectada: this.database ? true : false,
                    timestamp: new Date().toISOString()
                };

                // Verificar conectividad a base de datos
                if (this.database) {
                    try {
                        await this.database.connection.execute('SELECT 1');
                        health.conexion_bd = 'OK';
                    } catch (error) {
                        health.conexion_bd = 'ERROR';
                        health.error_bd = error.message;
                    }
                }

                res.json({
                    success: true,
                    data: health
                });

            } catch (error) {
                res.status(500).json({
                    success: false,
                    error: 'Error verificando salud del sistema'
                });
            }
        });
    }

    getRouter() {
        return this.router;
    }
}

module.exports = TarifasMultiplesRoutes;