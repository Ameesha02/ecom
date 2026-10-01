const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');

function authenticate(req, _res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return next(ApiError.unauthorized('Missing bearer token'));
  try {
    const p = jwt.verify(token, env.accessSecret);
    req.user = { id: p.sub, role: p.role };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(ApiError.forbidden('Insufficient permissions'));

module.exports = { authenticate, authorize };
