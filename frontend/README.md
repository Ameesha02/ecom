# Shop frontend

React + Vite storefront for the e-commerce backend in the parent folder.

Pages: product browse (search / category / sort / pagination), product detail, cart + checkout + payment, orders (pay / cancel), wishlist, login / register, and an admin page (create products and categories, move orders to shipped / delivered).

## Run
```bash
# 1. start the backend (from the parent folder) so it listens on :3000
# 2. then:
cd frontend
npm install
npm run dev        # http://localhost:5173  (dev server proxies /api to localhost:3000)
```
Seeded admin: `admin@example.com` / `Admin@12345` (run `npm run seed` in the backend first).

## Production build
```bash
VITE_API_URL=https://your-api.example.com/api/v1 npm run build
```
Tokens are kept in localStorage and refreshed automatically on a 401.
