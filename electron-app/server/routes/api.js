// Rutas API - SISTEMA REAL
const express = require('express');
const router = express.Router();

// Controllers
const mesasController = require('../controllers/mesasController');
const productosController = require('../controllers/productosController');
const pedidosController = require('../controllers/pedidosController');
const cajaController = require('../controllers/cajaController');
const pagosController = require('../controllers/pagosController');
const precuentaController = require('../controllers/precuentaController');
const opcionesController = require('../controllers/opcionesController');
const categoriasController = require('../controllers/categoriasController');
const productosControllerCRUD = require('../controllers/productosControllerCRUD');
const tarifasController = require('../controllers/tarifasController');
const panelCocinaController = require('../controllers/panelCocinaController');
const permisosController = require('../controllers/permisosController');
const stockController = require('../controllers/stockController');
const combinadosController = require('../controllers/combinadosController');
const descuentosController = require('../controllers/descuentosController');
const historialVentasController = require('../controllers/historialVentasController');
const reportesController = require('../controllers/reportesController');
const propinasController = require('../controllers/propinasController');
const facturasController = require('../controllers/facturasController');
const turnosController = require('../controllers/turnosController');

// ========== GESTIÓN DE CLIENTES (CRÍTICO - FASE 1) ==========
const clientesRoutes = require('./clientes');

// Importar rutas de pre-tickets
const preticketsRoutes = require('./pretickets');

// Importar rutas de ofertas
const ofertasRoutes = require('./ofertas');

// ========== GESTIÓN DE CLIENTES (CRÍTICO - FASE 1) ==========
router.use('/clientes', clientesRoutes);

// ========== MESAS ==========
router.get('/mesas', mesasController.obtenerMesas);
router.get('/mesas/estado', mesasController.obtenerEstadoMesas);
router.post('/mesas', mesasController.crearMesa);

// ========== CATEGORÍAS (CRUD COMPLETO) ==========
router.get('/categorias', categoriasController.obtenerCategorias);
router.get('/categorias/estadisticas', categoriasController.obtenerEstadisticas);
router.get('/categorias/:id_tipo_comg', categoriasController.obtenerCategoriaPorId);
router.post('/categorias', categoriasController.crearCategoria);
router.put('/categorias/:id_tipo_comg', categoriasController.actualizarCategoria);
router.delete('/categorias/:id_tipo_comg', categoriasController.eliminarCategoria);

// ========== PRODUCTOS (CRUD COMPLETO) ==========
router.get('/productos', productosController.obtenerTodosProductos);
router.get('/productos/categoria/:id_categoria', productosController.obtenerProductosPorCategoria);
router.get('/productos/admin', productosControllerCRUD.obtenerProductos);
router.get('/productos/estadisticas', productosControllerCRUD.obtenerEstadisticas);
router.get('/productos/:id_complementog', productosControllerCRUD.obtenerProductoPorId);
router.post('/productos', productosControllerCRUD.crearProducto);
router.put('/productos/:id_complementog', productosControllerCRUD.actualizarProducto);
router.delete('/productos/:id_complementog', productosControllerCRUD.eliminarProducto);

// ========== OPCIONES DE PRODUCTOS ==========
router.get('/opciones', opcionesController.obtenerTodasOpciones);
router.get('/opciones/producto/:id_complementog', opcionesController.obtenerOpcionesProducto);
router.post('/opciones/actualizar-linea', opcionesController.actualizarLineaPedido);
router.post('/opciones', opcionesController.crearOpcion);
router.put('/opciones/:id_opcion', opcionesController.actualizarOpcion);
router.delete('/opciones/:id_opcion', opcionesController.eliminarOpcion);

// ========== PEDIDOS ==========
router.post('/pedidos', pedidosController.crearPedido);
router.post('/pedidos/enviar-cocina', pedidosController.enviarACocina);
router.get('/pedidos/activos', pedidosController.obtenerPedidosActivos);
router.get('/pedidos/:id_venta', pedidosController.obtenerDetallePedido);
router.post('/pedidos/cancelar', pedidosController.cancelarVenta);
router.delete('/pedidos/linea', pedidosController.eliminarLineaVenta);

