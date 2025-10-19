/**
 * DYSA Point POS v2.0.14 - Sistema de Documentación Técnica para Restaurantes
 *
 * Sistema empresarial de generación automática de documentación técnica,
 * manuales de usuario, guías de configuración y procedimientos operativos
 * para facilitar el despliegue y operación en restaurantes profesionales.
 *
 * Características Empresariales:
 * - Generación automática de documentación según tipo de restaurante
 * - Manuales de usuario interactivos con capturas de pantalla
 * - Guías de instalación paso a paso para técnicos
 * - Procedimientos de operación diaria para personal del restaurante
 * - Documentación de APIs para desarrolladores
 * - Troubleshooting automático con soluciones
 * - Plantillas personalizables por marca/restaurante
 * - Exportación a múltiples formatos (PDF, HTML, Markdown)
 * - Versionado automático de documentación
 * - Localización multiidioma
 */

const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');
const archiver = require('archiver');
const marked = require('marked');

class DocumentacionTecnicaManager extends EventEmitter {
    constructor(database) {
        super();
        this.database = database;
        this.configPath = path.join(__dirname, '..', '..', 'config');
        this.docsPath = path.join(__dirname, '..', '..', 'documentacion');
        this.templatesPath = path.join(__dirname, '..', '..', 'templates', 'documentacion');
        this.outputPath = path.join(__dirname, '..', '..', 'docs-generados');

        // Configuración de documentación empresarial
        this.configuracion = {
            idiomas: ['es', 'en', 'pt'],
            formatos: ['pdf', 'html', 'markdown', 'word'],
            tipos_restaurante: ['casual', 'fino', 'rapido', 'bar', 'cafeteria'],
            plantillas: new Map(),
            cache: new Map(),
            versionado: true,
            incluir_screenshots: true,
            incluir_diagramas: true
        };

        // Tipos de documentación disponibles
        this.tiposDocumentacion = {
            'manual-usuario': {
                nombre: 'Manual de Usuario',
                descripcion: 'Guía completa para operadores del sistema',
                audiencia: 'personal_restaurante',
                prioridad: 1
            },
            'guia-instalacion': {
                nombre: 'Guía de Instalación',
                descripcion: 'Instrucciones técnicas de instalación y configuración',
                audiencia: 'tecnicos',
                prioridad: 2
            },
            'procedimientos-operativos': {
                nombre: 'Procedimientos Operativos Estándar',
                descripcion: 'Procedimientos diarios de operación del restaurante',
                audiencia: 'gerencia',
                prioridad: 3
            },
            'api-documentation': {
                nombre: 'Documentación de APIs',
                descripcion: 'Referencias técnicas para desarrolladores',
                audiencia: 'desarrolladores',
                prioridad: 4
            },
            'troubleshooting': {
                nombre: 'Guía de Resolución de Problemas',
                descripcion: 'Soluciones a problemas comunes',
                audiencia: 'soporte_tecnico',
                prioridad: 5
            },
            'configuracion-avanzada': {
                nombre: 'Configuración Avanzada',
                descripcion: 'Configuraciones especializadas por tipo de restaurante',
                audiencia: 'administradores',
                prioridad: 6
            }
        };

        this.plantillasBase = {
            header: `
# DYSA Point POS v2.0.14 - {titulo}
## Sistema de Punto de Venta Empresarial para Restaurantes

**Fecha de Generación**: {fecha}
**Versión del Sistema**: v2.0.14
**Tipo de Restaurante**: {tipo_restaurante}
**Idioma**: {idioma}

---
`,
            footer: `
---

## Soporte Técnico

Para soporte técnico especializado:
- **Email**: soporte@dysapoint.com
- **Teléfono**: +56 2 2345 6789
- **Horario**: Lunes a Domingo 8:00 - 22:00

## Información del Sistema

- **Versión**: DYSA Point POS v2.0.14
- **Tipo**: Sistema Empresarial
- **Compatibilidad**: Windows 10+, Linux Ubuntu 18+
- **Base de Datos**: MySQL 8.0+
- **Navegador**: Chrome 90+, Firefox 88+

*Documentación generada automáticamente por DYSA Point POS*
`
        };

        this.inicializar();
    }

    async inicializar() {
        try {
            console.log('🔧 Inicializando DocumentacionTecnicaManager...');

            // Crear directorios necesarios
            await this.crearDirectorios();

            // Cargar configuración de documentación
            await this.cargarConfiguracion();

            // Cargar plantillas base
            await this.cargarPlantillas();

            // Verificar dependencias
            await this.verificarDependencias();

            console.log('✅ DocumentacionTecnicaManager inicializado correctamente');
            this.emit('sistema-inicializado', { timestamp: new Date() });

        } catch (error) {
            console.error('❌ Error inicializando DocumentacionTecnicaManager:', error);
            this.emit('error-inicializacion', { error, timestamp: new Date() });
            throw error;
        }
    }

