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
const price = z.coerce.number().positive().max(99999999).transform((n) => n.toFixed(2));

const createBody = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().min(1).max(5000),
  price,
  stock: z.coerce.number().int().min(0).default(0),
  imageUrl: z.string().url().optional(),
  categoryId: z.string().uuid(),
  isActive: z.boolean().optional(),
});
const updateBody = createBody.partial().refine((b) => Object.keys(b).length > 0, 'No fields to update');

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  categoryId: z.string().uuid().optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  sort: z.enum(['newest', 'price_asc', 'price_desc', 'name']).default('newest'),
});

const ORDER_BY = {
  newest: { createdAt: 'desc' },
  price_asc: { price: 'asc' },
  price_desc: { price: 'desc' },
  name: { name: 'asc' },
};

// Unique slug: "red-shirt", "red-shirt-2", ...
async function uniqueSlug(name, excludeId) {
  const base = slugify(name) || 'product';
  let slug = base;
  for (let i = 2; ; i++) {
    const hit = await prisma.product.findUnique({ where: { slug } });
    if (!hit || hit.id === excludeId) return slug;
    slug = `${base}-${i}`;
  }
}

// Cache-aside: list/detail responses cached in Redis under a global version key.
router.get('/', validate({ query: listQuery }), asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const key = `products:list:v${await redis.getVersion()}:${JSON.stringify(q)}`;
  const cached = await redis.cacheGet(key);
  if (cached) return res.set('X-Cache', 'HIT').json(cached);

  const where = {
    isActive: true,
    ...(q.categoryId && { categoryId: q.categoryId }),
    ...(q.search && { name: { contains: q.search, mode: 'insensitive' } }),
    ...((q.minPrice !== undefined || q.maxPrice !== undefined) && {
      price: { ...(q.minPrice !== undefined && { gte: q.minPrice }), ...(q.maxPrice !== undefined && { lte: q.maxPrice }) },
    }),
  };
  const [total, items] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[q.sort],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: { category: { select: { id: true, name: true, slug: true } } },
    }),
  ]);
  const body = { items, page: q.page, limit: q.limit, total, totalPages: Math.ceil(total / q.limit) };
  await redis.cacheSet(key, body);
  res.set('X-Cache', 'MISS').json(body);
}));

router.get('/:id', validate({ params: idParam }), asyncHandler(async (req, res) => {
  const key = `products:item:v${await redis.getVersion()}:${req.params.id}`;
  const cached = await redis.cacheGet(key);
  if (cached) return res.set('X-Cache', 'HIT').json(cached);
  const p = await prisma.product.findFirst({
    where: { id: req.params.id, isActive: true },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!p) throw ApiError.notFound('Product not found');
  await redis.cacheSet(key, p);
  res.set('X-Cache', 'MISS').json(p);
}));

const admin = [authenticate, authorize('ADMIN')];

router.post('/', ...admin, validate({ body: createBody }), asyncHandler(async (req, res) => {
  const category = await prisma.category.findUnique({ where: { id: req.body.categoryId } });
  if (!category) throw ApiError.badRequest('Unknown categoryId');
  const p = await prisma.product.create({ data: { ...req.body, slug: await uniqueSlug(req.body.name) } });
  await redis.invalidateProducts();
  res.status(201).json(p);
}));

router.patch('/:id', ...admin, validate({ params: idParam, body: updateBody }), asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (data.name) data.slug = await uniqueSlug(data.name, req.params.id);
  const p = await prisma.product.update({ where: { id: req.params.id }, data });
  await redis.invalidateProducts();
  res.json(p);
}));

// Soft delete: order history keeps referencing the product.
router.delete('/:id', ...admin, validate({ params: idParam }), asyncHandler(async (req, res) => {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  await redis.invalidateProducts();
  res.status(204).end();
}));

module.exports = router;
