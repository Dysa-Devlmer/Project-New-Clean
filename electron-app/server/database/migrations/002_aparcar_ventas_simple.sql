-- ========================================
-- MIGRACIÓN: Sistema de Aparcar Ventas - Versión Simplificada
-- Funcionalidad Crítica #2 del Sistema Anterior
-- Fecha: 2025-10-13 18:38
-- ========================================

-- CREAR TABLA PARA HISTORIAL DE APARCAMIENTOS
CREATE TABLE IF NOT EXISTS historial_aparcamientos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_venta INT NOT NULL,
    accion ENUM('aparcar', 'recuperar') NOT NULL,
    fecha_accion DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_accion INT NOT NULL,
    motivo TEXT NULL,
    productos_antes INT DEFAULT 0 COMMENT 'Cantidad de productos antes de aparcar',
    productos_despues INT DEFAULT 0 COMMENT 'Cantidad de productos después de recuperar',
    mesa_anterior INT NULL COMMENT 'Mesa antes del aparcamiento',
    mesa_nueva INT NULL COMMENT 'Mesa después de recuperar',
    total_venta DECIMAL(10,2) DEFAULT 0 COMMENT 'Total de la venta al momento de la acción',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (usuario_accion) REFERENCES camareros(id_camarero) ON DELETE CASCADE,

    INDEX idx_venta (id_venta),
    INDEX idx_fecha (fecha_accion),
    INDEX idx_accion (accion),
    INDEX idx_usuario (usuario_accion)
);

-- CREAR TABLA PARA CONFIGURACIÓN DE APARCAMIENTO
CREATE TABLE IF NOT EXISTS configuracion_aparcamiento (
    id INT PRIMARY KEY AUTO_INCREMENT,

    -- Configuraciones generales
    tiempo_maximo_aparcamiento INT DEFAULT 120 COMMENT 'Minutos máximos que puede estar aparcada',
    permitir_cambio_mesa BOOLEAN DEFAULT TRUE COMMENT 'Si se puede cambiar de mesa al recuperar',
    mantener_productos_cocina BOOLEAN DEFAULT TRUE COMMENT 'Si mantener productos enviados a cocina',
    notificacion_tiempo_limite BOOLEAN DEFAULT TRUE COMMENT 'Notificar cuando se acerca el límite',
    minutos_notificacion INT DEFAULT 15 COMMENT 'Minutos antes del límite para notificar',

    -- Configuraciones por rol
    tipo_config ENUM('global', 'rol', 'usuario') DEFAULT 'global',
    id_referencia INT NULL COMMENT 'ID del rol o usuario según el tipo',

    -- Control de permisos
    puede_aparcar BOOLEAN DEFAULT TRUE COMMENT 'Si puede aparcar ventas',
    puede_recuperar BOOLEAN DEFAULT TRUE COMMENT 'Si puede recuperar ventas aparcadas',
    puede_cambiar_mesa_recuperar BOOLEAN DEFAULT TRUE COMMENT 'Si puede cambiar mesa al recuperar',
    requiere_motivo BOOLEAN DEFAULT FALSE COMMENT 'Si requiere especificar motivo',

    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tipo_config (tipo_config),
    INDEX idx_referencia (id_referencia),
    INDEX idx_activo (activo)
);

-- INSERTAR CONFIGURACIÓN GLOBAL POR DEFECTO
INSERT IGNORE INTO configuracion_aparcamiento (
    tipo_config,
    tiempo_maximo_aparcamiento,
    permitir_cambio_mesa,
    mantener_productos_cocina,
    puede_aparcar,
    puede_recuperar,
    puede_cambiar_mesa_recuperar,
    requiere_motivo
) VALUES (
    'global',
    120,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    TRUE,
    FALSE
);

-- VERIFICACIÓN DE LA MIGRACIÓN
SELECT 'MIGRACIÓN APARCAR VENTAS (TABLAS) COMPLETADA EXITOSAMENTE' as status;