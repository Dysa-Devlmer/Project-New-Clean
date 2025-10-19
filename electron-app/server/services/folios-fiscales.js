#!/usr/bin/env node

/**
 * DYSA Point - Sistema de Folios Fiscales Correlativos
 *
 * Este servicio maneja la numeración correlativa obligatoria para documentos fiscales
 * Basado en el análisis del sistema SYSME original
 *
 * Funcionalidades:
 * - Numeración correlativa única e irrepetible
 * - Control por tipo de documento (ticket, factura, nota_credito)
 * - Gestión de series y rangos de numeración
 * - Auditoría completa de documentos emitidos
 * - Validación de integridad secuencial
 * - Recuperación ante fallos
 */

const moment = require('moment-timezone');
const path = require('path');

class FoliosFiscalesManager {
    constructor(database) {
        this.database = database;
        this.nombre = 'FoliosFiscalesManager';
        this.version = '1.0.0';
        this.inicializado = false;

        // Cache de números actuales para performance
        this.cacheNumeros = new Map();
        this.bloqueosActivos = new Set();

        console.log(`📋 Inicializando ${this.nombre} v${this.version}...`);
        this.inicializar();
    }

    async inicializar() {
        try {
            await this.crearTablasNecesarias();
            await this.verificarConfiguracionInicial();
            await this.cargarCacheNumeros();
            this.inicializado = true;
            console.log(`✅ ${this.nombre} inicializado correctamente`);
        } catch (error) {
            console.error(`❌ Error inicializando ${this.nombre}:`, error);
            throw error;
        }
    }

