-- =====================================================
-- SCRIPT CREACIÓN TABLA configuracion_sistema
-- Para DYSA Point - FASE 2
-- Fecha: 19 Octubre 2025, 02:50 AM
-- =====================================================

-- Crear tabla configuracion_sistema
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    id INT AUTO_INCREMENT PRIMARY KEY,
    clave_configuracion VARCHAR(100) NOT NULL UNIQUE,
    valor_configuracion TEXT NOT NULL,
    descripcion_configuracion VARCHAR(255),
    tipo_valor ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    categoria_configuracion VARCHAR(50) DEFAULT 'general',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    activa TINYINT(1) DEFAULT 1,
    INDEX idx_categoria (categoria_configuracion),
    INDEX idx_clave (clave_configuracion),
    INDEX idx_activa (activa)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Configuraciones del sistema DYSA Point';

-- Insertar configuraciones básicas por defecto
INSERT INTO configuracion_sistema (clave_configuracion, valor_configuracion, descripcion_configuracion, tipo_valor, categoria_configuracion) VALUES

-- CATEGORÍA: restaurante (datos empresa)
('nombre_empresa', 'DYSA Point Restaurant', 'Nombre oficial de la empresa/restaurante', 'string', 'restaurante'),
('rut_empresa', '12.345.678-9', 'RUT/identificación fiscal de la empresa', 'string', 'restaurante'),
('direccion_empresa', 'Av. Principal 123, Santiago, Chile', 'Dirección física de la empresa', 'string', 'restaurante'),
('telefono_empresa', '+56 9 1234 5678', 'Teléfono principal de contacto', 'string', 'restaurante'),
('email_empresa', 'contacto@dysapoint.com', 'Email de contacto principal', 'string', 'restaurante'),
('sitio_web', 'www.dysapoint.com', 'Sitio web de la empresa', 'string', 'restaurante'),
('logo_url', '', 'URL del logo de la empresa', 'string', 'restaurante'),
('descripcion_empresa', 'Restaurante especializado en comida gourmet', 'Descripción breve de la empresa', 'string', 'restaurante'),

-- CATEGORÍA: sistema (configuraciones técnicas)
('version_sistema', '3.0.0', 'Versión actual del sistema', 'string', 'sistema'),
('modo_mantenimiento', 'false', 'Activar modo mantenimiento', 'boolean', 'sistema'),
('sistema_activo', 'true', 'Sistema en funcionamiento', 'boolean', 'sistema'),
('zona_horaria', 'America/Santiago', 'Zona horaria del sistema', 'string', 'sistema'),
('idioma_predeterminado', 'es', 'Idioma por defecto', 'string', 'sistema'),
('formato_fecha', 'DD/MM/YYYY', 'Formato de fecha predeterminado', 'string', 'sistema'),

-- CATEGORÍA: ventas (configuraciones de ventas)
('moneda', 'CLP', 'Moneda utilizada en el sistema', 'string', 'ventas'),
('simbolo_moneda', '$', 'Símbolo de la moneda', 'string', 'ventas'),
('iva_porcentaje', '19', 'Porcentaje de IVA aplicado', 'number', 'ventas'),
('permitir_descuentos', 'true', 'Permitir aplicar descuentos', 'boolean', 'ventas'),
('descuento_maximo', '50', 'Descuento máximo permitido (%)', 'number', 'ventas'),
('redondeo_centavos', 'true', 'Redondear a centavos', 'boolean', 'ventas'),

-- CATEGORÍA: impresion (configuraciones de impresión)
('imprimir_logo', 'true', 'Incluir logo en impresiones', 'boolean', 'impresion'),
('imprimir_direccion', 'true', 'Incluir dirección en tickets', 'boolean', 'impresion'),
('imprimir_telefono', 'true', 'Incluir teléfono en tickets', 'boolean', 'impresion'),
('formato_ticket', 'A4', 'Formato de impresión de tickets', 'string', 'impresion'),
('impresora_tickets', 'default', 'Impresora para tickets', 'string', 'impresion'),
('impresora_cocina', 'default', 'Impresora para órdenes de cocina', 'string', 'impresion'),

-- CATEGORÍA: mesas (configuraciones de mesas)
('total_mesas', '20', 'Número total de mesas', 'number', 'mesas'),
('mesas_activas', '18', 'Mesas actualmente activas', 'number', 'mesas'),
('numeracion_mesas', 'consecutiva', 'Tipo de numeración de mesas', 'string', 'mesas'),

-- CATEGORÍA: cocina (configuraciones de cocina)
('bloques_cocina', '4', 'Número de bloques de cocina', 'number', 'cocina'),
('tiempo_preparacion_promedio', '15', 'Tiempo promedio de preparación (min)', 'number', 'cocina'),
('alertas_cocina', 'true', 'Activar alertas de cocina', 'boolean', 'cocina'),

-- CATEGORÍA: empleados (configuraciones de empleados)
('total_empleados', '8', 'Número total de empleados', 'number', 'empleados'),
('empleados_activos', '6', 'Empleados actualmente activos', 'number', 'empleados'),
('turno_trabajo_horas', '8', 'Horas por turno de trabajo', 'number', 'empleados'),

-- CATEGORÍA: seguridad (configuraciones de seguridad)
('session_timeout', '3600', 'Tiempo de sesión en segundos', 'number', 'seguridad'),
('max_intentos_login', '5', 'Máximo intentos de login', 'number', 'seguridad'),
('backup_automatico', 'true', 'Backup automático activado', 'boolean', 'seguridad'),

-- CATEGORÍA: notificaciones (configuraciones de notificaciones)
('email_notificaciones', 'true', 'Enviar notificaciones por email', 'boolean', 'notificaciones'),
('sms_notificaciones', 'false', 'Enviar notificaciones por SMS', 'boolean', 'notificaciones'),
('alertas_stock_minimo', 'true', 'Alertas de stock mínimo', 'boolean', 'notificaciones');

-- Verificar inserción
SELECT COUNT(*) as total_configuraciones FROM configuracion_sistema;
SELECT DISTINCT categoria_configuracion as categorias FROM configuracion_sistema;