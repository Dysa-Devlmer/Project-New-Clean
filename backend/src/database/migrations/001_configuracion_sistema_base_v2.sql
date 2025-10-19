-- =====================================================
-- MIGRACIÓN 001: Sistema de Configuración Base v2
-- DYSA Point - 19 Oct 2025
-- Requiere MySQL 8.x, InnoDB, utf8mb4
-- Migración mejorada sin DEFAULT en JSON
-- =====================================================
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- Tabla principal de empresa (base para todas las configuraciones)
CREATE TABLE IF NOT EXISTS configuracion_empresa (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  razon_social    VARCHAR(200) NOT NULL,
  nombre_comercial VARCHAR(200) NOT NULL,
  rut_nif         VARCHAR(50),
  direccion_fiscal VARCHAR(255),
  telefono        VARCHAR(50),
  email           VARCHAR(150),
  sitio_web       VARCHAR(200),
  logo_url        VARCHAR(255),
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración básica de la empresa/restaurante';

-- Configuración fiscal y monetaria
CREATE TABLE IF NOT EXISTS configuracion_fiscal (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id         INT NOT NULL,
  moneda_principal   VARCHAR(10) NOT NULL,
  moneda_simbolo     VARCHAR(5)  NOT NULL,
  iva_defecto        DECIMAL(5,2) NOT NULL,
  serie_factura      VARCHAR(10),
  numeracion_inicio  INT DEFAULT 1,
  formato_factura    VARCHAR(50),
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración fiscal y monetaria';

-- Configuración operativa del sistema (SIN DEFAULT en JSON)
CREATE TABLE IF NOT EXISTS configuracion_operativa (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id          INT NOT NULL,
  zona_horaria        VARCHAR(64) NOT NULL,
  formato_fecha       VARCHAR(20) NOT NULL,
  formato_hora        VARCHAR(20) NOT NULL,
  idioma_predeterminado VARCHAR(10) NOT NULL,
  idiomas_disponibles JSON NULL, -- ❗SIN DEFAULT para evitar errores MySQL
  moneda_decimales    TINYINT NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración operativa del sistema';

-- Configuración específica del restaurante
CREATE TABLE IF NOT EXISTS config_restaurante (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id    INT NOT NULL,
  nombre_establecimiento VARCHAR(200),
  tipo_establecimiento   VARCHAR(50),
  capacidad_maxima INT,
  total_mesas     INT,
  mesas_activas   INT,
  bloques_cocina  INT,
  tiempo_preparacion_promedio INT,
  created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración específica del restaurante';

-- Configuración de ventas y precios
CREATE TABLE IF NOT EXISTS config_ventas (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id          INT NOT NULL,
  iva_porcentaje      DECIMAL(5,2) NOT NULL,
  permitir_descuentos TINYINT(1) NOT NULL DEFAULT 1,
  descuento_maximo    DECIMAL(5,2) DEFAULT 0,
  permitir_propinas   TINYINT(1) NOT NULL DEFAULT 1,
  propina_sugerida    DECIMAL(5,2) DEFAULT 10,
  redondeo_activo     TINYINT(1) NOT NULL DEFAULT 0,
  redondeo_valor      INT DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración de ventas y precios';

-- Configuración de empleados y recursos humanos
CREATE TABLE IF NOT EXISTS config_empleados (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id        INT NOT NULL,
  total_empleados   INT DEFAULT 0,
  empleados_activos INT DEFAULT 0,
  turnos_activos    TINYINT(1) NOT NULL DEFAULT 1,
  control_horario   TINYINT(1) NOT NULL DEFAULT 1,
  permisos_avanzados TINYINT(1) NOT NULL DEFAULT 0,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración de empleados y recursos humanos';

-- Configuración de impresión y tickets
CREATE TABLE IF NOT EXISTS config_impresion (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id         INT NOT NULL,
  imprimir_logo      TINYINT(1) NOT NULL DEFAULT 1,
  imprimir_direccion TINYINT(1) NOT NULL DEFAULT 1,
  imprimir_telefono  TINYINT(1) NOT NULL DEFAULT 1,
  imprimir_rut       TINYINT(1) NOT NULL DEFAULT 1,
  tamano_papel       VARCHAR(20) DEFAULT 'A4',
  orientacion        VARCHAR(20) DEFAULT 'portrait',
  margen_superior    INT DEFAULT 20,
  margen_inferior    INT DEFAULT 20,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración de impresión y tickets';

-- Configuración técnica del sistema
CREATE TABLE IF NOT EXISTS config_sistema (
  id                 INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id         INT NOT NULL,
  version            VARCHAR(20) DEFAULT '3.0.0',
  ambiente           VARCHAR(20) DEFAULT 'production',
  modo_mantenimiento TINYINT(1) NOT NULL DEFAULT 0,
  backup_automatico  TINYINT(1) NOT NULL DEFAULT 1,
  backup_frecuencia  VARCHAR(20) DEFAULT 'diario',
  ultimo_backup      DATETIME NULL,
  debug_mode         TINYINT(1) NOT NULL DEFAULT 0,
  ssl_activo         TINYINT(1) NOT NULL DEFAULT 0,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración técnica del sistema';

-- Configuración de seguridad del sistema
CREATE TABLE IF NOT EXISTS config_seguridad (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id          INT NOT NULL,
  sesion_timeout      INT NOT NULL DEFAULT 480,
  intentos_login_max  INT NOT NULL DEFAULT 5,
  bloqueo_temporal    INT NOT NULL DEFAULT 15,
  auditoria_activa    TINYINT(1) NOT NULL DEFAULT 1,
  logs_detallados     TINYINT(1) NOT NULL DEFAULT 1,
  backup_encriptado   TINYINT(1) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Configuración de seguridad del sistema';

-- Tabla de categorías de productos (incluída en base para simplificar)
CREATE TABLE IF NOT EXISTS categorias (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nombre      VARCHAR(100) NOT NULL,
  descripcion VARCHAR(255),
  activa      TINYINT(1) NOT NULL DEFAULT 1,
  orden       INT DEFAULT 0,
  color_hex   VARCHAR(7),
  icono       VARCHAR(100),
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_categorias_nombre (nombre)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COMMENT='Categorías de productos para el restaurante';

SET FOREIGN_KEY_CHECKS = 1;