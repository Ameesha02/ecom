# E-Commerce Backend API

Modular REST backend: **Node.js, Express, PostgreSQL, Prisma, Redis, JWT, Docker, Swagger/OpenAPI, CI/CD**.

## Features
- **Auth**: bcrypt hashing, short-lived JWT access tokens, rotating refresh tokens (stored hashed, reuse detection revokes all sessions), role-based authorization (`CUSTOMER` / `ADMIN`), rate-limited login.
- **Catalog**: categories and products with search, price filter, sort and pagination; soft delete; **Redis cache-aside** with version-key invalidation (`X-Cache: HIT|MISS`). Redis is optional: the API works without it.
- **Cart & wishlist**: stock-checked cart, idempotent wishlist.
- **Orders**: checkout is one DB transaction. Stock is decremented with a conditional update, so concurrent buyers can't oversell. Prices are snapshotted. Cancelling restocks and refunds.
- **Payments**: mock gateway (swap in Stripe/Razorpay behind `mockGateway`); atomic `PENDING → PAID` guard prevents double payment.
- **Ops**: Zod validation, central error handler, Helmet/CORS, health check, graceful shutdown, Dockerfile + compose, GitHub Actions (test → build/push image to GHCR).

## Quick start (Docker)
```bash
docker compose up --build
docker compose exec api node prisma/seed.js   # admin@example.com / Admin@12345 + sample catalog
```
Swagger UI: http://localhost:3000/api-docs

## Local dev
```bash
cp .env.example .env            # edit secrets / DB URL
npm install
npx prisma migrate dev          # creates tables
npm run seed
npm run dev
```
Postgres and Redis can be started alone with `docker compose up db redis`.

## Tests
```bash
npm test    # DB-free tests always run; the e2e journey runs when DATABASE_URL points at Postgres
```

## Order lifecycle
`PENDING --pay--> PAID --admin--> SHIPPED --admin--> DELIVERED`; `PENDING|PAID --cancel--> CANCELLED`.

## Structure
```
prisma/            schema, migrations, seed
src/config/        env, prisma client, redis
src/middleware/    auth (JWT + RBAC), validate (zod), error
src/modules/       auth, categories, products, cart, wishlist, orders, payments
src/docs/          OpenAPI spec
tests/             basic (no DB) + e2e (Postgres)
```

Money is returned as strings (Prisma `Decimal`) to avoid floating-point errors.
