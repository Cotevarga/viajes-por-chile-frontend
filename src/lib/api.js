const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api/v1').replace(/\/+$/, '');
const USER_KEY = 'viajes.user';
const TOKEN_KEY = 'viajes.jwt';
let accessToken = globalThis.localStorage?.getItem(TOKEN_KEY) || null;
let refreshPromise = null;
let restorePromise = null;
const authListeners = new Set();

const PUBLIC_AUTH = ['auth/login', 'auth/register', 'auth/google', 'auth/refresh', 'auth/forgot-password', 'auth/reset-password'];

function notifyAuthListeners() {
  const user = getStoredUser();
  authListeners.forEach((listener) => listener(user));
}

function isAuthenticationRequest(path) {
  const endpoint = path.split('?')[0].replace(/^\/+/, '');
  return PUBLIC_AUTH.includes(endpoint);
}

function shouldRefresh(path) {
  const endpoint = path.split('?')[0].replace(/^\/+/, '');
  return !PUBLIC_AUTH.includes(endpoint);
}

function saveAuth(result) {
  if (result.token) {
    accessToken = result.token;
    globalThis.localStorage?.setItem(TOKEN_KEY, result.token);
  }
  if (result.user) globalThis.localStorage?.setItem(USER_KEY, JSON.stringify(result.user));
  if (result.user) notifyAuthListeners();
}

async function readJson(response) {
  return response.json().catch(() => ({}));
}

async function sendRequest(path, options) {
  const method = (options.method || 'GET').toUpperCase();
  const endpoint = path.replace(/^\/+/, '');
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers
  };
  if (accessToken && !isAuthenticationRequest(endpoint)) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  try {
    return await fetch(`${API_BASE_URL}/${endpoint}`, {
      ...options,
      method,
      headers,
      credentials: 'include'
    });
  } catch {
    throw new Error('No se pudo conectar con Spring Boot. Inicia la API y verifica VITE_API_BASE_URL.');
  }
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await sendRequest('auth/refresh', { method: 'POST' });
      const result = await readJson(response);
      if (!response.ok || !result.token || !result.user) {
        clearAuth();
        throw new Error(result.error || 'No se pudo renovar la sesión. Inicia sesión nuevamente.');
      }
      saveAuth(result);
      return result.user;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export async function restoreSession() {
  const user = getStoredUser();
  if (accessToken && user) return user;
  if (!accessToken && !user) return null;

  if (!restorePromise) {
    restorePromise = (async () => {
      const response = await sendRequest('auth/refresh', { method: 'POST' });
      const result = await readJson(response);
      if (response.status === 401) {
        clearAuth();
        return null;
      }
      if (!response.ok || !result.token || !result.user) {
        throw new Error(result.error || 'No se pudo restaurar la sesión.');
      }
      saveAuth(result);
      return result.user;
    })().finally(() => {
      restorePromise = null;
    });
  }
  return restorePromise;
}

export function subscribeAuth(listener) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export function updateStoredUser(user) {
  if (user) globalThis.localStorage?.setItem(USER_KEY, JSON.stringify(user));
  else globalThis.localStorage?.removeItem(USER_KEY);
  notifyAuthListeners();
}

export async function apiRequest(path, options = {}) {
  const endpoint = path.replace(/^\/+/, '');
  let response = await sendRequest(endpoint, options);
  if (response.status === 401 && shouldRefresh(endpoint)) {
    try {
      await refreshAccessToken();
    } catch (refreshError) {
      clearAuth();
      throw refreshError;
    }
    response = await sendRequest(endpoint, options);
  }

  const result = await readJson(response);
  if (!response.ok) {
    if (response.status === 401) clearAuth();
    throw new Error(result.error || `La API respondió con estado ${response.status}.`);
  }
  saveAuth(result);
  if (endpoint === 'auth/logout') clearAuth();
  return result;
}

export function getStoredUser() {
  try {
    const user = globalThis.localStorage?.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  accessToken = null;
  globalThis.localStorage?.removeItem(TOKEN_KEY);
  globalThis.localStorage?.removeItem(USER_KEY);
  notifyAuthListeners();
}