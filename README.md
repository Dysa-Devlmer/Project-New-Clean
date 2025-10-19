# DYSA Point - Sistema POS

Repositorio oficial del sistema POS DYSA Point Enterprise.

## 📚 Navegación de Documentación

Consulta **[SUMMARY.md](SUMMARY.md)** para navegar toda la documentación del proyecto.

### 📂 Estructura Principal

- **`docs/prompts/`** - Prompts maestros y checkpoints
- **`docs/api/`** - Documentación API Swagger/OpenAPI
- **`docs/ops/`** - Guías de operación y deploy
- **`docs/reports/`** - Reportes de desarrollo por fecha

### 🚀 Inicio Rápido

```bash
# Configurar variables de entorno
$env:DB_HOST="localhost"
$env:DB_PORT="3306"
$env:DB_USER="devlmer"
$env:DB_PASS="devlmer2025"
$env:DB_NAME="dysa_point"

# Control del servidor backend
cd backend
npm run server:start    # Iniciar servidor
npm run server:status   # Verificar estado
npm run server:restart  # Reiniciar servidor
npm run server:stop     # Detener servidor
```

### 🏗️ Estado del Proyecto

- ✅ **Configuración**: Endpoints de configuración sistema funcionando
- ✅ **Mesas v2**: CRUD completo con enriquecimiento de datos
- 🔄 **Sincronización**: Electron/Web unificados (en progreso)
- ⏳ **Tickets**: Sistema de tickets con modificadores (próximo)

### 📡 APIs Principales

- `GET /api/mesas` - Listar mesas con filtros
- `GET /api/mesas/disponibles` - Buscar mesas por capacidad
- `GET /api/mesas/estadisticas` - Estadísticas del sistema
- `GET /api/configuracion/sistema/configuracion` - Configuración general

### 🧪 Verificación del Sistema

```bash
# Verificar base de datos
node backend/src/database/print-tables.js

# Pruebas smoke
curl -s http://localhost:8547/api/mesas | python -m json.tool
curl -s http://localhost:8547/api/mesas/estadisticas | python -m json.tool
```

---

**Última actualización**: Octubre 2025 - Fase 2 POS Núcleo
**Servidor**: Puerto 8547 (backend)
**Base de datos**: MySQL dysa_point (43 tablas)
