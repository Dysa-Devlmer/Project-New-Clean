// ═══════════════════════════════════════════════════════════════
// DYSA POINT - LOGGER DE ACTIVIDAD DE USUARIOS
// Registra todas las acciones importantes del sistema
// ═══════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const log = require('electron-log');

class ActivityLogger {
    constructor(config = {}) {
        this.config = {
            logDir: config.logDir || path.join(process.env.APPDATA, 'DYSA Point', 'logs', 'activity'),
            maxLogFiles: config.maxLogFiles || 90, // Mantener 90 días
            maxLogSizeMB: config.maxLogSizeMB || 10
        };

        // Crear directorio de logs si no existe
        if (!fs.existsSync(this.config.logDir)) {
            fs.mkdirSync(this.config.logDir, { recursive: true });
            log.info('Directorio de logs de actividad creado:', this.config.logDir);
        }

        this.currentLogFile = null;
        this.logStream = null;
        this.inicializarLogDelDia();
    }

    /**
     * Inicializa el archivo de log del día actual
     */
    inicializarLogDelDia() {
        const fecha = new Date().toISOString().substring(0, 10); // YYYY-MM-DD
        const fileName = `activity_${fecha}.log`;
        const filePath = path.join(this.config.logDir, fileName);

        // Si ya existe el archivo, appendear
        // Si no existe, crear nuevo
        this.currentLogFile = filePath;
        this.logStream = fs.createWriteStream(filePath, { flags: 'a' });

        log.info('Log de actividad del día:', filePath);

        // Escribir encabezado si el archivo es nuevo
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            this.escribirEncabezado();
        }

