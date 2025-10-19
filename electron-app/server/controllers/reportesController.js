/**
 * =====================================================
 * CONTROLADOR DE REPORTES Y ESTADÍSTICAS
 * Descripción: Generación de reportes para análisis de negocio real
 * Autor: Devlmer - Dysa
 * Fecha: 2025-10-05 02:50 AM
 * PRODUCCIÓN: Sistema real para restaurante
 * =====================================================
 */

const { pool } = require('../config/database');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');

/**
 * Obtener ventas diarias consolidadas
 * @route GET /api/reportes/ventas-diarias
 */
async function obtenerVentasDiarias(req, res) {
    try {
        const { fecha_desde, fecha_hasta, limite = 30 } = req.query;

        let query = 'SELECT * FROM vista_ventas_diarias';
        let params = [];

        if (fecha_desde && fecha_hasta) {
            query += ' WHERE fecha BETWEEN ? AND ?';
            params.push(fecha_desde, fecha_hasta);
        }

        query += ' ORDER BY fecha DESC LIMIT ?';
        params.push(parseInt(limite));

        const [ventas] = await pool.query(query, params);

        res.json({
            success: true,
            data: ventas
        });

    } catch (error) {
        console.error('Error al obtener ventas diarias:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener ventas diarias',
            detalle: error.message
        });
    }
}

/**
 * Obtener ranking de productos
 * @route GET /api/reportes/productos-ranking
 */
async function obtenerProductosRanking(req, res) {
    try {
        const { limite = 20 } = req.query;

        const [productos] = await pool.query(
            'SELECT * FROM vista_productos_ranking LIMIT ?',
            [parseInt(limite)]
        );

        res.json({
            success: true,
            data: productos
        });

    } catch (error) {
        console.error('Error al obtener ranking de productos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener ranking de productos',
            detalle: error.message
        });
    }
}

/**
 * Obtener ranking de categorías
 * @route GET /api/reportes/categorias-ranking
 */
async function obtenerCategoriasRanking(req, res) {
    try {
        const [categorias] = await pool.query(
            'SELECT * FROM vista_categorias_ranking'
        );

        res.json({
            success: true,
            data: categorias
        });

    } catch (error) {
        console.error('Error al obtener ranking de categorías:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener ranking de categorías',
            detalle: error.message
        });
    }
}

/**
 * Obtener rendimiento de camareros
 * @route GET /api/reportes/rendimiento-camareros
 */
async function obtenerRendimientoCamareros(req, res) {
    try {
        const [camareros] = await pool.query(
            'SELECT * FROM vista_rendimiento_camareros'
        );

        res.json({
            success: true,
            data: camareros
        });

    } catch (error) {
        console.error('Error al obtener rendimiento de camareros:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener rendimiento de camareros',
            detalle: error.message
        });
    }
}

/**
 * Generar reporte de ventas por período
 * @route GET /api/reportes/ventas-periodo
 */
async function obtenerVentasPorPeriodo(req, res) {
    try {
        const { fecha_desde, fecha_hasta, agrupar_por = 'dia' } = req.query;

        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        if (!['dia', 'semana', 'mes'].includes(agrupar_por)) {
            return res.status(400).json({
                success: false,
                error: 'agrupar_por debe ser: dia, semana o mes'
            });
        }

        const [ventas] = await pool.query(
            'CALL sp_reporte_ventas_periodo(?, ?, ?)',
            [fecha_desde, fecha_hasta, agrupar_por]
        );

        res.json({
            success: true,
            data: ventas[0]
        });

    } catch (error) {
        console.error('Error al obtener reporte de ventas:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener reporte de ventas',
            detalle: error.message
        });
    }
}

/**
 * Comparar dos períodos
 * @route GET /api/reportes/comparativa-periodos
 */
