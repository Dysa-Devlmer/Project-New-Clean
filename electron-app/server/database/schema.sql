-- =============================================
-- DYSA Point POS - Esquema de Base de Datos Completo
-- Sistema TPV Profesional para Restaurantes
-- Basado en análisis exhaustivo del sistema original SYSME
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
-- MÓDULO DE CONFIGURACIÓN DEL RESTAURANTE
-- =============================================

-- Información del restaurante
CREATE TABLE restaurant_config (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(200) NOT NULL,
    owner_name VARCHAR(200) NOT NULL,
    rut VARCHAR(50),
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(100),
    website VARCHAR(200),
    address TEXT NOT NULL,
    description TEXT,
    currency VARCHAR(3) DEFAULT 'CLP',
    timezone VARCHAR(50) DEFAULT 'America/Santiago',
    language VARCHAR(2) DEFAULT 'es',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- =============================================
-- MÓDULO DE USUARIOS Y EMPLEADOS
-- =============================================

-- Empleados/Camareros del restaurante
CREATE TABLE camareros (
    id_camarero INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255) NOT NULL,
    activo CHAR(1) DEFAULT 'S',
    imagen LONGBLOB,
    permisos JSON,
    fecha_alta DATE DEFAULT (CURRENT_DATE),
    ultimo_login TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_activo (activo),
    INDEX idx_email (email)
);

-- Roles y permisos
CREATE TABLE roles (
    id_rol INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    permisos JSON,
    activo CHAR(1) DEFAULT 'S',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Relación empleados-roles
CREATE TABLE camarero_roles (
    id_camarero INT,
    id_rol INT,
    PRIMARY KEY (id_camarero, id_rol),
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE CASCADE,
    FOREIGN KEY (id_rol) REFERENCES roles(id_rol) ON DELETE CASCADE
);

-- =============================================
-- MÓDULO DE CONFIGURACIÓN DE CAJAS/ESTACIONES
-- =============================================

-- Cajas/Estaciones de trabajo
CREATE TABLE cajas (
    id_caja INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion VARCHAR(100),
    tipo ENUM('PRINCIPAL', 'COCINA', 'BAR', 'TERMINAL') DEFAULT 'TERMINAL',
    impresora VARCHAR(100),
    ip_address VARCHAR(15),
    activa CHAR(1) DEFAULT 'S',
    configuracion JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_tipo (tipo),
    INDEX idx_activa (activa)
);

-- =============================================
-- MÓDULO DE SALONES Y MESAS
-- =============================================

-- Salones del restaurante
CREATE TABLE salon (
    id_salon INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#2196F3',
    activo CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,
    configuracion_mapa JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activo (activo),
    INDEX idx_orden (orden)
);

-- Mesas del restaurante
CREATE TABLE mesa (
    Num_Mesa INT PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL,
    capacidad INT DEFAULT 4,
    id_salon INT NOT NULL,
    posicion_x DECIMAL(8,2) DEFAULT 0,
    posicion_y DECIMAL(8,2) DEFAULT 0,
    ancho DECIMAL(8,2) DEFAULT 60,
    alto DECIMAL(8,2) DEFAULT 60,
    forma ENUM('RECTANGULAR', 'CIRCULAR', 'CUADRADA') DEFAULT 'RECTANGULAR',
    color VARCHAR(7) DEFAULT '#4CAF50',
    activa CHAR(1) DEFAULT 'S',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_salon) REFERENCES salon(id_salon) ON DELETE RESTRICT,
    INDEX idx_salon (id_salon),
    INDEX idx_activa (activa)
);

-- =============================================
-- MÓDULO DE PRODUCTOS Y CATÁLOGO
-- =============================================

-- Categorías principales
CREATE TABLE categoria (
    id_categoria INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#FF9800',
    icono VARCHAR(50),
    activa CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,
    imagen LONGBLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activa (activa),
    INDEX idx_orden (orden)
);

-- Subcategorías
CREATE TABLE subcategoria (
    id_subcategoria INT PRIMARY KEY AUTO_INCREMENT,
    id_categoria INT NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7),
    icono VARCHAR(50),
    activa CHAR(1) DEFAULT 'S',
    orden INT DEFAULT 0,
    imagen LONGBLOB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria) ON DELETE CASCADE,
    INDEX idx_categoria (id_categoria),
    INDEX idx_activa (activa),
    INDEX idx_orden (orden)
);

