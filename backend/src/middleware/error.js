const { Prisma } = require('@prisma/client');
const env = require('../config/env');

const notFound = (req, res) =>
  res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.originalUrl}` } });

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  let status = err.status || 500;
  let message = err.message;
  const details = err.details;

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') { status = 409; message = `Duplicate value for: ${err.meta?.target}`; }
    else if (err.code === 'P2025') { status = 404; message = 'Record not found'; }
    else if (err.code === 'P2003') { status = 409; message = 'Related record constraint failed'; }
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body';
  }

  if (status >= 500) {
    console.error(err);
    if (env.nodeEnv === 'production') message = 'Internal server error';
  }
  res.status(status).json({ error: { message, ...(details && { details }) } });
}

module.exports = { notFound, errorHandler };
