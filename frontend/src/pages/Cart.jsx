import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { money } from './Products';

export default function Cart() {
  const { refreshCart } = useAuth();
  const nav = useNavigate();
  const [cart, setCart] = useState(null);
  const [error, setError] = useState('');
  const [address, setAddress] = useState('');
  const [method, setMethod] = useState('card');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api('/cart').then(setCart).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const mutate = async (fn) => {
    setError('');
    try { setCart(await fn()); refreshCart(); } catch (e) { setError(e.message); }
  };

  const checkout = async (e) => {
    e.preventDefault();
    setError(''); setBusy(true);
    let order;
    try {
      order = await api('/orders', { method: 'POST', body: { shippingAddress: address } });
      refreshCart();
    } catch (err) {
      setError(err.message); setBusy(false); return;
    }
    try {
      await api('/payments', { method: 'POST', body: { orderId: order.id, method, simulate: simulateFailure ? 'failure' : 'success' } });
    } catch { /* order exists as PENDING; user can retry payment from Orders */ }
    nav(`/orders?highlight=${order.id}`);
  };

  if (!cart) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  if (cart.items.length === 0) return <p>Your cart is empty. <Link to="/">Browse products</Link></p>;

  return (
    <>
      <h1>Your cart</h1>
      {error && <p className="error">{error}</p>}
      <div className="card">
        {cart.items.map((i) => (
          <div className="line" key={i.id}>
            <Link to={`/products/${i.productId}`}>{i.product.name}</Link>
            <span className="muted">{money(i.product.price)}</span>
            <input type="number" min="1" max={i.product.stock} value={i.quantity} style={{ width: 70 }}
              onChange={(e) => mutate(() => api(`/cart/items/${i.productId}`, { method: 'PATCH', body: { quantity: Math.max(1, Number(e.target.value) || 1) } }))} />
            <strong>{money(i.product.price * i.quantity)}</strong>
            <button className="link danger" onClick={() => mutate(() => api(`/cart/items/${i.productId}`, { method: 'DELETE' }))}>Remove</button>
          </div>
        ))}
        <div className="line total"><span>Subtotal ({cart.itemCount} items)</span><strong>{money(cart.subtotal)}</strong></div>
      </div>

      <form className="card form" onSubmit={checkout}>
        <h2>Checkout</h2>
        <textarea placeholder="Shipping address" rows="3" minLength={5} required value={address} onChange={(e) => setAddress(e.target.value)} />
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="card">Card</option>
          <option value="upi">UPI</option>
          <option value="netbanking">Net banking</option>
        </select>
        <label className="small muted">
          <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} /> Simulate a failed payment (sandbox)
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Placing order…' : `Place order & pay ${money(cart.subtotal)}`}</button>
      </form>
    </>
  );
}
