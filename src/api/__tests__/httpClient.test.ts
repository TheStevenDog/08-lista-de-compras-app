import * as SecureStore from 'expo-secure-store';
import { ApiError, apiRequest, onSessionExpired } from '../httpClient';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, val: string) => {
      store.set(key, val);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __clearAll: () => store.clear(),
  };
});

describe('httpClient — expo-secure-store y refresh único en 401', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    (SecureStore as unknown as { __clearAll: () => void }).__clearAll();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  test('renueva el token UNA vez ante 401 y reintenta la petición original', async () => {
    await SecureStore.setItemAsync('lista_compras_id_token', 'old-token');
    await SecureStore.setItemAsync('lista_compras_refresh_token', 'refresh-1');

    const fetchMock = jest
      .fn()
      // 1) Petición inicial devuelve 401
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expirado' }),
      })
      // 2) Refresh devuelve nuevos tokens
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: 'new-token',
          refreshToken: 'refresh-2',
          expiraEnSeg: 3600,
        }),
      })
      // 3) Reintento devuelve 200
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ usuario: { id: 'u1', email: 'familia@test.com' } }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    const data = await apiRequest<{ usuario: { id: string; email: string } }>('/api/auth/yo');

    expect(data.usuario.email).toBe('familia@test.com');
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(await SecureStore.getItemAsync('lista_compras_id_token')).toBe('new-token');
    expect(await SecureStore.getItemAsync('lista_compras_refresh_token')).toBe('refresh-2');
  });

  test('si el refresh falla ante 401, limpia SecureStore y notifica cierre de sesión', async () => {
    await SecureStore.setItemAsync('lista_compras_id_token', 'expired-token');
    await SecureStore.setItemAsync('lista_compras_refresh_token', 'bad-refresh');

    const expiredListener = jest.fn();
    const unsubscribe = onSessionExpired(expiredListener);

    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'No autorizado' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'Refresh inválido' }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(apiRequest('/api/lista')).rejects.toBeInstanceOf(ApiError);
    expect(expiredListener).toHaveBeenCalledTimes(1);
    expect(await SecureStore.getItemAsync('lista_compras_id_token')).toBeNull();
    expect(await SecureStore.getItemAsync('lista_compras_refresh_token')).toBeNull();

    unsubscribe();
  });
});
