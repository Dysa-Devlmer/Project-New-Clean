-- 🗄️ DYSA Point v2.0.14 - Esquema de Producción Corregido
-- Schema SQL optimizado para restaurantes reales
-- Creado: 14 de Octubre, 2025 - 00:08 (Santiago)

-- ========================
-- ELIMINAR TABLAS EXISTENTES (SOLO SI ES NECESARIO)
-- ========================
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS ventadir_comg;
DROP TABLE IF EXISTS ventadirecta;
DROP TABLE IF EXISTS mesa;
DROP TABLE IF EXISTS complementog;
DROP TABLE IF EXISTS opciones_producto;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS mesas;
DROP TABLE IF EXISTS ventas;
DROP TABLE IF EXISTS zonas;
DROP TABLE IF EXISTS log_actividades;
DROP TABLE IF EXISTS monitoring_alerts;
DROP TABLE IF EXISTS monitoring_metrics;

SET FOREIGN_KEY_CHECKS = 1;

-- ========================
-- TABLAS PRINCIPALES PARA PRODUCCIÓN
-- ========================

-- Tabla de roles de usuario
CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    nivel INT DEFAULT 1,
    permisos JSON,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tabla de usuarios del sistema
CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    codigo_privado VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role_id INT NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    ultimo_acceso TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Tabla de zonas del restaurante
CREATE TABLE zonas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#3498db',
    orden INT DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de mesas (nombre correcto)
CREATE TABLE mesas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(255),
    capacidad INT DEFAULT 4,
    zona_id INT,
    posicion_x INT DEFAULT 0,
    posicion_y INT DEFAULT 0,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (zona_id) REFERENCES zonas(id)
);

