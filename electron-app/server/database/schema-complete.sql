-- =============================================
-- DYSA Point POS - ESQUEMA COMPLETO PROFESIONAL
-- Sistema TPV Empresarial para Restaurantes
-- TODAS las funcionalidades del sistema original + mejoras
-- =============================================

-- Configurar charset y collation
SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;

-- Crear base de datos si no existe
CREATE DATABASE IF NOT EXISTS dysa_point
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE dysa_point;

-- =============================================
-- MÓDULO 1: CONFIGURACIÓN DEL RESTAURANTE
-- =============================================

-- Información completa del restaurante
CREATE TABLE IF NOT EXISTS restaurant_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    -- Datos básicos
    name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(200) NOT NULL,
    rut VARCHAR(50),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    website VARCHAR(200),

    -- Dirección completa
    address TEXT NOT NULL,
    comuna VARCHAR(100),
    ciudad VARCHAR(100),
    region VARCHAR(100),
    codigo_postal VARCHAR(20),

    -- Información legal
    giro_comercial VARCHAR(200),
    razon_social VARCHAR(200),

    -- Configuración operacional
    currency VARCHAR(3) DEFAULT 'CLP',
    timezone VARCHAR(50) DEFAULT 'America/Santiago',
    language VARCHAR(2) DEFAULT 'es',

    -- Horarios
    hora_apertura TIME DEFAULT '08:00:00',
    hora_cierre TIME DEFAULT '23:00:00',
    dias_operacion JSON, -- ['Lunes', 'Martes', ...]

    -- Configuración fiscal
    regimen_tributario VARCHAR(50),
    actividad_economica VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- MÓDULO 2: SISTEMA DE USUARIOS Y ROLES
-- =============================================

-- Roles del sistema
CREATE TABLE IF NOT EXISTS roles (
    id_rol INT PRIMARY KEY AUTO_INCREMENT,
    codigo_rol VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    nivel_jerarquia INT DEFAULT 1, -- 1=bajo, 10=alto
    activo CHAR(1) DEFAULT 'S',
    color VARCHAR(7) DEFAULT '#2196F3',
    icono VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permisos granulares del sistema
CREATE TABLE IF NOT EXISTS permisos_sistema (
    id_permiso INT PRIMARY KEY AUTO_INCREMENT,
    codigo_permiso VARCHAR(50) UNIQUE NOT NULL,
    nombre_permiso VARCHAR(100) NOT NULL,
    descripcion TEXT,
    modulo VARCHAR(50) NOT NULL,
    accion VARCHAR(50) NOT NULL, -- CREATE, READ, UPDATE, DELETE, EXECUTE
    recurso VARCHAR(50), -- tabla o funcionalidad específica
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relación roles-permisos
CREATE TABLE IF NOT EXISTS rol_permisos (
    id_rol INT,
    id_permiso INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_rol, id_permiso),
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON DELETE CASCADE,
    FOREIGN KEY (id_permiso) REFERENCES permisos_sistema(id_permiso) ON DELETE CASCADE
);

-- Empleados/Usuarios del sistema
CREATE TABLE IF NOT EXISTS camareros (
    id_camarero INT PRIMARY KEY AUTO_INCREMENT,

    -- Datos personales
    codigo_empleado VARCHAR(20) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100),
    rut VARCHAR(20) UNIQUE,
    email VARCHAR(100) UNIQUE,
    telefono VARCHAR(20),

    -- Datos de acceso
    password VARCHAR(255) NOT NULL,
    ultimo_cambio_password TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    requiere_cambio_password CHAR(1) DEFAULT 'N',

    -- Estado y configuración
    activo CHAR(1) DEFAULT 'S',
    fecha_ingreso DATE DEFAULT (CURRENT_DATE),
    fecha_salida DATE NULL,

    -- Configuración de trabajo
    horario_entrada TIME,
    horario_salida TIME,
    dias_trabajo JSON, -- días de la semana

    -- Información adicional
    imagen LONGBLOB,
    observaciones TEXT,

    -- Control de sesiones
    ultimo_login TIMESTAMP NULL,
    intentos_login INT DEFAULT 0,
    bloqueado_hasta TIMESTAMP NULL,

    -- Configuración de interfaz
    configuracion_ui JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_activo (activo),
    INDEX idx_email (email),
    INDEX idx_codigo (codigo_empleado)
);

-- Relación empleados-roles (un empleado puede tener múltiples roles)
CREATE TABLE IF NOT EXISTS camarero_roles (
    id_camarero INT,
    id_rol INT,
    fecha_asignacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    activo CHAR(1) DEFAULT 'S',
    PRIMARY KEY (id_camarero, id_rol),
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE CASCADE,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON DELETE CASCADE
);

-- Sesiones activas de usuarios
CREATE TABLE IF NOT EXISTS sesiones_usuarios (
    id_sesion VARCHAR(100) PRIMARY KEY,
    id_camarero INT NOT NULL,
    fecha_inicio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_actividad TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    activa CHAR(1) DEFAULT 'S',
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE CASCADE,
    INDEX idx_camarero (id_camarero),
    INDEX idx_activa (activa)
);

-- =============================================
-- MÓDULO 3: CONFIGURACIÓN DE CAJAS Y ESTACIONES
-- =============================================

-- Cajas/Estaciones de trabajo
CREATE TABLE IF NOT EXISTS cajas (
    id_caja INT PRIMARY KEY AUTO_INCREMENT,
    codigo_caja VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(100),
    tipo ENUM('PRINCIPAL', 'COCINA', 'BAR', 'TERMINAL', 'KIOSKO') DEFAULT 'TERMINAL',

    -- Configuración técnica
    ip_address VARCHAR(15),
    mac_address VARCHAR(17),

    -- Configuración de impresión
    impresora_principal VARCHAR(100),
    impresora_comandas VARCHAR(100),
    impresora_reportes VARCHAR(100),

    -- Configuración operacional
    permite_descuentos CHAR(1) DEFAULT 'N',
    requiere_autorizacion_supervisor CHAR(1) DEFAULT 'N',
    limite_descuento DECIMAL(5,2) DEFAULT 0.00,

    -- Estado
    activa CHAR(1) DEFAULT 'S',
    en_linea CHAR(1) DEFAULT 'N',
    ultima_conexion TIMESTAMP NULL,

    -- Configuración personalizada
    configuracion JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tipo (tipo),
    INDEX idx_activa (activa),
    INDEX idx_codigo (codigo_caja)
);

-- =============================================
-- MÓDULO 4: CONTROL DE APERTURA/CIERRE DE CAJA
-- =============================================

-- Apertura de punto de venta
CREATE TABLE IF NOT EXISTS apertura_caja (
    id_apertura INT PRIMARY KEY AUTO_INCREMENT,
    id_caja INT NOT NULL,
    id_camarero_apertura INT NOT NULL,

    -- Datos de apertura
    fecha_apertura DATE NOT NULL,
    hora_apertura TIME NOT NULL,
    saldo_inicial DECIMAL(10,2) DEFAULT 0.00,

    -- Billetes y monedas iniciales (desglose)
    billetes_50000 INT DEFAULT 0,
    billetes_20000 INT DEFAULT 0,
    billetes_10000 INT DEFAULT 0,
    billetes_5000 INT DEFAULT 0,
    billetes_2000 INT DEFAULT 0,
    billetes_1000 INT DEFAULT 0,
    monedas_500 INT DEFAULT 0,
    monedas_100 INT DEFAULT 0,
    monedas_50 INT DEFAULT 0,
    monedas_10 INT DEFAULT 0,

    -- Estado
    estado ENUM('ABIERTA', 'CERRADA', 'SUSPENDIDA') DEFAULT 'ABIERTA',
    observaciones_apertura TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_caja) REFERENCES cajas(id_caja) ON DELETE RESTRICT,
    FOREIGN KEY (id_camarero_apertura) REFERENCES camareros(id_camarero) ON DELETE RESTRICT,

    INDEX idx_caja (id_caja),
    INDEX idx_fecha (fecha_apertura),
    INDEX idx_estado (estado)
);

-- Cierre de punto de venta
CREATE TABLE IF NOT EXISTS cierre_caja (
    id_cierre INT PRIMARY KEY AUTO_INCREMENT,
    id_apertura INT NOT NULL,
    id_camarero_cierre INT NOT NULL,

    -- Datos de cierre
    fecha_cierre DATE NOT NULL,
    hora_cierre TIME NOT NULL,

    -- Saldos calculados
    saldo_teorico DECIMAL(10,2) NOT NULL,
    saldo_real DECIMAL(10,2) NOT NULL,
    diferencia DECIMAL(10,2) ,

    -- Desglose real de efectivo
    efectivo_billetes DECIMAL(10,2) DEFAULT 0.00,
    efectivo_monedas DECIMAL(10,2) DEFAULT 0.00,
    efectivo_total DECIMAL(10,2) ,

    -- Totales por forma de pago
    total_tarjetas_credito DECIMAL(10,2) DEFAULT 0.00,
    total_tarjetas_debito DECIMAL(10,2) DEFAULT 0.00,
    total_transferencias DECIMAL(10,2) DEFAULT 0.00,
    total_vales_comida DECIMAL(10,2) DEFAULT 0.00,
    total_otros DECIMAL(10,2) DEFAULT 0.00,

    -- Resumen de operaciones
    total_ventas INT DEFAULT 0,
    total_ingresos DECIMAL(10,2) DEFAULT 0.00,
    ticket_promedio DECIMAL(10,2) DEFAULT 0.00,

    -- Observaciones y validación
    observaciones_cierre TEXT,
    requiere_revision CHAR(1) DEFAULT 'N',
    revisado_por INT NULL,
    fecha_revision TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_apertura) REFERENCES apertura_caja(id_apertura) ON DELETE RESTRICT,
    FOREIGN KEY (id_camarero_cierre) REFERENCES camareros(id_camarero) ON DELETE RESTRICT,
    FOREIGN KEY (revisado_por) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_apertura (id_apertura),
    INDEX idx_fecha (fecha_cierre)
);

-- =============================================
-- MÓDULO 5: SALONES Y MESAS
-- =============================================

-- Salones del restaurante
CREATE TABLE IF NOT EXISTS salon (
    id_salon INT PRIMARY KEY AUTO_INCREMENT,
    codigo_salon VARCHAR(20) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,

    -- Configuración visual
    color VARCHAR(7) DEFAULT '#2196F3',
    icono VARCHAR(50),
    imagen LONGBLOB,

    -- Configuración operacional
    capacidad_maxima INT DEFAULT 100,
    tipo_servicio ENUM('MESA', 'BARRA', 'DELIVERY', 'TAKE_AWAY') DEFAULT 'MESA',
    requiere_reserva CHAR(1) DEFAULT 'N',

    -- Estado
    activo CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,

    -- Configuración del mapa
    ancho_mapa DECIMAL(8,2) DEFAULT 800.00,
    alto_mapa DECIMAL(8,2) DEFAULT 600.00,
    imagen_fondo LONGBLOB,
    configuracion_mapa JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_activo (activo),
    INDEX idx_orden (orden),
    INDEX idx_tipo (tipo_servicio)
);

