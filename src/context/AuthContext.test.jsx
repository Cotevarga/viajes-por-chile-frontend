import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './AuthContext.jsx';
import { GuestRoute } from '../components/RoleRoute.jsx';
import { restoreSession, subscribeAuth, updateStoredUser } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  getStoredUser: vi.fn(() => null),
  restoreSession: vi.fn(),
  subscribeAuth: vi.fn(() => vi.fn()),
  updateStoredUser: vi.fn()
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  localStorage.clear();
});

describe('AuthProvider', () => {
  it('espera a restaurar la sesión antes de redirigir una ruta de acceso', async () => {
    let finishRestore;
    const restoration = new Promise((resolve) => { finishRestore = resolve; });
    restoreSession.mockReturnValue(restoration);

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<GuestRoute><p>Inicio de sesión</p></GuestRoute>} />
            <Route path="/menu" element={<p>Tienda cliente</p>} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('status')).toHaveTextContent('Restaurando sesión');
    expect(screen.queryByText('Inicio de sesión')).not.toBeInTheDocument();

    await act(async () => {
      finishRestore({ role: 'customer' });
      await restoration;
    });

    expect(screen.getByText('Tienda cliente')).toBeInTheDocument();
  });
});
