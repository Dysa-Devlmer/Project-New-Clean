-- ========================================
-- MIGRACIÓN: Sistema de Tarifas Múltiples
-- Funcionalidad Crítica #4 del Sistema Anterior
-- Fecha: 2025-10-13 19:05
-- ========================================

-- CREAR TABLA PRINCIPAL PARA TARIFAS MÚLTIPLES
CREATE TABLE IF NOT EXISTS tarifas_multiples (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL COMMENT 'Nombre descriptivo de la tarifa',
    codigo VARCHAR(20) NOT NULL UNIQUE COMMENT 'Código único de la tarifa',

    -- Configuración de la tarifa
    tipo_tarifa ENUM('descuento', 'recargo', 'precio_fijo', 'precio_especial') NOT NULL,
    valor_tarifa DECIMAL(10,4) NOT NULL COMMENT 'Valor o porcentaje de la tarifa',
    es_porcentaje BOOLEAN DEFAULT FALSE COMMENT 'Si el valor es porcentaje o monto fijo',

    -- Condiciones de aplicación
    aplica_por_horario BOOLEAN DEFAULT FALSE,
    aplica_por_dia_semana BOOLEAN DEFAULT FALSE,
    aplica_por_fecha BOOLEAN DEFAULT FALSE,
    aplica_por_tipo_cliente BOOLEAN DEFAULT FALSE,
    aplica_por_producto BOOLEAN DEFAULT FALSE,
    aplica_por_categoria BOOLEAN DEFAULT FALSE,
    aplica_por_mesa BOOLEAN DEFAULT FALSE,
    aplica_por_zona BOOLEAN DEFAULT FALSE,

    -- Configuraciones específicas
    horario_inicio TIME NULL COMMENT 'Hora de inicio (si aplica por horario)',
    horario_fin TIME NULL COMMENT 'Hora de fin (si aplica por horario)',
    dias_semana SET('lunes','martes','miercoles','jueves','viernes','sabado','domingo') NULL,
    fecha_inicio DATE NULL COMMENT 'Fecha de inicio de vigencia',
    fecha_fin DATE NULL COMMENT 'Fecha de fin de vigencia',

    -- Configuración de cliente
    tipo_cliente_id INT NULL COMMENT 'ID del tipo de cliente específico',
    requiere_codigo_cliente BOOLEAN DEFAULT FALSE,

    -- Configuración de productos/categorías
    productos_incluidos JSON NULL COMMENT 'Array de IDs de productos incluidos',
    productos_excluidos JSON NULL COMMENT 'Array de IDs de productos excluidos',
    categorias_incluidas JSON NULL COMMENT 'Array de IDs de categorías incluidas',
    categorias_excluidas JSON NULL COMMENT 'Array de IDs de categorías excluidas',

    -- Configuración de mesas/zonas
    mesas_incluidas JSON NULL COMMENT 'Array de números de mesas incluidas',
    mesas_excluidas JSON NULL COMMENT 'Array de números de mesas excluidas',
    zonas_incluidas JSON NULL COMMENT 'Array de zonas incluidas',
    zonas_excluidas JSON NULL COMMENT 'Array de zonas excluidas',

    -- Límites y restricciones
    monto_minimo_compra DECIMAL(10,2) NULL COMMENT 'Monto mínimo para aplicar tarifa',
    monto_maximo_descuento DECIMAL(10,2) NULL COMMENT 'Descuento máximo a aplicar',
    cantidad_maxima_aplicaciones INT NULL COMMENT 'Máximo de veces que se puede aplicar',
    aplicaciones_por_cliente INT NULL COMMENT 'Aplicaciones por cliente específico',

    -- Prioridad y combinabilidad
    prioridad INT DEFAULT 0 COMMENT 'Prioridad de aplicación (mayor número = mayor prioridad)',
    es_combinable BOOLEAN DEFAULT TRUE COMMENT 'Si se puede combinar con otras tarifas',
    tarifas_incompatibles JSON NULL COMMENT 'Array de IDs de tarifas incompatibles',

    -- Estado y control
    activa BOOLEAN DEFAULT TRUE,
    requiere_autorizacion BOOLEAN DEFAULT FALSE COMMENT 'Si requiere autorización de supervisor',
    nivel_autorizacion ENUM('camarero', 'supervisor', 'gerente', 'admin') DEFAULT 'camarero',

    -- Observaciones y motivos
    descripcion TEXT NULL COMMENT 'Descripción detallada de la tarifa',
    motivo_creacion VARCHAR(255) NULL COMMENT 'Motivo de creación de la tarifa',
    observaciones TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT NULL COMMENT 'Usuario que creó la tarifa',
    updated_by INT NULL COMMENT 'Usuario que modificó la tarifa',

    INDEX idx_codigo (codigo),
    INDEX idx_tipo_tarifa (tipo_tarifa),
    INDEX idx_activa (activa),
    INDEX idx_fecha_vigencia (fecha_inicio, fecha_fin),
    INDEX idx_horario (horario_inicio, horario_fin),
    INDEX idx_prioridad (prioridad),
    INDEX idx_tipo_cliente (tipo_cliente_id)
);

