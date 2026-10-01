const router = require('express').Router();
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');
const svc = require('./auth.service');

// Brute-force protection on credential endpoints (disabled under test).
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { error: { message: 'Too many attempts, try again later' } },
});

const email = z.string().email().toLowerCase();
const credentials = z.object({ email, password: z.string().min(1) });
const registerBody = z.object({
  email,
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(72),
});
const tokenBody = z.object({ refreshToken: z.string().min(1) });

router.post('/register', limiter, validate({ body: registerBody }),
  asyncHandler(async (req, res) => res.status(201).json(await svc.register(req.body))));

router.post('/login', limiter, validate({ body: credentials }),
  asyncHandler(async (req, res) => res.json(await svc.login(req.body))));

router.post('/refresh', validate({ body: tokenBody }),
  asyncHandler(async (req, res) => res.json(await svc.refresh(req.body.refreshToken))));

router.post('/logout', validate({ body: tokenBody }),
  asyncHandler(async (req, res) => {
    await svc.logout(req.body.refreshToken);
    res.status(204).end();
  }));

router.get('/me', authenticate, asyncHandler(async (req, res) => res.json(await svc.me(req.user.id))));

module.exports = router;
