// DB-free tests: routing, auth guards, validation and docs.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const token = (role) => jwt.sign({ sub: '11111111-1111-4111-8111-111111111111', role }, 'test-access');

test('health check', async () => {
  const r = await request(app).get('/health');
  expect(r.status).toBe(200);
  expect(r.body.status).toBe('ok');
});

test('serves OpenAPI spec covering all modules', async () => {
  const r = await request(app).get('/openapi.json');
  expect(r.status).toBe(200);
  expect(Object.keys(r.body.paths)).toEqual(
    expect.arrayContaining(['/auth/login', '/products', '/cart/items', '/orders', '/payments']),
  );
});

test('unknown route returns JSON 404', async () => {
  const r = await request(app).get('/nope');
  expect(r.status).toBe(404);
  expect(r.body.error.message).toMatch(/not found/i);
});

test.each(['/api/v1/cart', '/api/v1/orders', '/api/v1/wishlist', '/api/v1/auth/me'])(
  'protected route %s requires a token', async (path) => {
    expect((await request(app).get(path)).status).toBe(401);
  });

test('rejects a forged token', async () => {
  const r = await request(app).get('/api/v1/cart').set('Authorization', 'Bearer forged.token.here');
  expect(r.status).toBe(401);
});

test('customers cannot create products (RBAC)', async () => {
  const r = await request(app).post('/api/v1/products').set('Authorization', `Bearer ${token('CUSTOMER')}`).send({});
  expect(r.status).toBe(403);
});

test('register validates input', async () => {
  const r = await request(app).post('/api/v1/auth/register').send({ email: 'bad', password: '123', name: '' });
  expect(r.status).toBe(400);
  expect(r.body.error.details.map((d) => d.path)).toEqual(expect.arrayContaining(['email', 'password', 'name']));
});

test('malformed JSON returns 400', async () => {
  const r = await request(app).post('/api/v1/auth/login').set('Content-Type', 'application/json').send('{bad');
  expect(r.status).toBe(400);
});

test('product list rejects invalid query', async () => {
  expect((await request(app).get('/api/v1/products?limit=9999')).status).toBe(400);
});
