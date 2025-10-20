/**
 * DYSA Point - Rutas de Tickets (POS)
 * Endpoints para gestión de tickets/ventas con sincronización SSE
 * Fecha: 19 de Octubre 2025
 */

const express = require('express');
const TicketsController = require('../controllers/tickets-working.controller');

const router = express.Router();
const ticketsController = new TicketsController();

// === RUTAS PRINCIPALES ===

/**
 * @swagger
 * /api/pos/tickets:
 *   post:
 *     summary: Crear nuevo ticket
 *     tags: [POS Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - empleado_vendedor_id
 *             properties:
 *               mesa_id:
 *                 type: integer
 *                 description: ID de la mesa (requerido para tipo MESA)
 *               empleado_vendedor_id:
 *                 type: integer
 *                 description: ID del empleado vendedor
 *               terminal_id:
 *                 type: integer
 *                 description: ID del terminal
 *                 default: 1
 *               tipo_venta:
 *                 type: string
 *                 enum: [MESA, DELIVERY, TAKEAWAY, DRIVE_THRU, ONLINE]
 *                 default: MESA
 *               modalidad_pago:
 *                 type: string
 *                 enum: [CONTADO, CREDITO, MIXTO]
 *                 default: CONTADO
 *               numero_comensales:
 *                 type: integer
 *                 description: Número de comensales para la mesa
 *               nombre_cliente:
 *                 type: string
 *                 description: Nombre del cliente (delivery/takeaway)
 *               telefono_cliente:
 *                 type: string
 *                 description: Teléfono del cliente
 *               direccion_entrega:
 *                 type: string
 *                 description: Dirección de entrega (delivery)
 *               observaciones_generales:
 *                 type: string
 *                 description: Observaciones del ticket
 *               comentarios_cliente:
 *                 type: string
 *                 description: Comentarios del cliente
 *     responses:
 *       201:
 *         description: Ticket creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Ticket'
 *                 message:
 *                   type: string
 *                   example: Ticket creado exitosamente
 */
router.post('/', (req, res) => ticketsController.crearTicket(req, res));

/**
 * @swagger
 * /api/pos/tickets:
 *   get:
 *     summary: Listar tickets con filtros
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: query
 *         name: mesa_id
 *         schema:
 *           type: integer
 *         description: Filtrar por mesa
 *       - in: query
 *         name: estado_venta
 *         schema:
 *           type: string
 *           enum: [ABIERTA, CERRADA, PAGADA, ANULADA, EN_PROCESO]
 *         description: Filtrar por estado de venta
 *       - in: query
 *         name: estado_cocina
 *         schema:
 *           type: string
 *           enum: [PENDIENTE, EN_PREPARACION, LISTO, ENTREGADO]
 *         description: Filtrar por estado de cocina
 *       - in: query
 *         name: estado_pago
 *         schema:
 *           type: string
 *           enum: [PENDIENTE, PAGADO_PARCIAL, PAGADO_TOTAL, SOBREPAGO]
 *         description: Filtrar por estado de pago
 *       - in: query
 *         name: tipo_venta
 *         schema:
 *           type: string
 *           enum: [MESA, DELIVERY, TAKEAWAY, DRIVE_THRU, ONLINE]
 *         description: Filtrar por tipo de venta
 *       - in: query
 *         name: empleado_vendedor_id
 *         schema:
 *           type: integer
 *         description: Filtrar por vendedor
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha desde (YYYY-MM-DD)
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha hasta (YYYY-MM-DD)
 *       - in: query
 *         name: buscar
 *         schema:
 *           type: string
 *         description: Buscar en número de venta, cliente u observaciones
 *       - in: query
 *         name: orden
 *         schema:
 *           type: string
 *           default: timestamp_inicio DESC
 *         description: Orden de resultados
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Límite de resultados
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Offset para paginación
 *     responses:
 *       200:
 *         description: Lista de tickets
 */
router.get('/', (req, res) => ticketsController.listarTickets(req, res));

/**
 * @swagger
 * /api/pos/tickets/estadisticas:
 *   get:
 *     summary: Obtener estadísticas de tickets
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: query
 *         name: fecha_desde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha desde
 *       - in: query
 *         name: fecha_hasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha hasta
 *     responses:
 *       200:
 *         description: Estadísticas de tickets
 */
