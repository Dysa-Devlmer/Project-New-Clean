-- ========================================
-- MIGRACIÓN: Sistema de Pre-tickets
-- Funcionalidad Crítica #3 del Sistema Anterior
-- Fecha: 2025-10-13 18:48
-- ========================================

-- CREAR TABLA PRINCIPAL PARA PRE-TICKETS
CREATE TABLE IF NOT EXISTS pretickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    id_venta INT NOT NULL,
    numero_preticket INT NOT NULL,

    -- Información del pre-ticket
    fecha_generacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_generacion INT NOT NULL,
    tipo_preticket ENUM('parcial', 'total', 'resumen') DEFAULT 'total',

    -- Datos de la venta al momento del pre-ticket
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    descuentos DECIMAL(10,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(10,2) NOT NULL DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    comensales INT NOT NULL DEFAULT 1,

    -- Estado del pre-ticket
    estado ENUM('generado', 'impreso', 'anulado') DEFAULT 'generado',
    fecha_impresion DATETIME NULL,
    impresora_id INT NULL,

    -- Información adicional
    observaciones TEXT NULL,
    motivo_anulacion VARCHAR(255) NULL,
    usuario_anulacion INT NULL,
    fecha_anulacion DATETIME NULL,

    -- Configuración de impresión
    formato_impresion ENUM('ticket', 'cuenta', 'resumen') DEFAULT 'ticket',
    copias_impresas INT DEFAULT 0,
    hash_contenido VARCHAR(64) NULL COMMENT 'Hash MD5 del contenido para verificar cambios',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (usuario_generacion) REFERENCES camareros(id_camarero) ON DELETE CASCADE,
    FOREIGN KEY (usuario_anulacion) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_venta (id_venta),
    INDEX idx_fecha_generacion (fecha_generacion),
    INDEX idx_numero_preticket (numero_preticket),
    INDEX idx_estado (estado),
    INDEX idx_usuario_generacion (usuario_generacion),

    UNIQUE KEY uk_venta_numero (id_venta, numero_preticket)
);

-- CREAR TABLA PARA LÍNEAS DE PRE-TICKETS
CREATE TABLE IF NOT EXISTS pretickets_lineas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    preticket_id INT NOT NULL,
    id_linea_venta INT NOT NULL, -- Referencia a ventadir_comg.id_linea

    -- Información del producto al momento del pre-ticket
    id_complementog INT NOT NULL,
    producto_nombre VARCHAR(255) NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10,2) NOT NULL,
    descuento_linea DECIMAL(10,2) DEFAULT 0,
    subtotal_linea DECIMAL(10,2) NOT NULL,

    -- Estado de la línea
    incluido_preticket BOOLEAN DEFAULT TRUE,
    observaciones_linea TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (preticket_id) REFERENCES pretickets(id) ON DELETE CASCADE,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE CASCADE,

    INDEX idx_preticket (preticket_id),
    INDEX idx_linea_venta (id_linea_venta),
    INDEX idx_producto (id_complementog)
);

-- CREAR TABLA DE CONFIGURACIÓN DE PRE-TICKETS
CREATE TABLE IF NOT EXISTS configuracion_pretickets (
    id INT PRIMARY KEY AUTO_INCREMENT,

    -- Configuraciones generales
    numeracion_automatica BOOLEAN DEFAULT TRUE COMMENT 'Si genera números automáticamente',
    formato_numero VARCHAR(50) DEFAULT 'PT{YYYY}{MM}{DD}-{###}' COMMENT 'Formato del número',
    permite_multiples BOOLEAN DEFAULT TRUE COMMENT 'Si permite múltiples pre-tickets por venta',
    maximo_pretickets_venta INT DEFAULT 5 COMMENT 'Máximo de pre-tickets por venta',

    -- Control de modificaciones
    bloquear_venta_tras_preticket BOOLEAN DEFAULT FALSE COMMENT 'Si bloquea modificaciones tras preticket',
    permitir_anulacion BOOLEAN DEFAULT TRUE COMMENT 'Si permite anular pre-tickets',
    tiempo_limite_anulacion INT DEFAULT 60 COMMENT 'Minutos límite para anular',

    -- Configuración de impresión
    impresion_automatica BOOLEAN DEFAULT TRUE COMMENT 'Si imprime automáticamente al generar',
    impresora_predeterminada INT NULL COMMENT 'Impresora por defecto',
    copias_predeterminadas INT DEFAULT 1 COMMENT 'Número de copias por defecto',
    incluir_logo BOOLEAN DEFAULT TRUE COMMENT 'Si incluye logo del restaurante',
    incluir_detalle_productos BOOLEAN DEFAULT TRUE COMMENT 'Si incluye detalle de productos',
    incluir_observaciones BOOLEAN DEFAULT TRUE COMMENT 'Si incluye observaciones',

    -- Configuraciones por rol/usuario
    tipo_config ENUM('global', 'rol', 'usuario', 'mesa') DEFAULT 'global',
    id_referencia INT NULL COMMENT 'ID del rol, usuario o mesa según el tipo',

    -- Control de permisos
    puede_generar BOOLEAN DEFAULT TRUE COMMENT 'Si puede generar pre-tickets',
    puede_anular BOOLEAN DEFAULT FALSE COMMENT 'Si puede anular pre-tickets',
    puede_reimprimir BOOLEAN DEFAULT TRUE COMMENT 'Si puede reimprimir pre-tickets',
    requiere_autorizacion BOOLEAN DEFAULT FALSE COMMENT 'Si requiere autorización supervisor',

    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tipo_config (tipo_config),
    INDEX idx_referencia (id_referencia),
    INDEX idx_activo (activo)
);

