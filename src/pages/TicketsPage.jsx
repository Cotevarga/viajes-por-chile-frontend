import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { cities, formatPrice, getProductDistanceKm, getProductRoute, imageUrl } from '../data/catalog.js';
import { apiRequest } from '../lib/api.js';

const CODE39 = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw', '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw',
  C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn',
  G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww',
  O: 'wnnnwnnwn', P: 'nnwnnwnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn',
  S: 'nnwnnnwwn', T: 'nnnnwnwwn', U: 'wwnnnnnnw', V: 'nwwnnnnnw',
  W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn', '$': 'nwnwnwnnn',
  '/': 'nwnwnnnwn', '+': 'nwnnnwnwn', '%': 'nnnwnwnwn', '*': 'nwnnwnwnn'
};

function getBarcodeBars(value) {
  const code = String(value || 'BOLETO').toUpperCase().replace(/[^0-9A-Z .$/+%-]/g, '') || 'BOLETO';
  const bars = [];
  let x = 0;
  for (const character of `*${code}*`) {
    const pattern = CODE39[character];
    pattern.split('').forEach((size, index) => {
      const width = size === 'w' ? 3 : 1;
      if (index % 2 === 0) bars.push({ x, width });
      x += width;
    });
    x += 1;
  }
  return { width: x, bars, code };
}

function getOrigin(ticket) {
  if (ticket.origin) return ticket.origin;
  const parts = String(ticket.trip_title || '').split(/\s+[–—-]\s+/);
  return parts.length > 1 ? parts[0] : 'Santiago';
}

export function getTripTracking(ticket, currentTime = new Date()) {
  const route = getProductRoute({ title: ticket.trip_title, destination: ticket.destination });
  const originName = getOrigin(ticket);
  const origin = cities[route.origin];
  const destination = cities[route.destination];
  const distanceKm = getProductDistanceKm({
    title: ticket.trip_title,
    destination: ticket.destination,
    distance_km: ticket.distance_km
  });
  const departure = new Date(`${ticket.schedule_date}T${ticket.departure_time}:00`);
  if (!Number.isFinite(departure.getTime()) || !distanceKm) {
    return { status: 'Seguimiento no disponible', progress: 0, location: 'Ruta sin distancia registrada', eta: 'No disponible' };
  }

  const durationMinutes = Math.max(30, Math.ceil(distanceKm / 75 * 60));
  const arrival = new Date(departure.getTime() + durationMinutes * 60_000);
  const elapsedMinutes = (currentTime.getTime() - departure.getTime()) / 60_000;
  const progress = Math.max(0, Math.min(100, Math.round(elapsedMinutes / durationMinutes * 100)));
  const status = ticket.status === 'cancelado'
    ? 'Viaje cancelado'
    : progress === 100
      ? 'Llegada estimada'
      : currentTime < departure
        ? 'Salida programada'
        : 'En ruta';
  let location = `Origen: ${originName}`;

  if (ticket.status !== 'cancelado' && progress === 100 && destination) {
    location = `Destino: ${destination.name}`;
  } else if (ticket.status !== 'cancelado' && progress > 0 && origin && destination) {
    const position = origin.distance + (destination.distance - origin.distance) * progress / 100;
    const intermediate = Object.values(cities)
      .filter((city) => city.distance > Math.min(origin.distance, destination.distance)
        && city.distance < Math.max(origin.distance, destination.distance))
      .sort((left, right) => Math.abs(left.distance - position) - Math.abs(right.distance - position))[0];
    location = intermediate && Math.abs(intermediate.distance - position) <= 80
      ? `Cerca de ${intermediate.name} (aprox.)`
      : `En ruta, a ${Math.round(distanceKm * progress / 100)} km del origen (aprox.)`;
  }

  return {
    status,
    progress: ticket.status === 'cancelado' ? 0 : progress,
    location,
    distanceKm,
    durationMinutes,
    remainingMinutes: Math.max(0, durationMinutes - elapsedMinutes),
    eta: arrival.toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' })
  };
}

function TicketTracking({ ticket, now, simulatedTime, onSimulate, onReset }) {
  const tracking = getTripTracking(ticket, new Date(simulatedTime ?? now));
  return (
    <section className="trip-tracking" aria-label={`Seguimiento del viaje ${ticket.trip_title}`}>
      <div className="tracking-heading">
        <div><span className="eyebrow">SEGUIMIENTO SIMULADO</span><strong>{tracking.status}</strong></div>
        <span className="tracking-percent">{tracking.progress}%</span>
      </div>
      <div className="tracking-progress" role="progressbar" aria-label="Avance estimado del viaje" aria-valuemin="0" aria-valuemax="100" aria-valuenow={tracking.progress}>
        <span style={{ width: `${tracking.progress}%` }} />
      </div>
      <div className="tracking-details">
        <span><i className="bi bi-geo-alt" /> {tracking.location}</span>
        <span><i className="bi bi-clock" /> ETA estimada: {tracking.eta}</span>
      </div>
      <p className="muted">Estimación automática basada en la hora programada y una velocidad media de 75 km/h. No corresponde a GPS real.</p>
      <div className="tracking-actions">
        <button type="button" className="button button-light" onClick={() => onSimulate(ticket)}>
          {simulatedTime == null ? 'Simular avance de horario' : 'Avanzar 30 min'}
        </button>
        {simulatedTime != null && <button type="button" className="text-button" onClick={() => onReset(ticket.ticket_code)}>Restablecer tiempo real</button>}
      </div>
    </section>
  );
}