-- Tipos de productos (para clasificación adicional)
CREATE TABLE tipo_comg (
    id_tipo_comg INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#9C27B0',
    requiere_cocina CHAR(1) DEFAULT 'N',
    tiempo_preparacion INT DEFAULT 0, -- en minutos
    activo CHAR(1) DEFAULT 'S',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activo (activo)
);

-- Productos/Complementos
CREATE TABLE complementog (
    id_complementog INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(50) UNIQUE,
    alias VARCHAR(100) NOT NULL, -- nombre comercial
    descripcion TEXT,
    precio DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    precio_costo DECIMAL(10,2) DEFAULT 0.00,
    id_categoria INT,
    id_subcategoria INT,
    id_tipo_comg INT,
    cocina CHAR(1) DEFAULT 'N', -- si va a cocina
    panelcocina VARCHAR(100), -- a qué impresora/estación va
    tiempo_preparacion INT DEFAULT 0, -- minutos
    disponible CHAR(1) DEFAULT 'S',
    activo CHAR(1) DEFAULT 'S',
    imagen LONGBLOB,
    ingredientes TEXT,
    alergenos TEXT,
    calorias INT,
    orden INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria) ON DELETE SET NULL,
    FOREIGN KEY (id_subcategoria) REFERENCES subcategoria(id_subcategoria) ON DELETE SET NULL,
    FOREIGN KEY (id_tipo_comg) REFERENCES tipo_comg(id_tipo_comg) ON DELETE SET NULL,

    INDEX idx_categoria (id_categoria),
    INDEX idx_subcategoria (id_subcategoria),
    INDEX idx_activo (activo),
    INDEX idx_disponible (disponible),
    INDEX idx_codigo (codigo)
);

-- =============================================
-- MÓDULO DE VENTAS
-- =============================================

-- Ventas principales
CREATE TABLE ventadirecta (
    id_venta INT PRIMARY KEY AUTO_INCREMENT,
    Num_Mesa INT,
    fecha_venta DATE NOT NULL,
    hora TIME NOT NULL,
    cerrada CHAR(1) DEFAULT 'N', -- N=Abierta, S=Cerrada, M=Marcada, C=Cancelada
    comensales INT DEFAULT 1,
    alias VARCHAR(100), -- nombre del cliente o identificador
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    descuento DECIMAL(10,2) DEFAULT 0.00,
    impuestos DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) DEFAULT 0.00,
    id_camarero INT,
    observaciones TEXT,
    serie CHAR(1),
    id_tiquet INT,
    imppretiquet CHAR(1) DEFAULT 'N',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (Num_Mesa) REFERENCES mesa(Num_Mesa) ON DELETE SET NULL,
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_mesa (Num_Mesa),
    INDEX idx_camarero (id_camarero),
    INDEX idx_cerrada (cerrada),
    INDEX idx_fecha (fecha_venta),
    INDEX idx_fecha_hora (fecha_venta, hora)
);

-- Líneas de venta detalladas
CREATE TABLE ventadir_comg (
    id_venta INT NOT NULL,
    id_linea INT NOT NULL,
    id_complementog INT NOT NULL,
    complementog VARCHAR(200) NOT NULL, -- nombre del producto al momento de venta
    cantidad DECIMAL(8,3) NOT NULL DEFAULT 1.000,
    precio DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(5,2) DEFAULT 0.00,
    avgiva DECIMAL(5,2) DEFAULT 0.00,
    subtotal DECIMAL(10,2) GENERATED ALWAYS AS (
        (precio - (precio * descuento / 100)) * cantidad
    ) STORED,
    total DECIMAL(10,2) GENERATED ALWAYS AS (
        ((precio - (precio * descuento / 100)) * cantidad) * (1 + avgiva / 100)
    ) STORED,
    nota TEXT, -- observaciones del cliente
    observaciones TEXT, -- notas internas del camarero
    bloque_cocina INT DEFAULT 1,
    cocina DECIMAL(8,3) DEFAULT 0.000, -- cantidad enviada a cocina
    servido_cocina DECIMAL(8,3) DEFAULT 0.000, -- cantidad servida por cocina
    hora_cocina TIMESTAMP NULL,
    hora_servido TIMESTAMP NULL,
    estado_cocina ENUM('PENDIENTE', 'EN_PREPARACION', 'LISTO', 'SERVIDO') DEFAULT 'PENDIENTE',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id_venta, id_linea),
    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE RESTRICT,

    INDEX idx_complementog (id_complementog),
    INDEX idx_estado_cocina (estado_cocina),
    INDEX idx_bloque_cocina (bloque_cocina),
    INDEX idx_cocina_pendiente (cocina, servido_cocina)
);