-- Mesas del restaurante
CREATE TABLE IF NOT EXISTS mesa (
    Num_Mesa INT PRIMARY KEY,
    codigo_mesa VARCHAR(20) UNIQUE,
    descripcion VARCHAR(100) NOT NULL,

    -- Configuración física
    capacidad INT DEFAULT 4,
    capacidad_maxima INT DEFAULT 6,
    tipo_mesa ENUM('REGULAR', 'ALTA', 'BARRA', 'EXTERIOR', 'VIP') DEFAULT 'REGULAR',

    -- Ubicación en salon
    id_salon INT NOT NULL,
    posicion_x DECIMAL(8,2) DEFAULT 0,
    posicion_y DECIMAL(8,2) DEFAULT 0,
    ancho DECIMAL(8,2) DEFAULT 60,
    alto DECIMAL(8,2) DEFAULT 60,
    rotacion DECIMAL(5,2) DEFAULT 0, -- grados

    -- Configuración visual
    forma ENUM('RECTANGULAR', 'CIRCULAR', 'CUADRADA', 'OVAL') DEFAULT 'RECTANGULAR',
    color VARCHAR(7) DEFAULT '#4CAF50',

    -- Configuración operacional
    zona_servicio VARCHAR(50),
    tiempo_limite_ocupacion INT DEFAULT 180, -- minutos
    requiere_reserva CHAR(1) DEFAULT 'N',

    -- Estado
    activa CHAR(1) DEFAULT 'S',

    -- Asignación de personal
    camarero_asignado INT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id_salon) REFERENCES salon(id_salon) ON DELETE RESTRICT,
    FOREIGN KEY (camarero_asignado) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_salon (id_salon),
    INDEX idx_activa (activa),
    INDEX idx_camarero (camarero_asignado),
    INDEX idx_tipo (tipo_mesa)
);

-- Estado actual de las mesas
CREATE TABLE IF NOT EXISTS mesa_estado (
    Num_Mesa INT PRIMARY KEY,
    estado_actual ENUM('LIBRE', 'OCUPADA', 'RESERVADA', 'LIMPIEZA', 'FUERA_SERVICIO') DEFAULT 'LIBRE',
    ocupada_desde TIMESTAMP NULL,
    comensales_actuales INT DEFAULT 0,
    id_venta_actual INT NULL,
    observaciones TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (Num_Mesa) REFERENCES mesa(Num_Mesa) ON DELETE CASCADE,
    INDEX idx_estado (estado_actual)
);

-- =============================================
-- MÓDULO 6: PRODUCTOS Y CATÁLOGO
-- =============================================

-- Categorías principales
CREATE TABLE IF NOT EXISTS categoria (
    id_categoria INT PRIMARY KEY AUTO_INCREMENT,
    codigo_categoria VARCHAR(20) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,

    -- Configuración visual
    color VARCHAR(7) DEFAULT '#FF9800',
    icono VARCHAR(50),
    imagen LONGBLOB,

    -- Configuración operacional
    tipo_categoria ENUM('COMIDA', 'BEBIDA', 'POSTRE', 'ENTRADA', 'ALCOHOL', 'SIN_ALCOHOL') DEFAULT 'COMIDA',
    requiere_edad_minima CHAR(1) DEFAULT 'N',
    edad_minima INT DEFAULT 0,

    -- Configuración de cocina
    va_a_cocina CHAR(1) DEFAULT 'Y',
    estacion_cocina VARCHAR(50),
    tiempo_preparacion_promedio INT DEFAULT 15, -- minutos

    -- Estado y orden
    activa CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activa (activa),
    INDEX idx_orden (orden),
    INDEX idx_tipo (tipo_categoria)
);

-- Subcategorías
CREATE TABLE IF NOT EXISTS subcategoria (
    id_subcategoria INT PRIMARY KEY AUTO_INCREMENT,
    id_categoria INT NOT NULL,
    codigo_subcategoria VARCHAR(20) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,

    -- Configuración visual
    color VARCHAR(7),
    icono VARCHAR(50),
    imagen LONGBLOB,

    -- Estado y orden
    activa CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria) ON DELETE CASCADE,
    INDEX idx_categoria (id_categoria),
    INDEX idx_activa (activa),
    INDEX idx_orden (orden)
);

-- Tipos de productos (clasificación adicional)
CREATE TABLE IF NOT EXISTS tipo_comg (
    id_tipo_comg INT PRIMARY KEY AUTO_INCREMENT,
    codigo_tipo VARCHAR(20) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,

    -- Configuración visual
    color VARCHAR(7) DEFAULT '#9C27B0',

    -- Configuración operacional
    requiere_cocina CHAR(1) DEFAULT 'N',
    tiempo_preparacion INT DEFAULT 0, -- minutos
    permite_modificaciones CHAR(1) DEFAULT 'S',

    -- Configuración de stock
    controla_stock CHAR(1) DEFAULT 'S',
    unidad_medida VARCHAR(20) DEFAULT 'UND',

    activo CHAR(1) DEFAULT 'S',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activo (activo)
);

-- Productos/Complementos COMPLETO
CREATE TABLE IF NOT EXISTS complementog (
    id_complementog INT PRIMARY KEY AUTO_INCREMENT,

    -- Identificación
    codigo VARCHAR(50) UNIQUE,
    codigo_barras VARCHAR(50),
    alias VARCHAR(100) NOT NULL, -- nombre comercial
    nombre_completo VARCHAR(200),
    descripcion TEXT,
    descripcion_corta VARCHAR(100),

    -- Categorización
    id_categoria INT,
    id_subcategoria INT,
    id_tipo_comg INT,

    -- Precios
    precio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    precio_costo DECIMAL(10,2) DEFAULT 0.00,
    margen_utilidad DECIMAL(5,2) AS (
        CASE
            WHEN precio_costo > 0 THEN ((precio - precio_costo) / precio_costo) * 100
            ELSE 0
        END
    ) STORED,

    -- Configuración de cocina
    cocina CHAR(1) DEFAULT 'N', -- si va a cocina
    panelcocina VARCHAR(100), -- a qué impresora/estación va
    tiempo_preparacion INT DEFAULT 0, -- minutos
    prioridad_cocina ENUM('BAJA', 'NORMAL', 'ALTA', 'URGENTE') DEFAULT 'NORMAL',

    -- Configuración nutricional
    calorias INT,
    proteinas DECIMAL(5,2),
    carbohidratos DECIMAL(5,2),
    grasas DECIMAL(5,2),
    ingredientes TEXT,
    alergenos TEXT,

    -- Configuración de venta
    disponible CHAR(1) DEFAULT 'S',
    se_puede_modificar CHAR(1) DEFAULT 'S',
    permite_descuento CHAR(1) DEFAULT 'S',
    descuento_maximo DECIMAL(5,2) DEFAULT 100.00,

    -- Configuración de horarios
    disponible_desde TIME,
    disponible_hasta TIME,
    dias_disponible JSON, -- días de la semana

    -- Multimedia
    imagen LONGBLOB,
    imagenes_adicionales JSON, -- URLs o paths de imágenes

    -- Estado y orden
    activo CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,

    -- Configuración especial
    es_combo CHAR(1) DEFAULT 'N',
    requiere_edad_verificacion CHAR(1) DEFAULT 'N',
    observaciones TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria) ON DELETE SET NULL,
    FOREIGN KEY (id_subcategoria) REFERENCES subcategoria(id_subcategoria) ON DELETE SET NULL,
    FOREIGN KEY (id_tipo_comg) REFERENCES tipo_comg(id_tipo_comg) ON DELETE SET NULL,

    INDEX idx_categoria (id_categoria),
    INDEX idx_subcategoria (id_subcategoria),
    INDEX idx_activo (activo),
    INDEX idx_disponible (disponible),
    INDEX idx_codigo (codigo),
    INDEX idx_precio (precio),
    INDEX idx_cocina (cocina)
);

-- Modificadores de productos (extras, opciones)
CREATE TABLE IF NOT EXISTS producto_modificadores (
    id_modificador INT PRIMARY KEY AUTO_INCREMENT,
    id_complementog INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_adicional DECIMAL(10,2) DEFAULT 0.00,
    tipo ENUM('OPCION', 'EXTRA', 'INGREDIENTE', 'TAMAÑO') DEFAULT 'OPCION',
    obligatorio CHAR(1) DEFAULT 'N',
    activo CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,

    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE CASCADE,
    INDEX idx_producto (id_complementog),
    INDEX idx_tipo (tipo)
);

-- =============================================
-- MÓDULO 7: PACKS Y COMBOS
-- =============================================

-- Packs (productos compuestos)
CREATE TABLE IF NOT EXISTS pack (
    id_pack INT PRIMARY KEY AUTO_INCREMENT,
    id_complementog_principal INT NOT NULL, -- producto principal (pack)
    id_complementog_componente INT NOT NULL, -- componente del pack
    cantidad DECIMAL(8,3) NOT NULL DEFAULT 1.000, -- cantidad del componente
    es_opcional CHAR(1) DEFAULT 'N', -- si el componente es opcional
    precio_adicional DECIMAL(10,2) DEFAULT 0.00, -- precio extra si aplica
    orden_preparacion INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_complementog_principal) REFERENCES complementog(id_complementog) ON DELETE CASCADE,
    FOREIGN KEY (id_complementog_componente) REFERENCES complementog(id_complementog) ON DELETE CASCADE,

    INDEX idx_principal (id_complementog_principal),
    INDEX idx_componente (id_complementog_componente),
    UNIQUE KEY uk_pack_componente (id_complementog_principal, id_complementog_componente)
);

-- =============================================
-- MÓDULO 8: VENTAS COMPLETO
-- =============================================

-- Ventas principales con toda la información
CREATE TABLE IF NOT EXISTS ventadirecta (
    id_venta INT PRIMARY KEY AUTO_INCREMENT,

    -- Identificación
    numero_venta VARCHAR(20) UNIQUE,

    -- Mesa y ubicación
    Num_Mesa INT,
    id_salon INT,

    -- Fechas y horarios
    fecha_venta DATE NOT NULL,
    hora TIME NOT NULL,
    fecha_hora_completa TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Cliente y servicio
    comensales INT DEFAULT 1,
    alias VARCHAR(100), -- nombre del cliente o identificador
    cliente_telefono VARCHAR(20),
    cliente_email VARCHAR(100),

    -- Personal asignado
    id_camarero INT,
    id_camarero_apoyo INT, -- camarero de apoyo

    -- Tipo de servicio
    tipo_servicio ENUM('MESA', 'DELIVERY', 'TAKE_AWAY', 'BARRA') DEFAULT 'MESA',

    -- Horarios de servicio
    hora_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hora_primer_plato TIMESTAMP NULL,
    hora_ultimo_plato TIMESTAMP NULL,
    hora_cuenta_solicitada TIMESTAMP NULL,

    -- Montos
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    descuento_porcentaje DECIMAL(5,2) DEFAULT 0.00,
    descuento_monto DECIMAL(10,2) DEFAULT 0.00,
    impuestos DECIMAL(10,2) DEFAULT 0.00,
    propina DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) DEFAULT 0.00,

    -- Estado de la venta
    cerrada CHAR(1) DEFAULT 'N', -- N=Abierta, S=Cerrada, M=Marcada, C=Cancelada, P=Pendiente de pago

    -- Facturación
    serie CHAR(1),
    id_tiquet INT,
    tipo_documento ENUM('TICKET', 'BOLETA', 'FACTURA') DEFAULT 'TICKET',

    -- Configuración de impresión
    imppretiquet CHAR(1) DEFAULT 'N',
    reimprimir_comandas CHAR(1) DEFAULT 'N',

    -- Observaciones y notas
    observaciones TEXT,
    observaciones_cocina TEXT,

    -- Control de tiempo
    tiempo_servicio_minutos INT AS (
        CASE
            WHEN hora_ultimo_plato IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, hora_pedido, hora_ultimo_plato)
            ELSE NULL
        END
    ) STORED,

    -- Información de delivery
    direccion_delivery TEXT,
    telefono_delivery VARCHAR(20),
    costo_delivery DECIMAL(10,2) DEFAULT 0.00,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (Num_Mesa) REFERENCES mesa(Num_Mesa) ON DELETE SET NULL,
    FOREIGN KEY (id_salon) REFERENCES salon(id_salon) ON DELETE SET NULL,
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE SET NULL,
    FOREIGN KEY (id_camarero_apoyo) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_mesa (Num_Mesa),
    INDEX idx_camarero (id_camarero),
    INDEX idx_cerrada (cerrada),
    INDEX idx_fecha (fecha_venta),
    INDEX idx_fecha_hora (fecha_venta, hora),
    INDEX idx_tipo_servicio (tipo_servicio),
    INDEX idx_numero (numero_venta)
);

