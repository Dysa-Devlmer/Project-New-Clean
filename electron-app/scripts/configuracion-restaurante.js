/**
 * DYSA Point - Script de Configuración Automatizada para Restaurantes
 * Herramienta de línea de comandos para configuración inicial
 *
 * Sistema de Producción - Configuración Restaurante
 * Configuración rápida y completa para diferentes tipos de restaurante
 *
 * @author DYSA Point Development Team
 * @version 2.0.14
 * @date 2025-10-13
 */

const readline = require('readline');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class ConfiguradorRestaurante {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        this.baseURL = 'http://localhost:8547';
        this.configuracion = {};
    }

    /**
     * Ejecutar configuración interactiva completa
     */
    async ejecutarConfiguracion() {
        try {
            console.log('\n' + '='.repeat(60));
            console.log('🏪 DYSA Point POS v2.0.14 - Configurador de Restaurante');
            console.log('📋 Sistema de Configuración Inicial Empresarial');
            console.log('='.repeat(60));
            console.log('');

            // Verificar conexión con el servidor
            console.log('🔍 Verificando conexión con el sistema...');
            await this.verificarConexion();
            console.log('✅ Conexión establecida correctamente');
            console.log('');

            // Recopilar información del restaurante
            await this.recopilarInformacionBasica();
            await this.configurarMesas();
            await this.configurarProductos();
            await this.configurarCocina();
            await this.configurarTarifas();
            await this.configurarAdministrador();

            // Mostrar resumen
            await this.mostrarResumen();

            // Confirmar y ejecutar configuración
            const confirmar = await this.pregunta('\n¿Desea aplicar esta configuración? (s/n): ');
            if (confirmar.toLowerCase() === 's' || confirmar.toLowerCase() === 'si') {
                await this.aplicarConfiguracion();
                await this.mostrarResultadoFinal();
            } else {
                console.log('❌ Configuración cancelada por el usuario');
            }

        } catch (error) {
            console.error('\n❌ Error en la configuración:', error.message);
            process.exit(1);
        } finally {
            this.rl.close();
        }
    }

    /**
     * Verificar conexión con el servidor
     */
    async verificarConexion() {
        try {
            const response = await axios.get(`${this.baseURL}/health`, { timeout: 5000 });
            if (!response.data || response.data.status !== 'OK') {
                throw new Error('El servidor no está respondiendo correctamente');
            }
        } catch (error) {
            if (error.code === 'ECONNREFUSED') {
                throw new Error('No se puede conectar al servidor. Asegúrese de que DYSA Point esté ejecutándose en el puerto 8547.');
            }
            throw new Error(`Error de conexión: ${error.message}`);
        }
    }

    /**
     * Recopilar información básica del restaurante
     */
    async recopilarInformacionBasica() {
        console.log('📝 INFORMACIÓN BÁSICA DEL RESTAURANTE');
        console.log('-'.repeat(40));

        this.configuracion.nombre = await this.pregunta('Nombre del restaurante: ');
        this.configuracion.direccion = await this.pregunta('Dirección completa: ');
        this.configuracion.telefono = await this.pregunta('Teléfono: ');
        this.configuracion.email = await this.preguntaEmail('Email de contacto: ');

        console.log('\nTipos de restaurante disponibles:');
        console.log('1. Casual - Restaurante familiar informal');
        console.log('2. Fino - Restaurante gourmet/elegante');
        console.log('3. Rapido - Comida rápida/fast food');
        console.log('4. Bar - Bar/pub con comida');
        console.log('5. Cafeteria - Café con comidas ligeras');

        const tipoNumero = await this.preguntaNumero('Seleccione el tipo de restaurante (1-5): ', 1, 5);
        const tipos = ['casual', 'fino', 'rapido', 'bar', 'cafeteria'];
        this.configuracion.tipo = tipos[tipoNumero - 1];

        this.configuracion.timezone = 'America/Santiago'; // Por defecto para Chile

        console.log('✅ Información básica recopilada\n');
    }

    /**
     * Configurar mesas del restaurante
     */
    async configurarMesas() {
        console.log('🍽️ CONFIGURACIÓN DE MESAS');
        console.log('-'.repeat(40));

        const cantidad = await this.preguntaNumero('Cantidad total de mesas: ', 1, 100);
        const capacidadDefault = await this.preguntaNumero('Capacidad promedio por mesa: ', 1, 20);

        console.log('\nDistribución de mesas:');
        console.log('1. Automática - Distribución en cuadrícula');
        console.log('2. Manual - Configurar después en el mapa visual');

        const distribucion = await this.preguntaNumero('Seleccione distribución (1-2): ', 1, 2);

        this.configuracion.mesas = {
            cantidad: cantidad,
            capacidad_default: capacidadDefault,
            distribucion: distribucion === 1 ? 'automatica' : 'manual'
        };

        console.log('✅ Configuración de mesas completada\n');
    }

    /**
     * Configurar productos básicos
     */
    async configurarProductos() {
        console.log('📦 CONFIGURACIÓN DE PRODUCTOS BÁSICOS');
        console.log('-'.repeat(40));

        const usarPlantilla = await this.pregunta('¿Desea usar productos por defecto para su tipo de restaurante? (s/n): ');

        if (usarPlantilla.toLowerCase() === 'n' || usarPlantilla.toLowerCase() === 'no') {
            console.log('\nConfiguración de productos personalizada:');
            const productos = [];

            let agregarMas = true;
            while (agregarMas) {
                const nombre = await this.pregunta('Nombre del producto: ');
                const precio = await this.preguntaNumero('Precio: ', 1, 1000000);
                const categoria = await this.pregunta('Categoría: ');

                productos.push({ nombre, precio, categoria });

                const continuar = await this.pregunta('¿Agregar otro producto? (s/n): ');
                agregarMas = continuar.toLowerCase() === 's' || continuar.toLowerCase() === 'si';
            }

            this.configuracion.productos = productos;
        } else {
            this.configuracion.productos = 'default'; // Usar productos por defecto según tipo
        }

        console.log('✅ Configuración de productos completada\n');
    }

    /**
     * Configurar estaciones de cocina
     */
    async configurarCocina() {
        console.log('🍳 CONFIGURACIÓN DE COCINA');
        console.log('-'.repeat(40));

        const usarConfiguracionDefault = await this.pregunta('¿Desea usar configuración de cocina por defecto? (s/n): ');

        if (usarConfiguracionDefault.toLowerCase() === 'n' || usarConfiguracionDefault.toLowerCase() === 'no') {
            const estaciones = [];

            let agregarMas = true;
            while (agregarMas) {
                const nombre = await this.pregunta('Nombre de la estación de cocina: ');

                console.log('Bloques de prioridad:');
                console.log('1. Bloque 1 - Baja prioridad');
                console.log('2. Bloque 2 - Prioridad media');
                console.log('3. Bloque 3 - Alta prioridad');
                console.log('4. Bloque 4 - Prioridad crítica');

                const bloque = await this.preguntaNumero('Bloque por defecto (1-4): ', 1, 4);

                estaciones.push({
                    nombre: nombre,
                    bloque_default: bloque,
                    activa: true
                });

                const continuar = await this.pregunta('¿Agregar otra estación? (s/n): ');
                agregarMas = continuar.toLowerCase() === 's' || continuar.toLowerCase() === 'si';
            }

            this.configuracion.cocina = estaciones;
        } else {
            this.configuracion.cocina = 'default'; // Usar configuración por defecto según tipo
        }

        console.log('✅ Configuración de cocina completada\n');
    }

    /**
     * Configurar tarifas especiales
     */
    async configurarTarifas() {
        console.log('💰 CONFIGURACIÓN DE TARIFAS ESPECIALES');
        console.log('-'.repeat(40));

        const configurarTarifas = await this.pregunta('¿Desea configurar tarifas especiales (Happy Hour, descuentos, etc.)? (s/n): ');

        if (configurarTarifas.toLowerCase() === 's' || configurarTarifas.toLowerCase() === 'si') {
            const tarifas = [];

            // Happy Hour
            const happyHour = await this.pregunta('¿Configurar Happy Hour? (s/n): ');
            if (happyHour.toLowerCase() === 's' || happyHour.toLowerCase() === 'si') {
                const descuento = await this.preguntaNumero('Porcentaje de descuento (%): ', 5, 50);
                const inicio = await this.pregunta('Hora de inicio (HH:MM): ');
                const fin = await this.pregunta('Hora de fin (HH:MM): ');

                tarifas.push({
                    nombre: 'Happy Hour',
                    tipo: 'descuento_porcentaje',
                    valor: descuento,
                    condicion_horario_inicio: inicio,
                    condicion_horario_fin: fin,
                    activa: true
                });
            }

            // Recargo nocturno
            const recargoNocturno = await this.pregunta('¿Configurar recargo nocturno? (s/n): ');
            if (recargoNocturno.toLowerCase() === 's' || recargoNocturno.toLowerCase() === 'si') {
                const recargo = await this.preguntaNumero('Porcentaje de recargo (%): ', 5, 30);

                tarifas.push({
                    nombre: 'Recargo Nocturno',
                    tipo: 'recargo_porcentaje',
                    valor: recargo,
                    condicion_horario_inicio: '22:00',
                    condicion_horario_fin: '06:00',
                    activa: true
                });
            }

            this.configuracion.tarifas = tarifas;
        } else {
            this.configuracion.tarifas = 'default'; // Usar tarifas básicas
        }

        console.log('✅ Configuración de tarifas completada\n');
    }

    /**
     * Configurar administrador del sistema
     */
    async configurarAdministrador() {
        console.log('👤 CONFIGURACIÓN DEL ADMINISTRADOR');
        console.log('-'.repeat(40));

        const username = await this.pregunta('Usuario administrador: ');
        const nombre = await this.pregunta('Nombre completo: ');
        const apellido = await this.pregunta('Apellido: ');
        const email = await this.preguntaEmail('Email del administrador: ');

        let password, passwordConfirm;
        do {
            password = await this.preguntaPassword('Contraseña (mínimo 8 caracteres): ');
            if (password.length < 8) {
                console.log('❌ La contraseña debe tener al menos 8 caracteres');
                continue;
            }
            passwordConfirm = await this.preguntaPassword('Confirmar contraseña: ');
            if (password !== passwordConfirm) {
                console.log('❌ Las contraseñas no coinciden');
            }
        } while (password !== passwordConfirm || password.length < 8);

        this.configuracion.admin = {
            username: username,
            password: password,
            nombre: nombre,
            apellido: apellido,
            email: email
        };

        console.log('✅ Configuración del administrador completada\n');
    }

    /**
     * Mostrar resumen de configuración
     */
    async mostrarResumen() {
        console.log('📋 RESUMEN DE CONFIGURACIÓN');
        console.log('='.repeat(60));
        console.log(`🏪 Restaurante: ${this.configuracion.nombre}`);
        console.log(`📍 Dirección: ${this.configuracion.direccion}`);
        console.log(`📞 Teléfono: ${this.configuracion.telefono}`);
        console.log(`📧 Email: ${this.configuracion.email}`);
        console.log(`🏷️ Tipo: ${this.configuracion.tipo}`);
        console.log(`🍽️ Mesas: ${this.configuracion.mesas.cantidad} mesas (capacidad promedio: ${this.configuracion.mesas.capacidad_default})`);
        console.log(`📦 Productos: ${Array.isArray(this.configuracion.productos) ? this.configuracion.productos.length + ' personalizados' : 'Por defecto según tipo'}`);
        console.log(`🍳 Cocina: ${Array.isArray(this.configuracion.cocina) ? this.configuracion.cocina.length + ' estaciones' : 'Configuración por defecto'}`);
        console.log(`💰 Tarifas: ${Array.isArray(this.configuracion.tarifas) ? this.configuracion.tarifas.length + ' tarifas especiales' : 'Tarifas básicas'}`);
        console.log(`👤 Administrador: ${this.configuracion.admin.username} (${this.configuracion.admin.email})`);
        console.log('='.repeat(60));
    }

    /**
     * Aplicar configuración al sistema
     */
    async aplicarConfiguracion() {
        console.log('\n🚀 Aplicando configuración al sistema...');

        try {
            // Llamar a la API de configuración inicial
            const response = await axios.post(`${this.baseURL}/api/configuracion/configurar`, this.configuracion, {
                timeout: 60000 // 60 segundos para configuración completa
            });

            if (response.data && response.data.success) {
                console.log('✅ Configuración aplicada exitosamente');

                // Guardar configuración localmente
                await this.guardarConfiguracionLocal();

                return response.data;
            } else {
                throw new Error(response.data?.error || 'Error desconocido en la configuración');
            }

        } catch (error) {
            if (error.response && error.response.data) {
                throw new Error(`Error del servidor: ${error.response.data.error}`);
            }
            throw error;
        }
    }

    /**
     * Guardar configuración localmente
     */
    async guardarConfiguracionLocal() {
        try {
            const configDir = path.join(__dirname, '..', 'config');
            const configFile = path.join(configDir, 'restaurante_configurado.json');

            const configData = {
                ...this.configuracion,
                fecha_configuracion: new Date().toISOString(),
                version: '2.0.14'
            };

            // No guardar la contraseña en el archivo
            delete configData.admin.password;

            await fs.writeFile(configFile, JSON.stringify(configData, null, 2));
            console.log(`💾 Configuración guardada en: ${configFile}`);

        } catch (error) {
            console.warn('⚠️ No se pudo guardar la configuración localmente:', error.message);
        }
    }

    /**
     * Mostrar resultado final
     */
    async mostrarResultadoFinal() {
        console.log('\n' + '='.repeat(60));
        console.log('🎉 ¡CONFIGURACIÓN COMPLETADA EXITOSAMENTE!');
        console.log('='.repeat(60));
        console.log('');
        console.log('🏪 Su restaurante está ahora completamente configurado');
        console.log('');
        console.log('📱 PRÓXIMOS PASOS:');
        console.log('   1. Acceda al panel de administración:');
        console.log(`      ${this.baseURL}`);
        console.log('   2. Inicie sesión con las credenciales del administrador');
        console.log('   3. Personalice el mapa visual de mesas si es necesario');
        console.log('   4. Agregue más productos y categorías');
        console.log('   5. Configure garzones y personal');
        console.log('');
        console.log('🔗 ENLACES ÚTILES:');
        console.log(`   • Panel principal: ${this.baseURL}`);
        console.log(`   • Estado del sistema: ${this.baseURL}/health`);
        console.log(`   • Configuración: ${this.baseURL}/api/configuracion/estado`);
        console.log(`   • Mapa visual: ${this.baseURL}/api/mapa-visual/estado-completo`);
        console.log('');
        console.log('💡 CONSEJOS:');
        console.log('   • Configure backups regulares');
        console.log('   • Revise los logs del sistema periódicamente');
        console.log('   • Mantenga el sistema actualizado');
        console.log('   • Configure HTTPS para mayor seguridad');
        console.log('');
        console.log('📞 SOPORTE:');
        console.log('   • Documentación: Ver carpeta /docs');
        console.log('   • Logs: Ver carpeta /logs');
        console.log('   • Configuración: Ver carpeta /config');
        console.log('');
        console.log('✅ ¡Su sistema DYSA Point POS está listo para funcionar!');
        console.log('='.repeat(60));
    }

    /**
     * Hacer pregunta simple
     */
    pregunta(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    /**
     * Pregunta con validación de email
     */
    async preguntaEmail(prompt) {
        let email;
        do {
            email = await this.pregunta(prompt);
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                console.log('❌ Email inválido. Por favor ingrese un email válido.');
            }
        } while (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
        return email;
    }

    /**
     * Pregunta con validación de número
     */
    async preguntaNumero(prompt, min, max) {
        let numero;
        do {
            const input = await this.pregunta(prompt);
            numero = parseInt(input);
            if (isNaN(numero) || numero < min || numero > max) {
                console.log(`❌ Número inválido. Ingrese un número entre ${min} y ${max}.`);
            }
        } while (isNaN(numero) || numero < min || numero > max);
        return numero;
    }

    /**
     * Pregunta para contraseña (sin mostrar en pantalla)
     */
    preguntaPassword(prompt) {
        return new Promise((resolve) => {
            process.stdout.write(prompt);
            process.stdin.setRawMode(true);
            process.stdin.resume();
            process.stdin.setEncoding('utf8');

            let password = '';

            const onData = (char) => {
                switch (char) {
                    case '\n':
                    case '\r':
                    case '\u0004': // Ctrl+D
                        process.stdin.setRawMode(false);
                        process.stdin.pause();
                        process.stdin.removeListener('data', onData);
                        process.stdout.write('\n');
                        resolve(password);
                        break;
                    case '\u0003': // Ctrl+C
                        process.exit();
                        break;
                    case '\u007f': // Backspace
                        if (password.length > 0) {
                            password = password.slice(0, -1);
                            process.stdout.write('\b \b');
                        }
                        break;
                    default:
                        password += char;
                        process.stdout.write('*');
                        break;
                }
            };

            process.stdin.on('data', onData);
        });
    }
}

// Ejecutar configurador si se llama directamente
if (require.main === module) {
    const configurador = new ConfiguradorRestaurante();
    configurador.ejecutarConfiguracion();
}

module.exports = ConfiguradorRestaurante;