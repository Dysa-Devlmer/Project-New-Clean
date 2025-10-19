/**
 * DYSA Point - Utilidad de Reinicio Controlado del Servidor
 * Reinicia el servidor HTTP sin matar el proceso Node.js/agente
 * Fecha: 19 de Octubre 2025
 */

const http = require('http');

/**
 * Reiniciar servidor HTTP con nueva configuración de red
 * @param {Object} app - Aplicación Express
 * @param {Object} newConfig - Nueva configuración de red (opcional)
 */
async function rebootServer(app, newConfig = null) {
  try {
    console.log('🔄 Iniciando reinicio controlado del servidor HTTP...');

    // Si no se proporciona configuración, obtenerla de la BD
    if (!newConfig) {
      const SystemConfigService = require('../services/system-config.service');
      const configService = new SystemConfigService();
      newConfig = await configService.getNetworkConfig();
    }

    const newPort = newConfig.puerto_api || 8547;
    const newHost = newConfig.host_principal || 'localhost';

    console.log(`📡 Nueva configuración: ${newHost}:${newPort}`);

    // Obtener servidor HTTP actual
    const currentServer = app.get('http-server');

    if (!currentServer) {
      console.log('⚠️ No hay servidor HTTP previo. Creando nuevo servidor...');
      return createNewServer(app, newPort, newHost);
    }

    // Cerrar servidor actual de forma elegante
    return new Promise((resolve, reject) => {
      console.log('🛑 Cerrando servidor HTTP actual...');

      currentServer.close((error) => {
        if (error) {
          console.error('❌ Error al cerrar servidor:', error);
          return reject(error);
        }

        console.log('✅ Servidor HTTP cerrado exitosamente');

        // Dar un momento para que las conexiones se liberen
        setTimeout(() => {
          createNewServer(app, newPort, newHost)
            .then(resolve)
            .catch(reject);
        }, 500);
      });

      // Timeout de seguridad por si el cierre se cuelga
      setTimeout(() => {
        console.log('⏰ Timeout alcanzado. Forzando creación de nuevo servidor...');
        createNewServer(app, newPort, newHost)
          .then(resolve)
          .catch(reject);
      }, 3000);
    });

  } catch (error) {
    console.error('❌ Error crítico en reinicio controlado:', error);
    throw error;
  }
}

/**
 * Crear nuevo servidor HTTP
 * @param {Object} app - Aplicación Express
 * @param {number} port - Puerto para el nuevo servidor
 * @param {string} host - Host para el nuevo servidor
 */
function createNewServer(app, port, host = 'localhost') {
  return new Promise((resolve, reject) => {
    try {
      console.log(`🚀 Creando nuevo servidor HTTP en ${host}:${port}...`);

      const newServer = http.createServer(app);

      newServer.on('error', (error) => {
        console.error(`❌ Error al iniciar servidor en puerto ${port}:`, error);

        if (error.code === 'EADDRINUSE') {
          console.log(`⚠️ Puerto ${port} ocupado. Intentando puerto alternativo...`);

          // Intentar con puerto alternativo
          const alternativePort = port + 1;
          createNewServer(app, alternativePort, host)
            .then(resolve)
            .catch(reject);
        } else {
          reject(error);
        }
      });

      newServer.on('listening', () => {
        console.log('');
        console.log('============================================================');
        console.log('🚀 SERVIDOR REINICIADO EXITOSAMENTE');
        console.log('============================================================');
        console.log(`   Host: ${host}`);
        console.log(`   Puerto: ${port}`);
        console.log(`   Proceso PID: ${process.pid}`);
        console.log(`   Uptime: ${process.uptime().toFixed(2)}s`);
        console.log('');
        console.log('📡 URLs de acceso:');
        console.log(`   Local:    http://localhost:${port}`);
        if (host !== 'localhost') {
          console.log(`   Red:      http://${host}:${port}`);
        }
        console.log('');
        console.log('📋 Endpoints principales:');
        console.log(`   Health:   http://${host}:${port}/health`);
        console.log(`   API:      http://${host}:${port}/api/`);
        console.log(`   Config:   http://${host}:${port}/api/sistema/info`);
        console.log('============================================================');
        console.log('');

        // Actualizar referencias en la aplicación
        app.set('http-server', newServer);
        app.set('http-port', port);
        app.set('http-host', host);

        resolve({
          success: true,
          server: newServer,
          host: host,
          port: port,
          uptime: process.uptime()
        });
      });

      // Iniciar servidor
      newServer.listen(port, () => {
        // El evento 'listening' manejará la respuesta
      });

    } catch (error) {
      console.error(`❌ Error al crear servidor en ${host}:${port}:`, error);
      reject(error);
    }
  });
}

/**
 * Reinicio programado (usado desde rutas)
 * @param {Object} app - Aplicación Express
 * @param {Object} newConfig - Nueva configuración
 * @param {number} delay - Retraso en milisegundos (por defecto 1000ms)
 */
function scheduleReboot(app, newConfig, delay = 1000) {
  console.log(`⏰ Reinicio programado en ${delay}ms...`);

  setTimeout(async () => {
    try {
      await rebootServer(app, newConfig);
      console.log('✅ Reinicio programado completado');
    } catch (error) {
      console.error('❌ Error en reinicio programado:', error);

      // Fallback: intentar con configuración por defecto
      console.log('🔧 Intentando reinicio con configuración por defecto...');
      try {
        await rebootServer(app, {
          puerto_api: 8547,
          host_principal: 'localhost'
        });
        console.log('✅ Reinicio de emergencia completado');
      } catch (fallbackError) {
        console.error('❌ Error crítico en reinicio de emergencia:', fallbackError);
      }
    }
  }, delay);

  return true;
}

/**
 * Obtener información del servidor actual
 * @param {Object} app - Aplicación Express
 */
function getCurrentServerInfo(app) {
  const server = app.get('http-server');
  const port = app.get('http-port') || 8547;
  const host = app.get('http-host') || 'localhost';

  return {
    hasServer: !!server,
    isListening: server ? server.listening : false,
    port: port,
    host: host,
    pid: process.pid,
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };
}

module.exports = {
  rebootServer,
  createNewServer,
  scheduleReboot,
  getCurrentServerInfo
};