-- Tabla de mesa (legacy - para compatibilidad)
CREATE TABLE mesa (
    Num_Mesa INT PRIMARY KEY,
    descripcion VARCHAR(255),
    capacidad INT DEFAULT 4,
    zona VARCHAR(100),
    activa BOOLEAN DEFAULT TRUE,
    estado ENUM('disponible', 'ocupada', 'reservada', 'limpieza') DEFAULT 'disponible',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de categorías de productos
CREATE TABLE categorias (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    color VARCHAR(7) DEFAULT '#3498db',
    orden INT DEFAULT 1,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de productos/complementos
CREATE TABLE complementog (
    id_complementog INT AUTO_INCREMENT PRIMARY KEY,
    alias VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio DECIMAL(10,2) DEFAULT 0.00,
    categoria_id INT,
    codigo_barras VARCHAR(50),
    stock_actual INT DEFAULT 0,
    stock_minimo INT DEFAULT 5,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_alias (alias),
    INDEX idx_activo (activo),
    FOREIGN KEY (categoria_id) REFERENCES categorias(id)
);

-- Tabla de opciones de productos
CREATE TABLE opciones_producto (
    id_opcion INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_adicional DECIMAL(10,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de relación productos-opciones
CREATE TABLE producto_opciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_complementog INT NOT NULL,
    id_opcion INT NOT NULL,
    precio_override DECIMAL(10,2) NULL,
    activo BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog),
    FOREIGN KEY (id_opcion) REFERENCES opciones_producto(id_opcion),
    UNIQUE KEY unique_producto_opcion (id_complementog, id_opcion)
);

-- Tabla de ventas directas (principal)
CREATE TABLE ventadirecta (
    id_venta INT AUTO_INCREMENT PRIMARY KEY,
    Num_Mesa INT NOT NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total DECIMAL(10,2) DEFAULT 0.00,
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    descuento DECIMAL(10,2) DEFAULT 0.00,
    impuestos DECIMAL(10,2) DEFAULT 0.00,
    propina DECIMAL(10,2) DEFAULT 0.00,
    cerrada ENUM('Y', 'N') DEFAULT 'N',
    usuario_id INT,
    observaciones TEXT,
    forma_pago ENUM('efectivo', 'tarjeta', 'transferencia', 'mixed') DEFAULT 'efectivo',
    fecha_cierre TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_mesa (Num_Mesa),
    INDEX idx_fecha (fecha_venta),
    INDEX idx_cerrada (cerrada),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (Num_Mesa) REFERENCES mesa(Num_Mesa)
);

-- Tabla de líneas de venta (productos en cada venta)
CREATE TABLE ventadir_comg (
    id_linea INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_complementog INT NOT NULL,
    cantidad INT NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(10,2) NOT NULL,
    precio_total DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
    descuento_linea DECIMAL(10,2) DEFAULT 0.00,
    observaciones TEXT,
    estado_cocina ENUM('pendiente', 'preparando', 'listo', 'entregado') DEFAULT 'pendiente',
    hora_pedido TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    hora_cocina TIMESTAMP NULL,
    hora_entrega TIMESTAMP NULL,
    usuario_id INT,
    INDEX idx_venta (id_venta),
    INDEX idx_producto (id_complementog),
    INDEX idx_estado (estado_cocina),
    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta) ON DELETE CASCADE,
    FOREIGN KEY (id_complementog) REFERENCES complementog(id_complementog),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla de ventas (nueva estructura)
CREATE TABLE ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mesa_id INT NOT NULL,
    usuario_id INT NOT NULL,
    total DECIMAL(10,2) DEFAULT 0.00,
    subtotal DECIMAL(10,2) DEFAULT 0.00,
    descuento DECIMAL(10,2) DEFAULT 0.00,
    impuestos DECIMAL(10,2) DEFAULT 0.00,
    estado ENUM('abierta', 'pagada', 'cerrada', 'cancelada') DEFAULT 'abierta',
    fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre TIMESTAMP NULL,
    observaciones TEXT,
    FOREIGN KEY (mesa_id) REFERENCES mesas(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla de formas de pago
CREATE TABLE formas_pago (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion TEXT,
    acepta_cambio BOOLEAN DEFAULT TRUE,
    requiere_referencia BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de pagos de ventas
CREATE TABLE venta_pagos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    forma_pago_id INT NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    referencia VARCHAR(100),
    fecha_pago TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT,
    FOREIGN KEY (id_venta) REFERENCES ventadirecta(id_venta),
    FOREIGN KEY (forma_pago_id) REFERENCES formas_pago(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla de logs de actividades
CREATE TABLE log_actividades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT,
    accion VARCHAR(100) NOT NULL,
    descripcion TEXT,
    tabla_afectada VARCHAR(50),
    registro_id INT,
    datos_anteriores JSON,
    datos_nuevos JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_usuario (usuario_id),
    INDEX idx_accion (accion),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

-- Tabla de monitoreo de métricas
CREATE TABLE monitoring_metrics (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    restaurant_id VARCHAR(50),
    metric_type ENUM('health', 'performance', 'error', 'warning', 'backup'),
    metric_name VARCHAR(100),
    metric_value DECIMAL(10,2),
    details TEXT,
    severity ENUM('info', 'warning', 'critical', 'emergency'),
    INDEX idx_timestamp (timestamp),
    INDEX idx_restaurant (restaurant_id),
    INDEX idx_severity (severity)
);

-- Tabla de alertas de monitoreo
CREATE TABLE monitoring_alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    restaurant_id VARCHAR(50),
    alert_type VARCHAR(50),
    message TEXT,
    severity ENUM('low', 'medium', 'high', 'critical'),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at DATETIME NULL,
    INDEX idx_timestamp (timestamp),
    INDEX idx_resolved (resolved)
);

-- ========================
-- DATOS INICIALES PARA PRODUCCIÓN
-- ========================

-- Insertar roles básicos
INSERT INTO roles (codigo, nombre, descripcion, nivel, permisos) VALUES
('ADMIN', 'Administrador', 'Acceso completo al sistema', 5, '["*"]'),
('GERENTE', 'Gerente', 'Gestión de personal y reportes', 4, '["ventas", "reportes", "usuarios", "configuracion"]'),
('CAJERO', 'Cajero', 'Manejo de caja y ventas', 3, '["ventas", "caja", "reportes_basicos"]'),
('JEFE_GARZON', 'Jefe de Garzón', 'Supervisión de servicio', 3, '["ventas", "mesas", "cocina", "reportes_basicos"]'),
('GARZON', 'Garzón', 'Atención de mesas', 2, '["ventas", "mesas", "cocina"]'),
('COCINA', 'Cocina', 'Gestión de pedidos de cocina', 2, '["cocina", "inventario_basico"]');

-- Insertar usuario administrador por defecto
INSERT INTO usuarios (nombre, apellido, email, codigo_privado, role_id) VALUES
('Admin', 'Sistema', 'admin@dysa.cl', 'ADMIN001', 1),
('Gerente', 'Principal', 'gerente@dysa.cl', 'GER001', 2),
('Cajero', 'Principal', 'cajero@dysa.cl', 'CAJ001', 3);

-- Insertar zona por defecto
INSERT INTO zonas (nombre, descripcion, color, orden) VALUES
('Salón Principal', 'Zona principal del restaurante', '#3498db', 1),
('Terraza', 'Mesas en terraza', '#2ecc71', 2),
('VIP', 'Zona VIP reservada', '#e74c3c', 3);

-- Insertar mesas básicas (estructura nueva)
INSERT INTO mesas (nombre, descripcion, capacidad, zona_id) VALUES
('Mesa 1', 'Mesa para 4 personas', 4, 1),
('Mesa 2', 'Mesa para 4 personas', 4, 1),
('Mesa 3', 'Mesa para 6 personas', 6, 1),
('Mesa 4', 'Mesa para 2 personas', 2, 1),
('Mesa 5', 'Mesa para 4 personas', 4, 1),
('Mesa 6', 'Mesa terraza 4p', 4, 2),
('Mesa 7', 'Mesa terraza 6p', 6, 2),
('Mesa 8', 'Mesa VIP 8p', 8, 3);

-- Insertar mesas legacy (para compatibilidad)
INSERT INTO mesa (Num_Mesa, descripcion, capacidad, zona, activa) VALUES
(1, 'Mesa 1 - Salón Principal', 4, 'Salón Principal', TRUE),
(2, 'Mesa 2 - Salón Principal', 4, 'Salón Principal', TRUE),
(3, 'Mesa 3 - Salón Principal', 6, 'Salón Principal', TRUE),
(4, 'Mesa 4 - Salón Principal', 2, 'Salón Principal', TRUE),
(5, 'Mesa 5 - Salón Principal', 4, 'Salón Principal', TRUE),
(6, 'Mesa 6 - Terraza', 4, 'Terraza', TRUE),
(7, 'Mesa 7 - Terraza', 6, 'Terraza', TRUE),
(8, 'Mesa 8 - VIP', 8, 'VIP', TRUE);

-- Insertar categorías de productos
INSERT INTO categorias (nombre, descripcion, color, orden) VALUES
('Bebidas', 'Bebidas frías y calientes', '#3498db', 1),
('Entradas', 'Platos de entrada', '#2ecc71', 2),
('Platos Principales', 'Platos principales del menú', '#e74c3c', 3),
('Postres', 'Postres y dulces', '#f39c12', 4),
('Acompañamientos', 'Guarniciones y adicionales', '#9b59b6', 5);

-- Insertar productos básicos
INSERT INTO complementog (alias, descripcion, precio, categoria_id, activo) VALUES
('Coca Cola', 'Bebida gaseosa 350ml', 2500.00, 1, TRUE),
('Agua Mineral', 'Agua mineral sin gas 500ml', 1500.00, 1, TRUE),
('Café Americano', 'Café americano tamaño regular', 1800.00, 1, TRUE),
('Empanada de Pino', 'Empanada tradicional de pino', 3200.00, 2, TRUE),
('Sopa del Día', 'Sopa especial del chef', 4500.00, 2, TRUE),
('Lomo a lo Pobre', 'Lomo con papas fritas y huevo', 12500.00, 3, TRUE),
('Pollo Grillado', 'Pollo grillado con ensalada', 9800.00, 3, TRUE),
('Helado Artesanal', 'Helado artesanal tres sabores', 3500.00, 4, TRUE),
('Papas Fritas', 'Porción de papas fritas', 2800.00, 5, TRUE),
('Ensalada Verde', 'Ensalada fresca mixta', 3200.00, 5, TRUE);

-- Insertar opciones de productos
INSERT INTO opciones_producto (nombre, descripcion, precio_adicional) VALUES
('Sin Azúcar', 'Preparación sin azúcar', 0.00),
('Extra Grande', 'Porción extra grande', 1500.00),
('Sin Cebolla', 'Preparación sin cebolla', 0.00),
('Punto Medio', 'Carne término medio', 0.00),
('Extra Queso', 'Porción adicional de queso', 800.00),
('Picante', 'Preparación picante', 0.00);

-- Insertar formas de pago
INSERT INTO formas_pago (nombre, descripcion, acepta_cambio, requiere_referencia) VALUES
('Efectivo', 'Pago en efectivo', TRUE, FALSE),
('Tarjeta de Débito', 'Pago con tarjeta de débito', FALSE, TRUE),
('Tarjeta de Crédito', 'Pago con tarjeta de crédito', FALSE, TRUE),
('Transferencia', 'Transferencia bancaria', FALSE, TRUE),
('Cheque', 'Pago con cheque', FALSE, TRUE);

-- ========================
-- TRIGGERS DE PRODUCCIÓN SIMPLIFICADOS
-- ========================

-- Trigger para actualizar total de venta al insertar línea
DELIMITER $$
CREATE TRIGGER tr_actualizar_total_venta
AFTER INSERT ON ventadir_comg
FOR EACH ROW
BEGIN
    UPDATE ventadirecta
    SET total = (
        SELECT COALESCE(SUM(precio_total), 0)
        FROM ventadir_comg
        WHERE id_venta = NEW.id_venta
    )
    WHERE id_venta = NEW.id_venta;
END$$

-- Trigger para actualizar total al modificar línea
CREATE TRIGGER tr_actualizar_total_venta_update
AFTER UPDATE ON ventadir_comg
FOR EACH ROW
BEGIN
    UPDATE ventadirecta
    SET total = (
        SELECT COALESCE(SUM(precio_total), 0)
        FROM ventadir_comg
        WHERE id_venta = NEW.id_venta
    )
    WHERE id_venta = NEW.id_venta;
END$$

-- Trigger para actualizar total al eliminar línea
CREATE TRIGGER tr_actualizar_total_venta_delete
AFTER DELETE ON ventadir_comg
FOR EACH ROW
BEGIN
    UPDATE ventadirecta
    SET total = (
        SELECT COALESCE(SUM(precio_total), 0)
        FROM ventadir_comg
        WHERE id_venta = OLD.id_venta
    )
    WHERE id_venta = OLD.id_venta;
END$$

DELIMITER ;

-- ========================
-- PROCEDIMIENTOS ALMACENADOS SIMPLIFICADOS
-- ========================

DELIMITER $$

-- Procedimiento para cerrar venta completa
CREATE PROCEDURE sp_cerrar_venta_simple(
    IN p_id_venta INT,
    OUT p_resultado VARCHAR(500)
)
BEGIN
    DECLARE v_total DECIMAL(10,2);
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_resultado = 'ERROR: No se pudo cerrar la venta';
    END;

    START TRANSACTION;

    -- Verificar venta existe y obtener total
    SELECT total INTO v_total
    FROM ventadirecta
    WHERE id_venta = p_id_venta AND cerrada = 'N';

    IF v_total IS NULL THEN
        SET p_resultado = 'ERROR: Venta no encontrada o ya cerrada';
        ROLLBACK;
    ELSE
        -- Marcar venta como cerrada
        UPDATE ventadirecta
        SET cerrada = 'Y', fecha_cierre = NOW()
        WHERE id_venta = p_id_venta;

        SET p_resultado = CONCAT('ÉXITO: Venta cerrada correctamente. Total: $', v_total);
        COMMIT;
    END IF;
END$$

DELIMITER ;

-- ========================
-- ÍNDICES PARA OPTIMIZACIÓN
-- ========================

-- Índices adicionales para mejor rendimiento
CREATE INDEX idx_ventadirecta_fecha_mesa ON ventadirecta(fecha_venta, Num_Mesa);
CREATE INDEX idx_ventadir_comg_estado_hora ON ventadir_comg(estado_cocina, hora_pedido);
CREATE INDEX idx_complementog_precio_activo ON complementog(precio, activo);
CREATE INDEX idx_usuarios_activo_role ON usuarios(activo, role_id);

-- ========================
-- CONFIGURACIÓN FINAL
-- ========================

-- Configurar charset para caracteres especiales
ALTER DATABASE dysa_point CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Configurar timezone
SET time_zone = 'America/Santiago';

-- Mensaje de finalización
SELECT 'Schema de producción DYSA Point v2.0.14 instalado correctamente' as mensaje;