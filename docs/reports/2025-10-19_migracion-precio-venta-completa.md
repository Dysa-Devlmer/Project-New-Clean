# 🔧 MIGRACIÓN COMPLETA: precio → precio_venta

**Fecha:** 19 Octubre 2025, 03:50 AM
**Estado:** CRÍTICO - 50+ referencias inconsistentes detectadas
**Tiempo estimado:** 30-45 minutos

---

## 📊 DIAGNÓSTICO ACTUAL

### **✅ LO QUE YA ESTÁ CORRECTO:**
- API `/api/productos` retorna `precio_venta` ✅
- Algunos archivos ya migrados parcialmente ✅

### **❌ PROBLEMAS DETECTADOS:**
- **50+ referencias a `precio` sin `_venta`** en backend ❌
- **Inconsistencia en base de datos** ❌
- **Archivos frontend pendientes** ❌
- **Reportes, facturación, tarifas inconsistentes** ❌

---

## 🔧 SNIPPET DE MIGRACIÓN BACKEND

### **PASO 1: VERIFICAR ESTRUCTURA BASE DE DATOS**
```sql
-- Verificar tabla productos actual
DESCRIBE productos;

-- Si no existe campo precio_venta, crearlo
ALTER TABLE productos
ADD COLUMN precio_venta DECIMAL(10,2) DEFAULT 0
AFTER precio;

-- Copiar datos de precio a precio_venta si está vacío
UPDATE productos
SET precio_venta = precio
WHERE precio_venta = 0 OR precio_venta IS NULL;

-- Crear índice para performance
CREATE INDEX idx_precio_venta ON productos(precio_venta);
```

### **PASO 2: MIGRACIÓN ARCHIVOS CRÍTICOS**

#### **A. productosControllerCRUD.js** (32 referencias)
```javascript
// ANTES (líneas 141, 158, 163, etc.)
if (!precio || precio <= 0) {
    return res.status(400).json({ error: 'El precio debe ser mayor a 0' });
}

// DESPUÉS
if (!precio_venta || precio_venta <= 0) {
    return res.status(400).json({ error: 'El precio_venta debe ser mayor a 0' });
}

// ANTES (inserción)
(alias, descripcion, precio, id_tipo_comg, cocina, barra, orden, activo)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)

// DESPUÉS
(alias, descripcion, precio_venta, id_tipo_comg, cocina, barra, orden, activo)
VALUES (?, ?, ?, ?, ?, ?, ?, ?)
```

#### **B. tarifasController.js** (20 referencias)
```javascript
// ANTES (línea 412)
SELECT precio FROM complementog WHERE id_complementog = ?

// DESPUÉS
SELECT precio_venta FROM productos WHERE id = ?

// ANTES (múltiples líneas)
precio: productos[0].precio

// DESPUÉS
precio: productos[0].precio_venta
```

#### **C. preticketsController.js** (15 referencias)
```javascript
// ANTES (líneas 241, 250, 370, etc.)
SELECT precio, alias, activo FROM complementog

// DESPUÉS
SELECT precio_venta, alias, activo FROM productos

// ANTES
let precio_unitario = infoProducto[0].precio;

// DESPUÉS
let precio_unitario = infoProducto[0].precio_venta;
```

### **PASO 3: SCRIPT AUTOMÁTICO DE MIGRACIÓN**
```bash
#!/bin/bash
# Script de migración automática

# Archivos a modificar
FILES=(
    "backend/src/controllers/productosControllerCRUD.js"
    "backend/src/controllers/tarifasController.js"
    "backend/src/controllers/preticketsController.js"
    "backend/src/controllers/preticketsController_CORREGIDO.js"
    "backend/src/controllers/preticketsController_BACKUP.js"
    "backend/src/controllers/categoriasController.js"
    "backend/src/controllers/ofertasController.js"
    "backend/src/models/Cliente.js"
)

# Backup automático
for file in "${FILES[@]}"; do
    cp "$file" "$file.backup_$(date +%Y%m%d_%H%M%S)"
done

# Reemplazos automáticos
for file in "${FILES[@]}"; do
    # Cambiar referencias SQL
    sed -i 's/SELECT precio,/SELECT precio_venta,/g' "$file"
    sed -i 's/SELECT precio FROM/SELECT precio_venta FROM/g' "$file"
    sed -i 's/\.precio/\.precio_venta/g' "$file"
    sed -i 's/c\.precio/c\.precio_venta/g' "$file"
    sed -i 's/p\.precio/p\.precio_venta/g' "$file"

    # Cambiar variables JavaScript
    sed -i 's/precio_unitario = infoProducto\[0\]\.precio/precio_unitario = infoProducto[0].precio_venta/g' "$file"
    sed -i 's/producto\[0\]\.precio/producto[0].precio_venta/g' "$file"

    echo "✅ Migrado: $file"
done
```

