const Redis = require('ioredis');
const env = require('./env');

// Redis is an optimisation, never a hard dependency: every helper degrades to a no-op/miss.
let client = null;
if (env.redisUrl) {
  client = new Redis(env.redisUrl, { maxRetriesPerRequest: 1, enableOfflineQueue: false });
  client.on('error', (e) => console.warn('[redis]', e.message));
}

const VERSION_KEY = 'cache:products:version';

async function getVersion() {
  try {
    return client ? (await client.get(VERSION_KEY)) || '0' : '0';
  } catch {
    return '0';
  }
}

async function cacheGet(key) {
  if (!client) return null;
  try {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function cacheSet(key, value, ttl = env.cacheTtl) {
  if (!client) return;
  try {
    await client.set(key, JSON.stringify(value), 'EX', ttl);
  } catch {
    /* ignore */
  }
}

// Bumping the version orphans every cached product key at once (they expire via TTL).
async function invalidateProducts() {
  if (!client) return;
  try {
    await client.incr(VERSION_KEY);
  } catch {
    /* ignore */
  }
}

async function ping() {
  if (!client) return 'disabled';
  try {
    await client.ping();
    return 'up';
  } catch {
    return 'down';
  }
}

module.exports = { cacheGet, cacheSet, invalidateProducts, getVersion, ping, client };
