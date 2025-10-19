-- =====================================================
-- MIGRACIÓN 001: Sistema de Configuración Base
-- Para DYSA Point - FASE 2.1
-- Fecha: 19 Octubre 2025
-- =====================================================

-- Tabla principal de configuración empresa
CREATE TABLE IF NOT EXISTS configuracion_empresa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    razon_social VARCHAR(200) NOT NULL DEFAULT 'DYSA Point Restaurant',
    nombre_comercial VARCHAR(200) NOT NULL DEFAULT 'DYSA Point',
    rut_nif VARCHAR(30) NOT NULL DEFAULT '12.345.678-9',
    direccion_fiscal TEXT NOT NULL,
    telefono VARCHAR(20) DEFAULT '+56 9 1234 5678',
    email VARCHAR(100) DEFAULT 'contacto@dysapoint.com',
    sitio_web VARCHAR(150) DEFAULT 'www.dysapoint.com',
    logo_url VARCHAR(255) DEFAULT NULL,
    descripcion TEXT,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_activa (activa),
    INDEX idx_rut (rut_nif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración básica de la empresa/restaurante';

-- Tabla configuración fiscal
CREATE TABLE IF NOT EXISTS configuracion_fiscal (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    moneda_principal VARCHAR(10) NOT NULL DEFAULT 'CLP',
    simbolo_moneda VARCHAR(10) NOT NULL DEFAULT '$',
    iva_defecto DECIMAL(5,2) NOT NULL DEFAULT 19.00,
    serie_factura VARCHAR(10) DEFAULT 'F',
    numeracion_inicio INT DEFAULT 1,
    formato_factura VARCHAR(50) DEFAULT 'estandar',
    decimales_moneda TINYINT DEFAULT 0,
    redondeo_activo TINYINT(1) DEFAULT 1,
    redondeo_valor DECIMAL(5,2) DEFAULT 0.05,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración fiscal y monetaria';

-- Tabla configuración operativa
CREATE TABLE IF NOT EXISTS configuracion_operativa (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    zona_horaria VARCHAR(50) NOT NULL DEFAULT 'America/Santiago',
    formato_fecha VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    formato_hora VARCHAR(20) DEFAULT 'HH:mm',
    idioma_predeterminado VARCHAR(10) DEFAULT 'es',
    idiomas_disponibles JSON,
    moneda_decimales TINYINT DEFAULT 0,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración operativa del sistema';

-- Tabla configuración específica del restaurante
CREATE TABLE IF NOT EXISTS config_restaurante (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    nombre_establecimiento VARCHAR(200) NOT NULL DEFAULT 'DYSA Point Restaurant',
    tipo_restaurante VARCHAR(50) DEFAULT 'casual',
    capacidad_maxima INT DEFAULT 80,
    total_mesas INT DEFAULT 20,
    mesas_activas INT DEFAULT 18,
    bloques_cocina INT DEFAULT 4,
    tiempo_preparacion_promedio INT DEFAULT 15, -- en minutos
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración específica del restaurante';

-- Tabla configuración de ventas
CREATE TABLE IF NOT EXISTS config_ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    iva_porcentaje DECIMAL(5,2) NOT NULL DEFAULT 19.00,
    permitir_descuentos TINYINT(1) DEFAULT 1,
    descuento_maximo DECIMAL(5,2) DEFAULT 50.00,
    permitir_propinas TINYINT(1) DEFAULT 1,
    propina_sugerida DECIMAL(5,2) DEFAULT 10.00,
    redondeo_activo TINYINT(1) DEFAULT 1,
    redondeo_valor DECIMAL(5,2) DEFAULT 0.05,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de ventas y precios';

-- Tabla configuración de empleados
CREATE TABLE IF NOT EXISTS config_empleados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    total_empleados INT DEFAULT 8,
    empleados_activos INT DEFAULT 6,
    turnos_activos INT DEFAULT 2,
    control_horario TINYINT(1) DEFAULT 1,
    permisos_avanzados TINYINT(1) DEFAULT 0,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de empleados y recursos humanos';

-- Tabla configuración de impresión
CREATE TABLE IF NOT EXISTS config_impresion (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    imprimir_logo TINYINT(1) DEFAULT 1,
    imprimir_direccion TINYINT(1) DEFAULT 1,
    imprimir_telefono TINYINT(1) DEFAULT 1,
    imprimir_rut TINYINT(1) DEFAULT 1,
    tamano_papel VARCHAR(20) DEFAULT 'A4',
    orientacion VARCHAR(20) DEFAULT 'portrait',
    margen_superior INT DEFAULT 10, -- en mm
    margen_inferior INT DEFAULT 10, -- en mm
    impresora_tickets VARCHAR(100) DEFAULT 'default',
    impresora_cocina VARCHAR(100) DEFAULT 'default',
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de impresión y tickets';

-- Tabla configuración del sistema
CREATE TABLE IF NOT EXISTS config_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    version_sistema VARCHAR(20) NOT NULL DEFAULT '3.0.0',
    ambiente VARCHAR(20) DEFAULT 'produccion',
    modo_mantenimiento TINYINT(1) DEFAULT 0,
    backup_automatico TINYINT(1) DEFAULT 1,
    backup_frecuencia VARCHAR(20) DEFAULT 'diario',
    ultimo_backup TIMESTAMP NULL,
    debug_mode TINYINT(1) DEFAULT 0,
    ssl_activo TINYINT(1) DEFAULT 0,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración técnica del sistema';

-- Tabla configuración de seguridad
CREATE TABLE IF NOT EXISTS config_seguridad (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    sesion_timeout INT DEFAULT 3600, -- en segundos
    intentos_login_max INT DEFAULT 5,
    bloqueo_temporal INT DEFAULT 300, -- en segundos
    auditoria_activa TINYINT(1) DEFAULT 1,
    logs_detallados TINYINT(1) DEFAULT 0,
    backup_encriptado TINYINT(1) DEFAULT 1,
    activa TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Configuración de seguridad del sistema';

-- Tabla de estado del sistema en tiempo real (solo lectura desde servicios)
CREATE TABLE IF NOT EXISTS config_estado_runtime (
    id INT AUTO_INCREMENT PRIMARY KEY,
    empresa_id INT NOT NULL DEFAULT 1,
    sistema_activo TINYINT(1) DEFAULT 1,
    base_datos_conectada TINYINT(1) DEFAULT 1,
    servidor_funcionando TINYINT(1) DEFAULT 1,
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    usuarios_conectados INT DEFAULT 0,
    ventas_hoy INT DEFAULT 0,
    ingresos_hoy DECIMAL(10,2) DEFAULT 0.00,

    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE,
    INDEX idx_empresa (empresa_id),
    INDEX idx_ultima_actualizacion (ultima_actualizacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Estado en tiempo real del sistema (calculado)';