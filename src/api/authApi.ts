import { apiRequest } from './httpClient';
import { clearSessionTokens, saveSessionTokens } from './tokenStore';

export interface AuthUsuario {
  id: string;
  email: string;
  rol?: string;
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  expiraEnSeg: number;
  usuario: AuthUsuario;
}

export async function registrarUsuario(
  email: string,
  password: string
): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>('/api/auth/registro', {
    method: 'POST',
    auth: false,
    body: { email: email.trim(), password },
  });

  await saveSessionTokens({
    token: data.token,
    refreshToken: data.refreshToken,
    userId: data.usuario.id,
    email: data.usuario.email,
  });

  return data;
}

export async function iniciarSesion(
  email: string,
  password: string
): Promise<AuthResponse> {
  const data = await apiRequest<AuthResponse>('/api/auth/login', {
    method: 'POST',
    auth: false,
    body: { email: email.trim(), password },
  });

  await saveSessionTokens({
    token: data.token,
    refreshToken: data.refreshToken,
    userId: data.usuario.id,
    email: data.usuario.email,
  });

  return data;
}

export async function obtenerPerfilActual(): Promise<{ usuario: AuthUsuario }> {
  return apiRequest<{ usuario: AuthUsuario }>('/api/auth/yo', {
    method: 'GET',
    auth: true,
  });
}

export async function cerrarSesion(): Promise<void> {
  await clearSessionTokens();
}
