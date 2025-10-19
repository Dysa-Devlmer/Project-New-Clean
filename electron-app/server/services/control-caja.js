#!/usr/bin/env node

/**
 * DYSA Point - Sistema de Control de Caja Obligatorio
 *
 * Este servicio maneja el control de apertura y cierre de caja obligatorio
 * Basado en el análisis del sistema SYSME original
 *
 * Funcionalidades:
 * - Apertura de caja con monto inicial obligatorio
 * - Validación antes de permitir ventas
 * - Cierre de caja con cuadre automático
 * - Auditoría completa de operaciones
 * - Reportes de movimientos de caja
 */

const moment = require('moment-timezone');
const path = require('path');

class ControlCajaManager {
    constructor(database) {
        this.database = database;
        this.nombre = 'ControlCajaManager';
        this.version = '1.0.0';
        this.inicializado = false;

        console.log(`🏦 Inicializando ${this.nombre} v${this.version}...`);
        this.inicializar();
    }

    async inicializar() {
        try {
            await this.crearTablasNecesarias();
            await this.verificarConfiguracionInicial();
            this.inicializado = true;
            console.log(`✅ ${this.nombre} inicializado correctamente`);
        } catch (error) {
            console.error(`❌ Error inicializando ${this.nombre}:`, error);
            throw error;
        }
    }

