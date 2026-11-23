import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { TripDetailPage } from './ShopPages.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useProducts } from '../context/ProductContext.jsx';
import { apiRequest } from '../lib/api.js';

vi.mock('../context/CartContext.jsx', () => ({ useCart: vi.fn() }));
vi.mock('../context/ProductContext.jsx', () => ({ useProducts: vi.fn() }));
vi.mock('../lib/api.js', () => ({ apiRequest: vi.fn().mockResolvedValue([]) }));

describe('TripDetailPage con descuento', () => {
  beforeEach(() => {
    apiRequest.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('muestra el precio rebajado y conserva el descuento al agregar al carrito', async () => {
    const addItem = vi.fn();
    const product = {
      id: 'PROD-02',
      slug: 'valparaiso',
      title: 'Santiago - Valparaíso',
      destination: 'Valparaíso',
      price: 10000,
      discount_percent: 15,
      type: 'Clásico',
      status: 'Activo',
      image: 'Valpo.webp',
      description: 'Ruta a Valparaíso',
      gallery: ['Valpo.webp'],
      schedules: [{ id: 'departure-1', date: '2099-04-20', time: '09:30', platform: '4', capacity: 20 }]
    };
    useProducts.mockReturnValue({ products: [product] });
    useCart.mockReturnValue({ addItem });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/viajes/valparaiso']}>
        <Routes><Route path="/viajes/:slug" element={<TripDetailPage />} /></Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('$8.500')).toBeInTheDocument();
    expect(screen.getByText(/15\s*%\s*de descuento/)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Reservar este viaje' }));
    await user.click(screen.getByRole('button', { name: 'Ver mapa' }));
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith('availability/seats?slug=valparaiso&scheduleId=departure-1'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Asiento 1' })).not.toBeDisabled());
    await user.selectOptions(screen.getByLabelText('Cantidad de pasajes'), '2');
    fireEvent.change(screen.getAllByLabelText('Nombre completo')[0], { target: { value: 'Ana Pérez' } });
    fireEvent.change(screen.getAllByLabelText('RUT')[0], { target: { value: '12345678-9' } });
    fireEvent.change(screen.getAllByLabelText('Nombre completo')[1], { target: { value: 'Luis Soto' } });
    fireEvent.change(screen.getAllByLabelText('RUT')[1], { target: { value: '98765432-1' } });
    await user.click(screen.getByRole('button', { name: 'Asiento 1' }));
    await user.click(screen.getByRole('button', { name: 'Asiento 3' }));
    expect(screen.getAllByLabelText('RUT').every((field) => field.checkValidity())).toBe(true);
    await user.click(screen.getByRole('button', { name: /Añadir al carrito/ }));

    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'valparaiso',
      price: 8500,
      originalPrice: 10000,
      discountPercent: 15,
      scheduleId: 'departure-1',
      scheduleDate: '2099-04-20',
      departureTime: '09:30',
      platform: '4',
      passengers: [
        { name: 'Ana Pérez', rut: '12345678-9', seatNumber: 1 },
        { name: 'Luis Soto', rut: '98765432-1', seatNumber: 3 }
      ]
    }), 2);
  });

  it('permite agendar una ruta sin salidas publicadas', async () => {
    const addItem = vi.fn();
    useProducts.mockReturnValue({ products: [{
      slug: 'valparaiso',
      title: 'Santiago - Valparaíso',
      destination: 'Valparaíso',
      price: 10000,
      status: 'Activo',
      schedules: []
    }] });
    useCart.mockReturnValue({ addItem });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/viajes/valparaiso']}>
        <Routes><Route path="/viajes/:slug" element={<TripDetailPage />} /></Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('checkbox', { name: 'Reservar este viaje' }));
    expect(screen.getByLabelText('Fecha de viaje')).toBeInTheDocument();
    expect(screen.getByLabelText('Hora de salida')).toBeInTheDocument();
    expect(screen.getByText(/no hay cupos preconfigurados/)).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await user.type(screen.getByLabelText('RUT'), '12345678-9');
    await user.click(screen.getByRole('button', { name: 'Ver mapa' }));
    await user.click(screen.getByRole('button', { name: 'Asiento 1' }));
    await user.click(screen.getByRole('button', { name: /Añadir al carrito/ }));

    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
      slug: 'valparaiso',
      scheduleId: expect.stringMatching(/^custom:/),
      scheduleDate: expect.any(String),
      departureTime: '09:00',
      platform: 'Por asignar',
      customSchedule: true,
      passengers: [{ name: 'Ana Pérez', rut: '12345678-9', seatNumber: 1 }]
    }), 1);
  });

  it('muestra los dos pisos, bloquea asientos ocupados y cobra el suplemento Salón Cama', async () => {
    apiRequest.mockResolvedValue([72]);
    const addItem = vi.fn();
    useProducts.mockReturnValue({ products: [{
      slug: 'valdivia',
      title: 'Santiago - Valdivia',
      destination: 'Valdivia',
      distance_km: 848,
      price: 22000,
      type: 'Salón Cama',
      status: 'Activo',
      image: 'Valdivia.jpeg',
      schedules: [{ id: 'salida-valdivia', date: '2099-04-20', time: '09:30', platform: '2', capacity: 64 }]
    }] });
    useCart.mockReturnValue({ addItem });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/viajes/valdivia']}>
        <Routes><Route path="/viajes/:slug" element={<TripDetailPage />} /></Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('checkbox', { name: 'Reservar este viaje' }));
    await user.click(screen.getByRole('button', { name: 'Ver mapa' }));
    await user.click(screen.getByRole('tab', { name: /Piso inferior/ }));
    expect(await screen.findByRole('button', { name: 'Asiento 72, ocupado' })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Asiento 71' })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'Asiento 71' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await user.type(screen.getByLabelText('RUT'), '12345678-9');
    await user.click(screen.getByRole('button', { name: /Añadir al carrito/ }));

    expect(addItem).toHaveBeenCalledWith(expect.objectContaining({
      price: 27500,
      seatClass: 'salon',
      passengers: [{ name: 'Ana Pérez', rut: '12345678-9', seatNumber: 71 }]
    }), 1);
    await user.click(screen.getByRole('tab', { name: /Piso superior/ }));
    expect(screen.getByRole('button', { name: 'Asiento 52' })).toBeInTheDocument();
  });

  it('habilita los dos pisos para una ruta de 400 km aunque el tipo base sea Premium', async () => {
    useProducts.mockReturnValue({ products: [{
      slug: 'laserena',
      title: 'Santiago - La Serena',
      destination: 'La Serena',
      distance_km: 400,
      price: 18000,
      type: 'Premium',
      status: 'Activo',
      image: 'Serena.webp',
      schedules: [{ id: 'departure-la-serena', date: '2099-04-20', time: '09:30', platform: '2', capacity: 64 }]
    }] });
    useCart.mockReturnValue({ addItem: vi.fn() });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/viajes/laserena']}>
        <Routes><Route path="/viajes/:slug" element={<TripDetailPage />} /></Routes>
      </MemoryRouter>
    );

    await user.click(screen.getByRole('checkbox', { name: 'Reservar este viaje' }));
    await user.click(screen.getByRole('button', { name: 'Ver mapa' }));

    expect(screen.getByRole('tab', { name: /Piso inferior/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Piso superior/ })).toBeInTheDocument();
    expect(screen.getByText(/Bus doble piso/)).toBeInTheDocument();
  });

  it('reserva las dos piernas de ida y vuelta usando las salidas publicadas', async () => {
    const addItem = vi.fn();
    useProducts.mockReturnValue({ products: [
      {
        slug: 'valparaiso',
        title: 'Santiago - Valparaíso',
        destination: 'Valparaíso',
        distance_km: 120,
        price: 10000,
        type: 'Clásico',
        status: 'Activo',
        image: 'Valpo.webp',
        schedules: [{ id: 'ida', date: '2099-04-20', time: '09:00', platform: '1', capacity: 40 }]
      },
      {
        slug: 'santiago-valparaiso',
        title: 'Valparaíso - Santiago',
        destination: 'Santiago',
        distance_km: 120,
        price: 10000,
        type: 'Clásico',
        status: 'Activo',
        image: 'Santiago.webp',
        schedules: [{ id: 'vuelta', date: '2099-04-25', time: '17:00', platform: '2', capacity: 40 }]
      }
    ] });
    useCart.mockReturnValue({ addItem });
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/viajes/valparaiso',
        state: {
          departureDate: '2099-04-20',
          passengerCount: 1,
          roundTrip: { leg: 'outbound', returnProductSlug: 'santiago-valparaiso', returnDate: '2099-04-25' }
        }
      }]}>
        <Routes><Route path="/viajes/:slug" element={<TripDetailPage />} /></Routes>
      </MemoryRouter>
    );

    await screen.findByRole('button', { name: 'Asiento 1' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Asiento 1' })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'Asiento 1' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Pérez');
    await user.type(screen.getByLabelText('RUT'), '12345678-9');
    await user.click(screen.getByRole('button', { name: 'Añadir al carrito' }));

    expect(await screen.findByRole('heading', { name: 'Valparaíso - Santiago' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
    expect(screen.getByLabelText('Cantidad de pasajes')).toBeDisabled();
    await screen.findByRole('button', { name: 'Asiento 1' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Asiento 1' })).not.toBeDisabled());
    await user.click(screen.getByRole('button', { name: 'Asiento 1' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Añadir regreso al carrito' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Añadir regreso al carrito' }));

    await waitFor(() => expect(addItem).toHaveBeenCalledTimes(2));
    expect(addItem).toHaveBeenLastCalledWith(expect.objectContaining({
      slug: 'santiago-valparaiso',
      scheduleId: 'vuelta',
      scheduleDate: '2099-04-25',
      passengers: [{ name: 'Ana Pérez', rut: '12345678-9', seatNumber: 1 }]
    }), 1);
  });
});
