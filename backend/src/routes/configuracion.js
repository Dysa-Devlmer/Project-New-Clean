/**
 * SYSME Backend - Rutas de Configuración
 * Gestión de configuración del restaurante
 * Compatible con sistema antiguo de SYSME
 * Fecha: 18 de Octubre 2025
 */

const express = require('express');
const { executeQuery, executeMultipleQueries } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

const router = express.Router();

/**
 * GET /api/configuracion
 * Obtener toda la configuración del sistema
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('⚙️ Obteniendo configuración del sistema');

        const result = await executeQuery(`
            SELECT
                clave_configuracion,
                valor_configuracion,
                descripcion_configuracion,
                tipo_valor,
                categoria_configuracion
            FROM configuracion_sistema
            WHERE activa = 1
            ORDER BY categoria_configuracion, clave_configuracion
        `, []);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener configuración'
            });
        }

        // Agrupar configuración por categorías
        const configuracionPorCategoria = {};

        result.data.forEach(config => {
            const categoria = config.categoria_configuracion || 'general';

            if (!configuracionPorCategoria[categoria]) {
                configuracionPorCategoria[categoria] = {};
            }

            // Convertir valor según el tipo
            let valor = config.valor_configuracion;
            switch (config.tipo_valor) {
                case 'boolean':
                    valor = valor === 'true' || valor === '1';
                    break;
                case 'number':
                    valor = parseFloat(valor) || 0;
                    break;
                case 'json':
                    try {
                        valor = JSON.parse(valor);
                    } catch (e) {
                        valor = config.valor_configuracion;
                    }
                    break;
                default:
                    valor = config.valor_configuracion;
            }

            configuracionPorCategoria[categoria][config.clave_configuracion] = {
                valor: valor,
                descripcion: config.descripcion_configuracion,
                tipo: config.tipo_valor
            };
        });

        console.log(`✅ Configuración obtenida: ${Object.keys(configuracionPorCategoria).length} categorías`);

        res.json({
            success: true,
            data: configuracionPorCategoria
        });

    } catch (error) {
        console.error('❌ Error obteniendo configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/configuracion/:categoria
 * Obtener configuración de una categoría específica
 */
