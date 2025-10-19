// Controlador de Gestión de Clientes - DYSA Point Enterprise
const { pool } = require('../config/database');

// Obtener todos los clientes
async function obtenerClientes(req, res) {
    try {
        const { activo, tipo_cliente, categoria, buscar, pagina = 1, limite = 50 } = req.query;

        let query = `
            SELECT
                id, codigo_cliente, rut, nombre, apellido, razon_social,
                telefono, email, direccion, ciudad, tipo_cliente, categoria_cliente,
                fecha_registro, fecha_ultimo_consumo, total_compras, numero_visitas,
                descuento_preferencial, limite_credito, saldo_credito, activo
            FROM clientes
            WHERE 1=1
        `;

        const params = [];

        // Filtros
        if (activo !== undefined) {
            query += ' AND activo = ?';
            params.push(activo === 'true');
        }

        if (tipo_cliente) {
            query += ' AND tipo_cliente = ?';
            params.push(tipo_cliente);
        }

        if (categoria) {
            query += ' AND categoria_cliente = ?';
            params.push(categoria);
        }

        if (buscar) {
            query += ' AND (nombre LIKE ? OR apellido LIKE ? OR razon_social LIKE ? OR rut LIKE ? OR codigo_cliente LIKE ?)';
            const searchTerm = `%${buscar}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // Ordenar y paginar
        query += ' ORDER BY nombre, apellido, razon_social';

        const offset = (parseInt(pagina) - 1) * parseInt(limite);
        query += ` LIMIT ${parseInt(limite)} OFFSET ${offset}`;

        const [clientes] = await pool.query(query, params);

        // Contar total
        let countQuery = 'SELECT COUNT(*) as total FROM clientes WHERE 1=1';
        const countParams = [];

        if (activo !== undefined) {
            countQuery += ' AND activo = ?';
            countParams.push(activo === 'true');
        }
        if (tipo_cliente) {
            countQuery += ' AND tipo_cliente = ?';
            countParams.push(tipo_cliente);
        }
        if (categoria) {
            countQuery += ' AND categoria_cliente = ?';
            countParams.push(categoria);
        }
        if (buscar) {
            countQuery += ' AND (nombre LIKE ? OR apellido LIKE ? OR razon_social LIKE ? OR rut LIKE ? OR codigo_cliente LIKE ?)';
            const searchTerm = `%${buscar}%`;
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const [countResult] = await pool.query(countQuery, countParams);
        const total = countResult[0].total;

        res.json({
            success: true,
            clientes,
            pagination: {
                pagina: parseInt(pagina),
                limite: parseInt(limite),
                total,
                total_paginas: Math.ceil(total / parseInt(limite))
            }
        });

    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener cliente por ID
async function obtenerClientePorId(req, res) {
    try {
        const { id } = req.params;

        const [cliente] = await pool.query(`
            SELECT * FROM clientes WHERE id = ?
        `, [id]);

        if (cliente.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cliente no encontrado'
            });
        }

        res.json({
            success: true,
            cliente: cliente[0]
        });

    } catch (error) {
        console.error('Error al obtener cliente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Crear nuevo cliente
async function crearCliente(req, res) {
    try {
        const {
            rut, nombre, apellido, razon_social, telefono, email, direccion,
            ciudad, region, codigo_postal, tipo_cliente = 'PERSONA',
            categoria_cliente = 'REGULAR', descuento_preferencial = 0,
            limite_credito = 0, observaciones
        } = req.body;

        // Validaciones básicas
        if (!nombre && !razon_social) {
            return res.status(400).json({
                success: false,
                error: 'Debe proporcionar nombre o razón social'
            });
        }

        // Generar código único de cliente
        const [maxCodigo] = await pool.query(
            'SELECT MAX(CAST(SUBSTRING(codigo_cliente, 4) AS UNSIGNED)) as max_num FROM clientes WHERE codigo_cliente LIKE "CLI%"'
        );

        const siguienteNum = (maxCodigo[0].max_num || 0) + 1;
        const codigo_cliente = `CLI${siguienteNum.toString().padStart(3, '0')}`;

        const [result] = await pool.query(`
            INSERT INTO clientes (
                codigo_cliente, rut, nombre, apellido, razon_social, telefono, email,
                direccion, ciudad, region, codigo_postal, tipo_cliente, categoria_cliente,
                descuento_preferencial, limite_credito, observaciones
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            codigo_cliente, rut, nombre, apellido, razon_social, telefono, email,
            direccion, ciudad, region, codigo_postal, tipo_cliente, categoria_cliente,
            descuento_preferencial, limite_credito, observaciones
        ]);

        res.status(201).json({
            success: true,
            message: 'Cliente creado exitosamente',
            cliente_id: result.insertId,
            codigo_cliente
        });

    } catch (error) {
        console.error('Error al crear cliente:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({
                success: false,
                error: 'Ya existe un cliente con ese RUT'
            });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

// Actualizar cliente
async function actualizarCliente(req, res) {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Verificar que el cliente existe
        const [clienteExistente] = await pool.query(
            'SELECT id FROM clientes WHERE id = ?',
            [id]
        );

        if (clienteExistente.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Cliente no encontrado'
            });
        }

        // Construir query dinámico
        const campos = [];
        const valores = [];

        const camposPermitidos = [
            'rut', 'nombre', 'apellido', 'razon_social', 'telefono', 'email',
            'direccion', 'ciudad', 'region', 'codigo_postal', 'tipo_cliente',
            'categoria_cliente', 'descuento_preferencial', 'limite_credito',
            'saldo_credito', 'activo', 'observaciones'
        ];

        for (const campo of camposPermitidos) {
            if (updateData.hasOwnProperty(campo)) {
                campos.push(`${campo} = ?`);
                valores.push(updateData[campo]);
            }
        }

        if (campos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No se proporcionaron datos para actualizar'
            });
        }

        valores.push(id);

        await pool.query(`
            UPDATE clientes
            SET ${campos.join(', ')}
            WHERE id = ?
        `, valores);

        res.json({
            success: true,
            message: 'Cliente actualizado exitosamente'
        });

    } catch (error) {
        console.error('Error al actualizar cliente:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({
                success: false,
                error: 'Ya existe un cliente con ese RUT'
            });
        } else {
            res.status(500).json({ success: false, error: error.message });
        }
    }
}

