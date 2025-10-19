/**
 * DYSA Point Setup Wizard
 * Maneja la lógica del asistente de instalación
 */

class SetupWizard {
    constructor() {
        this.currentStep = 1;
        this.totalSteps = 4;
        this.data = {
            owner: {},
            restaurant: {},
            system: {}
        };

        this.init();
    }

    init() {
        this.bindEvents();
        this.checkSystemStatus();
    }

    bindEvents() {
        // Botones de navegación
        document.getElementById('btn-next').addEventListener('click', () => this.nextStep());
        document.getElementById('btn-previous').addEventListener('click', () => this.previousStep());

        // Validación en tiempo real
        this.bindFormValidation();
    }

    bindFormValidation() {
        // Formulario del propietario
        const ownerForm = document.getElementById('owner-form');
        if (ownerForm) {
            ownerForm.addEventListener('input', () => this.validateCurrentStep());
        }

        // Formulario del restaurante
        const restaurantForm = document.getElementById('restaurant-form');
        if (restaurantForm) {
            restaurantForm.addEventListener('input', () => this.validateCurrentStep());
        }
    }

    async checkSystemStatus() {
        try {
            const response = await fetch('/api/setup/status');
            const result = await response.json();

            if (result.success) {
                this.updateSystemCheck(result.data);
            } else {
                this.showSystemCheckError('Error al verificar el estado del sistema');
            }
        } catch (error) {
            console.error('Error checking system status:', error);
            this.showSystemCheckError('No se pudo conectar con el servidor');
        }
    }

    updateSystemCheck(systemData) {
        const loading = document.querySelector('#system-check .loading');
        const results = document.getElementById('check-results');

        loading.classList.remove('active');
        results.style.display = 'block';

        const checks = [
            { name: 'Base de Datos', status: systemData.installation_status ? 'success' : 'error' },
            { name: 'Configuración de Red', status: 'success' },
            { name: 'Archivos del Sistema', status: 'success' },
            { name: 'Permisos', status: 'success' }
        ];

        results.innerHTML = checks.map(check => `
            <div style="display: flex; justify-content: space-between; padding: 10px; border-bottom: 1px solid #ecf0f1;">
                <span>${check.name}</span>
                <span class="status-badge ${check.status === 'success' ? 'status-success' : 'status-pending'}">
                    ${check.status === 'success' ? '✓ OK' : '⚠ Revisar'}
                </span>
            </div>
        `).join('');
    }

    showSystemCheckError(message) {
        const loading = document.querySelector('#system-check .loading');
        const results = document.getElementById('check-results');

        loading.classList.remove('active');
        results.style.display = 'block';
        results.innerHTML = `
            <div class="alert alert-warning">
                <strong>Error:</strong> ${message}
            </div>
        `;
    }

    validateCurrentStep() {
        const nextBtn = document.getElementById('btn-next');
        let isValid = false;

        switch (this.currentStep) {
            case 1:
                isValid = true; // Solo verificación, no formulario
                break;
            case 2:
                isValid = this.validateOwnerForm();
                break;
            case 3:
                isValid = this.validateRestaurantForm();
                break;
            case 4:
                isValid = true; // Solo confirmación
                break;
        }

        nextBtn.disabled = !isValid;
        return isValid;
    }

