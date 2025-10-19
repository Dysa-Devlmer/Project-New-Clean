# 📋 ESPECIFICACIÓN TÉCNICA - PRODUCTOS COMBINADOS DYSA POINT

**Fecha:** 19 Octubre 2025, 03:40 AM
**Fase:** 1 - Paso 1.1 COMPLETADO
**Basado en:** Sistema antiguo SYSME análisis líneas 976-1012

---

## 🎯 OBJETIVO

Implementar sistema completo de productos combinados en DYSA Point, replicando la funcionalidad del sistema antiguo SYSME que permite:
- **Tipo 1**: Alternativas de producto (radio buttons)
- **Tipo 2**: Extras gratuitos (checkboxes sin costo)
- **Tipo 3**: Extras con precio (checkboxes con costo adicional)

---

## 📊 ANÁLISIS DEL SISTEMA ANTIGUO SYSME

### **TABLA `combinados` DEL SISTEMA ANTIGUO:**
```sql
-- Estructura identificada del sistema antiguo
combinados (
    id_complementog,     -- ID producto principal
    id_complementog1,    -- ID producto combinado/extra
    pack_generado,       -- ID producto alternativo (tipo 1)
    precio,              -- Precio adicional (tipo 3)
    tipo                 -- Tipo: 1, 2, 3
)
```

### **TABLA `complementog` - CAMPO RELACIONADO:**
```sql
-- Campo en productos que indica si tiene combinaciones
tipo_combinado          -- 0=Sin combinados, 1=Tipo 1, 2=Tipo 2, 3=Tipo 3
```

---

## 🔍 TIPOS DE PRODUCTOS COMBINADOS DETALLADOS

### **TIPO 1: ALTERNATIVAS (RADIO BUTTONS)** ⚠️ CRÍTICO
**Concepto:** Producto base con variantes mutuamente excluyentes

**Ejemplo Real:**
```
Producto: "Hamburguesa Clásica" (€8.50)
Alternativas:
○ Normal (€8.50)
○ Con Queso (+€1.00 = €9.50)
○ Con Bacon (+€1.50 = €10.00)
○ Completa: Queso + Bacon (+€2.50 = €11.00)
```

**Comportamiento:**
- Usuario DEBE seleccionar 1 opción (radio button)
- Se agrega UNA SOLA línea a la venta
- El precio final es el del producto alternativo seleccionado
- Campo `pack_generado` indica qué producto específico se agregó

**Estructura de datos tipo 1:**
```sql
-- Ejemplo en tabla combinados:
-- Hamburguesa base (ID=100) con alternativas:
(100, 101, 101, 0.00, 1)     -- Normal → producto ID 101
(100, 102, 102, 1.00, 1)     -- Con Queso → producto ID 102
(100, 103, 103, 1.50, 1)     -- Con Bacon → producto ID 103
(100, 104, 104, 2.50, 1)     -- Completa → producto ID 104
```

### **TIPO 2: EXTRAS GRATUITOS (CHECKBOXES SIN COSTO)** ⚠️ IMPORTANTE
**Concepto:** Producto base con extras incluidos sin costo adicional

**Ejemplo Real:**
```
Producto: "Ensalada Verde" (€6.00)
Extras gratuitos:
☑ Tomate (€0.00)
☐ Lechuga (€0.00)
☑ Cebolla (€0.00)
☐ Pepino (€0.00)
☑ Aceitunas (€0.00)
```

**Comportamiento:**
- Usuario puede seleccionar MÚLTIPLES opciones (checkboxes)
- Se agrega el producto base + líneas adicionales con precio €0.00
- Cada extra seleccionado aparece como línea separada en ticket
- No hay costo adicional, solo personalización

**Estructura de datos tipo 2:**
```sql
-- Ejemplo en tabla combinados:
-- Ensalada base (ID=200) con extras gratuitos:
(200, 201, NULL, 0.00, 2)    -- Tomate gratis
(200, 202, NULL, 0.00, 2)    -- Lechuga gratis
(200, 203, NULL, 0.00, 2)    -- Cebolla gratis
(200, 204, NULL, 0.00, 2)    -- Pepino gratis
(200, 205, NULL, 0.00, 2)    -- Aceitunas gratis
```

### **TIPO 3: EXTRAS CON PRECIO (CHECKBOXES CON COSTO)** ⚠️ CRÍTICO
**Concepto:** Producto base con extras opcionales que tienen costo adicional

**Ejemplo Real:**
```
Producto: "Pizza Margherita" (€12.00)
Extras con precio:
☑ Extra Queso (+€2.00)
☐ Champiñones (+€1.50)
☑ Pepperoni (+€2.50)
☐ Anchoas (+€2.00)
☐ Piña (+€1.00)

TOTAL: €12.00 + €2.00 + €2.50 = €16.50
```

