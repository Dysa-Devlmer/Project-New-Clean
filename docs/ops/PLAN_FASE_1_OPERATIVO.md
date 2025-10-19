# 🚀 PLAN OPERATIVO FASE 1 - FUNCIONALIDADES BÁSICAS

**Fecha:** 19 Octubre 2025, 03:45 AM
**Reorganización:** Priorizar FASE 1 antes que productos combinados
**Tiempo estimado:** 2-3 horas
**Meta:** Base sólida para migración de restaurantes

---

## 🎯 CAMBIO DE ESTRATEGIA - JUSTIFICACIÓN

### **ANTES (Mi plan original):**
❌ Empezar con productos combinados (complejo)
❌ 4 horas de desarrollo sin base sólida
❌ Riesgo de inconsistencias

### **AHORA (Plan corregido):**
✅ **Estandarización productos** (30 min) → Base consistente
✅ **Configuración empresa** (90 min) → Sistema personalizable
✅ **Testing completo** (60 min) → Validación funcional
✅ **DESPUÉS productos combinados** → Sobre base sólida

**Resultado:** Base consistente que permite desarrollo escalable

---

## 📋 FASE 1 OPERATIVA - PLAN DETALLADO

### **🔧 SUBTAREA 1.1: ESTANDARIZACIÓN PRODUCTOS (30 min)**

#### **OBJETIVO:**
Migrar completamente `precio` → `precio_venta` en base de datos y código

#### **ANÁLISIS PREVIO:**
Según la documentación existente, ya se hizo **parcialmente**:
- ✅ Backend: `productos.js` modificado (4 líneas)
- ✅ Frontend: `pos-panel.html` modificado (5 líneas)
- ❌ **FALTA:** Revisar dependencias completas

#### **TAREAS ESPECÍFICAS:**
- [ ] **1.1.1** Verificar estado actual backend/frontend
- [ ] **1.1.2** Buscar todas las referencias a "precio" en el código
- [ ] **1.1.3** Migrar base de datos si es necesario
- [ ] **1.1.4** Actualizar reportes, facturación, inventario
- [ ] **1.1.5** Testing de consistencia completa
- [ ] **1.1.6** Commit con mensaje descriptivo

#### **ARCHIVOS A REVISAR:**
```bash
# Buscar todas las referencias a "precio"
backend/src/routes/*.js
backend/src/controllers/*.js
backend/static/terminal/*.html
backend/static/terminal/js/*.js
backend/static/cajera/*.html
backend/static/cocina/*.html
```

#### **COMANDOS DE VERIFICACIÓN:**
```bash
# 1. Verificar API actual
curl -s "http://localhost:8547/api/productos" | head -20

# 2. Buscar referencias en código
grep -r "precio[^_]" backend/src/ --include="*.js"
grep -r "precio[^_]" backend/static/ --include="*.html" --include="*.js"

# 3. Verificar BD actual
mysql -u root -p dysa_point -e "DESCRIBE productos;"
```

---

### **🏢 SUBTAREA 1.2: CONFIGURACIÓN EMPRESA COMPLETA (90 min)**

#### **OBJETIVO:**
Sistema completo de configuración empresa para personalización restaurantes

#### **ESTADO ACTUAL:**
Según documentación:
- ❌ API `/api/sistema/configuracion` → Error 404
- ❌ No existe endpoint backend
- ❌ Falta tabla o datos configuración

#### **TAREAS ESPECÍFICAS:**
- [ ] **1.2.1** Crear tabla `configuracion_empresa` en BD
- [ ] **1.2.2** Implementar API GET `/api/sistema/configuracion`
- [ ] **1.2.3** Implementar API PUT `/api/sistema/configuracion`
- [ ] **1.2.4** Crear frontend de configuración empresa
- [ ] **1.2.5** Insertar datos por defecto
- [ ] **1.2.6** Testing configuración completa
- [ ] **1.2.7** Commit funcionalidad completa

