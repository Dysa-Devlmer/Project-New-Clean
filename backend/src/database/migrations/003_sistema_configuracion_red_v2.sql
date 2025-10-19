-- MIGRACIÓN 003: Sistema de Configuración de Red e Instalación v2
-- DYSA Point Enterprise - Red Dinámica y Asistente de Instalación
-- Fecha: 19 de Octubre 2025

-- ============================================================================
-- TABLA: sistema_red (Configuración de red dinámica)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistema_red (
  id INT PRIMARY KEY AUTO_INCREMENT,
  host_principal VARCHAR(100) NOT NULL DEFAULT 'localhost' COMMENT 'IP o hostname del servidor principal',
  puerto_api INT NOT NULL DEFAULT 8547 COMMENT 'Puerto del API REST',
  puerto_events INT DEFAULT 8548 COMMENT 'Puerto específico para SSE (opcional)',
  ssl_activo TINYINT(1) DEFAULT 0 COMMENT '0=HTTP, 1=HTTPS',
  timeout_conexion INT DEFAULT 30 COMMENT 'Timeout en segundos para conexiones',
  max_clients_sse INT DEFAULT 50 COMMENT 'Máximo de clientes SSE concurrentes',
  auto_discovery TINYINT(1) DEFAULT 1 COMMENT 'Habilitar autodescubrimiento mDNS',
  configurado_por VARCHAR(100) DEFAULT 'sistema' COMMENT 'Usuario que configuró',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  activo TINYINT(1) DEFAULT 1 COMMENT 'Configuración activa',

  INDEX idx_activo (activo),
  INDEX idx_host_puerto (host_principal, puerto_api)
) ENGINE=InnoDB COMMENT='Configuración dinámica de red y puertos del sistema';

-- ============================================================================
-- TABLA: sistema_instalacion (Estado de instalación)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistema_instalacion (
  id INT PRIMARY KEY AUTO_INCREMENT,
  instalado TINYINT(1) DEFAULT 0 COMMENT '0=Pendiente, 1=Instalado',
  fecha_instalacion DATETIME NULL COMMENT 'Fecha cuando se completó la instalación',
  version_instalada VARCHAR(20) DEFAULT '2.0.0' COMMENT 'Versión del sistema instalada',
  pasos_completados JSON COMMENT 'JSON con pasos del asistente: {"duenio":true,"restaurante":true,"red":true}',
  instalado_por VARCHAR(100) DEFAULT 'admin' COMMENT 'Usuario que completó la instalación',
  configuracion_inicial JSON COMMENT 'Backup de la configuración inicial',
  requiere_actualizacion TINYINT(1) DEFAULT 0 COMMENT 'Si necesita migración/actualización',
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultima_verificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_instalado (instalado),
  INDEX idx_version (version_instalada)
) ENGINE=InnoDB COMMENT='Control de estado de instalación del sistema';

-- ============================================================================
-- TABLA: restaurante_duenio (Datos del propietario)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurante_duenio (
  id INT PRIMARY KEY AUTO_INCREMENT,
  nombre_completo VARCHAR(150) NOT NULL COMMENT 'Nombre del dueño/empresa',
  rut_nif VARCHAR(20) UNIQUE COMMENT 'RUT, NIF, CUIT, etc.',
  tipo_documento ENUM('RUT', 'NIF', 'CUIT', 'DNI', 'OTRO') DEFAULT 'RUT',
  telefono VARCHAR(20) COMMENT 'Teléfono principal',
  email VARCHAR(100) COMMENT 'Email principal',
  direccion TEXT COMMENT 'Dirección del propietario',
  ciudad VARCHAR(100) COMMENT 'Ciudad',
  pais VARCHAR(50) DEFAULT 'Chile' COMMENT 'País',
  activo TINYINT(1) DEFAULT 1,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_rut (rut_nif),
  INDEX idx_activo (activo)
) ENGINE=InnoDB COMMENT='Información del dueño/propietario del restaurante';

-- ============================================================================
-- TABLA: restaurante_sucursal (Sucursales/locales)
-- ============================================================================
CREATE TABLE IF NOT EXISTS restaurante_sucursal (
  id INT PRIMARY KEY AUTO_INCREMENT,
  duenio_id INT NOT NULL,
  nombre_comercial VARCHAR(150) NOT NULL COMMENT 'Nombre comercial del local',
  direccion TEXT NOT NULL COMMENT 'Dirección completa',
  ciudad VARCHAR(100) NOT NULL,
  region VARCHAR(100) COMMENT 'Región/Estado/Provincia',
  codigo_postal VARCHAR(10) COMMENT 'Código postal',
  telefono VARCHAR(20) COMMENT 'Teléfono del local',
  email VARCHAR(100) COMMENT 'Email del local',
  horario_apertura TIME DEFAULT '08:00:00',
  horario_cierre TIME DEFAULT '23:00:00',
  dias_operacion VARCHAR(20) DEFAULT 'L-D' COMMENT 'Lunes a Domingo, etc.',
  es_principal TINYINT(1) DEFAULT 0 COMMENT 'Sucursal principal',
  capacidad_personas INT DEFAULT 50 COMMENT 'Capacidad máxima',
  tipo_cocina VARCHAR(100) COMMENT 'Tipo de cocina (italiana, mexicana, etc.)',
  activo TINYINT(1) DEFAULT 1,
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (duenio_id) REFERENCES restaurante_duenio(id) ON DELETE CASCADE,
  INDEX idx_duenio (duenio_id),
  INDEX idx_principal (es_principal),
  INDEX idx_activo (activo)
) ENGINE=InnoDB COMMENT='Sucursales/locales del restaurante';

-- ============================================================================
-- TABLA: sistema_logs_config (Auditoría de cambios)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sistema_logs_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  tipo_cambio ENUM('RED', 'INSTALACION', 'DUENIO', 'SUCURSAL') NOT NULL,
  tabla_afectada VARCHAR(50) NOT NULL,
  registro_id INT COMMENT 'ID del registro modificado',
  usuario VARCHAR(100) DEFAULT 'sistema',
  accion ENUM('CREATE', 'UPDATE', 'DELETE') NOT NULL,
  datos_anteriores JSON COMMENT 'Estado anterior (para UPDATE/DELETE)',
  datos_nuevos JSON COMMENT 'Estado nuevo (para CREATE/UPDATE)',
  ip_origen VARCHAR(45) COMMENT 'IP del cliente que hizo el cambio',
  user_agent TEXT COMMENT 'User agent del navegador',
  fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_tipo (tipo_cambio),
  INDEX idx_tabla (tabla_afectada),
  INDEX idx_usuario (usuario),
  INDEX idx_fecha (fecha_cambio)
) ENGINE=InnoDB COMMENT='Auditoría de cambios en configuración del sistema';

-- ============================================================================
-- FIN MIGRACIÓN 003
-- ============================================================================