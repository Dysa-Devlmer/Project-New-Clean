// Modelo Base - DYSA Point Enterprise
// Implementación del patrón Active Record para producción
const { pool } = require('../config/database');

class BaseModel {
    constructor(tableName, primaryKey = 'id') {
        this.tableName = tableName;
        this.primaryKey = primaryKey;
        this.attributes = {};
        this.originalAttributes = {};
        this.exists = false;
    }

    // ==================== MÉTODOS DE CONSULTA ====================

    /**
     * Encuentra un registro por ID
     */
    static async find(id, tableName, primaryKey = 'id') {
        try {
            const [rows] = await pool.query(
                `SELECT * FROM ${tableName} WHERE ${primaryKey} = ? LIMIT 1`,
                [id]
            );

            if (rows.length === 0) {
                return null;
            }

            const instance = new this(tableName, primaryKey);
            instance.attributes = rows[0];
            instance.originalAttributes = { ...rows[0] };
            instance.exists = true;
            return instance;
        } catch (error) {
            console.error(`Error finding ${tableName}:`, error);
            throw error;
        }
    }

    /**
     * Encuentra todos los registros con filtros opcionales
     */
    static async findAll(tableName, where = '', params = [], orderBy = '', limit = '') {
        try {
            let query = `SELECT * FROM ${tableName}`;

            if (where) {
                query += ` WHERE ${where}`;
            }

            if (orderBy) {
                query += ` ORDER BY ${orderBy}`;
            }

            if (limit) {
                query += ` LIMIT ${limit}`;
            }

            const [rows] = await pool.query(query, params);
            return rows;
        } catch (error) {
            console.error(`Error finding all ${tableName}:`, error);
            throw error;
        }
    }

    /**
     * Encuentra registros con paginación
     */
    static async paginate(tableName, page = 1, limit = 20, where = '', params = [], orderBy = '') {
        try {
            const offset = (page - 1) * limit;

            // Contar total
            let countQuery = `SELECT COUNT(*) as total FROM ${tableName}`;
            if (where) {
                countQuery += ` WHERE ${where}`;
            }

            const [countResult] = await pool.query(countQuery, params);
            const total = countResult[0].total;

            // Obtener datos
            let dataQuery = `SELECT * FROM ${tableName}`;
            if (where) {
                dataQuery += ` WHERE ${where}`;
            }
            if (orderBy) {
                dataQuery += ` ORDER BY ${orderBy}`;
            }
            dataQuery += ` LIMIT ${limit} OFFSET ${offset}`;

            const [rows] = await pool.query(dataQuery, params);

            return {
                data: rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            console.error(`Error paginating ${tableName}:`, error);
            throw error;
        }
    }

    // ==================== MÉTODOS DE PERSISTENCIA ====================

    /**
     * Guarda el modelo (crear o actualizar)
     */
    async save() {
        try {
            if (this.exists) {
                return await this.update();
            } else {
                return await this.create();
            }
        } catch (error) {
            console.error(`Error saving ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Crea un nuevo registro
     */
    async create() {
        try {
            // Remover campos de timestamp automáticos
            const data = { ...this.attributes };
            delete data.created_at;
            delete data.updated_at;
            delete data[this.primaryKey];

            const fields = Object.keys(data);
            const values = Object.values(data);
            const placeholders = fields.map(() => '?').join(',');

            const query = `
                INSERT INTO ${this.tableName} (${fields.join(',')})
                VALUES (${placeholders})
            `;

            const [result] = await pool.query(query, values);

            this.attributes[this.primaryKey] = result.insertId;
            this.originalAttributes = { ...this.attributes };
            this.exists = true;

            return this;
        } catch (error) {
            console.error(`Error creating ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Actualiza el registro existente
     */
    async update() {
        try {
            const data = { ...this.attributes };
            delete data.created_at;
            delete data.updated_at;
            const id = data[this.primaryKey];
            delete data[this.primaryKey];

            const fields = Object.keys(data);
            const values = Object.values(data);
            const setClause = fields.map(field => `${field} = ?`).join(',');

            const query = `
                UPDATE ${this.tableName}
                SET ${setClause}, updated_at = CURRENT_TIMESTAMP
                WHERE ${this.primaryKey} = ?
            `;

            await pool.query(query, [...values, id]);
            this.originalAttributes = { ...this.attributes };

            return this;
        } catch (error) {
            console.error(`Error updating ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Elimina el registro
     */
    async delete() {
        try {
            if (!this.exists) {
                throw new Error('Cannot delete non-existent record');
            }

            const query = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
            await pool.query(query, [this.attributes[this.primaryKey]]);

            this.exists = false;
            return true;
        } catch (error) {
            console.error(`Error deleting ${this.tableName}:`, error);
            throw error;
        }
    }

    /**
     * Soft delete (marcar como inactivo)
     */
    async softDelete() {
        try {
            this.attributes.activo = false;
            return await this.save();
        } catch (error) {
            console.error(`Error soft deleting ${this.tableName}:`, error);
            throw error;
        }
    }

    // ==================== MÉTODOS DE UTILIDAD ====================

    /**
     * Verifica si el modelo ha sido modificado
     */
    isDirty() {
        return JSON.stringify(this.attributes) !== JSON.stringify(this.originalAttributes);
    }

    /**
     * Obtiene los cambios realizados
     */
    getChanges() {
        const changes = {};
        for (const key in this.attributes) {
            if (this.attributes[key] !== this.originalAttributes[key]) {
                changes[key] = {
                    from: this.originalAttributes[key],
                    to: this.attributes[key]
                };
            }
        }
        return changes;
    }

    /**
     * Convierte a JSON
     */
    toJSON() {
        return { ...this.attributes };
    }

    /**
     * Obtiene un atributo
     */
    get(key) {
        return this.attributes[key];
    }

    /**
     * Establece un atributo
     */
    set(key, value) {
        this.attributes[key] = value;
        return this;
    }

    /**
     * Establece múltiples atributos
     */
    fill(data) {
        for (const key in data) {
            this.attributes[key] = data[key];
        }
        return this;
    }
}

module.exports = BaseModel;