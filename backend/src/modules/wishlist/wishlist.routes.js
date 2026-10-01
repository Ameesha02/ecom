const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../../config/prisma');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const productParam = z.object({ productId: z.string().uuid() });

router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const items = await prisma.wishlistItem.findMany({
    where: { userId: req.user.id },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(items);
}));

router.put('/:productId', validate({ params: productParam }), asyncHandler(async (req, res) => {
  const product = await prisma.product.findFirst({ where: { id: req.params.productId, isActive: true } });
  if (!product) throw ApiError.notFound('Product not found');
  const userId = req.user.id;
  const item = await prisma.wishlistItem.upsert({
    where: { userId_productId: { userId, productId: product.id } },
    create: { userId, productId: product.id },
    update: {},
  });
  res.status(201).json(item);
}));

router.delete('/:productId', validate({ params: productParam }), asyncHandler(async (req, res) => {
  await prisma.wishlistItem.deleteMany({ where: { userId: req.user.id, productId: req.params.productId } });
  res.status(204).end();
}));

module.exports = router;