**Comportamiento:**
- Usuario puede seleccionar MÚLTIPLES opciones (checkboxes)
- Se agrega el producto base + líneas adicionales con su precio respectivo
- Cada extra seleccionado aparece como línea separada con su costo
- El total se suma automáticamente

**Estructura de datos tipo 3:**
```sql
-- Ejemplo en tabla combinados:
-- Pizza base (ID=300) con extras pagos:
(300, 301, NULL, 2.00, 3)    -- Extra Queso +€2.00
(300, 302, NULL, 1.50, 3)    -- Champiñones +€1.50
(300, 303, NULL, 2.50, 3)    -- Pepperoni +€2.50
(300, 304, NULL, 2.00, 3)    -- Anchoas +€2.00
(300, 305, NULL, 1.00, 3)    -- Piña +€1.00
```

---

## 🗃️ ESTRUCTURA DE BASE DE DATOS PARA DYSA POINT

### **TABLA `producto_combinados`** (Nueva)
```sql
CREATE TABLE producto_combinados (
    id INT PRIMARY KEY AUTO_INCREMENT,
    producto_id INT NOT NULL,              -- ID producto principal
    producto_combo_id INT NOT NULL,        -- ID producto combinado/extra
    tipo_combinado TINYINT NOT NULL,       -- 1, 2, 3
    precio_extra DECIMAL(10,2) DEFAULT 0,  -- Precio adicional (tipo 3)
    producto_alternativo_id INT NULL,      -- ID alternativo (tipo 1)
    nombre_opcion VARCHAR(100) NOT NULL,   -- Nombre mostrar al usuario
    activo BOOLEAN DEFAULT TRUE,
    orden_mostrar INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (producto_id) REFERENCES productos(id),
    FOREIGN KEY (producto_combo_id) REFERENCES productos(id),
    FOREIGN KEY (producto_alternativo_id) REFERENCES productos(id),

    INDEX idx_producto_tipo (producto_id, tipo_combinado),
    INDEX idx_activo (activo)
);
```

### **MODIFICACIÓN TABLA `productos`** (Agregar campo)
```sql
ALTER TABLE productos
ADD COLUMN tipo_combinado TINYINT DEFAULT 0 COMMENT '0=Sin combinados, 1=Alternativas, 2=Extras gratis, 3=Extras pagos';

CREATE INDEX idx_tipo_combinado ON productos(tipo_combinado);
```

### **DATOS DE EJEMPLO PARA TESTING:**
```sql
-- 1. Productos base
INSERT INTO productos (nombre, precio_venta, categoria_id, tipo_combinado) VALUES
('Hamburguesa Clásica', 8.50, 1, 1),     -- Tipo 1: Alternativas
('Ensalada Verde', 6.00, 2, 2),          -- Tipo 2: Extras gratuitos
('Pizza Margherita', 12.00, 3, 3);       -- Tipo 3: Extras con precio

-- 2. Productos para alternativas (Tipo 1)
INSERT INTO productos (nombre, precio_venta, categoria_id, tipo_combinado) VALUES
('Hamburguesa Normal', 8.50, 1, 0),
('Hamburguesa con Queso', 9.50, 1, 0),
('Hamburguesa con Bacon', 10.00, 1, 0),
('Hamburguesa Completa', 11.00, 1, 0);

-- 3. Productos para extras (Tipos 2 y 3)
INSERT INTO productos (nombre, precio_venta, categoria_id, tipo_combinado) VALUES
('Tomate', 0.00, 4, 0),
('Lechuga', 0.00, 4, 0),
('Extra Queso', 2.00, 4, 0),
('Champiñones', 1.50, 4, 0);

-- 4. Configuración combinados Tipo 1 (Hamburguesa)
INSERT INTO producto_combinados (producto_id, producto_combo_id, tipo_combinado, precio_extra, producto_alternativo_id, nombre_opcion) VALUES
(1, 5, 1, 0.00, 5, 'Normal'),
(1, 6, 1, 1.00, 6, 'Con Queso'),
(1, 7, 1, 1.50, 7, 'Con Bacon'),
(1, 8, 1, 2.50, 8, 'Completa');

-- 5. Configuración combinados Tipo 2 (Ensalada)
INSERT INTO producto_combinados (producto_id, producto_combo_id, tipo_combinado, precio_extra, nombre_opcion) VALUES
(2, 9, 2, 0.00, 'Tomate'),
(2, 10, 2, 0.00, 'Lechuga');

-- 6. Configuración combinados Tipo 3 (Pizza)
INSERT INTO producto_combinados (producto_id, producto_combo_id, tipo_combinado, precio_extra, nombre_opcion) VALUES
(3, 11, 3, 2.00, 'Extra Queso'),
(3, 12, 3, 1.50, 'Champiñones');
```

---

