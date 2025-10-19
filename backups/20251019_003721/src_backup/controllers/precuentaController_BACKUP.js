// Controlador de Precuenta y Propinas
const { pool } = require('../config/database');

// Generar precuenta
async function generarPrecuenta(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_venta, id_camarero, num_personas, propina_personalizada, id_usuario } = req.body;

        // VALIDAR PERMISO: Solo cajeros, administradores y gerentes pueden generar precuenta
        if (id_usuario) {
            const [permiso] = await connection.query(
                'SELECT puede_generar_precuenta(?) as puede',
                [id_usuario]
            );

            if (permiso[0].puede !== 'Y') {
                await connection.rollback();
                return res.status(403).json({
                    success: false,
                    error: 'No tiene permisos para generar precuenta. Solo personal de caja puede realizar esta acción.'
                });
            }
        }

        // Obtener datos de la venta
        const [venta] = await connection.query(`
            SELECT v.*, m.descripcion as mesa_descripcion, c.nombre as camarero
            FROM ventadirecta v
            INNER JOIN mesa m ON v.Num_Mesa = m.Num_Mesa
            INNER JOIN camareros c ON v.id_camarero = c.id_camarero
            WHERE v.id_venta = ?
        `, [id_venta]);

        if (venta.length === 0) {
            return res.status(404).json({ success: false, error: 'Venta no encontrada' });
        }

        // Obtener productos de la venta
        const [productos] = await connection.query(`
            SELECT
                vc.*,
                c.alias as producto_nombre,
                c.precio as precio_unitario
            FROM ventadir_comg vc
            INNER JOIN complementog c ON vc.id_complementog = c.id_complementog
            WHERE vc.id_venta = ?
        `, [id_venta]);

        // Calcular totales
        const subtotal = parseFloat(venta[0].total) || 0;

        // Obtener configuración de propina
        const [configPropina] = await connection.query(
            "SELECT valor FROM configuracion WHERE clave = 'propina_porcentaje'"
        );
        const porcentaje_default = parseFloat(configPropina[0]?.valor || 10);

        const propina_porcentaje = propina_personalizada !== undefined
            ? parseFloat(propina_personalizada)
            : porcentaje_default;

        const propina_monto = (subtotal * propina_porcentaje) / 100;
        const total = subtotal + propina_monto;

        // Generar número de precuenta
        const fecha_hoy = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const numero_precuenta = `PRE${fecha_hoy}-${id_venta}`;

        // Verificar si ya existe precuenta
        const [precuentaExistente] = await connection.query(
            'SELECT * FROM precuentas WHERE id_venta = ?',
            [id_venta]
        );

        let id_precuenta;

        if (precuentaExistente.length > 0) {
            // Actualizar precuenta existente
            id_precuenta = precuentaExistente[0].id_precuenta;
            await connection.query(`
                UPDATE precuentas SET
                    subtotal = ?,
                    propina_porcentaje = ?,
                    propina_monto = ?,
                    total = ?,
                    num_personas = ?
                WHERE id_precuenta = ?
            `, [subtotal, propina_porcentaje, propina_monto, total, num_personas, id_precuenta]);
        } else {
            // Crear nueva precuenta
            const [result] = await connection.query(`
                INSERT INTO precuentas
                (id_venta, numero_precuenta, subtotal, propina_porcentaje, propina_monto, total, num_personas, id_camarero)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [id_venta, numero_precuenta, subtotal, propina_porcentaje, propina_monto, total, num_personas, id_camarero]);

            id_precuenta = result.insertId;
        }

        await connection.commit();

        res.json({
            success: true,
            precuenta: {
                id_precuenta,
                numero_precuenta,
                venta: venta[0],
                productos,
                subtotal,
                propina_porcentaje,
                propina_monto,
                total,
                num_personas
            }
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al generar precuenta:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Obtener precuenta de una venta
async function obtenerPrecuenta(req, res) {
    try {
        const { id_venta } = req.params;

        const [precuenta] = await pool.query(`
            SELECT
                p.*,
                v.Num_Mesa,
                m.descripcion as mesa_descripcion,
                c.nombre as camarero
            FROM precuentas p
            INNER JOIN ventadirecta v ON p.id_venta = v.id_venta
            INNER JOIN mesa m ON v.Num_Mesa = m.Num_Mesa
            INNER JOIN camareros c ON p.id_camarero = c.id_camarero
            WHERE p.id_venta = ?
        `, [id_venta]);

        if (precuenta.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Precuenta no encontrada'
            });
        }

        // Obtener productos
        const [productos] = await pool.query(`
            SELECT
                vc.*,
                c.alias as producto_nombre
            FROM ventadir_comg vc
            INNER JOIN complementog c ON vc.id_complementog = c.id_complementog
            WHERE vc.id_venta = ?
        `, [id_venta]);

        res.json({
            success: true,
            precuenta: precuenta[0],
            productos
        });

    } catch (error) {
        console.error('Error al obtener precuenta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Marcar precuenta como impresa
async function marcarPrecuentaImpresa(req, res) {
    try {
        const { id_precuenta } = req.body;

        await pool.query(`
            UPDATE precuentas
            SET impresa = true, fecha_impresion = NOW()
            WHERE id_precuenta = ?
        `, [id_precuenta]);

        res.json({
            success: true,
            message: 'Precuenta marcada como impresa'
        });

    } catch (error) {
        console.error('Error al marcar precuenta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Registrar propina distribuida
async function registrarPropina(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            id_venta,
            id_camarero,
            monto_propina,
            forma_pago
        } = req.body;

        const fecha_venta = new Date().toISOString().split('T')[0];

        await connection.query(`
            INSERT INTO propinas_distribuidas
            (id_venta, id_camarero, monto_propina, fecha_venta, forma_pago)
            VALUES (?, ?, ?, ?, ?)
        `, [id_venta, id_camarero, monto_propina, fecha_venta, forma_pago]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Propina registrada exitosamente'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al registrar propina:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Obtener propinas del día por garzón
async function obtenerPropinasDelDia(req, res) {
    try {
        const { id_camarero } = req.params;
        const fecha_hoy = new Date().toISOString().split('T')[0];

        const [propinas] = await pool.query(`
            SELECT
                COUNT(DISTINCT id_venta) as numero_ventas,
                SUM(monto_propina) as total_propinas,
                SUM(CASE WHEN entregada = true THEN monto_propina ELSE 0 END) as propinas_entregadas,
                SUM(CASE WHEN entregada = false THEN monto_propina ELSE 0 END) as propinas_pendientes
            FROM propinas_distribuidas
            WHERE id_camarero = ? AND DATE(fecha_venta) = ?
        `, [id_camarero, fecha_hoy]);

        res.json({
            success: true,
            propinas: propinas[0]
        });

    } catch (error) {
        console.error('Error al obtener propinas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Marcar propinas como entregadas
async function entregarPropinas(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { id_camarero, fecha } = req.body;

        await connection.query(`
            UPDATE propinas_distribuidas
            SET entregada = true
            WHERE id_camarero = ? AND DATE(fecha_venta) = ? AND entregada = false
        `, [id_camarero, fecha]);

        await connection.commit();

        res.json({
            success: true,
            message: 'Propinas marcadas como entregadas'
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al entregar propinas:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Obtener configuración del restaurante
async function obtenerConfiguracionRestaurante(req, res) {
    try {
        const [config] = await pool.query(`
            SELECT clave, valor
            FROM configuracion
            WHERE clave LIKE 'restaurante_%'
        `);

        const configuracion = {};
        config.forEach(item => {
            const key = item.clave.replace('restaurante_', '');
            configuracion[key] = item.valor;
        });

        res.json({
            success: true,
            configuracion
        });

    } catch (error) {
        console.error('Error al obtener configuración del restaurante:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Guardar configuración inicial del sistema
async function guardarConfiguracionInicial(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { restaurante, admin, cajas } = req.body;

        // 1. Guardar datos del restaurante
        const configRestaurante = [
            ['restaurante_nombre', restaurante.nombre],
            ['restaurante_rut', restaurante.rut],
            ['restaurante_giro', restaurante.giro],
            ['restaurante_direccion', restaurante.direccion],
            ['restaurante_comuna', restaurante.comuna],
            ['restaurante_ciudad', restaurante.ciudad],
            ['restaurante_telefono', restaurante.telefono],
            ['sistema_configurado', 'true']
        ];

        for (const [clave, valor] of configRestaurante) {
            await connection.query(`
                INSERT INTO configuracion (clave, valor, descripcion)
                VALUES (?, ?, '')
                ON DUPLICATE KEY UPDATE valor = ?
            `, [clave, valor, valor]);
        }

        // 2. Crear usuario administrador
        const [resultAdmin] = await connection.query(`
            INSERT INTO camareros (nombre, usuario, clave, email, rol, activo)
            VALUES (?, ?, ?, ?, 'admin', 1)
        `, [admin.nombre, admin.username, admin.password, admin.email || '']);

        // 3. Crear cajas
        for (let i = 1; i <= cajas.cantidad; i++) {
            await connection.query(`
                INSERT INTO caja (descripcion, activo)
                VALUES (?, 1)
            `, [`Caja ${i}`]);
        }

        await connection.commit();

        res.json({
            success: true,
            message: 'Configuración inicial guardada exitosamente',
            id_admin: resultAdmin.insertId
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error al guardar configuración inicial:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        connection.release();
    }
}

// Verificar si el sistema está configurado
async function verificarConfiguracion(req, res) {
    try {
        const [config] = await pool.query(`
            SELECT valor
            FROM configuracion
            WHERE clave = 'sistema_configurado'
        `);

        const configurado = config.length > 0 && config[0].valor === 'true';

        res.json({
            success: true,
            configurado
        });

    } catch (error) {
        console.error('Error al verificar configuración:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    generarPrecuenta,
    obtenerPrecuenta,
    marcarPrecuentaImpresa,
    registrarPropina,
    obtenerPropinasDelDia,
    entregarPropinas,
    obtenerConfiguracionRestaurante,
    guardarConfiguracionInicial,
    verificarConfiguracion
};
