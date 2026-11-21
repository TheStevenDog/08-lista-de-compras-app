import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  cerrarSesion,
  iniciarSesion,
  registrarUsuario,
  type AuthUsuario,
} from '../api/authApi';
import { onSessionExpired } from '../api/httpClient';
import { getStoredSession } from '../api/tokenStore';
import { getDatabase } from '../db/database';
import type { SQLiteDatabaseLike } from '../db/types';
import { sincronizarTodo, type SyncSummary } from '../services/syncService';

export interface AppContextValue {
  db: SQLiteDatabaseLike | null;
  dbReady: boolean;
  dbError: string | null;
  usuario: AuthUsuario | null;
  autenticado: boolean;
  sincronizando: boolean;
  ultimaSincronizacion: string | null;
  dataVersion: number;
  notifyDataChanged: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  syncNow: () => Promise<SyncSummary>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabaseLike | null>(null);
  const [dbReady, setDbReady] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [usuario, setUsuario] = useState<AuthUsuario | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const [ultimaSincronizacion, setUltimaSincronizacion] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const notifyDataChanged = useCallback(() => {
    setDataVersion((prev) => prev + 1);
  }, []);

  useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const database = await getDatabase();
        const stored = await getStoredSession();
        if (!mounted) return;

        setDb(database);
        if (stored.token && stored.userId && stored.email) {
          setUsuario({ id: stored.userId, email: stored.email });
        }
        setDbReady(true);
      } catch (err) {
        if (!mounted) return;
        setDbError(
          err instanceof Error ? err.message : 'Error al inicializar SQLite.'
        );
      }
    };

    void bootstrap();

    const unsubscribeExpired = onSessionExpired(() => {
      if (mounted) {
        setUsuario(null);
      }
    });

    return () => {
      mounted = false;
      unsubscribeExpired();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await iniciarSesion(email, password);
    setUsuario(res.usuario);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    const res = await registrarUsuario(email, password);
    setUsuario(res.usuario);
  }, []);

  const logout = useCallback(async () => {
    await cerrarSesion();
    setUsuario(null);
  }, []);

  const syncNow = useCallback(async (): Promise<SyncSummary> => {
    if (!db) {
      throw new Error('Base de datos no inicializada.');
    }
    setSincronizando(true);
    try {
      const summary = await sincronizarTodo(db);
      setUltimaSincronizacion(summary.servidorAhora ?? new Date().toISOString());
      notifyDataChanged();
      return summary;
    } finally {
      setSincronizando(false);
    }
  }, [db, notifyDataChanged]);

  const value = useMemo<AppContextValue>(
    () => ({
      db,
      dbReady,
      dbError,
      usuario,
      autenticado: usuario !== null,
      sincronizando,
      ultimaSincronizacion,
      dataVersion,
      notifyDataChanged,
      login,
      register,
      logout,
      syncNow,
    }),
    [
      db,
      dbReady,
      dbError,
      usuario,
      sincronizando,
      ultimaSincronizacion,
      dataVersion,
      notifyDataChanged,
      login,
      register,
      logout,
      syncNow,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppContext debe usarse dentro de AppProvider.');
  }
  return ctx;
}
