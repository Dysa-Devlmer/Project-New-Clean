/**
 * DYSA Point - Database Manager
 * Gestor de Base de Datos y Migraciones
 *
 * Maneja la inicialización, migraciones y configuración
 * de la base de datos MySQL del sistema POS
 */

const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

class DatabaseManager {
    constructor(config = {}) {
        this.config = {
            host: config.host || 'localhost',
            port: config.port || 3306,
            user: config.user || 'devlmer',
            password: config.password || 'devlmer2025',
            database: config.database || 'dysa_point',
            charset: 'utf8mb4',
            connectTimeout: 60000,
            acquireTimeout: 60000,
            ...config
        };

        this.connection = null;
        this.isInitialized = false;
    }

    /**
     * Conectar a MySQL (sin base de datos específica)
     */
    async connect() {
        try {
            const connectionConfig = { ...this.config };
            delete connectionConfig.database; // Conectar sin BD específica

            this.connection = await mysql.createConnection(connectionConfig);
            console.log('✅ Conexión a MySQL establecida');
            return true;
        } catch (error) {
            console.error('❌ Error conectando a MySQL:', error.message);
            throw error;
        }
    }

    /**
     * Verificar si la base de datos existe
     */
    async databaseExists() {
        try {
            const [rows] = await this.connection.execute(
                `SHOW DATABASES LIKE '${this.config.database}'`
            );
            return rows.length > 0;
        } catch (error) {
            console.error('❌ Error verificando base de datos:', error);
            return false;
        }
    }

