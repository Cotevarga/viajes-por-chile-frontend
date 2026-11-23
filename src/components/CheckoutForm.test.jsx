import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CheckoutForm from './CheckoutForm.jsx';
import { apiRequest } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({ apiRequest: vi.fn() }));

describe('CheckoutForm', () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('envía el horario, pasajero y precio acordado para emitir boletos', async () => {
    const onComplete = vi.fn();
    apiRequest.mockResolvedValue({ sale_code: 'sale-code' });
    const user = userEvent.setup();
    render(<CheckoutForm
      items={[{
        cartKey: 'valparaiso:departure-1',
        slug: 'valparaiso',
        title: 'Santiago - Valparaíso',
        price: 8500,
        originalPrice: 10000,
        discountPercent: 15,
        scheduleId: 'departure-1',
        scheduleDate: '2099-04-20',
        departureTime: '09:30',
        platform: '4',
        quantity: 1,
        passengers: [{ name: 'Ana Pérez', rut: '12345678-9' }]
      }]}
      onCancel={vi.fn()}
      onComplete={onComplete}
    />);

    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
    expect(screen.getByLabelText('RUT')).toHaveValue('12345678-9');
    await user.click(screen.getByRole('button', { name: 'Confirmar compra y emitir boletos' }));

    expect(apiRequest).toHaveBeenCalledWith('purchases', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        items: [{
          slug: 'valparaiso',
          scheduleId: 'departure-1',
          seatClass: '',
          customSchedule: false,
          scheduleDate: '2099-04-20',
          departureTime: '09:30',
          passengers: [{ name: 'Ana Pérez', rut: '12345678-9' }]
        }]
      })
    }));
    expect(onComplete).toHaveBeenCalledWith({ sale_code: 'sale-code' });
  });

  it('envía la fecha y hora elegidas para una ruta sin salida publicada', async () => {
    apiRequest.mockResolvedValue({ sale_code: 'sale-code' });
    const user = userEvent.setup();
    render(<CheckoutForm
      items={[{
        cartKey: 'valparaiso:custom:2099-04-20:09:00',
        slug: 'valparaiso',
        title: 'Santiago - Valparaíso',
        price: 10000,
        scheduleId: 'custom:2099-04-20:09:00',
        customSchedule: true,
        scheduleDate: '2099-04-20',
        departureTime: '09:00',
        platform: 'Por asignar',
        quantity: 1,
        passengers: [{ name: 'Ana Pérez', rut: '12345678-9' }]
      }]}
      onCancel={vi.fn()}
      onComplete={vi.fn()}
    />);

    await user.click(screen.getByRole('button', { name: 'Confirmar compra y emitir boletos' }));

    expect(apiRequest).toHaveBeenCalledWith('purchases', expect.objectContaining({
      body: JSON.stringify({
        items: [{
          slug: 'valparaiso',
          scheduleId: 'custom:2099-04-20:09:00',
          seatClass: '',
          customSchedule: true,
          scheduleDate: '2099-04-20',
          departureTime: '09:00',
          passengers: [{ name: 'Ana Pérez', rut: '12345678-9' }]
        }]
      })
    }));
  });

  it('presenta la franquicia fija de equipaje antes de confirmar', () => {
    render(<CheckoutForm items={[{
      cartKey: 'ida',
      slug: 'valparaiso',
      title: 'Santiago - Valparaíso',
      price: 10000,
      scheduleId: 'departure-1',
      scheduleDate: '2099-04-20',
      departureTime: '09:30',
      platform: '4',
      quantity: 1,
      passengers: [{ name: 'Ana Pérez', rut: '12345678-9' }]
    }]} onCancel={vi.fn()} onComplete={vi.fn()} />);

    expect(screen.getByText(/1 maleta facturada de hasta 15 kg y 1 bolso de mano de hasta 5 kg/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Maletas facturadas')).not.toBeInTheDocument();
  });

  it('envía ida y regreso publicados en una sola compra', async () => {
    const onComplete = vi.fn();
    apiRequest.mockResolvedValue({ sale_code: 'sale-code' });
    const user = userEvent.setup();
    render(<CheckoutForm items={[
      {
        cartKey: 'ida',
        slug: 'valparaiso',
        title: 'Santiago - Valparaíso',
        price: 10000,
        scheduleId: 'departure-1',
        scheduleDate: '2099-04-20',
        departureTime: '09:30',
        platform: '4',
        quantity: 1,
        passengers: [{ name: 'Ana Pérez', rut: '12345678-9', seatNumber: 1 }]
      },
      {
        cartKey: 'vuelta',
        slug: 'santiago-valparaiso',
        title: 'Valparaíso - Santiago',
        price: 10000,
        scheduleId: 'return-1',
        scheduleDate: '2099-04-25',
        departureTime: '17:00',
        platform: '2',
        quantity: 1,
        passengers: [{ name: 'Ana Pérez', rut: '12345678-9', seatNumber: 2 }]
      }
    ]} onCancel={vi.fn()} onComplete={onComplete} />);

    await user.click(screen.getByRole('button', { name: 'Confirmar compra y emitir boletos' }));

    const request = apiRequest.mock.calls[0][1];
    expect(JSON.parse(request.body).items).toHaveLength(2);
    expect(JSON.parse(request.body).items.map((item) => item.scheduleId)).toEqual(['departure-1', 'return-1']);
    expect(onComplete).toHaveBeenCalledWith({ sale_code: 'sale-code' });
  });
});
