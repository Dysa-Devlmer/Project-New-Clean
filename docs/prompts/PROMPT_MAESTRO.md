# PROMPT MAESTRO - POS MISTURA v2
## Sistema de Punto de Venta con Configuración Dinámica

### CONTEXTO DEL PROYECTO
- **Sistema**: POS (Point of Sale) llamado "MISTURA"
- **Stack**: Node.js + Express + MySQL + Frontend HTML/CSS/JS
- **Estructura**: Monorepo con `backend/` y `frontend/`
- **BD**: MySQL (dysa_point) con usuario `devlmer`/`devlmer2025`
- **Puerto**: Backend en 3001, Frontend en 3000

### ESTADO ACTUAL (Octubre 2025)
- ✅ Estructura base del proyecto creada
- ✅ Configuración de BD y conexión establecida
- ✅ Migraciones v2 creadas (16 tablas + seeds)
- 🔄 **CHECKPOINT ACTUAL**: Aplicar migraciones y crear servicios

### ARQUITECTURA DE CONFIGURACIÓN v2

#### Tablas Principales:
1. **configuracion_sistema_base** - Config global del sistema
2. **configuracion_categorias** - Categorías dinámicas
3. **configuracion_productos** - Productos con precios/impuestos
4. **configuracion_impuestos** - Tipos de impuestos configurables
5. **configuracion_descuentos** - Descuentos automáticos/manuales
6. **configuracion_interfaz** - Personalización UI
7. **configuracion_integraciones** - APIs externas
8. **configuracion_reportes** - Templates de reportes
9. **config_monedas** - Monedas soportadas
10. **config_metodos_pago** - Métodos de pago activos

#### Endpoints Críticos a Implementar:
- `GET/PUT /api/configuracion/sistema/configuracion` - Config general
- `GET /api/configuracion/categorias/lista` - Lista categorías
- `GET/POST/PUT/DELETE /api/configuracion/productos` - CRUD productos
- `GET /api/configuracion/impuestos/activos` - Impuestos vigentes

### REGLAS DE IMPLEMENTACIÓN

#### 1. Persistencia Real
- NUNCA usar datos mock o hardcodeados
- SIEMPRE consultar/actualizar BD MySQL
- Validar datos antes de INSERT/UPDATE
- Manejar errores de BD apropiadamente

#### 2. Estructura de Servicios
```
backend/src/
├── services/
│   ├── configuracion.service.js
│   ├── productos.service.js
│   └── categorias.service.js
├── repositories/
│   ├── configuracion.repository.js
│   ├── productos.repository.js
│   └── categorias.repository.js
└── controllers/
    └── configuracion.controller.js
```

#### 3. Patrón Repository
- Repository = acceso directo a BD
- Service = lógica de negocio + validaciones
- Controller = manejo HTTP + respuestas

#### 4. Migraciones v2 Creadas
- `001_configuracion_sistema_base_v2.sql` (16 tablas)
- `002_configuracion_sistema_seeds_v2.sql` (datos iniciales)
- Runner: `run-migrations-improved.js`

### PRÓXIMOS PASOS OBLIGATORIOS

#### Fase 1: Aplicar Migraciones v2
1. Ejecutar `node backend/src/database/run-migrations-improved.js`
2. Verificar 16 tablas creadas en `dysa_point`
3. Confirmar seeds aplicados correctamente

#### Fase 2: Servicios Core
1. Implementar `configuracion.repository.js` con métodos:
   - `getConfiguracionSistema()`
   - `updateConfiguracionSistema(datos)`
   - `getCategorias()`
2. Crear `configuracion.service.js` con validaciones
3. Implementar `configuracion.controller.js` con endpoints

#### Fase 3: Testing y Validación
1. Probar endpoints con Postman/curl
2. Verificar persistencia en BD
3. Validar respuestas JSON correctas

### COMANDOS ESENCIALES
```bash
# Variables de entorno
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_USER="devlmer"
$env:DB_PASS="devlmer2025"
$env:DB_NAME="dysa_point"

# Aplicar migraciones
node backend/src/database/run-migrations-improved.js

# Verificar tablas
node backend/src/database/print-tables.js

# Iniciar backend
cd backend && npm start
```

### CHECKPOINT DE RECUPERACIÓN
Cuando el agente se reinicie, DEBE:
1. Leer este archivo completo
2. Leer `CONTINUE.md` para el próximo paso específico
3. Ejecutar `npm run agent:continue` para mostrar estado
4. Continuar desde el checkpoint sin repetir pasos previos

---

**"Perfecto. Continúa exactamente desde donde quedamos, sin repetir pasos previos, siguiendo todas las instrucciones del prompt principal y guardando cada avance en el repositorio limpio."**