-- Líneas de venta detalladas y completas
CREATE TABLE IF NOT EXISTS ventadir_comg (
    id_venta INT NOT NULL,
    id_linea INT NOT NULL,

    -- Producto
    id_complementog INT NOT NULL,
    complementog VARCHAR(200) NOT NULL, -- nombre del producto al momento de venta
    codigo_producto VARCHAR(50), -- código del producto al momento de venta

    -- Cantidades
    cantidad DECIMAL(8,3) NOT NULL DEFAULT 1.000,
    cantidad_servida DECIMAL(8,3) DEFAULT 0.000,
    cantidad_cancelada DECIMAL(8,3) DEFAULT 0.000,

    -- Precios
    precio DECIMAL(10,2) NOT NULL,
    precio_original DECIMAL(10,2), -- precio antes de descuentos
    descuento DECIMAL(5,2) DEFAULT 0.00,
    avgiva DECIMAL(5,2) DEFAULT 0.00,

    -- Cálculos automáticos
    subtotal DECIMAL(10,2) AS (
        (precio - (precio * descuento / 100)) * cantidad
    ) STORED,
    total DECIMAL(10,2) AS (
        ((precio - (precio * descuento / 100)) * cantidad) * (1 + avgiva / 100)
    ) STORED,

    -- Observaciones y modificaciones
    nota TEXT, -- observaciones del cliente
    observaciones TEXT, -- notas internas del camarero
    modificadores JSON, -- modificadores aplicados

    -- Control de cocina
    bloque_cocina INT DEFAULT 1,
    estacion_cocina VARCHAR(50),
    prioridad ENUM('BAJA', 'NORMAL', 'ALTA', 'URGENTE') DEFAULT 'NORMAL',

    -- Estado en cocina
    cocina DECIMAL(8,3) DEFAULT 0.000, -- cantidad enviada a cocina
    servido_cocina DECIMAL(8,3) DEFAULT 0.000, -- cantidad servida por cocina
    estado_cocina ENUM('PENDIENTE', 'EN_PREPARACION', 'LISTO', 'SERVIDO', 'CANCELADO') DEFAULT 'PENDIENTE',

    -- Tiempos
    hora_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hora_envio_cocina TIMESTAMP NULL,
    hora_inicio_preparacion TIMESTAMP NULL,
    hora_listo TIMESTAMP NULL,
    hora_servido TIMESTAMP NULL,

    -- Tiempo calculado de preparación
    tiempo_preparacion_minutos INT AS (
        CASE
            WHEN hora_listo IS NOT NULL AND hora_inicio_preparacion IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, hora_inicio_preparacion, hora_listo)
            ELSE NULL
        END
    ) STORED,

    -- Control de cancelación
    motivo_cancelacion TEXT,
    autorizado_por INT, -- quien autorizó la cancelación

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id_venta, id_linea),
    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE RESTRICT,
    FOREIGN KEY (autorizado_por) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_complementog (id_complementog),
    INDEX idx_estado_cocina (estado_cocina),
    INDEX idx_bloque_cocina (bloque_cocina),
    INDEX idx_cocina_pendiente (cocina, servido_cocina),
    INDEX idx_estacion (estacion_cocina),
    INDEX idx_prioridad (prioridad)
);

-- =============================================
-- MÓDULO 9: STOCK E INVENTARIO COMPLETO
-- =============================================

-- Almacenes
CREATE TABLE IF NOT EXISTS almacen (
    id_almacen INT PRIMARY KEY AUTO_INCREMENT,
    codigo_almacen VARCHAR(20) UNIQUE,
    nom_almacen VARCHAR(100) NOT NULL,
    descripcion TEXT,
    ubicacion VARCHAR(200),
    responsable INT,
    tipo ENUM('PRINCIPAL', 'COCINA', 'BAR', 'DEPOSITO') DEFAULT 'PRINCIPAL',
    activo CHAR(1) DEFAULT 'S',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (responsable) REFERENCES camareros(id_camarero) ON DELETE SET NULL,
    INDEX idx_activo (activo),
    INDEX idx_tipo (tipo)
);

-- Stock por almacén y producto
CREATE TABLE IF NOT EXISTS almacen_complementg (
    id_almacen INT NOT NULL,
    id_complementog INT NOT NULL,
    cantidad DECIMAL(10,3) DEFAULT 0.000,
    cantidad_reservada DECIMAL(10,3) DEFAULT 0.000, -- cantidad reservada en pedidos
    stock_minimo DECIMAL(10,3) DEFAULT 0.000,
    stock_maximo DECIMAL(10,3) DEFAULT 0.000,
    punto_reorden DECIMAL(10,3) DEFAULT 0.000,

    -- Costos
    costo_unitario DECIMAL(10,2) DEFAULT 0.00,
    costo_promedio DECIMAL(10,2) DEFAULT 0.00,

    -- Configuración
    unidad_medida VARCHAR(20) DEFAULT 'UND',
    ubicacion_fisica VARCHAR(100),

    -- Control de fechas
    fecha_vencimiento DATE,
    lote VARCHAR(50),

    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id_almacen, id_complementog),
    FOREIGN KEY (id_almacen) REFERENCES almacen(id_almacen) ON DELETE CASCADE,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE CASCADE,

    INDEX idx_stock_bajo (cantidad, stock_minimo),
    INDEX idx_vencimiento (fecha_vencimiento)
);

-- Movimientos de stock detallados
CREATE TABLE IF NOT EXISTS movimientos_stock (
    id_movimiento INT PRIMARY KEY AUTO_INCREMENT,
    numero_movimiento VARCHAR(20) UNIQUE AS (CONCAT('MOV', LPAD(id_movimiento, 8, '0'))) STORED,

    id_almacen INT NOT NULL,
    id_complementog INT NOT NULL,

    -- Tipo de movimiento
    tipo_movimiento ENUM('ENTRADA', 'SALIDA', 'AJUSTE', 'TRANSFERENCIA', 'MERMA', 'DEVOLUCION') NOT NULL,
    motivo VARCHAR(200),

    -- Cantidades
    cantidad DECIMAL(10,3) NOT NULL,
    cantidad_anterior DECIMAL(10,3) NOT NULL,
    cantidad_nueva DECIMAL(10,3) NOT NULL,

    -- Costos
    costo_unitario DECIMAL(10,2) DEFAULT 0.00,
    costo_total DECIMAL(10,2) ,

    -- Referencias
    id_venta INT NULL, -- si es por venta
    numero_factura VARCHAR(50), -- si es por compra
    id_proveedor INT NULL,

    -- Control
    id_camarero INT,
    autorizado_por INT,
    requiere_autorizacion CHAR(1) DEFAULT 'N',

    -- Información adicional
    lote VARCHAR(50),
    fecha_vencimiento DATE,
    observaciones TEXT,

    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_almacen) REFERENCES almacen(id_almacen) ON DELETE RESTRICT,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE RESTRICT,
    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE SET NULL,
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE SET NULL,
    FOREIGN KEY (autorizado_por) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_fecha (fecha),
    INDEX idx_producto (id_complementog),
    INDEX idx_tipo (tipo_movimiento),
    INDEX idx_almacen (id_almacen),
    INDEX idx_numero (numero_movimiento)
);

-- =============================================
-- MÓDULO 10: FORMAS DE PAGO COMPLETO
-- =============================================

-- Modos/Formas de pago expandidos
CREATE TABLE IF NOT EXISTS modo_pago (
    id_modo_pago INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descripcion VARCHAR(100) NOT NULL,
    descripcion_corta VARCHAR(20),

    -- Clasificación
    tipo ENUM('EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA', 'CHEQUE', 'VALE_COMIDA', 'CREDITO', 'OTRO') DEFAULT 'EFECTIVO',
    subtipo VARCHAR(50), -- VISA, MASTERCARD, SODEXO, etc.

    -- Configuración operacional
    requiere_autorizacion CHAR(1) DEFAULT 'N',
    requiere_firma CHAR(1) DEFAULT 'N',
    requiere_identificacion CHAR(1) DEFAULT 'N',

    -- Costos y comisiones
    comision DECIMAL(5,2) DEFAULT 0.00,
    comision_fija DECIMAL(10,2) DEFAULT 0.00,

    -- Configuración de facturación
    afecta_caja CHAR(1) DEFAULT 'S',
    cuenta_contable VARCHAR(20),

    -- Límites
    monto_minimo DECIMAL(10,2) DEFAULT 0.00,
    monto_maximo DECIMAL(10,2) DEFAULT 999999.99,

    -- Configuración adicional
    permite_vuelto CHAR(1) DEFAULT 'N',
    redondeo_centavos CHAR(1) DEFAULT 'N',

    -- Estado
    activo CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,

    -- Configuración específica
    configuracion JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activo (activo),
    INDEX idx_tipo (tipo),
    INDEX idx_codigo (codigo)
);

-- Pagos múltiples por venta
CREATE TABLE IF NOT EXISTS venta_pagos (
    id_venta INT NOT NULL,
    secuencia INT NOT NULL,
    id_modo_pago INT NOT NULL,

    -- Montos
    monto DECIMAL(10,2) NOT NULL,
    comision DECIMAL(10,2) DEFAULT 0.00,
    monto_neto DECIMAL(10,2) ,

    -- Información de la transacción
    numero_autorizacion VARCHAR(100),
    numero_transaccion VARCHAR(100),
    ultimos_4_digitos CHAR(4),
    tipo_tarjeta VARCHAR(20),

    -- Fechas
    fecha_transaccion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_vencimiento DATE, -- para cheques o créditos

    -- Estado
    estado ENUM('PENDIENTE', 'AUTORIZADO', 'RECHAZADO', 'ANULADO') DEFAULT 'AUTORIZADO',

    -- Observaciones
    observaciones TEXT,

    PRIMARY KEY (id_venta, secuencia),
    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_modo_pago) REFERENCES modo_pago(id_modo_pago) ON DELETE RESTRICT,

    INDEX idx_modo_pago (id_modo_pago),
    INDEX idx_estado (estado),
    INDEX idx_fecha (fecha_transaccion)
);

-- =============================================
-- MÓDULO 11: TICKETS Y FACTURACIÓN COMPLETO
-- =============================================

-- Series de facturación
CREATE TABLE IF NOT EXISTS series_facturacion (
    serie CHAR(1) PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL,
    tipo_documento ENUM('TICKET', 'BOLETA', 'FACTURA', 'NOTA_CREDITO', 'NOTA_DEBITO') NOT NULL,
    prefijo VARCHAR(10) DEFAULT '',
    siguiente_numero INT DEFAULT 1,
    numero_maximo INT DEFAULT 999999,
    activa CHAR(1) DEFAULT 'S',
    configuracion JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_tipo (tipo_documento)
);

