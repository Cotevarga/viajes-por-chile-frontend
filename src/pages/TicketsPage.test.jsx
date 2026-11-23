import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TicketsPage, { buildTicketHtml, buildTicketShareText, getTripTracking } from './TicketsPage.jsx';
import { apiRequest } from '../lib/api.js';
import userEvent from '@testing-library/user-event';

vi.mock('../lib/api.js', () => ({ apiRequest: vi.fn() }));

describe('TicketsPage', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('recupera y muestra el boleto emitido con descuento y datos de embarque', async () => {
    apiRequest.mockResolvedValue({
      sale_code: 'ab'.repeat(16),
      total_amount: 8500,
      tickets: [{
        ticket_code: 'cd'.repeat(16),
        trip_title: 'Santiago - Valparaíso',
        destination: 'Valparaíso',
        distance_km: 120,
        schedule_date: '2099-04-20',
        departure_time: '09:30',
        platform: '4',
        seat_number: 1,
        passenger_name: 'Ana Pérez',
        passenger_rut: '123456789',
        original_price: 10000,
        discount_percent: 15,
        price_paid: 8500
      }]
    });

    render(
      <MemoryRouter initialEntries={['/boletos/abababababababababababababababab']}>
        <Routes><Route path="/boletos/:saleCode" element={<TicketsPage />} /></Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Tus boletos están listos' })).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('Santiago', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Valparaíso', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('2099-04-20')).toBeInTheDocument();
    expect(screen.getByText('09:30')).toBeInTheDocument();
    expect(screen.getByText('15% descuento · Normal $10.000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Imprimir/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Descargar comprobante HTML/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Código de barras/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Enviar por WhatsApp/ })).toHaveAttribute('href', expect.stringContaining('https://wa.me/?text='));
    expect(screen.getByRole('link', { name: /Enviar por correo/ })).toHaveAttribute('href', expect.stringContaining('mailto:?subject='));
  });

  it('calcula el avance y permite simular el horario del viaje', async () => {
    apiRequest.mockResolvedValue({
      sale_code: 'ab'.repeat(16),
      total_amount: 22000,
      tickets: [{
        ticket_code: 'cd'.repeat(16),
        trip_title: 'Santiago - Concepción',
        destination: 'Concepción',
        distance_km: 500,
        schedule_date: '2099-04-20',
        departure_time: '09:30',
        platform: '4',
        seat_number: 71,
        passenger_name: 'Ana Pérez',
        passenger_rut: '123456789',
        original_price: 22000,
        discount_percent: 0,
        price_paid: 22000,
        status: 'activo'
      }]
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/boletos/abababababababababababababababab']}>
        <Routes><Route path="/boletos/:saleCode" element={<TicketsPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: 'Tus boletos están listos' });
    expect(screen.getByRole('progressbar', { name: 'Avance estimado del viaje' })).toHaveAttribute('aria-valuenow', '0');
    await user.click(screen.getByRole('button', { name: 'Simular avance de horario' }));
    expect(screen.getByRole('progressbar', { name: 'Avance estimado del viaje' })).toHaveAttribute('aria-valuenow', '8');
    expect(screen.getByText(/ETA/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Avanzar 30 min' }));
    expect(screen.getByRole('progressbar', { name: 'Avance estimado del viaje' })).toHaveAttribute('aria-valuenow', '15');
    expect(getTripTracking({
      trip_title: 'Santiago - Concepción',
      destination: 'Concepción',
      distance_km: 500,
      schedule_date: '2099-04-20',
      departure_time: '09:30'
    }, new Date('2099-04-20T12:50:00')).location).toBe('Cerca de Talca (aprox.)');
  });

  it('genera un archivo HTML imprimible que escapa el contenido recibido', () => {
    const html = buildTicketHtml({
      tickets: [{
        trip_title: '<script>alert(1)</script>',
        destination: 'Valparaíso & alrededores',
        passenger_name: 'Ana <Pérez>',
        passenger_rut: '12345678-9',
        schedule_date: '2099-04-20',
        departure_time: '09:30',
        platform: '4',
        seat_number: 1,
        ticket_code: 'ticket-1',
        price_paid: 8500,
        original_price: 10000,
        discount_percent: 15
      }]
    });

    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('Valparaíso &amp; alrededores');
    expect(html).toContain('Ana &lt;Pérez&gt;');
    expect(html).toContain('15% de descuento aplicado');
    expect(html).toContain('ticket-barcode');
    expect(html).toContain('Origen: <strong>Santiago</strong>');
  });

  it('prepara el resumen para compartir con los datos de embarque y tarifa', () => {
    const text = buildTicketShareText({
      sale_code: 'reserva-123',
      total_amount: 8500,
      tickets: [{
        ticket_code: 'boleto-456',
        trip_title: 'Santiago - Valparaíso',
        destination: 'Valparaíso',
        schedule_date: '2099-04-20',
        departure_time: '09:30',
        platform: '4',
        seat_number: 12,
        passenger_name: 'Ana Pérez',
        price_paid: 8500
      }]
    });

    expect(text).toContain('Código de compra: reserva-123');
    expect(text).toContain('Ruta: Santiago → Valparaíso');
    expect(text).toContain('Andén: 4 · Asiento: 12');
    expect(text).toContain('09:30');
  });

  it('muestra los errores al no encontrar un boleto', async () => {
    apiRequest.mockRejectedValue(new Error('Compra no encontrada.'));

    render(
      <MemoryRouter initialEntries={['/boletos/no-existe']}>
        <Routes><Route path="/boletos/:saleCode" element={<TicketsPage />} /></Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Compra no encontrada.');
    expect(screen.getByRole('link', { name: 'Volver a rutas' })).toHaveAttribute('href', '/menu');
  });
});
