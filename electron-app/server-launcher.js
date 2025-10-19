#!/usr/bin/env node

/**
 * 🚀 DYSA Point - Server Launcher
 *
 * Lanzador del servidor integrado con todos los sistemas
 * incluyendo la interfaz web de administración
 */

const path = require('path');
const ServerManager = require('./server/server.js');

async function startServer() {
    console.log('🚀 Iniciando DYSA Point Server con Interfaz Web Admin...\n');

    try {
        // Crear e iniciar el servidor
        const serverManager = new ServerManager(8547);
        await serverManager.start();

        console.log('✅ Servidor iniciado exitosamente');
        console.log('🎛️ Interfaz Web Admin disponible en: http://localhost:8547/admin');
        console.log('📊 Dashboard: http://localhost:8547/admin/dashboard');
        console.log('⚡ API Endpoints: http://localhost:8547/admin/api/');
        console.log('\n🔧 Para detener el servidor, presiona Ctrl+C\n');

        // Manejar cierre graceful
        process.on('SIGINT', async () => {
            console.log('\n🛑 Deteniendo servidor...');
            await serverManager.stop();
            process.exit(0);
        });

        process.on('SIGTERM', async () => {
            console.log('\n🛑 Deteniendo servidor...');
            await serverManager.stop();
            process.exit(0);
        });

        // Mantener el proceso activo
        setInterval(() => {
            // Keep alive
        }, 1000);

    } catch (error) {
        console.error('❌ Error iniciando servidor:', error);
        process.exit(1);
    }
}

// Iniciar servidor
startServer();