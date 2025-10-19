/**
 * SYSME Backend Server - Sistema POS para Restaurante
 * Servidor Express con todas las funcionalidades del sistema antiguo
 * Fecha: 18 de Octubre 2025
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const { testConnection } = require('./config/database');

const app = express();
const PORT = process.env.PORT || 8547; // Puerto estándar del sistema

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Servir archivos estáticos del sistema POS
app.use('/static', express.static(path.join(__dirname, '../static')));

// === RUTAS DE INTERFACES DE USUARIO ===

// Terminal de Mesero
app.get('/terminal', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/terminal/waiter-interface-v2.html'));
});

// Panel POS Principal
app.get('/pos', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/terminal/pos-panel.html'));
});

// Panel de Cajera
app.get('/cajera', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/cajera/dashboard-cajera.html'));
});

// Panel de Cocina
app.get('/cocina', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/cocina/panel-cocina.html'));
});

// Panel de Administración
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/admin/dashboard-admin.html'));
});

// Gestión de Productos
app.get('/productos', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/productos/gestion-productos.html'));
});

// Gestión de Clientes
app.get('/clientes', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/clientes/gestion-clientes.html'));
});

// Reportes
app.get('/reportes', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/reportes/dashboard-reportes.html'));
});

// Configuración
app.get('/configuracion', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/configuracion/panel-configuracion.html'));
});

// Ruta principal - redirige al login del terminal
app.get('/', (req, res) => {
    res.redirect('/terminal');
});

// Logging de requests
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'DYSA Point Enterprise Backend funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// Importar rutas
const authRoutes = require('./routes/auth');
const productosRoutes = require('./routes/productos');
const ventasRoutes = require('./routes/ventas');
const mesasRoutes = require('./routes/mesas');
const cocinaRoutes = require('./routes/cocina');
const clientesRoutes = require('./routes/clientes');
const reportesRoutes = require('./routes/reportes');
const configuracionRoutes = require('./routes/configuracion');
const { router: eventsRoutes } = require('./routes/events');
const ticketsRoutes = require('./routes/tickets'); // Nueva ruta de tickets
const systemConfigRoutes = require('./routes/system-config'); // Configuración del sistema

// Montar rutas principales del POS
app.use('/api/auth', authRoutes);
app.use('/api/productos', productosRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/mesas', mesasRoutes);
app.use('/api/cocina', cocinaRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/reportes', reportesRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/pos/tickets', ticketsRoutes); // Tickets/POS con sincronización SSE
app.use('/api/sistema', systemConfigRoutes); // Configuración de sistema y red
app.use('/api/setup', systemConfigRoutes); // Asistente de instalación

// Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando correctamente', timestamp: new Date().toISOString() });
});

// Manejo de errores 404
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Ruta no encontrada'
    });
});

// Manejo global de errores
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Error interno del servidor',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Iniciar servidor
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

        // Iniciar servidor HTTP con referencia para reinicio controlado
        const server = app.listen(PORT, '0.0.0.0', () => {
            console.log('\n' + '='.repeat(60));
            console.log('🚀 SERVIDOR DYSA POINT ENTERPRISE INICIADO - PRODUCCIÓN');
            console.log('='.repeat(60));
            console.log(`   Puerto: ${PORT}`);
            console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
            console.log(`   Base de datos: ${process.env.DB_NAME || 'dysa_point'}`);
            console.log('\n📡 Acceso desde red local:');
            console.log(`   http://localhost:${PORT}`);
            console.log(`   http://192.168.1.X:${PORT} (reemplazar X con IP real)`);
            console.log('\n📋 Endpoints disponibles:');
            console.log(`   GET  /health - Estado del servidor`);
            console.log(`   GET  /api/mesas - Listar mesas`);
            console.log(`   GET  /api/mesas/estado - Estado de mesas`);
            console.log(`   GET  /api/categorias - Categorías de productos`);
            console.log(`   GET  /api/productos - Todos los productos`);
            console.log(`   POST /api/pedidos - Crear pedido`);
            console.log(`   POST /api/pedidos/enviar-cocina - Enviar a cocina`);
            console.log('='.repeat(60) + '\n');
        });

        // Guardar referencia del servidor en la aplicación para reinicio controlado
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
module.exports = app;

// Iniciar
iniciarServidor();