## 🔄 FLUJO DE USUARIO FRONTEND

### **PASO 1: SELECCIÓN PRODUCTO**
Usuario selecciona producto que tiene `tipo_combinado > 0`

### **PASO 2: MOSTRAR OPCIONES SEGÚN TIPO**

#### **Tipo 1 - Radio Buttons:**
```html
<div class="producto-opciones tipo-1">
    <h3>Hamburguesa Clásica - Selecciona una opción:</h3>
    <div class="opciones-radio">
        <label><input type="radio" name="alternativa" value="5" checked> Normal (€8.50)</label>
        <label><input type="radio" name="alternativa" value="6"> Con Queso (€9.50)</label>
        <label><input type="radio" name="alternativa" value="7"> Con Bacon (€10.00)</label>
        <label><input type="radio" name="alternativa" value="8"> Completa (€11.00)</label>
    </div>
</div>
```

#### **Tipo 2 - Checkboxes Gratuitos:**
```html
<div class="producto-opciones tipo-2">
    <h3>Ensalada Verde - Extras incluidos:</h3>
    <div class="opciones-checkbox">
        <label><input type="checkbox" value="9"> Tomate (incluido)</label>
        <label><input type="checkbox" value="10"> Lechuga (incluido)</label>
    </div>
</div>
```

#### **Tipo 3 - Checkboxes con Precio:**
```html
<div class="producto-opciones tipo-3">
    <h3>Pizza Margherita - Extras opcionales:</h3>
    <div class="opciones-checkbox">
        <label><input type="checkbox" value="11"> Extra Queso (+€2.00)</label>
        <label><input type="checkbox" value="12"> Champiñones (+€1.50)</label>
    </div>
    <div class="precio-total">Total: €<span id="precio-calculado">12.00</span></div>
</div>
```

### **PASO 3: AGREGAR A VENTA**
Sistema envía al backend la configuración seleccionada para procesar según el tipo

---

## 🔧 APIS BACKEND NECESARIAS

### **1. GET `/api/productos/:id/combinados`**
```json
{
    "producto_id": 1,
    "nombre": "Hamburguesa Clásica",
    "tipo_combinado": 1,
    "opciones": [
        {
            "id": 1,
            "nombre_opcion": "Normal",
            "precio_extra": 0.00,
            "producto_alternativo_id": 5
        },
        {
            "id": 2,
            "nombre_opcion": "Con Queso",
            "precio_extra": 1.00,
            "producto_alternativo_id": 6
        }
    ]
}
```

### **2. POST `/api/ventas/:id/items-combinados`**
```json
{
    "producto_id": 1,
    "tipo_combinado": 1,
    "cantidad": 1,
    "selecciones": {
        "tipo_1": 6,                    // ID producto alternativo
        "tipo_2": [9, 10],             // Array IDs extras gratuitos
        "tipo_3": [11, 12]             // Array IDs extras con precio
    }
}
```

### **3. Respuesta Backend - Items Agregados:**
```json
{
    "items_agregados": [
        {
            "producto_id": 6,
            "nombre": "Hamburguesa con Queso",
            "cantidad": 1,
            "precio_unitario": 9.50,
            "subtotal": 9.50,
            "es_combinado": true,
            "producto_base_id": 1
        }
    ],
    "total_agregado": 9.50
}
```

---

## ✅ CRITERIOS DE COMPLETADO PASO 1.1

### **DOCUMENTO COMPLETADO:**
- [x] **Especificación técnica detallada** ✅
- [x] **Tipos 1, 2, 3 explicados con ejemplos específicos** ✅
- [x] **Estructura de base de datos definida** ✅
- [x] **Flujo frontend documentado** ✅
- [x] **APIs backend especificadas** ✅
- [x] **Datos de ejemplo para testing** ✅

### **PRÓXIMO PASO:**
**PASO 1.2: Diseñar e implementar base de datos**

---

## 📊 IMPACTO EN SISTEMA

### **SIN PRODUCTOS COMBINADOS:**
❌ No se pueden migrar restaurantes reales
❌ Menús limitados a productos simples
❌ Pérdida de flexibilidad comercial
❌ No competitivo con sistema antiguo

### **CON PRODUCTOS COMBINADOS:**
✅ Migración completa de menús existentes
✅ Flexibilidad total para restaurantes
✅ Competitivo con sistema antiguo SYSME
✅ Base para otros módulos avanzados

---

## 🚀 COMANDO DE CONTINUIDAD

**Para continuar con PASO 1.2:**
```
"Continuar con PASO 1.2: Implementar base de datos productos combinados - Crear tabla producto_combinados y modificar tabla productos"
```

---

*PASO 1.1 COMPLETADO: 19 Oct 2025, 03:40 AM*
*Tiempo real: 10 minutos*
*Próximo paso: PASO 1.2 - Base de datos*