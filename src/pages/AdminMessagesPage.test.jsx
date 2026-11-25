import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminMessagesPage from './AdminMessagesPage.jsx';
import { apiRequest } from '../lib/api.js';
import { exportMessagesToExcel } from './reportExcel.js';

vi.mock('../lib/api.js', () => ({ apiRequest: vi.fn() }));
vi.mock('./reportExcel.js', () => ({ exportMessagesToExcel: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('Mensajes de contacto', () => {
  it('exporta únicamente los mensajes que cumplen búsqueda y rango inclusivo', async () => {
    const messages = [
      { id: 1, name: 'Ana', email: 'ana@example.test', type: 'reclamo', message: 'Demora de bus',
        status: 'no_leido', admin_notes: 'Revisar', created_at: '2026-11-18T10:00:00' },
      { id: 2, name: 'Luis', email: 'luis@example.test', type: 'mensaje', message: 'Consulta',
        status: 'leido', admin_notes: '', created_at: '2026-11-19T10:00:00' }
    ];
    apiRequest.mockImplementation(async (path) => path === 'auth/me' ? { user: { role: 'admin' } } : messages);
    const user = userEvent.setup();
    render(<MemoryRouter><AdminMessagesPage /></MemoryRouter>);
    await screen.findByText('Demora de bus');
    await user.type(screen.getByLabelText('Desde'), '2026-11-18');
    await user.type(screen.getByLabelText('Hasta'), '2026-11-18');
    await user.type(screen.getByLabelText('Buscar'), 'demora');
    expect(screen.queryByText('Consulta')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Exportar Excel' }));
    expect(exportMessagesToExcel).toHaveBeenCalledWith([messages[0]]);
  });
});
