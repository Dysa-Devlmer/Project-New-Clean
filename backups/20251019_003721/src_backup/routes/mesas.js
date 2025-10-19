/**
 * SYSME Backend - Rutas de Mesas
 * Gestión de mesas del restaurante
 * Compatible con sistema antiguo de SYSME
 * Fecha: 18 de Octubre 2025
 */

const express = require('express');
const { executeQuery, queries } = require('../config/database');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/mesas/zonas
 * Obtener todas las zonas del restaurante
 */
router.get('/zonas', optionalAuth, async (req, res) => {
    try {
        console.log('🏪 Obteniendo zonas del restaurante');

        const result = await executeQuery(`
            SELECT * FROM zonas_restaurante
            WHERE activa = 1
            ORDER BY orden_visualizacion, nombre_zona
        `, []);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener zonas'
            });
        }

        const zonas = result.data.map(zona => ({
            id: zona.id,
            codigo_zona: zona.codigo_zona,
            nombre_zona: zona.nombre_zona,
            descripcion_zona: zona.descripcion_zona,
            color_identificacion: zona.color_identificacion,
            capacidad_maxima_personas: zona.capacidad_maxima_personas,
            tipo_zona: zona.tipo_zona,
            orden_visualizacion: zona.orden_visualizacion
        }));

        console.log(`✅ ${zonas.length} zonas obtenidas`);

        res.json({
            success: true,
            data: zonas
        });

    } catch (error) {
        console.error('❌ Error obteniendo zonas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/mesas
 * Obtener todas las mesas activas del restaurante
 */
router.get('/', optionalAuth, async (req, res) => {
    try {
        console.log('🏪 Obteniendo mesas del restaurante');

        const result = await executeQuery(queries.getAllMesas, []);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener mesas'
            });
        }

        const mesas = result.data.map(mesa => ({
            id: mesa.id,
            numero_mesa: mesa.numero_mesa,
            zona_id: mesa.zona_id,
            capacidad_personas: mesa.capacidad_personas,
            capacidad_maxima: mesa.capacidad_maxima,
            forma_mesa: mesa.forma_mesa,
            coordenada_x: mesa.coordenada_x,
            coordenada_y: mesa.coordenada_y,
            ancho_mesa: mesa.ancho_mesa,
            alto_mesa: mesa.alto_mesa,
            estado_mesa: mesa.estado_mesa,
            mesa_vip: mesa.mesa_vip,
            acceso_discapacitados: mesa.acceso_discapacitados,
            cerca_ventana: mesa.cerca_ventana,
            aire_libre: mesa.aire_libre,
            ocupada_desde: mesa.ocupada_desde,
            numero_comensales_actuales: mesa.numero_comensales_actuales
        }));

        console.log(`✅ ${mesas.length} mesas obtenidas`);

        res.json({
            success: true,
            data: mesas
        });

    } catch (error) {
        console.error('❌ Error obteniendo mesas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/mesas/estado
 * Obtener estado actual de todas las mesas con información de ventas
 */
router.get('/estado', optionalAuth, async (req, res) => {
    try {
        console.log('📊 Obteniendo estado completo de mesas');

        const result = await executeQuery(`
            SELECT
                m.*,
                v.id as venta_id,
                v.numero_venta,
                v.total_final,
                v.timestamp_inicio,
                v.estado_venta,
                e.nombre as empleado_nombre
            FROM mesas_restaurante m
            LEFT JOIN ventas_principales v ON m.id = v.mesa_id AND v.estado_venta = 'ABIERTA'
            LEFT JOIN empleados e ON v.empleado_vendedor_id = e.id
            WHERE m.mesa_activa = 1
            ORDER BY m.numero_mesa
        `, []);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener estado de mesas'
            });
        }

        const mesasConEstado = result.data.map(mesa => ({
            id: mesa.id,
            numero_mesa: mesa.numero_mesa,
            zona_id: mesa.zona_id,
            capacidad_personas: mesa.capacidad_personas,
            forma_mesa: mesa.forma_mesa,
            coordenada_x: mesa.coordenada_x,
            coordenada_y: mesa.coordenada_y,
            ancho_mesa: mesa.ancho_mesa,
            alto_mesa: mesa.alto_mesa,
            estado_mesa: mesa.estado_mesa,
            mesa_vip: mesa.mesa_vip,
            acceso_discapacitados: mesa.acceso_discapacitados,
            cerca_ventana: mesa.cerca_ventana,
            aire_libre: mesa.aire_libre,
            numero_comensales_actuales: mesa.numero_comensales_actuales,

            // Información de venta activa (si existe)
            venta_activa: mesa.venta_id ? {
                id: mesa.venta_id,
                numero_venta: mesa.numero_venta,
                total_final: parseFloat(mesa.total_final) || 0,
                timestamp_inicio: mesa.timestamp_inicio,
                empleado_nombre: mesa.empleado_nombre,
                duracion_minutos: mesa.timestamp_inicio ?
                    Math.floor((new Date() - new Date(mesa.timestamp_inicio)) / 60000) : 0
            } : null
        }));

        // Estadísticas
        const libres = mesasConEstado.filter(m => m.estado_mesa === 'LIBRE').length;
        const ocupadas = mesasConEstado.filter(m => m.estado_mesa === 'OCUPADA').length;
        const reservadas = mesasConEstado.filter(m => m.estado_mesa === 'RESERVADA').length;

        console.log(`✅ Estado mesas: ${libres} libres, ${ocupadas} ocupadas, ${reservadas} reservadas`);

        res.json({
            success: true,
            data: mesasConEstado,
            estadisticas: {
                total: mesasConEstado.length,
                libres,
                ocupadas,
                reservadas,
                fuera_servicio: mesasConEstado.filter(m => m.estado_mesa === 'FUERA_SERVICIO').length
            }
        });

    } catch (error) {
        console.error('❌ Error obteniendo estado de mesas:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/mesas/:id
 * Obtener información detallada de una mesa específica
 */
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const mesaId = req.params.id;
        console.log(`🏪 Obteniendo información de mesa ${mesaId}`);

        const result = await executeQuery(queries.getMesaById, [mesaId]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener mesa'
            });
        }

        if (result.data.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Mesa no encontrada'
            });
        }

        const mesa = result.data[0];

        // Obtener venta activa si existe
        const ventaResult = await executeQuery(`
            SELECT v.*, e.nombre as empleado_nombre
            FROM ventas_principales v
            LEFT JOIN empleados e ON v.empleado_vendedor_id = e.id
            WHERE v.mesa_id = ? AND v.estado_venta = 'ABIERTA'
        `, [mesaId]);

        const mesaCompleta = {
            id: mesa.id,
            numero_mesa: mesa.numero_mesa,
            zona_id: mesa.zona_id,
            capacidad_personas: mesa.capacidad_personas,
            capacidad_maxima: mesa.capacidad_maxima,
            forma_mesa: mesa.forma_mesa,
            coordenada_x: mesa.coordenada_x,
            coordenada_y: mesa.coordenada_y,
            ancho_mesa: mesa.ancho_mesa,
            alto_mesa: mesa.alto_mesa,
            estado_mesa: mesa.estado_mesa,
            mesa_vip: mesa.mesa_vip,
            acceso_discapacitados: mesa.acceso_discapacitados,
            cerca_ventana: mesa.cerca_ventana,
            aire_libre: mesa.aire_libre,
            ocupada_desde: mesa.ocupada_desde,
            numero_comensales_actuales: mesa.numero_comensales_actuales,

            venta_activa: ventaResult.success && ventaResult.data.length > 0 ? {
                id: ventaResult.data[0].id,
                numero_venta: ventaResult.data[0].numero_venta,
                total_final: parseFloat(ventaResult.data[0].total_final) || 0,
                timestamp_inicio: ventaResult.data[0].timestamp_inicio,
                empleado_nombre: ventaResult.data[0].empleado_nombre
            } : null
        };

        console.log(`✅ Mesa ${mesa.numero_mesa} obtenida`);

        res.json({
            success: true,
            data: mesaCompleta
        });

    } catch (error) {
        console.error('❌ Error obteniendo mesa:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * PUT /api/mesas/:id/estado
 * Actualizar estado de una mesa
 */
router.put('/:id/estado', authenticateToken, async (req, res) => {
    try {
        const mesaId = req.params.id;
        const { nuevo_estado, numero_comensales } = req.body;

        console.log(`🔄 Actualizando estado mesa ${mesaId} a ${nuevo_estado}`);

        if (!['LIBRE', 'OCUPADA', 'RESERVADA', 'LIMPIEZA', 'FUERA_SERVICIO'].includes(nuevo_estado)) {
            return res.status(400).json({
                success: false,
                error: 'Estado de mesa inválido'
            });
        }

        // Actualizar estado de mesa
        const result = await executeQuery(queries.updateEstadoMesa, [nuevo_estado, mesaId]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar estado de mesa'
            });
        }

        // Actualizar número de comensales si se proporciona
        if (numero_comensales !== undefined) {
            await executeQuery(
                'UPDATE mesas_restaurante SET numero_comensales_actuales = ?, ocupada_desde = ? WHERE id = ?',
                [numero_comensales, nuevo_estado === 'OCUPADA' ? new Date() : null, mesaId]
            );
        }

        console.log(`✅ Mesa ${mesaId} actualizada a estado ${nuevo_estado}`);

        res.json({
            success: true,
            message: 'Estado de mesa actualizado',
            data: {
                mesa_id: mesaId,
                nuevo_estado,
                numero_comensales,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error actualizando estado de mesa:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/mesas/zona/:zonaId
 * Obtener mesas de una zona específica
 */
router.get('/zona/:zonaId', optionalAuth, async (req, res) => {
    try {
        const zonaId = req.params.zonaId;
        console.log(`🏪 Obteniendo mesas de zona ${zonaId}`);

        const result = await executeQuery(`
            SELECT * FROM mesas_restaurante
            WHERE zona_id = ? AND mesa_activa = 1
            ORDER BY numero_mesa
        `, [zonaId]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener mesas de la zona'
            });
        }

        const mesas = result.data.map(mesa => ({
            id: mesa.id,
            numero_mesa: mesa.numero_mesa,
            capacidad_personas: mesa.capacidad_personas,
            forma_mesa: mesa.forma_mesa,
            coordenada_x: mesa.coordenada_x,
            coordenada_y: mesa.coordenada_y,
            estado_mesa: mesa.estado_mesa,
            mesa_vip: mesa.mesa_vip
        }));

        console.log(`✅ ${mesas.length} mesas obtenidas de zona ${zonaId}`);

        res.json({
            success: true,
            data: mesas
        });

    } catch (error) {
        console.error('❌ Error obteniendo mesas por zona:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

module.exports = router;