#### **ESTRUCTURA BASE DE DATOS:**
```sql
CREATE TABLE configuracion_empresa (
    id INT PRIMARY KEY AUTO_INCREMENT,
    razon_social VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255),
    rut_nif VARCHAR(50) NOT NULL,
    direccion_fiscal TEXT NOT NULL,
    telefono VARCHAR(50),
    email VARCHAR(100),
    sitio_web VARCHAR(100),
    logo_url VARCHAR(255),

    -- Configuración fiscal
    moneda_principal VARCHAR(3) DEFAULT 'EUR',
    iva_defecto DECIMAL(5,2) DEFAULT 21.00,
    serie_factura VARCHAR(10) DEFAULT 'F',
    numeracion_inicio INT DEFAULT 1,

    -- Configuración operativa
    zona_horaria VARCHAR(50) DEFAULT 'Europe/Madrid',
    formato_fecha VARCHAR(20) DEFAULT 'DD/MM/YYYY',
    formato_hora VARCHAR(20) DEFAULT 'HH:mm',

    -- Metadatos
    activa BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### **CAMPOS OBLIGATORIOS MÍNIMOS:**
- Razón social, RUT/NIF, dirección fiscal
- Configuración IVA y moneda
- Serie facturación
- Zona horaria

---

### **🧪 SUBTAREA 1.3: TESTING FRONTEND COMPLETO (60 min)**

#### **OBJETIVO:**
Smoke test completo de todas las interfaces para validar funcionalidad

#### **INTERFACES A PROBAR:**
1. **Login y autenticación**
2. **Terminal POS** (`pos-panel.html`)
3. **Interface mesero** (`waiter-interface-v2.html`)
4. **Panel cocina** (`panel-cocina.html`)
5. **Dashboard cajera** (`dashboard-cajera.html`)
6. **Sistema reportes** (básico)

#### **TAREAS ESPECÍFICAS:**
- [ ] **1.3.1** Verificar servidor backend activo
- [ ] **1.3.2** Test login/logout funcionando
- [ ] **1.3.3** Test carga productos en POS
- [ ] **1.3.4** Test creación venta básica
- [ ] **1.3.5** Test interface mesero operativa
- [ ] **1.3.6** Test panel cocina recibe órdenes
- [ ] **1.3.7** Test dashboard cajera métricas
- [ ] **1.3.8** Test reportes básicos
- [ ] **1.3.9** Documentar resultados detallados
- [ ] **1.3.10** Crear checklist de validación

#### **CRITERIOS DE APROBACIÓN:**
- ✅ Todas las interfaces cargan sin errores
- ✅ Autenticación funcionando
- ✅ Flujo básico venta completo
- ✅ APIs principales respondiendo
- ✅ CSS y JavaScript operativos

---

## ⏱️ CRONOGRAMA OPERATIVO

### **SESIÓN ACTUAL (60-90 min):**
```
03:45 - 04:15  → Subtarea 1.1: Estandarización productos
04:15 - 05:45  → Subtarea 1.2: Configuración empresa
05:45 - 06:45  → Subtarea 1.3: Testing frontend
```

### **RESULTADO ESPERADO:**
- ✅ Sistema con base consistente
- ✅ Personalizable para restaurantes
- ✅ Todas interfaces validadas
- ✅ **Listo para FASE 2 (productos combinados)**

---

## 🔧 COMANDO DE INICIO INMEDIATO

### **EMPEZAR CON SUBTAREA 1.1:**
```
"Iniciar SUBTAREA 1.1: Verificar estado actual estandarización productos (precio → precio_venta) y completar migración total"
```

### **PASOS INMEDIATOS:**
1. Verificar servidor backend activo
2. Revisar estado actual APIs productos
3. Buscar referencias pendientes a "precio"
4. Completar migración completa
5. Testing y commit

---

## 📊 BUENAS PRÁCTICAS ACTIVADAS

### **CONTROL DE VERSIONES:**
- ✅ Commit por cada subtarea completada
- ✅ Mensajes descriptivos específicos
- ✅ Ramas para features complejas

### **DOCUMENTACIÓN:**
- ✅ Actualización inmediata de progreso
- ✅ Registro de problemas y soluciones
- ✅ Timestamping de cada paso

### **TESTING:**
- ✅ Verificación inmediata cada cambio
- ✅ Smoke tests antes de commit
- ✅ Documentación de resultados

### **COMPARACIÓN SYSME:**
- ✅ Validación constante vs sistema antiguo
- ✅ No pérdida de funcionalidades
- ✅ Mejora en tecnología, no en features

---

## ✅ CONFIRMACIÓN DE INICIO

**✅ PLAN OPERATIVO CLARO**
**✅ CRONOGRAMA REALISTA**
**✅ BUENAS PRÁCTICAS ACTIVADAS**
**✅ LISTO PARA EJECUCIÓN INMEDIATA**

---

*Documento creado: 19 Oct 2025, 03:45 AM*
*Inicio inmediato: SUBTAREA 1.1 - Estandarización productos*