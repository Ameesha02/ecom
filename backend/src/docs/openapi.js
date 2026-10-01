// OpenAPI 3.0 spec served at /api-docs (Swagger UI) and /openapi.json.
const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const body = (schema) => ({ required: true, ...json(schema) });
const ok = (description, schema) => ({ description, ...(schema ? json(schema) : {}) });
const arr = (n) => ({ type: 'array', items: ref(n) });
const obj = (properties, required) => ({ type: 'object', properties, ...(required && { required }) });
const str = { type: 'string' };
const uuid = { type: 'string', format: 'uuid' };
const pathId = (name) => ({ name, in: 'path', required: true, schema: uuid });
const secured = [{ bearerAuth: [] }];
const errs = { 400: ok('Validation error', ref('Error')), 401: ok('Unauthorized', ref('Error')), 404: ok('Not found', ref('Error')) };

const queryParams = ['page', 'limit', 'search', 'categoryId', 'minPrice', 'maxPrice', 'sort'].map((name) => ({
  name,
  in: 'query',
  schema: name === 'sort' ? { type: 'string', enum: ['newest', 'price_asc', 'price_desc', 'name'] }
    : name === 'categoryId' ? uuid : name === 'search' ? str : { type: 'number' },
}));

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'E-Commerce Backend API',
    version: '1.0.0',
    description: 'Products, categories, cart, wishlist, orders and payments with JWT auth + refresh-token rotation and role-based access.',
  },
  servers: [{ url: '/api/v1' }],
  tags: ['Auth', 'Categories', 'Products', 'Cart', 'Wishlist', 'Orders', 'Payments'].map((name) => ({ name })),
  components: {
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Error: obj({ error: obj({ message: str, details: { type: 'array', items: obj({ path: str, message: str }) } }) }),
      User: obj({ id: uuid, email: str, name: str, role: { type: 'string', enum: ['CUSTOMER', 'ADMIN'] } }),
      AuthResponse: obj({ user: ref('User'), accessToken: str, refreshToken: str }),
      TokenPair: obj({ accessToken: str, refreshToken: str }),
      Category: obj({ id: uuid, name: str, slug: str, description: str }),
      Product: obj({
        id: uuid, name: str, slug: str, description: str, price: { type: 'string', example: '49.99' },
        stock: { type: 'integer' }, imageUrl: str, isActive: { type: 'boolean' }, categoryId: uuid,
      }),
      ProductPage: obj({ items: arr('Product'), page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } }),
      Cart: obj({ items: { type: 'array', items: obj({ id: uuid, productId: uuid, quantity: { type: 'integer' }, product: ref('Product') }) }, itemCount: { type: 'integer' }, subtotal: str }),
      OrderItem: obj({ id: uuid, productId: uuid, name: str, price: str, quantity: { type: 'integer' } }),
      Payment: obj({ id: uuid, orderId: uuid, amount: str, method: str, status: { type: 'string', enum: ['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED'] }, transactionId: str }),
      Order: obj({
        id: uuid, userId: uuid, status: { type: 'string', enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'] },
        total: str, shippingAddress: str, items: arr('OrderItem'), payment: ref('Payment'),
      }),
    },
  },
  paths: {
    '/auth/register': { post: { tags: ['Auth'], summary: 'Create a customer account',
      requestBody: body(obj({ email: str, name: str, password: { type: 'string', minLength: 8 } }, ['email', 'name', 'password'])),
      responses: { 201: ok('Created', ref('AuthResponse')), 400: errs[400], 409: ok('Email taken', ref('Error')) } } },
    '/auth/login': { post: { tags: ['Auth'], summary: 'Log in',
      requestBody: body(obj({ email: str, password: str }, ['email', 'password'])),
      responses: { 200: ok('OK', ref('AuthResponse')), 401: errs[401] } } },
    '/auth/refresh': { post: { tags: ['Auth'], summary: 'Rotate refresh token',
      requestBody: body(obj({ refreshToken: str }, ['refreshToken'])),
      responses: { 200: ok('New token pair', ref('TokenPair')), 401: errs[401] } } },
    '/auth/logout': { post: { tags: ['Auth'], summary: 'Revoke a refresh token',
      requestBody: body(obj({ refreshToken: str }, ['refreshToken'])), responses: { 204: ok('Logged out') } } },
    '/auth/me': { get: { tags: ['Auth'], summary: 'Current user', security: secured, responses: { 200: ok('OK', ref('User')), 401: errs[401] } } },

    '/categories': {
      get: { tags: ['Categories'], summary: 'List categories', responses: { 200: ok('OK', arr('Category')) } },
      post: { tags: ['Categories'], summary: 'Create (admin)', security: secured,
        requestBody: body(obj({ name: str, description: str }, ['name'])), responses: { 201: ok('Created', ref('Category')), 403: ok('Forbidden', ref('Error')) } },
    },
    '/categories/{id}': {
      get: { tags: ['Categories'], summary: 'Get category', parameters: [pathId('id')], responses: { 200: ok('OK', ref('Category')), 404: errs[404] } },
      patch: { tags: ['Categories'], summary: 'Update (admin)', security: secured, parameters: [pathId('id')],
        requestBody: body(obj({ name: str, description: str })), responses: { 200: ok('OK', ref('Category')) } },
      delete: { tags: ['Categories'], summary: 'Delete empty category (admin)', security: secured, parameters: [pathId('id')],
        responses: { 204: ok('Deleted'), 409: ok('Has products', ref('Error')) } },
    },

    '/products': {
      get: { tags: ['Products'], summary: 'Search, filter, sort, paginate (Redis-cached; see X-Cache header)', parameters: queryParams,
        responses: { 200: ok('OK', ref('ProductPage')) } },
      post: { tags: ['Products'], summary: 'Create (admin)', security: secured,
        requestBody: body(obj({ name: str, description: str, price: { type: 'number' }, stock: { type: 'integer' }, imageUrl: str, categoryId: uuid }, ['name', 'description', 'price', 'categoryId'])),
        responses: { 201: ok('Created', ref('Product')), 400: errs[400], 403: ok('Forbidden', ref('Error')) } },
    },
    '/products/{id}': {
      get: { tags: ['Products'], summary: 'Get product', parameters: [pathId('id')], responses: { 200: ok('OK', ref('Product')), 404: errs[404] } },
      patch: { tags: ['Products'], summary: 'Update (admin)', security: secured, parameters: [pathId('id')],
        requestBody: body(obj({ name: str, description: str, price: { type: 'number' }, stock: { type: 'integer' }, isActive: { type: 'boolean' } })),
        responses: { 200: ok('OK', ref('Product')) } },
      delete: { tags: ['Products'], summary: 'Soft-delete (admin)', security: secured, parameters: [pathId('id')], responses: { 204: ok('Deleted') } },
    },

    '/cart': {
      get: { tags: ['Cart'], summary: 'View cart', security: secured, responses: { 200: ok('OK', ref('Cart')) } },
      delete: { tags: ['Cart'], summary: 'Clear cart', security: secured, responses: { 204: ok('Cleared') } },
    },
    '/cart/items': { post: { tags: ['Cart'], summary: 'Add to cart', security: secured,
      requestBody: body(obj({ productId: uuid, quantity: { type: 'integer', default: 1 } }, ['productId'])),
      responses: { 201: ok('Cart', ref('Cart')), 409: ok('Insufficient stock', ref('Error')) } } },
    '/cart/items/{productId}': {
      patch: { tags: ['Cart'], summary: 'Set quantity', security: secured, parameters: [pathId('productId')],
        requestBody: body(obj({ quantity: { type: 'integer' } }, ['quantity'])), responses: { 200: ok('Cart', ref('Cart')) } },
      delete: { tags: ['Cart'], summary: 'Remove item', security: secured, parameters: [pathId('productId')], responses: { 200: ok('Cart', ref('Cart')) } },
    },

    '/wishlist': { get: { tags: ['Wishlist'], summary: 'List wishlist', security: secured, responses: { 200: ok('OK') } } },
    '/wishlist/{productId}': {
      put: { tags: ['Wishlist'], summary: 'Add (idempotent)', security: secured, parameters: [pathId('productId')], responses: { 201: ok('Added') } },
      delete: { tags: ['Wishlist'], summary: 'Remove', security: secured, parameters: [pathId('productId')], responses: { 204: ok('Removed') } },
    },

    '/orders': {
      post: { tags: ['Orders'], summary: 'Checkout: turn the cart into an order (atomic stock reservation)', security: secured,
        requestBody: body(obj({ shippingAddress: str }, ['shippingAddress'])),
        responses: { 201: ok('Created', ref('Order')), 400: ok('Empty cart', ref('Error')), 409: ok('Out of stock', ref('Error')) } },
      get: { tags: ['Orders'], summary: 'My orders (all orders for admins)', security: secured, responses: { 200: ok('OK', arr('Order')) } },
    },
    '/orders/{id}': { get: { tags: ['Orders'], summary: 'Get order', security: secured, parameters: [pathId('id')], responses: { 200: ok('OK', ref('Order')), 404: errs[404] } } },
    '/orders/{id}/cancel': { post: { tags: ['Orders'], summary: 'Cancel PENDING/PAID order; restocks and refunds', security: secured, parameters: [pathId('id')],
      responses: { 200: ok('Cancelled', ref('Order')), 409: ok('Not cancellable', ref('Error')) } } },
    '/orders/{id}/status': { patch: { tags: ['Orders'], summary: 'Advance PAID→SHIPPED→DELIVERED (admin)', security: secured, parameters: [pathId('id')],
      requestBody: body(obj({ status: { type: 'string', enum: ['SHIPPED', 'DELIVERED'] } }, ['status'])), responses: { 200: ok('OK', ref('Order')) } } },

    '/payments': { post: { tags: ['Payments'], summary: 'Pay for a PENDING order (mock gateway; simulate=failure returns 402)', security: secured,
      requestBody: body(obj({ orderId: uuid, method: { type: 'string', enum: ['card', 'upi', 'netbanking'] }, simulate: { type: 'string', enum: ['success', 'failure'] } }, ['orderId'])),
      responses: { 201: ok('Succeeded', ref('Payment')), 402: ok('Declined', ref('Payment')), 409: ok('Order not payable', ref('Error')) } } },
    '/payments/order/{orderId}': { get: { tags: ['Payments'], summary: 'Payment for an order', security: secured, parameters: [pathId('orderId')],
      responses: { 200: ok('OK', ref('Payment')), 404: errs[404] } } },
  },
};
