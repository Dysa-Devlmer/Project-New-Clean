/**
 * DYSA Point Server - Refactorizado para usar app.js
 * Servidor HTTP que usa la aplicación Express desde app.js
 * Fecha: 19 de Octubre 2025
 */

const http = require('http');
const app = require('./app'); // ⬅️ usa app.js
const { testConnection } = require('./config/database');

// Header para identificar instancia en pruebas
app.use((req, res, next) => {
    res.set('X-App', 'dysa-backend');
    next();
});

// Configuración del puerto
const PORT = process.env.PORT || 8547;

// Función para iniciar el servidor
async function iniciarServidor() {
    try {
        // Verificar conexión a base de datos
        console.log('\n🔍 Verificando conexión a base de datos...');
        const dbConnected = await testConnection();

        if (!dbConnected) {
            console.error('\n⚠️  ADVERTENCIA: No se pudo conectar a la base de datos');
            console.error('   El servidor iniciará pero no funcionará correctamente');
            console.error('   Verifique la configuración en el archivo .env\n');
        }

        // Crear servidor HTTP
        const server = http.createServer(app);

        // Iniciar servidor
        server.listen(PORT, '0.0.0.0', () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 SERVIDOR DYSA POINT ENTERPRISE INICIADO - PRODUCCIÓN');
            console.log('='.repeat(60));
            console.log(`   Puerto: ${PORT} ← IMPORTANTE: PUERTO ACTIVO`);
            console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   Base de datos: ${process.env.DB_NAME || 'dysa_point'}`);
            console.log('\n📡 Acceso desde red local:');
            console.log(`   http://localhost:${PORT}`);
            console.log(`   http://192.168.1.X:${PORT} (reemplazar X con IP real)`);
            console.log('\n📋 Endpoints principales:');
            console.log(`   GET  /health - Estado del servidor`);
            console.log(`   GET  /setup - Asistente de instalación`);
            console.log(`   GET  /config/red - Configuración de red`);
            console.log(`   GET  /api/sistema/health - Health check extendido`);
            console.log('='.repeat(60) + '\n');

            // Log específico del puerto para debug
            console.log(`🚀 Backend escuchando en http://localhost:${PORT}`);
        });

        // Guardar referencia del servidor para reinicio controlado
        app.set('http-server', server);
        app.set('http-port', PORT);
        app.set('http-host', '0.0.0.0');

    } catch (error) {
        console.error('❌ Error al iniciar servidor:', error);
        process.exit(1);
    }
}

// Manejo de señales de cierre
process.on('SIGTERM', () => {
    console.log('\n⚠️  Señal SIGTERM recibida. Cerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n\n⚠️  Señal SIGINT recibida. Cerrando servidor...');
    process.exit(0);
});

// Exportar aplicación para reinicio controlado
module.exports = { server: app };

// Iniciar servidor
iniciarServidor();