function barcodeSvg(value, escapeHtml) {
  const barcode = getBarcodeBars(value);
  const bars = barcode.bars.map(({ x, width }) => `<rect x="${x}" y="0" width="${width}" height="48"/>`).join('');
  return `<svg class="ticket-barcode" role="img" aria-label="Código de barras ${escapeHtml(barcode.code)}" viewBox="0 0 ${barcode.width} 48" preserveAspectRatio="none">${bars}</svg>`;
}

export function buildTicketHtml(sale) {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const tickets = sale.tickets.map((ticket) => `
    <article class="ticket">
      <header><img src="${escapeHtml(new URL(imageUrl('Buses.png'), window.location.href).href)}" alt="Viajes por Chile"><div><strong>VIAJES POR CHILE</strong><span>BOLETO DE BUS</span></div></header>
      <h1>${escapeHtml(ticket.trip_title)}</h1><p>Origen: <strong>${escapeHtml(getOrigin(ticket))}</strong> · Destino: <strong>${escapeHtml(ticket.destination)}</strong></p>
      <section><div><span>Pasajero</span><strong>${escapeHtml(ticket.passenger_name)}</strong></div><div><span>RUT</span><strong>${escapeHtml(ticket.passenger_rut)}</strong></div></section>
      <section><div><span>Fecha de viaje</span><strong>${escapeHtml(ticket.schedule_date)}</strong></div><div><span>Hora</span><strong>${escapeHtml(ticket.departure_time)}</strong></div></section>
      <section><div><span>Andén</span><strong>${escapeHtml(ticket.platform)}</strong></div><div><span>Asiento</span><strong>${escapeHtml(ticket.seat_number)}</strong></div></section>
      <section><div><span>Boleto</span><strong>${escapeHtml(ticket.ticket_code)}</strong></div><div><span>Precio pagado</span><strong>${escapeHtml(formatPrice(ticket.price_paid))}</strong></div></section>
      ${barcodeSvg(ticket.ticket_code, escapeHtml)}
      <p class="discount">${Number(ticket.discount_percent) > 0 ? `${escapeHtml(ticket.discount_percent)}% de descuento aplicado · Precio normal ${escapeHtml(formatPrice(ticket.original_price))}` : 'Tarifa normal'}</p>
    </article>`).join('');
  return `<!doctype html><html lang="es"><meta charset="utf-8"><title>Boletos Viajes por Chile</title><style>
    body{font:15px Arial,sans-serif;color:#17343b;background:#f5f7f4;margin:24px}.ticket{max-width:680px;margin:0 auto 24px;padding:28px;background:#fff;border:2px dashed #496064;page-break-inside:avoid}.ticket header{display:flex;align-items:center;gap:14px;border-bottom:2px solid #dbe3df;padding-bottom:14px}.ticket header img{width:70px;height:60px;object-fit:contain}.ticket header div,.ticket section div{display:grid;gap:6px}.ticket header span,.ticket section span{font-size:12px;color:#496064}.ticket h1{font-size:24px}.ticket section{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:20px 0}.ticket-barcode{display:block;width:100%;height:64px;margin:18px 0;fill:#17343b}.discount{border-top:1px solid #dbe3df;padding-top:14px;color:#ad4528}@media print{body{background:white;margin:0}.ticket{margin:0 auto 18px}}
  </style><body>${tickets}</body></html>`;
}

export function buildTicketShareText(sale) {
  const ticketDetails = sale.tickets.map((ticket) => [
    `Boleto: ${ticket.ticket_code}`,
    `Pasajero: ${ticket.passenger_name}`,
    `Ruta: ${getOrigin(ticket)} → ${ticket.destination}`,
    `Fecha y hora: ${ticket.schedule_date} · ${ticket.departure_time}`,
    `Andén: ${ticket.platform} · Asiento: ${ticket.seat_number}`,
    `Precio pagado: ${formatPrice(ticket.price_paid)}`
  ].join('\n')).join('\n\n');
  return `Boleto electrónico Viajes por Chile\nCódigo de compra: ${sale.sale_code}\n\n${ticketDetails}\n\nTotal: ${formatPrice(sale.total_amount)} · Compra simulada, sin cobro.`;
}

