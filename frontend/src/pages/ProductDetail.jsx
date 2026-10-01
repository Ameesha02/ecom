import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { money } from './Products';

export default function ProductDetail() {
  const { id } = useParams();
  const { user, refreshCart } = useAuth();
  const nav = useNavigate();
  const [p, setP] = useState(null);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { api(`/products/${id}`).then(setP).catch((e) => setError(e.message)); }, [id]);

  const guard = () => {
    if (!user) { nav('/login', { state: { from: `/products/${id}` } }); return false; }
    return true;
  };
  const run = async (fn, ok) => {
    if (!guard()) return;
    setMsg(''); setError('');
    try { await fn(); setMsg(ok); refreshCart(); } catch (e) { setError(e.message); }
  };

  if (error && !p) return <p className="error">{error}</p>;
  if (!p) return <p className="muted">Loading…</p>;

  return (
    <>
      <Link to="/" className="muted">← Back to products</Link>
      <div className="card detail">
        <div className="thumb big">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : p.name[0]}</div>
        <div>
          <h1>{p.name}</h1>
          <p className="muted">{p.category?.name}</p>
          <h2>{money(p.price)}</h2>
          <p>{p.description}</p>
          <p className={p.stock > 0 ? 'ok' : 'error'}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
          <div className="row left">
            <input type="number" min="1" max={p.stock} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} style={{ width: 80 }} />
            <button className="btn" disabled={p.stock === 0}
              onClick={() => run(() => api('/cart/items', { method: 'POST', body: { productId: p.id, quantity: qty } }), 'Added to cart')}>
              Add to cart
            </button>
            <button className="btn ghost"
              onClick={() => run(() => api(`/wishlist/${p.id}`, { method: 'PUT' }), 'Saved to wishlist')}>
              ♡ Wishlist
            </button>
          </div>
          {msg && <p className="ok">{msg}</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    </>
  );
}