// Eliminar cliente (desactivar)
async function eliminarCliente(req, res) {
    try {
        const { id } = req.params;
        const { eliminar_permanente = false } = req.query;

        if (eliminar_permanente === 'true') {
            // Verificar que no tenga ventas asociadas
            const [ventas] = await pool.query(
                'SELECT COUNT(*) as total FROM ventas_principales WHERE cliente_id = ?',
                [id]
            );

            if (ventas[0].total > 0) {
                return res.status(400).json({
                    success: false,
                    error: 'No se puede eliminar un cliente con ventas asociadas'
                });
            }

            await pool.query('DELETE FROM clientes WHERE id = ?', [id]);

            res.json({
                success: true,
                message: 'Cliente eliminado permanentemente'
            });
        } else {
            // Solo desactivar
            await pool.query(
                'UPDATE clientes SET activo = FALSE WHERE id = ?',
                [id]
            );

            res.json({
                success: true,
                message: 'Cliente desactivado exitosamente'
            });
        }

    } catch (error) {
        console.error('Error al eliminar cliente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Obtener estadísticas de clientes
async function obtenerEstadisticasClientes(req, res) {
    try {
        // Total de clientes
        const [totalClientes] = await pool.query(
            'SELECT COUNT(*) as total FROM clientes WHERE activo = TRUE'
        );

        // Clientes por tipo
        const [porTipo] = await pool.query(`
            SELECT tipo_cliente, COUNT(*) as cantidad
            FROM clientes
            WHERE activo = TRUE
            GROUP BY tipo_cliente
        `);

        // Clientes por categoría
        const [porCategoria] = await pool.query(`
            SELECT categoria_cliente, COUNT(*) as cantidad
            FROM clientes
            WHERE activo = TRUE
            GROUP BY categoria_cliente
        `);

        // Top 10 clientes por compras
        const [topClientes] = await pool.query(`
            SELECT
                codigo_cliente,
                CASE
                    WHEN tipo_cliente = 'PERSONA' THEN CONCAT(nombre, ' ', apellido)
                    ELSE razon_social
                END as nombre_completo,
                total_compras,
                numero_visitas
            FROM clientes
            WHERE activo = TRUE
            ORDER BY total_compras DESC
            LIMIT 10
        `);

        // Clientes nuevos este mes
        const [clientesNuevos] = await pool.query(`
            SELECT COUNT(*) as nuevos_este_mes
            FROM clientes
            WHERE activo = TRUE
            AND YEAR(fecha_registro) = YEAR(NOW())
            AND MONTH(fecha_registro) = MONTH(NOW())
        `);

        res.json({
            success: true,
            estadisticas: {
                total_clientes: totalClientes[0].total,
                por_tipo: porTipo,
                por_categoria: porCategoria,
                top_clientes: topClientes,
                nuevos_este_mes: clientesNuevos[0].nuevos_este_mes
            }
        });

    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Buscar cliente por RUT o código
async function buscarCliente(req, res) {
    try {
        const { termino } = req.params;

        const [clientes] = await pool.query(`
            SELECT
                id, codigo_cliente, rut, nombre, apellido, razon_social,
                telefono, email, tipo_cliente, categoria_cliente,
                total_compras, numero_visitas, descuento_preferencial
            FROM clientes
            WHERE activo = TRUE
            AND (
                rut = ? OR
                codigo_cliente = ? OR
                nombre LIKE ? OR
                apellido LIKE ? OR
                razon_social LIKE ?
            )
            ORDER BY total_compras DESC
            LIMIT 10
        `, [termino, termino, `%${termino}%`, `%${termino}%`, `%${termino}%`]);

        res.json({
            success: true,
            clientes
        });

    } catch (error) {
        console.error('Error al buscar cliente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Funciones adicionales requeridas por el archivo de rutas existente
async function buscarPorTelefono(req, res) {
    try {
        const { telefono } = req.params;

        const [clientes] = await pool.query(`
            SELECT id, codigo_cliente, rut, nombre, apellido, razon_social, telefono, email
            FROM clientes
            WHERE telefono = ? AND activo = TRUE
        `, [telefono]);

        res.json({
            success: true,
            clientes
        });
    } catch (error) {
        console.error('Error al buscar por teléfono:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

async function obtenerClientesEspeciales(req, res) {
    try {
        const [clientes] = await pool.query(`
            SELECT id, codigo_cliente, rut, nombre, apellido, razon_social,
                   telefono, categoria_cliente, total_compras, numero_visitas
            FROM clientes
            WHERE activo = TRUE AND categoria_cliente IN ('VIP', 'CORPORATIVO')
            ORDER BY total_compras DESC
        `);

        res.json({
            success: true,
            clientes
        });
    } catch (error) {
        console.error('Error al obtener clientes especiales:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

// Alias para estadisticas (compatibilidad con rutas existentes)
async function obtenerEstadisticas(req, res) {
    return obtenerEstadisticasClientes(req, res);
}

async function agregarNota(req, res) {
    try {
        const { id } = req.params;
        const { tipo_nota, nota, visible_en_terminal, id_camarero } = req.body;

        // Para esta implementación básica, agregar la nota como observación
        await pool.query(`
            UPDATE clientes
            SET observaciones = CONCAT(IFNULL(observaciones, ''), '\n[', NOW(), '] ', ?)
            WHERE id = ?
        `, [nota, id]);

        res.json({
            success: true,
            message: 'Nota agregada exitosamente'
        });
    } catch (error) {
        console.error('Error al agregar nota:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}

module.exports = {
    obtenerClientes,
    obtenerClientePorId,
    crearCliente,
    actualizarCliente,
    eliminarCliente,
    obtenerEstadisticasClientes,
    buscarCliente,
    // Funciones adicionales para compatibilidad
    buscarPorTelefono,
    obtenerClientesEspeciales,
    obtenerEstadisticas,
    agregarNota
};