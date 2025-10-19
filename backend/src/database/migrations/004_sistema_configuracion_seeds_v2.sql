-- SEEDS 004: Datos Iniciales para Sistema de Configuración v2
-- DYSA Point Enterprise - Configuración de Red e Instalación
-- Fecha: 19 de Octubre 2025

-- ============================================================================
-- SEEDS: sistema_red (Configuración por defecto)
-- ============================================================================
INSERT INTO sistema_red (
  host_principal,
  puerto_api,
  puerto_events,
  ssl_activo,
  timeout_conexion,
  max_clients_sse,
  auto_discovery,
  configurado_por
) VALUES (
  'localhost',
  8547,
  8548,
  0,
  30,
  50,
  1,
  'sistema_inicial'
) ON DUPLICATE KEY UPDATE
  ultima_actualizacion = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEEDS: sistema_instalacion (Estado inicial no instalado)
-- ============================================================================
INSERT INTO sistema_instalacion (
  instalado,
  version_instalada,
  pasos_completados,
  instalado_por,
  configuracion_inicial
) VALUES (
  0,
  '2.0.0',
  JSON_OBJECT(
    'duenio', false,
    'restaurante', false,
    'sucursales', false,
    'red', false,
    'productos', false,
    'usuarios', false
  ),
  'pendiente',
  JSON_OBJECT(
    'fecha_inicio', NOW(),
    'version_sistema', '2.0.0',
    'entorno', 'produccion'
  )
) ON DUPLICATE KEY UPDATE
  ultima_verificacion = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEEDS: restaurante_duenio (Ejemplo para desarrollo - se reemplaza en setup)
-- ============================================================================
INSERT INTO restaurante_duenio (
  nombre_completo,
  rut_nif,
  tipo_documento,
  telefono,
  email,
  direccion,
  ciudad,
  pais
) VALUES (
  'DYSA Point Enterprise Demo',
  '12345678-9',
  'RUT',
  '+56 9 8765 4321',
  'admin@dysapoint.com',
  'Av. Providencia 123, Oficina 456',
  'Santiago',
  'Chile'
) ON DUPLICATE KEY UPDATE
  ultima_actualizacion = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEEDS: restaurante_sucursal (Sucursal demo)
-- ============================================================================
INSERT INTO restaurante_sucursal (
  duenio_id,
  nombre_comercial,
  direccion,
  ciudad,
  region,
  telefono,
  email,
  horario_apertura,
  horario_cierre,
  dias_operacion,
  es_principal,
  capacidad_personas,
  tipo_cocina
) VALUES (
  1, -- Asume que el dueño tiene ID 1
  'Restaurante Demo Principal',
  'Calle Principal 789, Local 1',
  'Santiago',
  'Región Metropolitana',
  '+56 2 2345 6789',
  'principal@restaurantedemo.cl',
  '11:00:00',
  '23:00:00',
  'L-D',
  1,
  80,
  'Cocina Internacional'
) ON DUPLICATE KEY UPDATE
  ultima_actualizacion = CURRENT_TIMESTAMP;

-- ============================================================================
-- SEEDS: sistema_logs_config (Log inicial del sistema)
-- ============================================================================
INSERT INTO sistema_logs_config (
  tipo_cambio,
  tabla_afectada,
  usuario,
  accion,
  datos_nuevos,
  ip_origen
) VALUES (
  'INSTALACION',
  'sistema_instalacion',
  'sistema_inicial',
  'CREATE',
  JSON_OBJECT(
    'evento', 'seeds_iniciales_aplicados',
    'version', '2.0.0',
    'timestamp', NOW()
  ),
  '127.0.0.1'
);

-- ============================================================================
-- VERIFICACIÓN: Mostrar configuración inicial creada
-- ============================================================================
-- Estas queries se pueden usar para verificar que todo se creó correctamente

-- SELECT 'CONFIGURACIÓN DE RED' as tabla, r.* FROM sistema_red r WHERE r.activo = 1;
-- SELECT 'ESTADO INSTALACIÓN' as tabla, i.instalado, i.version_instalada, i.pasos_completados FROM sistema_instalacion i;
-- SELECT 'DUEÑO' as tabla, d.nombre_completo, d.rut_nif, d.telefono FROM restaurante_duenio d WHERE d.activo = 1;
-- SELECT 'SUCURSALES' as tabla, s.nombre_comercial, s.ciudad, s.es_principal FROM restaurante_sucursal s WHERE s.activo = 1;

-- ============================================================================
-- FIN SEEDS 004
-- ============================================================================