const { Prisma } = require('@prisma/client');
const prisma = require('../../config/prisma');
const redis = require('../../config/redis');
const ApiError = require('../../utils/ApiError');

const include = { items: true, payment: true };

// Converts the cart into an order atomically. Stock is decremented with a conditional
// UPDATE (stock >= qty), so two concurrent checkouts can never oversell a product.
async function placeOrder(userId, shippingAddress) {
  const order = await prisma.$transaction(async (tx) => {
    const cart = await tx.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) throw ApiError.badRequest('Cart is empty');

    let total = new Prisma.Decimal(0);
    for (const item of cart.items) {
      if (!item.product.isActive) throw ApiError.conflict(`"${item.product.name}" is no longer available`);
      const r = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (r.count === 0) throw ApiError.conflict(`Insufficient stock for "${item.product.name}"`);
      total = total.plus(new Prisma.Decimal(item.product.price).times(item.quantity));
    }

    const created = await tx.order.create({
      data: {
        userId,
        shippingAddress,
        total,
        items: {
          create: cart.items.map((i) => ({
            productId: i.productId,
            name: i.product.name,
            price: i.product.price, // snapshot: later price changes don't alter past orders
            quantity: i.quantity,
          })),
        },
      },
      include,
    });
    await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
    return created;
  });
  await redis.invalidateProducts(); // stock changed
  return order;
}

const isAdmin = (user) => user.role === 'ADMIN';

async function listOrders(user) {
  return prisma.order.findMany({
    where: isAdmin(user) ? {} : { userId: user.id },
    include,
    orderBy: { createdAt: 'desc' },
  });
}

async function getOrder(user, id) {
  const order = await prisma.order.findUnique({ where: { id }, include });
  // 404 (not 403) for other people's orders so ids can't be probed.
  if (!order || (!isAdmin(user) && order.userId !== user.id)) throw ApiError.notFound('Order not found');
  return order;
}

// Cancel a PENDING or PAID order: restock items and refund a successful payment.
async function cancelOrder(user, id) {
  await getOrder(user, id);
  await prisma.$transaction(async (tx) => {
    // Conditional update acts as the lock against double-cancel / racing shipment.
    const r = await tx.order.updateMany({
      where: { id, status: { in: ['PENDING', 'PAID'] } },
      data: { status: 'CANCELLED' },
    });
    if (r.count === 0) throw ApiError.conflict('Order can no longer be cancelled');
    const items = await tx.orderItem.findMany({ where: { orderId: id } });
    for (const i of items) {
      await tx.product.update({ where: { id: i.productId }, data: { stock: { increment: i.quantity } } });
    }
    await tx.payment.updateMany({
      where: { orderId: id, status: 'SUCCEEDED' },
      data: { status: 'REFUNDED' },
    });
  });
  await redis.invalidateProducts();
  return getOrder(user, id);
}

const NEXT = { PAID: 'SHIPPED', SHIPPED: 'DELIVERED' };

async function advanceStatus(id, status) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw ApiError.notFound('Order not found');
  if (NEXT[order.status] !== status) {
    throw ApiError.conflict(`Cannot move order from ${order.status} to ${status}`);
  }
  return prisma.order.update({ where: { id }, data: { status }, include });
}

module.exports = { placeOrder, listOrders, getOrder, cancelOrder, advanceStatus };
