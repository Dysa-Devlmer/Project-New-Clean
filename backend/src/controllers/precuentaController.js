// Controlador de Precuenta y Propinas - SISTEMA REAL COMPLETAMENTE CORREGIDO
const { pool } = require('../config/database');

// Generar precuenta - CORREGIDO PARA ESQUEMA REAL
async function generarPrecuenta(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { venta_id, empleado_id, num_personas, propina_personalizada, id_usuario } = req.body;

        // VALIDAR PERMISO: Solo cajeros, administradores y gerentes pueden generar precuenta
        if (id_usuario) {
            const [empleado] = await connection.query(`
                SELECT puesto_trabajo, nivel_acceso
                FROM empleados
                WHERE id = ? AND activo = 1
            `, [id_usuario]);

            if (empleado.length === 0) {
                return res.status(403).json({
                    success: false,
                    error: 'Usuario no válido'
                });
            }

            const puesto = empleado[0].puesto_trabajo?.toLowerCase() || '';
            const nivel = empleado[0].nivel_acceso || 0;

            // Solo cajeros, administradores y gerentes
            if (!puesto.includes('cajero') && !puesto.includes('admin') && !puesto.includes('gerente') && nivel < 3) {
                return res.status(403).json({
                    success: false,
                    error: 'No tiene permisos para generar precuenta. Solo personal de caja puede realizar esta acción.'
                });
            }
        }

        // Obtener datos de la venta - ESQUEMA CORREGIDO
        const [venta] = await connection.query(`
            SELECT
                vp.*,
                mr.numero_mesa,
                mr.descripcion_mesa,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado
            FROM ventas_principales vp
            INNER JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            INNER JOIN empleados e ON vp.empleado_vendedor_id = e.id
            WHERE vp.id = ?
        `, [venta_id]);

        if (venta.length === 0) {
            return res.status(404).json({ success: false, error: 'Venta no encontrada' });
        }

        // Obtener productos de la venta - ESQUEMA CORREGIDO
        const [productos] = await connection.query(`
            SELECT
                vd.*,
                p.nombre_producto,
                p.precio_venta
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            WHERE vd.venta_id = ?
            ORDER BY vd.numero_linea
        `, [venta_id]);

        // Calcular totales
        const subtotal = parseFloat(venta[0].total_final) || 0;

        // Obtener configuración de propina
        const [configPropina] = await connection.query(`
            SELECT valor
            FROM configuracion_sistema
            WHERE clave = 'propina_porcentaje_default'
        `);
        const porcentaje_default = parseFloat(configPropina[0]?.valor || 10);

        const propina_porcentaje = propina_personalizada !== undefined
            ? parseFloat(propina_personalizada)
            : porcentaje_default;

        const propina_monto = (subtotal * propina_porcentaje) / 100;
        const total = subtotal + propina_monto;

        // Generar número de precuenta
        const fecha_hoy = new Date().toISOString().split('T')[0].replace(/-/g, '');
        const numero_precuenta = `PRE${fecha_hoy}-${venta_id}`;

        // Verificar si ya existe precuenta
        const [precuentaExistente] = await connection.query(
            'SELECT * FROM precuentas WHERE venta_id = ?',
            [venta_id]
        );

        let id_precuenta;

        if (precuentaExistente.length > 0) {
            // Actualizar precuenta existente
            id_precuenta = precuentaExistente[0].id;
            await connection.query(`
                UPDATE precuentas SET
                    subtotal = ?,
                    propina_porcentaje = ?,
                    propina_monto = ?,
                    total_precuenta = ?,
                    numero_personas = ?,
                    fecha_actualizacion = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [subtotal, propina_porcentaje, propina_monto, total, num_personas, id_precuenta]);
        } else {
            // Crear nueva precuenta
            const [result] = await connection.query(`
                INSERT INTO precuentas
                (venta_id, numero_precuenta, subtotal, propina_porcentaje, propina_monto,
                 total_precuenta, numero_personas, empleado_genera_id, mesa_numero, estado_precuenta)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'GENERADA')
            `, [venta_id, numero_precuenta, subtotal, propina_porcentaje, propina_monto,
                total, num_personas, empleado_id, venta[0].numero_mesa]);

            id_precuenta = result.insertId;
        }

        await connection.commit();

        res.json({
            success: true,
            precuenta: {
                id: id_precuenta,
                numero_precuenta,
                venta: venta[0],
                productos,
                subtotal,
                propina_porcentaje,
                propina_monto,
                total,
                numero_personas: num_personas,
                fecha_generacion: new Date()
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

// Obtener precuenta de una venta - CORREGIDO
async function obtenerPrecuenta(req, res) {
    try {
        const { venta_id } = req.params;

        const [precuenta] = await pool.query(`
            SELECT
                p.*,
                vp.numero_venta,
                mr.numero_mesa,
                mr.descripcion_mesa,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado_genera
            FROM precuentas p
            INNER JOIN ventas_principales vp ON p.venta_id = vp.id
            INNER JOIN mesas_restaurante mr ON vp.mesa_id = mr.id
            INNER JOIN empleados e ON p.empleado_genera_id = e.id
            WHERE p.venta_id = ?
        `, [venta_id]);

        if (precuenta.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Precuenta no encontrada'
            });
        }

        // Obtener productos - ESQUEMA CORREGIDO
        const [productos] = await connection.query(`
            SELECT
                vd.*,
                p.nombre_producto,
                p.codigo_producto
            FROM venta_detalles vd
            INNER JOIN productos p ON vd.producto_id = p.id
            WHERE vd.venta_id = ?
            ORDER BY vd.numero_linea
        `, [venta_id]);

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

// Marcar precuenta como impresa - CORREGIDO
async function marcarPrecuentaImpresa(req, res) {
    try {
        const { id_precuenta, empleado_imprime_id } = req.body;

        await pool.query(`
            UPDATE precuentas
            SET estado_precuenta = 'IMPRESA',
                fecha_impresion = CURRENT_TIMESTAMP,
                empleado_imprime_id = ?
            WHERE id = ?
        `, [empleado_imprime_id, id_precuenta]);

        res.json({
            success: true,
            message: 'Precuenta marcada como impresa'
        });

    } catch (error) {
        console.error('Error al marcar precuenta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Registrar propina distribuida - CORREGIDO
async function registrarPropina(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            venta_id,
            empleado_receptor_id,
            monto_propina,
            forma_pago_id,
            empleado_registra_id
        } = req.body;

        const fecha_venta = new Date().toISOString().split('T')[0];

        // Insertar en tabla propinas_empleados (esquema real)
        await connection.query(`
            INSERT INTO propinas_empleados
            (venta_id, empleado_receptor_id, monto_propina, fecha_propina,
             forma_pago_id, empleado_registra_id, estado_entrega)
            VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')
        `, [venta_id, empleado_receptor_id, monto_propina, fecha_venta,
            forma_pago_id, empleado_registra_id]);

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

// Obtener propinas del día por empleado - CORREGIDO
async function obtenerPropinasDelDia(req, res) {
    try {
        const { empleado_id } = req.params;
        const fecha_hoy = new Date().toISOString().split('T')[0];

        const [propinas] = await pool.query(`
            SELECT
                COUNT(DISTINCT venta_id) as numero_ventas,
                SUM(monto_propina) as total_propinas,
                SUM(CASE WHEN estado_entrega = 'ENTREGADA' THEN monto_propina ELSE 0 END) as propinas_entregadas,
                SUM(CASE WHEN estado_entrega = 'PENDIENTE' THEN monto_propina ELSE 0 END) as propinas_pendientes
            FROM propinas_empleados
            WHERE empleado_receptor_id = ? AND DATE(fecha_propina) = ?
        `, [empleado_id, fecha_hoy]);

        res.json({
            success: true,
            propinas: propinas[0]
        });

    } catch (error) {
        console.error('Error al obtener propinas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Marcar propinas como entregadas - CORREGIDO
async function entregarPropinas(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { empleado_id, fecha, empleado_entrega_id } = req.body;

        await connection.query(`
            UPDATE propinas_empleados
            SET estado_entrega = 'ENTREGADA',
                fecha_entrega = CURRENT_TIMESTAMP,
                empleado_entrega_id = ?
            WHERE empleado_receptor_id = ?
            AND DATE(fecha_propina) = ?
            AND estado_entrega = 'PENDIENTE'
        `, [empleado_entrega_id, empleado_id, fecha]);

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

// Obtener configuración del restaurante - CORREGIDO
async function obtenerConfiguracionRestaurante(req, res) {
    try {
        const [config] = await pool.query(`
            SELECT clave, valor, descripcion_config
            FROM configuracion_sistema
            WHERE clave LIKE 'restaurante_%' OR clave LIKE 'empresa_%'
        `);

        const configuracion = {};
        config.forEach(item => {
            const key = item.clave.replace(/^(restaurante_|empresa_)/, '');
            configuracion[key] = {
                valor: item.valor,
                descripcion: item.descripcion_config
            };
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

// Guardar configuración inicial del sistema - CORREGIDO
async function guardarConfiguracionInicial(req, res) {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const { restaurante, admin, cajas } = req.body;

        // 1. Guardar datos del restaurante en configuracion_sistema
        const configRestaurante = [
            ['empresa_nombre', restaurante.nombre, 'Nombre de la empresa/restaurante'],
            ['empresa_rut', restaurante.rut, 'RUT de la empresa'],
            ['empresa_giro', restaurante.giro, 'Giro comercial'],
            ['empresa_direccion', restaurante.direccion, 'Dirección comercial'],
            ['empresa_comuna', restaurante.comuna, 'Comuna'],
            ['empresa_ciudad', restaurante.ciudad, 'Ciudad'],
            ['empresa_telefono', restaurante.telefono, 'Teléfono de contacto'],
            ['sistema_configurado', 'true', 'Estado de configuración inicial del sistema']
        ];

        for (const [clave, valor, descripcion] of configRestaurante) {
            await connection.query(`
                INSERT INTO configuracion_sistema (clave, valor, descripcion_config, fecha_creacion)
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                ON DUPLICATE KEY UPDATE
                    valor = VALUES(valor),
                    fecha_actualizacion = CURRENT_TIMESTAMP
            `, [clave, valor, descripcion]);
        }

        // 2. Crear usuario administrador en empleados (esquema correcto)
        const [resultAdmin] = await connection.query(`
            INSERT INTO empleados
            (nombres, apellido_paterno, usuario_sistema, password_hash, email,
             puesto_trabajo, nivel_acceso, activo, fecha_contratacion)
            VALUES (?, '', ?, ?, ?, 'Administrador del Sistema', 5, 1, CURRENT_DATE)
        `, [admin.nombre, admin.username, admin.password, admin.email || '']);

        // 3. Crear cajas en tabla cajas (esquema correcto)
        for (let i = 1; i <= cajas.cantidad; i++) {
            await connection.query(`
                INSERT INTO cajas (codigo_caja, nombre_caja, descripcion_caja, activa)
                VALUES (?, ?, ?, 1)
            `, [`CAJA${i.toString().padStart(2, '0')}`, `Caja ${i}`, `Caja de ventas número ${i}`]);
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

// Verificar si el sistema está configurado - CORREGIDO
async function verificarConfiguracion(req, res) {
    try {
        const [config] = await pool.query(`
            SELECT valor
            FROM configuracion_sistema
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

// Obtener reporte de propinas por período - NUEVA FUNCIÓN EMPRESARIAL
async function obtenerReportePropinas(req, res) {
    try {
        const { fecha_inicio, fecha_fin, empleado_id } = req.query;

        let whereClause = 'WHERE DATE(pe.fecha_propina) BETWEEN ? AND ?';
        let params = [fecha_inicio, fecha_fin];

        if (empleado_id) {
            whereClause += ' AND pe.empleado_receptor_id = ?';
            params.push(empleado_id);
        }

        const [reporte] = await pool.query(`
            SELECT
                pe.empleado_receptor_id,
                CONCAT(e.nombres, ' ', e.apellido_paterno) as nombre_empleado,
                e.puesto_trabajo,
                COUNT(DISTINCT pe.venta_id) as total_ventas,
                SUM(pe.monto_propina) as total_propinas,
                AVG(pe.monto_propina) as promedio_propina,
                SUM(CASE WHEN pe.estado_entrega = 'ENTREGADA' THEN pe.monto_propina ELSE 0 END) as propinas_entregadas,
                SUM(CASE WHEN pe.estado_entrega = 'PENDIENTE' THEN pe.monto_propina ELSE 0 END) as propinas_pendientes
            FROM propinas_empleados pe
            INNER JOIN empleados e ON pe.empleado_receptor_id = e.id
            ${whereClause}
            GROUP BY pe.empleado_receptor_id, e.nombres, e.apellido_paterno, e.puesto_trabajo
            ORDER BY total_propinas DESC
        `, params);

        res.json({
            success: true,
            reporte,
            periodo: { fecha_inicio, fecha_fin }
        });

    } catch (error) {
        console.error('Error al obtener reporte de propinas:', error);
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
    verificarConfiguracion,
    obtenerReportePropinas
};