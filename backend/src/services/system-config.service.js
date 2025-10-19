/**
 * DYSA Point - Servicio de Configuración del Sistema
 * Lógica de negocio para configuración de red, instalación y empresa
 * Fecha: 19 de Octubre 2025
 */

const SystemConfigRepository = require('../repositories/system-config.repository');
const { ValidationError, BusinessLogicError, NotFoundError } = require('../utils/errors');

class SystemConfigService {
  constructor() {
    this.repository = new SystemConfigRepository();
  }

  // ============================================================================
  // CONFIGURACIÓN DE RED
  // ============================================================================

  /**
   * Obtener configuración de red con valores por defecto
   */
  async getNetworkConfig() {
    try {
      const config = await this.repository.getNetworkConfig();

      // Si no hay configuración, devolver valores por defecto
      if (!config) {
        return {
          host_principal: 'localhost',
          puerto_api: 8547,
          puerto_events: 8548,
          ssl_activo: false,
          timeout_conexion: 30,
          max_clients_sse: 50,
          auto_discovery: true,
          configurado_por: 'sistema_defecto',
          activo: true
        };
      }

      return {
        ...config,
        ssl_activo: Boolean(config.ssl_activo),
        auto_discovery: Boolean(config.auto_discovery),
        activo: Boolean(config.activo)
      };

    } catch (error) {
      throw new Error(`Error al obtener configuración de red: ${error.message}`);
    }
  }