router.get('/estadisticas', (req, res) => ticketsController.obtenerEstadisticas(req, res));

/**
 * @swagger
 * /api/pos/tickets/{id}:
 *   get:
 *     summary: Obtener ticket por ID
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ticket
 *     responses:
 *       200:
 *         description: Ticket encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/TicketCompleto'
 *       404:
 *         description: Ticket no encontrado
 */
router.get('/:id(\\d+)', (req, res) => ticketsController.obtenerTicket(req, res));

// === GESTIÓN DE ITEMS ===

/**
 * @swagger
 * /api/pos/tickets/{id}/items:
 *   post:
 *     summary: Agregar item al ticket
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - producto_id
 *               - cantidad
 *             properties:
 *               producto_id:
 *                 type: integer
 *                 description: ID del producto
 *               cantidad:
 *                 type: number
 *                 minimum: 0.001
 *                 description: Cantidad del producto
 *               precio_unitario:
 *                 type: number
 *                 description: Precio unitario (opcional, toma del producto)
 *               descuento_porcentaje:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Porcentaje de descuento
 *               modificaciones_solicitadas:
 *                 type: string
 *                 description: Modificaciones especiales
 *               ingredientes_removidos:
 *                 type: string
 *                 description: Ingredientes a remover
 *               ingredientes_agregados:
 *                 type: string
 *                 description: Ingredientes extra
 *               nivel_coccion:
 *                 type: string
 *                 description: Nivel de cocción (ej. término medio)
 *               observaciones_item:
 *                 type: string
 *                 description: Observaciones del item
 *               es_cortesia:
 *                 type: boolean
 *                 default: false
 *                 description: Si es cortesía
 *     responses:
 *       201:
 *         description: Item agregado exitosamente
 */
router.post('/:id(\\d+)/items', (req, res) => ticketsController.agregarItem(req, res));

/**
 * @swagger
 * /api/pos/tickets/{id}/items/{itemId}:
 *   put:
 *     summary: Actualizar item del ticket
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ticket
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del item
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cantidad:
 *                 type: number
 *                 minimum: 0.001
 *               modificaciones_solicitadas:
 *                 type: string
 *               ingredientes_removidos:
 *                 type: string
 *               ingredientes_agregados:
 *                 type: string
 *               nivel_coccion:
 *                 type: string
 *               observaciones_item:
 *                 type: string
 *               estado_preparacion:
 *                 type: string
 *                 enum: [PENDIENTE, EN_PREPARACION, LISTO, ENTREGADO, CANCELADO]
 *     responses:
 *       200:
 *         description: Item actualizado exitosamente
 */
router.put('/:id(\\d+)/items/:itemId(\\d+)', (req, res) => ticketsController.actualizarItem(req, res));

/**
 * @swagger
 * /api/pos/tickets/{id}/items/{itemId}:
 *   delete:
 *     summary: Remover item del ticket
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ticket
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del item
 *     responses:
 *       200:
 *         description: Item removido exitosamente
 */
router.delete('/:id(\\d+)/items/:itemId(\\d+)', (req, res) => ticketsController.removerItem(req, res));

// === GESTIÓN DE ESTADO ===

/**
 * @swagger
 * /api/pos/tickets/{id}/estado:
 *   put:
 *     summary: Actualizar estado del ticket
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ticket
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               estado_venta:
 *                 type: string
 *                 enum: [ABIERTA, CERRADA, PAGADA, ANULADA, EN_PROCESO]
 *               estado_cocina:
 *                 type: string
 *                 enum: [PENDIENTE, EN_PREPARACION, LISTO, ENTREGADO]
 *               estado_pago:
 *                 type: string
 *                 enum: [PENDIENTE, PAGADO_PARCIAL, PAGADO_TOTAL, SOBREPAGO]
 *               observaciones_generales:
 *                 type: string
 *               propina_recibida:
 *                 type: number
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Estado actualizado exitosamente
 */
router.put('/:id(\\d+)/estado', (req, res) => ticketsController.actualizarEstado(req, res));

