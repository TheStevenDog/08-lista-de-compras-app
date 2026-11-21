import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'lista_compras_id_token';
const REFRESH_TOKEN_KEY = 'lista_compras_refresh_token';
const USER_EMAIL_KEY = 'lista_compras_user_email';
const USER_ID_KEY = 'lista_compras_user_id';

export interface StoredSession {
  token: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
}

export async function saveSessionTokens(params: {
  token: string;
  refreshToken: string;
  userId?: string;
  email?: string;
}): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, params.token);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, params.refreshToken);
  if (params.userId !== undefined) {
    await SecureStore.setItemAsync(USER_ID_KEY, params.userId);
  }
  if (params.email !== undefined) {
    await SecureStore.setItemAsync(USER_EMAIL_KEY, params.email);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function getStoredSession(): Promise<StoredSession> {
  const [token, refreshToken, userId, email] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.getItemAsync(USER_ID_KEY),
    SecureStore.getItemAsync(USER_EMAIL_KEY),
  ]);

  return { token, refreshToken, userId, email };
}

export async function clearSessionTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    SecureStore.deleteItemAsync(USER_ID_KEY),
    SecureStore.deleteItemAsync(USER_EMAIL_KEY),
  ]);
}
