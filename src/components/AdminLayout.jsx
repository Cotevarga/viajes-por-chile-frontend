import { NavLink, Outlet } from 'react-router-dom';
import { imageUrl } from '../data/catalog.js';
import LogoutButton from './LogoutButton.jsx';

export default function AdminLayout() {
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <NavLink to="/menu" className="admin-brand"><img src={imageUrl('Buses.png')} alt="" /> Viajes por Chile</NavLink>
      <span className="eyebrow">GESTIÓN</span>
      <NavLink to="/admin" end><i className="bi bi-grid" /> Panel</NavLink>
      <NavLink to="/admin/usuarios"><i className="bi bi-people" /> Usuarios</NavLink>
      <NavLink to="/admin/mensajes"><i className="bi bi-envelope" /> Mensajes</NavLink>
      <NavLink to="/admin/reportes"><i className="bi bi-bar-chart" /> Reportes</NavLink>
      <NavLink to="/admin/perfil"><i className="bi bi-person-gear" /> Mis datos</NavLink>
      <NavLink to="/menu"><i className="bi bi-signpost-2" /> Ver sitio</NavLink>
      <LogoutButton className="admin-logout" />
    </aside>
    <main className="admin-main"><Outlet /></main>
  </div>;
}