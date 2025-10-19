/**
 * Rutas para interfaz web de administración simple
 * Conexión directa a base de datos sin dependencias complejas
 */

const express = require('express');
const path = require('path');

class WebAdminRoutes {
    constructor(database) {
        this.database = database;
        this.router = express.Router();
        this.setupRoutes();
    }

    setupRoutes() {
        // Ruta principal de admin
        this.router.get('/', (req, res) => {
            res.send(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>DYSA Point - Administración</title>
                    <style>
                        body {
                            font-family: Arial, sans-serif;
                            margin: 0;
                            padding: 20px;
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                            color: white;
                            min-height: 100vh;
                        }
                        .container {
                            max-width: 1200px;
                            margin: 0 auto;
                            background: rgba(255, 255, 255, 0.1);
                            border-radius: 15px;
                            padding: 30px;
                            backdrop-filter: blur(10px);
                        }
                        .header {
                            text-align: center;
                            margin-bottom: 40px;
                        }
                        .header h1 {
                            margin: 0;
                            font-size: 2.5em;
                            text-shadow: 0 2px 4px rgba(0,0,0,0.3);
                        }
                        .modules {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                            gap: 20px;
                            margin-top: 30px;
                        }
                        .module {
                            background: rgba(255, 255, 255, 0.2);
                            border-radius: 10px;
                            padding: 25px;
                            cursor: pointer;
                            transition: all 0.3s;
                            border: 1px solid rgba(255, 255, 255, 0.2);
                        }
                        .module:hover {
                            transform: translateY(-5px);
                            background: rgba(255, 255, 255, 0.3);
                            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                        }
                        .module-icon {
                            font-size: 3em;
                            text-align: center;
                            margin-bottom: 15px;
                        }
                        .module-title {
                            font-size: 1.5em;
                            font-weight: bold;
                            text-align: center;
                            margin-bottom: 10px;
                        }
                        .module-desc {
                            text-align: center;
                            opacity: 0.9;
                            font-size: 0.9em;
                        }
                        .status {
                            background: rgba(0, 0, 0, 0.3);
                            border-radius: 10px;
                            padding: 20px;
                            margin-bottom: 30px;
                        }
                        .status-grid {
                            display: grid;
                            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                            gap: 20px;
                        }
                        .status-item {
                            text-align: center;
                        }
                        .status-value {
                            font-size: 2em;
                            font-weight: bold;
                            color: #4CAF50;
                        }
                        .status-label {
                            font-size: 0.9em;
                            opacity: 0.8;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <h1>🍽️ DYSA Point - Administración</h1>
                            <p>Sistema POS Profesional para Restaurantes</p>
                        </div>

                        <div class="status" id="systemStatus">
                            <h3>📊 Estado del Sistema</h3>
                            <div class="status-grid">
                                <div class="status-item">
                                    <div class="status-value" id="serverStatus">🟢</div>
                                    <div class="status-label">Servidor</div>
                                </div>
                                <div class="status-item">
                                    <div class="status-value" id="dbStatus">🟢</div>
                                    <div class="status-label">Base de Datos</div>
                                </div>
                                <div class="status-item">
                                    <div class="status-value" id="mesasCount">0</div>
                                    <div class="status-label">Mesas</div>
                                </div>
                                <div class="status-item">
                                    <div class="status-value" id="productosCount">0</div>
                                    <div class="status-label">Productos</div>
                                </div>
                            </div>
                        </div>

                        <div class="modules">
                            <div class="module" onclick="window.open('/web-admin/ventas', '_blank')">
                                <div class="module-icon">💰</div>
                                <div class="module-title">Punto de Venta</div>
                                <div class="module-desc">Procesar ventas y pagos del restaurante</div>
                            </div>

                            <div class="module" onclick="window.open('/web-admin/mesas', '_blank')">
                                <div class="module-icon">🪑</div>
                                <div class="module-title">Gestión de Mesas</div>
                                <div class="module-desc">Estado y control de mesas en tiempo real</div>
                            </div>

                            <div class="module" onclick="window.open('/web-admin/productos', '_blank')">
                                <div class="module-icon">🍕</div>
                                <div class="module-title">Productos y Menú</div>
                                <div class="module-desc">Gestionar carta, precios y categorías</div>
                            </div>

                            <div class="module" onclick="window.open('/web-admin/empleados', '_blank')">
                                <div class="module-icon">👥</div>
                                <div class="module-title">Empleados</div>
                                <div class="module-desc">Gestión de personal y permisos</div>
                            </div>

                            <div class="module" onclick="window.open('/web-admin/reportes', '_blank')">
                                <div class="module-icon">📈</div>
                                <div class="module-title">Reportes</div>
                                <div class="module-desc">Estadísticas y análisis de ventas</div>
                            </div>

                            <div class="module" onclick="window.open('/web-admin/configuracion', '_blank')">
                                <div class="module-icon">⚙️</div>
                                <div class="module-title">Configuración</div>
                                <div class="module-desc">Ajustes del sistema y configuración</div>
                            </div>
                        </div>
                    </div>

                    <script>
                        // Cargar estado del sistema
                        async function loadSystemStatus() {
                            try {
                                // Verificar estado del servidor
                                const healthResponse = await fetch('/health');
                                const healthData = await healthResponse.json();

                                if (healthData.status === 'OK') {
                                    document.getElementById('serverStatus').textContent = '🟢';
                                    document.getElementById('dbStatus').textContent = '🟢';
                                }

                                // Cargar estadísticas básicas
                                const mesasResponse = await fetch('/web-admin/api/mesas-count');
                                if (mesasResponse.ok) {
                                    const mesasData = await mesasResponse.json();
                                    document.getElementById('mesasCount').textContent = mesasData.count || 0;
                                }

                                const productosResponse = await fetch('/web-admin/api/productos-count');
                                if (productosResponse.ok) {
                                    const productosData = await productosResponse.json();
                                    document.getElementById('productosCount').textContent = productosData.count || 0;
                                }

                            } catch (error) {
                                console.error('Error cargando estado:', error);
                                document.getElementById('serverStatus').textContent = '🔴';
                                document.getElementById('dbStatus').textContent = '🔴';
                            }
                        }

                        // Cargar estado al iniciar
                        loadSystemStatus();

                        // Actualizar cada 30 segundos
                        setInterval(loadSystemStatus, 30000);
                    </script>
                </body>
                </html>
            `);
        });

        // APIs básicas para datos del sistema
        this.router.get('/api/mesas-count', async (req, res) => {
            try {
                const [rows] = await this.database.connection.execute('SELECT COUNT(*) as count FROM mesa WHERE activa = true');
                res.json({ success: true, count: rows[0].count });
            } catch (error) {
                res.json({ success: false, count: 0, error: error.message });
            }
        });

        this.router.get('/api/productos-count', async (req, res) => {
            try {
                const [rows] = await this.database.connection.execute('SELECT COUNT(*) as count FROM complementog WHERE activo = "S"');
                res.json({ success: true, count: rows[0].count });
            } catch (error) {
                res.json({ success: false, count: 0, error: error.message });
            }
        });

        // Módulo de Ventas
        this.router.get('/ventas', (req, res) => {
            res.send(this.getVentasInterface());
        });

        // Módulo de Mesas
        this.router.get('/mesas', (req, res) => {
            res.send(this.getMesasInterface());
        });

        // Módulo de Productos
        this.router.get('/productos', (req, res) => {
            res.send(this.getProductosInterface());
        });

        // API para mesas
        this.router.get('/api/mesas', async (req, res) => {
            try {
                const [rows] = await this.database.connection.execute(`
                    SELECT
                        m.Num_Mesa as numero,
                        m.descripcion,
                        m.capacidad,
                        m.zona,
                        m.activa,
                        CASE
                            WHEN v.id_venta IS NOT NULL AND v.cerrada = 'N' THEN 'ocupada'
                            ELSE 'libre'
                        END as estado,
                        v.id_venta,
                        v.total
                    FROM mesa m
                    LEFT JOIN ventadirecta v ON m.Num_Mesa = v.Num_Mesa AND v.cerrada = 'N'
                    WHERE m.activa = true
                    ORDER BY m.Num_Mesa
                `);

                res.json({ success: true, mesas: rows });
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });

        // API para productos
        this.router.get('/api/productos', async (req, res) => {
            try {
                const [rows] = await this.database.connection.execute(`
                    SELECT
                        c.id_complementog as id,
                        c.alias as nombre,
                        c.descripcion,
                        c.precio,
                        c.activo,
                        t.alias as categoria
                    FROM complementog c
                    LEFT JOIN tipo_comg t ON c.id_tipo_comg = t.id_tipo_comg
                    WHERE c.activo = 'S'
                    ORDER BY t.alias, c.alias
                `);

                res.json({ success: true, productos: rows });
            } catch (error) {
                res.json({ success: false, error: error.message });
            }
        });
    }

    getVentasInterface() {
        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>DYSA Point - Punto de Venta</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: linear-gradient(135deg, #27ae60 0%, #2ecc71 100%);
                        color: white;
                        min-height: 100vh;
                    }
                    .container {
                        max-width: 1400px;
                        margin: 0 auto;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 15px;
                        padding: 30px;
                        backdrop-filter: blur(10px);
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 30px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                        padding-bottom: 20px;
                    }
                    .pos-grid {
                        display: grid;
                        grid-template-columns: 1fr 400px;
                        gap: 30px;
                        min-height: 600px;
                    }
                    .productos-section {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        padding: 20px;
                    }
                    .carrito-section {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        padding: 20px;
                    }
                    .producto-card {
                        background: rgba(255, 255, 255, 0.2);
                        border-radius: 8px;
                        padding: 15px;
                        margin-bottom: 10px;
                        cursor: pointer;
                        transition: all 0.3s;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                    }
                    .producto-card:hover {
                        background: rgba(255, 255, 255, 0.3);
                        transform: translateY(-2px);
                    }
                    .btn {
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: all 0.3s;
                    }
                    .btn:hover {
                        background: rgba(255, 255, 255, 0.3);
                    }
                    .btn-primary {
                        background: #3498db;
                        border-color: #3498db;
                    }
                    .btn-success {
                        background: #27ae60;
                        border-color: #27ae60;
                    }
                    .loading {
                        text-align: center;
                        padding: 40px;
                    }
                    .carrito-item {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 5px;
                        margin-bottom: 10px;
                    }
                    .total-section {
                        border-top: 2px solid rgba(255, 255, 255, 0.3);
                        padding-top: 20px;
                        margin-top: 20px;
                    }
                    .total-amount {
                        font-size: 1.5em;
                        font-weight: bold;
                        text-align: center;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>💰 Punto de Venta DYSA Point</h1>
                        <div>
                            <button class="btn" onclick="window.close()">Cerrar</button>
                        </div>
                    </div>

                    <div class="pos-grid">
                        <div class="productos-section">
                            <h3>🍕 Productos Disponibles</h3>
                            <div id="productosContainer" class="loading">
                                Cargando productos...
                            </div>
                        </div>

                        <div class="carrito-section">
                            <h3>🛒 Carrito de Compras</h3>
                            <div id="carritoItems">
                                <p style="text-align: center; opacity: 0.7;">Carrito vacío</p>
                            </div>

                            <div class="total-section">
                                <div class="total-amount" id="totalAmount">Total: $0</div>
                                <button class="btn btn-success" style="width: 100%; margin-top: 15px;" onclick="procesarVenta()">
                                    Procesar Venta
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <script>
                    let carrito = [];
                    let productos = [];
                    let total = 0;

                    async function cargarProductos() {
                        try {
                            const response = await fetch('/web-admin/api/productos');
                            const data = await response.json();

                            if (data.success) {
                                productos = data.productos;
                                mostrarProductos();
                            } else {
                                document.getElementById('productosContainer').innerHTML =
                                    '<p>Error cargando productos: ' + data.error + '</p>';
                            }
                        } catch (error) {
                            document.getElementById('productosContainer').innerHTML =
                                '<p>Error de conexión al cargar productos</p>';
                        }
                    }

                    function mostrarProductos() {
                        const container = document.getElementById('productosContainer');
                        let html = '';

                        productos.forEach(producto => {
                            html += \`
                                <div class="producto-card" onclick="agregarAlCarrito(\${producto.id})">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <strong>\${producto.nombre}</strong>
                                            <div style="opacity: 0.8; font-size: 0.9em;">\${producto.categoria || 'Sin categoría'}</div>
                                        </div>
                                        <div style="font-weight: bold; font-size: 1.1em;">
                                            $\${parseInt(producto.precio).toLocaleString('es-CL')}
                                        </div>
                                    </div>
                                </div>
                            \`;
                        });

                        container.innerHTML = html;
                    }

                    function agregarAlCarrito(productoId) {
                        const producto = productos.find(p => p.id == productoId);
                        if (!producto) return;

                        const itemExistente = carrito.find(item => item.id == productoId);

                        if (itemExistente) {
                            itemExistente.cantidad++;
                        } else {
                            carrito.push({
                                id: producto.id,
                                nombre: producto.nombre,
                                precio: parseInt(producto.precio),
                                cantidad: 1
                            });
                        }

                        actualizarCarrito();
                    }

                    function actualizarCarrito() {
                        const container = document.getElementById('carritoItems');
                        let html = '';
                        total = 0;

                        if (carrito.length === 0) {
                            html = '<p style="text-align: center; opacity: 0.7;">Carrito vacío</p>';
                        } else {
                            carrito.forEach((item, index) => {
                                const subtotal = item.precio * item.cantidad;
                                total += subtotal;

                                html += \`
                                    <div class="carrito-item">
                                        <div>
                                            <strong>\${item.nombre}</strong><br>
                                            <small>$\${item.precio.toLocaleString('es-CL')} x \${item.cantidad}</small>
                                        </div>
                                        <div style="text-align: right;">
                                            <div style="font-weight: bold;">$\${subtotal.toLocaleString('es-CL')}</div>
                                            <button class="btn" style="padding: 5px 10px; font-size: 0.8em;" onclick="quitarDelCarrito(\${index})">
                                                Quitar
                                            </button>
                                        </div>
                                    </div>
                                \`;
                            });
                        }

                        container.innerHTML = html;
                        document.getElementById('totalAmount').textContent = \`Total: $\${total.toLocaleString('es-CL')}\`;
                    }

                    function quitarDelCarrito(index) {
                        carrito.splice(index, 1);
                        actualizarCarrito();
                    }

                    function procesarVenta() {
                        if (carrito.length === 0) {
                            alert('El carrito está vacío');
                            return;
                        }

                        alert(\`Venta procesada por $\${total.toLocaleString('es-CL')}\\n\\nEsta es una demostración del sistema POS.\`);
                        carrito = [];
                        actualizarCarrito();
                    }

                    // Inicializar
                    cargarProductos();
                </script>
            </body>
            </html>
        `;
    }

    getMesasInterface() {
        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>DYSA Point - Gestión de Mesas</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: linear-gradient(135deg, #1abc9c 0%, #48c9b0 100%);
                        color: white;
                        min-height: 100vh;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 15px;
                        padding: 30px;
                        backdrop-filter: blur(10px);
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 30px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                        padding-bottom: 20px;
                    }
                    .mesas-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
                        gap: 20px;
                    }
                    .mesa-card {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        padding: 20px;
                        text-align: center;
                        transition: all 0.3s;
                        border: 2px solid transparent;
                    }
                    .mesa-libre {
                        border-color: #27ae60;
                        background: rgba(39, 174, 96, 0.2);
                    }
                    .mesa-ocupada {
                        border-color: #e74c3c;
                        background: rgba(231, 76, 60, 0.2);
                    }
                    .mesa-card:hover {
                        transform: translateY(-5px);
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                    }
                    .mesa-numero {
                        font-size: 2em;
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    .mesa-estado {
                        font-size: 1.2em;
                        margin-bottom: 10px;
                    }
                    .mesa-info {
                        font-size: 0.9em;
                        opacity: 0.8;
                    }
                    .estado-libre {
                        color: #27ae60;
                    }
                    .estado-ocupada {
                        color: #e74c3c;
                    }
                    .btn {
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: all 0.3s;
                    }
                    .btn:hover {
                        background: rgba(255, 255, 255, 0.3);
                    }
                    .loading {
                        text-align: center;
                        padding: 40px;
                        font-size: 1.2em;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🪑 Gestión de Mesas DYSA Point</h1>
                        <div>
                            <button class="btn" onclick="cargarMesas()">🔄 Actualizar</button>
                            <button class="btn" onclick="window.close()">Cerrar</button>
                        </div>
                    </div>

                    <div id="mesasContainer" class="loading">
                        Cargando estado de mesas...
                    </div>
                </div>

                <script>
                    let mesas = [];

                    async function cargarMesas() {
                        try {
                            document.getElementById('mesasContainer').innerHTML =
                                '<div class="loading">Actualizando estado de mesas...</div>';

                            const response = await fetch('/web-admin/api/mesas');
                            const data = await response.json();

                            if (data.success) {
                                mesas = data.mesas;
                                mostrarMesas();
                            } else {
                                document.getElementById('mesasContainer').innerHTML =
                                    '<div class="loading">Error cargando mesas: ' + data.error + '</div>';
                            }
                        } catch (error) {
                            document.getElementById('mesasContainer').innerHTML =
                                '<div class="loading">Error de conexión al cargar mesas</div>';
                        }
                    }

                    function mostrarMesas() {
                        const container = document.getElementById('mesasContainer');
                        let html = '<div class="mesas-grid">';

                        mesas.forEach(mesa => {
                            const estadoClass = mesa.estado === 'libre' ? 'mesa-libre' : 'mesa-ocupada';
                            const estadoText = mesa.estado === 'libre' ? 'LIBRE' : 'OCUPADA';
                            const estadoColor = mesa.estado === 'libre' ? 'estado-libre' : 'estado-ocupada';

                            html += \`
                                <div class="mesa-card \${estadoClass}">
                                    <div class="mesa-numero">Mesa \${mesa.numero}</div>
                                    <div class="mesa-estado \${estadoColor}">\${estadoText}</div>
                                    <div class="mesa-info">
                                        <div><strong>Capacidad:</strong> \${mesa.capacidad || 'N/A'} personas</div>
                                        <div><strong>Zona:</strong> \${mesa.zona || 'Principal'}</div>
                                        \${mesa.descripcion ? \`<div><strong>Descripción:</strong> \${mesa.descripcion}</div>\` : ''}
                                        \${mesa.total ? \`<div style="margin-top: 10px;"><strong>Total cuenta:</strong> $\${parseInt(mesa.total).toLocaleString('es-CL')}</div>\` : ''}
                                    </div>
                                </div>
                            \`;
                        });

                        html += '</div>';
                        container.innerHTML = html;
                    }

                    // Inicializar
                    cargarMesas();

                    // Actualizar cada 30 segundos
                    setInterval(cargarMesas, 30000);
                </script>
            </body>
            </html>
        `;
    }

    getProductosInterface() {
        return `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>DYSA Point - Gestión de Productos</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 0;
                        padding: 20px;
                        background: linear-gradient(135deg, #3498db 0%, #5dade2 100%);
                        color: white;
                        min-height: 100vh;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 15px;
                        padding: 30px;
                        backdrop-filter: blur(10px);
                    }
                    .header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 30px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
                        padding-bottom: 20px;
                    }
                    .productos-grid {
                        display: grid;
                        grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                        gap: 20px;
                    }
                    .producto-card {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        padding: 20px;
                        transition: all 0.3s;
                        border: 1px solid rgba(255, 255, 255, 0.2);
                    }
                    .producto-card:hover {
                        background: rgba(255, 255, 255, 0.2);
                        transform: translateY(-2px);
                    }
                    .producto-nombre {
                        font-size: 1.3em;
                        font-weight: bold;
                        margin-bottom: 10px;
                    }
                    .producto-categoria {
                        color: #f39c12;
                        font-size: 0.9em;
                        margin-bottom: 10px;
                    }
                    .producto-precio {
                        font-size: 1.5em;
                        font-weight: bold;
                        color: #27ae60;
                        text-align: right;
                    }
                    .btn {
                        background: rgba(255, 255, 255, 0.2);
                        color: white;
                        border: 1px solid rgba(255, 255, 255, 0.3);
                        padding: 10px 20px;
                        border-radius: 5px;
                        cursor: pointer;
                        transition: all 0.3s;
                    }
                    .btn:hover {
                        background: rgba(255, 255, 255, 0.3);
                    }
                    .loading {
                        text-align: center;
                        padding: 40px;
                        font-size: 1.2em;
                    }
                    .stats {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                        gap: 20px;
                        margin-bottom: 30px;
                    }
                    .stat-card {
                        background: rgba(255, 255, 255, 0.1);
                        border-radius: 10px;
                        padding: 20px;
                        text-align: center;
                    }
                    .stat-value {
                        font-size: 2em;
                        font-weight: bold;
                        color: #f39c12;
                    }
                    .stat-label {
                        opacity: 0.8;
                        margin-top: 5px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>🍕 Gestión de Productos DYSA Point</h1>
                        <div>
                            <button class="btn" onclick="cargarProductos()">🔄 Actualizar</button>
                            <button class="btn" onclick="window.close()">Cerrar</button>
                        </div>
                    </div>

                    <div class="stats" id="statsContainer">
                        <div class="stat-card">
                            <div class="stat-value" id="totalProductos">0</div>
                            <div class="stat-label">Total Productos</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="totalCategorias">0</div>
                            <div class="stat-label">Categorías</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="promedioPrecios">$0</div>
                            <div class="stat-label">Precio Promedio</div>
                        </div>
                    </div>

                    <div id="productosContainer" class="loading">
                        Cargando productos...
                    </div>
                </div>

                <script>
                    let productos = [];

                    async function cargarProductos() {
                        try {
                            document.getElementById('productosContainer').innerHTML =
                                '<div class="loading">Actualizando catálogo de productos...</div>';

                            const response = await fetch('/web-admin/api/productos');
                            const data = await response.json();

                            if (data.success) {
                                productos = data.productos;
                                mostrarProductos();
                                actualizarEstadisticas();
                            } else {
                                document.getElementById('productosContainer').innerHTML =
                                    '<div class="loading">Error cargando productos: ' + data.error + '</div>';
                            }
                        } catch (error) {
                            document.getElementById('productosContainer').innerHTML =
                                '<div class="loading">Error de conexión al cargar productos</div>';
                        }
                    }

                    function mostrarProductos() {
                        const container = document.getElementById('productosContainer');
                        let html = '<div class="productos-grid">';

                        productos.forEach(producto => {
                            html += \`
                                <div class="producto-card">
                                    <div class="producto-nombre">\${producto.nombre}</div>
                                    <div class="producto-categoria">\${producto.categoria || 'Sin categoría'}</div>
                                    \${producto.descripcion ? \`<div style="opacity: 0.8; margin-bottom: 15px;">\${producto.descripcion}</div>\` : ''}
                                    <div class="producto-precio">$\${parseInt(producto.precio).toLocaleString('es-CL')}</div>
                                </div>
                            \`;
                        });

                        html += '</div>';
                        container.innerHTML = html;
                    }

                    function actualizarEstadisticas() {
                        const totalProductos = productos.length;
                        const categorias = [...new Set(productos.map(p => p.categoria).filter(c => c))];
                        const precios = productos.map(p => parseInt(p.precio)).filter(p => p > 0);
                        const promedioPrecios = precios.length > 0 ? Math.round(precios.reduce((a, b) => a + b, 0) / precios.length) : 0;

                        document.getElementById('totalProductos').textContent = totalProductos;
                        document.getElementById('totalCategorias').textContent = categorias.length;
                        document.getElementById('promedioPrecios').textContent = '$' + promedioPrecios.toLocaleString('es-CL');
                    }

                    // Inicializar
                    cargarProductos();
                </script>
            </body>
            </html>
        `;
    }

    getRouter() {
        return this.router;
    }
}

module.exports = WebAdminRoutes;