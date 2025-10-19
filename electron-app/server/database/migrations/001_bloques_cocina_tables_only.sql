-- ========================================
-- MIGRACIÓN: Sistema de Bloques de Cocina - Solo Tablas Faltantes
-- Fecha: 2025-10-13 18:22
-- ========================================

-- CREAR TABLA PARA HISTORIAL DE ENVÍOS POR BLOQUE
CREATE TABLE IF NOT EXISTS envios_bloques_cocina (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_venta INT NOT NULL,
    bloque_numero INT NOT NULL,

    -- Información del envío
    fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_envio INT NOT NULL, -- quien envió el bloque

    -- Productos del bloque
    total_productos INT DEFAULT 0,
    productos_pendientes INT DEFAULT 0,
    productos_listos INT DEFAULT 0,

    -- Estado del bloque
    estado ENUM('enviado', 'en_preparacion', 'listo', 'servido') DEFAULT 'enviado',

    -- Observaciones
    observaciones TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (usuario_envio) REFERENCES camareros(id_camarero) ON DELETE CASCADE,

    INDEX idx_venta_bloque (id_venta, bloque_numero),
    INDEX idx_estado (estado),
    INDEX idx_fecha_envio (fecha_envio),

    UNIQUE KEY uk_venta_bloque (id_venta, bloque_numero)
);

-- CREAR TABLA PARA CONFIGURACIÓN DE BLOQUES POR MESA/USUARIO
CREATE TABLE IF NOT EXISTS configuracion_bloques (
    id INT PRIMARY KEY AUTO_INCREMENT,

    -- Configuración por usuario o mesa
    tipo_config ENUM('usuario', 'mesa', 'global') NOT NULL,
    id_referencia INT NULL, -- id_camarero o Num_Mesa según el tipo

    -- Configuración de bloques
    bloques_por_defecto INT DEFAULT 1,
    auto_envio_primer_bloque BOOLEAN DEFAULT TRUE,
    tiempo_entre_bloques INT DEFAULT 5, -- minutos

    -- Configuración de productos
    productos_por_bloque JSON NULL COMMENT 'Configuración de qué productos van en qué bloque',

    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tipo_config (tipo_config),
    INDEX idx_referencia (id_referencia),
    INDEX idx_activo (activo)
);

-- INSERTAR CONFIGURACIÓN GLOBAL POR DEFECTO
INSERT IGNORE INTO configuracion_bloques (tipo_config, bloques_por_defecto, auto_envio_primer_bloque, tiempo_entre_bloques)
VALUES ('global', 1, TRUE, 5);

-- AGREGAR CAMPOS FALTANTES A VENTADIRECTA SI NO EXISTEN
ALTER TABLE ventadirecta
ADD COLUMN IF NOT EXISTS bloques_total INT DEFAULT 1 COMMENT 'Total de bloques creados',
ADD COLUMN IF NOT EXISTS bloques_enviados INT DEFAULT 0 COMMENT 'Bloques ya enviados a cocina',
ADD COLUMN IF NOT EXISTS ultimo_bloque_enviado INT DEFAULT 0 COMMENT 'Último bloque enviado';

-- AGREGAR CAMPOS FALTANTES A VENTADIR_COMG SI NO EXISTEN
ALTER TABLE ventadir_comg
ADD COLUMN IF NOT EXISTS enviado_cocina BOOLEAN DEFAULT FALSE COMMENT 'Si ya fue enviado a cocina',
ADD COLUMN IF NOT EXISTS fecha_envio_cocina DATETIME NULL COMMENT 'Cuando se envió a cocina';

-- AGREGAR CAMPOS FALTANTES A VENTA_COCINA SI NO EXISTEN
ALTER TABLE venta_cocina
ADD COLUMN IF NOT EXISTS bloque_cocina INT DEFAULT 1 COMMENT 'Bloque al que pertenece',
ADD COLUMN IF NOT EXISTS orden_en_bloque INT DEFAULT 1 COMMENT 'Orden dentro del bloque';

-- CREAR ÍNDICES SI NO EXISTEN
ALTER TABLE ventadir_comg
ADD INDEX IF NOT EXISTS idx_bloque_cocina (bloque_cocina),
ADD INDEX IF NOT EXISTS idx_enviado_cocina (enviado_cocina),
ADD INDEX IF NOT EXISTS idx_fecha_envio_cocina (fecha_envio_cocina);

ALTER TABLE venta_cocina
ADD INDEX IF NOT EXISTS idx_bloque_cocina (bloque_cocina);

-- VERIFICACIÓN DE LA MIGRACIÓN
SELECT 'MIGRACIÓN BLOQUES DE COCINA (TABLAS) COMPLETADA EXITOSAMENTE' as status;