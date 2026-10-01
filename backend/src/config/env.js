require('dotenv').config({ quiet: true });

const required = ['DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];

function load() {
  if (process.env.NODE_ENV !== 'test') {
    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
  }
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3000,
    redisUrl: process.env.REDIS_URL || '',
    accessSecret: process.env.JWT_ACCESS_SECRET || 'test-access',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'test-refresh',
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS) || 7,
    cacheTtl: Number(process.env.CACHE_TTL_SECONDS) || 60,
  };
}

module.exports = load();
