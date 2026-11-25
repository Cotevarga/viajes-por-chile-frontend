import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api.js';
import { formatPrice } from '../data/catalog.js';
import LogoutButton from '../components/LogoutButton.jsx';
import Tabs from '../components/Tabs.jsx';
import { buildTicketHtml } from './TicketsPage.jsx';

const salonSeats = [71, 72, 74, 75, 76, 78, 79, 80, 82, 83, 84, 86];
const isDoubleDeck = (product) => Number(product?.distance_km) >= 400 || product?.type === 'Salón Cama';
const seatsFor = (product, seatClass) => isDoubleDeck(product) && seatClass === 'salon'
  ? salonSeats : Array.from({ length: isDoubleDeck(product) ? 52 : product?.type === 'Semi Cama' ? 44 : 56 }, (_, i) => i + 1);
const dateToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const futureSchedules = (product) => (product?.schedules || []).filter((schedule) => schedule.date >= dateToday());

function SeatSelector({ product, schedule, seatClass, value, onChange, original }) {
  const [occupied, setOccupied] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setOccupied(null);
    setError('');
    if (!product || !schedule) return () => { active = false; };
    const params = new URLSearchParams({ slug: product.slug, scheduleId: schedule.id });
    apiRequest(`availability/seats?${params}`)
      .then((result) => { if (active) setOccupied(result); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [product, schedule]);
  const sameDeparture = original && schedule?.date === original.schedule_date && schedule?.time === original.departure_time;
  const unavailable = new Set((occupied || []).filter((seat) => !sameDeparture || seat !== original.seat_number));
  return <label>Asiento disponible
    <select value={value} onChange={(event) => onChange(event.target.value)} disabled={!occupied || !schedule} required>
      <option value="">Seleccionar asiento</option>
      {seatsFor(product, seatClass).map((seat) => <option key={seat} value={seat} disabled={unavailable.has(seat)}>
        {seat}{unavailable.has(seat) ? ' · ocupado' : ''}
      </option>)}
    </select>
    {error && <span className="form-error" role="alert">{error}</span>}
  </label>;
}

function Booking({ products, onCreated }) {
  const [slug, setSlug] = useState('');
  const [date, setDate] = useState('');
  const [scheduleId, setScheduleId] = useState('');
  const [seatClass, setSeatClass] = useState('semi');
  const [seat, setSeat] = useState('');
  const [passenger, setPassenger] = useState({ name: '', rut: '', email: '', telephone: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const product = products.find((item) => item.slug === slug);
  const schedules = futureSchedules(product);
  const schedule = schedules.find((item) => item.id === scheduleId && item.date === date);
  const price = product ? Math.round(Math.round(Number(product.price) * (isDoubleDeck(product) && seatClass === 'salon' ? 1.25 : 1))
    * (100 - Number(product.discount_percent || 0)) / 100) : 0;

  async function submit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await apiRequest('purchases', { method: 'POST', body: JSON.stringify({
        buyerName: passenger.name, buyerEmail: passenger.email || null,
        items: [{ slug, scheduleId, seatClass, passengers: [{ ...passenger, seatNumber: Number(seat) }] }]
      }) });
      onCreated(result);
      setSeat('');
      setPassenger({ name: '', rut: '', email: '', telephone: '' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }
  return <section className="role-data-card">
    <h2>Vender boleto</h2>
    <p className="muted">Venta simulada: no se realiza un cobro real.</p>
    <form className="stack-form" onSubmit={submit}>
      <label>Ruta<select value={slug} onChange={(event) => { setSlug(event.target.value); setDate(''); setScheduleId(''); setSeat(''); }} required>
        <option value="">Seleccionar ruta</option>
        {products.filter((item) => item.status === 'Activo').map((item) => <option value={item.slug} key={item.id}>{item.title}</option>)}
      </select></label>
      <label>Fecha de viaje<select value={date} onChange={(event) => { setDate(event.target.value); setScheduleId(''); setSeat(''); }} required>
        <option value="">Seleccionar fecha</option>
        {[...new Set(schedules.map((item) => item.date))].sort().map((item) => <option key={item} value={item}>{item}</option>)}
      </select></label>
      <label>Hora de salida<select value={scheduleId} onChange={(event) => { setScheduleId(event.target.value); setSeat(''); }} required>
        <option value="">Seleccionar hora</option>
        {schedules.filter((item) => item.date === date).map((item) => <option value={item.id} key={item.id}>{item.time} · Andén {item.platform}</option>)}
      </select></label>
      {product && <label>Clase de asiento<select value={seatClass} onChange={(event) => { setSeatClass(event.target.value); setSeat(''); }}>
        <option value="semi">{isDoubleDeck(product) ? 'Semi Cama' : product.type}</option>
        {isDoubleDeck(product) && <option value="salon">Salón Cama</option>}
      </select></label>}
      {product && <SeatSelector product={product} schedule={schedule} seatClass={seatClass} value={seat} onChange={setSeat} />}
      <label>Nombre completo<input value={passenger.name} onChange={(event) => setPassenger({ ...passenger, name: event.target.value })} maxLength="150" required /></label>
      <label>RUT<input value={passenger.rut} onChange={(event) => setPassenger({ ...passenger, rut: event.target.value })} required /></label>
      <label>Correo (opcional)<input type="email" value={passenger.email} onChange={(event) => setPassenger({ ...passenger, email: event.target.value })} maxLength="190" /></label>
      <label>Teléfono<input type="tel" value={passenger.telephone} onChange={(event) => setPassenger({ ...passenger, telephone: event.target.value })} maxLength="40" required /></label>
      <strong>Precio: {formatPrice(price)} {product?.discount_percent > 0 && `(${product.discount_percent}% descuento)`}</strong>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-dark" disabled={submitting || !schedule || !seat}>
        {submitting ? 'Emitiendo…' : 'Emitir y cobrar boleto'}
      </button>
    </form>
  </section>;
}

function TicketEdit({ ticket, product, onSave, onCancel }) {
  const [scheduleId, setScheduleId] = useState('');
  const [seat, setSeat] = useState(String(ticket.seat_number));
  const [name, setName] = useState(ticket.passenger_name);
  const [rut, setRut] = useState(ticket.passenger_rut);
  const [email, setEmail] = useState(ticket.passenger_email || '');
  const [phone, setPhone] = useState(ticket.passenger_phone || '');
  const [error, setError] = useState('');
  const schedules = futureSchedules(product);
  const schedule = schedules.find((item) => item.id === scheduleId);
  const seatClass = ticket.seat_class === 'Salón Cama' || (!ticket.seat_class && ticket.seat_number > 52) ? 'salon' : 'semi';
  async function submit(event) {
    event.preventDefault();
    try {
      await apiRequest(`tickets/${encodeURIComponent(ticket.ticket_code)}`, { method: 'PUT', body: JSON.stringify({
        scheduleId, seatNumber: Number(seat), passengerName: name, passengerRut: rut, passengerEmail: email || null, passengerPhone: phone
      }) });
      onSave();
    } catch (err) { setError(err.message); }
  }
  return <form className="stack-form form-panel" onSubmit={submit}>
    <h3>Reprogramar boleto</h3>
    <p className="muted">Se conserva el precio pagado y la clase de asiento.</p>
    <label>Nueva salida<select value={scheduleId} onChange={(event) => { setScheduleId(event.target.value); setSeat(''); }} required>
      <option value="">Seleccionar salida</option>
      {schedules.map((item) => <option key={item.id} value={item.id}>{item.date} · {item.time}</option>)}
    </select></label>
    <SeatSelector product={product} schedule={schedule} seatClass={seatClass} value={seat} onChange={setSeat} original={ticket} />
    <label>Nombre pasajero<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
    <label>RUT pasajero<input value={rut} onChange={(event) => setRut(event.target.value)} required /></label>
    <label>Correo pasajero<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
    <label>Teléfono pasajero<input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button button-dark" disabled={!schedule || !seat}>Guardar cambios</button>
    <button type="button" onClick={onCancel}>Volver</button>
  </form>;
}

export default function SellerPage() {
  const [tab, setTab] = useState('booking');
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [detail, setDetail] = useState(null);
  const [issued, setIssued] = useState(null);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [catalogProduct, setCatalogProduct] = useState(null);
  const [catalogSchedule, setCatalogSchedule] = useState('');
  const [catalogOccupied, setCatalogOccupied] = useState(null);

  useEffect(() => {
    let active = true;
    apiRequest('products').then((result) => { if (active) setProducts(result); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (tab !== 'orders') return undefined;
    let active = true;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (date) params.set('date', date);
    apiRequest(`ordenes${params.size ? `?${params}` : ''}`).then((result) => { if (active) setOrders(result); })
      .catch((err) => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [tab, search, date, refresh]);
  useEffect(() => {
    let active = true;
    setCatalogOccupied(null);
    if (catalogProduct && catalogSchedule) {
      const params = new URLSearchParams({ slug: catalogProduct.slug, scheduleId: catalogSchedule });
      apiRequest(`availability/seats?${params}`).then((result) => { if (active) setCatalogOccupied(result.length); })
        .catch((err) => { if (active) setError(err.message); });
    }
    return () => { active = false; };
  }, [catalogProduct, catalogSchedule]);

  async function showOrder(code) {
    try { setDetail(await apiRequest(`ordenes/${encodeURIComponent(code)}`)); setEditing(null); setError(''); }
    catch (err) { setError(err.message); }
  }
  async function cancelSaleOrTicket(ticket) {
    const target = ticket ? `el boleto de ${ticket.passenger_name}` : 'toda la compra';
    if (!window.confirm(`¿Anular ${target}? No se realizará un reembolso real.`)) return;
    const reason = window.prompt('Motivo de la anulación:');
    if (reason === null) return;
    try {
      await apiRequest('sales/cancellations', { method: 'POST', body: JSON.stringify({
        ...(ticket ? { ticket_code: ticket.ticket_code } : { sale_code: detail.sale_code }), reason
      }) });
      await showOrder(detail.sale_code);
      setRefresh((value) => value + 1);
    } catch (err) { setError(err.message); }
  }
  function printSale(sale, ticket) {
    const popup = window.open('', '_blank');
    if (!popup) { setError('Permite ventanas emergentes para imprimir el boleto.'); return; }
    popup.document.write(buildTicketHtml(ticket ? { ...sale, tickets: [ticket] } : sale));
    popup.document.close();
    popup.focus();
    popup.print();
  }
  return <main className="role-dashboard container">
    <header className="admin-topline">
      <div><span className="eyebrow">VIAJES POR CHILE / VENDEDOR</span><h1>Panel de vendedor</h1></div>
      <LogoutButton />
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}
    <Tabs label="Operaciones de vendedor" active={tab} onChange={setTab} tabs={[
      { id: 'booking', label: 'Vender boleto' }, { id: 'orders', label: 'Órdenes y boletos' },
      { id: 'catalog', label: 'Catálogo de rutas y tarifas' }
    ]}>
      {tab === 'booking' && <>
        <Booking products={products} onCreated={(sale) => { setIssued(sale); setError(''); }} />
        {issued && <section className="role-data-card"><h2>Comprobante emitido</h2><p>Código: {issued.sale_code}</p>
          <button type="button" onClick={() => printSale(issued)}>Imprimir boleto</button></section>}
      </>}
      {tab === 'orders' && <section className="role-data-card">
        <h2>Órdenes y boletos vendidos</h2>
        <div className="message-controls">
          <label>Buscar código, RUT o pasajero<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label>Fecha de venta<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
        {orders.length ? <ul className="role-data-list">{orders.map((order) => <li key={order.sale_code}>
          <strong>{order.sale_code}</strong> · {formatPrice(order.total_amount)} · {order.status}
          <button type="button" onClick={() => showOrder(order.sale_code)}>Ver detalle</button>
        </li>)}</ul> : <p className="muted">No hay órdenes para mostrar.</p>}
        {detail && <div className="form-panel"><h3>Compra {detail.sale_code}</h3>
          <button type="button" onClick={() => printSale(detail)}>Imprimir compra</button>
          {detail.status !== 'anulada' && <button type="button" onClick={() => cancelSaleOrTicket(null)}>Anular compra</button>}
          {detail.tickets.map((ticket) => <article key={ticket.ticket_code}>
            <p>{ticket.passenger_name} · {ticket.passenger_rut} · {ticket.trip_title} · {ticket.schedule_date} {ticket.departure_time} · asiento {ticket.seat_number} · {ticket.status}</p>
            <button type="button" onClick={() => printSale(detail, ticket)}>Imprimir boleto</button>
            {ticket.status === 'activo' && <>
              <button type="button" onClick={() => setEditing(ticket)}>Reprogramar / editar</button>
              <button type="button" onClick={() => cancelSaleOrTicket(ticket)}>Anular boleto</button>
            </>}
            {editing?.ticket_code === ticket.ticket_code && (products.find((item) => item.id === ticket.product_id)
              ? <TicketEdit ticket={ticket} product={products.find((item) => item.id === ticket.product_id)} onCancel={() => setEditing(null)}
                onSave={() => { showOrder(detail.sale_code); setRefresh((value) => value + 1); }} />
              : <p className="form-error">La ruta del boleto ya no está disponible.</p>)}
          </article>)}
        </div>}
      </section>}
      {tab === 'catalog' && <section className="role-data-card"><h2>Catálogo de rutas y tarifas</h2>
        <ul className="role-data-list">{products.map((product) => <li key={product.id}>
          <strong>{product.title}</strong> · {formatPrice(product.price)} · {product.status}
          <button type="button" onClick={() => { setCatalogProduct(product); setCatalogSchedule(''); }}>Ver detalle</button>
        </li>)}</ul>
        {catalogProduct && <div className="form-panel"><h3>{catalogProduct.title}</h3>
          <p>Tarifa base: {formatPrice(catalogProduct.price)} · Descuento: {catalogProduct.discount_percent || 0}%</p>
          <label>Salida<select value={catalogSchedule} onChange={(event) => setCatalogSchedule(event.target.value)}>
            <option value="">Seleccionar salida</option>
            {futureSchedules(catalogProduct).map((item) => <option key={item.id} value={item.id}>{item.date} · {item.time}</option>)}
          </select></label>
          {catalogOccupied !== null && (() => {
            const capacity = isDoubleDeck(catalogProduct) ? 64 : futureSchedules(catalogProduct).find((item) => item.id === catalogSchedule)?.capacity;
            return <p>Asientos ocupados: {catalogOccupied}. Cupos disponibles: {Number.isInteger(capacity) ? Math.max(0, capacity - catalogOccupied) : 'No disponible'}.</p>;
          })()}
        </div>}
      </section>}
    </Tabs>
  </main>;
}
