/**
 * DYSA Point - Sistema de Configuración Inicial Automatizada
 * Configuración empresarial automática para despliegue en restaurantes
 *
 * Sistema de Producción - Configuración Inicial Completa
 * Compatible con restaurantes de diferentes tamaños y tipos
 *
 * @author DYSA Point Development Team
 * @version 2.0.14
 * @date 2025-10-13
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class ConfiguracionInicialManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.configPath = path.join(__dirname, '..', '..', 'config');
        this.backupPath = path.join(__dirname, '..', '..', 'backups');
        this.logsPath = path.join(__dirname, '..', '..', 'logs');
        this.certificatesPath = path.join(__dirname, '..', '..', 'certificates');
        this.configCache = new Map();
    }

    /**
     * Ejecutar configuración inicial completa del sistema
     */
    async ejecutarConfiguracionCompleta(datosRestaurante) {
        console.log('🚀 Iniciando configuración inicial empresarial del sistema...');

        try {
            // 1. Crear estructura de directorios
            await this.crearEstructuraDirectorios();

            // 2. Generar configuración base
            const configuracion = await this.generarConfiguracionBase(datosRestaurante);

            // 3. Configurar base de datos inicial
            await this.configurarBaseDatosInicial(datosRestaurante);

            // 4. Crear usuario administrador inicial
            await this.crearAdministradorInicial(datosRestaurante.admin);

            // 5. Configurar mesas iniciales
            await this.configurarMesasIniciales(datosRestaurante.mesas);

            // 6. Configurar productos y categorías básicas
            await this.configurarProductosBasicos(datosRestaurante.productos);

            // 7. Configurar estaciones de cocina
            await this.configurarEstacionesCocina(datosRestaurante.cocina);

            // 8. Configurar tarifas iniciales
            await this.configurarTarifasIniciales(datosRestaurante.tarifas);

            // 9. Generar certificados SSL si es necesario
            await this.generarCertificadosSSL();

            // 10. Crear configuración de backup automático
            await this.configurarBackupAutomatico();

            // 11. Configurar logging empresarial
            await this.configurarLoggingEmpresarial();

            // 12. Generar documentación del restaurante
            await this.generarDocumentacionRestaurante(datosRestaurante);

            console.log('✅ Configuración inicial completada exitosamente');

            this.emit('configuracion_completada', {
                restaurante: datosRestaurante.nombre,
                timestamp: new Date(),
                configuracion: configuracion
            });

            return {
                success: true,
                message: 'Sistema configurado exitosamente para producción',
                configuracion: configuracion,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('❌ Error en configuración inicial:', error);
            throw error;
        }
    }

    /**
     * Crear estructura de directorios necesaria
     */
    async crearEstructuraDirectorios() {
        console.log('📁 Creando estructura de directorios...');

        const directorios = [
            this.configPath,
            this.backupPath,
            this.logsPath,
            this.certificatesPath,
            path.join(this.backupPath, 'database'),
            path.join(this.backupPath, 'config'),
            path.join(this.logsPath, 'access'),
            path.join(this.logsPath, 'error'),
            path.join(this.logsPath, 'system'),
            path.join(this.logsPath, 'audit')
        ];

        for (const dir of directorios) {
            try {
                await fs.access(dir);
            } catch {
                await fs.mkdir(dir, { recursive: true });
                console.log(`📁 Directorio creado: ${dir}`);
            }
        }
    }

    /**
     * Generar configuración base del sistema
     */
    async generarConfiguracionBase(datosRestaurante) {
        console.log('⚙️ Generando configuración base del sistema...');

        const configuracion = {
            sistema: {
                nombre: 'DYSA Point POS',
                version: '2.0.14',
                ambiente: 'production',
                instalacion_id: crypto.randomUUID(),
                fecha_instalacion: new Date().toISOString()
            },
            restaurante: {
                nombre: datosRestaurante.nombre,
                direccion: datosRestaurante.direccion,
                telefono: datosRestaurante.telefono,
                email: datosRestaurante.email,
                tipo: datosRestaurante.tipo || 'casual',
                timezone: datosRestaurante.timezone || 'America/Santiago'
            },
            servidor: {
                puerto: datosRestaurante.puerto || 8547,
                https_habilitado: datosRestaurante.https || false,
                cors_origins: datosRestaurante.cors_origins || ['http://localhost:3000'],
                rate_limit: {
                    general: 200,
                    actualizaciones: 100,
                    autenticacion: 10
                }
            },
            base_datos: {
                host: datosRestaurante.db_host || 'localhost',
                puerto: datosRestaurante.db_puerto || 3306,
                nombre: datosRestaurante.db_nombre || 'dysa_point',
                usuario: datosRestaurante.db_usuario || 'dysa_user',
                pool_size: 20,
                timeout: 60000
            },
            backup: {
                habilitado: true,
                frecuencia_horas: 6,
                retention_dias: 30,
                compresion: true,
                ubicacion: this.backupPath
            },
            logs: {
                nivel: 'info',
                archivo_acceso: true,
                archivo_error: true,
                archivo_sistema: true,
                archivo_auditoria: true,
                rotacion: {
                    frecuencia: 'diaria',
                    max_archivos: 30
                }
            },
            seguridad: {
                jwt_secret: crypto.randomBytes(64).toString('hex'),
                jwt_expiration: '24h',
                bcrypt_rounds: 12,
                session_timeout: 28800000, // 8 horas
                max_intentos_login: 5,
                bloqueo_tiempo: 900000 // 15 minutos
            },
            sistema_pos: {
                impresion_automatica: true,
                backup_automatico: true,
                actualizacion_tiempo_real: true,
                cache_expiration: 300000, // 5 minutos
                websocket_habilitado: true
            },
            notificaciones: {
                email_habilitado: false,
                sms_habilitado: false,
                webhook_habilitado: false,
                alertas_sistema: true
            }
        };

        // Guardar configuración
        const configFile = path.join(this.configPath, 'sistema.json');
        await fs.writeFile(configFile, JSON.stringify(configuracion, null, 2));

        console.log(`✅ Configuración guardada en: ${configFile}`);
        return configuracion;
    }

    /**
     * Configurar base de datos inicial
     */
    async configurarBaseDatosInicial(datosRestaurante) {
        console.log('🗄️ Configurando base de datos inicial...');

        try {
            // Verificar conexión
            await this.database.connection.execute('SELECT 1');

            // Configurar información del restaurante
            await this.database.connection.execute(`
                INSERT INTO configuracion_sistema (clave, valor, descripcion) VALUES
                ('nombre_restaurante', ?, 'Nombre del restaurante'),
                ('direccion_restaurante', ?, 'Dirección del restaurante'),
                ('telefono_restaurante', ?, 'Teléfono del restaurante'),
                ('email_restaurante', ?, 'Email del restaurante'),
                ('timezone', ?, 'Zona horaria del restaurante'),
                ('tipo_restaurante', ?, 'Tipo de restaurante'),
                ('sistema_version', '2.0.14', 'Versión del sistema')
                ON DUPLICATE KEY UPDATE valor = VALUES(valor)
            `, [
                datosRestaurante.nombre,
                datosRestaurante.direccion,
                datosRestaurante.telefono,
                datosRestaurante.email,
                datosRestaurante.timezone || 'America/Santiago',
                datosRestaurante.tipo || 'casual'
            ]);

            console.log('✅ Configuración de base de datos completada');

        } catch (error) {
            console.error('❌ Error configurando base de datos:', error);
            throw error;
        }
    }

    /**
     * Crear usuario administrador inicial
     */
    async crearAdministradorInicial(adminData) {
        console.log('👤 Creando usuario administrador inicial...');

        const bcrypt = require('bcrypt');
        const hashedPassword = await bcrypt.hash(adminData.password, 12);

        try {
            // Crear usuario administrador
            await this.database.connection.execute(`
                INSERT INTO usuarios (
                    username, password, email, nombre, apellido,
                    rol, activo, created_at
                ) VALUES (?, ?, ?, ?, ?, 'admin', true, NOW())
                ON DUPLICATE KEY UPDATE
                password = VALUES(password),
                nombre = VALUES(nombre),
                apellido = VALUES(apellido),
                email = VALUES(email)
            `, [
                adminData.username,
                hashedPassword,
                adminData.email,
                adminData.nombre,
                adminData.apellido
            ]);

            console.log(`✅ Administrador creado: ${adminData.username}`);

        } catch (error) {
            console.error('❌ Error creando administrador:', error);
            throw error;
        }
    }

    /**
     * Configurar mesas iniciales
     */
    async configurarMesasIniciales(mesasConfig) {
        console.log('🍽️ Configurando mesas iniciales...');

        try {
            const { cantidad = 20, capacidad_default = 4, distribucion = 'automatica' } = mesasConfig;

            // Limpiar mesas existentes si es reconfiguración
            await this.database.connection.execute('DELETE FROM mesas_posicion_visual WHERE mesa_id > 0');

            for (let i = 1; i <= cantidad; i++) {
                // Crear mesa base si no existe
                await this.database.connection.execute(`
                    INSERT IGNORE INTO mesa (Num_Mesa, descripcion, capacidad, zona, activa)
                    VALUES (?, ?, ?, 'Principal', true)
                `, [i, `Mesa ${i}`, capacidad_default]);

                // Configurar posición visual
                const posicion_x = 150 + ((i - 1) % 8) * 100;
                const posicion_y = 150 + Math.floor((i - 1) / 8) * 100;

                await this.database.connection.execute(`
                    INSERT INTO mesas_posicion_visual (
                        mesa_id, posicion_x, posicion_y, ancho, alto, forma
                    ) VALUES (?, ?, ?, 80, 80, 'circular')
                    ON DUPLICATE KEY UPDATE
                    posicion_x = VALUES(posicion_x),
                    posicion_y = VALUES(posicion_y)
                `, [i, posicion_x, posicion_y]);
            }

            console.log(`✅ ${cantidad} mesas configuradas correctamente`);

        } catch (error) {
            console.error('❌ Error configurando mesas:', error);
            throw error;
        }
    }

    /**
     * Configurar productos básicos
     */
    async configurarProductosBasicos(productosConfig) {
        console.log('📦 Configurando productos básicos...');

        try {
            const productosBasicos = productosConfig || [
                { nombre: 'Agua Mineral', precio: 2500, categoria: 'Bebidas' },
                { nombre: 'Coca Cola', precio: 3000, categoria: 'Bebidas' },
                { nombre: 'Cerveza Nacional', precio: 4500, categoria: 'Bebidas' },
                { nombre: 'Hamburguesa Clásica', precio: 8500, categoria: 'Platos Principales' },
                { nombre: 'Pizza Margherita', precio: 12000, categoria: 'Platos Principales' },
                { nombre: 'Ensalada César', precio: 7500, categoria: 'Ensaladas' },
                { nombre: 'Papas Fritas', precio: 4000, categoria: 'Acompañamientos' }
            ];

            for (const producto of productosBasicos) {
                await this.database.connection.execute(`
                    INSERT IGNORE INTO complementog (
                        alias, precio, categoria, activo, stock_ilimitado
                    ) VALUES (?, ?, ?, true, true)
                `, [producto.nombre, producto.precio, producto.categoria]);
            }

            console.log(`✅ ${productosBasicos.length} productos básicos configurados`);

        } catch (error) {
            console.error('❌ Error configurando productos:', error);
            throw error;
        }
    }

    /**
     * Configurar estaciones de cocina
     */
    async configurarEstacionesCocina(cocinaConfig) {
        console.log('🍳 Configurando estaciones de cocina...');

        try {
            const estaciones = cocinaConfig || [
                { nombre: 'Cocina Caliente', bloque_default: 2, activa: true },
                { nombre: 'Cocina Fría', bloque_default: 1, activa: true },
                { nombre: 'Parrilla', bloque_default: 3, activa: true },
                { nombre: 'Bar/Bebidas', bloque_default: 1, activa: true }
            ];

            for (const estacion of estaciones) {
                await this.database.connection.execute(`
                    INSERT INTO estaciones_cocina (
                        nombre, bloque_default, activa, created_at
                    ) VALUES (?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                    bloque_default = VALUES(bloque_default),
                    activa = VALUES(activa)
                `, [estacion.nombre, estacion.bloque_default, estacion.activa]);
            }

            console.log(`✅ ${estaciones.length} estaciones de cocina configuradas`);

        } catch (error) {
            console.error('❌ Error configurando estaciones de cocina:', error);
            throw error;
        }
    }

    /**
     * Configurar tarifas iniciales
     */
    async configurarTarifasIniciales(tarifasConfig) {
        console.log('💰 Configurando tarifas iniciales...');

        try {
            const tarifasBasicas = tarifasConfig || [
                {
                    nombre: 'Happy Hour',
                    tipo: 'descuento_porcentaje',
                    valor: 15,
                    condicion_horario_inicio: '17:00',
                    condicion_horario_fin: '19:00',
                    activa: true
                },
                {
                    nombre: 'Recargo Nocturno',
                    tipo: 'recargo_porcentaje',
                    valor: 10,
                    condicion_horario_inicio: '22:00',
                    condicion_horario_fin: '06:00',
                    activa: true
                },
                {
                    nombre: 'Descuento VIP',
                    tipo: 'descuento_porcentaje',
                    valor: 20,
                    condicion_tipo_cliente: 'vip',
                    activa: true
                }
            ];

            for (const tarifa of tarifasBasicas) {
                await this.database.connection.execute(`
                    INSERT INTO tarifas_configuracion (
                        nombre, descripcion, tipo_descuento, valor_descuento,
                        condicion_horario_inicio, condicion_horario_fin,
                        condicion_tipo_cliente, activa, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                    valor_descuento = VALUES(valor_descuento),
                    activa = VALUES(activa)
                `, [
                    tarifa.nombre,
                    `Tarifa ${tarifa.nombre} configurada automáticamente`,
                    tarifa.tipo,
                    tarifa.valor,
                    tarifa.condicion_horario_inicio || null,
                    tarifa.condicion_horario_fin || null,
                    tarifa.condicion_tipo_cliente || null,
                    tarifa.activa
                ]);
            }

            console.log(`✅ ${tarifasBasicas.length} tarifas iniciales configuradas`);

        } catch (error) {
            console.error('❌ Error configurando tarifas:', error);
            throw error;
        }
    }

    /**
     * Generar certificados SSL para HTTPS
     */
    async generarCertificadosSSL() {
        console.log('🔒 Generando certificados SSL...');

        try {
            const forge = require('node-forge');
            const pki = forge.pki;

            // Generar par de llaves
            const keys = pki.rsa.generateKeyPair(2048);

            // Crear certificado
            const cert = pki.createCertificate();
            cert.publicKey = keys.publicKey;
            cert.serialNumber = '01';
            cert.validity.notBefore = new Date();
            cert.validity.notAfter = new Date();
            cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

            const attrs = [{
                name: 'commonName',
                value: 'localhost'
            }, {
                name: 'organizationName',
                value: 'DYSA Point POS'
            }];

            cert.setSubject(attrs);
            cert.setIssuer(attrs);

            // Auto-firmar
            cert.sign(keys.privateKey);

            // Guardar certificados
            const certPem = pki.certificateToPem(cert);
            const keyPem = pki.privateKeyToPem(keys.privateKey);

            await fs.writeFile(path.join(this.certificatesPath, 'server.crt'), certPem);
            await fs.writeFile(path.join(this.certificatesPath, 'server.key'), keyPem);

            console.log('✅ Certificados SSL generados y guardados');

        } catch (error) {
            console.warn('⚠️ No se pudieron generar certificados SSL (opcional):', error.message);
        }
    }

    /**
     * Configurar backup automático
     */
    async configurarBackupAutomatico() {
        console.log('💾 Configurando backup automático...');

        const backupScript = `#!/bin/bash
# Script de backup automático para DYSA Point
# Generado automáticamente el ${new Date().toISOString()}

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="${this.backupPath}/database"
DB_NAME="dysa_point"
DB_USER="devlmer"
DB_PASS="devlmer2025"

# Crear backup de base de datos
mysqldump -u $DB_USER -p$DB_PASS $DB_NAME > "$BACKUP_DIR/dysa_point_$DATE.sql"

# Comprimir backup
gzip "$BACKUP_DIR/dysa_point_$DATE.sql"

# Eliminar backups antiguos (más de 30 días)
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup completado: dysa_point_$DATE.sql.gz"
`;

        await fs.writeFile(path.join(this.backupPath, 'backup_automatico.sh'), backupScript);

        // Script de Windows también
        const backupScriptWin = `@echo off
rem Script de backup automático para DYSA Point (Windows)
rem Generado automáticamente el ${new Date().toISOString()}

set DATE=%DATE:~6,4%%DATE:~3,2%%DATE:~0,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%
set DATE=%DATE: =0%
set BACKUP_DIR=${this.backupPath.replace(/\//g, '\\')}\\database
set DB_NAME=dysa_point
set DB_USER=devlmer
set DB_PASS=devlmer2025

"C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe" -u %DB_USER% -p%DB_PASS% %DB_NAME% > "%BACKUP_DIR%\\dysa_point_%DATE%.sql"

echo Backup completado: dysa_point_%DATE%.sql
`;

        await fs.writeFile(path.join(this.backupPath, 'backup_automatico.bat'), backupScriptWin);

        console.log('✅ Scripts de backup automático configurados');
    }

    /**
     * Configurar logging empresarial
     */
    async configurarLoggingEmpresarial() {
        console.log('📋 Configurando logging empresarial...');

        const logConfig = {
            version: '2.0.14',
            formatters: {
                simple: {
                    format: '[{timestamp}] {level}: {message}'
                },
                json: {
                    format: 'json'
                }
            },
            handlers: {
                console: {
                    class: 'StreamHandler',
                    level: 'INFO',
                    formatter: 'simple'
                },
                file_access: {
                    class: 'FileHandler',
                    level: 'INFO',
                    filename: path.join(this.logsPath, 'access', 'access.log'),
                    formatter: 'json'
                },
                file_error: {
                    class: 'FileHandler',
                    level: 'ERROR',
                    filename: path.join(this.logsPath, 'error', 'error.log'),
                    formatter: 'json'
                },
                file_system: {
                    class: 'FileHandler',
                    level: 'INFO',
                    filename: path.join(this.logsPath, 'system', 'system.log'),
                    formatter: 'json'
                },
                file_audit: {
                    class: 'FileHandler',
                    level: 'INFO',
                    filename: path.join(this.logsPath, 'audit', 'audit.log'),
                    formatter: 'json'
                }
            },
            loggers: {
                access: {
                    handlers: ['file_access'],
                    level: 'INFO'
                },
                error: {
                    handlers: ['console', 'file_error'],
                    level: 'ERROR'
                },
                system: {
                    handlers: ['console', 'file_system'],
                    level: 'INFO'
                },
                audit: {
                    handlers: ['file_audit'],
                    level: 'INFO'
                }
            }
        };

        await fs.writeFile(
            path.join(this.configPath, 'logging.json'),
            JSON.stringify(logConfig, null, 2)
        );

        console.log('✅ Configuración de logging empresarial completada');
    }

    /**
     * Generar documentación del restaurante
     */
    async generarDocumentacionRestaurante(datosRestaurante) {
        console.log('📚 Generando documentación del restaurante...');

        const documentacion = `# Documentación - ${datosRestaurante.nombre}

## Información del Restaurante
- **Nombre**: ${datosRestaurante.nombre}
- **Dirección**: ${datosRestaurante.direccion}
- **Teléfono**: ${datosRestaurante.telefono}
- **Email**: ${datosRestaurante.email}
- **Tipo**: ${datosRestaurante.tipo || 'Casual'}

## Sistema DYSA Point v2.0.14
- **Fecha de Instalación**: ${new Date().toISOString()}
- **Puerto del Servidor**: ${datosRestaurante.puerto || 8547}
- **Base de Datos**: ${datosRestaurante.db_nombre || 'dysa_point'}

## Usuarios del Sistema
- **Administrador**: ${datosRestaurante.admin?.username || 'admin'}
- **Email Admin**: ${datosRestaurante.admin?.email || 'admin@restaurant.com'}

## Configuración de Mesas
- **Cantidad Total**: ${datosRestaurante.mesas?.cantidad || 20}
- **Capacidad Default**: ${datosRestaurante.mesas?.capacidad_default || 4}

## Sistemas Críticos Activos
- ✅ Sistema de Bloques de Cocina
- ✅ Sistema de Aparcar Ventas
- ✅ Sistema de Pre-tickets
- ✅ Sistema de Tarifas Múltiples
- ✅ Sistema de Mapa Visual de Mesas

## URLs de Acceso
- **Panel Principal**: http://localhost:${datosRestaurante.puerto || 8547}
- **API Health**: http://localhost:${datosRestaurante.puerto || 8547}/health
- **Documentación API**: http://localhost:${datosRestaurante.puerto || 8547}/api-docs

## Rutas de Backup
- **Base de Datos**: ${path.join(this.backupPath, 'database')}
- **Configuración**: ${path.join(this.backupPath, 'config')}

## Logs del Sistema
- **Acceso**: ${path.join(this.logsPath, 'access')}
- **Errores**: ${path.join(this.logsPath, 'error')}
- **Sistema**: ${path.join(this.logsPath, 'system')}
- **Auditoria**: ${path.join(this.logsPath, 'audit')}

## Soporte Técnico
- **Manual de Usuario**: Ver carpeta /docs
- **Scripts de Backup**: ${this.backupPath}
- **Configuración**: ${this.configPath}

---
Generado automáticamente por DYSA Point v2.0.14
Fecha: ${new Date().toISOString()}
`;

        await fs.writeFile(
            path.join(this.configPath, `${datosRestaurante.nombre.replace(/\s+/g, '_')}_documentacion.md`),
            documentacion
        );

        console.log('✅ Documentación del restaurante generada');
    }

    /**
     * Obtener estado de la configuración
     */
    async obtenerEstadoConfiguracion() {
        try {
            const estadoDirectorios = {};
            const directorios = [this.configPath, this.backupPath, this.logsPath, this.certificatesPath];

            for (const dir of directorios) {
                try {
                    await fs.access(dir);
                    const stats = await fs.stat(dir);
                    estadoDirectorios[path.basename(dir)] = {
                        existe: true,
                        creado: stats.birthtime,
                        modificado: stats.mtime
                    };
                } catch {
                    estadoDirectorios[path.basename(dir)] = { existe: false };
                }
            }

            return {
                directorios: estadoDirectorios,
                configuracion_sistema: await this.verificarConfiguracionSistema(),
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            throw new Error(`Error verificando estado de configuración: ${error.message}`);
        }
    }

    /**
     * Verificar configuración del sistema
     */
    async verificarConfiguracionSistema() {
        try {
            const configFile = path.join(this.configPath, 'sistema.json');
            await fs.access(configFile);
            const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
            return { existe: true, version: config.sistema.version };
        } catch {
            return { existe: false };
        }
    }

    /**
     * Limpiar recursos
     */
    cleanup() {
        console.log('🧹 ConfiguracionInicialManager: Limpiando recursos...');
        this.configCache.clear();
        this.removeAllListeners();
    }
}

module.exports = ConfiguracionInicialManager;