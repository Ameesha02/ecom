const ApiError = require('../utils/ApiError');

// validate({ body, query, params }) with zod schemas.
// Parsed query lands on req.validatedQuery (req.query is read-only in newer Express).
module.exports = (schemas) => (req, _res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const r = schemas[part].safeParse(req[part]);
    if (!r.success) {
      const details = r.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(ApiError.badRequest('Validation failed', details));
    }
    if (part === 'query') req.validatedQuery = r.data;
    else req[part] = r.data;
  }
  next();
};
