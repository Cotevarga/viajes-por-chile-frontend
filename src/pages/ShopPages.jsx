import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { useProducts } from '../context/ProductContext.jsx';
import { calculateTrip, cities, findProductForRoute, formatPrice, getProductDistanceKm, imageUrl } from '../data/catalog.js';
import { apiRequest } from '../lib/api.js';

function ProductCard({ product }) {
  const distanceKm = getProductDistanceKm(product);
  return <article className="route-card">
    <Link to={`/viajes/${product.slug}`} className="route-image"><img src={imageUrl(product.image)} alt={product.destination} loading="lazy" /><span className="route-type">{distanceKm >= 400 ? `Bus doble piso · ${distanceKm.toLocaleString('es-CL')} km` : product.type}</span></Link>
    <div className="route-card-body"><div><span className="eyebrow">DESTINO</span><h3>{product.destination}</h3></div><div className="route-card-bottom"><span>desde <strong>{formatPrice(product.price)}</strong></span><Link className="round-arrow" to={`/viajes/${product.slug}`} aria-label={`Ver viaje a ${product.destination}`}><i className="bi bi-arrow-up-right" /></Link></div></div>
  </article>;
}

const travelZones = [
  { id: 'viajes-nortinos', name: 'Viajes nortinos', slugs: ['laserena', 'antofagasta', 'arica'] },
  { id: 'zona-centro', name: 'Zona centro', slugs: ['valparaiso', 'talca', 'pichilemu', 'quintero', 'vina'] },
  { id: 'zona-austral', name: 'Zona austral', slugs: ['concepcion', 'pucon', 'puertomontt', 'chiloe', 'valdivia'] }
];

const doubleDeckSeats = {
  salon: [[71, 72, 74], [75, 76, 78], [79, 80, 82], [83, 84, 86]],
  semi: Array.from({ length: 13 }, (_, row) => [1, 2, 3, 4].map((seat) => row * 4 + seat))
};

const seatGridColumns = [1, 2, 4, 5];

