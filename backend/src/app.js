const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const env = require('./config/env');
const redis = require('./config/redis');
const openapi = require('./docs/openapi');
const { notFound, errorHandler } = require('./middleware/error');

const app = express();

app.use(helmet({ contentSecurityPolicy: false })); // CSP off so Swagger UI's inline assets load
app.use(cors());
app.use(express.json({ limit: '100kb' }));
if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'combined' : 'dev'));

app.get('/health', async (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), redis: await redis.ping() });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));
app.get('/openapi.json', (_req, res) => res.json(openapi));

const v1 = express.Router();
v1.use('/auth', require('./modules/auth/auth.routes'));
v1.use('/categories', require('./modules/categories/categories.routes'));
v1.use('/products', require('./modules/products/products.routes'));
v1.use('/cart', require('./modules/cart/cart.routes'));
v1.use('/wishlist', require('./modules/wishlist/wishlist.routes'));
v1.use('/orders', require('./modules/orders/orders.routes'));
v1.use('/payments', require('./modules/payments/payments.routes'));
app.use('/api/v1', v1);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