async function compararPeriodos(req, res) {
    try {
        const {
            fecha_desde_periodo1,
            fecha_hasta_periodo1,
            fecha_desde_periodo2,
            fecha_hasta_periodo2
        } = req.query;

        if (!fecha_desde_periodo1 || !fecha_hasta_periodo1 ||
            !fecha_desde_periodo2 || !fecha_hasta_periodo2) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren las 4 fechas para comparar períodos'
            });
        }

        const [resultado] = await pool.query(
            'CALL sp_comparativa_periodos(?, ?, ?, ?)',
            [fecha_desde_periodo1, fecha_hasta_periodo1,
             fecha_desde_periodo2, fecha_hasta_periodo2]
        );

        const datos = resultado[0];
        const periodo1 = datos[0];
        const periodo2 = datos[1];

        // Calcular variaciones
        const variaciones = {
            ventas: calcularVariacion(periodo2.total_ventas, periodo1.total_ventas),
            facturacion: calcularVariacion(periodo2.total_facturado, periodo1.total_facturado),
            ticket_promedio: calcularVariacion(periodo2.ticket_promedio, periodo1.ticket_promedio),
            productos: calcularVariacion(periodo2.total_productos, periodo1.total_productos)
        };

        res.json({
            success: true,
            data: {
                periodo1,
                periodo2,
                variaciones
            }
        });

    } catch (error) {
        console.error('Error al comparar períodos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al comparar períodos',
            detalle: error.message
        });
    }
}

/**
 * Obtener reporte de métodos de pago
 * @route GET /api/reportes/metodos-pago
 */
async function obtenerReporteMetodosPago(req, res) {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        const [metodos] = await pool.query(
            'CALL sp_reporte_metodos_pago(?, ?)',
            [fecha_desde, fecha_hasta]
        );

        res.json({
            success: true,
            data: metodos[0]
        });

    } catch (error) {
        console.error('Error al obtener reporte de métodos de pago:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener reporte de métodos de pago',
            detalle: error.message
        });
    }
}

/**
 * Obtener análisis de horas pico
 * @route GET /api/reportes/horas-pico
 */
async function obtenerHorasPico(req, res) {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta (solo fecha, sin hora)'
            });
        }

        const [horas] = await pool.query(
            'CALL sp_analisis_horas_pico(?, ?)',
            [fecha_desde, fecha_hasta]
        );

        res.json({
            success: true,
            data: horas[0]
        });

    } catch (error) {
        console.error('Error al obtener análisis de horas pico:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener análisis de horas pico',
            detalle: error.message
        });
    }
}

/**
 * Obtener top productos por categoría
 * @route GET /api/reportes/top-productos-categoria
 */
async function obtenerTopProductosCategoria(req, res) {
    try {
        const {
            fecha_desde,
            fecha_hasta,
            id_categoria,
            limite = 10
        } = req.query;

        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        const [productos] = await pool.query(
            'CALL sp_top_productos_categoria(?, ?, ?, ?)',
            [fecha_desde, fecha_hasta, id_categoria || null, parseInt(limite)]
        );

        res.json({
            success: true,
            data: productos[0]
        });

    } catch (error) {
        console.error('Error al obtener top productos por categoría:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener top productos por categoría',
            detalle: error.message
        });
    }
}

/**
 * Obtener análisis de descuentos
 * @route GET /api/reportes/analisis-descuentos
 */
async function obtenerAnalisisDescuentos(req, res) {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        if (!fecha_desde || !fecha_hasta) {
            return res.status(400).json({
                success: false,
                error: 'Se requieren fecha_desde y fecha_hasta'
            });
        }

        const [descuentos] = await pool.query(
            'CALL sp_analisis_descuentos(?, ?)',
            [fecha_desde, fecha_hasta]
        );

        res.json({
            success: true,
            data: descuentos[0]
        });

    } catch (error) {
        console.error('Error al obtener análisis de descuentos:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener análisis de descuentos',
            detalle: error.message
        });
    }
}

/**
 * Exportar reporte a Excel
 * @route GET /api/reportes/exportar-excel
 */
