-- =====================================================
-- MIGRACIÓN 002: Seeds Configuración v2
-- DYSA Point - 19 Oct 2025
-- Seeds para poblar las tablas con datos iniciales
-- Se ejecuta DESPUÉS de que todas las tablas existan
-- =====================================================

-- Actualizar empresa existente con datos demo mejorados
UPDATE configuracion_empresa
SET
  razon_social = 'DYSA Point Enterprise S.A.',
  nombre_comercial = 'DYSA Point Restaurant',
  rut_empresa = '76.123.456-7',
  direccion = 'Av. Providencia 1234, Santiago, Chile',
  telefono_principal = '+56 2 2345 6789',
  email_principal = 'contacto@dysapoint.com',
  sitio_web = 'https://www.dysapoint.com',
  updated_at = CURRENT_TIMESTAMP
WHERE id = 1;

-- Obtener el ID de la empresa (será 1 en la mayoría de casos)
SET @empresa_id = 1;

-- Insertar configuración fiscal por defecto
INSERT INTO configuracion_fiscal
  (empresa_id, moneda_principal, simbolo_moneda, iva_defecto, serie_factura, numeracion_inicio, formato_factura)
VALUES
  (@empresa_id, 'CLP', '$', 19.00, 'F', 1, 'F{serie}-{numero:06d}')
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración operativa con JSON válido
INSERT INTO configuracion_operativa
  (empresa_id, zona_horaria, formato_fecha, formato_hora, idioma_predeterminado, idiomas_disponibles, moneda_decimales)
VALUES
  (@empresa_id, 'America/Santiago', 'DD/MM/YYYY', 'HH:mm', 'es',
   JSON_ARRAY('es','en'), 0)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración del restaurante por defecto
INSERT INTO config_restaurante
  (empresa_id, nombre_establecimiento, tipo_restaurante, capacidad_maxima, total_mesas, mesas_activas, bloques_cocina, tiempo_preparacion_promedio)
VALUES
  (@empresa_id, 'DYSA Point Restaurant', 'Restaurante', 80, 20, 18, 4, 15)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración de ventas por defecto
INSERT INTO config_ventas
  (empresa_id, iva_porcentaje, permitir_descuentos, descuento_maximo, permitir_propinas, propina_sugerida, redondeo_activo, redondeo_valor)
VALUES
  (@empresa_id, 19.00, 1, 50.00, 1, 10.00, 0, 50)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración de empleados por defecto
INSERT INTO config_empleados
  (empresa_id, total_empleados, empleados_activos, turnos_activos, control_horario, permisos_avanzados)
VALUES
  (@empresa_id, 8, 6, 1, 1, 0)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración de impresión por defecto
INSERT INTO config_impresion
  (empresa_id, imprimir_logo, imprimir_direccion, imprimir_telefono, imprimir_rut, tamano_papel, orientacion, margen_superior, margen_inferior)
VALUES
  (@empresa_id, 1, 1, 1, 1, 'A4', 'portrait', 20, 20)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración del sistema por defecto
INSERT INTO config_sistema
  (empresa_id, version, ambiente, modo_mantenimiento, backup_automatico, backup_frecuencia, ultimo_backup, debug_mode, ssl_activo)
VALUES
  (@empresa_id, '3.0.0', 'production', 0, 1, 'diario', NOW(), 0, 0)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración de seguridad por defecto
INSERT INTO config_seguridad
  (empresa_id, sesion_timeout, intentos_login_max, bloqueo_temporal, auditoria_activa, logs_detallados, backup_encriptado)
VALUES
  (@empresa_id, 480, 5, 15, 1, 1, 0)
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Insertar categorías por defecto con colores y iconos mejorados
INSERT INTO categorias (nombre, descripcion, activa, orden, color_hex, icono)
VALUES
  ('Bebidas', 'Bebidas frías y calientes', 1, 1, '#2F80ED', 'cup'),
  ('Entradas', 'Platos para compartir', 1, 2, '#27AE60', 'sparkles'),
  ('Fondos', 'Platos principales', 1, 3, '#F2994A', 'utensils'),
  ('Postres', 'Dulces y helados', 1, 4, '#BB6BD9', 'ice-cream'),
  ('Ensaladas', 'Ensaladas y platos vegetarianos', 1, 5, '#27ae60', 'seedling'),
  ('Sopas', 'Sopas y cremas', 1, 6, '#e67e22', 'bowl-hot'),
  ('Mariscos', 'Platos de mariscos y pescados', 1, 7, '#1abc9c', 'fish'),
  ('Pastas', 'Pastas y platos italianos', 1, 8, '#9b59b6', 'pizza-slice')
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

-- Verificar que los datos se insertaron correctamente
SELECT 'Seeds insertados correctamente:' as status;

SELECT
  'configuracion_empresa' as tabla, COUNT(*) as registros
FROM configuracion_empresa
UNION ALL
SELECT
  'configuracion_fiscal' as tabla, COUNT(*) as registros
FROM configuracion_fiscal
UNION ALL
SELECT
  'configuracion_operativa' as tabla, COUNT(*) as registros
FROM configuracion_operativa
UNION ALL
SELECT
  'config_restaurante' as tabla, COUNT(*) as registros
FROM config_restaurante
UNION ALL
SELECT
  'config_ventas' as tabla, COUNT(*) as registros
FROM config_ventas
UNION ALL
SELECT
  'config_empleados' as tabla, COUNT(*) as registros
FROM config_empleados
UNION ALL
SELECT
  'config_impresion' as tabla, COUNT(*) as registros
FROM config_impresion
UNION ALL
SELECT
  'config_sistema' as tabla, COUNT(*) as registros
FROM config_sistema
UNION ALL
SELECT
  'config_seguridad' as tabla, COUNT(*) as registros
FROM config_seguridad
UNION ALL
SELECT
  'categorias' as tabla, COUNT(*) as registros
FROM categorias;