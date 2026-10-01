import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { money } from './Products';

export default function Wishlist() {
  const { refreshCart } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => api('/wishlist').then(setItems).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const remove = async (productId) => { await api(`/wishlist/${productId}`, { method: 'DELETE' }); load(); };
  const addToCart = async (productId) => {
    setError('');
    try { await api('/cart/items', { method: 'POST', body: { productId, quantity: 1 } }); refreshCart(); } catch (e) { setError(e.message); }
  };

  if (!items) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Wishlist</h1>
      {error && <p className="error">{error}</p>}
      {items.length === 0 && <p className="muted">Nothing saved yet. <Link to="/">Browse products</Link></p>}
      <div className="card">
        {items.map(({ id, product }) => (
          <div className="line" key={id}>
            <Link to={`/products/${product.id}`}>{product.name}</Link>
            <strong>{money(product.price)}</strong>
            <button className="btn small" disabled={!product.isActive || product.stock === 0} onClick={() => addToCart(product.id)}>Add to cart</button>
            <button className="link danger" onClick={() => remove(product.id)}>Remove</button>
          </div>
        ))}
      </div>
    </>
  );
}
