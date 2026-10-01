import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { money } from './Products';

const NEXT = { PAID: 'SHIPPED', SHIPPED: 'DELIVERED' };
const blank = { name: '', description: '', price: '', stock: '10', imageUrl: '', categoryId: '' };

export default function Admin() {
  const [categories, setCategories] = useState([]);
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState(blank);
  const [catName, setCatName] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const load = useCallback(() => {
    api('/categories').then(setCategories).catch(() => {});
    api('/orders').then(setOrders).catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async (fn, ok) => {
    setMsg(''); setError('');
    try { await fn(); setMsg(ok); load(); } catch (e) { setError(e.message); }
  };

  const createProduct = (e) => {
    e.preventDefault();
    const body = { ...form, price: Number(form.price), stock: Number(form.stock) };
    if (!body.imageUrl) delete body.imageUrl;
    run(async () => { await api('/products', { method: 'POST', body }); setForm({ ...blank, categoryId: form.categoryId }); }, 'Product created');
  };

  return (
    <>
      <h1>Admin</h1>
      {msg && <p className="ok">{msg}</p>}
      {error && <p className="error">{error}</p>}

      <div className="two">
        <form className="card form" onSubmit={createProduct}>
          <h2>New product</h2>
          <input placeholder="Name" required value={form.name} onChange={set('name')} />
          <textarea placeholder="Description" required rows="2" value={form.description} onChange={set('description')} />
          <div className="row left">
            <input type="number" step="0.01" min="0.01" placeholder="Price" required value={form.price} onChange={set('price')} />
            <input type="number" min="0" placeholder="Stock" required value={form.stock} onChange={set('stock')} />
          </div>
          <input type="url" placeholder="Image URL (optional)" value={form.imageUrl} onChange={set('imageUrl')} />
          <select required value={form.categoryId} onChange={set('categoryId')}>
            <option value="">Select category…</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn">Create product</button>
        </form>

        <form className="card form" onSubmit={(e) => { e.preventDefault(); run(async () => { await api('/categories', { method: 'POST', body: { name: catName } }); setCatName(''); }, 'Category created'); }}>
          <h2>New category</h2>
          <input placeholder="Name" required value={catName} onChange={(e) => setCatName(e.target.value)} />
          <button className="btn">Create category</button>
        </form>
      </div>

      <h2>All orders</h2>
      {orders.map((o) => (
        <div className="card" key={o.id}>
          <div className="row">
            <span className="small muted">#{o.id.slice(0, 8)} · user {o.userId.slice(0, 8)} · {new Date(o.createdAt).toLocaleDateString()}</span>
            <span className={`status ${o.status}`}>{o.status}</span>
          </div>
          <div className="row">
            <span>{o.items.length} item(s)</span>
            <strong>{money(o.total)}</strong>
            {NEXT[o.status] && (
              <button className="btn small" onClick={() => run(() => api(`/orders/${o.id}/status`, { method: 'PATCH', body: { status: NEXT[o.status] } }), 'Order updated')}>
                Mark {NEXT[o.status].toLowerCase()}
              </button>
            )}
          </div>
        </div>
      ))}
    </>
  );
}
