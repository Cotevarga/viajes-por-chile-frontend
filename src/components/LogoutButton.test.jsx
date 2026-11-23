import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LogoutButton from './LogoutButton.jsx';
import { apiRequest, clearAuth, updateStoredUser } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  apiRequest: vi.fn(),
  clearAuth: vi.fn(),
  getStoredUser: () => ({ role: 'customer' }),
  updateStoredUser: vi.fn()
}));

function LocationProbe() {
  const location = useLocation();
  return <output aria-label="ubicación">{location.pathname}{location.state?.logoutWarning || ''}</output>;
}

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('LogoutButton', () => {
  it('revoca la sesión, limpia el estado local y vuelve al login', async () => {
    apiRequest.mockResolvedValue({ ok: true });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cuenta']}>
        <LocationProbe />
        <Routes>
          <Route path="/cuenta" element={<LogoutButton />} />
          <Route path="/" element={<p>Sesión cerrada</p>} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByText('Sesión cerrada')).toBeInTheDocument();
    expect(apiRequest).toHaveBeenCalledWith('auth/logout', { method: 'POST' });
    expect(clearAuth).toHaveBeenCalled();
    expect(updateStoredUser).toHaveBeenCalledWith(null);
  });

  it('cierra la sesión local incluso si el servidor no responde y conserva el aviso', async () => {
    apiRequest.mockRejectedValue(new Error('API no disponible'));
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/cuenta']}>
        <LocationProbe />
        <Routes><Route path="/cuenta" element={<LogoutButton />} /></Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    expect(await screen.findByLabelText('ubicación')).toHaveTextContent('La sesión local se cerró');
    expect(clearAuth).toHaveBeenCalled();
    expect(updateStoredUser).toHaveBeenCalledWith(null);
  });
});
