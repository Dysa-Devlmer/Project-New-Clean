/**
 * DYSA Point Network Configuration
 * Maneja la configuración de red del sistema
 */

class NetworkConfig {
    constructor() {
        this.currentConfig = {};
        this.init();
    }

    init() {
        this.loadCurrentConfiguration();
        this.bindEvents();
    }

    bindEvents() {
        // Validación en tiempo real
        document.getElementById('network-form').addEventListener('input', () => {
            this.validateForm();
        });

        // Eventos de los botones (manejados por onclick en HTML)
        // testConnection() y applyConfiguration() son funciones globales
    }

    async loadCurrentConfiguration() {
        try {
            const response = await fetch('/api/sistema/red');
            const result = await response.json();

            if (result.success) {
                this.currentConfig = result.data;
                this.displayCurrentConfiguration(result.data);
                this.populateForm(result.data);
            } else {
                this.showError('No se pudo cargar la configuración actual');
            }
        } catch (error) {
            console.error('Error loading configuration:', error);
            this.showError('Error de conexión al cargar la configuración');
        }
    }

    displayCurrentConfiguration(config) {
        const loading = document.querySelector('#current-status .loading');
        const content = document.getElementById('status-content');

        loading.classList.remove('active');
        content.style.display = 'block';

        const protocol = config.ssl_activo ? 'https' : 'http';
        const serverUrl = `${protocol}://${config.host_principal}:${config.puerto_api}`;

        content.innerHTML = `
            <div class="config-item">
                <span class="config-label">Estado del Servidor:</span>
                <span class="status-badge status-online">🟢 Online</span>
            </div>
            <div class="config-item">
                <span class="config-label">URL del Servidor:</span>
                <span class="config-value">${serverUrl}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Host Principal:</span>
                <span class="config-value">${config.host_principal}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Puerto API:</span>
                <span class="config-value">${config.puerto_api}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Puerto Eventos:</span>
                <span class="config-value">${config.puerto_events || 'No configurado'}</span>
            </div>
            <div class="config-item">
                <span class="config-label">SSL/HTTPS:</span>
                <span class="config-value">${config.ssl_activo ? '🔒 Activo' : '🔓 Inactivo'}</span>
            </div>
            <div class="config-item">
                <span class="config-label">Timeout:</span>
                <span class="config-value">${config.timeout_conexion || 30} segundos</span>
            </div>
            <div class="config-item">
                <span class="config-label">Última Actualización:</span>
                <span class="config-value">${new Date(config.ultima_actualizacion).toLocaleString()}</span>
            </div>
        `;
    }

    populateForm(config) {
        // Llenar los campos del formulario con la configuración actual
        document.getElementById('host_principal').value = config.host_principal || 'localhost';
        document.getElementById('puerto_api').value = config.puerto_api || 8547;
        document.getElementById('puerto_events').value = config.puerto_events || 8549;
        document.getElementById('ssl_activo').value = config.ssl_activo ? 'true' : 'false';
        document.getElementById('timeout_conexion').value = config.timeout_conexion || 30;
        document.getElementById('max_clients_sse').value = config.max_clients_sse || 50;
        document.getElementById('auto_discovery').value = config.auto_discovery ? 'true' : 'false';
    }

    validateForm() {
        const form = document.getElementById('network-form');
        const formData = new FormData(form);
        let isValid = true;
        const errors = [];

        // Validar host
        const host = formData.get('host_principal');
        if (!host || host.trim() === '') {
            errors.push('Host principal es requerido');
            isValid = false;
        }

        // Validar puerto API
        const puertoApi = parseInt(formData.get('puerto_api'));
        if (!puertoApi || puertoApi < 1024 || puertoApi > 65535) {
            errors.push('Puerto API debe estar entre 1024 y 65535');
            isValid = false;
        }

        // Validar puerto eventos
        const puertoEvents = parseInt(formData.get('puerto_events'));
        if (puertoEvents && (puertoEvents < 1024 || puertoEvents > 65535)) {
            errors.push('Puerto de eventos debe estar entre 1024 y 65535');
            isValid = false;
        }

        // Verificar que los puertos no sean iguales
        if (puertoApi && puertoEvents && puertoApi === puertoEvents) {
            errors.push('Los puertos API y eventos deben ser diferentes');
            isValid = false;
        }

        // Actualizar botones
        const btnTest = document.getElementById('btn-test');
        const btnApply = document.getElementById('btn-apply');

        btnTest.disabled = !isValid;
        btnApply.disabled = !isValid;

        return { isValid, errors };
    }