// ========== CAJA (CRÍTICO) ==========
router.post('/caja/abrir', cajaController.abrirCaja);
router.post('/caja/cerrar', cajaController.cerrarCaja);
router.get('/caja/apertura/:id_caja', cajaController.obtenerAperturaActual);
router.get('/caja/ventas-dia/:id_caja', cajaController.obtenerVentasDelDia);

// ========== PAGOS (CRÍTICO) ==========
router.get('/pagos/formas', pagosController.obtenerFormasPago);
router.post('/pagos/procesar', pagosController.procesarPago);
router.get('/pagos/venta/:id_venta', pagosController.obtenerPagosVenta);

// ========== PRECUENTA Y PROPINAS ==========
router.post('/precuenta/generar', precuentaController.generarPrecuenta);
router.get('/precuenta/venta/:id_venta', precuentaController.obtenerPrecuenta);
router.post('/precuenta/marcar-impresa', precuentaController.marcarPrecuentaImpresa);
router.post('/propinas/registrar', precuentaController.registrarPropina);
router.get('/propinas/dia/:id_camarero', precuentaController.obtenerPropinasDelDia);
router.post('/propinas/entregar', precuentaController.entregarPropinas);

// ========== CONFIGURACIÓN ==========
router.get('/configuracion/restaurante', precuentaController.obtenerConfiguracionRestaurante);
router.post('/configuracion/inicial', precuentaController.guardarConfiguracionInicial);
router.get('/configuracion/verificar', precuentaController.verificarConfiguracion);

// ========== TARIFAS (CRÍTICO - FASE 1) ==========
router.get('/tarifas', tarifasController.obtenerTarifas);
router.get('/tarifas/:id', tarifasController.obtenerTarifaPorId);
router.post('/tarifas', tarifasController.crearTarifa);
router.put('/tarifas/:id', tarifasController.actualizarTarifa);
router.delete('/tarifas/:id', tarifasController.eliminarTarifa);

// Precios por tarifa
router.post('/tarifas/precio-producto', tarifasController.asignarPrecioProducto);
router.delete('/tarifas/precio-producto/:id', tarifasController.eliminarPrecioProducto);
router.get('/tarifas/precio-producto', tarifasController.obtenerPrecioProducto);

// Cambiar tarifa en venta
router.post('/tarifas/cambiar-venta', tarifasController.cambiarTarifaVenta);

// ========== PRE-TICKETS (CRÍTICO - FASE 1) ==========
router.use('/pretickets', preticketsRoutes);

// ========== OFERTAS/PROMOCIONES (CRÍTICO - FASE 1) ==========
router.use('/ofertas', ofertasRoutes);

// ========== PANEL DE COCINA (CRÍTICO - FASE 1) ==========
router.get('/panel-cocina/pedidos', panelCocinaController.obtenerPedidosPendientes);
router.post('/panel-cocina/marcar-servido', panelCocinaController.marcarServido);
router.get('/panel-cocina/estadisticas', panelCocinaController.obtenerEstadisticas);

// ========== PERMISOS GRANULARES (CRÍTICO - FASE 1) ==========
router.get('/permisos/verificar', permisosController.verificarPermiso);
router.get('/permisos/usuario/:id_usuario', permisosController.obtenerPermisosUsuario);
router.put('/permisos/usuario/:id_usuario', permisosController.actualizarPermisos);
router.post('/permisos/log', permisosController.registrarLogPermiso);
router.get('/permisos/logs', permisosController.obtenerLogsPermisos);
router.get('/permisos/plantillas', permisosController.obtenerPlantillasPorRol);

// ========== CONTROL DE STOCK/INVENTARIO (CRÍTICO - FASE 1) ==========
router.get('/stock/almacenes', stockController.obtenerAlmacenes);
router.post('/stock/almacenes', stockController.crearAlmacen);
router.get('/stock/producto/:id_producto', stockController.obtenerStockProducto);
router.get('/stock/almacen/:id_almacen', stockController.obtenerStockAlmacen);
router.get('/stock/alertas', stockController.obtenerAlertasStockBajo);
router.put('/stock/ajustar', stockController.ajustarStock);
router.get('/stock/movimientos', stockController.obtenerMovimientos);
router.post('/stock/reducir', stockController.reducirStockVenta);
router.post('/stock/restaurar', stockController.restaurarStockVenta);
router.post('/stock/producto-almacen', stockController.agregarProductoAlmacen);
router.get('/stock/estadisticas', stockController.obtenerEstadisticas);

