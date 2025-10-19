-- =====================================================
-- MIGRACIÓN 003: Sistema de Categorías
-- Para DYSA Point - FASE 2.1
-- Fecha: 19 Octubre 2025
-- =====================================================

-- Tabla de categorías de productos mejorada
CREATE TABLE IF NOT EXISTS categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activa TINYINT(1) DEFAULT 1,
    orden INT DEFAULT 0,
    color_hex VARCHAR(7) DEFAULT '#3498db', -- Color para UI
    icono VARCHAR(50) DEFAULT 'utensils', -- Icono FontAwesome
    empresa_id INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY unique_nombre_empresa (nombre, empresa_id),
    INDEX idx_activa (activa),
    INDEX idx_orden (orden),
    INDEX idx_empresa (empresa_id),
    FOREIGN KEY (empresa_id) REFERENCES configuracion_empresa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Categorías de productos para el restaurante';

-- Insertar categorías por defecto
INSERT INTO categorias (nombre, descripcion, orden, color_hex, icono, empresa_id) VALUES
('Entradas', 'Aperitivos y entradas del restaurante', 1, '#e74c3c', 'leaf', 1),
('Platos Principales', 'Platos principales y carnes', 2, '#2ecc71', 'utensils', 1),
('Postres', 'Postres y dulces', 3, '#f39c12', 'ice-cream', 1),
('Bebidas', 'Bebidas frías y calientes', 4, '#3498db', 'glass-martini', 1),
('Ensaladas', 'Ensaladas y platos vegetarianos', 5, '#27ae60', 'seedling', 1),
('Sopas', 'Sopas y cremas', 6, '#e67e22', 'bowl-hot', 1),
('Mariscos', 'Platos de mariscos y pescados', 7, '#1abc9c', 'fish', 1),
('Pastas', 'Pastas y platos italianos', 8, '#9b59b6', 'pizza-slice', 1)
ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Vista para categorías activas ordenadas
CREATE OR REPLACE VIEW v_categorias_activas AS
SELECT
    id,
    nombre,
    descripcion,
    orden,
    color_hex,
    icono,
    empresa_id,
    created_at,
    updated_at
FROM categorias
WHERE activa = 1
ORDER BY orden ASC, nombre ASC;

-- Función para obtener el siguiente orden disponible
DELIMITER //
CREATE FUNCTION IF NOT EXISTS siguiente_orden_categoria(empresa_id_param INT)
RETURNS INT
READS SQL DATA
DETERMINISTIC
BEGIN
    DECLARE siguiente_orden INT DEFAULT 1;

    SELECT COALESCE(MAX(orden), 0) + 1
    INTO siguiente_orden
    FROM categorias
    WHERE empresa_id = empresa_id_param;

    RETURN siguiente_orden;
END //
DELIMITER ;

-- Verificar inserción
SELECT 'Categorías insertadas:' as status;
SELECT
    COUNT(*) as total_categorias,
    COUNT(CASE WHEN activa = 1 THEN 1 END) as categorias_activas
FROM categorias;

SELECT
    nombre,
    orden,
    color_hex,
    icono
FROM categorias
WHERE activa = 1
ORDER BY orden;