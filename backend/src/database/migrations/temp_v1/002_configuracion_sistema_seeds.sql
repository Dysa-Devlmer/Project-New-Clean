-- =====================================================
-- MIGRACIÓN 002: Datos Semilla - Configuración Sistema
-- Para DYSA Point - FASE 2.1
-- Fecha: 19 Octubre 2025
-- =====================================================

-- Insertar empresa demo por defecto
INSERT INTO configuracion_empresa (
    id, razon_social, nombre_comercial, rut_nif, direccion_fiscal,
    telefono, email, sitio_web, descripcion
) VALUES (
    1,
    'DYSA Point Restaurant S.A.',
    'DYSA Point',
    '12.345.678-9',
    'Av. Principal 123, Santiago, Chile',
    '+56 9 1234 5678',
    'contacto@dysapoint.com',
    'www.dysapoint.com',
    'Restaurante especializado en comida gourmet con sistema POS avanzado'
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración fiscal por defecto
INSERT INTO configuracion_fiscal (
    empresa_id, moneda_principal, simbolo_moneda, iva_defecto,
    serie_factura, numeracion_inicio, formato_factura, decimales_moneda
) VALUES (
    1, 'CLP', '$', 19.00, 'F', 1, 'estandar', 0
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración operativa por defecto
INSERT INTO configuracion_operativa (
    empresa_id, zona_horaria, formato_fecha, formato_hora,
    idioma_predeterminado, idiomas_disponibles, moneda_decimales
) VALUES (
    1, 'America/Santiago', 'DD/MM/YYYY', 'HH:mm', 'es',
    '["es", "en"]', 0
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración del restaurante por defecto
INSERT INTO config_restaurante (
    empresa_id, nombre_establecimiento, tipo_restaurante, capacidad_maxima,
    total_mesas, mesas_activas, bloques_cocina, tiempo_preparacion_promedio
) VALUES (
    1, 'DYSA Point Restaurant', 'casual', 80, 20, 18, 4, 15
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración de ventas por defecto
INSERT INTO config_ventas (
    empresa_id, iva_porcentaje, permitir_descuentos, descuento_maximo,
    permitir_propinas, propina_sugerida, redondeo_activo, redondeo_valor
) VALUES (
    1, 19.00, 1, 50.00, 1, 10.00, 1, 0.05
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración de empleados por defecto
INSERT INTO config_empleados (
    empresa_id, total_empleados, empleados_activos, turnos_activos,
    control_horario, permisos_avanzados
) VALUES (
    1, 8, 6, 2, 1, 0
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración de impresión por defecto
INSERT INTO config_impresion (
    empresa_id, imprimir_logo, imprimir_direccion, imprimir_telefono, imprimir_rut,
    tamano_papel, orientacion, margen_superior, margen_inferior,
    impresora_tickets, impresora_cocina
) VALUES (
    1, 1, 1, 1, 1, 'A4', 'portrait', 10, 10, 'default', 'default'
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración del sistema por defecto
INSERT INTO config_sistema (
    empresa_id, version_sistema, ambiente, modo_mantenimiento,
    backup_automatico, backup_frecuencia, debug_mode, ssl_activo
) VALUES (
    1, '3.0.0', 'produccion', 0, 1, 'diario', 0, 0
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar configuración de seguridad por defecto
INSERT INTO config_seguridad (
    empresa_id, sesion_timeout, intentos_login_max, bloqueo_temporal,
    auditoria_activa, logs_detallados, backup_encriptado
) VALUES (
    1, 3600, 5, 300, 1, 0, 1
) ON DUPLICATE KEY UPDATE
    updated_at = CURRENT_TIMESTAMP;

-- Insertar estado runtime inicial
INSERT INTO config_estado_runtime (
    empresa_id, sistema_activo, base_datos_conectada, servidor_funcionando,
    usuarios_conectados, ventas_hoy, ingresos_hoy
) VALUES (
    1, 1, 1, 1, 0, 0, 0.00
) ON DUPLICATE KEY UPDATE
    ultima_actualizacion = CURRENT_TIMESTAMP;

-- Verificar inserciones
SELECT 'Configuraciones insertadas correctamente:' as status;
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
    'config_estado_runtime' as tabla, COUNT(*) as registros
FROM config_estado_runtime;