---

## 🎯 EJECUCIÓN INMEDIATA

### **COMANDO 1: MIGRACIÓN BASE DE DATOS**
```bash
mysql -u root -p dysa_point << 'EOF'
-- Verificar estructura actual
DESCRIBE productos;

-- Asegurar campo precio_venta existe y tiene datos
UPDATE productos
SET precio_venta = COALESCE(precio_venta, precio, 0)
WHERE precio_venta IS NULL OR precio_venta = 0;

-- Verificar migración
SELECT id, nombre, precio_venta FROM productos LIMIT 5;
EOF
```

### **COMANDO 2: MIGRACIÓN CÓDIGO CRÍTICO**
```bash
# Ir al directorio del proyecto
cd "E:\POS SYSME\POS_MISTURA"

# Backup de seguridad
mkdir -p backups/$(date +%Y%m%d_%H%M%S)
cp -r backend/src backups/$(date +%Y%m%d_%H%M%S)/

# Aplicar migraciones críticas
sed -i 's/SELECT precio,/SELECT precio_venta,/g' backend/src/controllers/tarifasController.js
sed -i 's/SELECT precio FROM/SELECT precio_venta FROM/g' backend/src/controllers/tarifasController.js
sed -i 's/\.precio\b/\.precio_venta/g' backend/src/controllers/tarifasController.js

# Verificar cambios
grep -n "precio_venta" backend/src/controllers/tarifasController.js | head -10
```

### **COMANDO 3: RESTART Y TESTING**
```bash
# Reiniciar servidor para aplicar cambios
pkill -f "node.*server.js"
cd backend && npm start &

# Esperar inicio
sleep 5

# Verificar API funciona
curl -s "http://localhost:8547/api/productos" | head -20

# Verificar consistencia
curl -s "http://localhost:8547/api/productos/1" | grep precio_venta
```

---

## ✅ CRITERIOS DE VALIDACIÓN

### **CHECKLIST DE COMPLETADO:**
- [ ] Base de datos: Campo `precio_venta` poblado ✅
- [ ] API productos: Retorna `precio_venta` consistente ✅
- [ ] Backend: Sin referencias a `precio` suelto ✅
- [ ] Frontend: Usa `precio_venta` en todas partes ✅
- [ ] Reportes: Calculan con `precio_venta` ✅
- [ ] Tarifas: Funcionan con `precio_venta` ✅

### **COMANDO DE VERIFICACIÓN FINAL:**
```bash
# Buscar referencias problemáticas
grep -r "\.precio[^_]" backend/src/ --include="*.js" | wc -l
# Resultado esperado: 0 referencias

# Verificar API consistente
curl -s "http://localhost:8547/api/productos" | jq '.data.productos[0]' | grep precio
# Resultado esperado: Solo "precio_venta"
```

---

## 🚨 ROLLBACK SI HAY PROBLEMAS

### **COMANDO DE RESTAURACIÓN:**
```bash
# Restaurar backups
cd "E:\POS SYSME\POS_MISTURA"
BACKUP_DIR=$(ls -1t backups/ | head -1)
cp -r "backups/$BACKUP_DIR/src" backend/

# Reiniciar servidor
pkill -f "node.*server.js"
cd backend && npm start

# Verificar restauración
curl -s "http://localhost:8547/health"
```

---

## 📊 TIEMPO ESTIMADO POR PASO

1. **Migración BD:** 5 minutos
2. **Migración código:** 15 minutos
3. **Testing:** 10 minutos
4. **Verificación:** 5 minutos

**TOTAL:** 35 minutos

---

## 🚀 COMANDO DE INICIO INMEDIATO

```bash
"Ejecutar migración completa precio → precio_venta usando snippets preparados"
```

---

*Snippet preparado: 19 Oct 2025, 03:50 AM*
*Listo para ejecución inmediata*