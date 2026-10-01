const router = require('express').Router();
const { z } = require('zod');
const { Prisma } = require('@prisma/client');
const prisma = require('../../config/prisma');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const productParam = z.object({ productId: z.string().uuid() });
const addBody = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(100).default(1) });
const qtyBody = z.object({ quantity: z.number().int().min(1).max(100) });

router.use(authenticate);

const getOrCreateCart = (userId) =>
  prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });

async function view(userId) {
  const cart = await prisma.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true }, orderBy: { id: 'asc' } } },
  });
  const items = cart?.items ?? [];
  const subtotal = items.reduce(
    (s, i) => s.plus(new Prisma.Decimal(i.product.price).times(i.quantity)),
    new Prisma.Decimal(0),
  );
  return { items, itemCount: items.reduce((n, i) => n + i.quantity, 0), subtotal: subtotal.toFixed(2) };
}

async function assertBuyable(productId, quantity) {
  const p = await prisma.product.findFirst({ where: { id: productId, isActive: true } });
  if (!p) throw ApiError.notFound('Product not found');
  if (p.stock < quantity) throw ApiError.conflict(`Only ${p.stock} in stock`);
}

router.get('/', asyncHandler(async (req, res) => res.json(await view(req.user.id))));

// Adds to the existing quantity (so repeated "add to cart" accumulates).
router.post('/items', validate({ body: addBody }), asyncHandler(async (req, res) => {
  const { productId, quantity } = req.body;
  const cart = await getOrCreateCart(req.user.id);
  const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } });
  const target = (existing?.quantity ?? 0) + quantity;
  await assertBuyable(productId, target);
  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity },
    update: { quantity: target },
  });
  res.status(201).json(await view(req.user.id));
}));

router.patch('/items/:productId', validate({ params: productParam, body: qtyBody }), asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  const { productId } = req.params;
  const existing = await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } });
  if (!existing) throw ApiError.notFound('Item not in cart');
  await assertBuyable(productId, req.body.quantity);
  await prisma.cartItem.update({ where: { id: existing.id }, data: { quantity: req.body.quantity } });
  res.json(await view(req.user.id));
}));

router.delete('/items/:productId', validate({ params: productParam }), asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId: req.params.productId } });
  res.json(await view(req.user.id));
}));

router.delete('/', asyncHandler(async (req, res) => {
  const cart = await getOrCreateCart(req.user.id);
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  res.status(204).end();
}));

module.exports = router;
