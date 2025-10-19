-- ========================================
-- MIGRACIÓN: Sistema de Mapa Visual de Mesas
-- Funcionalidad Crítica #5 del Sistema Anterior - FINAL
-- Fecha: 2025-10-13 19:25
-- ========================================

-- CREAR TABLA PRINCIPAL PARA CONFIGURACIÓN DEL MAPA VISUAL
CREATE TABLE IF NOT EXISTS configuracion_mapa_visual (
    id INT PRIMARY KEY AUTO_INCREMENT,

    -- Configuración del salón
    nombre_salon VARCHAR(100) NOT NULL DEFAULT 'Salón Principal',
    ancho_salon INT NOT NULL DEFAULT 800 COMMENT 'Ancho en píxeles',
    alto_salon INT NOT NULL DEFAULT 600 COMMENT 'Alto en píxeles',

    -- Configuración visual
    color_fondo VARCHAR(7) DEFAULT '#f8f9fa' COMMENT 'Color de fondo hexadecimal',
    imagen_fondo TEXT NULL COMMENT 'URL o base64 de imagen de fondo',
    escala_zoom DECIMAL(3,2) DEFAULT 1.00 COMMENT 'Escala de zoom por defecto',

    -- Configuración de mesas
    mostrar_numeros_mesa BOOLEAN DEFAULT TRUE,
    mostrar_capacidad BOOLEAN DEFAULT TRUE,
    mostrar_estado_tiempo BOOLEAN DEFAULT TRUE,
    mostrar_camarero BOOLEAN DEFAULT TRUE,
    mostrar_total_cuenta BOOLEAN DEFAULT FALSE,

    -- Configuración de colores por estado
    color_mesa_libre VARCHAR(7) DEFAULT '#28a745' COMMENT 'Verde - Mesa libre',
    color_mesa_ocupada VARCHAR(7) DEFAULT '#dc3545' COMMENT 'Rojo - Mesa ocupada',
    color_mesa_reservada VARCHAR(7) DEFAULT '#ffc107' COMMENT 'Amarillo - Mesa reservada',
    color_mesa_limpieza VARCHAR(7) DEFAULT '#6c757d' COMMENT 'Gris - En limpieza',
    color_mesa_mantenimiento VARCHAR(7) DEFAULT '#e83e8c' COMMENT 'Rosa - Mantenimiento',
    color_mesa_aparcada VARCHAR(7) DEFAULT '#17a2b8' COMMENT 'Azul - Venta aparcada',

    -- Configuración de actualización
    intervalo_actualizacion INT DEFAULT 5 COMMENT 'Segundos entre actualizaciones',
    actualizar_automaticamente BOOLEAN DEFAULT TRUE,

    -- Configuración de interacción
    permitir_drag_drop BOOLEAN DEFAULT TRUE COMMENT 'Permitir arrastrar mesas',
    permitir_redimensionar BOOLEAN DEFAULT TRUE COMMENT 'Permitir cambiar tamaño',
    mostrar_grid BOOLEAN DEFAULT FALSE COMMENT 'Mostrar rejilla de ayuda',
    snap_to_grid BOOLEAN DEFAULT TRUE COMMENT 'Ajustar a rejilla',
    grid_size INT DEFAULT 20 COMMENT 'Tamaño de rejilla en píxeles',

    -- Control de permisos
    solo_lectura BOOLEAN DEFAULT FALSE COMMENT 'Solo visualización, sin edición',
    requiere_permisos_edicion BOOLEAN DEFAULT TRUE,
    nivel_permiso_edicion ENUM('camarero', 'supervisor', 'gerente', 'admin') DEFAULT 'supervisor',

    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NULL,

    INDEX idx_activo (activo)
);

