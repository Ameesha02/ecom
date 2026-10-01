const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/prisma');
const env = require('../../config/env');
const ApiError = require('../../utils/ApiError');
const { hash, issuePair } = require('../../utils/tokens');

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role });

async function register({ email, password, name }) {
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) throw ApiError.conflict('Email already registered');
  const passwordHash = await bcrypt.hash(password, 12);
  // Role is never taken from the request: public signups are always CUSTOMER.
  const user = await prisma.user.create({ data: { email, name, passwordHash } });
  return { user: publicUser(user), ...(await issuePair(user)) };
}

async function login({ email, password }) {
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw ApiError.unauthorized('Invalid email or password');
  return { user: publicUser(user), ...(await issuePair(user)) };
}

// Rotation: every refresh revokes the presented token and issues a new pair.
// Re-use of an already-revoked token is treated as theft and revokes all of the user's sessions.
async function refresh(token) {
  let payload;
  try {
    payload = jwt.verify(token, env.refreshSecret);
  } catch {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!stored || stored.userId !== payload.sub || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized('Invalid refresh token');
  }
  if (stored.revokedAt) {
    await prisma.refreshToken.updateMany({
      where: { userId: stored.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw ApiError.unauthorized('Refresh token reuse detected; please log in again');
  }
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user) throw ApiError.unauthorized('Invalid refresh token');
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  return issuePair(user);
}

async function logout(token) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function me(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  return publicUser(user);
}

module.exports = { register, login, refresh, logout, me };
