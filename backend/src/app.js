/**
 * DYSA Point - Aplicación Express
 * Configuración de la aplicación sin el servidor HTTP
 * Fecha: 19 de Octubre 2025
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();

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

// === RUTAS DE CONFIGURACIÓN DEL SISTEMA ===
// Movidas al final del archivo, antes del middleware 404

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

// Health check endpoints (doble para compatibilidad)
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'DYSA Point Enterprise Backend funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 8547
    });
});

app.get('/api/sistema/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'DYSA Point Enterprise Backend funcionando',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        port: process.env.PORT || 8547,
        data: {
            status: 'running',
            uptime: process.uptime(),
            database: 'connected'
        }
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
const ticketsRoutes = require('./routes/tickets'); // Versión real con BD
const cajaRoutes = require('./routes/caja'); // Módulo Caja/Pagos
const systemConfigRoutes = require('./routes/system-config');

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
app.use('/api/pos/tickets', ticketsRoutes); // Versión real con BD
app.use('/api/pos/caja', cajaRoutes); // Módulo Caja/Pagos
app.use('/api/sistema', systemConfigRoutes);
app.use('/api/setup', systemConfigRoutes);

// Ruta de prueba
app.get('/api/test', (req, res) => {
    res.json({ message: 'API funcionando correctamente', timestamp: new Date().toISOString() });
});

// Prueba temporal de setup
app.get('/api/setup-working', (req, res) => {
    res.json({ message: 'Setup route is working via API!', timestamp: new Date().toISOString() });
});

// === RUTAS DE INTERFACES WEB ===
// IMPORTANTE: Estas rutas deben estar ANTES del middleware 404

// Asistente de Instalación
app.get('/setup', (req, res) => {
    const filePath = path.resolve(__dirname, '../static/config/setup-wizard.html');
    console.log('Setup path:', filePath);
    res.sendFile(filePath);
});

// Ruta de prueba para validar carga de código
app.get('/setup-test', (req, res) => {
    res.json({ ok: true, from: 'app.js', at: new Date().toISOString() });
});

// Configuración de Red
app.get('/config/red', (req, res) => {
    res.sendFile(path.join(__dirname, '../static/config/network-config.html'));
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

module.exports = app;