    /**
     * Crear base de datos si no existe
     */
    async createDatabase() {
        try {
            console.log(`🔧 Creando base de datos '${this.config.database}'...`);

            await this.connection.execute(
                `CREATE DATABASE IF NOT EXISTS \`${this.config.database}\`
                 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
            );

            console.log('✅ Base de datos creada o ya existía');
            return true;
        } catch (error) {
            console.error('❌ Error creando base de datos:', error);
            throw error;
        }
    }

    /**
     * Conectar a la base de datos específica
     */
    async connectToDatabase() {
        try {
            await this.connection.changeUser({
                database: this.config.database
            });
            console.log(`✅ Conectado a base de datos '${this.config.database}'`);
            return true;
        } catch (error) {
            console.error('❌ Error conectando a base de datos:', error);
            throw error;
        }
    }

    /**
     * Verificar si las tablas principales existen
     */
    async tablesExist() {
        try {
            // Verificar tablas críticas del sistema completo
            const criticalTables = [
                'configuracion_empresa',
                'empleados',
                'roles_sistema',
                'permisos_especificos',
                'terminales_pos',
                'productos',
                'categorias_productos',
                'mesas_restaurante',
                'ventas_principales',
                'estaciones_preparacion'
            ];

            let existingTables = 0;
            for (const table of criticalTables) {
                const [rows] = await this.connection.execute(
                    `SHOW TABLES LIKE '${table}'`
                );
                if (rows.length > 0) existingTables++;
            }

            // Considerar que existe si al menos 80% de las tablas críticas están presentes
            const threshold = Math.ceil(criticalTables.length * 0.8);
            return existingTables >= threshold;
        } catch (error) {
            console.error('❌ Error verificando tablas:', error);
            return false;
        }
    }

    /**
     * Ejecutar script SQL desde archivo
     */
    async executeSchemaScript() {
        try {
            console.log('🔧 Ejecutando script de esquema completo de base de datos...');

            const schemaPath = path.join(__dirname, 'schema-complete.sql');
            const schemaSQL = await fs.readFile(schemaPath, 'utf8');

            // Dividir el script en statements individuales
            const statements = schemaSQL
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

            let executedCount = 0;
            for (const statement of statements) {
                if (statement.trim()) {
                    try {
                        await this.connection.execute(statement);
                        executedCount++;
                    } catch (error) {
                        // Ignorar errores de IF EXISTS y similares
                        if (!error.message.includes('already exists') &&
                            !error.message.includes('Duplicate key name')) {
                            console.warn(`⚠️ Warning en statement: ${error.message}`);
                        }
                    }
                }
            }

            console.log(`✅ Esquema ejecutado: ${executedCount} statements procesados`);
            return true;
        } catch (error) {
            console.error('❌ Error ejecutando esquema:', error);
            throw error;
        }
    }

    /**
     * Inicializar configuración del restaurante
     */
    async initializeRestaurantConfig(configData) {
        try {
            console.log('🏪 Inicializando configuración del restaurante...');

            // Verificar si ya existe configuración
            const [existing] = await this.connection.execute(
                'SELECT id FROM configuracion_empresa LIMIT 1'
            );

            if (existing.length > 0) {
                // Actualizar configuración existente
                await this.connection.execute(`
                    UPDATE restaurant_config SET
                        name = ?, owner_name = ?, rut = ?, phone = ?,
                        email = ?, website = ?, address = ?, description = ?,
                        currency = ?, timezone = ?, language = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    configData.restaurant.name,
                    configData.restaurant.owner,
                    configData.restaurant.rut || null,
                    configData.restaurant.phone,
                    configData.restaurant.email || null,
                    configData.restaurant.website || null,
                    configData.restaurant.address,
                    configData.restaurant.description || null,
                    configData.system.currency,
                    configData.system.timezone,
                    configData.system.language,
                    existing[0].id
                ]);

                console.log('✅ Configuración del restaurante actualizada');
            } else {
                // Insertar nueva configuración
                await this.connection.execute(`
                    INSERT INTO restaurant_config (
                        name, owner_name, rut, phone, email, website,
                        address, description, currency, timezone, language
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    configData.restaurant.name,
                    configData.restaurant.owner,
                    configData.restaurant.rut || null,
                    configData.restaurant.phone,
                    configData.restaurant.email || null,
                    configData.restaurant.website || null,
                    configData.restaurant.address,
                    configData.restaurant.description || null,
                    configData.system.currency,
                    configData.system.timezone,
                    configData.system.language
                ]);

                console.log('✅ Configuración del restaurante creada');
            }

            return true;
        } catch (error) {
            console.error('❌ Error inicializando configuración:', error);
            throw error;
        }
    }

    /**
     * Crear usuario administrador
     */
    async createAdminUser(password) {
        try {
            console.log('👤 Creando usuario administrador...');

            const bcrypt = require('bcrypt');
            const hashedPassword = await bcrypt.hash(password, 10);

            // Verificar si ya existe el admin
            const [existing] = await this.connection.execute(
                'SELECT id FROM usuarios WHERE email = ?',
                ['admin@restaurant.com']
            );

            if (existing.length > 0) {
                // Actualizar contraseña del admin existente
                await this.connection.execute(
                    'UPDATE usuarios SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [hashedPassword, existing[0].id]
                );
                console.log('✅ Contraseña de administrador actualizada');
            } else {
                // Obtener rol de Administrador
                const [adminRole] = await this.connection.execute(
                    'SELECT id FROM roles WHERE codigo = ?',
                    ['ADMIN']
                );

                if (adminRole.length > 0) {
                    // Crear nuevo usuario administrador
                    await this.connection.execute(`
                        INSERT INTO usuarios (
                            username, email, password, nombre, apellido,
                            role_id, activo, created_at, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    `, [
                        'admin',
                        'admin@restaurant.com',
                        hashedPassword,
                        'Administrador',
                        'Sistema',
                        adminRole[0].id,
                        1
                    ]);
                    console.log('✅ Usuario administrador creado');
                } else {
                    console.error('❌ No se encontró el rol de administrador');
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Error creando usuario administrador:', error);
            throw error;
        }
    }

    /**
     * Insertar datos de ejemplo para desarrollo
     */
    async insertSampleData() {
        try {
            console.log('📝 Insertando datos de ejemplo del sistema completo...');

            // Verificar si ya hay datos
            const [mesas] = await this.connection.execute('SELECT COUNT(*) as count FROM mesas');
            if (mesas[0].count > 0) {
                console.log('ℹ️ Ya existen datos, saltando inserción de ejemplos');
                return true;
            }

            // Zonas del restaurante
            await this.connection.execute(`
                INSERT INTO zonas (nombre, descripcion, color, activo) VALUES
                ('Salón Principal', 'Área principal del restaurante', '#2196F3', 1),
                ('Terraza', 'Área exterior con vista', '#4CAF50', 1),
                ('Bar', 'Área de barra y copas', '#FF9800', 1)
            `);

            // Mesas de ejemplo
            const [zonas] = await this.connection.execute('SELECT id, nombre FROM zonas ORDER BY id');
            const mesasData = [
                ['Mesa 1', 4, zonas[0].id, 100, 100, 'libre'],
                ['Mesa 2', 2, zonas[0].id, 200, 100, 'libre'],
                ['Mesa 3', 6, zonas[0].id, 300, 100, 'libre'],
                ['Mesa 4', 4, zonas[0].id, 100, 200, 'libre'],
                ['Mesa 5', 4, zonas[0].id, 200, 200, 'libre'],
                ['Terraza 1', 4, zonas[1].id, 100, 100, 'libre'],
                ['Terraza 2', 2, zonas[1].id, 200, 100, 'libre'],
                ['Barra 1', 2, zonas[2].id, 50, 50, 'libre']
            ];

            for (const mesa of mesasData) {
                await this.connection.execute(`
                    INSERT INTO mesas (nombre, capacidad, zona_id, posicion_x, posicion_y, estado, activo)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                `, mesa);
            }

            // Categorías de productos
            await this.connection.execute(`
                INSERT INTO categorias (nombre, descripcion, color, orden, activo) VALUES
                ('Entradas', 'Platos de entrada y aperitivos', '#FF5722', 1, 1),
                ('Platos Principales', 'Platos principales y carnes', '#F44336', 2, 1),
                ('Bebidas', 'Bebidas frías y jugos', '#2196F3', 3, 1),
                ('Postres', 'Postres y dulces', '#E91E63', 4, 1),
                ('Cervezas y Licores', 'Bebidas alcohólicas', '#FF9800', 5, 1)
            `);

            // Estaciones de cocina
            await this.connection.execute(`
                INSERT INTO estaciones_cocina (nombre, descripcion, color, orden, activo) VALUES
                ('Cocina Caliente', 'Estación principal de cocina', '#FF5722', 1, 1),
                ('Cocina Fría', 'Ensaladas y entradas frías', '#4CAF50', 2, 1),
                ('Bar', 'Preparación de bebidas', '#2196F3', 3, 1),
                ('Postres', 'Preparación de postres', '#E91E63', 4, 1)
            `);

            // Productos de ejemplo
            const [categorias] = await this.connection.execute('SELECT id, nombre FROM categorias ORDER BY id');
            const [estaciones] = await this.connection.execute('SELECT id, nombre FROM estaciones_cocina ORDER BY id');

            const productos = [
                ['ENT001', 'Empanada de Pino', 'Empanada tradicional chilena rellena', 2500, categorias[0].id, estaciones[1].id, 1, 15],
                ['ENT002', 'Tabla de Quesos', 'Selección de quesos nacionales e importados', 8500, categorias[0].id, estaciones[1].id, 0, 10],
                ['MAIN001', 'Lomo a lo Pobre', 'Lomo con papas fritas y huevo frito', 12500, categorias[1].id, estaciones[0].id, 1, 25],
                ['MAIN002', 'Cazuela de Cordero', 'Cazuela tradicional chilena de cordero', 9500, categorias[1].id, estaciones[0].id, 1, 30],
                ['BEB001', 'Coca Cola', 'Bebida gaseosa 350ml', 1500, categorias[2].id, estaciones[2].id, 0, 2],
                ['BEB002', 'Jugo Natural', 'Jugo de fruta natural del día', 2500, categorias[2].id, estaciones[2].id, 0, 5],
                ['POST001', 'Torta Tres Leches', 'Postre tradicional tres leches', 3500, categorias[3].id, estaciones[3].id, 0, 10],
                ['CERV001', 'Cerveza Cristal', 'Cerveza nacional 330ml', 2000, categorias[4].id, estaciones[2].id, 0, 2]
            ];

            for (const producto of productos) {
                await this.connection.execute(`
                    INSERT INTO productos (codigo, nombre, descripcion, precio, categoria_id, estacion_id, requiere_cocina, tiempo_preparacion, activo)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                `, producto);
            }

            // Configuración de impresoras
            await this.connection.execute(`
                INSERT INTO impresoras (nombre, tipo, ubicacion, ip_address, puerto, driver, activo) VALUES
                ('Caja Principal', 'termica', 'Caja', '192.168.1.100', 9100, 'ESC/POS', 1),
                ('Cocina', 'termica', 'Cocina Caliente', '192.168.1.101', 9100, 'ESC/POS', 1),
                ('Bar', 'termica', 'Bar', '192.168.1.102', 9100, 'ESC/POS', 1)
            `);

            // Formas de pago
            await this.connection.execute(`
                INSERT INTO formas_pago (nombre, tipo, requiere_referencia, activo) VALUES
                ('Efectivo', 'efectivo', 0, 1),
                ('Tarjeta de Débito', 'tarjeta', 1, 1),
                ('Tarjeta de Crédito', 'tarjeta', 1, 1),
                ('Transferencia', 'transferencia', 1, 1),
                ('Cheque', 'cheque', 1, 1)
            `);

            console.log('✅ Datos de ejemplo del sistema completo insertados');
            return true;
        } catch (error) {
            console.error('❌ Error insertando datos de ejemplo:', error);
            // No lanzar error, permitir que continúe la inicialización
            console.warn('⚠️ Continuando sin datos de ejemplo...');
            return false;
        }
    }

    /**
     * Inicialización completa del sistema
     */
    async initialize(configData = null) {
        try {
            console.log('🚀 Iniciando inicialización de base de datos...');

            // 1. Conectar a MySQL
            await this.connect();

            // 2. Crear base de datos si no existe
            await this.createDatabase();

            // 3. Conectar a la base de datos específica
            await this.connectToDatabase();

            // 4. Verificar si ya está inicializada
            const tablesExist = await this.tablesExist();

            if (!tablesExist) {
                // 5. Ejecutar esquema completo
                await this.executeSchemaScript();

                // 6. Insertar datos de ejemplo para desarrollo
                await this.insertSampleData();
            }

            // 7. Configurar restaurante si se proporciona configuración
            if (configData) {
                await this.initializeRestaurantConfig(configData);

                if (configData.system.adminPassword) {
                    await this.createAdminUser(configData.system.adminPassword);
                }
            }

            this.isInitialized = true;
            console.log('🎉 Base de datos inicializada completamente');

            return {
                success: true,
                message: 'Base de datos inicializada correctamente',
                isNewDatabase: !tablesExist
            };

        } catch (error) {
            console.error('❌ Error en inicialización de base de datos:', error);
            throw error;
        }
    }

    /**
     * Verificar estado de la base de datos
     */
    async checkStatus() {
        try {
            if (!this.connection) {
                return { connected: false, initialized: false };
            }

            // Verificar conexión
            await this.connection.ping();

            // Verificar tablas principales
            const tablesExist = await this.tablesExist();

            // Verificar datos básicos
            const [configRows] = await this.connection.execute(
                'SELECT COUNT(*) as count FROM configuracion_empresa'
            );
            const hasConfig = configRows[0].count > 0;

            const [userRows] = await this.connection.execute(
                'SELECT COUNT(*) as count FROM empleados WHERE activo = 1'
            );
            const hasUsers = userRows[0].count > 0;

            return {
                connected: true,
                initialized: tablesExist,
                hasConfig,
                hasUsers,
                databaseName: this.config.database
            };

        } catch (error) {
            console.error('❌ Error verificando estado:', error);
            return { connected: false, initialized: false, error: error.message };
        }
    }

    /**
     * Obtener configuración del restaurante
     */
    async getRestaurantConfig() {
        try {
            const [rows] = await this.connection.execute(
                'SELECT * FROM configuracion_empresa ORDER BY id DESC LIMIT 1'
            );

            return rows.length > 0 ? rows[0] : null;
        } catch (error) {
            console.error('❌ Error obteniendo configuración:', error);
            return null;
        }
    }

    /**
     * Ejecutar query personalizada
     */
    async query(sql, params = []) {
        try {
            const [rows] = await this.connection.execute(sql, params);
            return rows;
        } catch (error) {
            console.error('❌ Error ejecutando query:', error);
            throw error;
        }
    }

    /**
     * Cerrar conexión
     */
    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
            console.log('✅ Conexión de base de datos cerrada');
        }
    }

    /**
     * Backup de base de datos
     */
    async createBackup(outputPath) {
        try {
            console.log('💾 Creando backup de base de datos...');

            const mysqldump = require('mysqldump');

            await mysqldump({
                connection: {
                    host: this.config.host,
                    user: this.config.user,
                    password: this.config.password,
                    database: this.config.database,
                },
                dumpToFile: outputPath,
                compressFile: true
            });

            console.log(`✅ Backup creado en: ${outputPath}`);
            return true;
        } catch (error) {
            console.error('❌ Error creando backup:', error);
            throw error;
        }
    }
}

module.exports = DatabaseManager;