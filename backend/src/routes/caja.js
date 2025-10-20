/**
 * DYSA Point - Rutas de Caja/Pagos
 * Endpoints para gestión de pagos, métodos de pago y cierres de caja
 * Fecha: 20 de Octubre 2025
 */

const express = require('express');
const CajaController = require('../controllers/caja.controller');

const router = express.Router();
const cajaController = new CajaController();

// === RUTAS PRINCIPALES ===

/**
 * @swagger
 * /api/pos/caja/pagos:
 *   post:
 *     summary: Registrar pago de un ticket
 *     tags: [POS Caja]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - venta_id
 *               - metodo_pago_id
 *               - monto_pagado
 *             properties:
 *               venta_id:
 *                 type: integer
 *                 description: ID del ticket/venta a pagar
 *               metodo_pago_id:
 *                 type: integer
 *                 description: ID del método de pago
 *               monto_pagado:
 *                 type: number
 *                 format: float
 *                 description: Monto a pagar
 *               monto_propina:
 *                 type: number
 *                 format: float
 *                 description: Monto de propina opcional
 *     responses:
 *       200:
 *         description: Pago registrado exitosamente
 *       400:
 *         description: Datos de entrada inválidos
 *       500:
 *         description: Error interno del servidor
 */
router.post('/pagos', (req, res) => cajaController.registrarPago(req, res));

/**
 * @swagger
 * /api/pos/caja/metodos:
 *   get:
 *     summary: Obtener métodos de pago disponibles
 *     tags: [POS Caja]
 *     responses:
 *       200:
 *         description: Lista de métodos de pago
 *       500:
 *         description: Error interno del servidor
 */
router.get('/metodos', (req, res) => cajaController.obtenerMetodosPago(req, res));

/**
 * @swagger
 * /api/pos/caja/cierre:
 *   post:
 *     summary: Realizar cierre simple de caja
 *     tags: [POS Caja]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               monto_inicial_efectivo:
 *                 type: number
 *                 format: float
 *                 description: Monto inicial de efectivo en caja
 *               monto_final_efectivo:
 *                 type: number
 *                 format: float
 *                 description: Monto final de efectivo en caja
 *               observaciones:
 *                 type: string
 *                 description: Observaciones del cierre
 *     responses:
 *       200:
 *         description: Cierre realizado exitosamente
 *       500:
 *         description: Error interno del servidor
 */
router.post('/cierre', (req, res) => cajaController.realizarCierre(req, res));

/**
 * @swagger
 * /api/pos/caja/resumen:
 *   get:
 *     summary: Obtener resumen de caja del día
 *     tags: [POS Caja]
 *     parameters:
 *       - in: query
 *         name: fecha
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha específica (YYYY-MM-DD), por defecto hoy
 *     responses:
 *       200:
 *         description: Resumen de caja obtenido
 *       500:
 *         description: Error interno del servidor
 */
router.get('/resumen', (req, res) => cajaController.obtenerResumen(req, res));

/**
 * @swagger
 * /api/pos/caja/estadisticas:
 *   get:
 *     summary: Obtener estadísticas de pagos y caja
 *     tags: [POS Caja]
 *     responses:
 *       200:
 *         description: Estadísticas obtenidas exitosamente
 *       500:
 *         description: Error interno del servidor
 */
router.get('/estadisticas', (req, res) => cajaController.obtenerEstadisticas(req, res));

module.exports = router;