-- Tickets/Facturas completos
CREATE TABLE IF NOT EXISTS tiquet (
    serie CHAR(1) NOT NULL,
    id_tiquet INT NOT NULL,
    numero_completo VARCHAR(50) AS (CONCAT(serie, LPAD(id_tiquet, 6, '0'))) STORED,

    -- Información de empresa
    id_empresa CHAR(3) DEFAULT '001',
    id_centro CHAR(2) DEFAULT '01',

    -- Fechas
    fecha_tiquet DATE NOT NULL,
    horatiquet TIME NOT NULL,
    fecha_vencimiento DATE,

    -- Montos
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    descuento DECIMAL(10,2) DEFAULT 0.00,
    base_imponible DECIMAL(10,2) DEFAULT 0.00,
    iva DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,

    -- Estado
    estado ENUM('EMITIDO', 'ANULADO', 'DEVUELTO', 'NOTA_CREDITO') DEFAULT 'EMITIDO',

    -- Información adicional
    forma_pago_principal VARCHAR(50),
    observaciones TEXT,

    -- Control de impresión
    impreso CHAR(1) DEFAULT 'N',
    fecha_impresion TIMESTAMP NULL,
    reimpresiones INT DEFAULT 0,

    -- Información fiscal
    folio_interno VARCHAR(20),
    timbre_electronico TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (serie, id_tiquet),
    FOREIGN KEY (serie) REFERENCES series_facturacion(serie) ON DELETE RESTRICT,

    INDEX idx_fecha (fecha_tiquet),
    INDEX idx_numero (numero_completo),
    INDEX idx_estado (estado),
    INDEX idx_folio (folio_interno)
);

-- =============================================
-- MÓDULO 12: PAGOS Y MOVIMIENTOS DE CAJA
-- =============================================

-- Pagos y cobros (movimientos de caja) completos
CREATE TABLE IF NOT EXISTS pagoscobros (
    id_pagoscobros INT PRIMARY KEY AUTO_INCREMENT,
    numero_transaccion VARCHAR(20) UNIQUE AS (CONCAT('TXN', LPAD(id_pagoscobros, 8, '0'))) STORED,

    -- Clasificación
    tipo CHAR(1) NOT NULL, -- E=Entrada, S=Salida
    categoria ENUM('VENTA', 'COMPRA', 'GASTO', 'INGRESO_EXTRA', 'RETIRO', 'DEPOSITO') DEFAULT 'VENTA',

    -- Referencias
    id_venta INT NULL,
    numero_factura VARCHAR(50),

    -- Fechas
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    fecha_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Descripción
    descripcion VARCHAR(200) NOT NULL,
    concepto VARCHAR(100),

    -- Montos
    importe DECIMAL(10,2) NOT NULL,
    comision DECIMAL(10,2) DEFAULT 0.00,
    importe_neto DECIMAL(10,2) ,

    -- Forma de pago
    id_modo_pago INT NOT NULL,

    -- Control de personal
    id_camarero INT NOT NULL,
    autorizado_por INT,

    -- Saldo acumulado
    saldo DECIMAL(10,2) DEFAULT 0.00,

    -- Información de facturación
    id_tiquet INT NULL,
    serie_fac CHAR(1) NULL,

    -- Información de caja
    id_apcajas INT NOT NULL,
    id_caja INT NOT NULL,

    -- Información adicional
    observaciones TEXT,
    comprobante_fiscal VARCHAR(100),

    -- Control de anulación
    anulado CHAR(1) DEFAULT 'N',
    motivo_anulacion TEXT,
    anulado_por INT,
    fecha_anulacion TIMESTAMP NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE SET NULL,
    FOREIGN KEY (id_modo_pago) REFERENCES modo_pago(id_modo_pago) ON DELETE RESTRICT,
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE RESTRICT,
    FOREIGN KEY (autorizado_por) REFERENCES camareros(id_camarero) ON DELETE SET NULL,
    FOREIGN KEY (id_apcajas) REFERENCES apertura_caja(id_apertura) ON DELETE RESTRICT,
    FOREIGN KEY (id_caja) REFERENCES cajas(id_caja) ON DELETE RESTRICT,
    FOREIGN KEY (anulado_por) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_fecha (fecha),
    INDEX idx_tipo (tipo),
    INDEX idx_categoria (categoria),
    INDEX idx_venta (id_venta),
    INDEX idx_caja (id_caja),
    INDEX idx_apertura (id_apcajas),
    INDEX idx_modo_pago (id_modo_pago),
    INDEX idx_numero (numero_transaccion)
);

-- =============================================
-- MÓDULO 13: ESTACIONES DE COCINA AVANZADAS
-- =============================================

-- Estaciones de cocina
CREATE TABLE IF NOT EXISTS estaciones_cocina (
    id_estacion INT PRIMARY KEY AUTO_INCREMENT,
    codigo_estacion VARCHAR(20) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,

    -- Tipo de estación
    tipo ENUM('FRIA', 'CALIENTE', 'PARRILLA', 'FRITURA', 'HORNO', 'ENSALADAS', 'POSTRES', 'BEBIDAS', 'BAR') NOT NULL,
    categoria VARCHAR(50),

    -- Configuración física
    ubicacion VARCHAR(100),
    capacidad_maxima INT DEFAULT 10, -- pedidos simultáneos

    -- Personal
    responsable_turno INT,
    personal_asignado JSON, -- array de IDs de empleados

    -- Configuración técnica
    impresora_asignada VARCHAR(100),
    monitor_asignado VARCHAR(100),

    -- Configuración operacional
    tiempo_preparacion_promedio INT DEFAULT 15, -- minutos
    acepta_prioridades CHAR(1) DEFAULT 'S',
    notifica_demoras CHAR(1) DEFAULT 'S',
    tiempo_alerta INT DEFAULT 20, -- minutos para alertar

    -- Estado
    activa CHAR(1) DEFAULT 'S',
    en_servicio CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,

    -- Configuración adicional
    configuracion JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (responsable_turno) REFERENCES camareros(id_camarero) ON DELETE SET NULL,
    INDEX idx_tipo (tipo),
    INDEX idx_activa (activa),
    INDEX idx_servicio (en_servicio)
);

-- Asignación de productos a estaciones
CREATE TABLE IF NOT EXISTS producto_estaciones (
    id_complementog INT,
    id_estacion INT,
    orden_preparacion INT DEFAULT 1,
    tiempo_preparacion_estimado INT DEFAULT 15, -- minutos
    es_estacion_principal CHAR(1) DEFAULT 'S',

    PRIMARY KEY (id_complementog, id_estacion),
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE CASCADE,
    FOREIGN KEY (id_estacion) REFERENCES estaciones_cocina(id_estacion) ON DELETE CASCADE,

    INDEX idx_producto (id_complementog),
    INDEX idx_estacion (id_estacion)
);

-- Control de tiempos de cocina detallado
CREATE TABLE IF NOT EXISTS tiempos_cocina (
    id_tiempo INT PRIMARY KEY AUTO_INCREMENT,
    id_venta INT NOT NULL,
    id_linea INT NOT NULL,
    id_estacion INT,

    -- Tiempos estimados
    tiempo_estimado INT, -- minutos
    prioridad ENUM('BAJA', 'NORMAL', 'ALTA', 'URGENTE') DEFAULT 'NORMAL',

    -- Tiempos reales
    hora_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hora_recibido_cocina TIMESTAMP NULL,
    hora_inicio_preparacion TIMESTAMP NULL,
    hora_listo TIMESTAMP NULL,
    hora_servido TIMESTAMP NULL,

    -- Cálculos automáticos
    tiempo_espera_minutos INT AS (
        CASE
            WHEN hora_inicio_preparacion IS NOT NULL AND hora_recibido_cocina IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, hora_recibido_cocina, hora_inicio_preparacion)
            ELSE NULL
        END
    ) STORED,

    tiempo_real_preparacion INT AS (
        CASE
            WHEN hora_listo IS NOT NULL AND hora_inicio_preparacion IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, hora_inicio_preparacion, hora_listo)
            ELSE NULL
        END
    ) STORED,

    tiempo_total_servicio INT AS (
        CASE
            WHEN hora_servido IS NOT NULL AND hora_pedido IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, hora_pedido, hora_servido)
            ELSE NULL
        END
    ) STORED,

    -- Estado actual
    estado_actual ENUM('PENDIENTE', 'EN_COLA', 'EN_PREPARACION', 'LISTO', 'SERVIDO', 'CANCELADO') DEFAULT 'PENDIENTE',

    -- Personal responsable
    cocinero_asignado INT,

    -- Observaciones
    observaciones TEXT,
    problemas_reportados TEXT,

    FOREIGN KEY (id_venta, id_linea) REFERENCES ventadir_comg(id_venta, id_linea) ON DELETE CASCADE,
    FOREIGN KEY (id_estacion) REFERENCES estaciones_cocina(id_estacion) ON DELETE SET NULL,
    FOREIGN KEY (cocinero_asignado) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_venta_linea (id_venta, id_linea),
    INDEX idx_estacion (id_estacion),
    INDEX idx_estado (estado_actual),
    INDEX idx_prioridad (prioridad),
    INDEX idx_tiempo_estimado (tiempo_estimado)
);

-- =============================================
-- MÓDULO 14: SISTEMA DE IMPRESIÓN AVANZADO
-- =============================================

-- Configuración de impresoras
CREATE TABLE IF NOT EXISTS impresoras (
    id_impresora INT PRIMARY KEY AUTO_INCREMENT,
    codigo_impresora VARCHAR(20) UNIQUE,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,

    -- Tipo y modelo
    tipo ENUM('TICKET', 'A4', 'ETIQUETA', 'MATRIZ') DEFAULT 'TICKET',
    marca VARCHAR(50),
    modelo VARCHAR(50),

    -- Configuración técnica
    driver VARCHAR(100),
    puerto VARCHAR(100), -- COM1, USB, IP, etc.
    velocidad_baudios INT,

    -- Configuración de papel
    ancho_papel DECIMAL(5,2) DEFAULT 80.00, -- mm
    alto_papel DECIMAL(5,2), -- mm para papel continuo
    margen_izquierdo DECIMAL(5,2) DEFAULT 5.00,
    margen_derecho DECIMAL(5,2) DEFAULT 5.00,
    margen_superior DECIMAL(5,2) DEFAULT 5.00,
    margen_inferior DECIMAL(5,2) DEFAULT 5.00,

    -- Configuración operacional
    estacion_asignada VARCHAR(50),
    permite_corte_automatico CHAR(1) DEFAULT 'S',
    numero_copias_default INT DEFAULT 1,

    -- Estado
    activa CHAR(1) DEFAULT 'S',
    en_linea CHAR(1) DEFAULT 'N',
    ultima_conexion TIMESTAMP NULL,

    -- Configuración específica
    configuracion JSON,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_activa (activa),
    INDEX idx_tipo (tipo),
    INDEX idx_estacion (estacion_asignada)
);

-- Configuración de documentos por impresora
CREATE TABLE IF NOT EXISTS configuracion_impresoras (
    id_config INT PRIMARY KEY AUTO_INCREMENT,
    id_impresora INT NOT NULL,
    tipo_documento ENUM('COMANDA_COCINA', 'COMANDA_BAR', 'TICKET_CLIENTE', 'REPORTE_Z', 'PRECUENTA', 'FACTURA', 'CUENTA_MESA') NOT NULL,

    -- Configuración de impresión
    template_archivo VARCHAR(200), -- archivo de template
    filtro_productos JSON, -- productos que debe imprimir
    filtro_categorias JSON, -- categorías que debe imprimir

    -- Configuración operacional
    auto_imprimir CHAR(1) DEFAULT 'S',
    copias INT DEFAULT 1,
    corte_automatico CHAR(1) DEFAULT 'S',

    -- Condiciones de activación
    condicion_impresion JSON, -- condiciones para imprimir

    activo CHAR(1) DEFAULT 'S',

    FOREIGN KEY (id_impresora) REFERENCES impresoras(id_impresora) ON DELETE CASCADE,
    INDEX idx_impresora (id_impresora),
    INDEX idx_tipo (tipo_documento)
);

