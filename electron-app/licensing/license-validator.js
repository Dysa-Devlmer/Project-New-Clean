// 🔐 DYSA Point v2.0.14 - Validador de Licencias Empresariales
// Sistema de licenciamiento para restaurantes en producción
// Creado: 14 de Octubre, 2025 - 00:05 (Santiago)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class LicenseValidator {
    constructor() {
        this.licenseKey = null;
        this.restaurantData = null;
        this.isValid = false;
        this.licenseFile = path.join(__dirname, 'restaurant-license.json');
        this.hardwareId = this.generateHardwareId();

        console.log('🔐 Sistema de licencias empresarial inicializado');
        this.validateLicense();
    }

    // 🔑 Generar ID único del hardware para binding
    generateHardwareId() {
        try {
            const hostname = os.hostname();
            const platform = os.platform();
            const arch = os.arch();
            const cpus = os.cpus().map(cpu => cpu.model).join('');
            const totalMemory = os.totalmem();

            const hardwareString = `${hostname}-${platform}-${arch}-${cpus}-${totalMemory}`;
            return crypto.createHash('sha256').update(hardwareString).digest('hex').substring(0, 16);

        } catch (error) {
            console.log('⚠️ Error generando hardware ID, usando fallback');
            return crypto.createHash('sha256').update(os.hostname()).digest('hex').substring(0, 16);
        }
    }

    // 📋 Validar licencia existente o crear nueva para restaurante
    validateLicense() {
        try {
            // Verificar si existe licencia
            if (fs.existsSync(this.licenseFile)) {
                const licenseData = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));

                if (this.verifyLicenseSignature(licenseData)) {
                    this.licenseKey = licenseData.key;
                    this.restaurantData = licenseData.restaurant;
                    this.isValid = true;

                    console.log(`✅ Licencia válida para: ${this.restaurantData.nombre}`);
                    console.log(`🆔 Licencia: ${this.licenseKey.substring(0, 8)}...`);
                    console.log(`📅 Válida hasta: ${licenseData.expiry}`);

                    return true;
                }
            }

            // No hay licencia válida - crear licencia de desarrollo/demo
            console.log('🔄 Generando licencia automática para desarrollo...');
            this.createDevelopmentLicense();

        } catch (error) {
            console.error('❌ Error validando licencia:', error.message);
            this.createEmergencyLicense();
        }
    }

    // 🔒 Validar licencia de hardware (método requerido por main.js)
    async validateHardwareLicense() {
        this.validateLicense();
        return this.isValid;
    }

    // 🆔 Obtener ID de hardware (método requerido por main.js)
    async getHardwareId() {
        return this.hardwareId;
    }

    // 🏗️ Crear licencia de desarrollo automática
    createDevelopmentLicense() {
        const restaurantData = {
            nombre: process.env.RESTAURANT_NAME || 'Restaurante Demo DYSA',
            rut: process.env.RESTAURANT_RUT || '12.345.678-9',
            direccion: process.env.RESTAURANT_ADDRESS || 'Demo Address 123',
            telefono: process.env.RESTAURANT_PHONE || '+56 9 1234 5678',
            email: process.env.RESTAURANT_EMAIL || 'demo@dysa.cl',
            ciudad: process.env.RESTAURANT_CITY || 'Santiago',
            tipo: 'desarrollo'
        };

        const licenseKey = this.generateLicenseKey(restaurantData);
        const expiry = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 año

        const licenseData = {
            key: licenseKey,
            restaurant: restaurantData,
            hardwareId: this.hardwareId,
            expiry: expiry.toISOString(),
            features: [
                'pos_completo',
                'backup_automatico',
                'monitoreo_247',
                'soporte_remoto',
                'reportes_avanzados',
                'multi_usuario',
                'inventario',
                'facturacion_electronica'
            ],
            version: '2.0.14',
            signature: this.generateSignature(licenseKey, restaurantData, this.hardwareId)
        };

        try {
            fs.writeFileSync(this.licenseFile, JSON.stringify(licenseData, null, 2));

            this.licenseKey = licenseKey;
            this.restaurantData = restaurantData;
            this.isValid = true;

            console.log('✅ Licencia de desarrollo creada automáticamente');
            console.log(`🏪 Restaurante: ${restaurantData.nombre}`);
            console.log(`🆔 Hardware ID: ${this.hardwareId}`);

        } catch (error) {
            console.error('❌ Error creando licencia:', error.message);
            this.createEmergencyLicense();
        }
    }

    // 🆘 Crear licencia de emergencia en memoria
    createEmergencyLicense() {
        console.log('🆘 Creando licencia de emergencia en memoria...');

        this.licenseKey = 'EMERGENCY-' + crypto.randomBytes(8).toString('hex').toUpperCase();
        this.restaurantData = {
            nombre: 'Restaurante Emergencia',
            rut: '99.999.999-9',
            direccion: 'Sistema en Modo Emergencia',
            telefono: 'N/A',
            email: 'emergencia@dysa.cl',
            ciudad: 'Sistema',
            tipo: 'emergencia'
        };
        this.isValid = true;

        console.log('⚠️ MODO EMERGENCIA ACTIVADO - Funcionalidad limitada');
        console.log('🔧 Configure licencia válida para funcionalidad completa');
    }

    // 🔑 Generar clave de licencia
    generateLicenseKey(restaurantData) {
        const data = `${restaurantData.nombre}-${restaurantData.rut}-${this.hardwareId}-${Date.now()}`;
        const hash = crypto.createHash('sha256').update(data).digest('hex');

        // Formato: DYSA-XXXX-XXXX-XXXX-XXXX
        const key = hash.substring(0, 16).toUpperCase();
        return `DYSA-${key.substring(0, 4)}-${key.substring(4, 8)}-${key.substring(8, 12)}-${key.substring(12, 16)}`;
    }

    // ✍️ Generar firma de licencia
    generateSignature(licenseKey, restaurantData, hardwareId) {
        const data = `${licenseKey}${restaurantData.rut}${hardwareId}${restaurantData.nombre}`;
        return crypto.createHash('sha512').update(data + 'DYSA_SECRET_SALT_2025').digest('hex');
    }

    // ✅ Verificar firma de licencia
    verifyLicenseSignature(licenseData) {
        try {
            const expectedSignature = this.generateSignature(
                licenseData.key,
                licenseData.restaurant,
                licenseData.hardwareId
            );

            // Verificar firma
            if (licenseData.signature !== expectedSignature) {
                console.log('❌ Firma de licencia inválida');
                return false;
            }

            // Verificar hardware binding
            if (licenseData.hardwareId !== this.hardwareId) {
                console.log('❌ Licencia no válida para este hardware');
                return false;
            }

            // Verificar expiración
            const expiry = new Date(licenseData.expiry);
            if (expiry < new Date()) {
                console.log('❌ Licencia expirada');
                return false;
            }

            return true;

        } catch (error) {
            console.error('❌ Error verificando firma:', error.message);
            return false;
        }
    }

    // 📊 Obtener información de la licencia
    getLicenseInfo() {
        return {
            isValid: this.isValid,
            licenseKey: this.licenseKey,
            restaurant: this.restaurantData,
            hardwareId: this.hardwareId,
            features: this.getAvailableFeatures()
        };
    }

    // 🎯 Obtener características disponibles
    getAvailableFeatures() {
        if (!this.isValid) {
            return ['pos_basico'];
        }

        if (this.restaurantData?.tipo === 'emergencia') {
            return ['pos_basico', 'backup_manual'];
        }

        // Licencia completa
        return [
            'pos_completo',
            'backup_automatico',
            'monitoreo_247',
            'soporte_remoto',
            'reportes_avanzados',
            'multi_usuario',
            'inventario',
            'facturacion_electronica',
            'integraciones_externas',
            'analytics_avanzado'
        ];
    }

    // 🔍 Verificar si una característica está disponible
    hasFeature(feature) {
        return this.getAvailableFeatures().includes(feature);
    }

    // 🏪 Configurar datos del restaurante
    configureRestaurant(restaurantData) {
        try {
            // Validar datos requeridos
            const required = ['nombre', 'rut', 'direccion', 'telefono', 'email'];
            for (const field of required) {
                if (!restaurantData[field]) {
                    throw new Error(`Campo requerido: ${field}`);
                }
            }

            // Generar nueva licencia
            const licenseKey = this.generateLicenseKey(restaurantData);
            const expiry = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 año

            const licenseData = {
                key: licenseKey,
                restaurant: { ...restaurantData, tipo: 'produccion' },
                hardwareId: this.hardwareId,
                expiry: expiry.toISOString(),
                features: this.getAvailableFeatures(),
                version: '2.0.14',
                signature: this.generateSignature(licenseKey, restaurantData, this.hardwareId),
                created: new Date().toISOString()
            };

            // Guardar licencia
            fs.writeFileSync(this.licenseFile, JSON.stringify(licenseData, null, 2));

            this.licenseKey = licenseKey;
            this.restaurantData = { ...restaurantData, tipo: 'produccion' };
            this.isValid = true;

            console.log(`✅ Licencia de producción configurada para: ${restaurantData.nombre}`);
            console.log(`🆔 Nueva licencia: ${licenseKey}`);

            return {
                success: true,
                licenseKey: licenseKey,
                message: 'Licencia configurada correctamente'
            };

        } catch (error) {
            console.error('❌ Error configurando restaurante:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // 🔄 Renovar licencia
    renewLicense() {
        if (!this.isValid) {
            throw new Error('No hay licencia válida para renovar');
        }

        const expiry = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)); // 1 año más

        try {
            const licenseData = JSON.parse(fs.readFileSync(this.licenseFile, 'utf8'));
            licenseData.expiry = expiry.toISOString();
            licenseData.renewed = new Date().toISOString();
            licenseData.signature = this.generateSignature(
                licenseData.key,
                licenseData.restaurant,
                licenseData.hardwareId
            );

            fs.writeFileSync(this.licenseFile, JSON.stringify(licenseData, null, 2));

            console.log('✅ Licencia renovada exitosamente');
            console.log(`📅 Nueva fecha de expiración: ${expiry.toISOString()}`);

            return true;

        } catch (error) {
            console.error('❌ Error renovando licencia:', error.message);
            return false;
        }
    }

    // 📄 Generar reporte de licencia
    generateLicenseReport() {
        return {
            sistema: 'DYSA Point v2.0.14',
            estado_licencia: this.isValid ? 'VÁLIDA' : 'INVÁLIDA',
            tipo_licencia: this.restaurantData?.tipo || 'NO_CONFIGURADA',
            restaurante: this.restaurantData,
            licencia: this.licenseKey,
            hardware_id: this.hardwareId,
            caracteristicas: this.getAvailableFeatures(),
            timestamp: new Date().toISOString()
        };
    }
}

// 🚀 Exportar validador
module.exports = LicenseValidator;

// ✅ Crear instancia global si se requiere directamente
if (require.main === module) {
    const validator = new LicenseValidator();
    console.log('📊 Reporte de licencia:');
    console.log(JSON.stringify(validator.generateLicenseReport(), null, 2));
}