-- =====================================================
-- MIGRACIÓN 004: Historial de Mesas v2
-- DYSA Point - Fase 2 POS Núcleo
-- Fecha: 19 Octubre 2025
-- =====================================================

-- Tabla para historial de cambios de estado de mesas
CREATE TABLE IF NOT EXISTS mesa_historial (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mesa_id INT NOT NULL,
    estado_anterior ENUM('LIBRE','OCUPADA','RESERVADA','LIMPIEZA','FUERA_SERVICIO') NULL,
    estado_nuevo ENUM('LIBRE','OCUPADA','RESERVADA','LIMPIEZA','FUERA_SERVICIO') NOT NULL,
    usuario_id INT NULL,
    usuario_nombre VARCHAR(100) NULL,
    motivo VARCHAR(255) NULL,
    comensales_anterior INT NULL,
    comensales_nuevo INT NULL,
    observaciones TEXT NULL,
    ip_origen VARCHAR(45) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_mesa_id (mesa_id),
    INDEX idx_estado_nuevo (estado_nuevo),
    INDEX idx_created_at (created_at),
    INDEX idx_usuario_id (usuario_id),

    FOREIGN KEY (mesa_id) REFERENCES mesas_restaurante(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Historial de cambios de estado de mesas para auditoría';

-- Vista para obtener el último estado de cada mesa con historial
CREATE OR REPLACE VIEW v_mesas_con_historial AS
SELECT
    m.*,
    h.estado_anterior as ultimo_estado_anterior,
    h.usuario_nombre as ultimo_usuario_cambio,
    h.motivo as ultimo_motivo_cambio,
    h.created_at as ultimo_cambio_fecha,
    (
        SELECT COUNT(*)
        FROM mesa_historial h2
        WHERE h2.mesa_id = m.id
        AND DATE(h2.created_at) = CURDATE()
    ) as cambios_hoy
FROM mesas_restaurante m
LEFT JOIN mesa_historial h ON h.mesa_id = m.id
AND h.id = (
    SELECT MAX(h3.id)
    FROM mesa_historial h3
    WHERE h3.mesa_id = m.id
)
WHERE m.mesa_activa = 1
ORDER BY m.zona_id, m.numero_mesa;

-- Insertar registros iniciales de historial para mesas existentes
INSERT INTO mesa_historial (mesa_id, estado_anterior, estado_nuevo, usuario_nombre, motivo)
SELECT
    m.id,
    NULL,
    m.estado_mesa,
    'SISTEMA',
    'Estado inicial al migrar a sistema de historial'
FROM mesas_restaurante m
WHERE m.mesa_activa = 1;

-- Verificar inserción
SELECT 'Migración 004 completada' as status;
SELECT
    'mesa_historial' as tabla,
    COUNT(*) as registros_iniciales
FROM mesa_historial;

SELECT
    'Mesas activas con historial' as descripcion,
    COUNT(*) as total
FROM v_mesas_con_historial;