// Gestión de packs
router.get('/stock/pack/:id_producto', stockController.obtenerComponentesPack);
router.post('/stock/pack', stockController.crearProductoPack);
router.delete('/stock/pack/:id_pack', stockController.eliminarComponentePack);

// ========== COMBINADOS/EXTRAS (CRÍTICO - FASE 1) ==========
// Rutas implementadas:
router.get('/combinados/producto/:id_producto', combinadosController.obtenerCombinadosProducto);
router.post('/combinados', combinadosController.crearCombinado);
router.put('/combinados/:id_combinado', combinadosController.actualizarCombinado);
router.delete('/combinados/:id_combinado', combinadosController.eliminarCombinado);
router.get('/combinados', combinadosController.obtenerTodosCombinados);
router.get('/combinados/estadisticas', combinadosController.obtenerEstadisticas);
router.post('/combinados/agregar-venta', combinadosController.agregarCombinadoVenta);
router.get('/combinados/linea/:id_linea_venta', combinadosController.obtenerCombinadosLinea);
router.delete('/combinados/linea/:id_venta_combinado', combinadosController.eliminarCombinadoLinea);

// Rutas pendientes de implementación (comentadas):
// router.get('/combinados/grupos', combinadosController.obtenerGrupos);
// router.get('/combinados/grupos/:id_grupo', combinadosController.obtenerGrupoPorId);
// router.post('/combinados/grupos', combinadosController.crearGrupo);
// router.put('/combinados/grupos/:id_grupo', combinadosController.actualizarGrupo);
// router.delete('/combinados/grupos/:id_grupo', combinadosController.eliminarGrupo);
// router.get('/combinados/opciones', combinadosController.obtenerOpciones);
// router.post('/combinados/opciones', combinadosController.crearOpcionCombinado);
// router.put('/combinados/opciones/:id_opcion', combinadosController.actualizarOpcionCombinado);
// router.delete('/combinados/opciones/:id_opcion', combinadosController.eliminarOpcionCombinado);
// router.post('/combinados/asignar-producto', combinadosController.asignarGrupoProducto);

// ========== DESCUENTOS (IMPORTANTE - FASE 2) ==========
router.get('/descuentos', descuentosController.obtenerDescuentos);
router.get('/descuentos/disponibles', descuentosController.obtenerDescuentosDisponibles);
router.get('/descuentos/estadisticas', descuentosController.obtenerEstadisticas);
router.get('/descuentos/:id_descuento', descuentosController.obtenerDescuentoPorId);
router.post('/descuentos', descuentosController.crearDescuento);
router.put('/descuentos/:id_descuento', descuentosController.actualizarDescuento);
router.delete('/descuentos/:id_descuento', descuentosController.eliminarDescuento);
router.post('/descuentos/aplicar', descuentosController.aplicarDescuento);
router.get('/descuentos/venta/:id_venta', descuentosController.obtenerDescuentosVenta);

// ========== HISTORIAL DE VENTAS (IMPORTANTE - FASE 2) ==========
router.get('/historial', historialVentasController.obtenerHistorial);
router.get('/historial/estadisticas', historialVentasController.obtenerEstadisticas);
router.get('/historial/top-productos', historialVentasController.obtenerTopProductos);
router.get('/historial/rendimiento-camareros', historialVentasController.obtenerRendimientoCamareros);
router.get('/historial/ventas-por-hora', historialVentasController.obtenerVentasPorHora);
router.get('/historial/resumen-hoy', historialVentasController.obtenerResumenHoy);
router.get('/historial/buscar', historialVentasController.buscarVentas);
router.get('/historial/:id_venta', historialVentasController.obtenerDetalleVenta);

