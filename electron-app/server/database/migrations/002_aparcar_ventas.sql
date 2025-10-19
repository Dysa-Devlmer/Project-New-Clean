-- ========================================
-- MIGRACIÓN: Sistema de Aparcar Ventas
-- Funcionalidad Crítica #2 del Sistema Anterior
-- Fecha: 2025-10-13 18:36
-- ========================================

-- AGREGAR ESTADOS DE VENTA A LA TABLA PRINCIPAL
ALTER TABLE ventadirecta
ADD COLUMN IF NOT EXISTS estado_venta ENUM('nueva', 'activa', 'aparcada', 'cerrada', 'cancelada') DEFAULT 'nueva' COMMENT 'Estado de la venta',
ADD COLUMN IF NOT EXISTS fecha_aparcamiento DATETIME NULL COMMENT 'Cuando se aparcó la venta',
ADD COLUMN IF NOT EXISTS usuario_aparcamiento INT NULL COMMENT 'Quien aparcó la venta',
ADD COLUMN IF NOT EXISTS motivo_aparcamiento VARCHAR(255) NULL COMMENT 'Motivo del aparcamiento';

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
    FOREIGN KEY (mesa_anterior) REFERENCES mesa(Num_Mesa) ON DELETE SET NULL,
    FOREIGN KEY (mesa_nueva) REFERENCES mesa(Num_Mesa) ON DELETE SET NULL,

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

-- AGREGAR ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS
ALTER TABLE ventadirecta
ADD INDEX IF NOT EXISTS idx_estado_venta (estado_venta),
ADD INDEX IF NOT EXISTS idx_fecha_aparcamiento (fecha_aparcamiento),
ADD INDEX IF NOT EXISTS idx_usuario_aparcamiento (usuario_aparcamiento);

-- CREAR VISTA PARA CONSULTAS RÁPIDAS DE VENTAS APARCADAS
CREATE OR REPLACE VIEW vista_ventas_aparcadas AS
SELECT
    vd.id_venta,
    vd.Num_Mesa,
    m.descripcion as mesa_nombre,
    vd.fecha_apertura,
    vd.fecha_aparcamiento,
    vd.motivo_aparcamiento,
    vd.total,
    c.nombre as camarero_nombre,
    ua.nombre as usuario_aparcamiento_nombre,
    TIMESTAMPDIFF(MINUTE, vd.fecha_aparcamiento, NOW()) as minutos_aparcada,
    COUNT(vc.id_linea) as productos_total,
    SUM(CASE WHEN vc.enviado_cocina = TRUE THEN 1 ELSE 0 END) as productos_enviados_cocina
FROM ventadirecta vd
JOIN mesa m ON vd.Num_Mesa = m.Num_Mesa
JOIN camareros c ON vd.id_camarero = c.id_camarero
LEFT JOIN camareros ua ON vd.usuario_aparcamiento = ua.id_camarero
LEFT JOIN ventadir_comg vc ON vd.id_venta = vc.id_venta
WHERE vd.estado_venta = 'aparcada'
GROUP BY vd.id_venta, vd.Num_Mesa, m.descripcion, vd.fecha_apertura,
         vd.fecha_aparcamiento, vd.motivo_aparcamiento, vd.total,
         c.nombre, ua.nombre
ORDER BY vd.fecha_aparcamiento DESC;

-- CREAR VISTA PARA DASHBOARD DE APARCAMIENTOS
CREATE OR REPLACE VIEW vista_dashboard_aparcamientos AS
SELECT
    DATE(ha.fecha_accion) as fecha,
    ha.accion,
    COUNT(*) as total_acciones,
    AVG(ha.productos_antes) as promedio_productos,
    AVG(ha.total_venta) as promedio_total,
    COUNT(DISTINCT ha.usuario_accion) as usuarios_diferentes,
    AVG(CASE
        WHEN ha.accion = 'recuperar'
        THEN TIMESTAMPDIFF(MINUTE,
            (SELECT fecha_accion FROM historial_aparcamientos ha2
             WHERE ha2.id_venta = ha.id_venta AND ha2.accion = 'aparcar'
             ORDER BY ha2.fecha_accion DESC LIMIT 1),
            ha.fecha_accion)
        ELSE NULL
    END) as promedio_minutos_aparcada
FROM historial_aparcamientos ha
WHERE ha.fecha_accion >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
GROUP BY DATE(ha.fecha_accion), ha.accion
ORDER BY fecha DESC, ha.accion;

-- COMENTARIOS PARA DOCUMENTACIÓN
ALTER TABLE ventadirecta
COMMENT = 'Ventas principales con soporte para aparcamiento temporal';

ALTER TABLE historial_aparcamientos
COMMENT = 'Historial completo de acciones de aparcamiento y recuperación de ventas';

ALTER TABLE configuracion_aparcamiento
COMMENT = 'Configuración personalizada del sistema de aparcamiento por rol/usuario';

-- VERIFICACIÓN DE LA MIGRACIÓN
SELECT 'MIGRACIÓN APARCAR VENTAS COMPLETADA EXITOSAMENTE' as status;