-- CREAR TABLA PARA POSICIONES Y CONFIGURACIÓN VISUAL DE MESAS
CREATE TABLE IF NOT EXISTS mesas_posicion_visual (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mesa_id INT NOT NULL,

    -- Posición en el mapa
    posicion_x INT NOT NULL DEFAULT 50 COMMENT 'Posición X en píxeles',
    posicion_y INT NOT NULL DEFAULT 50 COMMENT 'Posición Y en píxeles',

    -- Dimensiones visuales
    ancho INT NOT NULL DEFAULT 80 COMMENT 'Ancho visual en píxeles',
    alto INT NOT NULL DEFAULT 80 COMMENT 'Alto visual en píxeles',

    -- Forma de la mesa
    forma ENUM('circular', 'rectangular', 'cuadrada', 'ovalada') DEFAULT 'circular',
    rotacion INT DEFAULT 0 COMMENT 'Rotación en grados (0-360)',

    -- Estilo visual personalizado
    color_personalizado VARCHAR(7) NULL COMMENT 'Color personalizado para esta mesa',
    borde_grosor INT DEFAULT 2 COMMENT 'Grosor del borde en píxeles',
    borde_color VARCHAR(7) DEFAULT '#000000' COMMENT 'Color del borde',

    -- Configuración de texto
    mostrar_numero BOOLEAN DEFAULT TRUE,
    tamano_fuente INT DEFAULT 14 COMMENT 'Tamano de fuente para el numero',
    color_fuente VARCHAR(7) DEFAULT '#000000' COMMENT 'Color del texto',
    fuente_bold BOOLEAN DEFAULT TRUE,

    -- Zona del salón
    zona_id INT NULL COMMENT 'ID de zona si aplica',
    capa_visual INT DEFAULT 1 COMMENT 'Capa de visualización (z-index)',

    -- Estado visual
    visible BOOLEAN DEFAULT TRUE,
    bloqueada BOOLEAN DEFAULT FALSE COMMENT 'Si está bloqueada para edición',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (mesa_id) REFERENCES mesa(Num_Mesa) ON DELETE CASCADE,

    UNIQUE KEY uk_mesa_posicion (mesa_id),
    INDEX idx_zona (zona_id),
    INDEX idx_visible (visible),
    INDEX idx_posicion (posicion_x, posicion_y)
);

-- CREAR TABLA PARA ZONAS DEL SALÓN
CREATE TABLE IF NOT EXISTS zonas_salon (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,

    -- Definición del área de la zona
    area_x1 INT NOT NULL COMMENT 'Coordenada X inicial',
    area_y1 INT NOT NULL COMMENT 'Coordenada Y inicial',
    area_x2 INT NOT NULL COMMENT 'Coordenada X final',
    area_y2 INT NOT NULL COMMENT 'Coordenada Y final',

    -- Estilo visual de la zona
    color_zona VARCHAR(7) DEFAULT '#e9ecef' COMMENT 'Color de fondo de la zona',
    opacidad DECIMAL(3,2) DEFAULT 0.30 COMMENT 'Opacidad del área (0.0-1.0)',
    mostrar_borde BOOLEAN DEFAULT TRUE,
    color_borde VARCHAR(7) DEFAULT '#6c757d',
    grosor_borde INT DEFAULT 1,

    -- Configuración de la zona
    tipo_zona ENUM('comedor', 'terraza', 'vip', 'bar', 'privado', 'exterior') DEFAULT 'comedor',
    capacidad_maxima INT NULL COMMENT 'Capacidad máxima de personas en la zona',
    camarero_asignado INT NULL COMMENT 'Camarero fijo para esta zona',

    -- Configuración operativa
    activa BOOLEAN DEFAULT TRUE,
    requiere_reserva BOOLEAN DEFAULT FALSE,
    tarifa_especial BOOLEAN DEFAULT FALSE COMMENT 'Si aplica tarifa especial',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (camarero_asignado) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_tipo_zona (tipo_zona),
    INDEX idx_activa (activa),
    INDEX idx_camarero (camarero_asignado)
);

-- CREAR TABLA PARA ELEMENTOS DECORATIVOS DEL MAPA
CREATE TABLE IF NOT EXISTS elementos_decorativos_mapa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,

    -- Tipo de elemento
    tipo_elemento ENUM('pared', 'columna', 'bar', 'cocina', 'baño', 'entrada', 'ventana', 'texto', 'imagen') NOT NULL,

    -- Posición y dimensiones
    posicion_x INT NOT NULL,
    posicion_y INT NOT NULL,
    ancho INT NOT NULL DEFAULT 50,
    alto INT NOT NULL DEFAULT 50,
    rotacion INT DEFAULT 0,

    -- Estilo visual
    color VARCHAR(7) DEFAULT '#6c757d',
    opacidad DECIMAL(3,2) DEFAULT 1.00,
    borde_color VARCHAR(7) DEFAULT '#000000',
    borde_grosor INT DEFAULT 1,

    -- Contenido específico
    texto VARCHAR(255) NULL COMMENT 'Texto a mostrar si es tipo texto',
    imagen_url TEXT NULL COMMENT 'URL de imagen si es tipo imagen',

    -- Configuración
    capa_visual INT DEFAULT 0 COMMENT 'Capa base para elementos decorativos',
    interactivo BOOLEAN DEFAULT FALSE COMMENT 'Si el elemento es clickeable',
    visible BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tipo (tipo_elemento),
    INDEX idx_visible (visible),
    INDEX idx_capa (capa_visual)
);

