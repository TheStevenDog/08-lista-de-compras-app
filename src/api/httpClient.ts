import {
  clearSessionTokens,
  getAccessToken,
  getRefreshToken,
  saveSessionTokens,
} from './tokenStore';

const DEFAULT_API_URL = 'https://08-lista-de-compras-apii.vercel.app';

export interface ApiErrorDetail {
  campo: string;
  mensaje: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly detalles?: ApiErrorDetail[];

  constructor(status: number, message: string, detalles?: ApiErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.detalles = detalles;
  }
}

type SessionExpiredListener = () => void;
const sessionExpiredListeners = new Set<SessionExpiredListener>();

export function onSessionExpired(listener: SessionExpiredListener): () => void {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
}

function notifySessionExpired(): void {
  for (const listener of sessionExpiredListeners) {
    listener();
  }
}

export function getApiBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (!configured) {
    return DEFAULT_API_URL;
  }
  return configured.replace(/\/+$/, '');
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  headers?: Record<string, string>;
}

async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const data = (await response.json()) as {
      error?: string;
      detalles?: ApiErrorDetail[];
    };
    return new ApiError(
      response.status,
      data.error ?? `Error HTTP ${response.status}`,
      data.detalles
    );
  } catch {
    return new ApiError(response.status, `Error HTTP ${response.status}`);
  }
}

async function tryRefreshAccessToken(): Promise<string | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    token: string;
    refreshToken: string;
    expiraEnSeg: number;
  };

  if (!data.token || !data.refreshToken) {
    return null;
  }

  await saveSessionTokens({
    token: data.token,
    refreshToken: data.refreshToken,
  });

  return data.token;
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = 'GET', body, auth = true, headers = {} } = options;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${getApiBaseUrl()}${normalizedPath}`;

  const execute = async (bearerToken: string | null): Promise<Response> => {
    const reqHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };

    if (body !== undefined) {
      reqHeaders['Content-Type'] = 'application/json';
    }

    if (auth && bearerToken) {
      reqHeaders.Authorization = `Bearer ${bearerToken}`;
    }

    return fetch(url, {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  const initialToken = auth ? await getAccessToken() : null;
  let response = await execute(initialToken);

  // Ante 401 en ruta autenticada: reintento único con /api/auth/refresh
  if (response.status === 401 && auth && !normalizedPath.startsWith('/api/auth/refresh')) {
    const newToken = await tryRefreshAccessToken();
    if (newToken) {
      response = await execute(newToken);
    } else {
      await clearSessionTokens();
      notifySessionExpired();
      throw new ApiError(401, 'Tu sesión expiró. Inicia sesión nuevamente.');
    }

    if (response.status === 401) {
      await clearSessionTokens();
      notifySessionExpired();
      throw await parseErrorResponse(response);
    }
  }

  if (!response.ok) {
    throw await parseErrorResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