  /**
   * Actualizar configuración de red con validaciones
   */
  async updateNetworkConfig(configData, usuario = 'admin', ipOrigen = null) {
    try {
      // Validaciones
      this._validateNetworkConfig(configData);

      // Verificar que el puerto no esté ocupado (simulado)
      await this._validatePortAvailability(configData.puerto_api);

      const updatedConfig = await this.repository.updateNetworkConfig(configData, usuario);

      // Registrar log adicional
      await this.repository.logConfigChange(
        'RED',
        'sistema_red',
        updatedConfig.id,
        usuario,
        'UPDATE',
        null,
        updatedConfig,
        ipOrigen
      );

      return updatedConfig;

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Error al actualizar configuración de red: ${error.message}`);
    }
  }

  /**
   * Validar configuración de red
   */
  _validateNetworkConfig(config) {
    // Validar host
    if (!config.host_principal || config.host_principal.trim().length === 0) {
      throw new ValidationError('El host principal es requerido', 'host_principal');
    }

    // Validar formato de IP o hostname
    const ipRegex = /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/;
    const hostnameRegex = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/;

    if (config.host_principal !== 'localhost' &&
        !ipRegex.test(config.host_principal) &&
        !hostnameRegex.test(config.host_principal)) {
      throw new ValidationError('Formato de host inválido. Use IP válida o nombre de host', 'host_principal');
    }

    // Validar puerto API
    if (!config.puerto_api || config.puerto_api < 1 || config.puerto_api > 65535) {
      throw new ValidationError('Puerto API debe estar entre 1 y 65535', 'puerto_api');
    }

    // Validar puerto eventos (si se proporciona)
    if (config.puerto_events && (config.puerto_events < 1 || config.puerto_events > 65535)) {
      throw new ValidationError('Puerto de eventos debe estar entre 1 y 65535', 'puerto_events');
    }

    // Validar que los puertos no sean iguales
    if (config.puerto_events && config.puerto_api === config.puerto_events) {
      throw new ValidationError('El puerto de API y eventos no pueden ser iguales', 'puerto_events');
    }

    // Validar puertos reservados del sistema
    const reservedPorts = [22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3306, 5432];
    if (reservedPorts.includes(config.puerto_api)) {
      throw new ValidationError(`Puerto ${config.puerto_api} está reservado para el sistema`, 'puerto_api');
    }
  }

  /**
   * Validar disponibilidad de puerto (simulado)
   */
  async _validatePortAvailability(puerto) {
    // En una implementación real, aquí verificarías si el puerto está disponible
    // Por ahora, simular que los puertos 80, 443, 3306 están ocupados
    const occupiedPorts = [80, 443, 3306, 22, 25];

    if (occupiedPorts.includes(puerto)) {
      throw new BusinessLogicError(`Puerto ${puerto} está ocupado por otro servicio`, 'port_occupied');
    }

    return true;
  }

  // ============================================================================
  // ESTADO DE INSTALACIÓN
  // ============================================================================

  /**
   * Obtener estado de instalación
   */
  async getInstallationStatus() {
    try {
      const status = await this.repository.getInstallationStatus();

      if (!status) {
        // Retornar estado por defecto si no existe
        return {
          instalado: false,
          version_instalada: '2.0.0',
          pasos_completados: {
            duenio: false,
            restaurante: false,
            sucursales: false,
            red: false,
            productos: false,
            usuarios: false
          },
          requiere_actualizacion: false
        };
      }

      // Parsear JSON de pasos completados
      if (typeof status.pasos_completados === 'string') {
        status.pasos_completados = JSON.parse(status.pasos_completados);
      }

      return {
        ...status,
        instalado: Boolean(status.instalado),
        requiere_actualizacion: Boolean(status.requiere_actualizacion)
      };

    } catch (error) {
      throw new Error(`Error al obtener estado de instalación: ${error.message}`);
    }
  }

  /**
   * Completar instalación del sistema
   */
  async completeInstallation(usuario = 'admin') {
    try {
      const statusData = {
        instalado: true,
        version_instalada: '2.0.0',
        pasos_completados: {
          duenio: true,
          restaurante: true,
          sucursales: true,
          red: true,
          productos: true,
          usuarios: true
        },
        requiere_actualizacion: false
      };

      const updatedStatus = await this.repository.updateInstallationStatus(statusData, usuario);

      return updatedStatus;

    } catch (error) {
      throw new Error(`Error al completar instalación: ${error.message}`);
    }
  }

  /**
   * Actualizar paso específico de instalación
   */
  async updateInstallationStep(paso, completado, usuario = 'admin') {
    try {
      const currentStatus = await this.getInstallationStatus();

      // Validar paso
      const pasosValidos = ['duenio', 'restaurante', 'sucursales', 'red', 'productos', 'usuarios'];
      if (!pasosValidos.includes(paso)) {
        throw new ValidationError(`Paso de instalación inválido: ${paso}`, 'paso');
      }

      // Actualizar paso
      const pasosActualizados = {
        ...currentStatus.pasos_completados,
        [paso]: Boolean(completado)
      };

      // Verificar si todos los pasos están completados
      const todosCompletados = pasosValidos.every(p => pasosActualizados[p]);

      const statusData = {
        instalado: todosCompletados,
        version_instalada: currentStatus.version_instalada,
        pasos_completados: pasosActualizados,
        requiere_actualizacion: currentStatus.requiere_actualizacion
      };

      const updatedStatus = await this.repository.updateInstallationStatus(statusData, usuario);

      return updatedStatus;

    } catch (error) {
      throw new Error(`Error al actualizar paso de instalación: ${error.message}`);
    }
  }

  // ============================================================================
  // INSTALACIÓN COMPLETA (ASISTENTE)
  // ============================================================================

  /**
   * Procesar instalación completa del sistema
   */
  async processFullInstallation(installationData, usuario = 'admin', ipOrigen = null) {
    try {
      const results = {};

      // 1. Configurar información del dueño
      if (installationData.duenio) {
        this._validateOwnerData(installationData.duenio);
        results.duenio = await this.repository.upsertOwnerInfo(installationData.duenio, usuario);
        await this.updateInstallationStep('duenio', true, usuario);
      }

      // 2. Configurar sucursales
      if (installationData.sucursales && installationData.sucursales.length > 0) {
        results.sucursales = [];

        for (const sucursal of installationData.sucursales) {
          this._validateBranchData(sucursal);

          // Asignar dueño si no se especifica
          if (!sucursal.duenio_id && results.duenio) {
            sucursal.duenio_id = results.duenio.id;
          }

          const newBranch = await this.repository.createBranch(sucursal, usuario);
          results.sucursales.push(newBranch);
        }

        await this.updateInstallationStep('sucursales', true, usuario);
      }

      // 3. Configurar red (opcional en este paso)
      if (installationData.red) {
        results.red = await this.updateNetworkConfig(installationData.red, usuario, ipOrigen);
        await this.updateInstallationStep('red', true, usuario);
      }

      // 4. Marcar pasos básicos como completados
      await this.updateInstallationStep('restaurante', true, usuario);
      await this.updateInstallationStep('productos', true, usuario);
      await this.updateInstallationStep('usuarios', true, usuario);

      return {
        success: true,
        data: results,
        message: 'Instalación completada exitosamente'
      };

    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new Error(`Error en instalación completa: ${error.message}`);
    }
  }

  /**
   * Validar datos del dueño
   */
  _validateOwnerData(ownerData) {
    if (!ownerData.nombre_completo || ownerData.nombre_completo.trim().length === 0) {
      throw new ValidationError('Nombre completo del dueño es requerido', 'nombre_completo');
    }

    if (!ownerData.rut_nif || ownerData.rut_nif.trim().length === 0) {
      throw new ValidationError('RUT/NIF es requerido', 'rut_nif');
    }

    // Validar email si se proporciona
    if (ownerData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerData.email)) {
      throw new ValidationError('Formato de email inválido', 'email');
    }
  }

  /**
   * Validar datos de sucursal
   */
  _validateBranchData(branchData) {
    if (!branchData.nombre_comercial || branchData.nombre_comercial.trim().length === 0) {
      throw new ValidationError('Nombre comercial es requerido', 'nombre_comercial');
    }

    if (!branchData.direccion || branchData.direccion.trim().length === 0) {
      throw new ValidationError('Dirección es requerida', 'direccion');
    }

    if (!branchData.ciudad || branchData.ciudad.trim().length === 0) {
      throw new ValidationError('Ciudad es requerida', 'ciudad');
    }
  }

  // ============================================================================
  // INFORMACIÓN GENERAL DEL SISTEMA
  // ============================================================================

  /**
   * Obtener información completa del sistema
   */
  async getSystemInfo() {
    try {
      const [networkConfig, installationStatus, ownerInfo, branches] = await Promise.all([
        this.getNetworkConfig(),
        this.getInstallationStatus(),
        this.repository.getOwnerInfo(),
        this.repository.getBranches()
      ]);

      return {
        red: networkConfig,
        instalacion: installationStatus,
        duenio: ownerInfo,
        sucursales: branches,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      throw new Error(`Error al obtener información del sistema: ${error.message}`);
    }
  }
}

module.exports = SystemConfigService;