    async crearTablasNecesarias() {
        const tablas = [
            // Tabla principal de control de apertura/cierre
            `CREATE TABLE IF NOT EXISTS apcajas (
                id_apcajas INT AUTO_INCREMENT PRIMARY KEY,
                id_caja INT NOT NULL DEFAULT 1,
                fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                fecha_cierre TIMESTAMP NULL,
                monto_inicial DECIMAL(10,2) NOT NULL DEFAULT 0.00,
                monto_final DECIMAL(10,2) NULL,
                monto_sistema DECIMAL(10,2) NULL,
                diferencia DECIMAL(10,2) NULL DEFAULT 0.00,
                abierta ENUM('S','N') DEFAULT 'S',
                id_empleado_apertura INT NOT NULL,
                id_empleado_cierre INT NULL,
                observaciones_apertura TEXT NULL,
                observaciones_cierre TEXT NULL,
                numero_movimientos INT DEFAULT 0,
                estado ENUM('activa','cerrada','cuadrada','con_diferencia') DEFAULT 'activa',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_caja_fecha (id_caja, fecha_apertura),
                INDEX idx_estado (abierta, estado),
                INDEX idx_empleado (id_empleado_apertura)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de movimientos de caja detallados
            `CREATE TABLE IF NOT EXISTS movimientos_caja (
                id_movimiento INT AUTO_INCREMENT PRIMARY KEY,
                id_apcaja INT NOT NULL,
                id_venta INT NULL,
                tipo_movimiento ENUM('venta','devolucion','ingreso','egreso','propina','descuento') NOT NULL,
                monto DECIMAL(10,2) NOT NULL,
                metodo_pago ENUM('efectivo','tarjeta','transferencia','otro') DEFAULT 'efectivo',
                descripcion VARCHAR(255) NULL,
                referencia VARCHAR(100) NULL,
                id_empleado INT NOT NULL,
                fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ip_terminal VARCHAR(50) NULL,
                INDEX idx_apcaja (id_apcaja),
                INDEX idx_venta (id_venta),
                INDEX idx_fecha (fecha_movimiento),
                INDEX idx_tipo (tipo_movimiento),
                FOREIGN KEY (id_apcaja) REFERENCES apcajas(id_apcajas) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,

            // Tabla de configuración de cajas (si no existe)
            `CREATE TABLE IF NOT EXISTS configuracion_cajas (
                id_caja INT AUTO_INCREMENT PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                descripcion TEXT NULL,
                ip_address VARCHAR(50) NULL,
                puerto INT DEFAULT 8547,
                tipo ENUM('pos','cajera','cocina','barra','admin') DEFAULT 'pos',
                requiere_apertura BOOLEAN DEFAULT TRUE,
                monto_minimo_apertura DECIMAL(10,2) DEFAULT 0.00,
                monto_maximo_diferencia DECIMAL(10,2) DEFAULT 5.00,
                activa BOOLEAN DEFAULT TRUE,
                ubicacion VARCHAR(100) NULL,
                responsable VARCHAR(100) NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_activa (activa),
                INDEX idx_tipo (tipo)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
        ];

        for (const sql of tablas) {
            await this.database.query(sql);
        }

        console.log('✅ Tablas de control de caja creadas/verificadas');
    }

    async verificarConfiguracionInicial() {
        // Verificar si existe al menos una caja configurada
        const [cajas] = await this.database.query(
            'SELECT COUNT(*) as total FROM configuracion_cajas WHERE activa = TRUE'
        );

        if (cajas[0].total === 0) {
            // Crear caja principal por defecto
            await this.database.query(`
                INSERT INTO configuracion_cajas (
                    nombre, descripcion, tipo, requiere_apertura, monto_minimo_apertura
                ) VALUES (
                    'Caja Principal', 'Caja principal del restaurante', 'pos', TRUE, 50.00
                )
            `);

            console.log('✅ Configuración inicial de caja creada');
        }
    }

    // ========================================
    // MÉTODOS DE APERTURA DE CAJA
    // ========================================

    async abrirCaja(datosCaja) {
        try {
            const {
                id_caja = 1,
                id_empleado,
                monto_inicial,
                observaciones = null
            } = datosCaja;

            // Validar que no haya una caja ya abierta
            const cajaAbierta = await this.verificarCajaAbierta(id_caja);
            if (cajaAbierta) {
                throw new Error(`Caja ${id_caja} ya está abierta desde ${cajaAbierta.fecha_apertura}`);
            }

            // Validar monto mínimo
            const [config] = await this.database.query(
                'SELECT monto_minimo_apertura FROM configuracion_cajas WHERE id_caja = ? AND activa = TRUE',
                [id_caja]
            );

            if (config.length === 0) {
                throw new Error(`Caja ${id_caja} no existe o no está activa`);
            }

            if (monto_inicial < config[0].monto_minimo_apertura) {
                throw new Error(`Monto inicial debe ser mínimo ${config[0].monto_minimo_apertura}`);
            }

            // Abrir caja
            const [result] = await this.database.query(`
                INSERT INTO apcajas (
                    id_caja,
                    id_empleado_apertura,
                    monto_inicial,
                    observaciones_apertura,
                    abierta,
                    estado
                ) VALUES (?, ?, ?, ?, 'S', 'activa')
            `, [id_caja, id_empleado, monto_inicial, observaciones]);

            const id_apcaja = result.insertId;

            // Registrar movimiento inicial
            await this.registrarMovimiento({
                id_apcaja,
                tipo_movimiento: 'ingreso',
                monto: monto_inicial,
                metodo_pago: 'efectivo',
                descripcion: 'Apertura de caja - Monto inicial',
                id_empleado
            });

            console.log(`✅ Caja ${id_caja} abierta correctamente con ID ${id_apcaja}`);

            return {
                success: true,
                id_apcaja,
                mensaje: `Caja ${id_caja} abierta correctamente`,
                monto_inicial,
                fecha_apertura: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            console.error('❌ Error abriendo caja:', error);
            throw error;
        }
    }

    async cerrarCaja(datosCierre) {
        try {
            const {
                id_caja = 1,
                id_empleado,
                monto_final,
                observaciones = null
            } = datosCierre;

            // Verificar que la caja esté abierta
            const cajaAbierta = await this.verificarCajaAbierta(id_caja);
            if (!cajaAbierta) {
                throw new Error(`Caja ${id_caja} no está abierta`);
            }

            // Calcular monto del sistema
            const montoSistema = await this.calcularMontoSistema(cajaAbierta.id_apcajas);
            const diferencia = parseFloat(monto_final) - parseFloat(montoSistema);

            // Actualizar registro de caja
            await this.database.query(`
                UPDATE apcajas SET
                    fecha_cierre = NOW(),
                    monto_final = ?,
                    monto_sistema = ?,
                    diferencia = ?,
                    abierta = 'N',
                    estado = CASE
                        WHEN ABS(?) <= 0.01 THEN 'cuadrada'
                        ELSE 'con_diferencia'
                    END,
                    id_empleado_cierre = ?,
                    observaciones_cierre = ?
                WHERE id_apcajas = ?
            `, [
                monto_final,
                montoSistema,
                diferencia,
                diferencia, // Para el CASE
                id_empleado,
                observaciones,
                cajaAbierta.id_apcajas
            ]);

            // Registrar movimiento de cierre si hay diferencia
            if (Math.abs(diferencia) > 0.01) {
                await this.registrarMovimiento({
                    id_apcaja: cajaAbierta.id_apcajas,
                    tipo_movimiento: diferencia > 0 ? 'ingreso' : 'egreso',
                    monto: Math.abs(diferencia),
                    metodo_pago: 'efectivo',
                    descripcion: `Cierre de caja - ${diferencia > 0 ? 'Sobrante' : 'Faltante'}`,
                    id_empleado
                });
            }

            console.log(`✅ Caja ${id_caja} cerrada correctamente`);

            return {
                success: true,
                mensaje: `Caja ${id_caja} cerrada correctamente`,
                monto_inicial: cajaAbierta.monto_inicial,
                monto_final,
                monto_sistema: montoSistema,
                diferencia,
                estado: Math.abs(diferencia) <= 0.01 ? 'cuadrada' : 'con_diferencia',
                fecha_cierre: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            console.error('❌ Error cerrando caja:', error);
            throw error;
        }
    }

    // ========================================
    // MÉTODOS DE VALIDACIÓN
    // ========================================

    async verificarCajaAbierta(id_caja = 1) {
        const [result] = await this.database.query(`
            SELECT
                id_apcajas,
                fecha_apertura,
                monto_inicial,
                id_empleado_apertura
            FROM apcajas
            WHERE id_caja = ? AND abierta = 'S'
            ORDER BY fecha_apertura DESC
            LIMIT 1
        `, [id_caja]);

        return result.length > 0 ? result[0] : null;
    }

    async validarVentaPermitida(id_caja = 1) {
        const cajaAbierta = await this.verificarCajaAbierta(id_caja);

        if (!cajaAbierta) {
            return {
                permitida: false,
                mensaje: 'La caja debe estar abierta para realizar ventas',
                codigo: 'CAJA_CERRADA'
            };
        }

        return {
            permitida: true,
            id_apcaja: cajaAbierta.id_apcajas,
            mensaje: 'Venta permitida',
            codigo: 'OK'
        };
    }

    // ========================================
    // MÉTODOS DE MOVIMIENTOS
    // ========================================

    async registrarMovimiento(datosMovimiento) {
        try {
            const {
                id_apcaja,
                id_venta = null,
                tipo_movimiento,
                monto,
                metodo_pago = 'efectivo',
                descripcion = null,
                referencia = null,
                id_empleado
            } = datosMovimiento;

            await this.database.query(`
                INSERT INTO movimientos_caja (
                    id_apcaja,
                    id_venta,
                    tipo_movimiento,
                    monto,
                    metodo_pago,
                    descripcion,
                    referencia,
                    id_empleado,
                    ip_terminal
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                id_apcaja,
                id_venta,
                tipo_movimiento,
                monto,
                metodo_pago,
                descripcion,
                referencia,
                id_empleado,
                this.obtenerIPTerminal()
            ]);

            // Actualizar contador de movimientos
            await this.database.query(`
                UPDATE apcajas SET
                    numero_movimientos = numero_movimientos + 1
                WHERE id_apcajas = ?
            `, [id_apcaja]);

            console.log(`✅ Movimiento registrado: ${tipo_movimiento} por ${monto}`);

        } catch (error) {
            console.error('❌ Error registrando movimiento:', error);
            throw error;
        }
    }