-- Cola de impresión
CREATE TABLE IF NOT EXISTS venta_ticket (
    id_impresion INT PRIMARY KEY AUTO_INCREMENT,
    numero_cola VARCHAR(20) UNIQUE AS (CONCAT('IMP', LPAD(id_impresion, 8, '0'))) STORED,

    -- Referencias
    id_venta INT NOT NULL,
    id_impresora INT,

    -- Tipo de impresión
    tipo_impresion ENUM('TICKET_CLIENTE', 'COMANDA_COCINA', 'COMANDA_BAR', 'PRECUENTA', 'FACTURA', 'REPORTE_Z', 'CUENTA_MESA') DEFAULT 'TICKET_CLIENTE',

    -- Configuración de impresión
    copias_solicitadas INT DEFAULT 1,
    copias_impresas INT DEFAULT 0,
    template_utilizado VARCHAR(200),

    -- Estado
    estado ENUM('PENDIENTE', 'PROCESANDO', 'IMPRESO', 'ERROR', 'CANCELADO') DEFAULT 'PENDIENTE',
    prioridad ENUM('BAJA', 'NORMAL', 'ALTA', 'URGENTE') DEFAULT 'NORMAL',

    -- Control de errores
    intentos INT DEFAULT 0,
    max_intentos INT DEFAULT 3,
    error_mensaje TEXT NULL,

    -- Fechas
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_inicio_impresion TIMESTAMP NULL,
    fecha_impresion TIMESTAMP NULL,

    -- Información adicional
    observaciones TEXT,
    datos_impresion JSON, -- datos específicos para el template

    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_impresora) REFERENCES impresoras(id_impresora) ON DELETE SET NULL,

    INDEX idx_estado (estado),
    INDEX idx_tipo (tipo_impresion),
    INDEX idx_fecha (fecha_creacion),
    INDEX idx_prioridad (prioridad),
    INDEX idx_venta (id_venta)
);

-- =============================================
-- MÓDULO 15: CONFIGURACIÓN AVANZADA DEL SISTEMA
-- =============================================

-- Configuraciones del sistema
CREATE TABLE IF NOT EXISTS configuracion_sistema (
    clave VARCHAR(100) PRIMARY KEY,
    valor TEXT NOT NULL,
    valor_default TEXT,

    -- Tipo de dato
    tipo ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON', 'EMAIL', 'URL', 'TIME', 'DATE') DEFAULT 'STRING',

    -- Información descriptiva
    descripcion TEXT,
    categoria VARCHAR(50) DEFAULT 'GENERAL',
    subcategoria VARCHAR(50),

    -- Validaciones
    es_requerido CHAR(1) DEFAULT 'N',
    valor_minimo DECIMAL(15,5),
    valor_maximo DECIMAL(15,5),
    patron_validacion VARCHAR(200), -- regex
    opciones_validas JSON, -- para campos tipo SELECT

    -- Control de modificación
    modificable CHAR(1) DEFAULT 'S',
    requiere_reinicio CHAR(1) DEFAULT 'N',
    nivel_acceso ENUM('PUBLICO', 'USUARIO', 'ADMINISTRADOR', 'SISTEMA') DEFAULT 'USUARIO',

    -- Información adicional
    unidad_medida VARCHAR(20),
    ayuda TEXT,

    -- Control de cambios
    modificado_por INT,
    fecha_modificacion TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (modificado_por) REFERENCES camareros(id_camarero) ON DELETE SET NULL,
    INDEX idx_categoria (categoria),
    INDEX idx_modificable (modificable),
    INDEX idx_nivel (nivel_acceso)
);

-- =============================================
-- MÓDULO 16: AUDITORÍA Y LOGS COMPLETOS
-- =============================================

-- Log completo de actividades del sistema
CREATE TABLE IF NOT EXISTS log_actividades (
    id_log INT PRIMARY KEY AUTO_INCREMENT,
    numero_log VARCHAR(20) UNIQUE AS (CONCAT('LOG', LPAD(id_log, 10, '0'))) STORED,

    -- Usuario y sesión
    id_camarero INT NULL,
    id_sesion VARCHAR(100),

    -- Información de la acción
    accion VARCHAR(100) NOT NULL,
    modulo VARCHAR(50),
    tabla_afectada VARCHAR(50),
    id_registro INT NULL,

    -- Datos del cambio
    datos_anteriores JSON NULL,
    datos_nuevos JSON NULL,
    campos_modificados JSON, -- lista de campos que cambiaron

    -- Información técnica
    ip_address VARCHAR(45),
    user_agent TEXT,
    metodo_http VARCHAR(10), -- GET, POST, PUT, DELETE
    url_solicitada VARCHAR(500),

    -- Información adicional
    resultado ENUM('EXITOSO', 'ERROR', 'ADVERTENCIA') DEFAULT 'EXITOSO',
    codigo_error VARCHAR(20),
    mensaje_error TEXT,
    tiempo_respuesta_ms INT,

    -- Clasificación de riesgo
    nivel_riesgo ENUM('BAJO', 'MEDIO', 'ALTO', 'CRITICO') DEFAULT 'BAJO',
    es_critico CHAR(1) DEFAULT 'N',

    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_camarero (id_camarero),
    INDEX idx_accion (accion),
    INDEX idx_tabla (tabla_afectada),
    INDEX idx_timestamp (timestamp),
    INDEX idx_resultado (resultado),
    INDEX idx_nivel_riesgo (nivel_riesgo),
    INDEX idx_numero (numero_log)
);

-- Historial de precios de productos
CREATE TABLE IF NOT EXISTS historial_precios (
    id_historial INT PRIMARY KEY AUTO_INCREMENT,
    id_complementog INT NOT NULL,
    precio_anterior DECIMAL(10,2) NOT NULL,
    precio_nuevo DECIMAL(10,2) NOT NULL,
    motivo VARCHAR(200),
    id_camarero INT,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE CASCADE,
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_producto (id_complementog),
    INDEX idx_fecha (fecha_cambio)
);

-- =============================================
-- DATOS INICIALES DEL SISTEMA
-- =============================================

-- Insertar roles por defecto
INSERT INTO roles (codigo_rol, nombre, descripcion, nivel_jerarquia, color, icono) VALUES
('ADMIN', 'Administrador', 'Acceso completo al sistema', 10, '#e74c3c', 'fas fa-user-shield'),
('DUENO', 'Dueño/Propietario', 'Propietario del restaurante', 9, '#9b59b6', 'fas fa-crown'),
('CAJERA', 'Cajera Principal', 'Operadora de caja principal', 8, '#3498db', 'fas fa-cash-register'),
('JEFE_GARZON', 'Jefe de Garzones', 'Supervisor de camareros', 7, '#2ecc71', 'fas fa-users'),
('GARZON', 'Garzón/Camarero', 'Camarero/Mesero', 5, '#f39c12', 'fas fa-user'),
('JEFE_COCINA', 'Jefe de Cocina', 'Supervisor de cocina', 7, '#e67e22', 'fas fa-utensils'),
('COCINERO', 'Cocinero', 'Personal de cocina', 4, '#d35400', 'fas fa-fire'),
('BARTENDER', 'Bartender', 'Barista/Bartender', 4, '#8e44ad', 'fas fa-cocktail'),
('CONTADOR', 'Contador', 'Administrador financiero', 6, '#34495e', 'fas fa-calculator');

-- Insertar permisos completos del sistema
INSERT INTO permisos_sistema (codigo_permiso, nombre_permiso, modulo, accion, recurso) VALUES
-- VENTAS
('VENTAS_CREAR', 'Crear nueva venta', 'VENTAS', 'CREATE', 'ventadirecta'),
('VENTAS_MODIFICAR', 'Modificar venta existente', 'VENTAS', 'UPDATE', 'ventadirecta'),
('VENTAS_ELIMINAR', 'Eliminar/cancelar venta', 'VENTAS', 'DELETE', 'ventadirecta'),
('VENTAS_VER_TODAS', 'Ver todas las ventas', 'VENTAS', 'READ', 'ventadirecta'),
('VENTAS_VER_PROPIAS', 'Ver solo sus propias ventas', 'VENTAS', 'READ', 'ventadirecta'),
('VENTAS_DESCUENTO', 'Aplicar descuentos', 'VENTAS', 'EXECUTE', 'descuentos'),

-- CAJA Y PUNTO DE VENTA
('CAJA_ABRIR', 'Abrir punto de venta', 'CAJA', 'CREATE', 'apertura_caja'),
('CAJA_CERRAR', 'Cerrar punto de venta', 'CAJA', 'CREATE', 'cierre_caja'),
('CAJA_ARQUEO', 'Realizar arqueo de caja', 'CAJA', 'EXECUTE', 'arqueo'),
('CAJA_REPORTES', 'Generar reportes de caja', 'CAJA', 'READ', 'reportes_caja'),
('CAJA_MODIFICAR_SALDO', 'Modificar saldo inicial', 'CAJA', 'UPDATE', 'apertura_caja'),

-- PRODUCTOS
('PRODUCTOS_CREAR', 'Crear productos', 'PRODUCTOS', 'CREATE', 'complementog'),
('PRODUCTOS_MODIFICAR', 'Modificar productos', 'PRODUCTOS', 'UPDATE', 'complementog'),
('PRODUCTOS_ELIMINAR', 'Eliminar productos', 'PRODUCTOS', 'DELETE', 'complementog'),
('PRODUCTOS_VER_PRECIOS', 'Ver precios de productos', 'PRODUCTOS', 'READ', 'precios'),
('PRODUCTOS_MODIFICAR_PRECIOS', 'Modificar precios', 'PRODUCTOS', 'UPDATE', 'precios'),

-- MESAS
('MESAS_ASIGNAR', 'Asignar mesas a camareros', 'MESAS', 'UPDATE', 'mesa'),
('MESAS_VER_TODAS', 'Ver estado de todas las mesas', 'MESAS', 'READ', 'mesa'),
('MESAS_VER_ASIGNADAS', 'Ver solo mesas asignadas', 'MESAS', 'READ', 'mesa'),
('MESAS_CAMBIAR_ESTADO', 'Cambiar estado de mesas', 'MESAS', 'UPDATE', 'mesa_estado'),

-- USUARIOS
('USUARIOS_CREAR', 'Crear usuarios', 'USUARIOS', 'CREATE', 'camareros'),
('USUARIOS_MODIFICAR', 'Modificar usuarios', 'USUARIOS', 'UPDATE', 'camareros'),
('USUARIOS_ELIMINAR', 'Eliminar usuarios', 'USUARIOS', 'DELETE', 'camareros'),
('USUARIOS_PERMISOS', 'Gestionar permisos', 'USUARIOS', 'UPDATE', 'permisos'),
('USUARIOS_ROLES', 'Gestionar roles', 'USUARIOS', 'UPDATE', 'roles'),

-- REPORTES
('REPORTES_VENTAS_DIA', 'Reportes de ventas del día', 'REPORTES', 'READ', 'ventas_dia'),
('REPORTES_VENTAS_PERIODO', 'Reportes por período', 'REPORTES', 'READ', 'ventas_periodo'),
('REPORTES_PRODUCTIVIDAD', 'Reportes de productividad', 'REPORTES', 'READ', 'productividad'),
('REPORTES_FINANCIEROS', 'Reportes financieros', 'REPORTES', 'READ', 'financieros'),
('REPORTES_STOCK', 'Reportes de stock', 'REPORTES', 'READ', 'stock'),

