import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminUsersPage from './AdminUsersPage.jsx';
import { apiRequest } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({ apiRequest: vi.fn() }));

const users = [
  { id: 1, name: 'Ana Pérez', email: 'ana@example.com', telephone: '912345678', region: 'Metropolitana', commune: 'Santiago', role: 'customer', createdAt: '2025-01-10' },
  { id: 2, name: 'Luis Soto', email: 'luis@example.com', telephone: '987654321', region: 'Valparaíso', commune: 'Viña del Mar', role: 'customer', createdAt: '2025-02-20' },
  { id: 3, name: 'Camila Díaz', email: 'camila@example.com', telephone: '', region: '', commune: '', role: 'customer', createdAt: '2025-03-30' }
];

describe('AdminUsersPage', () => {
  beforeEach(() => {
    apiRequest.mockImplementation((path) => path === 'auth/me'
      ? Promise.resolve({ user: { id: 99, role: 'admin' } })
      : Promise.resolve(users));
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('renderiza todas las cuentas recibidas desde la API', async () => {
    render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);
    await screen.findByRole('heading', { name: 'Usuarios registrados' });

    const tableBody = document.querySelector('.admin-table tbody');
    expect(within(tableBody).getAllByRole('row')).toHaveLength(users.length);
    users.forEach(({ name, email }) => {
      expect(within(tableBody).getByText(name)).toBeTruthy();
      expect(within(tableBody).getByText(email)).toBeTruthy();
    });
  });

  it('crea usuarios con contraseña y rol seleccionados', async () => {
    const created = { id: 4, name: 'Sofía', email: 'sofia@example.com', role: 'seller', createdAt: '2026-01-01' };
    apiRequest.mockImplementation((path, options) => {
      if (path === 'auth/me') return Promise.resolve({ user: { id: 99, role: 'admin' } });
      if (path === 'users') return options?.method === 'POST' ? Promise.resolve(created) : Promise.resolve(users);
      return Promise.resolve({});
    });
    const user = userEvent.setup();
    render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);
    await screen.findByText('ana@example.com');
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Sofía');
    await user.type(screen.getByLabelText('Correo electrónico'), 'sofia@example.com');
    await user.type(screen.getByLabelText('Contraseña inicial'), 'clave-segura');
    await user.selectOptions(screen.getByLabelText('Tipo de usuario'), 'seller');
    await user.click(screen.getByRole('button', { name: 'Guardar usuario' }));

    expect(await screen.findByText('sofia@example.com')).toBeInTheDocument();
    const createCall = apiRequest.mock.calls.find(([path, options]) => path === 'users' && options?.method === 'POST');
    expect(JSON.parse(createCall[1].body)).toMatchObject({ name: 'Sofía', role: 'seller', password: 'clave-segura' });
  });

  it('edita el perfil y cambia el rol del usuario', async () => {
    const updated = { ...users[0], role: 'seller' };
    apiRequest.mockImplementation((path, options) => {
      if (path === 'auth/me') return Promise.resolve({ user: { id: 99, role: 'admin' } });
      if (path === 'users/1' && options?.method === 'PUT') return Promise.resolve(updated);
      return Promise.resolve(users);
    });
    const user = userEvent.setup();
    render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);
    const row = await screen.findByText('ana@example.com').then((email) => email.closest('tr'));
    await user.click(within(row).getByRole('button', { name: 'Editar' }));
    await user.selectOptions(screen.getByLabelText('Tipo de usuario'), 'seller');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await within(row).findByText('Vendedor')).toBeInTheDocument();
    const updateCall = apiRequest.mock.calls.find(([path, options]) => path === 'users/1' && options?.method === 'PUT');
    expect(JSON.parse(updateCall[1].body)).toMatchObject({ role: 'seller' });
  });

  it('pide confirmación inline antes de eliminar y retira el usuario', async () => {
    apiRequest.mockImplementation((path, options) => {
      if (path === 'auth/me') return Promise.resolve({ user: { id: 99, role: 'admin' } });
      if (path === 'users/1' && options?.method === 'DELETE') return Promise.resolve({});
      return Promise.resolve(users);
    });
    const user = userEvent.setup();
    render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);
    const row = await screen.findByText('ana@example.com').then((email) => email.closest('tr'));
    await user.click(within(row).getByRole('button', { name: 'Eliminar' }));
    await user.click(within(row).getByRole('button', { name: 'Sí' }));

    expect(apiRequest).toHaveBeenCalledWith('users/1', { method: 'DELETE' });
    expect(await screen.findByText('Se eliminó la cuenta de Ana Pérez.')).toBeInTheDocument();
    expect(screen.queryByText('ana@example.com')).not.toBeInTheDocument();
  });
});
