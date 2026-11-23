import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import ListaProductos from '../components/ListaProductos.jsx';
import LogoutButton from '../components/LogoutButton.jsx';

function itemLabel(item) {
  return item.sale_code || item.orderCode || item.name || item.nombre || item.title || item.id || 'Orden';
}

export default function SellerPage() {
  const [orders, setOrders] = useState([]);
  const [ordersError, setOrdersError] = useState('');
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [detail, setDetail] = useState(null);

  async function toggleOrder(saleCode) {
    if (detail?.sale_code === saleCode) return setDetail(null);
    try {
      setDetail(await apiRequest(`ordenes/${encodeURIComponent(saleCode)}`));
    } catch (requestError) {
      setOrdersError(requestError.message);
    }
  }

  useEffect(() => {
    let active = true;
    apiRequest('ordenes')
      .then((result) => {
        if (active) setOrders(Array.isArray(result) ? result : []);
      })
      .catch((requestError) => {
        if (active) setOrdersError(requestError.message);
      })
      .finally(() => {
        if (active) setLoadingOrders(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <main className="role-dashboard container">
      <header className="admin-topline">
        <div><span className="eyebrow">VIAJES POR CHILE / VENDEDOR</span><h1>Panel de vendedor</h1></div>
        <LogoutButton />
      </header>
      <div className="role-dashboard-grid">
        <section className="role-data-card">
          <h2>Productos</h2>
          <ListaProductos />
        </section>
        <section className="role-data-card">
          <h2>Órdenes</h2>
          {loadingOrders ? <p className="muted">Cargando órdenes…</p>
            : ordersError ? <p className="form-error" role="alert">{ordersError}</p>
              : orders.length ? <ul className="role-data-list">{orders.map((order, index) => (
                <li key={order.id || order.sale_code || order.codigo || index}>
                  <strong>{itemLabel(order)}</strong>
                  {order.total_amount != null && <span>{order.total_amount}</span>}
                  <button type="button" className="button" onClick={() => toggleOrder(order.sale_code)}>
                    {detail?.sale_code === order.sale_code ? 'Ocultar detalle' : 'Ver detalle'}
                  </button>
                  {detail?.sale_code === order.sale_code && <ul className="role-detail">
                    {(detail.tickets || []).map((ticket) => <li key={ticket.ticket_code || ticket.id}>
                      {ticket.trip_title || ticket.destination} · {ticket.passenger_name} · asiento {ticket.seat_number}
                    </li>)}
                  </ul>}
                </li>
              ))}</ul> : <p className="muted">No hay órdenes para mostrar.</p>}
        </section>
      </div>
      <p className="demo-note">Este panel consulta los productos y las órdenes registradas en el sistema.</p>
    </main>
  );
}