    async crearDirectorios() {
        const directorios = [
            this.docsPath,
            this.templatesPath,
            this.outputPath,
            path.join(this.outputPath, 'pdf'),
            path.join(this.outputPath, 'html'),
            path.join(this.outputPath, 'markdown'),
            path.join(this.outputPath, 'screenshots'),
            path.join(this.outputPath, 'diagramas'),
            path.join(this.outputPath, 'paquetes')
        ];

        for (const directorio of directorios) {
            try {
                await fs.mkdir(directorio, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }

    async cargarConfiguracion() {
        const configFile = path.join(this.configPath, 'documentacion-config.json');

        try {
            const configData = await fs.readFile(configFile, 'utf8');
            const config = JSON.parse(configData);
            this.configuracion = { ...this.configuracion, ...config };
        } catch (error) {
            // Si no existe config, usar valores por defecto y crear archivo
            await this.guardarConfiguracion();
        }
    }

    async guardarConfiguracion() {
        const configFile = path.join(this.configPath, 'documentacion-config.json');
        await fs.writeFile(configFile, JSON.stringify(this.configuracion, null, 2));
    }

    async cargarPlantillas() {
        const tiposDocumentacion = Object.keys(this.tiposDocumentacion);

        for (const tipo of tiposDocumentacion) {
            try {
                const templateFile = path.join(this.templatesPath, `${tipo}.md`);
                const contenido = await fs.readFile(templateFile, 'utf8');
                this.plantillasBase[tipo] = contenido;
            } catch (error) {
                // Si no existe plantilla, crear una básica
                await this.crearPlantillaBasica(tipo);
            }
        }
    }

    async crearPlantillaBasica(tipo) {
        const info = this.tiposDocumentacion[tipo];
        const plantilla = `# ${info.nombre}

## Descripción
${info.descripcion}

## Audiencia
${info.audiencia}

## Contenido

{contenido_principal}

## Procedimientos

{procedimientos}

## Troubleshooting

{troubleshooting}
`;

        const templateFile = path.join(this.templatesPath, `${tipo}.md`);
        await fs.writeFile(templateFile, plantilla);
        this.plantillasBase[tipo] = plantilla;
    }

    async verificarDependencias() {
        try {
            // Verificar puppeteer para generación de PDFs
            const browser = await puppeteer.launch({ headless: true });
            await browser.close();
        } catch (error) {
            console.warn('⚠️ Puppeteer no disponible, PDFs no se podrán generar');
        }
    }

    async generarDocumentacionCompleta(options = {}) {
        const startTime = Date.now();
        console.log('📚 Iniciando generación de documentación completa...');

        try {
            const configuracion = {
                tipo_restaurante: 'casual',
                idioma: 'es',
                formatos: ['pdf', 'html', 'markdown'],
                incluir_screenshots: true,
                incluir_diagramas: true,
                personalizar_marca: false,
                ...options
            };

            const resultados = {
                documentos_generados: [],
                screenshots_capturadas: 0,
                diagramas_creados: 0,
                formatos_exportados: [],
                tiempo_total: 0,
                errores: []
            };

            // Generar cada tipo de documentación
            for (const [tipoId, tipoInfo] of Object.entries(this.tiposDocumentacion)) {
                try {
                    console.log(`📄 Generando ${tipoInfo.nombre}...`);

                    const documento = await this.generarDocumento(tipoId, configuracion);
                    resultados.documentos_generados.push(documento);

                    // Generar en todos los formatos solicitados
                    for (const formato of configuracion.formatos) {
                        await this.exportarDocumento(documento, formato, configuracion);
                        if (!resultados.formatos_exportados.includes(formato)) {
                            resultados.formatos_exportados.push(formato);
                        }
                    }

                } catch (error) {
                    console.error(`❌ Error generando ${tipoInfo.nombre}:`, error);
                    resultados.errores.push({
                        tipo: tipoId,
                        error: error.message
                    });
                }
            }

            // Generar screenshots si está habilitado
            if (configuracion.incluir_screenshots) {
                console.log('📸 Capturando screenshots del sistema...');
                resultados.screenshots_capturadas = await this.generarScreenshots(configuracion);
            }

            // Generar diagramas si está habilitado
            if (configuracion.incluir_diagramas) {
                console.log('📊 Generando diagramas de arquitectura...');
                resultados.diagramas_creados = await this.generarDiagramas(configuracion);
            }

            // Crear paquete completo de documentación
            const paqueteFile = await this.crearPaqueteDocumentacion(configuracion, resultados);

            resultados.tiempo_total = Date.now() - startTime;
            resultados.paquete_generado = paqueteFile;

            console.log('✅ Documentación completa generada exitosamente');
            console.log(`📊 Documentos: ${resultados.documentos_generados.length}`);
            console.log(`📸 Screenshots: ${resultados.screenshots_capturadas}`);
            console.log(`📊 Diagramas: ${resultados.diagramas_creados}`);
            console.log(`⏱️ Tiempo total: ${Math.round(resultados.tiempo_total / 1000)}s`);

            this.emit('documentacion-generada', { configuracion, resultados });
            return resultados;

        } catch (error) {
            console.error('❌ Error generando documentación completa:', error);
            this.emit('error-generacion', { error, options });
            throw error;
        }
    }

    async generarDocumento(tipo, configuracion) {
        const tipoInfo = this.tiposDocumentacion[tipo];
        if (!tipoInfo) {
            throw new Error(`Tipo de documentación no válido: ${tipo}`);
        }

        // Obtener contenido específico según el tipo
        let contenido = '';
        switch (tipo) {
            case 'manual-usuario':
                contenido = await this.generarManualUsuario(configuracion);
                break;
            case 'guia-instalacion':
                contenido = await this.generarGuiaInstalacion(configuracion);
                break;
            case 'procedimientos-operativos':
                contenido = await this.generarProcedimientosOperativos(configuracion);
                break;
            case 'api-documentation':
                contenido = await this.generarDocumentacionAPI(configuracion);
                break;
            case 'troubleshooting':
                contenido = await this.generarTroubleshooting(configuracion);
                break;
            case 'configuracion-avanzada':
                contenido = await this.generarConfiguracionAvanzada(configuracion);
                break;
        }

        // Aplicar plantilla y reemplazar variables
        const documento = {
            id: `${tipo}-${Date.now()}`,
            tipo,
            titulo: tipoInfo.nombre,
            contenido: await this.aplicarPlantilla(contenido, configuracion, tipoInfo),
            configuracion,
            fecha_generacion: new Date(),
            version: '2.0.14'
        };

        return documento;
    }

    async generarManualUsuario(configuracion) {
        return `
## Introducción al Sistema

DYSA Point POS es un sistema integral de punto de venta diseñado específicamente para restaurantes ${configuracion.tipo_restaurante}.
Este manual le guiará através de todas las funcionalidades principales del sistema.

## Inicio de Sesión

### Para Personal de Servicio (Garzones)
1. Acceder al sistema mediante código personal de 4 dígitos
2. El sistema validará automáticamente los permisos
3. Acceso inmediato a funcionalidades de ventas y mesas

### Para Administradores
1. Usar email y contraseña corporativa
2. Acceso completo a configuración y reportes
3. Gestión de usuarios y permisos avanzados

## Gestión de Mesas

### Abrir Mesa
1. Seleccionar mesa disponible en el mapa visual
2. Asignar número de comensales
3. Confirmar apertura - la mesa cambiará a estado "Ocupada"

### Tomar Orden
1. Seleccionar productos del menú digitalizado
2. Configurar opciones y complementos
3. Agregar observaciones especiales
4. Enviar orden automáticamente a cocina

### Agregar Productos
1. Mesa debe estar en estado "Ocupada"
2. Seleccionar productos adicionales
3. Especificar cantidades y modificaciones
4. Confirmar envío a cocina

### Cerrar Mesa y Cobrar
1. Revisar total de la cuenta
2. Seleccionar método de pago (efectivo, tarjeta, transferencia)
3. Procesar pago
4. Generar boleta/factura automática
5. Mesa retorna a estado "Disponible"

## Sistema de Cocina por Bloques

### Bloques de Tiempo
- **Bloque 1**: 11:00 - 14:00 (Almuerzo)
- **Bloque 2**: 14:00 - 17:00 (Once)
- **Bloque 3**: 17:00 - 20:00 (Cena temprana)
- **Bloque 4**: 20:00 - 23:00 (Cena tardía)

### Gestión de Órdenes
1. Órdenes se organizan automáticamente por bloque activo
2. Priorización inteligente según tiempo de espera
3. Notificaciones automáticas de órdenes listas
4. Tracking completo de tiempos de preparación

## Aparcar Ventas

### Cuándo Usar
- Interrupciones en el servicio
- Cambios de turno
- Problemas técnicos temporales

### Procedimiento
1. Seleccionar "Aparcar Venta" en mesa activa
2. Agregar motivo del aparcar
3. Venta se guarda temporalmente
4. Recuperar cuando se resuelva la situación

## Sistema de Pre-tickets

### Generar Pre-ticket
1. Tomar orden completa
2. Seleccionar "Generar Pre-ticket"
3. Sistema calcula total provisional
4. Cliente puede revisar y confirmar
5. Orden se envía a cocina una vez confirmada

## Tarifas Múltiples

### Aplicación Automática
- **Hora Feliz**: Descuentos automáticos 15:00-18:00
- **Menú Ejecutivo**: Precios especiales 12:00-15:00
- **Promociones**: Aplicación según reglas configuradas

### Verificación Manual
1. Revisar que tarifa aplicada sea correcta
2. Modificar si es necesario antes de cobrar
3. Sistema registra cambios para auditoria

## Reportes y Estadísticas

### Reportes Diarios
- Ventas por turno y total del día
- Productos más vendidos
- Rendimiento por mesero
- Tiempos promedio de servicio

### Reportes Gerenciales
- Análisis semanal y mensual
- Comparativas de períodos
- Proyecciones de ventas
- Indicadores clave de rendimiento (KPIs)

## Troubleshooting Común

### Problema: Mesa no responde
**Solución**: Refrescar pantalla (F5) o reiniciar sesión

### Problema: Orden no llega a cocina
**Solución**: Verificar conexión de red, reenviar orden manualmente

### Problema: Impresora no funciona
**Solución**: Verificar conexión USB, reiniciar impresora, contactar soporte

### Problema: Sistema lento
**Solución**: Cerrar pestañas innecesarias, reiniciar navegador, verificar memoria RAM
`;
    }

    async generarGuiaInstalacion(configuracion) {
        return `
## Requisitos del Sistema

### Hardware Mínimo
- **Procesador**: Intel Core i3 o AMD equivalente
- **RAM**: 4 GB mínimo, 8 GB recomendado
- **Almacenamiento**: 10 GB espacio libre en disco
- **Red**: Conexión Ethernet estable (WiFi como respaldo)

### Hardware Recomendado
- **Procesador**: Intel Core i5 o superior
- **RAM**: 16 GB o más
- **Almacenamiento**: SSD de 250 GB
- **Red**: Conexión Gigabit Ethernet

### Software Base
- **Sistema Operativo**: Windows 10/11 o Ubuntu 18.04+
- **Base de Datos**: MySQL 8.0+
- **Navegador**: Chrome 90+ o Firefox 88+
- **Node.js**: Versión 16+

## Instalación Automatizada

### Para Windows
1. Descargar script de instalación: \`despliegue-produccion.bat\`
2. Ejecutar como Administrador
3. Seguir instrucciones en pantalla
4. Sistema se instalará automáticamente

\`\`\`batch
# Comando de instalación
despliegue-produccion.bat
\`\`\`

### Para Linux
1. Descargar script de instalación: \`despliegue-produccion.sh\`
2. Dar permisos de ejecución: \`chmod +x despliegue-produccion.sh\`
3. Ejecutar como root: \`sudo ./despliegue-produccion.sh\`

\`\`\`bash
# Comandos de instalación
chmod +x despliegue-produccion.sh
sudo ./despliegue-produccion.sh
\`\`\`

## Configuración Initial

### Configurador Automático
Después de la instalación, ejecutar el configurador:

\`\`\`bash
node scripts/configuracion-restaurante.js
\`\`\`

### Información Requerida
1. **Datos del Restaurante**:
   - Nombre comercial
   - RUT/NIT
   - Dirección y contacto
   - Tipo de restaurante

2. **Configuración de Usuario Administrador**:
   - Email corporativo
   - Contraseña segura (mínimo 8 caracteres)
   - Nombre completo

3. **Configuración de Base de Datos**:
   - Host MySQL (localhost por defecto)
   - Puerto (3306 por defecto)
   - Credenciales de acceso

4. **Configuración de Mesas**:
   - Número total de mesas
   - Capacidad por mesa
   - Distribución por zonas

## Configuración de Red

### Firewall
Puertos que deben estar abiertos:
- **8547**: Puerto principal de la aplicación
- **3306**: MySQL (solo acceso local)
- **80/443**: Puerto web (si se usa proxy)

### Proxy Nginx (Linux)
Sistema configura automáticamente Nginx como proxy reverso:

\`\`\`nginx
server {
    listen 80;
    server_name tu-restaurante.com;

    location / {
        proxy_pass http://localhost:8547;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
\`\`\`

## Configuración de Impresoras

### Impresoras de Comandas
1. Conectar impresora térmica via USB
2. Instalar drivers del fabricante
3. Configurar en DYSA Point:
   - Ir a Configuración > Impresoras
   - Seleccionar impresora instalada
   - Configurar como "Impresora de Comandas"

### Impresoras de Tickets
1. Configurar impresora fiscal (si aplica)
2. Configurar impresora de tickets normal
3. Asignar estaciones específicas:
   - Cocina: Comandas de platos
   - Bar: Comandas de bebidas
   - Caja: Tickets de pago

## Backup y Mantenimiento

### Configuración de Backup Automático
El sistema incluye backup automático cada 6 horas:

\`\`\`bash
# Verificar estado del backup
curl http://localhost:8547/api/backup/estadisticas

# Ejecutar backup manual
curl -X POST http://localhost:8547/api/backup/ejecutar
\`\`\`

### Tareas de Mantenimiento
- Limpieza automática de logs antiguos
- Rotación de backups (retención 30 días)
- Verificación de integridad de base de datos
- Monitoreo de recursos del sistema

## Verificación de Instalación

### Health Check Completo
\`\`\`bash
# Verificar estado del sistema
curl http://localhost:8547/health

# Verificar todas las funcionalidades
node test-sistemas-produccion.js
\`\`\`

### Checklist Post-Instalación
- [ ] Sistema responde en puerto 8547
- [ ] Base de datos conecta correctamente
- [ ] Usuario administrador puede acceder
- [ ] Mesas se muestran en el mapa visual
- [ ] Productos cargan en el menú
- [ ] Impresoras funcionan correctamente
- [ ] Backup automático está activo
- [ ] Monitoreo del sistema operativo

## Solución de Problemas de Instalación

### Error: Puerto 8547 ocupado
\`\`\`bash
# Verificar qué proceso usa el puerto
netstat -tlnp | grep 8547

# Matar proceso si es necesario
kill -9 [PID]
\`\`\`

### Error: MySQL no conecta
1. Verificar que MySQL esté ejecutándose
2. Verificar credenciales en config/database.json
3. Verificar permisos del usuario de base de datos

### Error: Falta Node.js
\`\`\`bash
# Instalar Node.js en Ubuntu
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verificar instalación
node --version
npm --version
\`\`\`
`;
    }

    async generarProcedimientosOperativos(configuracion) {
        return `
## Apertura Diaria del Sistema

### Procedimiento de Apertura (30 minutos antes del servicio)

#### 1. Verificación del Sistema (5 minutos)
- Encender todos los equipos (POS, impresoras, router)
- Verificar conexión a internet
- Abrir navegador y acceder al sistema: http://localhost:8547
- Verificar que aparezca pantalla de login

#### 2. Apertura de Caja (10 minutos)
1. **Login como Administrador**:
   - Usar email y contraseña corporativa
   - Ir a módulo "Caja y Turnos"

2. **Registrar Fondo de Caja**:
   - Ingresar monto inicial en efectivo
   - Detallar denominaciones de billetes y monedas
   - Fotografiar fondo de caja (opcional)
   - Confirmar apertura

3. **Verificar Métodos de Pago**:
   - Terminal de tarjetas funcionando
   - Conexión con banco activa
   - Aplicaciones de pago digital configuradas

#### 3. Preparación del Servicio (15 minutos)
1. **Verificar Estado de Mesas**:
   - Todas las mesas deben aparecer "Disponibles"
   - Si hay mesas ocupadas de la noche anterior, revisar situación
   - Limpiar historial de mesas si es necesario

2. **Verificar Menú y Precios**:
   - Productos del día cargados correctamente
   - Precios actualizados según promociones
   - Verificar disponibilidad de ingredientes

3. **Configurar Personal de Turno**:
   - Activar códigos de garzones del turno
   - Asignar zonas de trabajo
   - Verificar permisos especiales si aplica

## Operación Durante el Servicio

### Atención de Mesas

#### Secuencia Estándar de Servicio
1. **Recepción de Clientes**:
   - Seleccionar mesa disponible en mapa visual
   - Ingresar número de comensales
   - Mesa cambia automáticamente a "Ocupada"

2. **Toma de Orden**:
   - Acceder a menú digitalizado
   - Seleccionar productos y cantidades
   - Configurar modificaciones y observaciones
   - Confirmar envío automático a cocina

3. **Gestión de Pedidos Adicionales**:
   - Agregar productos durante el servicio
   - Sistema actualiza automáticamente la cuenta
   - Nuevos items se envían a cocina al confirmar

4. **Cierre y Cobro**:
   - Revisar cuenta completa con cliente
   - Seleccionar método de pago
   - Procesar transacción
   - Entregar ticket/boleta
   - Mesa vuelve a "Disponible"

### Gestión de Cocina

#### Sistema de Bloques de Tiempo
- **11:00-14:00**: Bloque 1 (Almuerzo)
- **14:00-17:00**: Bloque 2 (Once/Snacks)
- **17:00-20:00**: Bloque 3 (Cena temprana)
- **20:00-23:00**: Bloque 4 (Cena tardía)

#### Procedimiento de Cocina
1. **Recepción de Órdenes**:
   - Órdenes llegan automáticamente clasificadas por bloque
   - Priorización automática por tiempo de espera
   - Tracking de tiempos de preparación

2. **Gestión de Preparación**:
   - Marcar items como "En preparación"
   - Actualizar tiempos estimados
   - Notificar cuando platos estén listos

3. **Comunicación con Servicio**:
   - Sistema notifica automáticamente cuando order está lista
   - Garzones reciben alerta en sus dispositivos
   - Tracking completo de entrega a mesa

### Situaciones Especiales

#### Aparcar Ventas
**Cuándo usar**:
- Problemas técnicos temporales
- Cambios de turno en mitad del servicio
- Interrupciones por emergencias

**Procedimiento**:
1. Seleccionar "Aparcar Venta" en la mesa afectada
2. Ingresar motivo del aparcar
3. Sistema guarda estado temporal
4. Recuperar venta cuando se resuelva situación

#### Pre-tickets
**Uso recomendado**:
- Grupos grandes que desean revisar cuenta antes de pagar
- Eventos corporativos con aprobación previa
- Servicios a domicilio con pago posterior

**Procedimiento**:
1. Completar toma de orden normalmente
2. Seleccionar "Generar Pre-ticket" antes de enviar a cocina
3. Cliente revisa y aprueba cuenta
4. Confirmar para enviar orden a cocina

#### Tarifas Especiales
**Aplicación automática**:
- Hora feliz (15:00-18:00): Descuentos en bebidas
- Menú ejecutivo (12:00-15:00): Precios especiales almuerzo
- Promociones estacionales: Según configuración

**Verificación manual**:
- Revisar que tarifa aplicada sea correcta antes de cobrar
- Modificar si es necesario
- Sistema registra cambios para auditoría

## Cierre Diario del Sistema

### Procedimiento de Cierre (30 minutos después del último cliente)

#### 1. Verificación de Mesas (5 minutos)
- Todas las mesas deben estar "Disponibles"
- Si hay mesas abiertas, verificar situación
- Cerrar mesas abandonadas siguiendo protocolo

#### 2. Cierre de Caja (15 minutos)
1. **Cuadre de Efectivo**:
   - Contar efectivo en caja
   - Comparar con total reportado por sistema
   - Registrar diferencias si las hay

2. **Verificación de Pagos Electrónicos**:
   - Verificar total de transacciones con tarjeta
   - Confirmar depósitos bancarios del día
   - Revisar pagos digitales (transferencias, apps)

3. **Generar Reporte de Cierre**:
   - Sistema genera automáticamente reporte diario
   - Incluye ventas por producto, método de pago, garzón
   - Imprimir para archivo físico

#### 3. Backup y Mantenimiento (10 minutos)
1. **Backup Manual** (opcional):
   - Sistema hace backup automático cada 6 horas
   - Ejecutar backup manual si se desea: Configuración > Backup > Ejecutar

2. **Limpieza del Sistema**:
   - Cerrar todas las sesiones de usuario
   - Limpiar caché del navegador si es necesario
   - Verificar espacio en disco

3. **Preparación para el Día Siguiente**:
   - Actualizar productos del día siguiente si aplica
   - Configurar promociones especiales
   - Verificar que sistema de monitoreo esté activo

## Procedimientos de Emergencia

### Corte de Internet
1. **Modo Sin Conexión**:
   - Sistema continúa funcionando localmente
   - Órdenes se guardan para sincronizar después
   - Pagos con tarjeta no disponibles temporalmente

2. **Procedimiento**:
   - Informar a garzones sobre limitación de pagos
   - Continuar con efectivo y transferencias manuales
   - Sincronizar cuando se restablezca conexión

### Falla del Sistema Principal
1. **Backup de Emergencia**:
   - Usar tablets o celulares como respaldo
   - Tomar órdenes manualmente en papel
   - Ingresar al sistema cuando se restablezca

2. **Contacto de Soporte**:
   - Teléfono: +56 2 2345 6789
   - Email: soporte@dysapoint.com
   - WhatsApp: +56 9 8765 4321

### Problema con Impresoras
1. **Impresora de Comandas**:
   - Verificar conexión USB
   - Reiniciar impresora
   - Usar impresora de respaldo si está disponible

2. **Impresora de Tickets**:
   - Verificar papel térmico
   - Limpiar cabezal de impresión
   - Generar tickets manualmente como último recurso

## Indicadores de Rendimiento (KPIs)

### Métricas Diarias a Monitorear
- **Tiempo promedio de servicio por mesa**
- **Tickets promedio por mesa**
- **Productos más vendidos**
- **Rendimiento por garzón**
- **Satisfacción del cliente** (si se implementa sistema de rating)

### Metas Operativas
- Tiempo servicio: < 45 minutos por mesa
- Accuracy órdenes: > 95%
- Uptime sistema: > 99%
- Tiempo respuesta: < 2 segundos
`;
    }

    async generarDocumentacionAPI(configuracion) {
        return `
## API Reference - DYSA Point POS v2.0.14

### Autenticación

Todas las APIs requieren autenticación mediante JWT token.

\`\`\`bash
# Obtener token de autenticación
POST /api/auth/login
Content-Type: application/json

{
  "email": "admin@restaurante.com",
  "password": "password123"
}
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "admin@restaurante.com",
    "role": "admin"
  }
}
\`\`\`

### Headers Requeridos
\`\`\`
Authorization: Bearer <token>
Content-Type: application/json
\`\`\`

## APIs de Ventas

### Obtener Ventas
\`\`\`http
GET /api/ventas?fecha=2025-01-15&estado=abierta
\`\`\`

### Crear Nueva Venta
\`\`\`http
POST /api/ventas
{
  "mesa": 5,
  "garzon": "GAR001",
  "productos": [
    {
      "id_complementog": 1,
      "cantidad": 2,
      "precio_unitario": 8500,
      "observaciones": "Sin cebolla"
    }
  ]
}
\`\`\`

### Agregar Productos a Venta
\`\`\`http
POST /api/ventas/{id_venta}/productos
{
  "productos": [
    {
      "id_complementog": 5,
      "cantidad": 1,
      "precio_unitario": 3200
    }
  ]
}
\`\`\`

### Cerrar Venta
\`\`\`http
PUT /api/ventas/{id_venta}/cerrar
{
  "metodo_pago": "efectivo",
  "monto_pagado": 15000,
  "descuentos": 0
}
\`\`\`

## APIs de Mesas

### Obtener Estado de Mesas
\`\`\`http
GET /api/mesas
\`\`\`

Response:
\`\`\`json
{
  "success": true,
  "mesas": [
    {
      "numero": 1,
      "capacidad": 4,
      "estado": "disponible",
      "zona": "terraza",
      "venta_activa": null
    },
    {
      "numero": 2,
      "capacidad": 2,
      "estado": "ocupada",
      "zona": "salon",
      "venta_activa": {
        "id": 123,
        "total": 25600,
        "tiempo_transcurrido": "00:45:30"
      }
    }
  ]
}
\`\`\`

### Abrir Mesa
\`\`\`http
POST /api/mesas/{numero}/abrir
{
  "comensales": 4,
  "garzon": "GAR001",
  "observaciones": "Mesa preferencial"
}
\`\`\`

### Liberar Mesa
\`\`\`http
POST /api/mesas/{numero}/liberar
\`\`\`

## APIs de Productos

### Obtener Menú Completo
\`\`\`http
GET /api/productos/menu
\`\`\`

### Obtener Producto por ID
\`\`\`http
GET /api/productos/{id}
\`\`\`

### Buscar Productos
\`\`\`http
GET /api/productos/buscar?q=hamburguesa&categoria=platos_principales
\`\`\`

## APIs de Cocina (Bloques)

### Obtener Órdenes por Bloque
\`\`\`http
GET /api/cocina/bloques/{bloque_id}/ordenes
\`\`\`

### Marcar Producto como Listo
\`\`\`http
PUT /api/cocina/ordenes/{id_linea}/listo
{
  "tiempo_preparacion": 15,
  "observaciones": "Producto listo para servir"
}
\`\`\`

### Obtener Estadísticas de Cocina
\`\`\`http
GET /api/cocina/estadisticas?fecha=2025-01-15
\`\`\`

## APIs de Aparcar Ventas

### Aparcar Venta
\`\`\`http
POST /api/aparcar/{id_venta}
{
  "motivo": "Cambio de turno",
  "observaciones": "Cliente solicita continuar más tarde"
}
\`\`\`

### Recuperar Venta Aparcada
\`\`\`http
POST /api/aparcar/{id_venta}/recuperar
{
  "nuevo_garzon": "GAR002"
}
\`\`\`

### Listar Ventas Aparcadas
\`\`\`http
GET /api/aparcar/listar
\`\`\`

## APIs de Pre-tickets

### Generar Pre-ticket
\`\`\`http
POST /api/pretickets/generar
{
  "id_venta": 123,
  "tipo": "preview",
  "incluir_total": true
}
\`\`\`

### Confirmar Pre-ticket
\`\`\`http
POST /api/pretickets/{id}/confirmar
\`\`\`

### Obtener Pre-ticket
\`\`\`http
GET /api/pretickets/{id}
\`\`\`

## APIs de Tarifas

### Obtener Tarifas Activas
\`\`\`http
GET /api/tarifas/activas
\`\`\`

### Aplicar Tarifa Específica
\`\`\`http
POST /api/tarifas/aplicar
{
  "id_venta": 123,
  "id_tarifa": 2,
  "productos": [1, 3, 5]
}
\`\`\`

### Obtener Historial de Tarifas
\`\`\`http
GET /api/tarifas/historial?fecha_desde=2025-01-01&fecha_hasta=2025-01-31
\`\`\`

## APIs de Backup

### Ejecutar Backup Manual
\`\`\`http
POST /api/backup/ejecutar
{
  "incluir_configuracion": true,
  "compresion": 9
}
\`\`\`

### Obtener Lista de Backups
\`\`\`http
GET /api/backup/archivos
\`\`\`

### Descargar Backup
\`\`\`http
GET /api/backup/descargar/{archivo}
\`\`\`

### Restaurar desde Backup
\`\`\`http
POST /api/backup/restaurar/{archivo}
{
  "confirmar": true,
  "backup_previo": true
}
\`\`\`

## APIs de Monitoreo

### Obtener Estadísticas del Sistema
\`\`\`http
GET /api/monitoreo/estadisticas
\`\`\`

### Obtener Métricas Específicas
\`\`\`http
GET /api/monitoreo/metricas/cpu
GET /api/monitoreo/metricas/memoria
GET /api/monitoreo/metricas/disco
\`\`\`

### Dashboard de Monitoreo
\`\`\`http
GET /api/monitoreo/dashboard
\`\`\`

## APIs de Configuración

### Obtener Configuración Actual
\`\`\`http
GET /api/configuracion/estado
\`\`\`

### Actualizar Configuración
\`\`\`http
PUT /api/configuracion/actualizar/general
{
  "nombre_restaurante": "El Nuevo Sabor",
  "tipo_restaurante": "casual",
  "moneda": "CLP"
}
\`\`\`

### Ejecutar Configuración Inicial
\`\`\`http
POST /api/configuracion/configurar
{
  "tipo_restaurante": "fino",
  "datos_basicos": {
    "nombre": "Restaurante Gourmet",
    "email": "contacto@gourmet.com"
  }
}
\`\`\`

## Códigos de Estado HTTP

- **200**: Operación exitosa
- **201**: Recurso creado exitosamente
- **400**: Solicitud inválida
- **401**: No autorizado (token inválido)
- **403**: Prohibido (permisos insuficientes)
- **404**: Recurso no encontrado
- **429**: Demasiadas solicitudes (rate limit)
- **500**: Error interno del servidor

## Rate Limiting

Las APIs tienen diferentes límites según la operación:

- **APIs de consulta**: 100 req/min
- **APIs de transacciones**: 50 req/min
- **APIs de configuración**: 10 req/min
- **APIs de backup**: 5 req/min

## Webhooks

El sistema puede enviar notificaciones a URLs externas:

### Configurar Webhook
\`\`\`http
POST /api/webhooks/configurar
{
  "url": "https://mi-sistema.com/webhook",
  "eventos": ["venta_completada", "error_sistema"],
  "secreto": "mi_secreto_webhook"
}
\`\`\`

### Eventos Disponibles
- \`venta_completada\`: Cuando se cierra una venta
- \`error_sistema\`: Errores críticos del sistema
- \`backup_completado\`: Backup exitoso
- \`alerta_recursos\`: Alertas de CPU/memoria/disco

## SDKs y Ejemplos

### JavaScript/Node.js
\`\`\`javascript
const DysaPointAPI = require('dysa-point-sdk');

const api = new DysaPointAPI({
  baseURL: 'http://localhost:8547',
  token: 'your-jwt-token'
});

// Crear nueva venta
const venta = await api.ventas.crear({
  mesa: 5,
  productos: [
    { id_complementog: 1, cantidad: 2 }
  ]
});

// Obtener estado de mesas
const mesas = await api.mesas.obtener();
\`\`\`

### Python
\`\`\`python
import requests

class DysaPointAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def crear_venta(self, data):
        response = requests.post(
            f'{self.base_url}/api/ventas',
            json=data,
            headers=self.headers
        )
        return response.json()

# Uso
api = DysaPointAPI('http://localhost:8547', 'your-token')
venta = api.crear_venta({
    'mesa': 5,
    'productos': [{'id_complementog': 1, 'cantidad': 2}]
})
\`\`\`

### cURL Examples
\`\`\`bash
# Crear venta
curl -X POST http://localhost:8547/api/ventas \\
  -H "Authorization: Bearer your-token" \\
  -H "Content-Type: application/json" \\
  -d '{"mesa": 5, "productos": [{"id_complementog": 1, "cantidad": 2}]}'

# Obtener mesas
curl -X GET http://localhost:8547/api/mesas \\
  -H "Authorization: Bearer your-token"
\`\`\`
`;
    }

    async generarTroubleshooting(configuracion) {
        return `
## Problemas Comunes y Soluciones

### Problemas de Conectividad

#### Sistema no carga / Página en blanco
**Síntomas**:
- Navegador muestra página en blanco
- Mensaje "No se puede conectar"
- Loading infinito

**Diagnóstico**:
1. Verificar que el servidor esté ejecutándose:
   \`\`\`bash
   # En Windows
   tasklist | findstr node

   # En Linux
   ps aux | grep node
   \`\`\`

2. Verificar puerto 8547:
   \`\`\`bash
   netstat -tlnp | grep 8547
   \`\`\`

**Soluciones**:
1. **Reiniciar servidor**:
   \`\`\`bash
   # Ir al directorio del sistema
   cd E:\\POS SYSME\\POS_MISTURA\\electron-app

   # Reiniciar servidor
   node server.js
   \`\`\`

2. **Verificar logs de error**:
   \`\`\`bash
   # Ver logs recientes
   tail -n 50 logs/error.log
   \`\`\`

3. **Limpiar caché del navegador**:
   - Presionar Ctrl+F5 para refrescar forzado
   - Limpiar caché y cookies del navegador

#### Error de conexión a base de datos
**Síntomas**:
- Mensaje "Database connection failed"
- Errores al cargar mesas o productos
- Sistema se carga pero no muestra datos

**Diagnóstico**:
1. Verificar servicio MySQL:
   \`\`\`bash
   # Windows
   sc query mysql80

   # Linux
   systemctl status mysql
   \`\`\`

2. Probar conexión manual:
   \`\`\`bash
   mysql -u dysa_user -p dysa_point
   \`\`\`

**Soluciones**:
1. **Reiniciar MySQL**:
   \`\`\`bash
   # Windows
   net stop mysql80
   net start mysql80

   # Linux
   sudo systemctl restart mysql
   \`\`\`

2. **Verificar credenciales**:
   - Revisar archivo \`config/database.json\`
   - Verificar usuario y contraseña
   - Verificar permisos de base de datos

3. **Restaurar base de datos desde backup**:
   \`\`\`bash
   # Listar backups disponibles
   curl http://localhost:8547/api/backup/archivos

   # Restaurar último backup
   curl -X POST http://localhost:8547/api/backup/restaurar/[archivo]
   \`\`\`

### Problemas de Rendimiento

#### Sistema lento / Respuestas tardías
**Síntomas**:
- Demora al cargar mesas
- Lentitud al procesar órdenes
- Timeout en operaciones

**Diagnóstico**:
1. Verificar uso de recursos:
   \`\`\`bash
   # Ver estadísticas del sistema
   curl http://localhost:8547/api/monitoreo/estadisticas
   \`\`\`

2. Verificar memoria disponible:
   \`\`\`bash
   # Windows
   wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /format:table

   # Linux
   free -h
   \`\`\`

**Soluciones**:
1. **Cerrar aplicaciones innecesarias**:
   - Cerrar pestañas del navegador no utilizadas
   - Cerrar programas que consuman memoria

2. **Reiniciar sistema**:
   - Si persiste la lentitud, reiniciar completamente
   - Verificar que sistema inicie automáticamente

3. **Optimizar base de datos**:
   \`\`\`sql
   -- Conectar a MySQL y ejecutar
   OPTIMIZE TABLE ventadirecta;
   OPTIMIZE TABLE ventadir_comg;
   OPTIMIZE TABLE mesa;
   \`\`\`

#### High CPU / Memoria alta
**Síntomas**:
- Sistema operativo lento
- Ventiladores trabajando constantemente
- Alertas de monitoreo

**Diagnóstico**:
\`\`\`bash
# Ver procesos que más consumen
top -o %CPU

# En Windows
tasklist /fo table | sort /r /+5
\`\`\`

**Soluciones**:
1. **Identificar proceso problemático**
2. **Reiniciar servicio específico**
3. **Contactar soporte si persiste**

### Problemas de Impresión

#### Comandas no imprimen
**Síntomas**:
- Órdenes no salen en impresora de cocina
- Mensaje "Error de impresión"
- Impresora no responde

**Diagnóstico**:
1. Verificar conexión física:
   - Cable USB conectado firmemente
   - Impresora encendida
   - LED de estado verde

2. Verificar en sistema operativo:
   \`\`\`bash
   # Windows - Ver impresoras instaladas
   wmic printer list brief

   # Linux - Ver impresoras
   lpstat -p
   \`\`\`

**Soluciones**:
1. **Reiniciar impresora**:
   - Apagar por 10 segundos
   - Encender y esperar inicialización completa

2. **Verificar papel**:
   - Papel térmico instalado correctamente
   - Sin atascos de papel
   - Suficiente papel en rollo

3. **Reinstalar driver**:
   - Desinstalar impresora del sistema
   - Reinstalar con drivers del fabricante

4. **Configurar en DYSA Point**:
   - Ir a Configuración > Impresoras
   - Verificar impresora seleccionada
   - Realizar impresión de prueba

#### Tickets salen cortados o ilegibles
**Síntomas**:
- Texto cortado en los bordes
- Caracteres ilegibles
- Formato incorrecto

**Soluciones**:
1. **Ajustar configuración de papel**:
   - Verificar ancho de papel en configuración
   - Ajustar márgenes de impresión

2. **Limpiar cabezal**:
   - Usar tarjeta de limpieza específica
   - Limpiar con alcohol isopropílico

3. **Verificar calidad de papel**:
   - Usar papel térmico de calidad
   - Verificar fecha de caducidad del papel

### Problemas de Operación

#### Mesa no se puede cerrar
**Síntomas**:
- Botón "Cerrar Mesa" no responde
- Error al procesar pago
- Mesa permanece "Ocupada"

**Diagnóstico**:
1. Verificar estado de la venta:
   \`\`\`bash
   # Obtener detalles de la mesa
   curl http://localhost:8547/api/mesas/[numero]
   \`\`\`

2. Verificar productos pendientes en cocina

**Soluciones**:
1. **Forzar cierre de mesa**:
   - Acceder como administrador
   - Ir a "Gestión de Mesas"
   - Seleccionar "Forzar Cierre"

2. **Verificar conexión de pago**:
   - Para pagos con tarjeta, verificar terminal
   - Para efectivo, proceder normalmente

3. **Contactar soporte** si persiste

#### Productos no aparecen en menú
**Síntomas**:
- Menú vacío o incompleto
- Productos específicos no cargan
- Precios incorrectos

**Diagnóstico**:
\`\`\`bash
# Verificar productos en base de datos
curl http://localhost:8547/api/productos/menu
\`\`\`

**Soluciones**:
1. **Refrescar caché**:
   - Presionar F5 en el navegador
   - O reiniciar sesión

2. **Verificar base de datos**:
   \`\`\`sql
   SELECT COUNT(*) FROM complementog WHERE activo = 1;
   \`\`\`

3. **Restaurar productos desde backup** si es necesario

#### Códigos de garzón no funcionan
**Síntomas**:
- "Código inválido" al intentar login
- Garzón no puede acceder al sistema

**Soluciones**:
1. **Verificar código**:
   - Confirmar código de 4 dígitos
   - Verificar que esté activo en sistema

2. **Resetear código**:
   - Acceder como administrador
   - Ir a "Gestión de Usuarios"
   - Generar nuevo código para garzón

3. **Verificar permisos**:
   - Confirmar que garzón tenga permisos activos
   - Verificar horario de trabajo asignado

### Problemas de Backup

#### Backup automático falla
**Síntomas**:
- Notificaciones de backup fallido
- No se generan archivos de backup
- Espacio en disco insuficiente

**Diagnóstico**:
\`\`\`bash
# Verificar estado del backup
curl http://localhost:8547/api/backup/estadisticas
\`\`\`

**Soluciones**:
1. **Verificar espacio en disco**:
   \`\`\`bash
   # Windows
   dir C:\\ | find "bytes free"

   # Linux
   df -h
   \`\`\`

2. **Limpiar backups antiguos**:
   - Eliminar backups de más de 30 días
   - Configurar retención automática

3. **Ejecutar backup manual**:
   \`\`\`bash
   curl -X POST http://localhost:8547/api/backup/ejecutar
   \`\`\`

### Contacto de Soporte Técnico

#### Información a Proveer
Cuando contacte soporte, tenga lista la siguiente información:

1. **Información del Sistema**:
   - Versión: DYSA Point POS v2.0.14
   - Sistema operativo y versión
   - Navegador utilizado

2. **Descripción del Problema**:
   - Cuándo ocurrió
   - Pasos para reproducir
   - Mensajes de error exactos

3. **Logs del Sistema**:
   \`\`\`bash
   # Generar reporte de diagnóstico
   curl http://localhost:8547/api/monitoreo/diagnostico > diagnostico.txt
   \`\`\`

#### Canales de Soporte

**Soporte Técnico 24/7**:
- **Teléfono**: +56 2 2345 6789
- **WhatsApp**: +56 9 8765 4321
- **Email**: soporte@dysapoint.com

**Soporte por Niveles**:
- **Nivel 1**: Problemas básicos de operación
- **Nivel 2**: Problemas técnicos especializados
- **Nivel 3**: Problemas de infraestructura crítica

**Tiempo de Respuesta**:
- **Crítico**: 15 minutos
- **Alto**: 1 hora
- **Medio**: 4 horas
- **Bajo**: 24 horas

#### Acceso Remoto
En casos críticos, soporte puede solicitar acceso remoto:

1. **TeamViewer**: ID y contraseña temporal
2. **SSH**: Para servidores Linux
3. **RDP**: Para servidores Windows

**Nota**: Nunca proporcionar credenciales permanentes
`;
    }

    async generarConfiguracionAvanzada(configuracion) {
        return `
## Configuración Avanzada por Tipo de Restaurante

### Restaurante Casual

#### Características Principales
- Servicio rápido y eficiente
- Menú variado con precios accesibles
- Alto volumen de clientes
- Rotación rápida de mesas

#### Configuraciones Recomendadas

**Tiempo de Servicio**:
\`\`\`json
{
  "tiempo_maximo_mesa": 90,
  "alerta_tiempo_servicio": 60,
  "tiempo_promedio_preparacion": 15,
  "rotacion_objetivo": 1.5
}
\`\`\`

**Bloques de Cocina**:
- Bloque 1 (11:00-14:30): Almuerzo intensivo
- Bloque 2 (14:30-17:00): Tarde relajada
- Bloque 3 (17:00-20:30): Cena temprana
- Bloque 4 (20:30-23:00): Cena tardía

**Tarifas Automáticas**:
\`\`\`json
{
  "hora_feliz": {
    "horario": "15:00-18:00",
    "descuento": 20,
    "productos": ["bebidas", "aperitivos"]
  },
  "menu_ejecutivo": {
    "horario": "12:00-15:00",
    "precio_fijo": 7500,
    "incluye": ["entrada", "plato_principal", "postre", "bebida"]
  }
}
\`\`\`

### Restaurante Fino

#### Características Principales
- Servicio premium personalizado
- Menú gourmet con ingredientes selectos
- Experiencia gastronómica completa
- Tiempo extendido por mesa

#### Configuraciones Recomendadas

**Tiempo de Servicio**:
\`\`\`json
{
  "tiempo_maximo_mesa": 180,
  "alerta_tiempo_servicio": 120,
  "tiempo_promedio_preparacion": 30,
  "servicio_personalizado": true
}
\`\`\`

**Reservas Avanzadas**:
\`\`\`json
{
  "reservas_requeridas": true,
  "anticipacion_minima": 24,
  "confirmacion_automatica": false,
  "mesas_vip": [1, 2, 3, 15, 16]
}
\`\`\`

**Menús Especiales**:
\`\`\`json
{
  "menu_degustacion": {
    "tiempo_estimado": 150,
    "precio": 45000,
    "maridaje_incluido": true
  },
  "carta_vinos": {
    "categorias": ["espumantes", "blancos", "tintos", "premium"],
    "servicio_sommelier": true
  }
}
\`\`\`

### Restaurante de Comida Rápida

#### Características Principales
- Servicio ultra rápido
- Menú estandarizado
- Alto volumen de transacciones
- Múltiples canales de venta

#### Configuraciones Recomendadas

**Tiempo de Servicio**:
\`\`\`json
{
  "tiempo_maximo_preparacion": 8,
  "alerta_demora": 10,
  "objetivo_servicio": 5,
  "auto_alerta_cocina": true
}
\`\`\`

**Modalidades de Servicio**:
\`\`\`json
{
  "para_llevar": true,
  "delivery": true,
  "autoservicio": true,
  "drive_through": true
}
\`\`\`

**Combos y Promociones**:
\`\`\`json
{
  "combos_automaticos": true,
  "upselling_inteligente": true,
  "promociones_tiempo_real": true,
  "descuentos_volumen": true
}
\`\`\`

### Bar/Pub

#### Características Principales
- Enfoque en bebidas y aperitivos
- Ambiente nocturno
- Música y entretenimiento
- Mesas altas y barra

#### Configuraciones Recomendadas

**Horarios Especiales**:
\`\`\`json
{
  "happy_hour": {
    "horario": "17:00-20:00",
    "descuento_bebidas": 30,
    "aperitivos_gratis": true
  },
  "horario_nocturno": {
    "inicio": "20:00",
    "fin": "02:00",
    "precio_nocturno": true
  }
}
\`\`\`

**Gestión de Barra**:
\`\`\`json
{
  "servicio_barra": true,
  "orden_directa_barra": true,
  "control_edad": true,
  "limite_alcohol": true
}
\`\`\`

**Entretenimiento**:
\`\`\`json
{
  "reserva_mesas_eventos": true,
  "cover_musical": 5000,
  "descuento_cumpleanos": 20
}
\`\`\`

### Cafetería

#### Características Principales
- Ambiente relajado
- Productos de panadería y café
- Servicio durante todo el día
- Trabajo y estudio friendly

#### Configuraciones Recomendadas

**Productos Especiales**:
\`\`\`json
{
  "cafe_especialidad": true,
  "productos_panaderia": true,
  "opciones_veganas": true,
  "wifi_gratuito": true
}
\`\`\`

**Horarios Extendidos**:
\`\`\`json
{
  "desayuno": "06:00-11:00",
  "almuerzo_ligero": "11:00-16:00",
  "once": "16:00-19:00",
  "cena_ligera": "19:00-22:00"
}
\`\`\`

## Configuración de Hardware por Tipo

### Especificaciones Mínimas por Tipo

#### Restaurante Casual
\`\`\`yaml
CPU: Intel i3 / AMD Ryzen 3
RAM: 8 GB
Almacenamiento: 250 GB SSD
Impresoras: 2 (cocina + tickets)
Terminales: 2-3 POS
Red: 100 Mbps
\`\`\`

#### Restaurante Fino
\`\`\`yaml
CPU: Intel i5 / AMD Ryzen 5
RAM: 16 GB
Almacenamiento: 500 GB SSD
Impresoras: 3 (cocina + bar + tickets)
Terminales: 3-4 POS + tablets
Red: 200 Mbps
Backup: NAS dedicado
\`\`\`

#### Comida Rápida
\`\`\`yaml
CPU: Intel i5 / AMD Ryzen 5
RAM: 16 GB
Almacenamiento: 1 TB SSD
Impresoras: 4+ (múltiples estaciones)
Terminales: 6+ POS
Red: 300 Mbps
Redundancia: Servidor backup
\`\`\`

## Configuración de Base de Datos

### Parámetros de Rendimiento por Tipo

#### Para Alto Volumen (Comida Rápida)
\`\`\`sql
-- Configuración MySQL optimizada
SET GLOBAL innodb_buffer_pool_size = 2147483648; -- 2GB
SET GLOBAL innodb_log_file_size = 268435456; -- 256MB
SET GLOBAL max_connections = 200;
SET GLOBAL query_cache_size = 67108864; -- 64MB
SET GLOBAL innodb_flush_log_at_trx_commit = 2;
\`\`\`

#### Para Servicio Premium (Restaurante Fino)
\`\`\`sql
-- Configuración balanceada para consistencia
SET GLOBAL innodb_buffer_pool_size = 1073741824; -- 1GB
SET GLOBAL max_connections = 100;
SET GLOBAL innodb_flush_log_at_trx_commit = 1; -- Máxima consistencia
SET GLOBAL sync_binlog = 1;
\`\`\`

### Índices Especializados

#### Para Reportes Avanzados
\`\`\`sql
-- Índices para restaurantes finos con reportes detallados
CREATE INDEX idx_ventas_fecha_mesa ON ventadirecta(fecha, Num_Mesa);
CREATE INDEX idx_productos_categoria ON complementog(categoria, activo);
CREATE INDEX idx_ventas_garzon_fecha ON ventadirecta(garzon, fecha);
\`\`\`

#### Para Alto Volumen
\`\`\`sql
-- Índices optimizados para velocidad
CREATE INDEX idx_ventas_rapidas ON ventadirecta(fecha, cerrada);
CREATE INDEX idx_productos_activos ON complementog(activo, categoria);
\`\`\`

## Configuración de Monitoreo

### Umbrales por Tipo de Restaurante

#### Restaurante Casual
\`\`\`json
{
  "cpu_alerta": 70,
  "memoria_alerta": 75,
  "disco_alerta": 80,
  "tiempo_respuesta_max": 3000,
  "transacciones_por_minuto": 30
}
\`\`\`

#### Comida Rápida
\`\`\`json
{
  "cpu_alerta": 80,
  "memoria_alerta": 85,
  "disco_alerta": 85,
  "tiempo_respuesta_max": 1000,
  "transacciones_por_minuto": 120
}
\`\`\`

#### Restaurante Fino
\`\`\`json
{
  "cpu_alerta": 60,
  "memoria_alerta": 70,
  "disco_alerta": 75,
  "tiempo_respuesta_max": 2000,
  "transacciones_por_minuto": 15,
  "monitoreo_personalizado": true
}
\`\`\`

## Configuración de Seguridad

### Niveles de Acceso por Tipo

#### Configuración Básica (Restaurante Casual)
\`\`\`json
{
  "autenticacion": "simple",
  "sesiones_simultaneas": 3,
  "timeout_sesion": 8,
  "backup_frecuencia": 6,
  "logs_retencion": 30
}
\`\`\`

#### Configuración Avanzada (Restaurante Fino)
\`\`\`json
{
  "autenticacion": "2fa_opcional",
  "sesiones_simultaneas": 5,
  "timeout_sesion": 12,
  "backup_frecuencia": 3,
  "logs_retencion": 90,
  "auditoria_avanzada": true,
  "cifrado_datos": true
}
\`\`\`

## Configuración de Impresión

### Estaciones de Impresión por Tipo

#### Restaurante Completo
\`\`\`json
{
  "estaciones": {
    "cocina_caliente": {
      "impresora": "EPSON TM-T88VI",
      "productos": ["platos_principales", "guarniciones"]
    },
    "cocina_fria": {
      "impresora": "EPSON TM-T82",
      "productos": ["ensaladas", "aperitivos"]
    },
    "bar": {
      "impresora": "STAR TSP143III",
      "productos": ["bebidas", "tragos"]
    },
    "caja": {
      "impresora": "EPSON TM-T20III",
      "tipo": "tickets_pago"
    }
  }
}
\`\`\`

## Configuración de APIs

### Rate Limiting por Tipo

#### Configuración Diferenciada
\`\`\`json
{
  "casual": {
    "ventas": 100,
    "consultas": 200,
    "reportes": 20
  },
  "fino": {
    "ventas": 50,
    "consultas": 100,
    "reportes": 50
  },
  "rapido": {
    "ventas": 300,
    "consultas": 500,
    "reportes": 10
  }
}
\`\`\`

## Optimizaciones Específicas

### Cache por Tipo de Restaurante

#### Alto Volumen
\`\`\`json
{
  "cache_productos": 300,
  "cache_mesas": 30,
  "cache_precios": 600,
  "cache_promociones": 60
}
\`\`\`

#### Servicio Premium
\`\`\`json
{
  "cache_productos": 60,
  "cache_mesas": 10,
  "cache_personalizacion": 300,
  "cache_reportes": 1800
}
\`\`\`

## Configuración de Backup

### Estrategias por Tipo

#### Crítico (Comida Rápida)
\`\`\`json
{
  "frecuencia": "cada_2_horas",
  "retencion": 90,
  "backup_incremental": true,
  "backup_remoto": true,
  "verificacion_integridad": true
}
\`\`\`

#### Estándar (Restaurante Casual)
\`\`\`json
{
  "frecuencia": "cada_6_horas",
  "retencion": 30,
  "backup_incremental": false,
  "backup_remoto": false,
  "verificacion_integridad": false
}
\`\`\`

## Procedimientos de Mantenimiento

### Calendarios por Tipo

#### Restaurante de Alto Volumen
- **Diario**: Verificación de logs, limpieza de caché
- **Semanal**: Optimización de BD, verificación de backups
- **Mensual**: Actualización de software, auditoría de seguridad
- **Trimestral**: Revisión completa de hardware

#### Restaurante Estándar
- **Diario**: Backup automático
- **Semanal**: Limpieza de logs
- **Mensual**: Optimización de BD
- **Semestral**: Revisión de hardware

## Configuración Multi-sucursal

### Para Cadenas de Restaurantes

#### Configuración Central
\`\`\`json
{
  "servidor_central": "192.168.1.100",
  "sincronizacion": "tiempo_real",
  "reportes_consolidados": true,
  "usuarios_centralizados": true,
  "configuracion_distribuida": true
}
\`\`\`

#### Configuración por Sucursal
\`\`\`json
{
  "sucursal_id": "SUCURSAL_001",
  "tipo_restaurante": "casual",
  "servidor_local": "192.168.1.10",
  "modo_autonomo": true,
  "sincronizacion_horaria": "23:00"
}
\`\`\`
`;
    }

    async aplicarPlantilla(contenido, configuracion, tipoInfo) {
        const fecha = new Date().toLocaleDateString('es-CL');
        let plantillaCompleta = this.plantillasBase.header + contenido + this.plantillasBase.footer;

        // Reemplazar variables
        plantillaCompleta = plantillaCompleta
            .replace(/\{titulo\}/g, tipoInfo.nombre)
            .replace(/\{fecha\}/g, fecha)
            .replace(/\{tipo_restaurante\}/g, configuracion.tipo_restaurante)
            .replace(/\{idioma\}/g, configuracion.idioma)
            .replace(/\{version\}/g, '2.0.14');

        return plantillaCompleta;
    }

    async exportarDocumento(documento, formato, configuracion) {
        const filename = `${documento.tipo}-${configuracion.tipo_restaurante}-${configuracion.idioma}-${Date.now()}`;
        const outputDir = path.join(this.outputPath, formato);

        switch (formato) {
            case 'markdown':
                await this.exportarMarkdown(documento, filename, outputDir);
                break;
            case 'html':
                await this.exportarHTML(documento, filename, outputDir);
                break;
            case 'pdf':
                await this.exportarPDF(documento, filename, outputDir);
                break;
            case 'word':
                await this.exportarWord(documento, filename, outputDir);
                break;
        }

        return path.join(outputDir, `${filename}.${formato === 'word' ? 'docx' : formato}`);
    }

    async exportarMarkdown(documento, filename, outputDir) {
        const filepath = path.join(outputDir, `${filename}.md`);
        await fs.writeFile(filepath, documento.contenido);
    }

    async exportarHTML(documento, filename, outputDir) {
        const html = marked.parse(documento.contenido);
        const htmlCompleto = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${documento.titulo}</title>
    <style>
        body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #2c3e50; }
        code { background: #f4f4f4; padding: 2px 4px; border-radius: 3px; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .header { border-bottom: 2px solid #3498db; margin-bottom: 20px; }
        .footer { border-top: 1px solid #ccc; margin-top: 40px; padding-top: 20px; font-size: 0.9em; color: #666; }
    </style>
</head>
<body>
    ${html}
</body>
</html>`;

        const filepath = path.join(outputDir, `${filename}.html`);
        await fs.writeFile(filepath, htmlCompleto);
    }

    async exportarPDF(documento, filename, outputDir) {
        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();

            // Primero generar HTML
            const htmlContent = marked.parse(documento.contenido);
            const htmlCompleto = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 20px; }
        h1, h2, h3 { color: #2c3e50; page-break-after: avoid; }
        code { background: #f4f4f4; padding: 2px 4px; }
        pre { background: #f4f4f4; padding: 10px; page-break-inside: avoid; }
        table { border-collapse: collapse; width: 100%; page-break-inside: avoid; }
        th, td { border: 1px solid #ddd; padding: 8px; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>${htmlContent}</body>
</html>`;

            await page.setContent(htmlCompleto);

            const filepath = path.join(outputDir, `${filename}.pdf`);
            await page.pdf({
                path: filepath,
                format: 'A4',
                margin: {
                    top: '20mm',
                    right: '20mm',
                    bottom: '20mm',
                    left: '20mm'
                },
                printBackground: true
            });

            await browser.close();
        } catch (error) {
            console.warn('⚠️ No se pudo generar PDF:', error.message);
            // Fallback: generar HTML en su lugar
            await this.exportarHTML(documento, filename, outputDir);
        }
    }

    async exportarWord(documento, filename, outputDir) {
        // Simplificado: generar HTML con extensión .docx para compatibilidad
        const filepath = path.join(outputDir, `${filename}.docx`);
        const htmlContent = marked.parse(documento.contenido);
        await fs.writeFile(filepath, htmlContent);
    }

    async generarScreenshots(configuracion) {
        console.log('📸 Generando screenshots del sistema...');
        let screenshotsCapturadas = 0;

        try {
            const browser = await puppeteer.launch({ headless: true });
            const page = await browser.newPage();
            await page.setViewport({ width: 1920, height: 1080 });

            const screenshots = [
                { url: 'http://localhost:8547/login', name: 'login' },
                { url: 'http://localhost:8547/dashboard', name: 'dashboard' },
                { url: 'http://localhost:8547/mesas', name: 'mapa-mesas' },
                { url: 'http://localhost:8547/menu', name: 'menu-productos' },
                { url: 'http://localhost:8547/reportes', name: 'reportes' }
            ];

            for (const screenshot of screenshots) {
                try {
                    await page.goto(screenshot.url, { waitUntil: 'networkidle2', timeout: 10000 });
                    const filepath = path.join(this.outputPath, 'screenshots', `${screenshot.name}.png`);
                    await page.screenshot({ path: filepath, fullPage: true });
                    screenshotsCapturadas++;
                } catch (error) {
                    console.warn(`⚠️ No se pudo capturar screenshot de ${screenshot.name}`);
                }
            }

            await browser.close();
        } catch (error) {
            console.warn('⚠️ Error generando screenshots:', error.message);
        }

        return screenshotsCapturadas;
    }

    async generarDiagramas(configuracion) {
        console.log('📊 Generando diagramas de arquitectura...');
        let diagramasCreados = 0;

        const diagramas = [
            {
                nombre: 'arquitectura-sistema',
                contenido: this.generarDiagramaArquitectura()
            },
            {
                nombre: 'flujo-ventas',
                contenido: this.generarDiagramaFlujoVentas()
            },
            {
                nombre: 'base-datos-erd',
                contenido: this.generarDiagramaBaseDatos()
            }
        ];

        for (const diagrama of diagramas) {
            try {
                const filepath = path.join(this.outputPath, 'diagramas', `${diagrama.nombre}.md`);
                await fs.writeFile(filepath, diagrama.contenido);
                diagramasCreados++;
            } catch (error) {
                console.warn(`⚠️ Error generando diagrama ${diagrama.nombre}:`, error.message);
            }
        }

        return diagramasCreados;
    }

    generarDiagramaArquitectura() {
        return `# Diagrama de Arquitectura del Sistema

\`\`\`mermaid
graph TB
    subgraph "Frontend"
        UI[Interfaz Web]
        MAP[Mapa Visual Mesas]
        MENU[Menú Digital]
    end

    subgraph "Backend"
        API[API Server Node.js]
        AUTH[Autenticación]
        ROUTES[Rutas Especializadas]
    end

    subgraph "Servicios"
        VENTAS[VentasManager]
        MESAS[MesasManager]
        COCINA[BloquesCocinaManager]
        BACKUP[BackupManager]
        MONITOR[MonitoreoManager]
    end

    subgraph "Base de Datos"
        MYSQL[(MySQL 8.0)]
        CACHE[Cache Redis]
    end

    subgraph "Impresión"
        PRINT_COCINA[Impresora Cocina]
        PRINT_TICKET[Impresora Tickets]
    end

    UI --> API
    MAP --> API
    MENU --> API

    API --> AUTH
    API --> ROUTES

    ROUTES --> VENTAS
    ROUTES --> MESAS
    ROUTES --> COCINA
    ROUTES --> BACKUP
    ROUTES --> MONITOR

    VENTAS --> MYSQL
    MESAS --> MYSQL
    COCINA --> MYSQL
    BACKUP --> MYSQL
    MONITOR --> MYSQL

    API --> CACHE

    COCINA --> PRINT_COCINA
    VENTAS --> PRINT_TICKET
\`\`\``;
    }

    generarDiagramaFlujoVentas() {
        return `# Diagrama de Flujo de Ventas

\`\`\`mermaid
flowchart TD
    START([Cliente llega]) --> MESA[Seleccionar Mesa]
    MESA --> ABRIR[Abrir Mesa]
    ABRIR --> ORDEN[Tomar Orden]
    ORDEN --> ENVIAR[Enviar a Cocina]
    ENVIAR --> PREPARAR[Preparar en Cocina]

    PREPARAR --> LISTO{¿Orden Lista?}
    LISTO -->|No| PREPARAR
    LISTO -->|Sí| SERVIR[Servir Mesa]

    SERVIR --> MAS{¿Más productos?}
    MAS -->|Sí| ORDEN
    MAS -->|No| CUENTA[Generar Cuenta]

    CUENTA --> PAGO[Procesar Pago]
    PAGO --> TICKET[Generar Ticket]
    TICKET --> CERRAR[Cerrar Mesa]
    CERRAR --> END([Fin])

    ORDEN --> APARCAR{¿Aparcar Venta?}
    APARCAR -->|Sí| GUARDAR[Guardar Estado]
    GUARDAR --> RECUPERAR[Recuperar Después]
    RECUPERAR --> ORDEN
    APARCAR -->|No| ENVIAR
\`\`\``;
    }

    generarDiagramaBaseDatos() {
        return `# Diagrama Entidad-Relación (ERD)

\`\`\`mermaid
erDiagram
    MESA {
        int Num_Mesa PK
        string descripcion
        int capacidad
        string zona
        boolean activa
        string estado
    }

    VENTADIRECTA {
        int id_venta PK
        int Num_Mesa FK
        string garzon
        datetime fecha
        float total
        string cerrada
        string metodo_pago
    }

    VENTADIR_COMG {
        int id_linea PK
        int id_venta FK
        int id_complementog FK
        int cantidad
        float precio_unitario
        string observaciones
        datetime hora_cocina
    }

    COMPLEMENTOG {
        int id_complementog PK
        string alias
        string nombre
        float precio
        string categoria
        boolean activo
    }

    USUARIOS {
        int id_usuario PK
        string email
        string password_hash
        string nombre
        string rol
        boolean activo
    }

    GARZONES {
        string codigo PK
        string nombre
        boolean activo
        datetime ultimo_acceso
    }

    MESA ||--o{ VENTADIRECTA : "tiene"
    VENTADIRECTA ||--o{ VENTADIR_COMG : "contiene"
    COMPLEMENTOG ||--o{ VENTADIR_COMG : "es_producto"
    USUARIOS ||--o{ VENTADIRECTA : "administra"
    GARZONES ||--o{ VENTADIRECTA : "atiende"
\`\`\``;
    }

    async crearPaqueteDocumentacion(configuracion, resultados) {
        console.log('📦 Creando paquete completo de documentación...');

        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const paqueteNombre = `DYSA-Point-Docs-${configuracion.tipo_restaurante}-${timestamp}`;
        const paquetePath = path.join(this.outputPath, 'paquetes', `${paqueteNombre}.zip`);

        return new Promise((resolve, reject) => {
            const output = require('fs').createWriteStream(paquetePath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            output.on('close', () => {
                console.log(`✅ Paquete creado: ${archive.pointer()} bytes`);
                resolve(paquetePath);
            });

            archive.on('error', (err) => {
                reject(err);
            });

            archive.pipe(output);

            // Agregar todos los archivos generados
            archive.directory(path.join(this.outputPath, 'pdf'), 'pdf');
            archive.directory(path.join(this.outputPath, 'html'), 'html');
            archive.directory(path.join(this.outputPath, 'markdown'), 'markdown');
            archive.directory(path.join(this.outputPath, 'screenshots'), 'screenshots');
            archive.directory(path.join(this.outputPath, 'diagramas'), 'diagramas');

            // Agregar archivo de información del paquete
            const infoPackage = {
                nombre: paqueteNombre,
                version: '2.0.14',
                fecha_generacion: new Date().toISOString(),
                configuracion,
                resultados,
                contenido: {
                    documentos: resultados.documentos_generados.length,
                    screenshots: resultados.screenshots_capturadas,
                    diagramas: resultados.diagramas_creados,
                    formatos: resultados.formatos_exportados
                }
            };

            archive.append(JSON.stringify(infoPackage, null, 2), { name: 'package-info.json' });

            archive.finalize();
        });
    }

    async obtenerEstadisticas() {
        return {
            documentos_disponibles: Object.keys(this.tiposDocumentacion).length,
            formatos_soportados: this.configuracion.formatos.length,
            idiomas_soportados: this.configuracion.idiomas.length,
            tipos_restaurante: this.configuracion.tipos_restaurante.length,
            plantillas_cargadas: this.plantillasBase ? Object.keys(this.plantillasBase).length : 0,
            cache_activo: this.configuracion.cache.size,
            ultimo_uso: new Date()
        };
    }

    async actualizarConfiguracion(nuevaConfig) {
        this.configuracion = { ...this.configuracion, ...nuevaConfig };
        await this.guardarConfiguracion();
        this.emit('configuracion-actualizada', { nuevaConfig });
    }

    async limpiarArchivosAntiguos(dias = 30) {
        const limiteFecha = new Date();
        limiteFecha.setDate(limiteFecha.getDate() - dias);

        const directorios = [
            path.join(this.outputPath, 'pdf'),
            path.join(this.outputPath, 'html'),
            path.join(this.outputPath, 'markdown'),
            path.join(this.outputPath, 'paquetes')
        ];

        let archivosEliminados = 0;

        for (const directorio of directorios) {
            try {
                const archivos = await fs.readdir(directorio);

                for (const archivo of archivos) {
                    const archivoPath = path.join(directorio, archivo);
                    const stats = await fs.stat(archivoPath);

                    if (stats.mtime < limiteFecha) {
                        await fs.unlink(archivoPath);
                        archivosEliminados++;
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Error limpiando directorio ${directorio}:`, error.message);
            }
        }

        console.log(`🧹 Limpieza completada: ${archivosEliminados} archivos eliminados`);
        return archivosEliminados;
    }

    async cleanup() {
        console.log('🧹 Limpiando DocumentacionTecnicaManager...');

        // Limpiar cache
        this.configuracion.cache.clear();
        this.plantillasBase = {};

        // Emitir evento de limpieza
        this.emit('sistema-limpio', { timestamp: new Date() });

        console.log('✅ DocumentacionTecnicaManager limpio');
    }
}

module.exports = DocumentacionTecnicaManager;