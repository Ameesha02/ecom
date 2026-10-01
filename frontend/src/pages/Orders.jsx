import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { money } from './Products';

export default function Orders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const highlight = useSearchParams()[0].get('highlight');

  const load = useCallback(() => api('/orders').then(setOrders).catch((e) => setError(e.message)), []);
  useEffect(() => { load(); }, [load]);

  const act = async (fn) => {
    setError('');
    try { await fn(); } catch (e) { setError(e.message); }
    load();
  };
  const pay = (id) => act(() => api('/payments', { method: 'POST', body: { orderId: id } }));
  const cancel = (id) => act(() => api(`/orders/${id}/cancel`, { method: 'POST' }));

  if (!orders) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  return (
    <>
      <h1>My orders</h1>
      {error && <p className="error">{error}</p>}
      {orders.length === 0 && <p className="muted">No orders yet.</p>}
      {orders.map((o) => (
        <div className={`card ${o.id === highlight ? 'highlight' : ''}`} key={o.id}>
          <div className="row">
            <span className="small muted">#{o.id.slice(0, 8)} · {new Date(o.createdAt).toLocaleString()}</span>
            <span className={`status ${o.status}`}>{o.status}</span>
          </div>
          {o.items.map((i) => (
            <div className="line" key={i.id}><span>{i.name} × {i.quantity}</span><span>{money(i.price * i.quantity)}</span></div>
          ))}
          <div className="line total"><span>Total</span><strong>{money(o.total)}</strong></div>
          <p className="small muted">Ship to: {o.shippingAddress}</p>
          {o.payment && <p className="small muted">Payment: {o.payment.status} via {o.payment.method}</p>}
          {o.status === 'PENDING' && o.payment?.status === 'FAILED' && <p className="error small">Payment failed. You can retry.</p>}
          <div className="row left">
            {o.status === 'PENDING' && <button className="btn small" onClick={() => pay(o.id)}>Pay now</button>}
            {['PENDING', 'PAID'].includes(o.status) && <button className="btn ghost small" onClick={() => cancel(o.id)}>Cancel order</button>}
          </div>
        </div>
      ))}
    </>
  );
}
