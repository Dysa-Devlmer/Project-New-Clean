# 🚀 Scripts de Gestión de Jornada - DYSA Point Enterprise

Automatización completa para inicio y cierre de jornadas de desarrollo.

---

## 📋 Scripts Disponibles

### 1. **`start-day.ps1`** - Arranque de Jornada
**Función**: Inicializa automáticamente el entorno de desarrollo completo.

**Uso**:
```powershell
cd "E:\POS SYSME\POS_MISTURA"
.\start-day.ps1
```

**Lo que hace**:
- ✅ Sincroniza con repositorio remoto (`git pull`)
- ✅ Inicia servidor backend automáticamente
- ✅ Verifica conectividad del sistema (health check)
- ✅ Muestra checkpoint actual y tareas del día
- ✅ Proporciona mensaje preformateado para el agente
- ✅ Lista enlaces útiles del sistema

### 2. **`end-day.ps1`** - Cierre de Jornada
**Función**: Guarda progreso y cierra entorno limpiamente.

**Uso**:
```powershell
cd "E:\POS SYSME\POS_MISTURA"
.\end-day.ps1 "mensaje opcional del commit"
```

**Lo que hace**:
- ✅ Detiene servidor backend
- ✅ Muestra cambios pendientes (`git status`)
- ✅ Permite confirmar/saltar guardado
- ✅ Crea commit con mensaje estándar
- ✅ Genera tag automático (eod-YYYYMMDD)
- ✅ Push al repositorio remoto
- ✅ Resumen de la jornada y preparativos para mañana

---

## 🔄 Flujo de Trabajo Diario

### **Al Comenzar el Día**
1. Abrir PowerShell como administrador
2. Ejecutar: `.\start-day.ps1`
3. Abrir Claude Code y usar el mensaje que aparece en pantalla
4. ¡Listo para trabajar!

### **Al Terminar el Día**
1. Ejecutar: `.\end-day.ps1 "resumen de lo que hice hoy"`
2. Confirmar guardado cuando se solicite
3. ¡Trabajo guardado y listo para mañana!

---

## 📊 Información que Muestran

### **start-day.ps1**
```
🚀 INICIANDO JORNADA DYSA POINT ENTERPRISE
============================================

📁 Ubicándose en proyecto...
🔍 Verificando estado del repositorio...
⬇️ Sincronizando con repositorio remoto...
🔧 Cambiando a directorio backend...
🌐 Iniciando servidor backend...
🔍 Verificando servidor...
✅ Servidor operativo en puerto 8547
   Estado: healthy
   Uptime: 5.23 segundos
   BD: connected

🎯 CHECKPOINT ACTUAL: fase2_tickets_p0_smoke_tests_exitosos

📋 TAREAS PARA HOY:
1. Migrar a BD real (eliminar archivos 'simple')
2. Probar split/merge de tickets
3. Iniciar módulo Caja/Pagos (Fase 3 P0)
4. Verificar sync Electron + Web
5. Documentar en español y guardar en GitHub

💬 MENSAJE PARA EL AGENTE:
============================================
[Mensaje completo preformateado listo para copiar/pegar]
============================================

🔗 ENLACES ÚTILES:
• Servidor: http://localhost:8547
• Setup: http://localhost:8547/setup
• Config Red: http://localhost:8547/config/red
• Health: http://localhost:8547/api/sistema/health
• Tickets: http://localhost:8547/api/pos/tickets/estadisticas

✅ ENTORNO LISTO - ¡A TRABAJAR!
```

### **end-day.ps1**
```
🔚 CERRANDO JORNADA DYSA POINT ENTERPRISE
=========================================

📁 Ubicándose en proyecto...
🛑 Deteniendo servidor backend...
✅ Servidor detenido
🔍 Verificando cambios pendientes...

¿Deseas guardar todos los cambios? (S/n): S

📦 Agregando archivos...
💾 Creando commit...
🏷️ Creando tag eod-20251020...
⬆️ Enviando al repositorio remoto...
✅ Cambios guardados exitosamente

📊 RESUMEN DE LA JORNADA:
=========================
Último commit: 7be7912 - feat(pos): tickets/items/modificadores P0 + SSE + smoke tests exitosos (hace 2 horas)
Último tag: eod-20251020

📝 Archivos modificados hoy:
backend/src/controllers/tickets-simple.controller.js
backend/src/routes/tickets-simple.js
docs/reports/2025-10-20_fase2-tickets-p0-completado.md
docs/reports/paridad-sysme.md

💤 PREPARATIVOS PARA MAÑANA:
============================
1. Ejecutar: .\start-day.ps1
2. Usar el mensaje predefinido para el agente
3. Continuar desde checkpoint: fase2_tickets_p0_smoke_tests_exitosos

🌙 ¡JORNADA CERRADA EXITOSAMENTE!
Que descanses bien. Mañana continuamos desde donde quedamos.
```

---

## ⚡ Comandos Rápidos

### **Solo Iniciar Servidor**
```powershell
cd "E:\POS SYSME\POS_MISTURA\backend"
npm run server:start
```

### **Solo Detener Servidor**
```powershell
cd "E:\POS SYSME\POS_MISTURA\backend"
npm run server:stop
```

### **Verificar Estado Rápido**
```powershell
curl -s http://localhost:8547/api/sistema/health | python -m json.tool
```

### **Git Status Rápido**
```powershell
cd "E:\POS SYSME\POS_MISTURA"
git status
git log --oneline -5
```

---

## 🔧 Troubleshooting

### **Error: Execution Policy**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### **Error: Puerto Ocupado**
- El script automáticamente detiene procesos en el puerto 8547
- Si persiste, verificar manualmente:
```powershell
netstat -ano | findstr :8547
taskkill /PID [número] /F
```

### **Error: Git No Sincronizado**
```powershell
git fetch origin
git reset --hard origin/master  # ¡CUIDADO! Esto borra cambios locales
```

---

**Creado**: 20 Octubre 2025
**Versión**: 1.0
**Checkpoint**: fase2_tickets_p0_smoke_tests_exitosos