export function MenuPage() {
  const { products } = useProducts();
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [date, setDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [tripType, setTripType] = useState('one-way');
  const [passengerCount, setPassengerCount] = useState(1);
  const [quote, setQuote] = useState(null);
  const [query, setQuery] = useState('');
  const [serviceType, setServiceType] = useState('');
  const [scheduleFilter, setScheduleFilter] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const serviceTypes = useMemo(() => [...new Set(products.map((product) => product.type).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'es')), [products]);
  const matchingProducts = useMemo(() => products.filter((product) => (
    `${product.title} ${product.destination}`.toLowerCase().includes(query.toLowerCase())
    && (!serviceType || product.type === serviceType)
    && (!scheduleFilter || (scheduleFilter === 'mañana' ? (product.schedules || []).some((item) => Number(item.time?.slice(0, 2)) < 12) : (product.schedules || []).some((item) => Number(item.time?.slice(0, 2)) >= 18)))
  )), [products, query, serviceType, scheduleFilter]);
  const productsByZone = travelZones.map((zone) => ({
    ...zone,
    products: matchingProducts.filter((product) => (
      zone.slugs.includes(product.slug)
      || (zone.id === 'zona-centro' && !travelZones.some((knownZone) => knownZone.slugs.includes(product.slug)))
    ))
  }));

  function submitTrip(event) {
    event.preventDefault();
    const trip = calculateTrip(origin, destination);
    if (!trip) {
      setQuote(null);
      setError('Elige dos ciudades diferentes para calcular el viaje.');
      return;
    }
    const outboundProduct = findProductForRoute(products, origin, destination);
    let returnProduct;
    let returnTrip;
    if (tripType === 'round-trip') {
      returnProduct = findProductForRoute(products, destination, origin);
      if (!outboundProduct || !returnProduct) {
        setQuote(null);
        setError('La ida y la vuelta requieren rutas publicadas en ambas direcciones.');
        return;
      }
      if (outboundProduct.status !== 'Activo' || returnProduct.status !== 'Activo') {
        setQuote(null);
        setError('Una de las rutas seleccionadas no está disponible para compra.');
        return;
      }
      const outboundScheduleExists = (outboundProduct.schedules || []).some((schedule) => schedule.date === date);
      const returnScheduleExists = (returnProduct.schedules || []).some((schedule) => schedule.date === returnDate);
      if (!outboundScheduleExists || !returnDate || returnDate < date || !returnScheduleExists) {
        setQuote(null);
        setError('No hay una salida publicada en la ida o el regreso para las fechas seleccionadas.');
        return;
      }
      returnTrip = calculateTrip(destination, origin);
    }
    setError('');
    setQuote({
      ...trip,
      totalPrice: trip.price + (returnTrip?.price || 0),
      outboundProductSlug: outboundProduct?.slug,
      returnProductSlug: returnProduct?.slug,
      returnTrip
    });
  }
  const reservableProduct = products.find((product) => product.slug === quote?.outboundProductSlug);

  return <>
    <section className="booking-hero container" aria-labelledby="search-title" style={{ backgroundImage: `linear-gradient(90deg, rgba(20, 45, 50, .78), rgba(20, 45, 50, .28)), url("${imageUrl('Valpo.webp')}")` }}>
      <div className="booking-hero-heading"><span className="eyebrow">VIAJA POR CHILE</span><h1 id="search-title">Comprar pasajes en bus</h1></div>
      <form className="booking-search" onSubmit={submitTrip}>
        <div className="trip-type-options" role="group" aria-label="Tipo de viaje">
          <label><input type="radio" name="tripType" value="one-way" checked={tripType === 'one-way'} onChange={() => { setTripType('one-way'); setQuote(null); }} /> Sólo ida</label>
          <label><input type="radio" name="tripType" value="round-trip" checked={tripType === 'round-trip'} onChange={() => { setTripType('round-trip'); setQuote(null); }} /> Ida y vuelta</label>
        </div>
        <div className={`booking-search-fields ${tripType === 'round-trip' ? 'is-round-trip' : ''}`}>
          <label><span>Origen</span><span className="booking-input"><i className="bi bi-geo-alt" /><select value={origin} onChange={(event) => { setOrigin(event.target.value); setQuote(null); }} required><option value="">Selecciona ciudad</option>{Object.entries(cities).map(([slug, city]) => <option key={slug} value={slug}>{city.name}</option>)}</select></span></label>
          <button type="button" className="swap-cities" aria-label="Intercambiar origen y destino" onClick={() => { setOrigin(destination); setDestination(origin); setQuote(null); }}><i className="bi bi-arrow-left-right" /></button>
          <label><span>Destino</span><span className="booking-input"><i className="bi bi-geo-alt" /><select value={destination} onChange={(event) => { setDestination(event.target.value); setQuote(null); }} required><option value="">Selecciona ciudad</option>{Object.entries(cities).map(([slug, city]) => <option key={slug} value={slug}>{city.name}</option>)}</select></span></label>
          <label><span>Salida</span><span className="booking-input"><i className="bi bi-calendar3" /><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setQuote(null); }} min={new Date().toISOString().slice(0, 10)} required /></span></label>
          {tripType === 'round-trip' && <label><span>Regreso</span><span className="booking-input"><i className="bi bi-calendar3" /><input type="date" value={returnDate} onChange={(event) => { setReturnDate(event.target.value); setQuote(null); }} min={date || new Date().toISOString().slice(0, 10)} required /></span></label>}
          <label><span>Pasajeros</span><span className="booking-input"><i className="bi bi-people" /><select value={passengerCount} onChange={(event) => { setPassengerCount(Number(event.target.value)); setQuote(null); }}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count} {count === 1 ? 'Adulto' : 'Adultos'}</option>)}</select></span></label>
          <button className="button button-search" type="submit">Buscar <i className="bi bi-search" /></button>
        </div>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {quote && <div className="quote-result"><div><span className="eyebrow">TU RUTA · {date}{quote.returnTrip ? ` · Regreso ${returnDate}` : ''}</span><h3>{quote.from.name} <i className="bi bi-arrow-right" /> {quote.to.name}</h3><p>{quote.distance.toLocaleString('es-CL')} km aprox. · {passengerCount} pasajero(s){quote.returnTrip ? ` · Ida y vuelta: ${quote.returnTrip.distance.toLocaleString('es-CL')} km por regreso` : ''}</p></div><strong>{formatPrice(quote.totalPrice)}{quote.returnTrip ? ' / ida y vuelta' : ' / pasaje'}</strong>{reservableProduct ? <Link className="button button-accent" to={`/viajes/${reservableProduct.slug}`} state={{ departureDate: date, passengerCount, roundTrip: quote.returnTrip ? { leg: 'outbound', returnProductSlug: quote.returnProductSlug, returnDate } : null }}>Elegir salida</Link> : <button className="button button-accent" onClick={() => navigate('/menu#rutas')}>Ver rutas disponibles</button>}</div>}
    </section>

    <section className="destinations container" id="rutas">
      <div className="section-heading"><div><span className="eyebrow">RUTAS SELECCIONADAS</span><h2>Tu próximo lugar</h2></div><div className="route-controls"><label className="route-filter"><i className="bi bi-search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar destino" aria-label="Buscar destino" /></label><label className="route-category">Categoría<select value={serviceType} onChange={(event) => setServiceType(event.target.value)} aria-label="Filtrar por tipo de servicio"><option value="">Todos los servicios</option>{serviceTypes.map((type) => <option key={type} value={type}>{type}</option>)}</select></label><label className="route-category">Horario<select value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)} aria-label="Filtrar por horario"><option value="">Cualquier horario</option><option value="mañana">Mañana</option><option value="noche">Noche</option></select></label></div></div>
      <nav className="travel-zone-links" aria-label="Zonas de viaje">
        {travelZones.map((zone) => <a className="button button-light" href={`#${zone.id}`} key={zone.id}>{zone.name}</a>)}
      </nav>
      {matchingProducts.length ? productsByZone.map((zone) => (
        <section className="travel-zone" id={zone.id} aria-labelledby={`${zone.id}-title`} key={zone.id}>
          <h3 id={`${zone.id}-title`}>{zone.name}</h3>
          {zone.products.length > 0 && <div className="row g-4">{zone.products.map((product) => <div className="col-12 col-sm-6 col-lg-4" key={product.slug}><ProductCard product={product} /></div>)}</div>}
        </section>
      )) : <div className="empty-results">No encontramos rutas{serviceType ? ` del servicio ${serviceType}` : ''}{query ? ` con “${query}”` : ''}.</div>}
      <div className="text-center mt-4"><button className="text-button" onClick={() => navigate('/blog')}>Ideas para el viaje <i className="bi bi-arrow-up-right" /></button></div>
    </section>
  </>;
}

