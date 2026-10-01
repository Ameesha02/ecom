const env = require('./config/env');
const app = require('./app');
const prisma = require('./config/prisma');
const redis = require('./config/redis');

const server = app.listen(env.port, () => {
  console.log(`API listening on :${env.port}  (docs: http://localhost:${env.port}/api-docs)`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    if (redis.client) redis.client.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