-- CREAR TABLA PARA HISTORIAL DE CAMBIOS EN EL MAPA
CREATE TABLE IF NOT EXISTS historial_cambios_mapa (
    id INT PRIMARY KEY AUTO_INCREMENT,

    -- Información del cambio
    tipo_cambio ENUM('mesa_movida', 'mesa_redimensionada', 'zona_creada', 'zona_modificada', 'elemento_agregado', 'configuracion_cambiada') NOT NULL,
    elemento_id INT NULL COMMENT 'ID del elemento modificado',
    tabla_elemento VARCHAR(50) NULL COMMENT 'Tabla del elemento (mesas_posicion_visual, zonas_salon, etc)',

    -- Detalles del cambio
    cambios_anteriores JSON NULL COMMENT 'Estado anterior en formato JSON',
    cambios_nuevos JSON NULL COMMENT 'Estado nuevo en formato JSON',

    -- Información de auditoria
    usuario_cambio INT NOT NULL,
    fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_usuario VARCHAR(45) NULL,
    motivo VARCHAR(255) NULL,

    FOREIGN KEY (usuario_cambio) REFERENCES camareros(id_camarero) ON DELETE CASCADE,

    INDEX idx_tipo_cambio (tipo_cambio),
    INDEX idx_fecha (fecha_cambio),
    INDEX idx_usuario (usuario_cambio),
    INDEX idx_elemento (elemento_id, tabla_elemento)
);

-- CREAR TABLA PARA CONFIGURACIÓN DE PLANTILLAS DE MAPA
CREATE TABLE IF NOT EXISTS plantillas_mapa_visual (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,

    -- Configuración completa del mapa en JSON
    configuracion_mapa JSON NOT NULL COMMENT 'Configuración completa del salón',
    posiciones_mesas JSON NOT NULL COMMENT 'Posiciones de todas las mesas',
    zonas_definidas JSON NULL COMMENT 'Configuración de zonas',
    elementos_decorativos JSON NULL COMMENT 'Elementos decorativos del mapa',

    -- Metadata de la plantilla
    tipo_restaurante ENUM('casual', 'fino', 'rapido', 'bar', 'cafeteria') DEFAULT 'casual',
    capacidad_estimada INT NULL COMMENT 'Capacidad total estimada',

    -- Control
    es_plantilla_base BOOLEAN DEFAULT FALSE COMMENT 'Si es plantilla predeterminada',
    activa BOOLEAN DEFAULT TRUE,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (created_by) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_tipo_restaurante (tipo_restaurante),
    INDEX idx_plantilla_base (es_plantilla_base),
    INDEX idx_activa (activa)
);

-- INSERTAR CONFIGURACIÓN POR DEFECTO
INSERT IGNORE INTO configuracion_mapa_visual (
    nombre_salon, ancho_salon, alto_salon,
    color_fondo, mostrar_numeros_mesa, mostrar_capacidad, mostrar_estado_tiempo,
    color_mesa_libre, color_mesa_ocupada, color_mesa_reservada,
    color_mesa_limpieza, color_mesa_aparcada,
    intervalo_actualizacion, actualizar_automaticamente
) VALUES (
    'Salón Principal', 1000, 700,
    '#f8f9fa', TRUE, TRUE, TRUE,
    '#28a745', '#dc3545', '#ffc107',
    '#6c757d', '#17a2b8',
    3, TRUE
);

-- INSERTAR ZONAS BÁSICAS POR DEFECTO
INSERT IGNORE INTO zonas_salon (
    nombre, descripcion, area_x1, area_y1, area_x2, area_y2,
    tipo_zona, color_zona, activa
) VALUES
('Salón Principal', 'Área principal del restaurante', 50, 50, 600, 400, 'comedor', '#e9ecef', TRUE),
('Terraza', 'Área exterior con vista', 650, 50, 950, 300, 'terraza', '#d4edda', TRUE),
('Zona VIP', 'Área exclusiva para clientes especiales', 650, 350, 950, 650, 'vip', '#fff3cd', TRUE);