    async crearTablasNecesarias() {
        const tablas = [
            // Tabla principal de control de folios
            `CREATE TABLE IF NOT EXISTS folios_facturas (
                id_folio INT AUTO_INCREMENT PRIMARY KEY,
                tipo_documento ENUM('ticket','factura','boleta','nota_credito','nota_debito') NOT NULL,
                serie VARCHAR(10) NOT NULL DEFAULT 'A',
                numero_actual INT NOT NULL DEFAULT 1,
                numero_minimo INT NOT NULL DEFAULT 1,
                numero_maximo INT NOT NULL DEFAULT 999999,
                prefijo VARCHAR(20) NULL,
                sufijo VARCHAR(20) NULL,
                longitud_numero INT DEFAULT 6,
                activo BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_serie_tipo (tipo_documento, serie),
                INDEX idx_activo (activo),
                INDEX idx_tipo (tipo_documento)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de documentos fiscales emitidos (auditoría)
            `CREATE TABLE IF NOT EXISTS documentos_fiscales (
                id_documento INT AUTO_INCREMENT PRIMARY KEY,
                id_folio INT NOT NULL,
                tipo_documento ENUM('ticket','factura','boleta','nota_credito','nota_debito') NOT NULL,
                serie VARCHAR(10) NOT NULL,
                numero INT NOT NULL,
                numero_completo VARCHAR(50) NOT NULL,
                id_venta INT NULL,
                id_cliente INT NULL,
                monto_total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                monto_neto DECIMAL(10,2) NULL,
                monto_iva DECIMAL(10,2) NULL,
                estado ENUM('emitido','anulado','reemplazado') DEFAULT 'emitido',
                id_empleado INT NOT NULL,
                fecha_emision TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_anulacion TIMESTAMP NULL,
                motivo_anulacion TEXT NULL,
                hash_integridad VARCHAR(64) NULL,
                xml_dte TEXT NULL,
                pdf_documento LONGBLOB NULL,
                observaciones TEXT NULL,
                ip_terminal VARCHAR(50) NULL,
                INDEX idx_numero_completo (numero_completo),
                INDEX idx_venta (id_venta),
                INDEX idx_fecha (fecha_emision),
                INDEX idx_estado (estado),
                INDEX idx_serie_numero (serie, numero),
                FOREIGN KEY (id_folio) REFERENCES folios_facturas(id_folio) ON DELETE RESTRICT,
                UNIQUE KEY unique_serie_numero (tipo_documento, serie, numero)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de configuración fiscal
            `CREATE TABLE IF NOT EXISTS configuracion_fiscal (
                id_config INT AUTO_INCREMENT PRIMARY KEY,
                parametro VARCHAR(100) NOT NULL UNIQUE,
                valor TEXT NOT NULL,
                descripcion TEXT NULL,
                tipo_valor ENUM('string','number','boolean','json') DEFAULT 'string',
                modificable BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_parametro (parametro)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de log de operaciones fiscales
            `CREATE TABLE IF NOT EXISTS log_folios_fiscales (
                id_log INT AUTO_INCREMENT PRIMARY KEY,
                operacion ENUM('obtener_numero','anular_documento','recuperar_secuencia','error') NOT NULL,
                tipo_documento VARCHAR(20) NOT NULL,
                serie VARCHAR(10) NOT NULL,
                numero_anterior INT NULL,
                numero_nuevo INT NULL,
                id_empleado INT NULL,
                descripcion TEXT NULL,
                fecha_operacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_terminal VARCHAR(50) NULL,
                INDEX idx_fecha (fecha_operacion),
                INDEX idx_operacion (operacion),
                INDEX idx_tipo (tipo_documento)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        ];

        for (const sql of tablas) {
            await this.database.query(sql);
        }

        console.log('✅ Tablas de folios fiscales creadas/verificadas');
    }

    async verificarConfiguracionInicial() {
        // Verificar si existen folios configurados
        const [folios] = await this.database.query(
            'SELECT COUNT(*) as total FROM folios_facturas WHERE activo = TRUE'
        );

        if (folios[0].total === 0) {
            // Crear configuraciones por defecto
            const configuracionesIniciales = [
                {
                    tipo_documento: 'ticket',
                    serie: 'A',
                    numero_actual: 1,
                    numero_minimo: 1,
                    numero_maximo: 999999,
                    prefijo: 'TKT-',
                    longitud_numero: 6
                },
                {
                    tipo_documento: 'factura',
                    serie: 'F',
                    numero_actual: 1,
                    numero_minimo: 1,
                    numero_maximo: 999999,
                    prefijo: 'FAC-',
                    longitud_numero: 8
                },
                {
                    tipo_documento: 'boleta',
                    serie: 'B',
                    numero_actual: 1,
                    numero_minimo: 1,
                    numero_maximo: 999999,
                    prefijo: 'BOL-',
                    longitud_numero: 8
                }
            ];

            for (const config of configuracionesIniciales) {
                await this.database.query(`
                    INSERT INTO folios_facturas (
                        tipo_documento, serie, numero_actual, numero_minimo,
                        numero_maximo, prefijo, longitud_numero
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    config.tipo_documento,
                    config.serie,
                    config.numero_actual,
                    config.numero_minimo,
                    config.numero_maximo,
                    config.prefijo,
                    config.longitud_numero
                ]);
            }

            console.log('✅ Configuración inicial de folios fiscales creada');
        }

        // Configuración fiscal básica
        await this.verificarConfiguracionFiscal();
    }

    async verificarConfiguracionFiscal() {
        const configuracionesFiscales = [
            {
                parametro: 'rut_empresa',
                valor: '99999999-9',
                descripcion: 'RUT de la empresa emisora',
                tipo_valor: 'string'
            },
            {
                parametro: 'razon_social',
                valor: 'Restaurante DYSA',
                descripcion: 'Razón social de la empresa',
                tipo_valor: 'string'
            },
            {
                parametro: 'giro_empresa',
                valor: 'Servicios de Alimentación',
                descripcion: 'Giro de la empresa',
                tipo_valor: 'string'
            },
            {
                parametro: 'direccion_empresa',
                valor: 'Dirección del Restaurante',
                descripcion: 'Dirección fiscal',
                tipo_valor: 'string'
            },
            {
                parametro: 'validar_integridad',
                valor: 'true',
                descripcion: 'Validar integridad secuencial',
                tipo_valor: 'boolean'
            }
        ];

        for (const config of configuracionesFiscales) {
            await this.database.query(`
                INSERT IGNORE INTO configuracion_fiscal (
                    parametro, valor, descripcion, tipo_valor
                ) VALUES (?, ?, ?, ?)
            `, [config.parametro, config.valor, config.descripcion, config.tipo_valor]);
        }
    }

    async cargarCacheNumeros() {
        const [folios] = await this.database.query(`
            SELECT
                id_folio,
                tipo_documento,
                serie,
                numero_actual,
                numero_maximo
            FROM folios_facturas
            WHERE activo = TRUE
        `);

        this.cacheNumeros.clear();
        for (const folio of folios) {
            const clave = `${folio.tipo_documento}_${folio.serie}`;
            this.cacheNumeros.set(clave, {
                id_folio: folio.id_folio,
                numero_actual: folio.numero_actual,
                numero_maximo: folio.numero_maximo
            });
        }

        console.log(`✅ Cache de numeración cargado: ${this.cacheNumeros.size} series`);
    }

    // ========================================
    // MÉTODOS DE OBTENCIÓN DE NÚMEROS
    // ========================================

    async obtenerSiguienteNumero(tipo_documento, serie = 'A', id_empleado) {
        const clave = `${tipo_documento}_${serie}`;

        // Prevenir acceso concurrente
        if (this.bloqueosActivos.has(clave)) {
            throw new Error(`Numeración ${clave} está siendo procesada, intente nuevamente`);
        }

        this.bloqueosActivos.add(clave);

        try {
            // Iniciar transacción para garantizar atomicidad
            await this.database.query('START TRANSACTION');

            // Obtener configuración actual con bloqueo
            const [folios] = await this.database.query(`
                SELECT
                    id_folio,
                    numero_actual,
                    numero_maximo,
                    prefijo,
                    sufijo,
                    longitud_numero
                FROM folios_facturas
                WHERE tipo_documento = ? AND serie = ? AND activo = TRUE
                FOR UPDATE
            `, [tipo_documento, serie]);

            if (folios.length === 0) {
                throw new Error(`No existe configuración para ${tipo_documento} serie ${serie}`);
            }

            const folio = folios[0];
            const numeroActual = folio.numero_actual;

            // Validar que no se exceda el máximo
            if (numeroActual > folio.numero_maximo) {
                throw new Error(`Se alcanzó el número máximo (${folio.numero_maximo}) para ${tipo_documento} serie ${serie}`);
            }

            // Incrementar número
            const siguienteNumero = numeroActual + 1;

            await this.database.query(`
                UPDATE folios_facturas
                SET numero_actual = ?,
                    updated_at = NOW()
                WHERE id_folio = ?
            `, [siguienteNumero, folio.id_folio]);

            // Generar número completo formateado
            const numeroCompleto = this.formatearNumeroCompleto(
                numeroActual,
                folio.prefijo,
                folio.sufijo,
                folio.longitud_numero,
                serie
            );

            // Registrar en log
            await this.registrarOperacion({
                operacion: 'obtener_numero',
                tipo_documento,
                serie,
                numero_anterior: numeroActual - 1,
                numero_nuevo: numeroActual,
                id_empleado,
                descripcion: `Número asignado: ${numeroCompleto}`
            });

            // Actualizar cache
            this.cacheNumeros.set(clave, {
                id_folio: folio.id_folio,
                numero_actual: siguienteNumero,
                numero_maximo: folio.numero_maximo
            });

            await this.database.query('COMMIT');

            return {
                success: true,
                id_folio: folio.id_folio,
                numero: numeroActual,
                numero_completo: numeroCompleto,
                tipo_documento,
                serie,
                siguiente_disponible: siguienteNumero
            };

        } catch (error) {
            await this.database.query('ROLLBACK');
            console.error('❌ Error obteniendo número fiscal:', error);
            throw error;
        } finally {
            this.bloqueosActivos.delete(clave);
        }
    }

    formatearNumeroCompleto(numero, prefijo = '', sufijo = '', longitud = 6, serie = 'A') {
        // Formatear número con ceros a la izquierda
        const numeroFormateado = numero.toString().padStart(longitud, '0');

        // Construir número completo
        return `${prefijo || ''}${serie}-${numeroFormateado}${sufijo || ''}`;
    }

    // ========================================
    // MÉTODOS DE EMISIÓN DE DOCUMENTOS
    // ========================================

    async emitirDocumentoFiscal(datosDocumento) {
        try {
            const {
                tipo_documento,
                serie = 'A',
                id_venta = null,
                id_cliente = null,
                monto_total,
                monto_neto = null,
                monto_iva = null,
                id_empleado,
                observaciones = null
            } = datosDocumento;

            // Obtener siguiente número
            const numeroInfo = await this.obtenerSiguienteNumero(tipo_documento, serie, id_empleado);

            // Calcular hash de integridad
            const hashIntegridad = this.calcularHashIntegridad({
                tipo_documento,
                serie,
                numero: numeroInfo.numero,
                monto_total,
                fecha: moment().tz('America/Santiago').format()
            });

            // Registrar documento
            const [result] = await this.database.query(`
                INSERT INTO documentos_fiscales (
                    id_folio,
                    tipo_documento,
                    serie,
                    numero,
                    numero_completo,
                    id_venta,
                    id_cliente,
                    monto_total,
                    monto_neto,
                    monto_iva,
                    id_empleado,
                    hash_integridad,
                    observaciones,
                    ip_terminal
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                numeroInfo.id_folio,
                tipo_documento,
                serie,
                numeroInfo.numero,
                numeroInfo.numero_completo,
                id_venta,
                id_cliente,
                monto_total,
                monto_neto,
                monto_iva,
                id_empleado,
                hashIntegridad,
                observaciones,
                this.obtenerIPTerminal()
            ]);

            console.log(`✅ Documento fiscal emitido: ${numeroInfo.numero_completo}`);

            return {
                success: true,
                id_documento: result.insertId,
                numero_completo: numeroInfo.numero_completo,
                numero: numeroInfo.numero,
                serie,
                tipo_documento,
                hash_integridad: hashIntegridad,
                fecha_emision: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            console.error('❌ Error emitiendo documento fiscal:', error);
            throw error;
        }
    }

    calcularHashIntegridad(datos) {
        const crypto = require('crypto');
        const cadenaIntegridad = `${datos.tipo_documento}|${datos.serie}|${datos.numero}|${datos.monto_total}|${datos.fecha}`;
        return crypto.createHash('sha256').update(cadenaIntegridad).digest('hex');
    }

    // ========================================
    // MÉTODOS DE ANULACIÓN
    // ========================================

    async anularDocumento(id_documento, motivo, id_empleado) {
        try {
            // Verificar que el documento existe y no está anulado
            const [documentos] = await this.database.query(`
                SELECT
                    id_documento,
                    numero_completo,
                    estado,
                    tipo_documento,
                    serie
                FROM documentos_fiscales
                WHERE id_documento = ?
            `, [id_documento]);

            if (documentos.length === 0) {
                throw new Error(`Documento ${id_documento} no encontrado`);
            }

            const documento = documentos[0];

            if (documento.estado === 'anulado') {
                throw new Error(`Documento ${documento.numero_completo} ya está anulado`);
            }

            // Anular documento
            await this.database.query(`
                UPDATE documentos_fiscales
                SET
                    estado = 'anulado',
                    fecha_anulacion = NOW(),
                    motivo_anulacion = ?
                WHERE id_documento = ?
            `, [motivo, id_documento]);

            // Registrar en log
            await this.registrarOperacion({
                operacion: 'anular_documento',
                tipo_documento: documento.tipo_documento,
                serie: documento.serie,
                id_empleado,
                descripcion: `Documento anulado: ${documento.numero_completo}. Motivo: ${motivo}`
            });

            console.log(`✅ Documento anulado: ${documento.numero_completo}`);

            return {
                success: true,
                mensaje: `Documento ${documento.numero_completo} anulado correctamente`,
                motivo
            };

        } catch (error) {
            console.error('❌ Error anulando documento:', error);
            throw error;
        }
    }

    // ========================================
    // MÉTODOS DE VALIDACIÓN Y AUDITORÍA
    // ========================================

    async validarIntegridadSecuencial(tipo_documento, serie = 'A') {
        try {
            const [documentos] = await this.database.query(`
                SELECT numero, hash_integridad
                FROM documentos_fiscales
                WHERE tipo_documento = ? AND serie = ?
                AND estado != 'anulado'
                ORDER BY numero
            `, [tipo_documento, serie]);

            const problemas = [];
            let numeroEsperado = 1;

            for (const doc of documentos) {
                if (doc.numero !== numeroEsperado) {
                    problemas.push({
                        tipo: 'numero_faltante',
                        numero_esperado: numeroEsperado,
                        numero_encontrado: doc.numero,
                        descripcion: `Falta número ${numeroEsperado}`
                    });
                }
                numeroEsperado = doc.numero + 1;
            }

            return {
                success: true,
                tipo_documento,
                serie,
                total_documentos: documentos.length,
                problemas: problemas,
                integridad_ok: problemas.length === 0
            };

        } catch (error) {
            console.error('❌ Error validando integridad:', error);
            throw error;
        }
    }

    async obtenerEstadisticasFiscales(fecha_inicio = null, fecha_fin = null) {
        try {
            const fechaInicio = fecha_inicio || moment().tz('America/Santiago').startOf('day').format();
            const fechaFin = fecha_fin || moment().tz('America/Santiago').endOf('day').format();

            // Documentos por tipo
            const [porTipo] = await this.database.query(`
                SELECT
                    tipo_documento,
                    serie,
                    COUNT(*) as cantidad,
                    SUM(monto_total) as monto_total
                FROM documentos_fiscales
                WHERE fecha_emision BETWEEN ? AND ?
                AND estado != 'anulado'
                GROUP BY tipo_documento, serie
                ORDER BY tipo_documento, serie
            `, [fechaInicio, fechaFin]);

            // Documentos anulados
            const [anulados] = await this.database.query(`
                SELECT
                    tipo_documento,
                    COUNT(*) as cantidad_anulada
                FROM documentos_fiscales
                WHERE fecha_emision BETWEEN ? AND ?
                AND estado = 'anulado'
                GROUP BY tipo_documento
            `, [fechaInicio, fechaFin]);

            // Último número por serie
            const [ultimosNumeros] = await this.database.query(`
                SELECT
                    tipo_documento,
                    serie,
                    numero_actual
                FROM folios_facturas
                WHERE activo = TRUE
                ORDER BY tipo_documento, serie
            `);

            return {
                success: true,
                periodo: {
                    fecha_inicio: fechaInicio,
                    fecha_fin: fechaFin
                },
                documentos_emitidos: porTipo,
                documentos_anulados: anulados,
                numeracion_actual: ultimosNumeros,
                fecha_consulta: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            console.error('❌ Error obteniendo estadísticas:', error);
            throw error;
        }
    }

    // ========================================
    // MÉTODOS AUXILIARES
    // ========================================

    async registrarOperacion(datosOperacion) {
        const {
            operacion,
            tipo_documento,
            serie,
            numero_anterior = null,
            numero_nuevo = null,
            id_empleado = null,
            descripcion = null
        } = datosOperacion;

        await this.database.query(`
            INSERT INTO log_folios_fiscales (
                operacion,
                tipo_documento,
                serie,
                numero_anterior,
                numero_nuevo,
                id_empleado,
                descripcion,
                ip_terminal
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            operacion,
            tipo_documento,
            serie,
            numero_anterior,
            numero_nuevo,
            id_empleado,
            descripcion,
            this.obtenerIPTerminal()
        ]);
    }

    obtenerIPTerminal() {
        const os = require('os');
        const interfaces = os.networkInterfaces();

        for (const name of Object.keys(interfaces)) {
            for (const networkInterface of interfaces[name]) {
                if (networkInterface.family === 'IPv4' && !networkInterface.internal) {
                    return networkInterface.address;
                }
            }
        }

        return '127.0.0.1';
    }

    // ========================================
    // MÉTODOS DE ESTADO Y SALUD
    // ========================================

    async obtenerEstadoServicio() {
        try {
            const [foliosActivos] = await this.database.query(`
                SELECT COUNT(*) as total FROM folios_facturas WHERE activo = TRUE
            `);

            const [documentosHoy] = await this.database.query(`
                SELECT COUNT(*) as total FROM documentos_fiscales
                WHERE DATE(fecha_emision) = CURDATE()
            `);

            const [documentosAnuladosHoy] = await this.database.query(`
                SELECT COUNT(*) as total FROM documentos_fiscales
                WHERE DATE(fecha_emision) = CURDATE() AND estado = 'anulado'
            `);

            return {
                servicio: 'FoliosFiscalesManager',
                version: this.version,
                estado: 'activo',
                inicializado: this.inicializado,
                estadisticas: {
                    folios_activos: foliosActivos[0].total,
                    documentos_hoy: documentosHoy[0].total,
                    anulados_hoy: documentosAnuladosHoy[0].total,
                    series_en_cache: this.cacheNumeros.size,
                    bloqueos_activos: this.bloqueosActivos.size
                },
                timestamp: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            return {
                servicio: 'FoliosFiscalesManager',
                version: this.version,
                estado: 'error',
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            };
        }
    }
}

module.exports = FoliosFiscalesManager;