/**
 * =====================================================
 * DYSA POINT 2.0 - CONTROLADOR DE GESTIÓN DE CLIENTES
 * =====================================================
 *
 * Funcionalidades para restaurantes:
 * - CRUD completo de clientes
 * - Búsqueda y filtros
 * - Historial de visitas
 * - Preferencias y notas
 * - Estadísticas de cliente
 * - Integración con ventas
 *
 * Fecha: 2025-10-12 05:01:18
 * Enfoque: Solo Restaurantes (sin hotel, sin comercio)
 */

const { pool } = require('../config/database');

const clientesController = {

    // ===================================================
    // CRUD BÁSICO DE CLIENTES
    // ===================================================

    /**
     * Obtener todos los clientes con filtros y paginación
     */
    obtenerClientes: async (req, res) => {
        try {
            const {
                page = 1,
                limit = 20,
                busqueda = '',
                tipo_cliente = '',
                activo = 'true',
                orden = 'fecha_ultima_visita',
                direccion = 'DESC'
            } = req.query;

            const offset = (page - 1) * limit;

            // Construir query dinámico
            let whereConditions = [];
            let queryParams = [];

            // Filtro de activo
            if (activo !== 'all') {
                whereConditions.push('c.activo = ?');
                queryParams.push(activo === 'true' ? 1 : 0);
            }

            // Filtro de tipo de cliente
            if (tipo_cliente) {
                whereConditions.push('c.tipo_cliente = ?');
                queryParams.push(tipo_cliente);
            }

            // Búsqueda por nombre, teléfono, email o RUT
            if (busqueda) {
                whereConditions.push(`(
                    c.nombre LIKE ? OR
                    c.apellido LIKE ? OR
                    c.telefono LIKE ? OR
                    c.email LIKE ? OR
                    c.rut LIKE ?
                )`);
                const searchTerm = `%${busqueda}%`;
                queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            // Query principal con estadísticas
            const query = `
                SELECT
                    c.id_cliente,
                    c.rut,
                    c.nombre_completo,
                    c.nombre,
                    c.apellido,
                    c.email,
                    c.telefono,
                    c.tipo_cliente,
                    c.total_visitas,
                    c.total_gastado,
                    c.fecha_primera_visita,
                    c.fecha_ultima_visita,
                    c.cliente_frecuente,
                    c.alergias,
                    c.preferencias_gastronomicas,
                    c.activo,

                    -- Estadísticas calculadas
                    DATEDIFF(NOW(), c.fecha_ultima_visita) as dias_sin_visitar,
                    CASE
                        WHEN c.total_visitas = 0 THEN 0
                        ELSE ROUND(c.total_gastado / c.total_visitas, 2)
                    END as gasto_promedio_por_visita,

                    -- Último producto comprado
                    (SELECT comp.alias
                     FROM productos_favoritos_cliente pf
                     JOIN complementog comp ON pf.id_complementog = comp.id_complementog
                     WHERE pf.id_cliente = c.id_cliente
                     ORDER BY pf.fecha_ultimo_pedido DESC
                     LIMIT 1) as ultimo_producto,

                    -- Mesa preferida
                    (SELECT pm.num_mesa_preferida
                     FROM preferencias_mesa_cliente pm
                     WHERE pm.id_cliente = c.id_cliente
                     LIMIT 1) as mesa_preferida,

                    -- Próximo evento
                    (SELECT CONCAT(ee.tipo_evento, ' - ', ee.descripcion)
                     FROM eventos_especiales_cliente ee
                     WHERE ee.id_cliente = c.id_cliente
                     AND ee.fecha_evento >= CURDATE()
                     AND ee.activo = TRUE
                     ORDER BY ee.fecha_evento ASC
                     LIMIT 1) as proximo_evento,

                    -- Notas importantes
                    (SELECT COUNT(*)
                     FROM notas_cliente nc
                     WHERE nc.id_cliente = c.id_cliente
                     AND nc.visible_en_terminal = TRUE) as notas_importantes

                FROM clientes c
                ${whereClause}
                ORDER BY c.${orden} ${direccion}
                LIMIT ? OFFSET ?
            `;

            queryParams.push(parseInt(limit), parseInt(offset));

            const [clientes] = await pool.query(query, queryParams);

            // Contar total para paginación
            const countQuery = `
                SELECT COUNT(*) as total
                FROM clientes c
                ${whereClause}
            `;
            const [countResult] = await pool.query(countQuery, queryParams.slice(0, -2));
            const total = countResult[0].total;

            res.json({
                success: true,
                data: clientes,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            });

        } catch (error) {
            console.error('Error al obtener clientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    /**
     * Obtener un cliente específico con toda su información
     */
    obtenerClientePorId: async (req, res) => {
        try {
            const { id } = req.params;

            // Información básica del cliente
            const [cliente] = await pool.query(`
                SELECT * FROM clientes WHERE id_cliente = ? AND activo = TRUE
            `, [id]);

            if (cliente.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }

            // Historial de visitas
            const [historial] = await pool.query(`
                SELECT
                    hv.*,
                    m.descripcion as descripcion_mesa
                FROM historial_visitas_cliente hv
                LEFT JOIN mesa m ON hv.num_mesa = m.Num_Mesa
                WHERE hv.id_cliente = ?
                ORDER BY hv.fecha_visita DESC
                LIMIT 10
            `, [id]);

            // Productos favoritos
            const [favoritos] = await pool.query(`
                SELECT
                    pf.*,
                    c.alias as nombre_producto,
                    c.precio
                FROM productos_favoritos_cliente pf
                JOIN complementog c ON pf.id_complementog = c.id_complementog
                WHERE pf.id_cliente = ?
                ORDER BY pf.veces_pedido DESC
                LIMIT 5
            `, [id]);

            // Preferencias de mesa
            const [preferencias] = await pool.query(`
                SELECT * FROM preferencias_mesa_cliente WHERE id_cliente = ?
            `, [id]);

            // Eventos especiales
            const [eventos] = await pool.query(`
                SELECT * FROM eventos_especiales_cliente
                WHERE id_cliente = ? AND activo = TRUE
                ORDER BY fecha_evento ASC
            `, [id]);

            // Notas importantes
            const [notas] = await pool.query(`
                SELECT
                    nc.*,
                    cam.nombre as nombre_camarero
                FROM notas_cliente nc
                LEFT JOIN camareros cam ON nc.id_camarero = cam.id_camarero
                WHERE nc.id_cliente = ?
                ORDER BY nc.fecha_nota DESC
            `, [id]);

            res.json({
                success: true,
                data: {
                    cliente: cliente[0],
                    historial_visitas: historial,
                    productos_favoritos: favoritos,
                    preferencias_mesa: preferencias[0] || null,
                    eventos_especiales: eventos,
                    notas: notas
                }
            });

        } catch (error) {
            console.error('Error al obtener cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    /**
     * Crear nuevo cliente
     */
    crearCliente: async (req, res) => {
        try {
            const {
                rut,
                nombre,
                apellido,
                email,
                telefono,
                telefono_secundario,
                fecha_nacimiento,
                direccion,
                comuna,
                ciudad = 'Santiago',
                tipo_cliente = 'regular',
                preferencias_gastronomicas,
                alergias,
                observaciones,
                acepta_marketing = true,
                acepta_sms = true,
                acepta_email = true,
                // Preferencias de mesa opcionales
                num_mesa_preferida,
                zona_preferida,
                tipo_ambiente
            } = req.body;

            // Validaciones básicas
            if (!nombre) {
                return res.status(400).json({
                    success: false,
                    message: 'El nombre es obligatorio'
                });
            }

            // Verificar RUT único si se proporciona
            if (rut) {
                const [existeRut] = await pool.query(
                    'SELECT id_cliente FROM clientes WHERE rut = ? AND activo = TRUE',
                    [rut]
                );
                if (existeRut.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un cliente con ese RUT'
                    });
                }
            }

            // Verificar email único si se proporciona
            if (email) {
                const [existeEmail] = await pool.query(
                    'SELECT id_cliente FROM clientes WHERE email = ? AND activo = TRUE',
                    [email]
                );
                if (existeEmail.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ya existe un cliente con ese email'
                    });
                }
            }

            // Insertar cliente
            const [result] = await pool.query(`
                INSERT INTO clientes (
                    rut, nombre, apellido, email, telefono, telefono_secundario,
                    fecha_nacimiento, direccion, comuna, ciudad, tipo_cliente,
                    preferencias_gastronomicas, alergias, observaciones,
                    acepta_marketing, acepta_sms, acepta_email, creado_por
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                rut, nombre, apellido, email, telefono, telefono_secundario,
                fecha_nacimiento, direccion, comuna, ciudad, tipo_cliente,
                preferencias_gastronomicas, alergias, observaciones,
                acepta_marketing, acepta_sms, acepta_email, 'sistema'
            ]);

            const id_cliente = result.insertId;

            // Insertar preferencias de mesa si se proporcionan
            if (num_mesa_preferida || zona_preferida || tipo_ambiente) {
                await pool.query(`
                    INSERT INTO preferencias_mesa_cliente (
                        id_cliente, num_mesa_preferida, zona_preferida, tipo_ambiente
                    ) VALUES (?, ?, ?, ?)
                `, [id_cliente, num_mesa_preferida, zona_preferida, tipo_ambiente]);
            }

            // Obtener el cliente creado
            const [clienteCreado] = await pool.query(
                'SELECT * FROM clientes WHERE id_cliente = ?',
                [id_cliente]
            );

            res.status(201).json({
                success: true,
                message: 'Cliente creado exitosamente',
                data: clienteCreado[0]
            });

        } catch (error) {
            console.error('Error al crear cliente:', error);

            // Errores específicos de validación MySQL
            if (error.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un cliente con esos datos únicos (RUT o email)'
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    /**
     * Actualizar cliente existente
     */
    actualizarCliente: async (req, res) => {
        try {
            const { id } = req.params;
            const datosActualizacion = req.body;

            // Verificar que el cliente existe
            const [clienteExiste] = await pool.query(
                'SELECT id_cliente FROM clientes WHERE id_cliente = ? AND activo = TRUE',
                [id]
            );

            if (clienteExiste.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }

            // Construir query de actualización dinámico
            const camposPermitidos = [
                'rut', 'nombre', 'apellido', 'email', 'telefono', 'telefono_secundario',
                'fecha_nacimiento', 'direccion', 'comuna', 'ciudad', 'tipo_cliente',
                'preferencias_gastronomicas', 'alergias', 'observaciones',
                'acepta_marketing', 'acepta_sms', 'acepta_email'
            ];

            const camposActualizar = [];
            const valores = [];

            for (const [campo, valor] of Object.entries(datosActualizacion)) {
                if (camposPermitidos.includes(campo) && valor !== undefined) {
                    camposActualizar.push(`${campo} = ?`);
                    valores.push(valor);
                }
            }

            if (camposActualizar.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No hay campos válidos para actualizar'
                });
            }

            valores.push(id);

            const query = `
                UPDATE clientes
                SET ${camposActualizar.join(', ')}
                WHERE id_cliente = ?
            `;

            await pool.query(query, valores);

            // Obtener cliente actualizado
            const [clienteActualizado] = await pool.query(
                'SELECT * FROM clientes WHERE id_cliente = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Cliente actualizado exitosamente',
                data: clienteActualizado[0]
            });

        } catch (error) {
            console.error('Error al actualizar cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    /**
     * Eliminar cliente (soft delete)
     */
    eliminarCliente: async (req, res) => {
        try {
            const { id } = req.params;

            // Verificar que el cliente existe
            const [cliente] = await pool.query(
                'SELECT nombre_completo FROM clientes WHERE id_cliente = ? AND activo = TRUE',
                [id]
            );

            if (cliente.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Cliente no encontrado'
                });
            }

            // Soft delete
            await pool.query(
                'UPDATE clientes SET activo = FALSE WHERE id_cliente = ?',
                [id]
            );

            res.json({
                success: true,
                message: `Cliente ${cliente[0].nombre_completo} desactivado exitosamente`
            });

        } catch (error) {
            console.error('Error al eliminar cliente:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // ===================================================
    // BÚSQUEDA Y FILTROS AVANZADOS
    // ===================================================

    /**
     * Búsqueda rápida de clientes por teléfono (para terminal de garzón)
     */
    buscarPorTelefono: async (req, res) => {
        try {
            const { telefono } = req.params;

            if (!telefono || telefono.length < 4) {
                return res.status(400).json({
                    success: false,
                    message: 'Debe proporcionar al menos 4 dígitos del teléfono'
                });
            }

            const [clientes] = await pool.query(`
                SELECT
                    id_cliente,
                    nombre_completo,
                    telefono,
                    tipo_cliente,
                    total_visitas,
                    alergias,
                    -- Notas importantes para mostrar en terminal
                    (SELECT GROUP_CONCAT(nota SEPARATOR ' | ')
                     FROM notas_cliente
                     WHERE id_cliente = c.id_cliente
                     AND visible_en_terminal = TRUE) as notas_importantes,
                    -- Mesa preferida
                    (SELECT num_mesa_preferida
                     FROM preferencias_mesa_cliente
                     WHERE id_cliente = c.id_cliente
                     LIMIT 1) as mesa_preferida
                FROM clientes c
                WHERE c.telefono LIKE ?
                AND c.activo = TRUE
                ORDER BY c.total_visitas DESC
                LIMIT 5
            `, [`%${telefono}%`]);

            res.json({
                success: true,
                data: clientes
            });

        } catch (error) {
            console.error('Error en búsqueda por teléfono:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    /**
     * Obtener clientes VIP y frecuentes
     */
    obtenerClientesEspeciales: async (req, res) => {
        try {
            const [clientes] = await pool.query(`
                SELECT
                    id_cliente,
                    nombre_completo,
                    telefono,
                    tipo_cliente,
                    total_visitas,
                    total_gastado,
                    fecha_ultima_visita,
                    CASE
                        WHEN total_visitas = 0 THEN 0
                        ELSE ROUND(total_gastado / total_visitas, 2)
                    END as gasto_promedio
                FROM clientes
                WHERE (tipo_cliente = 'vip' OR cliente_frecuente = TRUE)
                AND activo = TRUE
                ORDER BY total_gastado DESC
                LIMIT 20
            `);

            res.json({
                success: true,
                data: clientes
            });

        } catch (error) {
            console.error('Error al obtener clientes especiales:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    // ===================================================
    // GESTIÓN DE NOTAS Y OBSERVACIONES
    // ===================================================

    /**
     * Agregar nota a cliente
     */
    agregarNota: async (req, res) => {
        try {
            const { id } = req.params;
            const {
                tipo_nota = 'general',
                nota,
                visible_en_terminal = false,
                id_camarero
            } = req.body;

            if (!nota) {
                return res.status(400).json({
                    success: false,
                    message: 'La nota es obligatoria'
                });
            }

            await pool.query(`
                INSERT INTO notas_cliente (
                    id_cliente, id_camarero, tipo_nota, nota, visible_en_terminal
                ) VALUES (?, ?, ?, ?, ?)
            `, [id, id_camarero, tipo_nota, nota, visible_en_terminal]);

            res.json({
                success: true,
                message: 'Nota agregada exitosamente'
            });

        } catch (error) {
            console.error('Error al agregar nota:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    },

    /**
     * Obtener estadísticas generales de clientes
     */
    obtenerEstadisticas: async (req, res) => {
        try {
            // Estadísticas generales
            const [stats] = await pool.query(`
                SELECT
                    COUNT(*) as total_clientes,
                    COUNT(CASE WHEN tipo_cliente = 'vip' THEN 1 END) as clientes_vip,
                    COUNT(CASE WHEN cliente_frecuente = TRUE THEN 1 END) as clientes_frecuentes,
                    COUNT(CASE WHEN fecha_ultima_visita >= DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 END) as activos_ultimo_mes,
                    ROUND(AVG(total_gastado), 2) as gasto_promedio,
                    ROUND(AVG(total_visitas), 2) as visitas_promedio
                FROM clientes
                WHERE activo = TRUE
            `);

            // Top 5 clientes por gasto
            const [topGasto] = await pool.query(`
                SELECT nombre_completo, total_gastado
                FROM clientes
                WHERE activo = TRUE
                ORDER BY total_gastado DESC
                LIMIT 5
            `);

            // Distribución por tipo de cliente
            const [distribucion] = await pool.query(`
                SELECT
                    tipo_cliente,
                    COUNT(*) as cantidad,
                    ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM clientes WHERE activo = TRUE)), 2) as porcentaje
                FROM clientes
                WHERE activo = TRUE
                GROUP BY tipo_cliente
            `);

            res.json({
                success: true,
                data: {
                    estadisticas_generales: stats[0],
                    top_clientes_gasto: topGasto,
                    distribucion_tipo: distribucion
                }
            });

        } catch (error) {
            console.error('Error al obtener estadísticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error interno del servidor',
                error: error.message
            });
        }
    }
};

module.exports = clientesController;