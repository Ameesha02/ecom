const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const prisma = require('../config/prisma');

const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');

function signAccess(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.accessSecret, { expiresIn: env.accessTtl });
}

// Refresh tokens are JWTs with a random jti; only their SHA-256 is stored, so a DB leak is harmless.
async function issueRefresh(user) {
  const token = jwt.sign({ sub: user.id, jti: crypto.randomUUID() }, env.refreshSecret, {
    expiresIn: `${env.refreshTtlDays}d`,
  });
  await prisma.refreshToken.create({
    data: {
      tokenHash: hash(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + env.refreshTtlDays * 864e5),
    },
  });
  return token;
}

async function issuePair(user) {
  return { accessToken: signAccess(user), refreshToken: await issueRefresh(user) };
}

module.exports = { hash, signAccess, issueRefresh, issuePair };
