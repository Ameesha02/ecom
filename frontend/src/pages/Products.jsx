import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { useNavigate } from 'react-router-dom';

export const money = (v) => `$${Number(v).toFixed(2)}`;

export default function Products() {
  const { user, refreshCart } = useAuth();
  const nav = useNavigate();
  const [categories, setCategories] = useState([]);
  const [filters, setFilters] = useState({ search: '', categoryId: '', sort: 'newest', page: 1 });
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => { api('/categories').then(setCategories).catch(() => {}); }, []);

  // debounce the search box
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === searchInput ? f : { ...f, search: searchInput, page: 1 })), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    const q = new URLSearchParams({ page: filters.page, limit: 12, sort: filters.sort });
    if (filters.search) q.set('search', filters.search);
    if (filters.categoryId) q.set('categoryId', filters.categoryId);
    setError('');
    api(`/products?${q}`).then(setData).catch((e) => setError(e.message));
  }, [filters]);

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2000); };

  const addToCart = async (p) => {
    if (!user) return nav('/login', { state: { from: '/' } });
    try {
      await api('/cart/items', { method: 'POST', body: { productId: p.id, quantity: 1 } });
      refreshCart();
      flash(`Added "${p.name}"`);
    } catch (e) { flash(e.message); }
  };

  return (
    <>
      <div className="toolbar">
        <input placeholder="Search products…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        <select value={filters.categoryId} onChange={(e) => setFilters({ ...filters, categoryId: e.target.value, page: 1 })}>
          <option value="">All categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value, page: 1 })}>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="name">Name</option>
        </select>
      </div>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data?.items.length === 0 && <p className="muted">No products found.</p>}

      <div className="grid">
        {data?.items.map((p) => (
          <div className="card product" key={p.id}>
            <Link to={`/products/${p.id}`}>
              <div className="thumb">{p.imageUrl ? <img src={p.imageUrl} alt={p.name} /> : p.name[0]}</div>
              <h3>{p.name}</h3>
            </Link>
            <span className="muted small">{p.category?.name}</span>
            <div className="row">
              <strong>{money(p.price)}</strong>
              {p.stock === 0 ? <span className="error small">Out of stock</span>
                : <button className="btn small" onClick={() => addToCart(p)}>Add to cart</button>}
            </div>
          </div>
        ))}
      </div>

      {data && data.totalPages > 1 && (
        <div className="pager">
          <button className="btn ghost" disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Prev</button>
          <span>Page {data.page} of {data.totalPages}</span>
          <button className="btn ghost" disabled={filters.page >= data.totalPages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</button>
        </div>
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