router.get('/:categoria', authenticateToken, async (req, res) => {
    try {
        const categoria = req.params.categoria;
        console.log(`⚙️ Obteniendo configuración de categoría: ${categoria}`);

        const result = await executeQuery(`
            SELECT
                clave_configuracion,
                valor_configuracion,
                descripcion_configuracion,
                tipo_valor
            FROM configuracion_sistema
            WHERE categoria_configuracion = ? AND activa = 1
            ORDER BY clave_configuracion
        `, [categoria]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al obtener configuración de categoría'
            });
        }

        const configuracion = {};

        result.data.forEach(config => {
            let valor = config.valor_configuracion;
            switch (config.tipo_valor) {
                case 'boolean':
                    valor = valor === 'true' || valor === '1';
                    break;
                case 'number':
                    valor = parseFloat(valor) || 0;
                    break;
                case 'json':
                    try {
                        valor = JSON.parse(valor);
                    } catch (e) {
                        valor = config.valor_configuracion;
                    }
                    break;
            }

            configuracion[config.clave_configuracion] = {
                valor: valor,
                descripcion: config.descripcion_configuracion,
                tipo: config.tipo_valor
            };
        });

        console.log(`✅ Configuración de ${categoria} obtenida: ${Object.keys(configuracion).length} elementos`);

        res.json({
            success: true,
            data: configuracion,
            categoria: categoria
        });

    } catch (error) {
        console.error('❌ Error obteniendo configuración de categoría:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * PUT /api/configuracion/:clave
 * Actualizar una configuración específica
 */
router.put('/:clave', authenticateToken, async (req, res) => {
    try {
        const clave = req.params.clave;
        const { valor } = req.body;

        console.log(`⚙️ Actualizando configuración: ${clave}`);

        if (valor === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Valor es requerido'
            });
        }

        // Convertir valor a string para almacenamiento
        let valorString = valor;
        if (typeof valor === 'object') {
            valorString = JSON.stringify(valor);
        } else {
            valorString = String(valor);
        }

        const result = await executeQuery(`
            UPDATE configuracion_sistema
            SET valor_configuracion = ?, fecha_modificacion = NOW()
            WHERE clave_configuracion = ? AND activa = 1
        `, [valorString, clave]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al actualizar configuración'
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                error: 'Configuración no encontrada'
            });
        }

        console.log(`✅ Configuración ${clave} actualizada`);

        res.json({
            success: true,
            message: 'Configuración actualizada exitosamente',
            data: {
                clave: clave,
                nuevo_valor: valor
            }
        });

    } catch (error) {
        console.error('❌ Error actualizando configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /api/configuracion
 * Crear nueva configuración
 */
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            clave,
            valor,
            descripcion,
            tipo = 'string',
            categoria = 'general'
        } = req.body;

        console.log(`⚙️ Creando nueva configuración: ${clave}`);

        if (!clave || valor === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Clave y valor son requeridos'
            });
        }

        // Verificar si ya existe
        const existeResult = await executeQuery(`
            SELECT id FROM configuracion_sistema
            WHERE clave_configuracion = ?
        `, [clave]);

        if (existeResult.success && existeResult.data.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Ya existe una configuración con esta clave'
            });
        }

        // Convertir valor a string
        let valorString = valor;
        if (typeof valor === 'object') {
            valorString = JSON.stringify(valor);
        } else {
            valorString = String(valor);
        }

        const result = await executeQuery(`
            INSERT INTO configuracion_sistema (
                clave_configuracion,
                valor_configuracion,
                descripcion_configuracion,
                tipo_valor,
                categoria_configuracion,
                fecha_creacion,
                activa
            ) VALUES (?, ?, ?, ?, ?, NOW(), 1)
        `, [clave, valorString, descripcion, tipo, categoria]);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error al crear configuración'
            });
        }

        console.log(`✅ Configuración ${clave} creada con ID: ${result.insertId}`);

        res.status(201).json({
            success: true,
            message: 'Configuración creada exitosamente',
            data: {
                id: result.insertId,
                clave: clave,
                valor: valor,
                categoria: categoria
            }
        });

    } catch (error) {
        console.error('❌ Error creando configuración:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// Importar el nuevo controlador con persistencia real
const ConfiguracionController = require('../controllers/configuracion.controller');
const configController = new ConfiguracionController();

/**
 * GET /api/configuracion/sistema/configuracion
 * Configuración completa del sistema empresarial - CON PERSISTENCIA REAL
 */
router.get('/sistema/configuracion', async (req, res) => {
    return configController.getConfiguracionSistema(req, res);
});

/**
 * PUT /api/configuracion/sistema/configuracion
 * Actualizar configuración completa del sistema empresarial - CON PERSISTENCIA REAL
 */
router.put('/sistema/configuracion', async (req, res) => {
    return configController.putConfiguracionSistema(req, res);
});

/**
 * GET /api/configuracion/restaurante/general
 * Configuración general del restaurante (datos básicos)
 */
router.get('/restaurante/general', authenticateToken, async (req, res) => {
    try {
        console.log('🏪 Obteniendo configuración general del restaurante');

        // Configuración básica del restaurante
        const configuracionBasica = {
            nombre_restaurante: 'DYSA Point Restaurant',
            direccion: 'Dirección del Restaurante',
            telefono: '+56 9 1234 5678',
            email: 'contacto@dysapoint.com',
            moneda: 'CLP',
            moneda_simbolo: '$',
            zona_horaria: 'America/Santiago',
            idioma_predeterminado: 'es',

            // Configuración de impresión
            imprimir_logo: true,
            imprimir_direccion: true,
            imprimir_telefono: true,

            // Configuración de mesas
            total_mesas: 20,
            mesas_activas: 18,

            // Configuración de cocina
            bloques_cocina: 4,
            tiempo_preparacion_promedio: 15,

            // Configuración de ventas
            iva_porcentaje: 19,
            permitir_descuentos: true,
            descuento_maximo: 50,

            // Configuración de empleados
            total_empleados: 8,
            empleados_activos: 6,

            // Estado del sistema
            sistema_activo: true,
            modo_mantenimiento: false,
            version_sistema: '3.0.0',
            ultimo_backup: new Date().toISOString()
        };

        res.json({
            success: true,
            data: configuracionBasica
        });

    } catch (error) {
        console.error('❌ Error obteniendo configuración general:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/configuracion/categorias/lista
 * Obtener lista de categorías activas - CON PERSISTENCIA REAL
 */
router.get('/categorias/lista', async (req, res) => {
    return configController.getCategorias(req, res);
});

/**
 * POST /api/configuracion/setup/crear-tabla
 * ENDPOINT TEMPORAL - Crear tabla configuracion_sistema con datos por defecto
 */
router.post('/setup/crear-tabla', authenticateToken, async (req, res) => {
    try {
        console.log('🔧 INICIANDO CREACIÓN DE TABLA configuracion_sistema');

        // Leer el script SQL
        const scriptPath = path.join(__dirname, '../../scripts/crear_tabla_configuracion_sistema.sql');

        if (!fs.existsSync(scriptPath)) {
            return res.status(404).json({
                success: false,
                error: 'Archivo de script SQL no encontrado'
            });
        }

        const sqlScript = fs.readFileSync(scriptPath, 'utf8');

        // Ejecutar el script
        const result = await executeMultipleQueries(sqlScript);

        if (!result.success) {
            return res.status(500).json({
                success: false,
                error: 'Error ejecutando script SQL: ' + result.error
            });
        }

        console.log('✅ Tabla configuracion_sistema creada exitosamente');

        res.json({
            success: true,
            message: 'Tabla configuracion_sistema creada e inicializada exitosamente',
            data: {
                queries_ejecutadas: result.data.length,
                script_path: scriptPath
            }
        });

    } catch (error) {
        console.error('❌ Error creando tabla configuracion_sistema:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// ===== NUEVOS ENDPOINTS CON PERSISTENCIA REAL =====

/**
 * GET /api/configuracion/empresa
 * Obtener solo la configuración de empresa
 */
router.get('/empresa', async (req, res) => {
    return configController.getConfiguracionEmpresa(req, res);
});

/**
 * PUT /api/configuracion/empresa
 * Actualizar solo la configuración de empresa
 */
router.put('/empresa', async (req, res) => {
    return configController.putConfiguracionEmpresa(req, res);
});

/**
 * GET /api/configuracion/sistema/estado
 * Obtener estadísticas y estado general del sistema
 */
router.get('/sistema/estado', async (req, res) => {
    return configController.getEstadoSistema(req, res);
});

// Middleware para rutas no encontradas en configuración
router.use('*', (req, res) => {
    return configController.handleNotFound(req, res);
});

module.exports = router;