-- CREAR TABLA PARA HISTORIAL DE APLICACIONES DE TARIFAS
CREATE TABLE IF NOT EXISTS historial_tarifas_aplicadas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tarifa_id INT NOT NULL,
    id_venta INT NOT NULL,
    id_linea_venta INT NULL COMMENT 'Línea específica si aplica por producto',

    -- Información de la aplicación
    fecha_aplicacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    usuario_aplicacion INT NOT NULL COMMENT 'Usuario que aplicó la tarifa',
    metodo_aplicacion ENUM('automatico', 'manual', 'codigo_cliente') NOT NULL,

    -- Valores de la aplicación
    valor_original DECIMAL(10,2) NOT NULL COMMENT 'Precio original antes de la tarifa',
    valor_tarifa_aplicada DECIMAL(10,4) NOT NULL COMMENT 'Valor de tarifa aplicado',
    valor_final DECIMAL(10,2) NOT NULL COMMENT 'Precio final después de la tarifa',
    descuento_aplicado DECIMAL(10,2) NOT NULL COMMENT 'Monto de descuento/recargo aplicado',

    -- Información adicional
    codigo_cliente VARCHAR(50) NULL COMMENT 'Código de cliente usado (si aplica)',
    autorizacion_supervisor INT NULL COMMENT 'ID del supervisor que autorizó',
    observaciones VARCHAR(255) NULL,

    -- Estado
    estado ENUM('aplicada', 'anulada', 'revertida') DEFAULT 'aplicada',
    fecha_anulacion DATETIME NULL,
    usuario_anulacion INT NULL,
    motivo_anulacion VARCHAR(255) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tarifa_id) REFERENCES tarifas_multiples(id) ON DELETE CASCADE,
    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (usuario_aplicacion) REFERENCES camareros(id_camarero) ON DELETE CASCADE,
    FOREIGN KEY (autorizacion_supervisor) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_tarifa (tarifa_id),
    INDEX idx_venta (id_venta),
    INDEX idx_fecha_aplicacion (fecha_aplicacion),
    INDEX idx_usuario_aplicacion (usuario_aplicacion),
    INDEX idx_estado (estado),
    INDEX idx_metodo_aplicacion (metodo_aplicacion)
);

-- CREAR TABLA PARA CONFIGURACIÓN DE TARIFAS POR USUARIO/ROL
CREATE TABLE IF NOT EXISTS configuracion_tarifas (
    id INT PRIMARY KEY AUTO_INCREMENT,

    -- Configuraciones de aplicación
    aplicacion_automatica BOOLEAN DEFAULT TRUE COMMENT 'Si aplica tarifas automáticamente',
    mostrar_precios_originales BOOLEAN DEFAULT TRUE COMMENT 'Si muestra precios antes de tarifa',
    permitir_aplicacion_manual BOOLEAN DEFAULT TRUE COMMENT 'Si permite aplicar manualmente',
    permitir_anulacion BOOLEAN DEFAULT FALSE COMMENT 'Si permite anular tarifas aplicadas',
    tiempo_limite_anulacion INT DEFAULT 30 COMMENT 'Minutos límite para anular',

    -- Control de permisos
    puede_aplicar_descuentos BOOLEAN DEFAULT TRUE,
    puede_aplicar_recargos BOOLEAN DEFAULT FALSE,
    puede_aplicar_precios_especiales BOOLEAN DEFAULT FALSE,
    requiere_autorizacion_descuentos BOOLEAN DEFAULT FALSE,
    requiere_autorizacion_recargos BOOLEAN DEFAULT TRUE,
    maximo_descuento_sin_autorizacion DECIMAL(5,2) DEFAULT 10.00 COMMENT 'Porcentaje máximo sin autorización',

    -- Configuraciones de visualización
    mostrar_tarifa_en_ticket BOOLEAN DEFAULT TRUE,
    mostrar_ahorro_cliente BOOLEAN DEFAULT TRUE,
    formato_visualizacion ENUM('porcentaje', 'monto', 'ambos') DEFAULT 'ambos',

    -- Configuraciones por tipo
    tipo_config ENUM('global', 'rol', 'usuario') DEFAULT 'global',
    id_referencia INT NULL COMMENT 'ID del rol o usuario según el tipo',

    -- Configuraciones de notificaciones
    notificar_aplicacion_automatica BOOLEAN DEFAULT FALSE,
    notificar_tarifas_especiales BOOLEAN DEFAULT TRUE,
    notificar_errores_aplicacion BOOLEAN DEFAULT TRUE,

    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tipo_config (tipo_config),
    INDEX idx_referencia (id_referencia),
    INDEX idx_activo (activo)
);