-- CONFIGURACIÓN
('CONFIG_RESTAURANTE', 'Configurar datos del restaurante', 'CONFIG', 'UPDATE', 'restaurant_config'),
('CONFIG_IMPRESORAS', 'Configurar impresoras', 'CONFIG', 'UPDATE', 'impresoras'),
('CONFIG_SISTEMA', 'Configuración del sistema', 'CONFIG', 'UPDATE', 'configuracion_sistema'),

-- COCINA
('COCINA_VER_PEDIDOS', 'Ver pedidos de cocina', 'COCINA', 'READ', 'tiempos_cocina'),
('COCINA_MARCAR_LISTO', 'Marcar platos como listos', 'COCINA', 'UPDATE', 'tiempos_cocina'),
('COCINA_TIEMPOS', 'Control de tiempos de cocina', 'COCINA', 'UPDATE', 'tiempos_cocina'),
('COCINA_ESTACIONES', 'Gestionar estaciones de cocina', 'COCINA', 'UPDATE', 'estaciones_cocina'),

-- STOCK
('STOCK_VER', 'Ver stock de productos', 'STOCK', 'READ', 'almacen_complementg'),
('STOCK_MODIFICAR', 'Modificar stock', 'STOCK', 'UPDATE', 'almacen_complementg'),
('STOCK_REPORTES', 'Reportes de stock', 'STOCK', 'READ', 'stock_reportes'),
('STOCK_MOVIMIENTOS', 'Registrar movimientos', 'STOCK', 'CREATE', 'movimientos_stock'),

-- ADMINISTRACIÓN
('ADMIN_LOGS', 'Ver logs del sistema', 'ADMIN', 'READ', 'log_actividades'),
('ADMIN_BACKUP', 'Realizar backup', 'ADMIN', 'EXECUTE', 'backup'),
('ADMIN_RESTORE', 'Restaurar backup', 'ADMIN', 'EXECUTE', 'restore');

-- Asignar permisos a roles
-- ADMINISTRADOR - Todos los permisos
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 1, id_permiso FROM permisos_sistema;

-- DUEÑO - Casi todos los permisos excepto logs detallados
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 2, id_permiso FROM permisos_sistema
WHERE codigo_permiso NOT IN ('ADMIN_LOGS', 'ADMIN_RESTORE');

-- CAJERA - Permisos relacionados con caja y ventas
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 3, id_permiso FROM permisos_sistema
WHERE codigo_permiso LIKE 'CAJA_%'
   OR codigo_permiso LIKE 'VENTAS_%'
   OR codigo_permiso LIKE 'REPORTES_VENTAS_%'
   OR codigo_permiso = 'MESAS_VER_TODAS';

-- JEFE DE GARZONES - Gestión de personal y mesas
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 4, id_permiso FROM permisos_sistema
WHERE codigo_permiso LIKE 'MESAS_%'
   OR codigo_permiso LIKE 'USUARIOS_%'
   OR codigo_permiso LIKE 'REPORTES_PRODUCTIVIDAD%'
   OR codigo_permiso = 'VENTAS_VER_TODAS';

-- GARZÓN - Permisos básicos de servicio
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 5, id_permiso FROM permisos_sistema
WHERE codigo_permiso IN ('VENTAS_CREAR', 'VENTAS_MODIFICAR', 'VENTAS_VER_PROPIAS',
                        'MESAS_VER_ASIGNADAS', 'PRODUCTOS_VER_PRECIOS', 'MESAS_CAMBIAR_ESTADO');

-- JEFE DE COCINA - Gestión completa de cocina
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 6, id_permiso FROM permisos_sistema
WHERE codigo_permiso LIKE 'COCINA_%'
   OR codigo_permiso LIKE 'STOCK_%';

-- COCINERO - Operación de cocina
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 7, id_permiso FROM permisos_sistema
WHERE codigo_permiso IN ('COCINA_VER_PEDIDOS', 'COCINA_MARCAR_LISTO', 'STOCK_VER');

-- BARTENDER - Similar a cocinero pero para bar
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 8, id_permiso FROM permisos_sistema
WHERE codigo_permiso IN ('COCINA_VER_PEDIDOS', 'COCINA_MARCAR_LISTO', 'STOCK_VER');

-- CONTADOR - Reportes y finanzas
INSERT INTO rol_permisos (id_rol, id_permiso)
SELECT 9, id_permiso FROM permisos_sistema
WHERE codigo_permiso LIKE 'REPORTES_%'
   OR codigo_permiso = 'CONFIG_SISTEMA';

-- Usuario administrador por defecto
INSERT INTO camareros (codigo_empleado, nombre, apellidos, email, password, activo) VALUES
('ADMIN001', 'Administrador', 'del Sistema', 'admin@restaurant.com', '$2b$10$rQ3K5Z9Jq8yT2pA1mB3nCO7vX4wE6sF8gH9jK0lM1nP2qR5sT6uV7', 'S');

-- Asignar rol de administrador al usuario por defecto
INSERT INTO camarero_roles (id_camarero, id_rol) VALUES (1, 1);

-- Cajas por defecto
INSERT INTO cajas (codigo_caja, nombre, descripcion, tipo, activa) VALUES
('CAJA001', 'CAJA PRINCIPAL', 'Caja Principal - PC Servidor', 'PRINCIPAL', 'S'),
('TERM001', 'TERMINAL GARZON 1', 'Terminal Garzón 1', 'TERMINAL', 'S'),
('COCI001', 'IMPRESORA COCINA', 'Impresora de Cocina', 'COCINA', 'S'),
('BAR001', 'IMPRESORA BAR', 'Impresora de Bar', 'BAR', 'S');

-- Almacén principal
INSERT INTO almacen (codigo_almacen, nom_almacen, descripcion, activo) VALUES
('ALM001', 'PRINCIPAL', 'Almacén Principal del Restaurante', 'S');

-- Series de facturación por defecto
INSERT INTO series_facturacion (serie, descripcion, tipo_documento, activa) VALUES
('F', 'Facturas', 'FACTURA', 'S'),
('B', 'Boletas', 'BOLETA', 'S'),
('T', 'Tickets', 'TICKET', 'S');

-- Formas de pago completas
INSERT INTO modo_pago (codigo, descripcion, descripcion_corta, tipo, requiere_autorizacion, comision, activo) VALUES
('EFECTIVO', 'Efectivo', 'Efectivo', 'EFECTIVO', 'N', 0.00, 'S'),
('TC_VISA', 'Tarjeta Crédito Visa', 'TC Visa', 'TARJETA_CREDITO', 'S', 2.5, 'S'),
('TC_MASTER', 'Tarjeta Crédito MasterCard', 'TC Master', 'TARJETA_CREDITO', 'S', 2.5, 'S'),
('TD_REDCOMPRA', 'RedCompra', 'RedCompra', 'TARJETA_DEBITO', 'S', 1.2, 'S'),
('TRANSFERENCIA', 'Transferencia Bancaria', 'Transfer', 'TRANSFERENCIA', 'S', 0.5, 'S'),
('CHEQUE', 'Cheque', 'Cheque', 'CHEQUE', 'S', 0.0, 'S'),
('VALE_SODEXO', 'Vale Sodexo', 'Sodexo', 'VALE_COMIDA', 'N', 0.0, 'S'),
('JUNAEB', 'JUNAEB', 'JUNAEB', 'VALE_COMIDA', 'N', 0.0, 'S'),
('CREDITO_CASA', 'Crédito de la Casa', 'Crédito', 'CREDITO', 'S', 0.0, 'S');

-- Configuraciones COMPLETAS del sistema
INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion, categoria, modificable) VALUES
-- OPERACIÓN GENERAL
('APP_NAME', 'DYSA Point POS', 'STRING', 'Nombre de la aplicación', 'GENERAL', 'N'),
('APP_VERSION', '2.0.14', 'STRING', 'Versión de la aplicación', 'GENERAL', 'N'),
('CURRENCY', 'CLP', 'STRING', 'Moneda por defecto', 'GENERAL', 'S'),
('TIMEZONE', 'America/Santiago', 'STRING', 'Zona horaria', 'GENERAL', 'S'),
('LANGUAGE', 'es', 'STRING', 'Idioma por defecto', 'GENERAL', 'S'),

-- OPERACIÓN DEL RESTAURANTE
('HORA_APERTURA', '08:00', 'TIME', 'Hora de apertura del restaurante', 'OPERACION', 'S'),
('HORA_CIERRE', '23:00', 'TIME', 'Hora de cierre del restaurante', 'OPERACION', 'S'),
('TIEMPO_LIMITE_MESA', '180', 'NUMBER', 'Tiempo límite por mesa (minutos)', 'OPERACION', 'S'),
('PROPINA_SUGERIDA', '10', 'NUMBER', 'Porcentaje de propina sugerida', 'OPERACION', 'S'),
('COMENSALES_DEFAULT', '2', 'NUMBER', 'Número de comensales por defecto', 'OPERACION', 'S'),

-- IMPUESTOS Y FACTURACIÓN
('IVA_RATE', '19', 'NUMBER', 'Tasa de IVA (%)', 'IMPUESTOS', 'S'),
('DECIMAL_PLACES', '2', 'NUMBER', 'Decimales en precios', 'GENERAL', 'S'),
('REDONDEO_ACTIVO', 'true', 'BOOLEAN', 'Redondear a múltiplos de $10', 'IMPUESTOS', 'S'),
('FOLIO_INICIAL_TICKET', '1', 'NUMBER', 'Folio inicial para tickets', 'FACTURACION', 'S'),

-- COCINA
('TIEMPO_ALERTA_COCINA', '15', 'NUMBER', 'Tiempo para alertar demora (minutos)', 'COCINA', 'S'),
('AUTO_PRINT_COCINA', 'true', 'BOOLEAN', 'Imprimir automáticamente en cocina', 'COCINA', 'S'),
('AGRUPA_POR_CATEGORIA', 'true', 'BOOLEAN', 'Agrupar comandas por categoría', 'COCINA', 'S'),
('TIEMPO_MAX_PREPARACION', '45', 'NUMBER', 'Tiempo máximo de preparación (min)', 'COCINA', 'S'),

-- IMPRESIÓN
('AUTO_PRINT_TICKET', 'true', 'BOOLEAN', 'Imprimir ticket automáticamente', 'IMPRESION', 'S'),
('COPIAS_COMANDA_COCINA', '1', 'NUMBER', 'Copias de comanda para cocina', 'IMPRESION', 'S'),
('COPIAS_COMANDA_BAR', '1', 'NUMBER', 'Copias de comanda para bar', 'IMPRESION', 'S'),
('CORTE_AUTOMATICO', 'true', 'BOOLEAN', 'Corte automático de papel', 'IMPRESION', 'S'),

-- STOCK E INVENTARIO
('STOCK_CONTROL', 'true', 'BOOLEAN', 'Control de stock activo', 'INVENTARIO', 'S'),
('ALERTA_STOCK_MINIMO', 'true', 'BOOLEAN', 'Alertar stock mínimo', 'INVENTARIO', 'S'),
('DESCUENTA_STOCK_AUTO', 'true', 'BOOLEAN', 'Descontar stock automáticamente', 'INVENTARIO', 'S'),