-- =============================================
-- MÓDULO DE STOCK E INVENTARIO
-- =============================================

-- Almacenes
CREATE TABLE almacen (
    id_almacen INT PRIMARY KEY AUTO_INCREMENT,
    nom_almacen VARCHAR(100) NOT NULL,
    descripcion TEXT,
    ubicacion VARCHAR(200),
    responsable VARCHAR(100),
    activo CHAR(1) DEFAULT 'S',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activo (activo)
);

-- Stock por almacén y producto
CREATE TABLE almacen_complementg (
    id_almacen INT NOT NULL,
    id_complementog INT NOT NULL,
    cantidad DECIMAL(10,3) DEFAULT 0.000,
    stock_minimo DECIMAL(10,3) DEFAULT 0.000,
    stock_maximo DECIMAL(10,3) DEFAULT 0.000,
    unidad_medida VARCHAR(20) DEFAULT 'UND',
    ultima_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id_almacen, id_complementog),
    FOREIGN KEY (id_almacen) REFERENCES almacen(id_almacen) ON DELETE CASCADE,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE CASCADE,

    INDEX idx_stock_bajo (cantidad, stock_minimo)
);

-- Movimientos de stock
CREATE TABLE movimientos_stock (
    id_movimiento INT PRIMARY KEY AUTO_INCREMENT,
    id_almacen INT NOT NULL,
    id_complementog INT NOT NULL,
    tipo_movimiento ENUM('ENTRADA', 'SALIDA', 'AJUSTE', 'TRANSFERENCIA') NOT NULL,
    cantidad DECIMAL(10,3) NOT NULL,
    cantidad_anterior DECIMAL(10,3) NOT NULL,
    cantidad_nueva DECIMAL(10,3) NOT NULL,
    motivo VARCHAR(200),
    id_venta INT NULL, -- si es por venta
    id_camarero INT,
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_almacen) REFERENCES almacen(id_almacen) ON DELETE RESTRICT,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE RESTRICT,
    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE SET NULL,
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_fecha (fecha),
    INDEX idx_producto (id_complementog),
    INDEX idx_tipo (tipo_movimiento)
);

-- =============================================
-- MÓDULO DE PACKS Y COMPONENTES
-- =============================================

-- Packs (productos compuestos)
CREATE TABLE pack (
    id_complementog INT NOT NULL, -- producto principal (pack)
    id_complementog1 INT NOT NULL, -- componente del pack
    cantidad DECIMAL(8,3) NOT NULL DEFAULT 1.000, -- cantidad del componente
    opcional CHAR(1) DEFAULT 'N', -- si el componente es opcional
    precio_adicional DECIMAL(10,2) DEFAULT 0.00, -- precio extra si aplica
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id_complementog, id_complementog1),
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog) ON DELETE CASCADE,
    FOREIGN KEY (id_complementog1) REFERENCES complementog(id_complementog) ON DELETE CASCADE
);

-- =============================================
-- MÓDULO DE TICKETS Y FACTURACIÓN
-- =============================================