async function exportarExcel(req, res) {
    try {
        const {
            tipo_reporte,
            fecha_desde,
            fecha_hasta,
            agrupar_por = 'dia'
        } = req.query;

        if (!tipo_reporte) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere tipo_reporte'
            });
        }

        // Crear workbook
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'POS Mistura';
        workbook.created = new Date();

        let datos = [];
        let nombreHoja = '';

        // Obtener datos según tipo de reporte
        switch (tipo_reporte) {
            case 'ventas-periodo':
                if (!fecha_desde || !fecha_hasta) {
                    return res.status(400).json({
                        success: false,
                        error: 'Se requieren fecha_desde y fecha_hasta'
                    });
                }
                const [ventasPeriodo] = await pool.query(
                    'CALL sp_reporte_ventas_periodo(?, ?, ?)',
                    [fecha_desde, fecha_hasta, agrupar_por]
                );
                datos = ventasPeriodo[0];
                nombreHoja = 'Ventas por Período';
                break;

            case 'productos':
                const [productos] = await pool.query(
                    'SELECT * FROM vista_productos_ranking LIMIT 100'
                );
                datos = productos;
                nombreHoja = 'Productos Más Vendidos';
                break;

            case 'categorias':
                const [categorias] = await pool.query(
                    'SELECT * FROM vista_categorias_ranking'
                );
                datos = categorias;
                nombreHoja = 'Categorías Más Vendidas';
                break;

            case 'camareros':
                const [camareros] = await pool.query(
                    'SELECT * FROM vista_rendimiento_camareros'
                );
                datos = camareros;
                nombreHoja = 'Rendimiento Camareros';
                break;

            case 'metodos-pago':
                if (!fecha_desde || !fecha_hasta) {
                    return res.status(400).json({
                        success: false,
                        error: 'Se requieren fecha_desde y fecha_hasta'
                    });
                }
                const [metodos] = await pool.query(
                    'CALL sp_reporte_metodos_pago(?, ?)',
                    [fecha_desde, fecha_hasta]
                );
                datos = metodos[0];
                nombreHoja = 'Métodos de Pago';
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Tipo de reporte no válido'
                });
        }

        if (datos.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No hay datos para exportar'
            });
        }

        // Crear hoja
        const worksheet = workbook.addWorksheet(nombreHoja);

        // Obtener columnas del primer registro
        const columnas = Object.keys(datos[0]);

        // Configurar columnas
        worksheet.columns = columnas.map(col => ({
            header: col.toUpperCase().replace(/_/g, ' '),
            key: col,
            width: 15
        }));

        // Estilo de encabezados
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF667EEA' }
        };
        worksheet.getRow(1).font = { color: { argb: 'FFFFFFFF' }, bold: true };

        // Añadir datos
        datos.forEach(row => {
            worksheet.addRow(row);
        });

        // Configurar respuesta
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=reporte_${tipo_reporte}_${Date.now()}.xlsx`
        );

        // Escribir a la respuesta
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        res.status(500).json({
            success: false,
            error: 'Error al exportar a Excel',
            detalle: error.message
        });
    }
}

/**
 * Exportar reporte a PDF
 * @route GET /api/reportes/exportar-pdf
 */
async function exportarPDF(req, res) {
    try {
        const {
            tipo_reporte,
            fecha_desde,
            fecha_hasta
        } = req.query;

        if (!tipo_reporte) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere tipo_reporte'
            });
        }

        let datos = [];
        let titulo = '';

        // Obtener datos según tipo de reporte
        switch (tipo_reporte) {
            case 'productos':
                const [productos] = await pool.query(
                    'SELECT * FROM vista_productos_ranking LIMIT 20'
                );
                datos = productos;
                titulo = 'TOP 20 PRODUCTOS MÁS VENDIDOS';
                break;

            case 'camareros':
                const [camareros] = await pool.query(
                    'SELECT * FROM vista_rendimiento_camareros'
                );
                datos = camareros;
                titulo = 'RENDIMIENTO DE CAMAREROS';
                break;

            case 'ventas-diarias':
                if (!fecha_desde || !fecha_hasta) {
                    return res.status(400).json({
                        success: false,
                        error: 'Se requieren fecha_desde y fecha_hasta'
                    });
                }
                const [ventas] = await pool.query(
                    'SELECT * FROM vista_ventas_diarias WHERE fecha BETWEEN ? AND ? ORDER BY fecha DESC LIMIT 30',
                    [fecha_desde, fecha_hasta]
                );
                datos = ventas;
                titulo = `VENTAS DIARIAS - ${fecha_desde} a ${fecha_hasta}`;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: 'Tipo de reporte no válido para PDF'
                });
        }

        if (datos.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No hay datos para exportar'
            });
        }

        // Crear documento PDF
        const doc = new PDFDocument({ margin: 50 });

        // Configurar respuesta
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=reporte_${tipo_reporte}_${Date.now()}.pdf`
        );

        // Pipe del documento a la respuesta
        doc.pipe(res);

        // Encabezado
        doc.fontSize(20).text('POS MISTURA', { align: 'center' });
        doc.fontSize(16).text(titulo, { align: 'center' });
        doc.fontSize(10).text(`Generado: ${new Date().toLocaleString('es-CL')}`, { align: 'center' });
        doc.moveDown();
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();

        // Contenido según tipo
        if (tipo_reporte === 'productos') {
            datos.forEach((producto, index) => {
                doc.fontSize(12).text(`${index + 1}. ${producto.producto}`, { continued: false });
                doc.fontSize(10)
                   .text(`   Categoría: ${producto.categoria || 'N/A'}`)
                   .text(`   Cantidad vendida: ${producto.cantidad_total}`)
                   .text(`   Total facturado: $${Number(producto.total_facturado).toLocaleString('es-CL')}`)
                   .text(`   Veces vendido: ${producto.veces_vendido}`);
                doc.moveDown(0.5);
            });
        } else if (tipo_reporte === 'camareros') {
            datos.forEach((camarero, index) => {
                doc.fontSize(12).text(`${index + 1}. ${camarero.camarero}`, { continued: false });
                doc.fontSize(10)
                   .text(`   Total ventas: ${camarero.total_ventas}`)
                   .text(`   Total facturado: $${Number(camarero.total_facturado).toLocaleString('es-CL')}`)
                   .text(`   Ticket promedio: $${Number(camarero.ticket_promedio).toLocaleString('es-CL')}`)
                   .text(`   Días trabajados: ${camarero.dias_trabajados}`);
                doc.moveDown(0.5);
            });
        } else if (tipo_reporte === 'ventas-diarias') {
            datos.forEach((venta) => {
                const fecha = new Date(venta.fecha).toLocaleDateString('es-CL');
                doc.fontSize(11).text(`${fecha} (${venta.dia_semana})`, { continued: false });
                doc.fontSize(10)
                   .text(`   Ventas: ${venta.total_ventas} | Facturado: $${Number(venta.total_facturado).toLocaleString('es-CL')}`)
                   .text(`   Ticket promedio: $${Number(venta.ticket_promedio).toLocaleString('es-CL')}`);
                doc.moveDown(0.5);
            });
        }

        // Pie de página
        doc.fontSize(8).text('POS Mistura - Sistema de Gestión para Restaurantes', 50, doc.page.height - 50, { align: 'center' });

        // Finalizar documento
        doc.end();

    } catch (error) {
        console.error('Error al exportar a PDF:', error);
        res.status(500).json({
            success: false,
            error: 'Error al exportar a PDF',
            detalle: error.message
        });
    }
}