-- INSERTAR CONFIGURACIÓN GLOBAL POR DEFECTO
INSERT IGNORE INTO configuracion_pretickets (
    tipo_config,
    numeracion_automatica,
    permite_multiples,
    maximo_pretickets_venta,
    bloquear_venta_tras_preticket,
    impresion_automatica,
    copias_predeterminadas,
    puede_generar,
    puede_anular,
    puede_reimprimir
) VALUES (
    'global',
    TRUE,
    TRUE,
    5,
    FALSE,
    TRUE,
    1,
    TRUE,
    FALSE,
    TRUE
);

-- AGREGAR CAMPOS DE CONTROL A VENTADIRECTA
-- Nota: Usaremos campos existentes si están disponibles o agregaremos nuevos

-- CREAR TABLA PARA PLANTILLAS DE PRE-TICKETS
CREATE TABLE IF NOT EXISTS plantillas_pretickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,

    -- Configuración de la plantilla
    tipo_plantilla ENUM('ticket', 'cuenta', 'resumen', 'detallada') NOT NULL,
    formato_papel ENUM('58mm', '80mm', 'A4', 'A5') DEFAULT '80mm',
    orientacion ENUM('vertical', 'horizontal') DEFAULT 'vertical',

    -- Configuración de contenido
    incluir_encabezado BOOLEAN DEFAULT TRUE,
    incluir_fecha_hora BOOLEAN DEFAULT TRUE,
    incluir_mesa BOOLEAN DEFAULT TRUE,
    incluir_camarero BOOLEAN DEFAULT TRUE,
    incluir_comensales BOOLEAN DEFAULT TRUE,
    incluir_productos BOOLEAN DEFAULT TRUE,
    incluir_precios BOOLEAN DEFAULT TRUE,
    incluir_subtotales BOOLEAN DEFAULT TRUE,
    incluir_total BOOLEAN DEFAULT TRUE,
    incluir_pie BOOLEAN DEFAULT TRUE,

    -- Plantilla HTML/CSS
    template_html TEXT NULL,
    template_css TEXT NULL,

    activa BOOLEAN DEFAULT TRUE,
    predeterminada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tipo (tipo_plantilla),
    INDEX idx_activa (activa),
    INDEX idx_predeterminada (predeterminada)
);

-- INSERTAR PLANTILLA POR DEFECTO
INSERT IGNORE INTO plantillas_pretickets (
    nombre,
    descripcion,
    tipo_plantilla,
    formato_papel,
    predeterminada,
    template_html
) VALUES (
    'Ticket Estándar',
    'Plantilla estándar para pre-tickets',
    'ticket',
    '80mm',
    TRUE,
    '<!DOCTYPE html>
<html><head><style>
body { font-family: monospace; font-size: 12px; margin: 0; padding: 10px; }
.header { text-align: center; font-weight: bold; margin-bottom: 10px; }
.mesa { text-align: center; margin-bottom: 10px; }
.productos { margin-bottom: 10px; }
.producto { margin-bottom: 2px; }
.total { border-top: 1px solid #000; margin-top: 10px; padding-top: 5px; font-weight: bold; }
.footer { text-align: center; margin-top: 10px; font-size: 10px; }
</style></head>
<body>
<div class="header">{{restaurante_nombre}}<br>PRE-TICKET</div>
<div class="mesa">Mesa: {{mesa}} | Fecha: {{fecha}}</div>
<div class="productos">{{productos}}</div>
<div class="total">TOTAL: {{total}}</div>
<div class="footer">{{numero_preticket}}</div>
</body></html>'
);

-- CREAR VISTA PARA CONSULTAS RÁPIDAS
CREATE OR REPLACE VIEW vista_pretickets_resumen AS
SELECT
    p.id,
    p.id_venta,
    p.numero_preticket,
    p.fecha_generacion,
    p.tipo_preticket,
    p.total,
    p.estado,
    vd.Num_Mesa,
    m.descripcion as mesa_nombre,
    c.nombre as usuario_nombre,
    COUNT(pl.id) as total_lineas,
    SUM(pl.cantidad) as total_productos
FROM pretickets p
JOIN ventadirecta vd ON p.id_venta = vd.id_venta
JOIN mesa m ON vd.Num_Mesa = m.Num_Mesa
JOIN camareros c ON p.usuario_generacion = c.id_camarero
LEFT JOIN pretickets_lineas pl ON p.id = pl.preticket_id AND pl.incluido_preticket = TRUE
GROUP BY p.id, p.id_venta, p.numero_preticket, p.fecha_generacion,
         p.tipo_preticket, p.total, p.estado, vd.Num_Mesa,
         m.descripcion, c.nombre
ORDER BY p.fecha_generacion DESC;

-- COMENTARIOS PARA DOCUMENTACIÓN
ALTER TABLE pretickets
COMMENT = 'Pre-tickets generados para ventas - tickets preliminares antes del pago final';

ALTER TABLE pretickets_lineas
COMMENT = 'Líneas de productos incluidas en cada pre-ticket';

ALTER TABLE configuracion_pretickets
COMMENT = 'Configuración del sistema de pre-tickets por usuario, rol o global';

ALTER TABLE plantillas_pretickets
COMMENT = 'Plantillas de diseño para impresión de pre-tickets';

-- VERIFICACIÓN DE LA MIGRACIÓN
SELECT 'MIGRACIÓN PRE-TICKETS COMPLETADA EXITOSAMENTE' as status;