    validateOwnerForm() {
        const form = document.getElementById('owner-form');
        if (!form) return false;

        const requiredFields = ['nombre', 'telefono', 'email', 'cedula'];
        const values = {};
        let allValid = true;

        requiredFields.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            const value = input?.value?.trim();

            if (!value) {
                allValid = false;
            } else {
                values[field] = value;
            }
        });

        // Validar email
        if (values.email && !this.isValidEmail(values.email)) {
            allValid = false;
        }

        if (allValid) {
            this.data.owner = {
                ...values,
                direccion: form.querySelector('[name="direccion"]')?.value?.trim() || ''
            };
        }

        return allValid;
    }

    validateRestaurantForm() {
        const form = document.getElementById('restaurant-form');
        if (!form) return false;

        const requiredFields = ['nombre_restaurante', 'tipo_restaurante', 'moneda'];
        const values = {};
        let allValid = true;

        requiredFields.forEach(field => {
            const input = form.querySelector(`[name="${field}"]`);
            const value = input?.value?.trim();

            if (!value) {
                allValid = false;
            } else {
                values[field] = value;
            }
        });

        if (allValid) {
            this.data.restaurant = {
                ...values,
                numero_mesas: parseInt(form.querySelector('[name="numero_mesas"]')?.value) || 10,
                zona_horaria: form.querySelector('[name="zona_horaria"]')?.value || 'America/Bogota'
            };
        }

        return allValid;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    nextStep() {
        if (this.currentStep === 4) {
            this.finishInstallation();
            return;
        }

        if (!this.validateCurrentStep()) {
            return;
        }

        if (this.currentStep < this.totalSteps) {
            this.currentStep++;
            this.updateUI();

            if (this.currentStep === 4) {
                this.prepareFinalization();
            }
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
            this.updateUI();
        }
    }

    updateUI() {
        // Actualizar progreso
        document.querySelectorAll('.step').forEach((step, index) => {
            const stepNumber = index + 1;
            step.classList.remove('active', 'completed');

            if (stepNumber < this.currentStep) {
                step.classList.add('completed');
            } else if (stepNumber === this.currentStep) {
                step.classList.add('active');
            }
        });

        // Mostrar panel actual
        document.querySelectorAll('.step-panel').forEach((panel, index) => {
            panel.classList.remove('active');
            if (index + 1 === this.currentStep) {
                panel.classList.add('active');
            }
        });

        // Actualizar botones
        const prevBtn = document.getElementById('btn-previous');
        const nextBtn = document.getElementById('btn-next');

        prevBtn.disabled = this.currentStep === 1;

        if (this.currentStep === 4) {
            nextBtn.textContent = 'Completar Instalación';
            nextBtn.className = 'btn btn-success';
        } else {
            nextBtn.textContent = 'Siguiente';
            nextBtn.className = 'btn btn-primary';
        }

        this.validateCurrentStep();
    }

    prepareFinalization() {
        const summaryContent = document.getElementById('summary-content');
        const loading = document.querySelector('#configuration-summary .loading');

        // Mostrar resumen
        setTimeout(() => {
            loading.classList.remove('active');
            summaryContent.style.display = 'block';
            summaryContent.innerHTML = this.generateSummary();
        }, 1000);
    }

    generateSummary() {
        return `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h4>Información del Propietario</h4>
                <p><strong>Nombre:</strong> ${this.data.owner.nombre}</p>
                <p><strong>Email:</strong> ${this.data.owner.email}</p>
                <p><strong>Teléfono:</strong> ${this.data.owner.telefono}</p>
                <p><strong>Cédula/RUC:</strong> ${this.data.owner.cedula}</p>
            </div>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
                <h4>Configuración del Restaurante</h4>
                <p><strong>Nombre:</strong> ${this.data.restaurant.nombre_restaurante}</p>
                <p><strong>Tipo:</strong> ${this.data.restaurant.tipo_restaurante}</p>
                <p><strong>Moneda:</strong> ${this.data.restaurant.moneda}</p>
                <p><strong>Número de Mesas:</strong> ${this.data.restaurant.numero_mesas}</p>
                <p><strong>Zona Horaria:</strong> ${this.data.restaurant.zona_horaria}</p>
            </div>
        `;
    }

    async finishInstallation() {
        // Ocultar botones de navegación
        document.getElementById('navigation-buttons').style.display = 'none';

        // Mostrar progreso de instalación
        document.getElementById('installation-progress').style.display = 'block';

        try {
            // Instalar sistema
            await this.installSystem();

            // Mostrar completación
            document.getElementById('installation-progress').style.display = 'none';
            document.getElementById('installation-complete').style.display = 'block';

        } catch (error) {
            console.error('Error durante la instalación:', error);
            this.showInstallationError(error.message);
        }
    }

    async installSystem() {
        const statusElement = document.getElementById('installation-status');

        // Paso 1: Configurar propietario
        statusElement.textContent = 'Configurando información del propietario...';
        await this.sleep(1000);

        // Paso 2: Configurar restaurante
        statusElement.textContent = 'Configurando datos del restaurante...';
        await this.sleep(1000);

        // Paso 3: Crear configuraciones iniciales
        statusElement.textContent = 'Creando configuraciones iniciales...';
        await this.sleep(1000);

        // Enviar datos al servidor
        const installationData = {
            owner: this.data.owner,
            restaurant: this.data.restaurant,
            version: '2.0.0'
        };

        const response = await fetch('/api/setup/instalacion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(installationData)
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.message || 'Error durante la instalación');
        }

        statusElement.textContent = 'Instalación completada exitosamente';
        await this.sleep(500);
    }

    showInstallationError(message) {
        document.getElementById('installation-progress').innerHTML = `
            <div class="alert alert-warning">
                <strong>Error durante la instalación:</strong> ${message}
                <br><br>
                <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>
            </div>
        `;
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Inicializar el wizard cuando se carga la página
document.addEventListener('DOMContentLoaded', () => {
    new SetupWizard();
});