/**
 * Dashboard principal con métricas clave
 * @route GET /api/reportes/dashboard
 */
async function obtenerDashboard(req, res) {
    try {
        const { fecha_desde, fecha_hasta } = req.query;

        // Si no se especifican fechas, usar hoy
        const hoy = new Date();
        const inicioHoy = fecha_desde || new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 0, 0, 0);
        const finHoy = fecha_hasta || new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59);

        // Estadísticas generales
        const [stats] = await pool.query(
            `SELECT
                COUNT(DISTINCT v.id_venta) AS total_ventas,
                COALESCE(SUM(v.total), 0) AS total_facturado,
                COALESCE(AVG(v.total), 0) AS ticket_promedio,
                COUNT(DISTINCT v.id_mesa) AS mesas_atendidas
             FROM ventas v
             WHERE v.fecha_hora BETWEEN ? AND ?
                AND v.estado = 'cerrada'`,
            [inicioHoy, finHoy]
        );

        // Top 5 productos
        const [topProductos] = await pool.query(
            'CALL sp_top_productos_categoria(?, ?, ?, ?)',
            [inicioHoy, finHoy, null, 5]
        );

        // Métodos de pago
        const [metodosPago] = await pool.query(
            'CALL sp_reporte_metodos_pago(?, ?)',
            [inicioHoy, finHoy]
        );

        res.json({
            success: true,
            data: {
                estadisticas: stats[0],
                top_productos: topProductos[0],
                metodos_pago: metodosPago[0]
            }
        });

    } catch (error) {
        console.error('Error al obtener dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Error al obtener dashboard',
            detalle: error.message
        });
    }
}

// =====================================================
// FUNCIONES AUXILIARES
// =====================================================

function calcularVariacion(valorActual, valorAnterior) {
    if (valorAnterior === 0) return 100.00;
    return Number((((valorActual - valorAnterior) / valorAnterior) * 100).toFixed(2));
}

// =====================================================
// EXPORTAR FUNCIONES
// =====================================================

module.exports = {
    obtenerVentasDiarias,
    obtenerProductosRanking,
    obtenerCategoriasRanking,
    obtenerRendimientoCamareros,
    obtenerVentasPorPeriodo,
    compararPeriodos,
    obtenerReporteMetodosPago,
    obtenerHorasPico,
    obtenerTopProductosCategoria,
    obtenerAnalisisDescuentos,
    exportarExcel,
    exportarPDF,
    obtenerDashboard
};
