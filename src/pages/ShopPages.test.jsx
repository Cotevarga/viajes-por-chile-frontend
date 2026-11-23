import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { MenuPage } from './ShopPages.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useProducts } from '../context/ProductContext.jsx';

vi.mock('../context/CartContext.jsx', () => ({ useCart: vi.fn() }));
vi.mock('../context/ProductContext.jsx', () => ({ useProducts: vi.fn() }));

const firstProducts = [
  { slug: 'alfa', title: 'Santiago - Alfa', destination: 'Alfa', price: 10000, type: 'Clásico', image: 'alfa.jpg' },
  { slug: 'beta', title: 'Santiago - Beta', destination: 'Beta', price: 15000, type: 'Premium', image: 'beta.jpg' }
];

const updatedProducts = [
  { slug: 'gamma', title: 'Santiago - Gamma', destination: 'Gamma', price: 20000, type: 'Semi Cama', image: 'gamma.jpg' }
];

function renderMenuPage() {
  return <MemoryRouter><MenuPage /></MemoryRouter>;
}

describe('MenuPage', () => {
  beforeEach(() => {
    useProducts.mockReturnValue({ products: firstProducts });
    useCart.mockReturnValue({ addItem: vi.fn() });
  });

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('renderiza todos los productos y actualiza la lista al rerenderizar', () => {
    const view = render(renderMenuPage());

    expect(document.querySelectorAll('.route-card')).toHaveLength(firstProducts.length);
    firstProducts.forEach(({ destination }) => {
      expect(screen.getByRole('heading', { name: destination })).toBeTruthy();
    });

    useProducts.mockReturnValue({ products: updatedProducts });
    view.rerender(renderMenuPage());

    expect(document.querySelectorAll('.route-card')).toHaveLength(updatedProducts.length);
    updatedProducts.forEach(({ destination }) => {
      expect(screen.getByRole('heading', { name: destination })).toBeTruthy();
    });
    firstProducts.forEach(({ destination }) => {
      expect(screen.queryByRole('heading', { name: destination })).toBeNull();
    });
  });

  it('filtra rutas por tipo de servicio y permite volver a mostrar todos', async () => {
    const user = userEvent.setup();
    render(renderMenuPage());

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo de servicio' }), 'Premium');

    expect(screen.getByRole('heading', { name: 'Beta' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Alfa' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filtrar por tipo de servicio' }), '');

    expect(screen.getByRole('heading', { name: 'Alfa' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Beta' })).toBeInTheDocument();
  });

  it('permite buscar ida y vuelta con origen, destino, fechas y pasajeros', async () => {
    const products = [
      {
        slug: 'valparaiso',
        title: 'Santiago - Valparaíso',
        destination: 'Valparaíso',
        price: 10000,
        type: 'Clásico',
        status: 'Activo',
        image: 'valpo.jpg',
        schedules: [{ id: 'ida', date: '2026-12-01', time: '09:00', platform: '1', capacity: 40 }]
      },
      {
        slug: 'santiago-valparaiso',
        title: 'Valparaíso - Santiago',
        destination: 'Santiago',
        price: 10000,
        type: 'Clásico',
        status: 'Activo',
        image: 'santiago.jpg',
        schedules: [{ id: 'vuelta', date: '2026-12-05', time: '17:00', platform: '2', capacity: 40 }]
      }
    ];
    useProducts.mockReturnValue({ products });
    const user = userEvent.setup();
    render(renderMenuPage());

    await user.click(screen.getByRole('radio', { name: 'Ida y vuelta' }));
    await user.selectOptions(screen.getByLabelText('Origen'), 'santiago');
    await user.selectOptions(screen.getByLabelText('Destino'), 'valparaiso');
    await user.type(screen.getByLabelText('Salida'), '2026-12-01');
    await user.type(screen.getByLabelText('Regreso'), '2026-12-05');
    await user.selectOptions(screen.getByLabelText('Pasajeros'), '2');
    await user.click(screen.getByRole('button', { name: /Buscar/ }));

    expect(await screen.findByText(/Regreso 2026-12-05/)).toBeInTheDocument();
    expect(screen.getByText(/2 pasajero/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Elegir salida' })).toHaveAttribute('href', '/viajes/valparaiso');
  });

  it('muestra la distancia y clasifica como doble piso toda ruta de al menos 400 km', () => {
    useProducts.mockReturnValue({ products: [
      { slug: 'laserena', title: 'Santiago - La Serena', destination: 'La Serena', distance_km: 400, price: 18000, type: 'Premium', image: 'serena.jpg' }
    ] });

    render(renderMenuPage());

    expect(screen.getByText(/Bus doble piso/)).toBeInTheDocument();
  });

  it('separa las rutas por zona y ofrece enlaces a cada listado', () => {
    useProducts.mockReturnValue({ products: [
      { slug: 'arica', title: 'Santiago - Arica', destination: 'Arica', price: 35000, type: 'Premium', image: 'arica.jpg' },
      { slug: 'valparaiso', title: 'Santiago - Valparaíso', destination: 'Valparaíso', price: 10000, type: 'Clásico', image: 'valpo.jpg' },
      { slug: 'pucon', title: 'Santiago - Pucón', destination: 'Pucón', price: 28000, type: 'Salón Cama', image: 'pucon.jpg' }
    ] });

    render(renderMenuPage());

    expect(screen.getByRole('link', { name: 'Viajes nortinos' })).toHaveAttribute('href', '#viajes-nortinos');
    expect(screen.getByRole('link', { name: 'Zona centro' })).toHaveAttribute('href', '#zona-centro');
    expect(screen.getByRole('link', { name: 'Zona austral' })).toHaveAttribute('href', '#zona-austral');
    expect(document.querySelector('#viajes-nortinos')).toContainElement(screen.getByRole('heading', { name: 'Arica' }));
    expect(document.querySelector('#zona-centro')).toContainElement(screen.getByRole('heading', { name: 'Valparaíso' }));
    expect(document.querySelector('#zona-austral')).toContainElement(screen.getByRole('heading', { name: 'Pucón' }));
  });
});