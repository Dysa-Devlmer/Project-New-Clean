// ==============================================================================
// SISTEMA DE VERIFICACIÓN DE LICENCIAS - DYSA POINT v2.0.0
// Este módulo verifica que la licencia sea válida antes de iniciar el sistema
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class LicenseManager {
    constructor() {
        // Ruta del archivo de licencia
        this.licensePath = path.join(__dirname, '..', 'dysa_point.lic');
        this.hardwareId = null;
    }

    /**
     * Obtiene el ID único del hardware de esta PC
     */
    getHardwareId() {
        try {
            // Obtener MAC Address
            const macCmd = 'wmic nic where "NetEnabled=true" get MACAddress /value';
            const macOutput = execSync(macCmd, { encoding: 'utf-8' });
            const macMatch = macOutput.match(/MACAddress=(.*)/);
            const mac = macMatch ? macMatch[1].trim() : '';

            // Obtener Serial del disco
            const diskCmd = 'wmic diskdrive get SerialNumber /value';
            const diskOutput = execSync(diskCmd, { encoding: 'utf-8' });
            const diskMatch = diskOutput.match(/SerialNumber=(.*)/);
            const diskSerial = diskMatch ? diskMatch[1].trim() : '';

            // Obtener Serial de la placa madre
            const moboCmd = 'wmic baseboard get SerialNumber /value';
            const moboOutput = execSync(moboCmd, { encoding: 'utf-8' });
            const moboMatch = moboOutput.match(/SerialNumber=(.*)/);
            const moboSerial = moboMatch ? moboMatch[1].trim() : '';

            // Generar ID combinado
            this.hardwareId = `${mac}-${diskSerial}-${moboSerial}`;
            return this.hardwareId;
        } catch (error) {
            console.error('❌ Error obteniendo ID de hardware:', error.message);
            return null;
        }
    }

    /**
     * Lee y parsea el archivo de licencia
     */
    readLicense() {
        if (!fs.existsSync(this.licensePath)) {
            return {
                valid: false,
                error: 'LICENCIA_NO_ENCONTRADA',
                message: 'Archivo de licencia no encontrado. Contacte a soporte: contacto@dysa.cl'
            };
        }

        try {
            const licenseContent = fs.readFileSync(this.licensePath, 'utf-8');
            const license = {};

            // Parsear archivo de licencia
            licenseContent.split('\n').forEach(line => {
                if (line.startsWith('#') || !line.trim()) return;
                const [key, value] = line.split('=');
                if (key && value) {
                    license[key.trim()] = value.trim();
                }
            });

            return license;
        } catch (error) {
            return {
                valid: false,
                error: 'LICENCIA_CORRUPTA',
                message: 'Archivo de licencia corrupto. Contacte a soporte: contacto@dysa.cl'
            };
        }
    }

    /**
     * Verifica si la fecha de vencimiento es válida
     */
    checkExpiration(expirationDate) {
        try {
            const [day, month, year] = expirationDate.split('/');
            const expDate = new Date(year, month - 1, day);
            const today = new Date();

            // Resetear horas para comparar solo fechas
            expDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);

            if (today > expDate) {
                return {
                    valid: false,
                    error: 'LICENCIA_VENCIDA',
                    message: `Licencia vencida el ${expirationDate}. Renueve su licencia: contacto@dysa.cl`
                };
            }

            // Advertencia si faltan menos de 7 días
            const daysLeft = Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
            if (daysLeft <= 7 && daysLeft > 0) {
                console.warn(`⚠️  ADVERTENCIA: La licencia vence en ${daysLeft} días`);
            }

            return { valid: true, daysLeft };
        } catch (error) {
            return {
                valid: false,
                error: 'FECHA_INVALIDA',
                message: 'Fecha de vencimiento inválida en la licencia'
            };
        }
    }

    /**
     * Verifica la licencia completa
     */
    verify() {
        console.log('🔐 Verificando licencia de DYSA Point...');

        // 1. Leer licencia
        const license = this.readLicense();
        if (license.error) {
            return license;
        }

        // 2. Obtener hardware ID actual
        const currentHardwareId = this.getHardwareId();
        if (!currentHardwareId) {
            return {
                valid: false,
                error: 'HARDWARE_ID_ERROR',
                message: 'No se pudo obtener ID de hardware del sistema'
            };
        }

        // 3. Verificar que el hardware ID coincida
        if (license.HARDWARE_ID !== currentHardwareId) {
            return {
                valid: false,
                error: 'HARDWARE_NO_COINCIDE',
                message: 'Esta licencia NO es válida para este equipo. Contacte a soporte: contacto@dysa.cl'
            };
        }

        // 4. Verificar fecha de vencimiento
        const expirationCheck = this.checkExpiration(license.FECHA_VENCIMIENTO);
        if (!expirationCheck.valid) {
            return expirationCheck;
        }

        // 5. Verificar vendor
        if (license.VENDOR !== 'DEVLMER-DYSA') {
            return {
                valid: false,
                error: 'LICENCIA_INVALIDA',
                message: 'Licencia no válida o alterada'
            };
        }

        // ✅ Licencia válida
        console.log('✅ Licencia válida');
        console.log(`   Cliente: ${license.CLIENTE}`);
        console.log(`   Tipo: ${license.TIPO}`);
        console.log(`   Vencimiento: ${license.FECHA_VENCIMIENTO}`);
        if (expirationCheck.daysLeft) {
            console.log(`   Días restantes: ${expirationCheck.daysLeft}`);
        }

        return {
            valid: true,
            license: license,
            daysLeft: expirationCheck.daysLeft
        };
    }

    /**
     * Genera mensaje de error formateado
     */
    getErrorMessage(result) {
        return `
╔══════════════════════════════════════════════════════════════╗
║           DYSA POINT - ERROR DE LICENCIA                     ║
╚══════════════════════════════════════════════════════════════╝

❌ ${result.error}

${result.message}

════════════════════════════════════════════════════════════════

Para solicitar o renovar su licencia:
📧 Email: contacto@dysa.cl
📞 Teléfono: [Agregar teléfono]

════════════════════════════════════════════════════════════════
`;
    }
}

// Exportar
module.exports = LicenseManager;

// Si se ejecuta directamente, verificar licencia
if (require.main === module) {
    const licenseManager = new LicenseManager();
    const result = licenseManager.verify();

    if (!result.valid) {
        console.error(licenseManager.getErrorMessage(result));
        process.exit(1);
    } else {
        console.log('✅ Licencia verificada correctamente');
        process.exit(0);
    }
}
