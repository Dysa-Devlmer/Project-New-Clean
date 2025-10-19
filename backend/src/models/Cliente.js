// Modelo Cliente - DYSA Point Enterprise
// Implementación MVC profesional para producción
const BaseModel = require('./BaseModel');
const { pool } = require('../config/database');

class Cliente extends BaseModel {
    constructor() {
        super('clientes', 'id');
    }

    // ==================== MÉTODOS ESTÁTICOS ====================

    /**
     * Encuentra un cliente por ID
     */
    static async findById(id) {
        return await this.find(id, 'clientes', 'id');
    }

    /**
     * Encuentra un cliente por RUT
     */
    static async findByRut(rut) {
        try {
            const [rows] = await pool.query(
                'SELECT * FROM clientes WHERE rut = ? AND activo = TRUE LIMIT 1',
                [rut]
            );

            if (rows.length === 0) {
                return null;
            }

            const cliente = new Cliente();
            cliente.attributes = rows[0];
            cliente.originalAttributes = { ...rows[0] };
            cliente.exists = true;
            return cliente;
        } catch (error) {
            console.error('Error finding cliente by RUT:', error);
            throw error;
        }
    }

    /**
     * Encuentra un cliente por teléfono
     */
    static async findByTelefono(telefono) {
        try {
            const [rows] = await pool.query(`
                SELECT
                    id_cliente,
                    nombre_completo,
                    telefono,
                    tipo_cliente,
                    total_visitas,
                    alergias,
                    (SELECT GROUP_CONCAT(nota SEPARATOR ' | ')
                     FROM notas_cliente
                     WHERE id_cliente = c.id_cliente
                     AND visible_en_terminal = TRUE) as notas_importantes,
                    (SELECT num_mesa_preferida
                     FROM preferencias_mesa_cliente
                     WHERE id_cliente = c.id_cliente
                     LIMIT 1) as mesa_preferida
                FROM clientes c
                WHERE c.telefono LIKE ? AND c.activo = TRUE
                ORDER BY c.total_visitas DESC
                LIMIT 5
            `, [`%${telefono}%`]);

            return rows;
        } catch (error) {
            console.error('Error finding cliente by telefono:', error);
            throw error;
        }
    }

    /**
     * Obtiene todos los clientes con filtros y paginación
     */
    static async getAllWithFilters(filters = {}) {
        try {
            const {
                page = 1,
                limit = 20,
                busqueda = '',
                tipo_cliente = '',
                activo = 'true',
                orden = 'fecha_ultima_visita',
                direccion = 'DESC'
            } = filters;

            const offset = (page - 1) * limit;
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

            return {
                data: clientes,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error('Error getting clientes with filters:', error);
            throw error;
        }
    }

    /**
     * Obtiene clientes VIP y frecuentes
     */
    static async getClientesEspeciales() {
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
                WHERE (categoria_cliente = 'VIP' OR cliente_frecuente = TRUE)
                AND activo = TRUE
                ORDER BY total_gastado DESC
                LIMIT 20
            `);

            return clientes;
        } catch (error) {
            console.error('Error getting clientes especiales:', error);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas generales de clientes
     */
    static async getEstadisticas() {
        try {
            // Estadísticas generales
            const [stats] = await pool.query(`
                SELECT
                    COUNT(*) as total_clientes,
                    COUNT(CASE WHEN categoria_cliente = 'VIP' THEN 1 END) as clientes_vip,
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

            return {
                estadisticas_generales: stats[0],
                top_clientes_gasto: topGasto,
                distribucion_tipo: distribucion
            };
        } catch (error) {
            console.error('Error getting estadisticas clientes:', error);
            throw error;
        }
    }

    // ==================== MÉTODOS DE INSTANCIA ====================

    /**
     * Valida los datos del cliente
     */
    validate() {
        const errors = [];

        // Validar nombre o razón social
        if (!this.attributes.nombre && !this.attributes.razon_social) {
            errors.push('Debe proporcionar nombre o razón social');
        }

        // Validar email si existe
        if (this.attributes.email && !this.isValidEmail(this.attributes.email)) {
            errors.push('El email no tiene un formato válido');
        }

        // Validar RUT si existe
        if (this.attributes.rut && !this.isValidRut(this.attributes.rut)) {
            errors.push('El RUT no tiene un formato válido');
        }

        return errors;
    }

    /**
     * Valida formato de email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Valida formato de RUT chileno
     */
    isValidRut(rut) {
        const rutRegex = /^[0-9]+-[0-9kK]{1}$/;
        return rutRegex.test(rut);
    }

    /**
     * Agrega una nota al cliente
     */
    async agregarNota(nota, tipoNota = 'general', visibleEnTerminal = false, idCamarero = null) {
        try {
            await pool.query(`
                INSERT INTO notas_cliente (
                    id_cliente, id_camarero, tipo_nota, nota, visible_en_terminal
                ) VALUES (?, ?, ?, ?, ?)
            `, [this.attributes.id_cliente, idCamarero, tipoNota, nota, visibleEnTerminal]);

            return true;
        } catch (error) {
            console.error('Error agregando nota:', error);
            throw error;
        }
    }

    /**
     * Obtiene el historial de visitas del cliente
     */
    async getHistorialVisitas(limit = 10) {
        try {
            const [historial] = await pool.query(`
                SELECT
                    hv.*,
                    m.descripcion as descripcion_mesa
                FROM historial_visitas_cliente hv
                LEFT JOIN mesa m ON hv.num_mesa = m.Num_Mesa
                WHERE hv.id_cliente = ?
                ORDER BY hv.fecha_visita DESC
                LIMIT ?
            `, [this.attributes.id_cliente, limit]);

            return historial;
        } catch (error) {
            console.error('Error getting historial visitas:', error);
            throw error;
        }
    }

    /**
     * Obtiene los productos favoritos del cliente
     */
    async getProductosFavoritos(limit = 5) {
        try {
            const [favoritos] = await pool.query(`
                SELECT
                    pf.*,
                    c.alias as nombre_producto,
                    c.precio
                FROM productos_favoritos_cliente pf
                JOIN complementog c ON pf.id_complementog = c.id_complementog
                WHERE pf.id_cliente = ?
                ORDER BY pf.veces_pedido DESC
                LIMIT ?
            `, [this.attributes.id_cliente, limit]);

            return favoritos;
        } catch (error) {
            console.error('Error getting productos favoritos:', error);
            throw error;
        }
    }
}

module.exports = Cliente;