    async registrarVenta(id_apcaja, datosVenta) {
        const {
            id_venta,
            monto_total,
            metodo_pago = 'efectivo',
            id_empleado
        } = datosVenta;

        await this.registrarMovimiento({
            id_apcaja,
            id_venta,
            tipo_movimiento: 'venta',
            monto: monto_total,
            metodo_pago,
            descripcion: `Venta #${id_venta}`,
            referencia: `V-${id_venta}`,
            id_empleado
        });
    }

    // ========================================
    // MÉTODOS DE CÁLCULO Y REPORTES
    // ========================================

    async calcularMontoSistema(id_apcaja) {
        const [result] = await this.database.query(`
            SELECT
                COALESCE(SUM(
                    CASE
                        WHEN tipo_movimiento IN ('venta', 'ingreso') THEN monto
                        WHEN tipo_movimiento IN ('devolucion', 'egreso') THEN -monto
                        ELSE 0
                    END
                ), 0) as monto_sistema
            FROM movimientos_caja
            WHERE id_apcaja = ?
        `, [id_apcaja]);

        return parseFloat(result[0].monto_sistema) || 0;
    }

    async obtenerEstadoCaja(id_caja = 1) {
        const cajaAbierta = await this.verificarCajaAbierta(id_caja);

        if (!cajaAbierta) {
            return {
                estado: 'cerrada',
                mensaje: 'Caja cerrada'
            };
        }

        const montoSistema = await this.calcularMontoSistema(cajaAbierta.id_apcajas);
        const [movimientos] = await this.database.query(`
            SELECT COUNT(*) as total_movimientos
            FROM movimientos_caja
            WHERE id_apcaja = ?
        `, [cajaAbierta.id_apcajas]);

        return {
            estado: 'abierta',
            id_apcaja: cajaAbierta.id_apcajas,
            fecha_apertura: cajaAbierta.fecha_apertura,
            monto_inicial: cajaAbierta.monto_inicial,
            monto_actual: montoSistema,
            movimientos: movimientos[0].total_movimientos,
            mensaje: 'Caja operativa'
        };
    }