-- Series de facturación
CREATE TABLE series_facturacion (
    serie CHAR(1) PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL,
    prefijo VARCHAR(10) DEFAULT '',
    siguiente_numero INT DEFAULT 1,
    activa CHAR(1) DEFAULT 'S',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tickets/Facturas
CREATE TABLE tiquet (
    serie CHAR(1) NOT NULL,
    id_tiquet INT NOT NULL,
    numero_completo VARCHAR(50) GENERATED ALWAYS AS (CONCAT(serie, LPAD(id_tiquet, 6, '0'))) STORED,
    id_empresa CHAR(3) DEFAULT '001',
    id_centro CHAR(2) DEFAULT '01',
    fecha_tiquet DATE NOT NULL,
    horatiquet TIME NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    descuento DECIMAL(10,2) DEFAULT 0.00,
    iva DECIMAL(10,2) DEFAULT 0.00,
    total DECIMAL(10,2) NOT NULL,
    estado ENUM('EMITIDO', 'ANULADO', 'DEVUELTO') DEFAULT 'EMITIDO',
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (serie, id_tiquet),
    FOREIGN KEY (serie) REFERENCES series_facturacion(serie) ON DELETE RESTRICT,

    INDEX idx_fecha (fecha_tiquet),
    INDEX idx_numero (numero_completo),
    INDEX idx_estado (estado)
);

-- =============================================
-- MÓDULO DE FORMAS DE PAGO
-- =============================================

-- Modos/Formas de pago
CREATE TABLE modo_pago (
    id_modo_pago INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(20) UNIQUE NOT NULL,
    descripcion VARCHAR(100) NOT NULL,
    tipo ENUM('EFECTIVO', 'TARJETA_CREDITO', 'TARJETA_DEBITO', 'TRANSFERENCIA', 'OTRO') DEFAULT 'EFECTIVO',
    requiere_autorizacion CHAR(1) DEFAULT 'N',
    comision DECIMAL(5,2) DEFAULT 0.00,
    activo CHAR(1) DEFAULT 'S',
    configuracion JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activo (activo),
    INDEX idx_tipo (tipo)
);

-- =============================================
-- MÓDULO DE CONTROL DE CAJA
-- =============================================

-- Apertura/Cierre de caja
CREATE TABLE apcajas (
    id_apcajas INT PRIMARY KEY AUTO_INCREMENT,
    id_caja INT NOT NULL,
    id_camarero_apertura INT NOT NULL,
    fecha_apertura DATE NOT NULL,
    hora_apertura TIME NOT NULL,
    saldo_inicial DECIMAL(10,2) DEFAULT 0.00,
    abierta CHAR(1) DEFAULT 'S',
    id_camarero_cierre INT NULL,
    fecha_cierre DATE NULL,
    hora_cierre TIME NULL,
    saldo_teorico DECIMAL(10,2) NULL,
    saldo_real DECIMAL(10,2) NULL,
    diferencia DECIMAL(10,2) NULL,
    observaciones_cierre TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (id_caja) REFERENCES cajas(id_caja) ON DELETE RESTRICT,
    FOREIGN KEY (id_camarero_apertura) REFERENCES camareros(id_camarero) ON DELETE RESTRICT,
    FOREIGN KEY (id_camarero_cierre) REFERENCES camareros(id_camarero) ON DELETE RESTRICT,

    INDEX idx_caja (id_caja),
    INDEX idx_fecha (fecha_apertura),
    INDEX idx_abierta (abierta)
);

-- Pagos y cobros (movimientos de caja)
CREATE TABLE pagoscobros (
    id_pagoscobros INT PRIMARY KEY AUTO_INCREMENT,
    tipo CHAR(1) NOT NULL, -- E=Entrada, S=Salida
    id_venta INT NULL,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    descripcion VARCHAR(200) NOT NULL,
    importe DECIMAL(10,2) NOT NULL,
    id_modo_pago INT NOT NULL,
    id_camarero INT NOT NULL,
    saldo DECIMAL(10,2) DEFAULT 0.00,
    id_tiquet INT NULL,
    serie_fac CHAR(1) NULL,
    id_apcajas INT NOT NULL,
    id_caja INT NOT NULL,
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE SET NULL,
    FOREIGN KEY (id_modo_pago) REFERENCES modo_pago(id_modo_pago) ON DELETE RESTRICT,
    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE RESTRICT,
    FOREIGN KEY (id_apcajas) REFERENCES apcajas(id_apcajas) ON DELETE RESTRICT,
    FOREIGN KEY (id_caja) REFERENCES cajas(id_caja) ON DELETE RESTRICT,

    INDEX idx_fecha (fecha),
    INDEX idx_tipo (tipo),
    INDEX idx_venta (id_venta),
    INDEX idx_caja (id_caja),
    INDEX idx_apertura (id_apcajas)
);

-- =============================================
-- MÓDULO DE IMPRESIÓN
-- =============================================

-- Cola de impresión
CREATE TABLE venta_ticket (
    id_impresion INT PRIMARY KEY AUTO_INCREMENT,
    id_venta INT NOT NULL,
    tipo_impresion ENUM('TICKET_CLIENTE', 'COMANDA_COCINA', 'COMANDA_BAR', 'PRECUENTA') DEFAULT 'TICKET_CLIENTE',
    impresora VARCHAR(100),
    estado ENUM('PENDIENTE', 'PROCESANDO', 'IMPRESO', 'ERROR') DEFAULT 'PENDIENTE',
    intentos INT DEFAULT 0,
    error_mensaje TEXT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_impresion TIMESTAMP NULL,

    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,

    INDEX idx_estado (estado),
    INDEX idx_tipo (tipo_impresion),
    INDEX idx_fecha (fecha_creacion)
);

-- Configuración de impresoras
CREATE TABLE impresoras (
    id_impresora INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    tipo ENUM('TICKET', 'A4', 'ETIQUETA') DEFAULT 'TICKET',
    driver VARCHAR(100),
    puerto VARCHAR(100), -- COM1, USB, IP, etc.
    configuracion JSON,
    activa CHAR(1) DEFAULT 'S',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    INDEX idx_activa (activa)
);

-- =============================================
-- MÓDULO DE CONFIGURACIÓN SISTEMA
-- =============================================

-- Configuraciones generales del sistema
CREATE TABLE configuracion_sistema (
    clave VARCHAR(100) PRIMARY KEY,
    valor TEXT NOT NULL,
    tipo ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON') DEFAULT 'STRING',
    descripcion TEXT,
    categoria VARCHAR(50) DEFAULT 'GENERAL',
    modificable CHAR(1) DEFAULT 'S',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_categoria (categoria)
);

-- =============================================
-- MÓDULO DE AUDITORÍA
-- =============================================

-- Log de actividades del sistema
CREATE TABLE log_actividades (
    id_log INT PRIMARY KEY AUTO_INCREMENT,
    id_camarero INT NULL,
    accion VARCHAR(100) NOT NULL,
    tabla_afectada VARCHAR(50),
    id_registro INT NULL,
    datos_anteriores JSON NULL,
    datos_nuevos JSON NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (id_camarero) REFERENCES camareros(id_camarero) ON DELETE SET NULL,

    INDEX idx_camarero (id_camarero),
    INDEX idx_accion (accion),
    INDEX idx_tabla (tabla_afectada),
    INDEX idx_timestamp (timestamp)
);

-- =============================================
-- DATOS INICIALES DEL SISTEMA
-- =============================================

-- Insertar datos básicos

-- Roles por defecto
INSERT INTO roles (nombre, descripcion, permisos) VALUES
('ADMINISTRADOR', 'Acceso completo al sistema', '["*"]'),
('CAMARERO', 'Camarero/Mesero básico', '["ventas", "mesas", "productos"]'),
('CAJERO', 'Operador de caja', '["ventas", "caja", "reportes"]'),
('COCINERO', 'Personal de cocina', '["cocina", "stock"]');

-- Usuario administrador por defecto
INSERT INTO camareros (nombre, email, password, activo, permisos) VALUES
('Administrador', 'admin@restaurant.com', '$2b$10$rQ3K5Z9Jq8yT2pA1mB3nCO7vX4wE6sF8gH9jK0lM1nP2qR5sT6uV7', 'S', '["*"]');

-- Caja principal por defecto
INSERT INTO cajas (nombre, descripcion, tipo, activa) VALUES
('CAJA_PRINCIPAL', 'Caja Principal - PC Servidor', 'PRINCIPAL', 'S'),
('TERMINAL_GARZON_1', 'Terminal Garzón 1', 'TERMINAL', 'S'),
('IMPRESORA_COCINA', 'Impresora de Cocina', 'COCINA', 'S'),
('IMPRESORA_BAR', 'Impresora de Bar', 'BAR', 'S');

-- Almacén principal
INSERT INTO almacen (nom_almacen, descripcion, activo) VALUES
('PRINCIPAL', 'Almacén Principal del Restaurante', 'S');

-- Serie de facturación por defecto
INSERT INTO series_facturacion (serie, descripcion, activa) VALUES
('F', 'Facturas', 'S'),
('B', 'Boletas', 'S'),
('T', 'Tickets', 'S');

-- Formas de pago básicas
INSERT INTO modo_pago (codigo, descripcion, tipo, activo) VALUES
('EFECTIVO', 'Efectivo', 'EFECTIVO', 'S'),
('TARJETA_CREDITO', 'Tarjeta de Crédito', 'TARJETA_CREDITO', 'S'),
('TARJETA_DEBITO', 'Tarjeta de Débito', 'TARJETA_DEBITO', 'S'),
('TRANSFERENCIA', 'Transferencia Bancaria', 'TRANSFERENCIA', 'S');

-- Configuraciones básicas del sistema
INSERT INTO configuracion_sistema (clave, valor, tipo, descripcion, categoria) VALUES
('APP_NAME', 'DYSA Point POS', 'STRING', 'Nombre de la aplicación', 'GENERAL'),
('APP_VERSION', '2.0.14', 'STRING', 'Versión de la aplicación', 'GENERAL'),
('CURRENCY', 'CLP', 'STRING', 'Moneda por defecto', 'GENERAL'),
('TIMEZONE', 'America/Santiago', 'STRING', 'Zona horaria', 'GENERAL'),
('LANGUAGE', 'es', 'STRING', 'Idioma por defecto', 'GENERAL'),
('IVA_RATE', '19', 'NUMBER', 'Tasa de IVA (%)', 'IMPUESTOS'),
('DECIMAL_PLACES', '2', 'NUMBER', 'Decimales en precios', 'GENERAL'),
('AUTO_PRINT_TICKET', 'true', 'BOOLEAN', 'Imprimir ticket automáticamente', 'IMPRESION'),
('STOCK_CONTROL', 'true', 'BOOLEAN', 'Control de stock activo', 'INVENTARIO'),
('KITCHEN_DISPLAY', 'true', 'BOOLEAN', 'Panel de cocina activo', 'COCINA');

-- =============================================
-- TRIGGERS PARA AUTOMATIZACIÓN
-- =============================================

-- Trigger para actualizar totales de venta
DELIMITER $$
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
    -- Solo cuando se cierra la venta
    IF OLD.cerrada = 'N' AND NEW.cerrada = 'S' THEN
        -- Restar stock de todos los productos de la venta
        UPDATE almacen_complementg ac
        INNER JOIN ventadir_comg vc ON ac.id_complementog = vc.id_complementog
        SET ac.cantidad = ac.cantidad - vc.cantidad
        WHERE vc.id_venta = NEW.id_venta;

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
            CONCAT('Venta #', NEW.id_venta),
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
        FROM apcajas
        WHERE id_apcajas = NEW.id_apcajas;
    END IF;

    -- Calcular nuevo saldo
    IF NEW.tipo = 'E' THEN
        SET NEW.saldo = ultimo_saldo + NEW.importe;
    ELSE
        SET NEW.saldo = ultimo_saldo - NEW.importe;
    END IF;
END$$

DELIMITER ;

-- =============================================
-- VISTAS ÚTILES PARA REPORTES
-- =============================================

-- Vista de ventas con detalles
CREATE VIEW v_ventas_detalle AS
SELECT
    v.id_venta,
    v.fecha_venta,
    v.hora,
    v.Num_Mesa,
    m.descripcion AS mesa_descripcion,
    v.comensales,
    v.alias,
    v.total,
    v.cerrada,
    c.nombre AS camarero,
    s.nombre AS salon
FROM ventadirecta v
LEFT JOIN mesa m ON v.Num_Mesa = m.Num_Mesa
LEFT JOIN salon s ON m.id_salon = s.id_salon
LEFT JOIN camareros c ON v.id_camarero = c.id_camarero;

-- Vista de productos más vendidos
CREATE VIEW v_productos_vendidos AS
SELECT
    vc.id_complementog,
    vc.complementog,
    SUM(vc.cantidad) AS total_vendido,
    SUM(vc.total) AS total_ingresos,
    COUNT(DISTINCT vc.id_venta) AS ventas_distintas,
    AVG(vc.precio) AS precio_promedio
FROM ventadir_comg vc
INNER JOIN ventadirecta v ON vc.id_venta = v.id_venta
WHERE v.cerrada = 'S'
GROUP BY vc.id_complementog, vc.complementog;

-- Vista de stock bajo
CREATE VIEW v_stock_bajo AS
SELECT
    c.alias,
    c.descripcion,
    ac.cantidad,
    ac.stock_minimo,
    a.nom_almacen,
    (ac.stock_minimo - ac.cantidad) AS deficit
FROM almacen_complementg ac
INNER JOIN complementog c ON ac.id_complementog = c.id_complementog
INNER JOIN almacen a ON ac.id_almacen = a.id_almacen
WHERE ac.cantidad <= ac.stock_minimo
AND c.activo = 'S'
AND a.activo = 'S';

-- =============================================
-- ÍNDICES ADICIONALES PARA RENDIMIENTO
-- =============================================

-- Índices compuestos para consultas frecuentes
CREATE INDEX idx_ventadirecta_fecha_cerrada ON ventadirecta(fecha_venta, cerrada);
CREATE INDEX idx_ventadir_comg_cocina_estado ON ventadir_comg(estado_cocina, cocina, servido_cocina);
CREATE INDEX idx_pagoscobros_fecha_tipo ON pagoscobros(fecha, tipo);
CREATE INDEX idx_log_timestamp_accion ON log_actividades(timestamp, accion);

-- =============================================
-- PROCEDIMIENTOS ALMACENADOS ÚTILES
-- =============================================

DELIMITER $$

-- Procedimiento para cerrar venta
CREATE PROCEDURE sp_cerrar_venta(
    IN p_id_venta INT,
    IN p_id_modo_pago INT,
    IN p_id_camarero INT,
    OUT p_id_tiquet INT,
    OUT p_serie CHAR(1)
)
BEGIN
    DECLARE v_total DECIMAL(10,2);
    DECLARE v_id_apcajas INT;
    DECLARE v_id_caja INT;
    DECLARE v_siguiente_tiquet INT;

    -- Obtener total de la venta
    SELECT total INTO v_total FROM ventadirecta WHERE id_venta = p_id_venta;

    -- Obtener caja abierta
    SELECT id_apcajas, id_caja INTO v_id_apcajas, v_id_caja
    FROM apcajas
    WHERE abierta = 'S'
    ORDER BY id_apcajas DESC
    LIMIT 1;

    -- Obtener siguiente número de ticket
    SET p_serie = 'T';
    SELECT siguiente_numero INTO v_siguiente_tiquet
    FROM series_facturacion
    WHERE serie = p_serie;

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
    SET cerrada = 'S', serie = p_serie, id_tiquet = p_id_tiquet
    WHERE id_venta = p_id_venta;

    -- Registrar pago
    INSERT INTO pagoscobros (
        tipo, id_venta, fecha, hora, descripcion, importe,
        id_modo_pago, id_camarero, id_tiquet, serie_fac,
        id_apcajas, id_caja
    ) VALUES (
        'E', p_id_venta, CURDATE(), CURTIME(),
        CONCAT('Ticket ', p_serie, p_id_tiquet), v_total,
        p_id_modo_pago, p_id_camarero, p_id_tiquet, p_serie,
        v_id_apcajas, v_id_caja
    );

    -- Enviar a cola de impresión
    INSERT INTO venta_ticket (id_venta, tipo_impresion)
    VALUES (p_id_venta, 'TICKET_CLIENTE');

END$$

DELIMITER ;

-- =============================================
-- FINALIZACIÓN
-- =============================================

-- Crear usuario de aplicación
CREATE USER IF NOT EXISTS 'dysa_app'@'localhost' IDENTIFIED BY 'dysa2025!secure';
GRANT ALL PRIVILEGES ON dysa_point.* TO 'dysa_app'@'localhost';
FLUSH PRIVILEGES;

-- Mensaje de finalización
SELECT 'Base de datos DYSA Point creada exitosamente' AS mensaje;