-- CREAR TABLA PARA TIPOS DE CLIENTE (para tarifas específicas)
CREATE TABLE IF NOT EXISTS tipos_cliente_tarifas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    descripcion TEXT NULL,

    -- Configuración del tipo
    requiere_codigo_acceso BOOLEAN DEFAULT FALSE,
    codigo_acceso VARCHAR(20) NULL COMMENT 'Código que debe ingresar el cliente',
    requiere_identificacion BOOLEAN DEFAULT FALSE,

    -- Configuración de descuentos
    descuento_general DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Descuento general para este tipo',
    descuento_maximo DECIMAL(5,2) DEFAULT 100.00 COMMENT 'Descuento máximo permitido',

    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_codigo (codigo),
    INDEX idx_activo (activo)
);

-- CREAR TABLA PARA CÓDIGOS DE DESCUENTO/PROMOCIÓN
CREATE TABLE IF NOT EXISTS codigos_promocion (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tarifa_id INT NOT NULL,

    codigo VARCHAR(50) NOT NULL UNIQUE COMMENT 'Código que ingresa el cliente',
    tipo_codigo ENUM('descuento', 'promocion', 'cupon') DEFAULT 'descuento',

    -- Configuración del código
    usos_maximos INT NULL COMMENT 'Máximo de usos del código',
    usos_actuales INT DEFAULT 0 COMMENT 'Usos actuales del código',
    usos_por_cliente INT DEFAULT 1 COMMENT 'Máximo de usos por cliente',

    -- Vigencia
    fecha_inicio DATE NULL,
    fecha_fin DATE NULL,
    activo BOOLEAN DEFAULT TRUE,

    -- Información adicional
    descripcion VARCHAR(255) NULL,
    observaciones TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (tarifa_id) REFERENCES tarifas_multiples(id) ON DELETE CASCADE,

    INDEX idx_codigo (codigo),
    INDEX idx_tarifa (tarifa_id),
    INDEX idx_fecha_vigencia (fecha_inicio, fecha_fin),
    INDEX idx_activo (activo)
);

-- CREAR TABLA PARA EVENTOS ESPECIALES DE TARIFAS
CREATE TABLE IF NOT EXISTS eventos_tarifas_especiales (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT NULL,

    -- Configuración del evento
    fecha_inicio DATETIME NOT NULL,
    fecha_fin DATETIME NOT NULL,
    tipo_evento ENUM('happy_hour', 'promocion_especial', 'evento_corporativo', 'celebracion') NOT NULL,

    -- Tarifas aplicables
    tarifas_aplicables JSON NOT NULL COMMENT 'Array de IDs de tarifas aplicables',
    tarifas_suspendidas JSON NULL COMMENT 'Array de IDs de tarifas suspendidas durante el evento',

    -- Configuración especial
    requiere_activacion_manual BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    activado_por INT NULL COMMENT 'Usuario que activó el evento',
    fecha_activacion DATETIME NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_fecha_evento (fecha_inicio, fecha_fin),
    INDEX idx_tipo_evento (tipo_evento),
    INDEX idx_activo (activo)
);

-- INSERTAR CONFIGURACIÓN GLOBAL POR DEFECTO
INSERT IGNORE INTO configuracion_tarifas (
    tipo_config,
    aplicacion_automatica,
    mostrar_precios_originales,
    permitir_aplicacion_manual,
    permitir_anulacion,
    puede_aplicar_descuentos,
    puede_aplicar_recargos,
    requiere_autorizacion_recargos,
    maximo_descuento_sin_autorizacion
) VALUES (
    'global',
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    TRUE,
    FALSE,
    TRUE,
    10.00
);

