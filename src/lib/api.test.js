import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiRequest, clearAuth, restoreSession } from './api.js';

describe('apiRequest', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
    clearAuth();
    localStorage.clear();
  });

  it('envía JSON y opciones del solicitante a la API de Spring Boot', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ saved: true })
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('products', {
      method: 'POST',
      body: JSON.stringify({ title: 'Ruta' }),
      headers: { 'X-Request-Id': 'test' }
    })).resolves.toEqual({ saved: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/products', {
      method: 'POST',
      body: JSON.stringify({ title: 'Ruta' }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Request-Id': 'test'
      },
      credentials: 'include'
    });
  });

  it('convierte errores HTTP y respuestas sin JSON en errores legibles', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Credenciales incorrectas.' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.reject(new Error('JSON inválido')) }));

    await expect(apiRequest('auth/login', { method: 'POST' })).rejects.toThrow('Credenciales incorrectas.');
    await expect(apiRequest('status')).resolves.toEqual({});
  });

  it('informa cuando no se puede conectar con la API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(apiRequest('products')).rejects.toThrow('No se pudo conectar con Spring Boot.');
  });

  it('persiste el JWT y el usuario para restaurar la sesión tras recargar', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ token: 'jwt-de-prueba', user: { role: 'admin' } })
      })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: { role: 'admin' } }) });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@example.com' }) });
    await apiRequest('auth/me');

    expect(localStorage.getItem('viajes.jwt')).toBe('jwt-de-prueba');
    expect(JSON.parse(localStorage.getItem('viajes.user'))).toEqual({ role: 'admin' });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/auth/me', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer jwt-de-prueba' },
      credentials: 'include'
    });
  });

  it('renueva el access token al recibir 401 y reintenta la solicitud', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'jwt-inicial', user: { role: 'customer' } }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Token expirado.' }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'jwt-renovado', user: { role: 'customer' } }) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ user: { role: 'customer' } }) });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('auth/login', { method: 'POST' });
    await expect(apiRequest('auth/me')).resolves.toEqual({ user: { role: 'customer' } });

    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });
    expect(fetchMock).toHaveBeenNthCalledWith(4, '/api/v1/auth/me', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer jwt-renovado' },
      credentials: 'include'
    });
    expect(localStorage.getItem('viajes.jwt')).toBe('jwt-renovado');
  });

  it('elimina la sesión local si el refresh token expiró o fue revocado', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ token: 'jwt-inicial', user: { role: 'customer' } }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Token expirado.' }) })
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ error: 'Refresh token inválido o expirado.' }) });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('auth/login', { method: 'POST' });
    await expect(apiRequest('auth/me')).rejects.toThrow('Refresh token inválido o expirado.');
    expect(localStorage.getItem('viajes.user')).toBeNull();
  });

  it('adjunta el access token en memoria a solicitudes públicas', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([])
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ token: 'jwt-activo', user: { role: 'customer' } })
    });
    vi.stubGlobal('fetch', fetchMock);

    await apiRequest('auth/login', { method: 'POST' });
    await apiRequest('products');

    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/products', {
      method: 'GET',
      headers: { Accept: 'application/json', Authorization: 'Bearer jwt-activo' },
      credentials: 'include'
    });
  });

  it('restaura el JWT desde la cookie de refresh cuando falta el token de acceso', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ token: 'jwt-restaurado', user: { role: 'customer' } })
    });
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('viajes.user', JSON.stringify({ role: 'customer' }));

    await expect(restoreSession()).resolves.toEqual({ role: 'customer' });
    expect(localStorage.getItem('viajes.jwt')).toBe('jwt-restaurado');
    expect(JSON.parse(localStorage.getItem('viajes.user'))).toEqual({ role: 'customer' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auth/refresh', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      credentials: 'include'
    });
  });
});
