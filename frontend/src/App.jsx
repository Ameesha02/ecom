import { Link, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Orders from './pages/Orders';
import Wishlist from './pages/Wishlist';
import Login from './pages/Login';
import Admin from './pages/Admin';

function Protected({ children, admin }) {
  const { user, ready } = useAuth();
  const loc = useLocation();
  if (!ready) return <p className="muted">Loading…</p>;
  if (!user) return <Navigate to="/login" state={{ from: loc.pathname }} replace />;
  if (admin && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const { user, cartCount, logout } = useAuth();
  return (
    <>
      <header className="nav">
        <Link to="/" className="brand">Shop</Link>
        <nav>
          <NavLink to="/" end>Products</NavLink>
          {user && <NavLink to="/wishlist">Wishlist</NavLink>}
          {user && <NavLink to="/orders">Orders</NavLink>}
          {user?.role === 'ADMIN' && <NavLink to="/admin">Admin</NavLink>}
          <NavLink to="/cart">Cart{cartCount > 0 && <span className="badge">{cartCount}</span>}</NavLink>
          {user ? (
            <button className="link" onClick={logout}>Logout ({user.name.split(' ')[0]})</button>
          ) : (
            <NavLink to="/login">Login</NavLink>
          )}
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Products />} />
          <Route path="/products/:id" element={<ProductDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cart" element={<Protected><Cart /></Protected>} />
          <Route path="/wishlist" element={<Protected><Wishlist /></Protected>} />
          <Route path="/orders" element={<Protected><Orders /></Protected>} />
          <Route path="/admin" element={<Protected admin><Admin /></Protected>} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go home</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
