const router = require('express').Router();
const crypto = require('crypto');
const { z } = require('zod');
const prisma = require('../../config/prisma');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const payBody = z.object({
  orderId: z.string().uuid(),
  method: z.enum(['card', 'upi', 'netbanking']).default('card'),
  // Sandbox switch so failure paths are testable; a real gateway would decide this itself.
  simulate: z.enum(['success', 'failure']).default('success'),
});
const orderParam = z.object({ orderId: z.string().uuid() });

// Stand-in for Stripe/Razorpay: returns a transaction id and an outcome.
const mockGateway = ({ simulate }) => ({
  transactionId: `txn_${crypto.randomBytes(8).toString('hex')}`,
  ok: simulate === 'success',
});

router.use(authenticate);

router.post('/', validate({ body: payBody }), asyncHandler(async (req, res) => {
  const { orderId, method, simulate } = req.body;
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.userId !== req.user.id) throw ApiError.notFound('Order not found');
  if (order.status !== 'PENDING') throw ApiError.conflict(`Order is ${order.status}, cannot be paid`);

  const gw = mockGateway({ simulate });
  const payment = await prisma.$transaction(async (tx) => {
    // Atomic PENDING -> PAID guard: concurrent pay requests can only succeed once.
    if (gw.ok) {
      const r = await tx.order.updateMany({ where: { id: orderId, status: 'PENDING' }, data: { status: 'PAID' } });
      if (r.count === 0) throw ApiError.conflict('Order is already being paid');
    }
    const data = {
      amount: order.total,
      method,
      status: gw.ok ? 'SUCCEEDED' : 'FAILED',
      transactionId: gw.transactionId,
    };
    // One payment row per order; a retry after FAILED overwrites it.
    return tx.payment.upsert({ where: { orderId }, create: { orderId, ...data }, update: data });
  });

  res.status(gw.ok ? 201 : 402).json(payment);
}));

router.get('/order/:orderId', validate({ params: orderParam }), asyncHandler(async (req, res) => {
  const payment = await prisma.payment.findUnique({
    where: { orderId: req.params.orderId },
    include: { order: { select: { userId: true } } },
  });
  if (!payment || (payment.order.userId !== req.user.id && req.user.role !== 'ADMIN')) {
    throw ApiError.notFound('Payment not found');
  }
  const { order, ...rest } = payment;
  res.json(rest);
}));

module.exports = router;