    getFormData() {
        const form = document.getElementById('network-form');
        const formData = new FormData(form);

        return {
            host_principal: formData.get('host_principal').trim(),
            puerto_api: parseInt(formData.get('puerto_api')),
            puerto_events: parseInt(formData.get('puerto_events')) || null,
            ssl_activo: formData.get('ssl_activo') === 'true',
            timeout_conexion: parseInt(formData.get('timeout_conexion')),
            max_clients_sse: parseInt(formData.get('max_clients_sse')),
            auto_discovery: formData.get('auto_discovery') === 'true'
        };
    }

    showAlert(message, type = 'info') {
        const container = document.getElementById('alerts-container');
        const alertId = 'alert-' + Date.now();

        const alertHtml = `
            <div id="${alertId}" class="alert alert-${type}">
                ${message}
            </div>
        `;

        container.innerHTML = alertHtml;

        // Auto-remover después de 5 segundos
        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }

    showError(message) {
        this.showAlert(message, 'danger');
    }

    showSuccess(message) {
        this.showAlert(message, 'success');
    }

    showWarning(message) {
        this.showAlert(message, 'warning');
    }

    showConnectionTestResults(results) {
        const testDiv = document.getElementById('connection-test');
        const resultsDiv = document.getElementById('test-results');

        testDiv.classList.add('active');

        if (results.success) {
            resultsDiv.innerHTML = `
                <div class="alert alert-success">
                    <h5>✅ Conexión Exitosa</h5>
                    <p><strong>Servidor:</strong> ${results.url}</p>
                    <p><strong>Tiempo de respuesta:</strong> ${results.responseTime}ms</p>
                    <p><strong>Estado:</strong> ${results.status}</p>
                </div>
            `;
        } else {
            resultsDiv.innerHTML = `
                <div class="alert alert-danger">
                    <h5>❌ Error de Conexión</h5>
                    <p><strong>Error:</strong> ${results.error}</p>
                    <p><strong>URL probada:</strong> ${results.url}</p>
                    <p>Verifica que la configuración sea correcta y que no haya firewall bloqueando la conexión.</p>
                </div>
            `;
        }
    }