export default function TicketsPage() {
  const { saleCode } = useParams();
  const [sale, setSale] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [simulatedTimes, setSimulatedTimes] = useState({});

  useEffect(() => {
    let active = true;
    apiRequest(`purchases/${encodeURIComponent(saleCode)}`)
      .then((result) => { if (active) setSale(result); })
      .catch((requestError) => { if (active) setError(requestError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [saleCode]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  function simulateAdvance(ticket) {
    setSimulatedTimes((current) => {
      const previousTime = current[ticket.ticket_code];
      const departure = new Date(`${ticket.schedule_date}T${ticket.departure_time}:00`).getTime();
      const nextTime = previousTime == null ? departure + 30 * 60_000 : previousTime + 30 * 60_000;
      return { ...current, [ticket.ticket_code]: nextTime };
    });
  }

  function downloadTickets() {
    const file = new Blob([buildTicketHtml(sale)], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `boletos-${sale.sale_code}.html`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const shareText = sale ? buildTicketShareText(sale) : '';
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const emailUrl = `mailto:?subject=${encodeURIComponent(`Boletos Viajes por Chile - ${sale?.sale_code || ''}`)}&body=${encodeURIComponent(shareText)}`;

  if (loading) return <section className="container page-section"><p role="status">Cargando boletos…</p></section>;
  if (error) return <section className="container page-section"><p className="form-error" role="alert">{error}</p><Link to="/menu">Volver a rutas</Link></section>;
  if (!sale) return null;

  return (
    <main className="container page-section tickets-page">
      <header className="ticket-confirmation">
        <span className="eyebrow">COMPRA CONFIRMADA</span>
        <h1>Tus boletos están listos</h1>
        <p>Compra <strong>{sale.sale_code}</strong> · Total {formatPrice(sale.total_amount)} · Compra simulada, sin cobro.</p>
        <div className="ticket-actions">
          <button className="button button-dark" onClick={() => window.print()}><i className="bi bi-printer" /> Imprimir / Guardar como PDF</button>
          <button className="button button-light" onClick={downloadTickets}><i className="bi bi-download" /> Descargar comprobante HTML</button>
          <a className="button button-light" href={whatsappUrl} target="_blank" rel="noreferrer"><i className="bi bi-whatsapp" /> Enviar por WhatsApp</a>
          <a className="button button-light" href={emailUrl}><i className="bi bi-envelope" /> Enviar por correo</a>
        </div>
      </header>
      <section className="issued-tickets" aria-label="Boletos emitidos">
        {sale.tickets.map((ticket) => (
          <article className="issued-ticket" key={ticket.ticket_code}>
            <header><img src={imageUrl('Buses.png')} alt="Logo Viajes por Chile" /><div><strong>VIAJES POR CHILE</strong><span>BOLETO DE BUS</span></div><span className="ticket-code">{ticket.ticket_code}</span></header>
            <h2>{ticket.trip_title}</h2>
            <p className="ticket-destination">Origen: <strong>{getOrigin(ticket)}</strong> · Destino: <strong>{ticket.destination}</strong></p>
            <div className="ticket-data">
              <div><span>Pasajero</span><strong>{ticket.passenger_name}</strong></div>
              <div><span>RUT</span><strong>{ticket.passenger_rut}</strong></div>
              <div><span>Fecha</span><strong>{ticket.schedule_date}</strong></div>
              <div><span>Hora</span><strong>{ticket.departure_time}</strong></div>
              <div><span>Andén</span><strong>{ticket.platform}</strong></div>
              <div><span>Asiento</span><strong>{ticket.seat_number}</strong></div>
            </div>
            <footer><span>{Number(ticket.discount_percent) > 0 ? `${ticket.discount_percent}% descuento · Normal ${formatPrice(ticket.original_price)}` : 'Tarifa normal'}</span><strong>{formatPrice(ticket.price_paid)}</strong></footer>
            {(() => {
              const barcode = getBarcodeBars(ticket.ticket_code);
              return <svg className="ticket-barcode" role="img" aria-label={`Código de barras ${barcode.code}`} viewBox={`0 0 ${barcode.width} 48`} preserveAspectRatio="none">
                {barcode.bars.map(({ x, width }, index) => <rect key={index} x={x} y="0" width={width} height="48" />)}
              </svg>;
            })()}
            <TicketTracking
              ticket={ticket}
              now={now}
              simulatedTime={simulatedTimes[ticket.ticket_code]}
              onSimulate={simulateAdvance}
              onReset={(ticketCode) => setSimulatedTimes((current) => {
                const { [ticketCode]: _removed, ...remaining } = current;
                return remaining;
              })}
            />
          </article>
        ))}
      </section>
      <Link to="/menu" className="button button-light">Volver a rutas</Link>
    </main>
  );
}
