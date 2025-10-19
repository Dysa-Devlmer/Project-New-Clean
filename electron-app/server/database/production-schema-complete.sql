-- 🗄️ DYSA Point v2.0.14 - Esquema Completo de Producción
-- Base de datos empresarial para restaurantes reales
-- Creado: 14 de Octubre, 2025 - 00:12 (Santiago)
-- ================================================================

-- Configuración de sistema
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- ================================================================
-- ESTRUCTURA DE TABLAS PRINCIPALES
-- ================================================================

-- Tabla de mesas (corregida)
CREATE TABLE IF NOT EXISTS `mesa` (
  `Num_Mesa` int NOT NULL PRIMARY KEY,
  `descripcion` varchar(100) DEFAULT NULL,
  `capacidad` int DEFAULT 4,
  `zona` varchar(50) DEFAULT 'PRINCIPAL',
  `estado` enum('LIBRE','OCUPADA','RESERVADA','BLOQUEADA') DEFAULT 'LIBRE',
  `activa` tinyint(1) DEFAULT 1,
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de ventas directas (corregida)
CREATE TABLE IF NOT EXISTS `ventadirecta` (
  `id_venta` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `Num_Mesa` int DEFAULT NULL,
  `fecha_venta` datetime DEFAULT CURRENT_TIMESTAMP,
  `total` decimal(10,2) DEFAULT 0.00,
  `descuento` decimal(10,2) DEFAULT 0.00,
  `impuestos` decimal(10,2) DEFAULT 0.00,
  `total_final` decimal(10,2) DEFAULT 0.00,
  `cerrada` char(1) DEFAULT 'N',
  `metodo_pago` varchar(50) DEFAULT NULL,
  `id_usuario` int DEFAULT NULL,
  `observaciones` text,
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_mesa` (`Num_Mesa`),
  KEY `idx_fecha` (`fecha_venta`),
  KEY `idx_cerrada` (`cerrada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de líneas de venta (corregida)
CREATE TABLE IF NOT EXISTS `ventadir_comg` (
  `id_linea` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `id_venta` int NOT NULL,
  `id_complementog` int NOT NULL,
  `cantidad` decimal(8,3) DEFAULT 1.000,
  `precio_unitario` decimal(10,2) DEFAULT 0.00,
  `precio_total` decimal(10,2) DEFAULT 0.00,
  `descuento` decimal(10,2) DEFAULT 0.00,
  `observaciones` text,
  `estado` enum('PENDIENTE','PREPARANDO','LISTO','SERVIDO','CANCELADO') DEFAULT 'PENDIENTE',
  `hora_pedido` timestamp DEFAULT CURRENT_TIMESTAMP,
  `hora_cocina` timestamp NULL DEFAULT NULL,
  `hora_servido` timestamp NULL DEFAULT NULL,
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_venta` (`id_venta`),
  KEY `idx_complementog` (`id_complementog`),
  KEY `idx_estado` (`estado`),
  FOREIGN KEY (`id_venta`) REFERENCES `ventadirecta` (`id_venta`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de productos/complementos principales
CREATE TABLE IF NOT EXISTS `complementog` (
  `id_complementog` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `codigo` varchar(20) DEFAULT NULL,
  `alias` varchar(100) NOT NULL,
  `nombre_completo` varchar(200) DEFAULT NULL,
  `descripcion` text,
  `categoria` varchar(50) DEFAULT 'GENERAL',
  `precio` decimal(10,2) DEFAULT 0.00,
  `costo` decimal(10,2) DEFAULT 0.00,
  `disponible` tinyint(1) DEFAULT 1,
  `activo` tinyint(1) DEFAULT 1,
  `tipo` enum('PLATO','BEBIDA','POSTRE','ENTRADA','COMPLEMENTO') DEFAULT 'PLATO',
  `tiempo_preparacion` int DEFAULT 0,
  `imagen_url` varchar(255) DEFAULT NULL,
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_codigo` (`codigo`),
  KEY `idx_categoria` (`categoria`),
  KEY `idx_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de opciones de productos
CREATE TABLE IF NOT EXISTS `opciones_producto` (
  `id_opcion` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(200) DEFAULT NULL,
  `precio_adicional` decimal(10,2) DEFAULT 0.00,
  `activo` tinyint(1) DEFAULT 1,
  `tipo` enum('TAMAÑO','ADICIONAL','MODIFICACION') DEFAULT 'ADICIONAL',
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de relación productos-opciones
CREATE TABLE IF NOT EXISTS `producto_opciones` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `id_complementog` int NOT NULL,
  `id_opcion` int NOT NULL,
  `obligatorio` tinyint(1) DEFAULT 0,
  `multiple` tinyint(1) DEFAULT 1,
  KEY `idx_complementog` (`id_complementog`),
  KEY `idx_opcion` (`id_opcion`),
  FOREIGN KEY (`id_complementog`) REFERENCES `complementog` (`id_complementog`) ON DELETE CASCADE,
  FOREIGN KEY (`id_opcion`) REFERENCES `opciones_producto` (`id_opcion`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de cocina (órdenes de preparación)
CREATE TABLE IF NOT EXISTS `venta_cocina` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `id_venta` int NOT NULL,
  `id_linea` int NOT NULL,
  `mesa` int DEFAULT NULL,
  `producto` varchar(200) NOT NULL,
  `cantidad` decimal(8,3) DEFAULT 1.000,
  `observaciones` text,
  `estado` enum('PENDIENTE','PREPARANDO','LISTO','SERVIDO','CANCELADO') DEFAULT 'PENDIENTE',
  `prioridad` enum('NORMAL','ALTA','URGENTE') DEFAULT 'NORMAL',
  `tiempo_estimado` int DEFAULT 0,
  `hora_pedido` timestamp DEFAULT CURRENT_TIMESTAMP,
  `hora_inicio` timestamp NULL DEFAULT NULL,
  `hora_listo` timestamp NULL DEFAULT NULL,
  `cocinero` varchar(100) DEFAULT NULL,
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_venta` (`id_venta`),
  KEY `idx_estado` (`estado`),
  KEY `idx_mesa` (`mesa`),
  FOREIGN KEY (`id_venta`) REFERENCES `ventadirecta` (`id_venta`) ON DELETE CASCADE,
  FOREIGN KEY (`id_linea`) REFERENCES `ventadir_comg` (`id_linea`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS `usuarios` (
  `id_usuario` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `username` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `nombre_completo` varchar(100) NOT NULL,
  `email` varchar(100) DEFAULT NULL,
  `rol` enum('ADMIN','CAJERO','GARZON','COCINERO','SUPERVISOR') DEFAULT 'CAJERO',
  `activo` tinyint(1) DEFAULT 1,
  `ultimo_login` timestamp NULL DEFAULT NULL,
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_username` (`username`),
  UNIQUE KEY `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS `clientes` (
  `id_cliente` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `rut` varchar(12) DEFAULT NULL,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) DEFAULT NULL,
  `telefono` varchar(20) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `direccion` text,
  `fecha_nacimiento` date DEFAULT NULL,
  `activo` tinyint(1) DEFAULT 1,
  `total_compras` decimal(12,2) DEFAULT 0.00,
  `visitas` int DEFAULT 0,
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP,
  `fecha_modificacion` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uk_rut` (`rut`),
  KEY `idx_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================================
-- DATOS INICIALES PARA PRODUCCIÓN
-- ================================================================

-- Insertar mesas por defecto
INSERT IGNORE INTO `mesa` (`Num_Mesa`, `descripcion`, `capacidad`, `zona`) VALUES
(1, 'Mesa 1 - Ventana', 4, 'TERRAZA'),
(2, 'Mesa 2 - Terraza', 6, 'TERRAZA'),
(3, 'Mesa 3 - Interior', 4, 'PRINCIPAL'),
(4, 'Mesa 4 - Interior', 4, 'PRINCIPAL'),
(5, 'Mesa 5 - Privada', 8, 'VIP'),
(6, 'Mesa 6 - Barra', 2, 'BARRA'),
(7, 'Mesa 7 - Barra', 2, 'BARRA'),
(8, 'Mesa 8 - Grupo', 10, 'EVENTOS');

-- Insertar productos base
INSERT IGNORE INTO `complementog` (`id_complementog`, `codigo`, `alias`, `nombre_completo`, `categoria`, `precio`, `tipo`) VALUES
(1, 'CAFE001', 'Café Americano', 'Café Americano Regular', 'BEBIDAS', 2500.00, 'BEBIDA'),
(2, 'CAFE002', 'Café con Leche', 'Café con Leche Premium', 'BEBIDAS', 3000.00, 'BEBIDA'),
(3, 'SAND001', 'Sándwich Completo', 'Sándwich Completo Italiano', 'PLATOS', 4500.00, 'PLATO'),
(4, 'EMPA001', 'Empanada de Pino', 'Empanada de Pino Tradicional', 'ENTRADAS', 2200.00, 'ENTRADA'),
(5, 'JUGU001', 'Jugo Natural', 'Jugo Natural de Frutas', 'BEBIDAS', 2800.00, 'BEBIDA');

-- Usuario administrador por defecto
INSERT IGNORE INTO `usuarios` (`username`, `password_hash`, `nombre_completo`, `email`, `rol`) VALUES
('admin', SHA2('admin123', 256), 'Administrador del Sistema', 'admin@dysa.cl', 'ADMIN'),
('cajero', SHA2('cajero123', 256), 'Cajero Principal', 'cajero@dysa.cl', 'CAJERO'),
('garzon', SHA2('garzon123', 256), 'Garzón Principal', 'garzon@dysa.cl', 'GARZON');

-- ================================================================
-- ÍNDICES DE RENDIMIENTO
-- ================================================================

-- Índices adicionales para optimización
CREATE INDEX IF NOT EXISTS `idx_venta_fecha_total` ON `ventadirecta` (`fecha_venta`, `total_final`);
CREATE INDEX IF NOT EXISTS `idx_linea_estado_fecha` ON `ventadir_comg` (`estado`, `fecha_creacion`);
CREATE INDEX IF NOT EXISTS `idx_cocina_estado_mesa` ON `venta_cocina` (`estado`, `mesa`, `hora_pedido`);

-- ================================================================
-- TRIGGERS PARA AUTOMATIZACIÓN
-- ================================================================

DELIMITER $$

-- Trigger para calcular total de línea
CREATE TRIGGER IF NOT EXISTS `tr_ventadir_comg_total`
BEFORE INSERT ON `ventadir_comg`
FOR EACH ROW
BEGIN
    SET NEW.precio_total = NEW.cantidad * NEW.precio_unitario - NEW.descuento;
END$$

-- Trigger para actualizar total de venta
CREATE TRIGGER IF NOT EXISTS `tr_ventadir_comg_update_total`
AFTER INSERT ON `ventadir_comg`
FOR EACH ROW
BEGIN
    UPDATE `ventadirecta` SET
        `total` = (SELECT COALESCE(SUM(precio_total), 0) FROM `ventadir_comg` WHERE id_venta = NEW.id_venta),
        `total_final` = (SELECT COALESCE(SUM(precio_total), 0) FROM `ventadir_comg` WHERE id_venta = NEW.id_venta)
    WHERE `id_venta` = NEW.id_venta;
END$$

-- Trigger para crear orden en cocina
CREATE TRIGGER IF NOT EXISTS `tr_crear_orden_cocina`
AFTER INSERT ON `ventadir_comg`
FOR EACH ROW
BEGIN
    DECLARE v_mesa INT;
    DECLARE v_producto VARCHAR(200);

    SELECT v.Num_Mesa, c.alias INTO v_mesa, v_producto
    FROM ventadirecta v
    INNER JOIN complementog c ON c.id_complementog = NEW.id_complementog
    WHERE v.id_venta = NEW.id_venta;

    INSERT INTO `venta_cocina`
    (id_venta, id_linea, mesa, producto, cantidad, observaciones, estado, tiempo_estimado)
    VALUES
    (NEW.id_venta, NEW.id_linea, v_mesa, v_producto, NEW.cantidad, NEW.observaciones, 'PENDIENTE', 15);
END$$

DELIMITER ;

-- ================================================================
-- CONFIGURACIÓN FINAL
-- ================================================================

SET FOREIGN_KEY_CHECKS = 1;

-- Mensaje de confirmación
SELECT
    'DYSA Point v2.0.14 - Esquema de Producción Instalado' as mensaje,
    NOW() as fecha_instalacion,
    COUNT(*) as tablas_creadas
FROM information_schema.tables
WHERE table_schema = DATABASE();