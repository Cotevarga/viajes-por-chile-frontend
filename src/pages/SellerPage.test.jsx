import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SellerPage from './SellerPage.jsx';
import { apiRequest } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({ apiRequest: vi.fn(), clearAuth: vi.fn(), getStoredUser: vi.fn() }));
vi.mock('../components/LogoutButton.jsx', () => ({ default: () => <button>Cerrar sesión</button> }));

afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Panel de vendedor', () => {
  it('emite una venta simulada con el asiento disponible y los datos del pasajero', async () => {
    apiRequest.mockImplementation(async (path) => {
      if (path === 'products') return [{ id: 'r1', slug: 'talca', title: 'Santiago - Talca', price: 10000,
        type: 'Semi Cama', status: 'Activo', distance_km: 200, discount_percent: 10,
        schedules: [{ id: 's1', date: '2099-12-01', time: '10:00', platform: '1', capacity: 44 }] }];
      if (path.startsWith('availability/seats')) return [2];
      if (path === 'purchases') return { sale_code: 'abc', tickets: [] };
      throw new Error(`Solicitud inesperada: ${path}`);
    });
    const user = userEvent.setup();
    render(<MemoryRouter><SellerPage /></MemoryRouter>);
    await screen.findByRole('option', { name: 'Santiago - Talca' });
    await user.selectOptions(screen.getByLabelText('Ruta'), 'talca');
    await user.selectOptions(screen.getByLabelText('Fecha de viaje'), '2099-12-01');
    await user.selectOptions(screen.getByLabelText('Hora de salida'), 's1');
    await screen.findByRole('option', { name: '2 · ocupado' });
    expect(screen.getByRole('option', { name: '2 · ocupado' })).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Asiento disponible'), '1');
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await user.type(screen.getByLabelText('RUT'), '12345678-9');
    await user.type(screen.getByLabelText('Teléfono'), '123456789');
    expect(screen.getByText(/Precio:.*9.000/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Emitir y cobrar boleto' }));
    expect(await screen.findByText('Comprobante emitido')).toBeInTheDocument();
    const request = apiRequest.mock.calls.find(([path]) => path === 'purchases');
    expect(JSON.parse(request[1].body).items[0].passengers[0]).toMatchObject({ name: 'Ana Pérez', seatNumber: 1 });
  });
});