-- SEGURIDAD
('SESION_TIMEOUT', '30', 'NUMBER', 'Timeout de sesión (minutos)', 'SEGURIDAD', 'S'),
('INTENTOS_LOGIN_MAX', '3', 'NUMBER', 'Intentos máximos de login', 'SEGURIDAD', 'S'),
('REQUIERE_SUPERVISOR_DESCUENTO', 'true', 'BOOLEAN', 'Requiere supervisor para descuentos', 'SEGURIDAD', 'S'),
('DESCUENTO_MAXIMO_SIN_SUPER', '5', 'NUMBER', 'Descuento máximo sin supervisor (%)', 'SEGURIDAD', 'S'),

-- REPORTES Y BACKUP
('BACKUP_AUTOMATICO', 'true', 'BOOLEAN', 'Backup automático diario', 'REPORTES', 'S'),
('HORA_BACKUP', '02:00', 'TIME', 'Hora del backup automático', 'REPORTES', 'S'),
('DIAS_BACKUP_HISTORICO', '30', 'NUMBER', 'Días de backup histórico', 'REPORTES', 'S'),
('ENVIAR_REPORTES_EMAIL', 'false', 'BOOLEAN', 'Enviar reportes por email', 'REPORTES', 'S'),

-- CONFIGURACIÓN DE MESAS
('TIEMPO_ADVERTENCIA_MESA', '120', 'NUMBER', 'Tiempo para advertir mesa ocupada (min)', 'MESAS', 'S'),
('AUTO_ASIGNAR_MESAS', 'false', 'BOOLEAN', 'Asignar mesas automáticamente', 'MESAS', 'S'),
('PERMITIR_MESAS_SIN_ASIGNAR', 'true', 'BOOLEAN', 'Permitir mesas sin asignar', 'MESAS', 'S'),

-- PERSONALIZACIÓN UI
('TEMA_COLOR', 'azul', 'STRING', 'Tema de color de la interfaz', 'UI', 'S'),
('MOSTRAR_IMAGENES_PRODUCTOS', 'true', 'BOOLEAN', 'Mostrar imágenes en productos', 'UI', 'S'),
('TAMAÑO_FUENTE_COMANDAS', '12', 'NUMBER', 'Tamaño de fuente en comandas', 'UI', 'S');

-- =============================================
-- TRIGGERS AVANZADOS PARA AUTOMATIZACIÓN
-- =============================================

DELIMITER $$

-- Trigger para actualizar totales de venta
CREATE TRIGGER tr_ventadir_comg_update_totals
    AFTER INSERT ON ventadir_comg
    FOR EACH ROW
BEGIN
    UPDATE ventadirecta
    SET
        subtotal = (
            SELECT COALESCE(SUM(subtotal), 0)
            FROM ventadir_comg
            WHERE id_venta = NEW.id_venta
        ),
        total = (
            SELECT COALESCE(SUM(total), 0)
            FROM ventadir_comg
            WHERE id_venta = NEW.id_venta
        )
    WHERE id_venta = NEW.id_venta;
END$$

-- Trigger para restar stock automáticamente
CREATE TRIGGER tr_venta_restar_stock
    AFTER UPDATE ON ventadirecta
    FOR EACH ROW
BEGIN
    DECLARE stock_control BOOLEAN DEFAULT FALSE;

    -- Verificar si el control de stock está activo
    SELECT valor = 'true' INTO stock_control
    FROM configuracion_sistema
    WHERE clave = 'STOCK_CONTROL';

    -- Solo si el control de stock está activo y se cierra la venta
    IF stock_control AND OLD.cerrada = 'N' AND NEW.cerrada = 'S' THEN
        -- Restar stock de todos los productos de la venta
        UPDATE almacen_complementg ac
        INNER JOIN ventadir_comg vc ON ac.id_complementog = vc.id_complementog
        SET ac.cantidad = ac.cantidad - vc.cantidad
        WHERE vc.id_venta = NEW.id_venta
        AND ac.id_almacen = 1; -- almacén principal

        -- Registrar movimientos de stock
        INSERT INTO movimientos_stock (
            id_almacen, id_complementog, tipo_movimiento,
            cantidad, cantidad_anterior, cantidad_nueva,
            motivo, id_venta, id_camarero
        )
        SELECT
            1, -- almacén principal
            vc.id_complementog,
            'SALIDA',
            vc.cantidad,
            ac.cantidad + vc.cantidad,
            ac.cantidad,
            CONCAT('Venta ', NEW.numero_venta),
            NEW.id_venta,
            NEW.id_camarero
        FROM ventadir_comg vc
        INNER JOIN almacen_complementg ac ON ac.id_complementog = vc.id_complementog
        WHERE vc.id_venta = NEW.id_venta AND ac.id_almacen = 1;
    END IF;
END$$

-- Trigger para actualizar saldo en pagos
CREATE TRIGGER tr_pagoscobros_update_saldo
    BEFORE INSERT ON pagoscobros
    FOR EACH ROW
BEGIN
    DECLARE ultimo_saldo DECIMAL(10,2) DEFAULT 0;

    -- Obtener último saldo de la apertura de caja
    SELECT COALESCE(saldo, 0) INTO ultimo_saldo
    FROM pagoscobros
    WHERE id_apcajas = NEW.id_apcajas
    ORDER BY id_pagoscobros DESC
    LIMIT 1;

    -- Si no hay registros, usar saldo inicial de apertura
    IF ultimo_saldo = 0 THEN
        SELECT saldo_inicial INTO ultimo_saldo
        FROM apertura_caja
        WHERE id_apertura = NEW.id_apcajas;
    END IF;

    -- Calcular nuevo saldo
    IF NEW.tipo = 'E' THEN
        SET NEW.saldo = ultimo_saldo + NEW.importe_neto;
    ELSE
        SET NEW.saldo = ultimo_saldo - NEW.importe_neto;
    END IF;
END$$

-- Trigger para controlar estado de mesas
CREATE TRIGGER tr_mesa_estado_control
    AFTER INSERT ON ventadirecta
    FOR EACH ROW
BEGIN
    -- Actualizar estado de mesa a ocupada
    IF NEW.Num_Mesa IS NOT NULL THEN
        INSERT INTO mesa_estado (Num_Mesa, estado_actual, ocupada_desde, comensales_actuales, id_venta_actual)
        VALUES (NEW.Num_Mesa, 'OCUPADA', NOW(), NEW.comensales, NEW.id_venta)
        ON DUPLICATE KEY UPDATE
            estado_actual = 'OCUPADA',
            ocupada_desde = NOW(),
            comensales_actuales = NEW.comensales,
            id_venta_actual = NEW.id_venta;
    END IF;
END$$

-- Trigger para liberar mesa al cerrar venta
CREATE TRIGGER tr_mesa_liberar
    AFTER UPDATE ON ventadirecta
    FOR EACH ROW
BEGIN
    -- Liberar mesa cuando se cierra la venta
    IF OLD.cerrada = 'N' AND NEW.cerrada = 'S' AND NEW.Num_Mesa IS NOT NULL THEN
        UPDATE mesa_estado
        SET estado_actual = 'LIBRE',
            ocupada_desde = NULL,
            comensales_actuales = 0,
            id_venta_actual = NULL
        WHERE Num_Mesa = NEW.Num_Mesa;
    END IF;
END$$

-- Trigger para log de actividades automático
CREATE TRIGGER tr_log_cambios_precios
    AFTER UPDATE ON complementog
    FOR EACH ROW
BEGIN
    -- Registrar cambios de precios
    IF OLD.precio != NEW.precio THEN
        INSERT INTO historial_precios (id_complementog, precio_anterior, precio_nuevo, motivo)
        VALUES (NEW.id_complementog, OLD.precio, NEW.precio, 'Actualización automática');

        INSERT INTO log_actividades (accion, modulo, tabla_afectada, id_registro, datos_anteriores, datos_nuevos)
        VALUES (
            'CAMBIO_PRECIO',
            'PRODUCTOS',
            'complementog',
            NEW.id_complementog,
            JSON_OBJECT('precio', OLD.precio),
            JSON_OBJECT('precio', NEW.precio)
        );
    END IF;
END$$

DELIMITER ;

-- =============================================
-- VISTAS AVANZADAS PARA REPORTES
-- =============================================

-- Vista completa de ventas
CREATE VIEW v_ventas_completas AS
SELECT
    v.id_venta,
    v.numero_venta,
    v.fecha_venta,
    v.hora,
    v.Num_Mesa,
    m.descripcion AS mesa_descripcion,
    s.nombre AS salon_nombre,
    v.comensales,
    v.alias AS cliente,
    v.subtotal,
    v.descuento_monto,
    v.propina,
    v.total,
    v.cerrada,
    v.tipo_servicio,
    c.nombre AS camarero,
    c.codigo_empleado,
    ca.nombre AS caja_nombre,
    v.tiempo_servicio_minutos
FROM ventadirecta v
LEFT JOIN mesa m ON v.Num_Mesa = m.Num_Mesa
LEFT JOIN salon s ON m.id_salon = s.id_salon
LEFT JOIN camareros c ON v.id_camarero = c.id_camarero
LEFT JOIN apertura_caja ac ON v.fecha_venta = ac.fecha_apertura
LEFT JOIN cajas ca ON ac.id_caja = ca.id_caja;

-- Vista de productos más vendidos con detalles
CREATE VIEW v_productos_ranking AS
SELECT
    vc.id_complementog,
    p.codigo,
    p.alias,
    cat.nombre AS categoria,
    SUM(vc.cantidad) AS total_vendido,
    SUM(vc.total) AS total_ingresos,
    COUNT(DISTINCT vc.id_venta) AS ventas_distintas,
    AVG(vc.precio) AS precio_promedio,
    MIN(vc.precio) AS precio_minimo,
    MAX(vc.precio) AS precio_maximo,
    AVG(p.tiempo_preparacion) AS tiempo_prep_promedio
FROM ventadir_comg vc
INNER JOIN ventadirecta v ON vc.id_venta = v.id_venta
INNER JOIN complementog p ON vc.id_complementog = p.id_complementog
LEFT JOIN categoria cat ON p.id_categoria = cat.id_categoria
WHERE v.cerrada = 'S'
AND v.fecha_venta >= DATE_SUB(CURRENT_DATE, INTERVAL 30 DAY)
GROUP BY vc.id_complementog, p.codigo, p.alias, cat.nombre
ORDER BY total_vendido DESC;

-- Vista de productividad por camarero
CREATE VIEW v_productividad_camareros AS
SELECT
    c.id_camarero,
    c.codigo_empleado,
    c.nombre,
    DATE(v.fecha_venta) AS fecha,
    COUNT(v.id_venta) AS num_ventas,
    SUM(v.total) AS total_vendido,
    AVG(v.total) AS ticket_promedio,
    COUNT(DISTINCT v.Num_Mesa) AS mesas_atendidas,
    AVG(v.tiempo_servicio_minutos) AS tiempo_servicio_promedio,
    SUM(v.comensales) AS total_comensales,
    (SUM(v.total) / SUM(v.comensales)) AS venta_por_comensal
FROM ventadirecta v
INNER JOIN camareros c ON v.id_camarero = c.id_camarero
WHERE v.cerrada = 'S'
GROUP BY c.id_camarero, c.codigo_empleado, c.nombre, DATE(v.fecha_venta)
ORDER BY fecha DESC, total_vendido DESC;