    async performConnectionTest(config) {
        const startTime = Date.now();
        const protocol = config.ssl_activo ? 'https' : 'http';
        const testUrl = `${protocol}://${config.host_principal}:${config.puerto_api}/api/sistema/health`;

        try {
            const response = await fetch('/api/sistema/red/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();
            const responseTime = Date.now() - startTime;

            if (result.success) {
                return {
                    success: true,
                    url: testUrl,
                    responseTime: responseTime,
                    status: 'Servidor accesible'
                };
            } else {
                return {
                    success: false,
                    url: testUrl,
                    error: result.message || 'Error desconocido'
                };
            }
        } catch (error) {
            return {
                success: false,
                url: testUrl,
                error: error.message || 'Error de red'
            };
        }
    }

    async applyNetworkConfiguration(config) {
        try {
            const response = await fetch('/api/sistema/red', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(config)
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Configuración aplicada exitosamente. El servidor se está reiniciando...');

                if (result.restart_required) {
                    this.showRestartProgress(config);
                }

                return { success: true, data: result.data };
            } else {
                this.showError('Error al aplicar configuración: ' + (result.message || 'Error desconocido'));
                return { success: false, error: result.message };
            }
        } catch (error) {
            this.showError('Error de conexión al aplicar configuración: ' + error.message);
            return { success: false, error: error.message };
        }
    }

    showRestartProgress(newConfig) {
        const container = document.getElementById('alerts-container');
        container.innerHTML = `
            <div class="alert alert-info">
                <h5>🔄 Reiniciando Servidor...</h5>
                <p>El servidor se está reiniciando con la nueva configuración.</p>
                <div class="loading active">
                    <div class="spinner"></div>
                    <p>Esto puede tomar unos segundos...</p>
                </div>
            </div>
        `;

        // Intentar reconectar después del reinicio
        this.waitForServerRestart(newConfig);
    }

    async waitForServerRestart(newConfig) {
        const protocol = newConfig.ssl_activo ? 'https' : 'http';
        const newUrl = `${protocol}://${newConfig.host_principal}:${newConfig.puerto_api}/api/sistema/health`;

        let attempts = 0;
        const maxAttempts = 30; // 30 segundos máximo

        const checkServer = async () => {
            try {
                attempts++;

                const response = await fetch(newUrl);
                if (response.ok) {
                    // Servidor reiniciado exitosamente
                    this.showSuccess('🎉 ¡Servidor reiniciado exitosamente! La nueva configuración está activa.');

                    // Si el puerto cambió, redirigir a la nueva URL
                    if (newConfig.puerto_api !== window.location.port) {
                        setTimeout(() => {
                            const newLocation = `${protocol}://${newConfig.host_principal}:${newConfig.puerto_api}/config/red`;
                            this.showAlert('Redirigiendo a la nueva URL...', 'info');
                            setTimeout(() => {
                                window.location.href = newLocation;
                            }, 2000);
                        }, 2000);
                    } else {
                        // Recargar configuración
                        setTimeout(() => {
                            window.location.reload();
                        }, 2000);
                    }
                    return;
                }
            } catch (error) {
                // Esperado durante el reinicio
            }

            if (attempts < maxAttempts) {
                setTimeout(checkServer, 1000); // Reintentar en 1 segundo
            } else {
                this.showError('⚠️ No se pudo conectar al servidor después del reinicio. Verifica manualmente la configuración.');
            }
        };

        // Esperar 3 segundos antes del primer intento
        setTimeout(checkServer, 3000);
    }
}

// Instancia global
let networkConfig;

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    networkConfig = new NetworkConfig();
});

// Funciones globales para los botones
async function testConnection() {
    const validation = networkConfig.validateForm();

    if (!validation.isValid) {
        networkConfig.showError('Corrige los errores en el formulario antes de probar la conexión');
        return;
    }

    const btnTest = document.getElementById('btn-test');
    btnTest.disabled = true;
    btnTest.textContent = '🧪 Probando...';

    const config = networkConfig.getFormData();

    try {
        const results = await networkConfig.performConnectionTest(config);
        networkConfig.showConnectionTestResults(results);
    } catch (error) {
        networkConfig.showError('Error al probar la conexión: ' + error.message);
    } finally {
        btnTest.disabled = false;
        btnTest.textContent = '🧪 Probar Conexión';
    }
}

async function applyConfiguration() {
    const validation = networkConfig.validateForm();

    if (!validation.isValid) {
        networkConfig.showError('Corrige los errores en el formulario antes de aplicar la configuración');
        return;
    }

    // Confirmar con el usuario
    const config = networkConfig.getFormData();
    const protocol = config.ssl_activo ? 'https' : 'http';
    const newUrl = `${protocol}://${config.host_principal}:${config.puerto_api}`;

    const confirmed = confirm(
        `¿Estás seguro de aplicar esta configuración?\n\n` +
        `Nueva URL: ${newUrl}\n` +
        `SSL: ${config.ssl_activo ? 'Activado' : 'Desactivado'}\n\n` +
        `El servidor se reiniciará automáticamente.`
    );

    if (!confirmed) {
        return;
    }

    const btnApply = document.getElementById('btn-apply');
    btnApply.disabled = true;
    btnApply.textContent = '🔄 Aplicando...';

    try {
        const result = await networkConfig.applyNetworkConfiguration(config);

        if (!result.success) {
            btnApply.disabled = false;
            btnApply.textContent = '🔄 Aplicar y Reiniciar';
        }
    } catch (error) {
        networkConfig.showError('Error inesperado: ' + error.message);
        btnApply.disabled = false;
        btnApply.textContent = '🔄 Aplicar y Reiniciar';
    }
}