// === OPERACIONES SPLIT/MERGE ===

/**
 * @swagger
 * /api/pos/tickets/{id}/split/items:
 *   post:
 *     summary: Split de ticket por ítems específicos
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ticket original
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items_para_nuevo_ticket
 *             properties:
 *               items_para_nuevo_ticket:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: IDs de items para mover al nuevo ticket
 *               datos_nuevo_ticket:
 *                 type: object
 *                 properties:
 *                   observaciones_generales:
 *                     type: string
 *                   comentarios_cliente:
 *                     type: string
 *     responses:
 *       201:
 *         description: Ticket dividido exitosamente
 */
router.post('/:id(\\d+)/split/items', (req, res) => ticketsController.splitTicketPorItems(req, res));

/**
 * @swagger
 * /api/pos/tickets/{id}/split/comensales:
 *   post:
 *     summary: Split de ticket por número de comensales
 *     tags: [POS Tickets]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID del ticket original
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - numero_comensales
 *             properties:
 *               numero_comensales:
 *                 type: integer
 *                 minimum: 2
 *                 description: Número de comensales para dividir
 *     responses:
 *       201:
 *         description: Ticket dividido exitosamente
 */
router.post('/:id(\\d+)/split/comensales', (req, res) => ticketsController.splitTicketPorComensales(req, res));

/**
 * @swagger
 * /api/pos/tickets/merge:
 *   post:
 *     summary: Merge de múltiples tickets
 *     tags: [POS Tickets]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ticket_principal_id
 *               - tickets_secundarios_ids
 *             properties:
 *               ticket_principal_id:
 *                 type: integer
 *                 description: ID del ticket que recibirá todos los items
 *               tickets_secundarios_ids:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: IDs de tickets a fusionar
 *     responses:
 *       200:
 *         description: Tickets fusionados exitosamente
 */
router.post('/merge', (req, res) => ticketsController.mergeTickets(req, res));

// === MIDDLEWARE DE VALIDACIÓN ===

// Middleware para validar IDs numéricos
router.param('id', (req, res, next, id) => {
  const numId = parseInt(id);
  if (isNaN(numId) || numId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'ID de ticket inválido'
    });
  }
  req.params.id = numId;
  next();
});

router.param('itemId', (req, res, next, itemId) => {
  const numId = parseInt(itemId);
  if (isNaN(numId) || numId <= 0) {
    return res.status(400).json({
      success: false,
      error: 'ID de item inválido'
    });
  }
  req.params.itemId = numId;
  next();
});

// Header para identificar el router
router.use((req, res, next) => {
  res.setHeader('X-Router', 'pos-tickets-v1');
  next();
});

/**
 * @swagger
 * components:
 *   schemas:
 *     Ticket:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         numero_venta:
 *           type: string
 *         mesa_id:
 *           type: integer
 *         empleado_vendedor_id:
 *           type: integer
 *         estado_venta:
 *           type: string
 *         estado_cocina:
 *           type: string
 *         estado_pago:
 *           type: string
 *         total_final:
 *           type: number
 *         timestamp_inicio:
 *           type: string
 *           format: date-time
 *     TicketCompleto:
 *       allOf:
 *         - $ref: '#/components/schemas/Ticket'
 *         - type: object
 *           properties:
 *             items:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TicketItem'
 *             pagos:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Pago'
 *             estadisticas:
 *               $ref: '#/components/schemas/EstadisticasTicket'
 *     TicketItem:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         producto_id:
 *           type: integer
 *         nombre_producto:
 *           type: string
 *         cantidad:
 *           type: number
 *         precio_unitario:
 *           type: number
 *         subtotal_con_descuento:
 *           type: number
 *         estado_preparacion:
 *           type: string
 *     EstadisticasTicket:
 *       type: object
 *       properties:
 *         total_items:
 *           type: integer
 *         items_pendientes:
 *           type: integer
 *         items_en_preparacion:
 *           type: integer
 *         items_listos:
 *           type: integer
 *         items_entregados:
 *           type: integer
 *         total_pagado:
 *           type: number
 *         saldo_pendiente:
 *           type: number
 */

module.exports = router;