-- INSERTAR ELEMENTOS DECORATIVOS BÁSICOS
INSERT IGNORE INTO elementos_decorativos_mapa (
    nombre, tipo_elemento, posicion_x, posicion_y, ancho, alto, color, visible
) VALUES
('Entrada Principal', 'entrada', 450, 25, 100, 50, '#6c757d', TRUE),
('Cocina', 'cocina', 25, 25, 150, 100, '#ffc107', TRUE),
('Bar', 'bar', 25, 150, 100, 200, '#17a2b8', TRUE),
('Baños', 'baño', 25, 375, 80, 100, '#6c757d', TRUE);

-- CREAR POSICIONES INICIALES PARA MESAS EXISTENTES
INSERT IGNORE INTO mesas_posicion_visual (mesa_id, posicion_x, posicion_y, ancho, alto, forma)
SELECT
    Num_Mesa,
    150 + ((Num_Mesa - 1) % 8) * 100 as posicion_x,
    150 + FLOOR((Num_Mesa - 1) / 8) * 100 as posicion_y,
    80 as ancho,
    80 as alto,
    'circular' as forma
FROM mesa
WHERE activa = TRUE
ON DUPLICATE KEY UPDATE mesa_id = mesa_id; -- No actualizar si ya existe

-- CREAR VISTA PARA ESTADO COMPLETO DEL MAPA
CREATE OR REPLACE VIEW vista_mapa_completo AS
SELECT
    m.Num_Mesa,
    m.descripcion as mesa_nombre,
    m.capacidad,
    m.zona,
    mpv.posicion_x,
    mpv.posicion_y,
    mpv.ancho,
    mpv.alto,
    mpv.forma,
    mpv.color_personalizado,
    mpv.visible,
    zs.nombre as zona_nombre,
    zs.tipo_zona,
    zs.color_zona,
    -- Estado de venta actual
    vd.id_venta,
    vd.cerrada as venta_estado,
    vd.total as venta_total,
    vd.fecha_aparcamiento,
    -- Información del camarero
    c.nombre as camarero_nombre,
    c.id_camarero,
    -- Tiempo de ocupación
    CASE
        WHEN vd.id_venta IS NOT NULL AND vd.cerrada = 'N' THEN
            TIMESTAMPDIFF(MINUTE, vd.created_at, NOW())
        ELSE NULL
    END as minutos_ocupada,
    -- Estado visual calculado
    CASE
        WHEN vd.cerrada = 'M' THEN 'aparcada'
        WHEN vd.id_venta IS NOT NULL AND vd.cerrada = 'N' THEN 'ocupada'
        ELSE 'libre'
    END as estado_visual
FROM mesa m
LEFT JOIN mesas_posicion_visual mpv ON m.Num_Mesa = mpv.mesa_id
LEFT JOIN zonas_salon zs ON mpv.zona_id = zs.id
LEFT JOIN ventadirecta vd ON m.Num_Mesa = vd.Num_Mesa AND vd.cerrada IN ('N', 'M')
LEFT JOIN camareros c ON vd.id_camarero = c.id_camarero
WHERE m.activa = TRUE AND (mpv.visible = TRUE OR mpv.visible IS NULL)
ORDER BY m.Num_Mesa;

-- COMENTARIOS PARA DOCUMENTACIÓN
ALTER TABLE configuracion_mapa_visual
COMMENT = 'Configuración general del mapa visual del salón';

ALTER TABLE mesas_posicion_visual
COMMENT = 'Posiciones y configuración visual de cada mesa en el mapa';

ALTER TABLE zonas_salon
COMMENT = 'Definición de zonas del salón (comedor, terraza, VIP, etc.)';

ALTER TABLE elementos_decorativos_mapa
COMMENT = 'Elementos decorativos del mapa (paredes, columnas, etc.)';

ALTER TABLE historial_cambios_mapa
COMMENT = 'Historial de cambios realizados en el mapa visual';

ALTER TABLE plantillas_mapa_visual
COMMENT = 'Plantillas predefinidas de mapas para diferentes tipos de restaurante';

-- VERIFICACIÓN DE LA MIGRACIÓN
SELECT 'MIGRACIÓN MAPA VISUAL DE MESAS COMPLETADA EXITOSAMENTE' as status;