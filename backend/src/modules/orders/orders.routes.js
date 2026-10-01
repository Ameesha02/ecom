const router = require('express').Router();
const { z } = require('zod');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const svc = require('./orders.service');

const idParam = z.object({ id: z.string().uuid() });
const createBody = z.object({ shippingAddress: z.string().trim().min(5).max(500) });
const statusBody = z.object({ status: z.enum(['SHIPPED', 'DELIVERED']) });

router.use(authenticate);

router.post('/', validate({ body: createBody }), asyncHandler(async (req, res) =>
  res.status(201).json(await svc.placeOrder(req.user.id, req.body.shippingAddress))));

router.get('/', asyncHandler(async (req, res) => res.json(await svc.listOrders(req.user))));

router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await svc.getOrder(req.user, req.params.id))));

router.post('/:id/cancel', validate({ params: idParam }), asyncHandler(async (req, res) =>
  res.json(await svc.cancelOrder(req.user, req.params.id))));

router.patch('/:id/status', authorize('ADMIN'), validate({ params: idParam, body: statusBody }),
  asyncHandler(async (req, res) => res.json(await svc.advanceStatus(req.params.id, req.body.status))));

module.exports = router;
