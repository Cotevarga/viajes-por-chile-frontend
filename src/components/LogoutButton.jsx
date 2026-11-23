import { useNavigate } from 'react-router-dom';
import { apiRequest, clearAuth } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LogoutButton({ className = 'button button-dark' }) {
  const navigate = useNavigate();
  const { updateUser } = useAuth();

  async function logout() {
    let warning = '';
    try {
      await apiRequest('auth/logout', { method: 'POST' });
    } catch (error) {
      warning = `La sesión local se cerró, pero el servidor no confirmó la revocación: ${error.message}`;
    } finally {
      clearAuth();
      updateUser(null);
    }
    navigate('/', { replace: true, state: warning ? { logoutWarning: warning } : null });
  }

  return (
    <button type="button" className={className} onClick={logout}>Cerrar sesión</button>
  );
}
