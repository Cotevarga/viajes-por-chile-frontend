import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const roleAliases = {
  customer: 'customer',
  cliente: 'customer',
  seller: 'seller',
  vendedor: 'seller',
  admin: 'admin',
  administrador: 'admin'
};

export function getRoleHome(role) {
  const normalizedRole = typeof role === 'string' ? role.toLowerCase() : '';
  if (['admin', 'administrador'].includes(normalizedRole)) return '/admin';
  if (['seller', 'vendedor'].includes(normalizedRole)) return '/vendedor';
  return '/menu';
}

export default function RoleRoute({ allowedRoles, children }) {
  const { user, isRestoring } = useAuth();
  const storedRole = typeof user?.role === 'string' ? user.role.toLowerCase() : '';
  const role = roleAliases[storedRole];

  if (isRestoring) return <p className="container page-section" role="status">Restaurando sesión…</p>;
  if (!user || !role) return <Navigate to="/" replace />;
  if (!allowedRoles.includes(role)) return <Navigate to={getRoleHome(role)} replace />;
  return children || <Outlet />;
}

export function GuestRoute({ children }) {
  const { user, isRestoring } = useAuth();
  const storedRole = typeof user?.role === 'string' ? user.role.toLowerCase() : '';
  const role = roleAliases[storedRole];

  if (isRestoring) return <p className="container page-section" role="status">Restaurando sesión…</p>;
  if (role) return <Navigate to={getRoleHome(role)} replace />;
  return children;
}
