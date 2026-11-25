import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiRequest } from '../lib/api.js';

export const MESSAGE_STATUSES = {
  no_leido: 'No leído',
  leido: 'Leído',
  aplicado: 'Aplicado',
  archivado: 'Archivado',
  eliminado: 'Eliminado'
};

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [from, setFrom] = useState('');
  const [until, setUntil] = useState('');
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState('checking');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { user } = await apiRequest('auth/me');
        if (!active) return;
        if (user?.role !== 'admin') {
          setAccess('denied');
          return;
        }
        setAccess('granted');
        setLoading(true);
        const params = new URLSearchParams();
        if (filter) params.set('status', filter);
        if (typeFilter) params.set('type', typeFilter);
        const query = params.toString() ? `?${params}` : '';
        const data = await apiRequest(`contact-messages${query}`);
        if (active) {
          setMessages(data);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, [filter, typeFilter]);

  async function update(id, changes) {
    try {
      const { message } = await apiRequest(`contact-messages/${id}`, { method: 'PUT', body: JSON.stringify(changes) });
      setMessages((current) => current
        .map((item) => (item.id === id ? message : item))
        .filter((item) => (filter ? item.status === filter : item.status !== 'eliminado')));
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  async function remove(id, permanent = false) {
    if (permanent && !window.confirm('¿Eliminar definitivamente este mensaje? No se puede deshacer.')) return;
    try {
      await apiRequest(`contact-messages/${id}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' });
      setMessages((current) => current.filter((item) => item.id !== id));
      setError('');
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  if (access === 'checking') {
    if (error) return <div className="admin-content"><p className="form-error" role="alert">{error}</p></div>;
    return <div className="admin-content"><p className="muted">Verificando sesión de administrador…</p></div>;
  }
  if (access === 'denied') return <Navigate to="/" replace />;

  const invalidRange = from && until && from > until;
  const search = query.trim().toLocaleLowerCase('es-CL');
  const filtered = messages.filter((item) => {
    const date = item.created_at?.slice(0, 10) || '';
    return (!from || date >= from) && (!until || date <= until)
      && (!search || [item.name, item.email, item.message].some((text) => text?.toLocaleLowerCase('es-CL').includes(search)));
  });
  const unread = filtered.filter((item) => item.status === 'no_leido').length;

  async function exportMessages() {
    try {
      const { exportMessagesToExcel } = await import('./reportExcel.js');
      exportMessagesToExcel(filtered);
      setError('');
    } catch (exportError) {
      setError(`No se pudieron exportar los mensajes: ${exportError.message}`);
    }
  }

  return <div className="admin-content">
    <header className="admin-topline">
      <div><span className="eyebrow">GESTIÓN / MENSAJES</span><h1>Mensajes de contacto</h1></div>
    </header>
    <section className="admin-table-wrap">
      <div className="section-heading message-controls">
        <div><span className="eyebrow">{unread} SIN LEER</span><h2>Bandeja de entrada</h2></div>
        <label>Tipo
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrar por tipo">
            <option value="">Mensajes y reclamos</option>
            <option value="mensaje">Solo mensajes</option>
            <option value="reclamo">Solo reclamos</option>
          </select>
        </label>
        <label>Estado
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filtrar por estado">
            <option value="">Todos (sin eliminados)</option>
            {Object.entries(MESSAGE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>Desde<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label>Hasta<input type="date" value={until} onChange={(event) => setUntil(event.target.value)} /></label>
        <label>Buscar<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, correo o texto" /></label>
        <button type="button" className="button button-dark" onClick={exportMessages} disabled={loading || Boolean(invalidRange)}>
          Exportar Excel
        </button>
      </div>
      {invalidRange && <p className="form-error" role="alert">La fecha inicial debe ser anterior o igual a la fecha final.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading ? <p className="muted">Cargando mensajes…</p> : filtered.length && !invalidRange ? <div className="table-responsive"><table className="table admin-table messages-table">
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Nombre</th><th>Correo</th><th>Mensaje</th><th>Estado</th><th>Notas</th><th>Acciones</th></tr></thead>
        <tbody>{filtered.map((item) => <tr key={item.id} style={item.status === 'no_leido' ? { fontWeight: 600 } : undefined}>
          <td>{new Date(item.created_at.replace(' ', 'T')).toLocaleString('es-CL')}</td>
          <td><span className={`table-status ${item.type === 'reclamo' ? 'is-off' : ''}`}>{item.type === 'reclamo' ? 'Reclamo' : 'Mensaje'}</span></td>
          <td>{item.name}</td>
          <td><a href={`mailto:${item.email}`}>{item.email}</a></td>
          <td style={{ whiteSpace: 'pre-wrap', maxWidth: 320 }}>{item.message}</td>
          <td>
            <select value={item.status} onChange={(event) => update(item.id, { status: event.target.value })} aria-label={`Estado del mensaje de ${item.name}`}>
              {Object.entries(MESSAGE_STATUSES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </td>
          <td>
            <textarea defaultValue={item.admin_notes || ''} rows="2" aria-label={`Notas para ${item.name}`}
              onBlur={(event) => event.target.value !== (item.admin_notes || '') && update(item.id, { admin_notes: event.target.value })} />
          </td>
          <td>
            {item.status !== 'eliminado' && <button type="button" onClick={() => remove(item.id)}>Eliminar</button>}
            {item.status === 'eliminado' && <button type="button" onClick={() => remove(item.id, true)}>Borrar definitivo</button>}
          </td>
        </tr>)}</tbody>
      </table></div> : !error && <p className="muted">No hay mensajes en esta vista.</p>}
    </section>
  </div>;
}
