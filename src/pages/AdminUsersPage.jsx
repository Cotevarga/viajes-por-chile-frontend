import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiRequest } from '../lib/api.js';

const blankUser = {
  name: '',
  email: '',
  telephone: '',
  region: '',
  commune: '',
  role: 'customer',
  password: ''
};

const roleLabels = {
  admin: 'Administrador',
  seller: 'Vendedor',
  customer: 'Cliente'
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [access, setAccess] = useState('checking');
  const [adminId, setAdminId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankUser);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      try {
        const { user } = await apiRequest('auth/me');
        if (!active) return;
        if (user?.role !== 'admin') {
          setAccess('denied');
          return;
        }
        setAdminId(user.id);
        setAccess('granted');
        const buyerUsers = await apiRequest('users');
        if (active) setUsers(buyerUsers);
      } catch (requestError) {
        if (active) setError(requestError.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadUsers();
    return () => { active = false; };
  }, []);

  function startCreate() {
    setEditing('new');
    setForm(blankUser);
    setError('');
    setNotice('');
  }

  function startEdit(user) {
    setEditing(user.id);
    setForm({
      name: user.name || '',
      email: user.email || '',
      telephone: user.telephone || '',
      region: user.region || '',
      commune: user.commune || '',
      role: user.role || 'customer',
      password: ''
    });
    setError('');
    setNotice('');
  }

  async function saveUser(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    const isCreating = editing === 'new';
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      telephone: form.telephone.trim(),
      region: form.region.trim(),
      commune: form.commune.trim(),
      role: form.role
    };
    if (isCreating) payload.password = form.password;

    try {
      const saved = await apiRequest(isCreating ? 'users' : `users/${editing}`, {
        method: isCreating ? 'POST' : 'PUT',
        body: JSON.stringify(payload)
      });
      setUsers((current) => isCreating
        ? [saved, ...current]
        : current.map((user) => user.id === saved.id ? saved : user));
      setEditing(null);
      setForm(blankUser);
      setNotice(isCreating ? 'Usuario creado correctamente.' : 'Cambios del usuario guardados.');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user) {
    setError('');
    setNotice('');
    try {
      await apiRequest(`users/${user.id}`, { method: 'DELETE' });
      setUsers((current) => current.filter((entry) => entry.id !== user.id));
      setDeleteTarget(null);
      setNotice(`Se eliminó la cuenta de ${user.name}.`);
    } catch (requestError) {
      setDeleteTarget(null);
      setError(requestError.message);
    }
  }

  if (access === 'checking') {
    if (error) return <div className="admin-content"><p className="form-error" role="alert">{error}</p></div>;
    return <div className="admin-content"><p className="muted">Verificando sesión de administrador…</p></div>;
  }
  if (access === 'denied') return <Navigate to="/" replace />;

  return <div className="admin-content">
    <header className="admin-topline">
      <div><span className="eyebrow">GESTIÓN / USUARIOS</span><h1>Usuarios registrados</h1></div>
      <button className="button button-dark" onClick={startCreate}><i className="bi bi-person-plus" /> Crear usuario</button>
    </header>
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p className="form-success" role="status">{notice}</p>}

    {editing !== null && <form className="admin-editor user-editor" onSubmit={saveUser}>
      <div className="section-heading">
        <div><span className="eyebrow">CUENTAS</span><h2>{editing === 'new' ? 'Crear usuario' : 'Editar usuario'}</h2></div>
        <button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Cancelar edición"><i className="bi bi-x-lg" /></button>
      </div>
      <div className="form-two">
        <label>Nombre completo<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} maxLength="150" required /></label>
        <label>Correo electrónico<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} maxLength="190" required /></label>
      </div>
      <div className="form-three">
        <label>Teléfono<input value={form.telephone} onChange={(event) => setForm({ ...form, telephone: event.target.value })} maxLength="40" /></label>
        <label>Región<input value={form.region} onChange={(event) => setForm({ ...form, region: event.target.value })} maxLength="100" /></label>
        <label>Comuna<input value={form.commune} onChange={(event) => setForm({ ...form, commune: event.target.value })} maxLength="100" /></label>
      </div>
      <div className="form-two">
        <label>Tipo de usuario<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
          <option value="customer">Cliente</option><option value="seller">Vendedor</option><option value="admin">Administrador</option>
        </select></label>
        {editing === 'new' && <label>Contraseña inicial<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} minLength="8" maxLength="72" autoComplete="new-password" required /></label>}
      </div>
      <div className="user-form-actions">
        <button className="button button-dark" disabled={saving}>{saving ? 'Guardando…' : editing === 'new' ? 'Guardar usuario' : 'Guardar cambios'}</button>
        <button type="button" className="button button-light" onClick={() => setEditing(null)}>Cancelar</button>
      </div>
    </form>}

    <section className="admin-table-wrap">
      <div className="section-heading"><div><span className="eyebrow">HISTORIAL DE CUENTAS</span><h2>Todas las cuentas ({users.length})</h2></div></div>
      {loading ? <p className="muted">Cargando usuarios…</p> : users.length ? <div className="table-responsive"><table className="table admin-table">
        <thead><tr><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Región</th><th>Comuna</th><th>Tipo</th><th>Fecha de registro</th><th>Acciones</th></tr></thead>
        <tbody>{users.map((user) => <tr key={user.id}>
          <td>{user.name}</td><td>{user.email}</td><td>{user.telephone || '—'}</td><td>{user.region || '—'}</td><td>{user.commune || '—'}</td>
          <td><span className="user-role-badge">{roleLabels[user.role] || user.role}</span></td>
          <td>{user.createdAt ? new Date(String(user.createdAt).replace(' ', 'T')).toLocaleString('es-CL') : '—'}</td>
          <td className="user-actions">
            {deleteTarget === user.id
              ? <span className="delete-confirmation"><span>¿Eliminar?</span><button className="text-button danger-text" onClick={() => deleteUser(user)}>Sí</button><button className="text-button" onClick={() => setDeleteTarget(null)}>No</button></span>
              : <><button className="text-button" onClick={() => startEdit(user)}>Editar</button><button className="text-button danger-text" disabled={user.id === adminId} title={user.id === adminId ? 'No puedes eliminar tu propia cuenta' : undefined} onClick={() => setDeleteTarget(user.id)}>Eliminar</button></>}
          </td>
        </tr>)}</tbody>
      </table></div> : !error && <p className="muted">Todavía no hay usuarios registrados.</p>}
    </section>
  </div>;
}
