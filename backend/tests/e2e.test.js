// Full shopping journey against a real Postgres. Skipped when DATABASE_URL is not set.
const request = require('supertest');
const bcrypt = require('bcryptjs');

const run = process.env.DATABASE_URL ? describe : describe.skip;

run('e2e: register -> browse -> cart -> order -> pay -> ship / cancel', () => {
  const app = require('../src/app');
  const prisma = require('../src/config/prisma');
  const tag = Date.now();
  const adminEmail = `admin-${tag}@test.dev`;
  const userEmail = `user-${tag}@test.dev`;
  let adminToken, userToken, userRefresh, categoryId, product;

  const as = (t) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    await prisma.user.create({
      data: { email: adminEmail, name: 'Admin', role: 'ADMIN', passwordHash: await bcrypt.hash('Admin@12345', 4) },
    });
    adminToken = (await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: 'Admin@12345' })).body.accessToken;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  test('admin builds the catalog', async () => {
    const c = await request(app).post('/api/v1/categories').set(as(adminToken)).send({ name: `Cat ${tag}` });
    expect(c.status).toBe(201);
    categoryId = c.body.id;
    const p = await request(app).post('/api/v1/products').set(as(adminToken))
      .send({ name: `Widget ${tag}`, description: 'A widget', price: 10.5, stock: 5, categoryId });
    expect(p.status).toBe(201);
    product = p.body;
  });

  test('customer registers, and role cannot be self-assigned', async () => {
    const r = await request(app).post('/api/v1/auth/register')
      .send({ email: userEmail, name: 'Test User', password: 'Passw0rd!', role: 'ADMIN' });
    expect(r.status).toBe(201);
    expect(r.body.user.role).toBe('CUSTOMER');
    userToken = r.body.accessToken;
    userRefresh = r.body.refreshToken;
  });

  test('refresh token rotates and old token is rejected (reuse detection)', async () => {
    const a = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: userRefresh });
    expect(a.status).toBe(200);
    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: userRefresh });
    expect(reuse.status).toBe(401);
    // reuse revoked the whole family, so the new token is dead too
    expect((await request(app).post('/api/v1/auth/refresh').send({ refreshToken: a.body.refreshToken })).status).toBe(401);
  });

  test('browse, search and wishlist', async () => {
    const list = await request(app).get(`/api/v1/products?search=widget ${tag}`);
    expect(list.body.total).toBe(1);
    const w = await request(app).put(`/api/v1/wishlist/${product.id}`).set(as(userToken));
    expect(w.status).toBe(201);
    expect((await request(app).get('/api/v1/wishlist').set(as(userToken))).body).toHaveLength(1);
  });

  test('cart enforces stock and computes subtotal', async () => {
    const over = await request(app).post('/api/v1/cart/items').set(as(userToken)).send({ productId: product.id, quantity: 6 });
    expect(over.status).toBe(409);
    const ok = await request(app).post('/api/v1/cart/items').set(as(userToken)).send({ productId: product.id, quantity: 2 });
    expect(ok.status).toBe(201);
    expect(ok.body.subtotal).toBe('21.00');
  });

  let order;
  test('checkout creates order, decrements stock, empties cart', async () => {
    const r = await request(app).post('/api/v1/orders').set(as(userToken)).send({ shippingAddress: '221B Baker Street' });
    expect(r.status).toBe(201);
    expect(Number(r.body.total)).toBe(21);
    order = r.body;
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stock).toBe(3);
    expect((await request(app).get('/api/v1/cart').set(as(userToken))).body.itemCount).toBe(0);
    expect((await request(app).post('/api/v1/orders').set(as(userToken)).send({ shippingAddress: '221B Baker Street' })).status).toBe(400);
  });

  test('failed payment leaves order pending; retry succeeds', async () => {
    const bad = await request(app).post('/api/v1/payments').set(as(userToken)).send({ orderId: order.id, simulate: 'failure' });
    expect(bad.status).toBe(402);
    const good = await request(app).post('/api/v1/payments').set(as(userToken)).send({ orderId: order.id });
    expect(good.status).toBe(201);
    expect((await request(app).get(`/api/v1/orders/${order.id}`).set(as(userToken))).body.status).toBe('PAID');
    expect((await request(app).post('/api/v1/payments').set(as(userToken)).send({ orderId: order.id })).status).toBe(409);
  });

  test('admin ships; shipped orders cannot be cancelled', async () => {
    const s = await request(app).patch(`/api/v1/orders/${order.id}/status`).set(as(adminToken)).send({ status: 'SHIPPED' });
    expect(s.body.status).toBe('SHIPPED');
    expect((await request(app).post(`/api/v1/orders/${order.id}/cancel`).set(as(userToken))).status).toBe(409);
  });

  test('cancelling a paid order restocks and refunds', async () => {
    await request(app).post('/api/v1/cart/items').set(as(userToken)).send({ productId: product.id, quantity: 1 });
    const o = (await request(app).post('/api/v1/orders').set(as(userToken)).send({ shippingAddress: '221B Baker Street' })).body;
    await request(app).post('/api/v1/payments').set(as(userToken)).send({ orderId: o.id });
    const c = await request(app).post(`/api/v1/orders/${o.id}/cancel`).set(as(userToken));
    expect(c.body.status).toBe('CANCELLED');
    expect(c.body.payment.status).toBe('REFUNDED');
    expect((await prisma.product.findUnique({ where: { id: product.id } })).stock).toBe(3);
  });

  test("users cannot see each other's orders", async () => {
    const other = await request(app).post('/api/v1/auth/register')
      .send({ email: `other-${tag}@test.dev`, name: 'Other', password: 'Passw0rd!' });
    expect((await request(app).get(`/api/v1/orders/${order.id}`).set(as(other.body.accessToken))).status).toBe(404);
  });
});
