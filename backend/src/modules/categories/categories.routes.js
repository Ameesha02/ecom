const router = require('express').Router();
const { z } = require('zod');
const prisma = require('../../config/prisma');
const redis = require('../../config/redis');
const validate = require('../../middleware/validate');
const { authenticate, authorize } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const slugify = require('../../utils/slugify');

const idParam = z.object({ id: z.string().uuid() });
const createBody = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
});
const updateBody = createBody.partial().refine((b) => Object.keys(b).length > 0, 'No fields to update');

router.get('/', asyncHandler(async (_req, res) => {
  res.json(await prisma.category.findMany({ orderBy: { name: 'asc' } }));
}));

router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const c = await prisma.category.findUnique({ where: { id: req.params.id } });
  if (!c) throw ApiError.notFound('Category not found');
  res.json(c);
}));

router.post('/', authenticate, authorize('ADMIN'), validate({ body: createBody }),
  asyncHandler(async (req, res) => {
    const c = await prisma.category.create({ data: { ...req.body, slug: slugify(req.body.name) } });
    res.status(201).json(c);
  }));

router.patch('/:id', authenticate, authorize('ADMIN'), validate({ params: idParam, body: updateBody }),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.name) data.slug = slugify(data.name);
    const c = await prisma.category.update({ where: { id: req.params.id }, data });
    await redis.invalidateProducts(); // product payloads embed the category
    res.json(c);
  }));

router.delete('/:id', authenticate, authorize('ADMIN'), validate({ params: idParam }),
  asyncHandler(async (req, res) => {
    const count = await prisma.product.count({ where: { categoryId: req.params.id } });
    if (count) throw ApiError.conflict('Category still has products');
    await prisma.category.delete({ where: { id: req.params.id } });
    res.status(204).end();
  }));

module.exports = router;