        // Limpiar logs antiguos
        this.limpiarLogsAntiguos();
    }

    /**
     * Escribe el encabezado del archivo de log
     */
    escribirEncabezado() {
        const linea = '='.repeat(80);
        this.logStream.write(`${linea}\n`);
        this.logStream.write(`DYSA POINT - REGISTRO DE ACTIVIDAD\n`);
        this.logStream.write(`Fecha: ${new Date().toLocaleDateString('es-CL')}\n`);
        this.logStream.write(`${linea}\n\n`);
    }

    /**
     * Registra una actividad
     * @param {string} tipo - Tipo de actividad (LOGIN, VENTA, CIERRE_CAJA, etc.)
     * @param {string} usuario - Usuario que realiza la acción
     * @param {string} descripcion - Descripción de la actividad
     * @param {object} datos - Datos adicionales (opcional)
     */
    registrar(tipo, usuario, descripcion, datos = null) {
        const timestamp = new Date().toISOString();
        const hora = new Date().toLocaleTimeString('es-CL');

        const entry = {
            timestamp,
            hora,
            tipo,
            usuario,
            descripcion,
            datos
        };

        // Formatear para escritura
        const linea = this.formatearEntrada(entry);

        // Escribir en archivo
        if (this.logStream) {
            this.logStream.write(linea + '\n');
        }

        // También registrar en electron-log
        log.info(`[ACTIVIDAD] ${tipo} - ${usuario} - ${descripcion}`);

        // Verificar tamaño del archivo
        this.verificarRotacionLog();
    }

    /**
     * Formatea una entrada de log
     */
    formatearEntrada(entry) {
        let linea = `[${entry.hora}] [${entry.tipo}] ${entry.usuario}: ${entry.descripcion}`;

        if (entry.datos) {
            linea += ` | Datos: ${JSON.stringify(entry.datos)}`;
        }

        return linea;
    }

    /**
     * Verifica si el archivo de log actual excede el tamaño máximo
     */
    verificarRotacionLog() {
        if (fs.existsSync(this.currentLogFile)) {
            const stats = fs.statSync(this.currentLogFile);
            const sizeMB = stats.size / (1024 * 1024);

            if (sizeMB > this.config.maxLogSizeMB) {
                log.warn(`Archivo de log excede ${this.config.maxLogSizeMB}MB, rotando...`);
                this.rotarLog();
            }
        }
    }

    /**
     * Rota el archivo de log actual
     */
    rotarLog() {
        // Cerrar stream actual
        if (this.logStream) {
            this.logStream.end();
        }

        // Renombrar archivo actual
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const oldPath = this.currentLogFile;
        const newPath = oldPath.replace('.log', `_${timestamp}.log`);

        fs.renameSync(oldPath, newPath);
        log.info('Log rotado:', newPath);

        // Crear nuevo archivo
        this.inicializarLogDelDia();
    }

    /**
     * Limpia archivos de log antiguos
     */
    limpiarLogsAntiguos() {
        try {
            const files = fs.readdirSync(this.config.logDir)
                .filter(f => f.startsWith('activity_') && f.endsWith('.log'))
                .map(f => ({
                    name: f,
                    path: path.join(this.config.logDir, f),
                    time: fs.statSync(path.join(this.config.logDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Más reciente primero

            // Eliminar los que sobren
            if (files.length > this.config.maxLogFiles) {
                const toDelete = files.slice(this.config.maxLogFiles);

                toDelete.forEach(file => {
                    fs.unlinkSync(file.path);
                    log.info(`Log antiguo eliminado: ${file.name}`);
                });

                log.info(`Limpieza de logs completada: ${toDelete.length} archivos eliminados`);
            }
        } catch (error) {
            log.error('Error al limpiar logs antiguos:', error);
        }
    }

    /**
     * Obtiene el log del día actual
     */
    obtenerLogHoy() {
        try {
            if (fs.existsSync(this.currentLogFile)) {
                return fs.readFileSync(this.currentLogFile, 'utf8');
            }
            return '';
        } catch (error) {
            log.error('Error al leer log del día:', error);
            return '';
        }
    }

    /**
     * Busca entradas en los logs
     * @param {string} criterio - Texto a buscar
     * @param {number} dias - Número de días hacia atrás a buscar
     */
    buscar(criterio, dias = 7) {
        const resultados = [];

        try {
            const files = fs.readdirSync(this.config.logDir)
                .filter(f => f.startsWith('activity_') && f.endsWith('.log'))
                .map(f => ({
                    name: f,
                    path: path.join(this.config.logDir, f),
                    time: fs.statSync(path.join(this.config.logDir, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time) // Más reciente primero
                .slice(0, dias);

            files.forEach(file => {
                const content = fs.readFileSync(file.path, 'utf8');
                const lines = content.split('\n');

                lines.forEach((line, index) => {
                    if (line.toLowerCase().includes(criterio.toLowerCase())) {
                        resultados.push({
                            archivo: file.name,
                            linea: index + 1,
                            contenido: line
                        });
                    }
                });
            });

            return resultados;
        } catch (error) {
            log.error('Error al buscar en logs:', error);
            return [];
        }
    }

    /**
     * Cierra el logger
     */
    cerrar() {
        if (this.logStream) {
            this.logStream.end();
            log.info('Activity logger cerrado');
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // MÉTODOS DE CONVENIENCIA PARA TIPOS COMUNES
    // ═══════════════════════════════════════════════════════════════

    login(usuario, exito = true) {
        this.registrar(
            exito ? 'LOGIN_EXITOSO' : 'LOGIN_FALLIDO',
            usuario,
            exito ? 'Usuario inició sesión' : 'Intento de inicio de sesión fallido'
        );
    }

    logout(usuario) {
        this.registrar('LOGOUT', usuario, 'Usuario cerró sesión');
    }

    venta(usuario, numeroMesa, total, items) {
        this.registrar('VENTA', usuario, `Venta mesa ${numeroMesa}`, {
            mesa: numeroMesa,
            total,
            items
        });
    }

    cierreCaja(usuario, montoInicial, montoFinal, diferencia) {
        this.registrar('CIERRE_CAJA', usuario, 'Cierre de caja realizado', {
            montoInicial,
            montoFinal,
            diferencia
        });
    }

    aperturaC aja(usuario, montoInicial) {
        this.registrar('APERTURA_CAJA', usuario, 'Apertura de caja realizada', {
            montoInicial
        });
    }

    cancelacionPedido(usuario, numeroMesa, motivo) {
        this.registrar('CANCELACION', usuario, `Pedido cancelado mesa ${numeroMesa}`, {
            mesa: numeroMesa,
            motivo
        });
    }

    descuento(usuario, numeroMesa, porcentaje, monto) {
        this.registrar('DESCUENTO', usuario, `Descuento aplicado mesa ${numeroMesa}`, {
            mesa: numeroMesa,
            porcentaje,
            monto
        });
    }

    modificacionPrecio(usuario, producto, precioAnterior, precioNuevo) {
        this.registrar('MODIFICACION_PRECIO', usuario, `Precio modificado: ${producto}`, {
            producto,
            precioAnterior,
            precioNuevo
        });
    }

    backupRealizado(exito = true, archivo = null) {
        this.registrar(
            exito ? 'BACKUP_EXITOSO' : 'BACKUP_FALLIDO',
            'SISTEMA',
            exito ? 'Backup de base de datos completado' : 'Error en backup',
            archivo ? { archivo } : null
        );
    }

    error(usuario, descripcion, errorObj = null) {
        this.registrar('ERROR', usuario || 'SISTEMA', descripcion, {
            error: errorObj ? errorObj.message : null,
            stack: errorObj ? errorObj.stack : null
        });
    }

    advertencia(usuario, descripcion) {
        this.registrar('ADVERTENCIA', usuario || 'SISTEMA', descripcion);
    }

    configuracionCambiada(usuario, campo, valorAnterior, valorNuevo) {
        this.registrar('CONFIGURACION', usuario, `Configuración modificada: ${campo}`, {
            campo,
            valorAnterior,
            valorNuevo
        });
    }
}

module.exports = ActivityLogger;
