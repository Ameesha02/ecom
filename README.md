# E-Commerce Platform

Full-stack e-commerce project.

- [`backend/`](backend) - REST API: Node.js, Express, PostgreSQL, Prisma, Redis, JWT, Docker, Swagger/OpenAPI, CI/CD
- [`frontend/`](frontend) - React + Vite storefront and admin page

See each folder's README for setup. Quick start with Docker:

```bash
cd backend
docker compose up --build
docker compose exec api node prisma/seed.js
```
Then run the frontend: `cd frontend && npm install && npm run dev`.