    async generarReporteCierre(id_apcaja) {
        try {
            // Datos principales de la caja
            const [datosApertura] = await this.database.query(`
                SELECT
                    a.*,
                    cc.nombre as nombre_caja,
                    e1.nombre as empleado_apertura,
                    e2.nombre as empleado_cierre
                FROM apcajas a
                LEFT JOIN configuracion_cajas cc ON a.id_caja = cc.id_caja
                LEFT JOIN empleados e1 ON a.id_empleado_apertura = e1.id
                LEFT JOIN empleados e2 ON a.id_empleado_cierre = e2.id
                WHERE a.id_apcajas = ?
            `, [id_apcaja]);

            if (datosApertura.length === 0) {
                throw new Error('Caja no encontrada');
            }

            // Resumen de movimientos por tipo
            const [resumenMovimientos] = await this.database.query(`
                SELECT
                    tipo_movimiento,
                    metodo_pago,
                    COUNT(*) as cantidad,
                    SUM(monto) as total
                FROM movimientos_caja
                WHERE id_apcaja = ?
                GROUP BY tipo_movimiento, metodo_pago
                ORDER BY tipo_movimiento, metodo_pago
            `, [id_apcaja]);

            // Movimientos detallados
            const [movimientosDetalle] = await this.database.query(`
                SELECT
                    fecha_movimiento,
                    tipo_movimiento,
                    monto,
                    metodo_pago,
                    descripcion,
                    referencia
                FROM movimientos_caja
                WHERE id_apcaja = ?
                ORDER BY fecha_movimiento
            `, [id_apcaja]);

            return {
                datos_apertura: datosApertura[0],
                resumen_movimientos: resumenMovimientos,
                movimientos_detalle: movimientosDetalle,
                fecha_reporte: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            console.error('❌ Error generando reporte:', error);
            throw error;
        }
    }

    // ========================================
    // MÉTODOS AUXILIARES
    // ========================================

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

    async obtenerConfiguracionCajas() {
        const [cajas] = await this.database.query(`
            SELECT
                id_caja,
                nombre,
                descripcion,
                tipo,
                requiere_apertura,
                monto_minimo_apertura,
                activa
            FROM configuracion_cajas
            WHERE activa = TRUE
            ORDER BY nombre
        `);

        return cajas;
    }

    // ========================================
    // MÉTODOS DE ESTADO Y SALUD
    // ========================================

    async obtenerEstadoServicio() {
        try {
            const totalCajasActivas = await this.database.query(
                'SELECT COUNT(*) as total FROM configuracion_cajas WHERE activa = TRUE'
            );

            const cajasAbiertas = await this.database.query(
                'SELECT COUNT(*) as total FROM apcajas WHERE abierta = "S"'
            );

            const movimientosHoy = await this.database.query(`
                SELECT COUNT(*) as total
                FROM movimientos_caja
                WHERE DATE(fecha_movimiento) = CURDATE()
            `);

            return {
                servicio: 'ControlCajaManager',
                version: this.version,
                estado: 'activo',
                inicializado: this.inicializado,
                estadisticas: {
                    cajas_activas: totalCajasActivas[0][0].total,
                    cajas_abiertas: cajasAbiertas[0][0].total,
                    movimientos_hoy: movimientosHoy[0][0].total
                },
                timestamp: moment().tz('America/Santiago').format()
            };

        } catch (error) {
            return {
                servicio: 'ControlCajaManager',
                version: this.version,
                estado: 'error',
                error: error.message,
                timestamp: moment().tz('America/Santiago').format()
            };
        }
    }
}

module.exports = ControlCajaManager;