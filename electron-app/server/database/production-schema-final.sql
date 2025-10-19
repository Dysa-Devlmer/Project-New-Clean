-- 🗄️ DYSA Point v2.0.14 - Esquema Final de Producción
-- Base de datos empresarial para restaurantes reales
-- Versión corregida - MySQL 8.0 Compatible
-- Creado: 14 de Octubre, 2025 - 00:15 (Santiago)
-- ================================================================

-- Configuración inicial
SET FOREIGN_KEY_CHECKS = 0;
SET sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO';

-- Limpiar base de datos existente
DROP TABLE IF EXISTS `venta_cocina`;
DROP TABLE IF EXISTS `producto_opciones`;
DROP TABLE IF EXISTS `opciones_producto`;
DROP TABLE IF EXISTS `ventadir_comg`;
DROP TABLE IF EXISTS `ventadirecta`;
DROP TABLE IF EXISTS `complementog`;
DROP TABLE IF EXISTS `mesa`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `clientes`;

-- ================================================================
-- CREACIÓN DE TABLAS PRINCIPALES
-- ================================================================

-- Tabla de mesas (corregida)
CREATE TABLE `mesa` (
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
CREATE TABLE `ventadirecta` (
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
  INDEX `idx_mesa` (`Num_Mesa`),
  INDEX `idx_fecha` (`fecha_venta`),
  INDEX `idx_cerrada` (`cerrada`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de productos/complementos principales
CREATE TABLE `complementog` (
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
  UNIQUE INDEX `uk_codigo` (`codigo`),
  INDEX `idx_categoria` (`categoria`),
  INDEX `idx_activo` (`activo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de líneas de venta (corregida)
CREATE TABLE `ventadir_comg` (
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
  INDEX `idx_venta` (`id_venta`),
  INDEX `idx_complementog` (`id_complementog`),
  INDEX `idx_estado` (`estado`),
  FOREIGN KEY (`id_venta`) REFERENCES `ventadirecta` (`id_venta`) ON DELETE CASCADE,
  FOREIGN KEY (`id_complementog`) REFERENCES `complementog` (`id_complementog`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de opciones de productos
CREATE TABLE `opciones_producto` (
  `id_opcion` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `nombre` varchar(100) NOT NULL,
  `descripcion` varchar(200) DEFAULT NULL,
  `precio_adicional` decimal(10,2) DEFAULT 0.00,
  `activo` tinyint(1) DEFAULT 1,
  `tipo` enum('TAMAÑO','ADICIONAL','MODIFICACION') DEFAULT 'ADICIONAL',
  `fecha_creacion` timestamp DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de relación productos-opciones
CREATE TABLE `producto_opciones` (
  `id` int NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `id_complementog` int NOT NULL,
  `id_opcion` int NOT NULL,
  `obligatorio` tinyint(1) DEFAULT 0,
  `multiple` tinyint(1) DEFAULT 1,
  INDEX `idx_complementog` (`id_complementog`),
  INDEX `idx_opcion` (`id_opcion`),
  FOREIGN KEY (`id_complementog`) REFERENCES `complementog` (`id_complementog`) ON DELETE CASCADE,
  FOREIGN KEY (`id_opcion`) REFERENCES `opciones_producto` (`id_opcion`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de cocina (órdenes de preparación)
CREATE TABLE `venta_cocina` (
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
  INDEX `idx_venta` (`id_venta`),
  INDEX `idx_estado` (`estado`),
  INDEX `idx_mesa` (`mesa`),
  FOREIGN KEY (`id_venta`) REFERENCES `ventadirecta` (`id_venta`) ON DELETE CASCADE,
  FOREIGN KEY (`id_linea`) REFERENCES `ventadir_comg` (`id_linea`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de usuarios del sistema
CREATE TABLE `usuarios` (
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
  UNIQUE INDEX `uk_username` (`username`),
  UNIQUE INDEX `uk_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Tabla de clientes
CREATE TABLE `clientes` (
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
  UNIQUE INDEX `uk_rut` (`rut`),
  INDEX `idx_telefono` (`telefono`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ================================================================
-- DATOS INICIALES PARA PRODUCCIÓN
-- ================================================================

-- Insertar mesas por defecto
INSERT INTO `mesa` (`Num_Mesa`, `descripcion`, `capacidad`, `zona`) VALUES
(1, 'Mesa 1 - Ventana', 4, 'TERRAZA'),
(2, 'Mesa 2 - Terraza', 6, 'TERRAZA'),
(3, 'Mesa 3 - Interior', 4, 'PRINCIPAL'),
(4, 'Mesa 4 - Interior', 4, 'PRINCIPAL'),
(5, 'Mesa 5 - Privada', 8, 'VIP'),
(6, 'Mesa 6 - Barra', 2, 'BARRA'),
(7, 'Mesa 7 - Barra', 2, 'BARRA'),
(8, 'Mesa 8 - Grupo', 10, 'EVENTOS');

-- Insertar productos base para producción
INSERT INTO `complementog` (`id_complementog`, `codigo`, `alias`, `nombre_completo`, `categoria`, `precio`, `tipo`, `tiempo_preparacion`) VALUES
(1, 'CAFE001', 'Café Americano', 'Café Americano Premium', 'BEBIDAS', 2500.00, 'BEBIDA', 3),
(2, 'CAFE002', 'Café con Leche', 'Café con Leche Artesanal', 'BEBIDAS', 3000.00, 'BEBIDA', 4),
(3, 'CAFE003', 'Cappuccino', 'Cappuccino Italiano', 'BEBIDAS', 3500.00, 'BEBIDA', 5),
(4, 'CAFE004', 'Latte', 'Latte Macchiato', 'BEBIDAS', 3800.00, 'BEBIDA', 5),
(5, 'TE001', 'Té Verde', 'Té Verde Oriental', 'BEBIDAS', 2200.00, 'BEBIDA', 3),
(6, 'JUGU001', 'Jugo Natural', 'Jugo Natural de Frutas', 'BEBIDAS', 2800.00, 'BEBIDA', 2),

-- Platos principales
(10, 'SAND001', 'Sándwich Completo', 'Sándwich Completo Italiano Premium', 'PLATOS', 4500.00, 'PLATO', 12),
(11, 'SAND002', 'Sándwich Palta', 'Sándwich de Palta y Tomate', 'PLATOS', 3800.00, 'PLATO', 8),
(12, 'HAMS001', 'Hamburguesa Clásica', 'Hamburguesa Clásica con Papas', 'PLATOS', 6500.00, 'PLATO', 15),
(13, 'HAMS002', 'Hamburguesa BBQ', 'Hamburguesa BBQ Premium', 'PLATOS', 7200.00, 'PLATO', 18),
(14, 'PAST001', 'Pasta Italiana', 'Pasta con Salsa Bolognesa', 'PLATOS', 5800.00, 'PLATO', 20),

-- Entradas
(20, 'EMPA001', 'Empanada de Pino', 'Empanada de Pino Tradicional', 'ENTRADAS', 2200.00, 'ENTRADA', 10),
(21, 'EMPA002', 'Empanada de Queso', 'Empanada de Queso Derretido', 'ENTRADAS', 2000.00, 'ENTRADA', 10),
(22, 'NACO001', 'Nachos', 'Nachos con Queso y Guacamole', 'ENTRADAS', 4200.00, 'ENTRADA', 8),
(23, 'ONIO001', 'Aros de Cebolla', 'Aros de Cebolla Crujientes', 'ENTRADAS', 3500.00, 'ENTRADA', 12),

-- Postres
(30, 'TORT001', 'Torta de Chocolate', 'Torta de Chocolate con Frambuesas', 'POSTRES', 3800.00, 'POSTRE', 5),
(31, 'HELA001', 'Helado Artesanal', 'Helado Artesanal 3 Sabores', 'POSTRES', 2800.00, 'POSTRE', 2),
(32, 'FLAN001', 'Flan de Vainilla', 'Flan de Vainilla Casero', 'POSTRES', 2500.00, 'POSTRE', 3);

-- Insertar opciones de productos
INSERT INTO `opciones_producto` (`id_opcion`, `nombre`, `descripcion`, `precio_adicional`, `tipo`) VALUES
(1, 'Tamaño Grande', 'Porción grande', 800.00, 'TAMAÑO'),
(2, 'Extra Queso', 'Queso adicional', 500.00, 'ADICIONAL'),
(3, 'Sin Cebolla', 'Preparar sin cebolla', 0.00, 'MODIFICACION'),
(4, 'Extra Palta', 'Palta adicional', 800.00, 'ADICIONAL'),
(5, 'Papas Extra', 'Porción extra de papas', 1200.00, 'ADICIONAL');

-- Relacionar productos con opciones
INSERT INTO `producto_opciones` (`id_complementog`, `id_opcion`, `obligatorio`, `multiple`) VALUES
(10, 1, 0, 0), -- Sándwich - Tamaño grande
(10, 2, 0, 1), -- Sándwich - Extra queso
(10, 3, 0, 0), -- Sándwich - Sin cebolla
(10, 4, 0, 1), -- Sándwich - Extra palta
(12, 1, 0, 0), -- Hamburguesa - Tamaño grande
(12, 5, 0, 1); -- Hamburguesa - Papas extra

-- Usuario administrador y operarios para producción
INSERT INTO `usuarios` (`username`, `password_hash`, `nombre_completo`, `email`, `rol`) VALUES
('admin', SHA2('admin123', 256), 'Administrador del Sistema', 'admin@dysa.cl', 'ADMIN'),
('cajero1', SHA2('cajero123', 256), 'Cajero Principal', 'cajero@dysa.cl', 'CAJERO'),
('garzon1', SHA2('garzon123', 256), 'Garzón Principal', 'garzon@dysa.cl', 'GARZON'),
('cocinero1', SHA2('cocina123', 256), 'Jefe de Cocina', 'cocina@dysa.cl', 'COCINERO');

-- ================================================================
-- ÍNDICES ADICIONALES PARA RENDIMIENTO
-- ================================================================

CREATE INDEX `idx_venta_fecha_total` ON `ventadirecta` (`fecha_venta`, `total_final`);
CREATE INDEX `idx_linea_estado_fecha` ON `ventadir_comg` (`estado`, `fecha_creacion`);
CREATE INDEX `idx_cocina_estado_mesa` ON `venta_cocina` (`estado`, `mesa`, `hora_pedido`);

-- ================================================================
-- HABILITAR FOREIGN KEYS
-- ================================================================

SET FOREIGN_KEY_CHECKS = 1;

-- ================================================================
-- MENSAJE DE CONFIRMACIÓN
-- ================================================================

SELECT
    'DYSA Point v2.0.14 - Esquema de Producción Instalado Exitosamente' as estado,
    NOW() as fecha_instalacion,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE()) as tablas_creadas,
    (SELECT COUNT(*) FROM mesa) as mesas_configuradas,
    (SELECT COUNT(*) FROM complementog) as productos_disponibles,
    (SELECT COUNT(*) FROM usuarios) as usuarios_sistema;