// ========== REPORTES Y ESTADÍSTICAS (IMPORTANTE - FASE 2) ==========
router.get('/reportes/dashboard', reportesController.obtenerDashboard);
router.get('/reportes/ventas-diarias', reportesController.obtenerVentasDiarias);
router.get('/reportes/productos-ranking', reportesController.obtenerProductosRanking);
router.get('/reportes/categorias-ranking', reportesController.obtenerCategoriasRanking);
router.get('/reportes/rendimiento-camareros', reportesController.obtenerRendimientoCamareros);
router.get('/reportes/ventas-periodo', reportesController.obtenerVentasPorPeriodo);
router.get('/reportes/comparativa-periodos', reportesController.compararPeriodos);
router.get('/reportes/metodos-pago', reportesController.obtenerReporteMetodosPago);
router.get('/reportes/horas-pico', reportesController.obtenerHorasPico);
router.get('/reportes/top-productos-categoria', reportesController.obtenerTopProductosCategoria);
router.get('/reportes/analisis-descuentos', reportesController.obtenerAnalisisDescuentos);
router.get('/reportes/exportar-excel', reportesController.exportarExcel);
router.get('/reportes/exportar-pdf', reportesController.exportarPDF);

// ========== GESTIÓN DE PROPINAS (DESEABLE - FASE 3) ==========
router.post('/propinas/registrar', propinasController.registrarPropina);
router.get('/propinas', propinasController.obtenerPropinas);
router.get('/propinas/camarero', propinasController.obtenerPropinasPorCamarero);
router.get('/propinas/camarero/:id_camarero', propinasController.obtenerPropinasCamarero);
router.post('/propinas/distribuir', propinasController.crearDistribucion);
router.get('/propinas/distribuciones', propinasController.obtenerDistribuciones);
router.get('/propinas/distribuciones/:id_distribucion', propinasController.obtenerDetalleDistribucion);
router.post('/propinas/entregar', propinasController.entregarPropinas);
router.get('/propinas/reporte', propinasController.obtenerReporte);
router.get('/propinas/estadisticas', propinasController.obtenerEstadisticas);

// ========== IMPRESIÓN DE FACTURAS (DESEABLE - FASE 3) ==========
router.post('/facturas/emitir', facturasController.emitirFactura);
router.get('/facturas', facturasController.obtenerFacturas);
router.get('/facturas/estadisticas', facturasController.obtenerEstadisticas);
router.get('/facturas/configuracion', facturasController.obtenerConfiguracion);
router.put('/facturas/configuracion', facturasController.actualizarConfiguracion);
router.get('/facturas/folios', facturasController.obtenerFolios);
router.post('/facturas/folios', facturasController.crearFolio);
router.post('/facturas/anular', facturasController.anularFactura);
router.post('/facturas/imprimir', facturasController.registrarImpresion);
router.get('/facturas/:id_factura', facturasController.obtenerDetalleFactura);

// ========== GESTIÓN DE TURNOS (DESEABLE - FASE 3) ==========
// Turnos
router.get('/turnos', turnosController.obtenerTurnos);
router.get('/turnos/:id_turno', turnosController.obtenerTurnoPorId);
router.post('/turnos', turnosController.crearTurno);
router.put('/turnos/:id_turno', turnosController.actualizarTurno);
router.delete('/turnos/:id_turno', turnosController.eliminarTurno);

// Horarios
router.get('/horarios', turnosController.obtenerHorarios);
router.post('/horarios', turnosController.asignarHorario);
router.put('/horarios/:id_horario', turnosController.actualizarHorario);
router.delete('/horarios/:id_horario', turnosController.eliminarHorario);

// Asistencias
router.post('/asistencias/entrada', turnosController.registrarEntrada);
router.post('/asistencias/salida', turnosController.registrarSalida);
router.get('/asistencias', turnosController.obtenerAsistencias);
router.get('/asistencias/usuario/:id_usuario', turnosController.obtenerAsistenciasUsuario);
router.get('/asistencias/estadisticas', turnosController.obtenerEstadisticas);
router.post('/asistencias/manual', turnosController.registrarAsistenciaManual);

// Solicitudes de cambio
router.post('/turnos/solicitudes', turnosController.crearSolicitudCambio);
router.get('/turnos/solicitudes', turnosController.obtenerSolicitudes);
router.post('/turnos/solicitudes/aprobar', turnosController.aprobarSolicitud);
router.post('/turnos/solicitudes/rechazar', turnosController.rechazarSolicitud);

module.exports = router;