-- Vista de estado actual de cocina
CREATE VIEW v_estado_cocina AS
SELECT
    tc.id_venta,
    v.numero_venta,
    v.Num_Mesa,
    m.descripcion AS mesa,
    tc.id_linea,
    vc.complementog AS producto,
    vc.cantidad,
    tc.estado_actual,
    tc.prioridad,
    ec.nombre AS estacion,
    tc.tiempo_estimado,
    tc.tiempo_real_preparacion,
    TIMESTAMPDIFF(MINUTE, tc.hora_pedido, NOW()) AS minutos_desde_pedido,
    tc.hora_pedido,
    tc.hora_listo,
    CASE
        WHEN tc.tiempo_estimado IS NOT NULL
        AND TIMESTAMPDIFF(MINUTE, tc.hora_pedido, NOW()) > tc.tiempo_estimado
        THEN 'RETRASADO'
        ELSE 'EN_TIEMPO'
    END AS estado_tiempo
FROM tiempos_cocina tc
INNER JOIN ventadirecta v ON tc.id_venta = v.id_venta
INNER JOIN ventadir_comg vc ON tc.id_venta = vc.id_venta AND tc.id_linea = vc.id_linea
LEFT JOIN mesa m ON v.Num_Mesa = m.Num_Mesa
LEFT JOIN estaciones_cocina ec ON tc.id_estacion = ec.id_estacion
WHERE v.cerrada = 'N'
AND tc.estado_actual NOT IN ('SERVIDO', 'CANCELADO')
ORDER BY tc.prioridad DESC, tc.hora_pedido;

-- Vista de stock crítico
CREATE VIEW v_stock_critico AS
SELECT
    p.id_complementog,
    p.codigo,
    p.alias,
    cat.nombre AS categoria,
    ac.cantidad AS stock_actual,
    ac.stock_minimo,
    ac.punto_reorden,
    (ac.stock_minimo - ac.cantidad) AS deficit,
    al.nom_almacen,
    CASE
        WHEN ac.cantidad <= 0 THEN 'SIN_STOCK'
        WHEN ac.cantidad <= ac.stock_minimo THEN 'STOCK_BAJO'
        WHEN ac.cantidad <= ac.punto_reorden THEN 'PUNTO_REORDEN'
        ELSE 'NORMAL'
    END AS nivel_criticidad,
    ac.fecha_vencimiento,
    DATEDIFF(ac.fecha_vencimiento, CURRENT_DATE) AS dias_vencimiento
FROM almacen_complementg ac
INNER JOIN complementog p ON ac.id_complementog = p.id_complementog
INNER JOIN almacen al ON ac.id_almacen = al.id_almacen
LEFT JOIN categoria cat ON p.id_categoria = cat.id_categoria
WHERE p.activo = 'S'
AND al.activo = 'S'
AND (ac.cantidad <= ac.punto_reorden OR ac.fecha_vencimiento <= DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY))
ORDER BY
    CASE
        WHEN ac.cantidad <= 0 THEN 1
        WHEN ac.cantidad <= ac.stock_minimo THEN 2
        WHEN ac.cantidad <= ac.punto_reorden THEN 3
        ELSE 4
    END,
    ac.fecha_vencimiento;

-- =============================================
-- PROCEDIMIENTOS ALMACENADOS AVANZADOS
-- =============================================

DELIMITER $$

-- Procedimiento para cerrar venta completo
CREATE PROCEDURE sp_cerrar_venta_completa(
    IN p_id_venta INT,
    IN p_formas_pago JSON, -- Array de formas de pago
    IN p_id_camarero INT,
    OUT p_id_tiquet INT,
    OUT p_serie CHAR(1),
    OUT p_resultado VARCHAR(200)
)
BEGIN
    DECLARE v_total DECIMAL(10,2);
    DECLARE v_id_apcajas INT;
    DECLARE v_id_caja INT;
    DECLARE v_siguiente_tiquet INT;
    DECLARE v_suma_pagos DECIMAL(10,2) DEFAULT 0;
    DECLARE done INT DEFAULT FALSE;
    DECLARE v_error_msg VARCHAR(500);

    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        GET DIAGNOSTICS CONDITION 1
            v_error_msg = MESSAGE_TEXT;
        SET p_resultado = CONCAT('ERROR: ', v_error_msg);
    END;

    START TRANSACTION;

    -- Verificar que la venta existe y está abierta
    SELECT total INTO v_total
    FROM ventadirecta
    WHERE id_venta = p_id_venta AND cerrada = 'N';

    IF v_total IS NULL THEN
        SET p_resultado = 'ERROR: Venta no encontrada o ya cerrada';
        ROLLBACK;
        LEAVE sp_cerrar_venta_completa;
    END IF;

    -- Obtener caja abierta
    SELECT id_apertura, id_caja INTO v_id_apcajas, v_id_caja
    FROM apertura_caja
    WHERE estado = 'ABIERTA'
    ORDER BY id_apertura DESC
    LIMIT 1;

    IF v_id_apcajas IS NULL THEN
        SET p_resultado = 'ERROR: No hay caja abierta';
        ROLLBACK;
        LEAVE sp_cerrar_venta_completa;
    END IF;

    -- Validar que la suma de pagos coincida con el total
    SELECT SUM(JSON_EXTRACT(valor, '$.monto')) INTO v_suma_pagos
    FROM JSON_TABLE(p_formas_pago, '$[*]' COLUMNS (valor JSON PATH '$')) AS jt;

    IF ABS(v_suma_pagos - v_total) > 0.01 THEN
        SET p_resultado = 'ERROR: La suma de pagos no coincide con el total';
        ROLLBACK;
        LEAVE sp_cerrar_venta_completa;
    END IF;

    -- Obtener siguiente número de ticket
    SET p_serie = 'T';
    SELECT siguiente_numero INTO v_siguiente_tiquet
    FROM series_facturacion
    WHERE serie = p_serie AND activa = 'S';

    SET p_id_tiquet = v_siguiente_tiquet;

    -- Crear ticket
    INSERT INTO tiquet (serie, id_tiquet, fecha_tiquet, horatiquet, total)
    VALUES (p_serie, p_id_tiquet, CURDATE(), CURTIME(), v_total);

    -- Actualizar serie
    UPDATE series_facturacion
    SET siguiente_numero = siguiente_numero + 1
    WHERE serie = p_serie;

    -- Cerrar venta
    UPDATE ventadirecta
    SET cerrada = 'S',
        serie = p_serie,
        id_tiquet = p_id_tiquet,
        hora_cuenta_solicitada = NOW()
    WHERE id_venta = p_id_venta;

    -- Registrar pagos múltiples
    SET @secuencia = 0;
    INSERT INTO venta_pagos (id_venta, secuencia, id_modo_pago, monto, numero_autorizacion)
    SELECT
        p_id_venta,
        (@secuencia := @secuencia + 1),
        CAST(JSON_EXTRACT(valor, '$.id_modo_pago') AS UNSIGNED),
        CAST(JSON_EXTRACT(valor, '$.monto') AS DECIMAL(10,2)),
        JSON_UNQUOTE(JSON_EXTRACT(valor, '$.autorizacion'))
    FROM JSON_TABLE(p_formas_pago, '$[*]' COLUMNS (valor JSON PATH '$')) AS jt;

    -- Registrar movimiento en caja
    INSERT INTO pagoscobros (
        tipo, id_venta, fecha, hora, descripcion, importe,
        id_modo_pago, id_camarero, id_tiquet, serie_fac,
        id_apcajas, id_caja
    ) VALUES (
        'E', p_id_venta, CURDATE(), CURTIME(),
        CONCAT('Venta ', (SELECT numero_venta FROM ventadirecta WHERE id_venta = p_id_venta)), v_total,
        (SELECT CAST(JSON_EXTRACT(p_formas_pago, '$[0].id_modo_pago') AS UNSIGNED)), -- forma de pago principal
        p_id_camarero, p_id_tiquet, p_serie,
        v_id_apcajas, v_id_caja
    );

    -- Enviar a cola de impresión
    INSERT INTO venta_ticket (id_venta, tipo_impresion, estado)
    VALUES (p_id_venta, 'TICKET_CLIENTE', 'PENDIENTE');

    COMMIT;
    SET p_resultado = 'SUCCESS: Venta cerrada correctamente';

END$$

-- Procedimiento para apertura de caja
CREATE PROCEDURE sp_abrir_caja(
    IN p_id_caja INT,
    IN p_id_camarero INT,
    IN p_saldo_inicial DECIMAL(10,2),
    IN p_desglose_billetes JSON,
    OUT p_id_apertura INT,
    OUT p_resultado VARCHAR(200)
)
BEGIN
    DECLARE v_caja_abierta INT DEFAULT 0;
    DECLARE v_error_msg VARCHAR(500);

    DECLARE CONTINUE HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        GET DIAGNOSTICS CONDITION 1
            v_error_msg = MESSAGE_TEXT;
        SET p_resultado = CONCAT('ERROR: ', v_error_msg);
    END;

    START TRANSACTION;

    -- Verificar que no hay caja abierta
    SELECT COUNT(*) INTO v_caja_abierta
    FROM apertura_caja
    WHERE id_caja = p_id_caja AND estado = 'ABIERTA';

    IF v_caja_abierta > 0 THEN
        SET p_resultado = 'ERROR: Ya existe una caja abierta';
        ROLLBACK;
        LEAVE sp_abrir_caja;
    END IF;

    -- Crear apertura de caja
    INSERT INTO apertura_caja (
        id_caja, id_camarero_apertura, fecha_apertura, hora_apertura,
        saldo_inicial, estado
    ) VALUES (
        p_id_caja, p_id_camarero, CURDATE(), CURTIME(),
        p_saldo_inicial, 'ABIERTA'
    );

    SET p_id_apertura = LAST_INSERT_ID();

    -- Registrar movimiento inicial si hay saldo
    IF p_saldo_inicial > 0 THEN
        INSERT INTO pagoscobros (
            tipo, fecha, hora, descripcion, importe,
            id_modo_pago, id_camarero, id_apcajas, id_caja
        ) VALUES (
            'E', CURDATE(), CURTIME(), 'Apertura de caja - Saldo inicial',
            p_saldo_inicial, 1, p_id_camarero, p_id_apertura, p_id_caja
        );
    END IF;

    COMMIT;
    SET p_resultado = 'SUCCESS: Caja abierta correctamente';

END$$

DELIMITER ;

-- =============================================
-- ÍNDICES ADICIONALES PARA RENDIMIENTO
-- =============================================

-- Índices compuestos para consultas frecuentes
CREATE INDEX idx_ventadirecta_fecha_cerrada ON ventadirecta(fecha_venta, cerrada);
CREATE INDEX idx_ventadir_comg_estado_tiempo ON ventadir_comg(estado_cocina, hora_pedido);
CREATE INDEX idx_pagoscobros_fecha_tipo_caja ON pagoscobros(fecha, tipo, id_caja);
CREATE INDEX idx_log_timestamp_accion_usuario ON log_actividades(timestamp, accion, id_camarero);
CREATE INDEX idx_tiempos_cocina_estado_estacion ON tiempos_cocina(estado_actual, id_estacion);
CREATE INDEX idx_stock_cantidad_minimo ON almacen_complementg(cantidad, stock_minimo);

-- =============================================
-- FINALIZACIÓN
-- =============================================

-- Crear usuario de aplicación con permisos específicos
CREATE USER IF NOT EXISTS 'dysa_app'@'localhost' IDENTIFIED BY 'dysa2025!secure';
GRANT ALL PRIVILEGES ON dysa_point.* TO 'dysa_app'@'localhost';
FLUSH PRIVILEGES;

-- Mensaje de finalización
SELECT
    'Base de datos DYSA Point COMPLETA creada exitosamente' AS mensaje,
    COUNT(*) AS total_tablas
FROM information_schema.tables
WHERE table_schema = 'dysa_point';