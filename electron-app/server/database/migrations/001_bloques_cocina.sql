-- ========================================
-- MIGRACIÓN: Sistema de Bloques de Cocina
-- Funcionalidad Crítica #1 del Sistema Antiguo
-- Fecha: 2025-10-13 18:19
-- ========================================

-- AGREGAR CAMPOS PARA BLOQUES DE COCINA A VENTADIR_COMG
ALTER TABLE ventadir_comg
ADD COLUMN bloque_cocina INT DEFAULT 1 COMMENT 'Bloque de cocina (1, 2, 3, 4)',
ADD COLUMN enviado_cocina BOOLEAN DEFAULT FALSE COMMENT 'Si ya fue enviado a cocina',
ADD COLUMN fecha_envio_cocina DATETIME NULL COMMENT 'Cuando se envió a cocina',
ADD COLUMN hora_cocina TIME NULL COMMENT 'Hora específica para cocina';

-- CREAR ÍNDICES PARA OPTIMIZAR CONSULTAS
ALTER TABLE ventadir_comg
ADD INDEX idx_bloque_cocina (bloque_cocina),
ADD INDEX idx_enviado_cocina (enviado_cocina),
ADD INDEX idx_fecha_envio (fecha_envio_cocina);

-- AGREGAR CAMPOS DE CONTROL DE BLOQUES A VENTADIRECTA
ALTER TABLE ventadirecta
ADD COLUMN bloques_total INT DEFAULT 1 COMMENT 'Total de bloques creados',
ADD COLUMN bloques_enviados INT DEFAULT 0 COMMENT 'Bloques ya enviados a cocina',
ADD COLUMN ultimo_bloque_enviado INT DEFAULT 0 COMMENT 'Último bloque enviado';

-- CREAR TABLA PARA HISTORIAL DE ENVÍOS POR BLOQUE
CREATE TABLE envios_bloques_cocina (
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
CREATE TABLE configuracion_bloques (
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
INSERT INTO configuracion_bloques (tipo_config, bloques_por_defecto, auto_envio_primer_bloque, tiempo_entre_bloques)
VALUES ('global', 1, TRUE, 5);

-- ACTUALIZAR TABLA VENTA_COCINA PARA SOPORTAR BLOQUES
ALTER TABLE venta_cocina
ADD COLUMN bloque_cocina INT DEFAULT 1 COMMENT 'Bloque al que pertenece',
ADD COLUMN orden_en_bloque INT DEFAULT 1 COMMENT 'Orden dentro del bloque',
ADD INDEX idx_bloque_cocina (bloque_cocina);

-- CREAR VISTA PARA CONSULTAS RÁPIDAS DE BLOQUES
CREATE VIEW vista_bloques_cocina AS
SELECT
    vd.id_venta,
    vd.Num_Mesa,
    m.descripcion as mesa_nombre,
    c.nombre as camarero_nombre,
    vc.bloque_cocina,
    vc.id_linea,
    vc.id_complementog,
    cg.alias as producto_nombre,
    vc.cantidad,
    vc.enviado_cocina,
    vc.fecha_envio_cocina,
    vc.hora_cocina,
    ebc.estado as estado_bloque,
    ebc.fecha_envio
FROM ventadirecta vd
JOIN ventadir_comg vc ON vd.id_venta = vc.id_venta
JOIN complementog cg ON vc.id_complementog = cg.id_complementog
JOIN mesa m ON vd.Num_Mesa = m.Num_Mesa
JOIN camareros c ON vd.id_camarero = c.id_camarero
LEFT JOIN envios_bloques_cocina ebc ON vd.id_venta = ebc.id_venta AND vc.bloque_cocina = ebc.bloque_numero
WHERE vd.cerrada = 'N'
ORDER BY vd.id_venta, vc.bloque_cocina, vc.id_linea;

-- COMENTARIOS PARA DOCUMENTACIÓN
ALTER TABLE ventadir_comg
COMMENT = 'Líneas de venta con soporte para bloques de cocina (1-4)';

ALTER TABLE envios_bloques_cocina
COMMENT = 'Historial de envíos de bloques a cocina para control y seguimiento';

ALTER TABLE configuracion_bloques
COMMENT = 'Configuración personalizada de bloques por usuario, mesa o global';

-- VERIFICACIÓN DE LA MIGRACIÓN
SELECT 'MIGRACIÓN BLOQUES DE COCINA COMPLETADA EXITOSAMENTE' as status;