export function TripDetailPage() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const roundTrip = location.state?.roundTrip;
  const isReturnLeg = roundTrip?.leg === 'return';
  const { products } = useProducts();
  const { addItem } = useCart();
  const [image, setImage] = useState('');
  const [quantity, setQuantity] = useState(() => location.state?.passengerCount || 1);
  const [scheduleId, setScheduleId] = useState('');
  const [added, setAdded] = useState(false);
  const [seatClass, setSeatClass] = useState('semi');
  const [bookingOpen, setBookingOpen] = useState(() => Boolean(location.state?.departureDate));
  const [passengers, setPassengers] = useState(() => {
    const savedPassengers = location.state?.passengers;
    return Array.isArray(savedPassengers) && savedPassengers.length
      ? savedPassengers.map(({ name = '', rut = '' }) => ({ name, rut, seatNumber: null }))
      : [{ name: '', rut: '', seatNumber: null }];
  });
  const [seatMapOpen, setSeatMapOpen] = useState(() => Boolean(location.state?.departureDate));
  const [occupiedSeats, setOccupiedSeats] = useState([]);
  const [availabilityError, setAvailabilityError] = useState('');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);
  const [customDate, setCustomDate] = useState(() => location.state?.departureDate || (() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  })());
  const [customTime, setCustomTime] = useState('09:00');
  const product = products.find((item) => item.slug === slug);
  const gallery = product?.gallery?.length ? product.gallery : product ? [product.image] : [];
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const schedules = (product?.schedules || []).filter((item) => item.date >= todayString);
  const departureDates = [...new Set(schedules.map((item) => item.date))];
  const preferredDate = location.state?.departureDate;
  const selectedDate = schedules.find((item) => item.id === scheduleId)?.date
    || (departureDates.includes(preferredDate) ? preferredDate : departureDates[0])
    || '';
  const dateSchedules = schedules.filter((item) => item.date === selectedDate);
  const customSchedule = {
    id: `custom:${customDate}:${customTime}`,
    date: customDate,
    time: customTime,
    platform: 'Por asignar'
  };
  const schedule = dateSchedules.find((item) => item.id === scheduleId) || dateSchedules[0] || (!schedules.length ? customSchedule : null);
  const discountPercent = Number(product?.discount_percent || 0);
  const distanceKm = getProductDistanceKm(product);
  const hasBothSeats = distanceKm >= 400 || product?.type === 'Salón Cama';
  const seatFactor = hasBothSeats && seatClass === 'salon' ? 1.25 : 1;
  const basePrice = Math.round(Number(product?.price || 0) * seatFactor);
  const discountedPrice = Math.round(basePrice * (100 - discountPercent) / 100);
  const currentImage = gallery.includes(image) ? image : product?.image;
  const related = products.filter((item) => item.slug !== product?.slug).slice(0, 4);
  const selectedSeatRows = hasBothSeats
    ? doubleDeckSeats[seatClass]
    : Array.from({ length: 11 }, (_, row) => [1, 2, 3, 4].map((seat) => row * 4 + seat));
  const occupiedSeatSet = new Set(occupiedSeats);
  const selectedSeatCount = passengers.filter((passenger) => passenger.seatNumber).length;

  useEffect(() => {
    setQuantity(location.state?.passengerCount || 1);
    setScheduleId('');
    setAdded(false);
    setSeatClass('semi');
    setPassengers(() => {
      const savedPassengers = location.state?.passengers;
      return Array.isArray(savedPassengers) && savedPassengers.length
        ? savedPassengers.map(({ name = '', rut = '' }) => ({ name, rut, seatNumber: null }))
        : [{ name: '', rut: '', seatNumber: null }];
    });
    setBookingOpen(Boolean(location.state?.departureDate));
    setSeatMapOpen(Boolean(location.state?.departureDate));
  }, [slug]);

  useEffect(() => {
    if (!product || !schedule || !schedules.length) {
      setOccupiedSeats([]);
      setAvailabilityError('');
      setAvailabilityLoading(false);
      return undefined;
    }

    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError('');
    apiRequest(`availability/seats?slug=${encodeURIComponent(product.slug)}&scheduleId=${encodeURIComponent(schedule.id)}`)
      .then((seats) => { if (active) setOccupiedSeats(seats); })
      .catch((requestError) => { if (active) setAvailabilityError(requestError.message); })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [product?.slug, schedule?.id, schedules.length, availabilityRefresh]);

  if (!product) return <section className="container page-section"><h1>Ruta no encontrada</h1><Link to="/menu">Volver a destinos</Link></section>;

  function changeQuantity(value) {
    setQuantity(value);
    setPassengers((current) => Array.from({ length: value }, (_, index) => current[index] || { name: '', rut: '', seatNumber: null }));
    setAdded(false);
  }

  function updatePassenger(index, field, value) {
    setPassengers((current) => current.map((passenger, position) => position === index
      ? { ...passenger, [field]: value }
      : passenger));
  }

  function addBooking(event) {
    event.preventDefault();
    if (!schedule || product.status !== 'Activo') return;
    addItem({
      ...product,
      price: discountedPrice,
      originalPrice: basePrice,
      discountPercent,
      seatClass: hasBothSeats ? seatClass : '',
      title: hasBothSeats ? `${product.title} (${seatClass === 'salon' ? 'Salón Cama' : 'Semi Cama'})` : product.title,
      scheduleId: schedule.id,
      scheduleDate: schedule.date,
      departureTime: schedule.time,
      platform: schedule.platform,
      customSchedule: !schedules.length,
      passengers: passengers.map((passenger) => passenger.seatNumber
        ? { name: passenger.name, rut: passenger.rut, seatNumber: passenger.seatNumber }
        : { name: passenger.name, rut: passenger.rut })
    }, quantity);
    if (roundTrip?.leg === 'outbound') {
      navigate(`/viajes/${roundTrip.returnProductSlug}`, {
        state: {
          departureDate: roundTrip.returnDate,
          passengerCount: quantity,
          roundTrip: { leg: 'return' },
          passengers: passengers.map(({ name, rut }) => ({ name, rut }))
        }
      });
      return;
    }
    setAdded(true);
  }

  return <section className="container detail-page">
    <div className="breadcrumb-line"><Link to="/menu">Rutas</Link><i className="bi bi-chevron-right" /><span>{product.destination}</span></div>
    <div className="detail-grid">
      <div><div className="detail-image"><img src={imageUrl(currentImage)} alt={`Paisaje de ${product.destination}`} /></div><div className="detail-thumbs">{gallery.map((photo) => <button key={photo} className={currentImage === photo ? 'is-active' : ''} onClick={() => setImage(photo)} aria-label="Ver otra imagen"><img src={imageUrl(photo)} alt="" /></button>)}</div></div>
      <div className="detail-copy"><span className="eyebrow">VIAJE INTERURBANO · {product.type}</span><h1>{product.title}</h1><p>{product.description}</p><div className="availability"><span className={product.status === 'Activo' ? 'status-dot' : 'status-dot is-unavailable'} />{product.status === 'Activo' ? 'Disponible para reservar' : 'Agotado'}</div>{discountPercent > 0 ? <><del className="detail-original-price">{formatPrice(basePrice)}</del><div className="detail-price">{formatPrice(discountedPrice)} <small>/ pasaje · {discountPercent}% de descuento</small></div></> : <div className="detail-price">{formatPrice(basePrice)} <small>/ pasaje</small></div>}
        {distanceKm >= 400 && <p className="long-distance-notice"><i className="bi bi-bus-front" /> {distanceKm.toLocaleString('es-CL')} km · Bus doble piso: Salón Cama abajo y Semi Cama arriba.</p>}
        {isReturnLeg && <p className="form-success" role="status">Tramo de ida agregado al carrito. Selecciona la salida y los asientos del regreso para completar la compra.</p>}
        <label className="booking-toggle"><input type="checkbox" checked={bookingOpen} onChange={(event) => setBookingOpen(event.target.checked)} /> Reservar este viaje</label>
        {bookingOpen && <form className="booking-form" onSubmit={addBooking}>
          {schedules.length ? <>
            <label>Fecha de viaje<select value={selectedDate} onChange={(event) => { const nextSchedule = schedules.find((item) => item.date === event.target.value); setScheduleId(nextSchedule?.id || ''); setAdded(false); }} required>{departureDates.map((date) => <option key={date} value={date}>{date}</option>)}</select></label>
            <label>Horario disponible<select value={schedule?.id || ''} onChange={(event) => { setScheduleId(event.target.value); setAdded(false); }} required>{dateSchedules.map((item) => <option key={item.id} value={item.id}>{item.time} · Andén {item.platform} · {distanceKm >= 400 ? 64 : item.capacity} cupos</option>)}</select></label>
          </> : <>
            <p className="muted">Esta ruta no tiene salidas publicadas. Elige una fecha y hora; el andén se asignará posteriormente y no hay cupos preconfigurados.</p>
            <label>Fecha de viaje<input type="date" value={customDate} min={todayString} onChange={(event) => { setCustomDate(event.target.value); setAdded(false); }} required /></label>
            <label>Hora de salida<input type="time" value={customTime} onChange={(event) => { setCustomTime(event.target.value); setAdded(false); }} required /></label>
          </>}
          {hasBothSeats && <div className="deck-tabs" role="tablist" aria-label="Piso del bus">
            <button type="button" role="tab" aria-selected={seatClass === 'salon'} className={seatClass === 'salon' ? 'is-active' : ''} onClick={() => { setSeatClass('salon'); setPassengers((current) => current.map((passenger) => ({ ...passenger, seatNumber: null }))); setAdded(false); }}>
              <span>{seatClass === 'salon' ? '✓ ' : ''}Piso inferior</span><strong>Salón Cama</strong><small>{formatPrice(Math.round(Number(product.price) * 1.25 * (100 - discountPercent) / 100))} · 12 asientos</small>
            </button>
            <button type="button" role="tab" aria-selected={seatClass === 'semi'} className={seatClass === 'semi' ? 'is-active' : ''} onClick={() => { setSeatClass('semi'); setPassengers((current) => current.map((passenger) => ({ ...passenger, seatNumber: null }))); setAdded(false); }}>
              <span>{seatClass === 'semi' ? '✓ ' : ''}Piso superior</span><strong>Semi Cama</strong><small>{formatPrice(Math.round(Number(product.price) * (100 - discountPercent) / 100))} · 52 asientos</small>
            </button>
          </div>}
          <label>Cantidad de pasajes<select value={quantity} disabled={isReturnLeg} onChange={(event) => changeQuantity(Number(event.target.value))}>{[1, 2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <div className="seat-map-panel">
            <div className="seat-map-heading"><div><strong>Selecciona tus asientos</strong><span>{selectedSeatCount} de {quantity} elegidos</span></div><button type="button" className="text-button" onClick={() => setSeatMapOpen((open) => !open)}>{seatMapOpen ? 'Ocultar mapa' : 'Ver mapa'}</button></div>
            {seatMapOpen && <><div className="bus-front" aria-hidden="true">FRENTE DEL BUS</div><div className={`seat-map ${hasBothSeats ? seatClass : 'single-deck'}`} role="group" aria-label={hasBothSeats ? `Mapa ${seatClass === 'salon' ? 'piso inferior Salón Cama' : 'piso superior Semi Cama'}` : 'Mapa de asientos'}>
              {selectedSeatRows.map((row, rowIndex) => <div className="seat-row" key={`row-${rowIndex}`}>
                {row.map((seat, seatIndex) => {
                  const passengerIndex = passengers.findIndex((passenger) => passenger.seatNumber === seat);
                  const occupied = occupiedSeatSet.has(seat);
                  const assigned = passengerIndex >= 0;
                  const noPassengerSpace = !assigned && selectedSeatCount >= quantity;
                  return <button type="button" key={seat} style={{ gridColumn: seatGridColumns[seatIndex] }} disabled={occupied || availabilityLoading || Boolean(availabilityError) || noPassengerSpace} className={`seat-button ${assigned ? 'is-selected' : ''} ${occupied ? 'is-occupied' : ''}`} aria-label={`Asiento ${seat}${occupied ? ', ocupado' : ''}`} onClick={() => {
                    setPassengers((current) => {
                      const nextSeatOwner = current.findIndex((passenger) => passenger.seatNumber === seat);
                      if (nextSeatOwner >= 0) return current.map((passenger, index) => index === nextSeatOwner ? { ...passenger, seatNumber: null } : passenger);
                      const availableIndex = current.findIndex((passenger) => passenger.seatNumber == null);
                      return current.map((passenger, index) => index === availableIndex ? { ...passenger, seatNumber: seat } : passenger);
                    });
                    setAdded(false);
                  }}>{seat}</button>;
                })}
              </div>)}
            </div>{availabilityLoading && <p className="muted" role="status">Consultando disponibilidad…</p>}{availabilityError && <p className="form-error" role="alert">{availabilityError} <button type="button" className="text-button" onClick={() => setAvailabilityRefresh((count) => count + 1)}>Reintentar</button></p>}<div className="seat-legend"><span><i className="seat-sample is-available" />Disponible</span><span><i className="seat-sample is-selected" />Seleccionado</span><span><i className="seat-sample is-occupied" />Ocupado</span></div></>}
          </div>
          {passengers.map((passenger, index) => <fieldset className="booking-passenger" key={index}>
            <legend>Pasajero {index + 1}{passenger.seatNumber ? ` · Asiento ${passenger.seatNumber}` : ''}</legend>
            <label>Nombre completo<input autoComplete="name" value={passenger.name} onChange={(event) => updatePassenger(index, 'name', event.target.value)} maxLength="150" required /></label>
            <label>RUT<input value={passenger.rut} onChange={(event) => updatePassenger(index, 'rut', event.target.value)} placeholder="12345678-9" pattern="(?:[0-9.kK]|-){8,12}" title="Ingresa un RUT chileno válido" required /></label>
          </fieldset>)}
          {roundTrip?.leg === 'outbound' && <p className="muted">Después de elegir esta salida, continuarás a la ruta de regreso. Ambos tramos se emitirán juntos al confirmar la compra.</p>}
          <button disabled={product.status !== 'Activo' || !schedule || selectedSeatCount !== quantity || availabilityLoading || Boolean(availabilityError)} className="button button-dark detail-add">{isReturnLeg ? 'Añadir regreso al carrito' : added ? 'Añadido al carrito' : 'Añadir al carrito'} <i className="bi bi-bag-plus" /></button>
          {added && <p className="form-success" role="status">Pasajes añadidos al carrito con sus datos de viaje.</p>}
        </form>}
      </div>
    </div>
    <div className="related-section"><div className="section-heading"><div><span className="eyebrow">SIGUE EXPLORANDO</span><h2>Otras rutas</h2></div><Link className="text-button" to="/menu">Ver todas</Link></div><div className="route-grid related-grid">{related.map((item) => <ProductCard product={item} key={item.slug} />)}</div></div>
  </section>;
}

const ShopPages = { MenuPage, TripDetailPage };
export default ShopPages;