-- INSERTAR TIPOS DE CLIENTE POR DEFECTO
INSERT IGNORE INTO tipos_cliente_tarifas (nombre, codigo, descripcion, descuento_general) VALUES
('Cliente Regular', 'REGULAR', 'Cliente sin descuentos especiales', 0.00),
('Cliente VIP', 'VIP', 'Cliente con descuentos preferenciales', 5.00),
('Cliente Corporativo', 'CORP', 'Cliente empresarial con tarifas especiales', 10.00),
('Empleado', 'EMP', 'Empleado del restaurante', 15.00),
('Tercera Edad', 'SENIOR', 'Cliente adulto mayor', 8.00);

-- INSERTAR TARIFAS DE EJEMPLO
INSERT IGNORE INTO tarifas_multiples (
    nombre, codigo, tipo_tarifa, valor_tarifa, es_porcentaje,
    aplica_por_horario, horario_inicio, horario_fin,
    descripcion, activa
) VALUES
('Happy Hour', 'HAPPY_HOUR', 'descuento', 15.00, TRUE,
 TRUE, '17:00:00', '19:00:00',
 'Descuento del 15% en horario de happy hour', TRUE),

('Descuento Fin de Semana', 'FIN_SEMANA', 'descuento', 10.00, TRUE,
 FALSE, NULL, NULL,
 'Descuento del 10% los fines de semana', TRUE),

('Recargo Nocturno', 'NOCTURNO', 'recargo', 10.00, TRUE,
 TRUE, '22:00:00', '06:00:00',
 'Recargo del 10% en horario nocturno', TRUE);

-- CREAR VISTA PARA CONSULTAS RÁPIDAS DE TARIFAS ACTIVAS
CREATE OR REPLACE VIEW vista_tarifas_activas AS
SELECT
    tm.id,
    tm.nombre,
    tm.codigo,
    tm.tipo_tarifa,
    tm.valor_tarifa,
    tm.es_porcentaje,
    tm.aplica_por_horario,
    tm.horario_inicio,
    tm.horario_fin,
    tm.aplica_por_dia_semana,
    tm.dias_semana,
    tm.fecha_inicio,
    tm.fecha_fin,
    tm.prioridad,
    tm.es_combinable,
    tm.requiere_autorizacion,
    tm.nivel_autorizacion,
    tm.descripcion,
    CASE
        WHEN tm.fecha_inicio IS NOT NULL AND tm.fecha_fin IS NOT NULL THEN
            CASE WHEN CURDATE() BETWEEN tm.fecha_inicio AND tm.fecha_fin THEN 'vigente' ELSE 'no_vigente' END
        ELSE 'sin_fecha'
    END as estado_vigencia,
    CASE
        WHEN tm.aplica_por_horario = TRUE THEN
            CASE WHEN CURTIME() BETWEEN tm.horario_inicio AND tm.horario_fin THEN 'activo' ELSE 'inactivo' END
        ELSE 'sin_horario'
    END as estado_horario
FROM tarifas_multiples tm
WHERE tm.activa = TRUE
ORDER BY tm.prioridad DESC, tm.nombre;

-- COMENTARIOS PARA DOCUMENTACIÓN
ALTER TABLE tarifas_multiples
COMMENT = 'Sistema de tarifas múltiples - precios diferenciados por condiciones';

ALTER TABLE historial_tarifas_aplicadas
COMMENT = 'Historial de aplicación de tarifas para auditoría y reportes';

ALTER TABLE configuracion_tarifas
COMMENT = 'Configuración del sistema de tarifas por usuario, rol o global';

ALTER TABLE tipos_cliente_tarifas
COMMENT = 'Tipos de cliente para aplicación de tarifas específicas';

ALTER TABLE codigos_promocion
COMMENT = 'Códigos de descuento y promoción para clientes';

ALTER TABLE eventos_tarifas_especiales
COMMENT = 'Eventos especiales que modifican la aplicación de tarifas';

-- VERIFICACIÓN DE LA MIGRACIÓN
SELECT 'MIGRACIÓN TARIFAS MÚLTIPLES COMPLETADA EXITOSAMENTE' as status;