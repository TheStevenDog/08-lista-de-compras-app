import { ApiError, apiRequest } from '../api/httpClient';
import { getAccessToken } from '../api/tokenStore';
import type { SQLiteDatabaseLike } from '../db/types';
import {
  getPendingItems,
  markItemSynced,
  upsertItemFromRemote,
} from '../repositories/itemRepository';
import {
  getListaById,
  getListaByRemoteId,
  getPendingListas,
  markListaSynced,
  upsertListaFromRemote,
} from '../repositories/listaRepository';
import { getSyncMeta, setSyncMeta } from '../repositories/syncMetaRepository';

const PAGE_LIMIT = 500;
const META_LAST_SYNC_LISTA = 'last_sync_lista';
const META_LAST_SYNC_ITEM = 'last_sync_item';

export interface RemoteListaDoc {
  id: string;
  nombre: string;
  cerrada: boolean;
  codigo_compartir: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface RemoteItemDoc {
  id: string;
  lista_id: string;
  nombre: string;
  cantidad: number;
  categoria: string;
  comprado: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface SyncListResponse<T> {
  items: T[];
  servidor_ahora: string;
}

export interface SyncSummary {
  pushedListas: number;
  pushedItems: number;
  pulledListas: number;
  pulledItems: number;
  servidorAhora: string | null;
}

export interface SyncApiAdapter {
  putLista(id: string, body: Record<string, unknown>): Promise<RemoteListaDoc>;
  deleteLista(id: string): Promise<{ ok: boolean }>;
  getListasSince(since: string | null): Promise<SyncListResponse<RemoteListaDoc>>;
  putItem(id: string, body: Record<string, unknown>): Promise<RemoteItemDoc>;
  deleteItem(id: string): Promise<{ ok: boolean }>;
  getItemsSince(since: string | null): Promise<SyncListResponse<RemoteItemDoc>>;
}

const defaultSyncApiAdapter: SyncApiAdapter = {
  putLista: (id, body) =>
    apiRequest<RemoteListaDoc>(`/api/lista/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body,
    }),
  deleteLista: (id) =>
    apiRequest<{ ok: boolean }>(`/api/lista/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  getListasSince: (since) => {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiRequest<SyncListResponse<RemoteListaDoc>>(`/api/lista${query}`, {
      method: 'GET',
    });
  },
  putItem: (id, body) =>
    apiRequest<RemoteItemDoc>(`/api/item/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body,
    }),
  deleteItem: (id) =>
    apiRequest<{ ok: boolean }>(`/api/item/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  getItemsSince: (since) => {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    return apiRequest<SyncListResponse<RemoteItemDoc>>(`/api/item${query}`, {
      method: 'GET',
    });
  },
};

/**
 * Estrategia offline-first (Sección 9.3):
 * 1. Envía listas pendientes (PUT o DELETE).
 * 2. Envía ítems pendientes (PUT o DELETE).
 * 3. Descarga incrementalmente `GET /api/lista?since=` en páginas de hasta 500.
 * 4. Descarga incrementalmente `GET /api/item?since=` en páginas de hasta 500.
 * Conflictos resueltos por última escritura usando `updated_at` del servidor.
 */
export async function sincronizarTodo(
  db: SQLiteDatabaseLike,
  api: SyncApiAdapter = defaultSyncApiAdapter,
  options?: { skipAuthCheck?: boolean }
): Promise<SyncSummary> {
  if (!options?.skipAuthCheck) {
    const token = await getAccessToken();
    if (!token) {
      throw new ApiError(401, 'Inicia sesión para sincronizar con la nube.');
    }
  }

  let pushedListas = 0;
  let pushedItems = 0;
  let pulledListas = 0;
  let pulledItems = 0;
  let lastServidorAhora: string | null = null;

  // 1. Subir listas pendientes
  const pendingListas = await getPendingListas(db);
  for (const lista of pendingListas) {
    if (lista.deleted === 1) {
      try {
        await api.deleteLista(lista.remote_id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          throw err;
        }
      }
      await markListaSynced(db, lista.id, new Date().toISOString());
      pushedListas += 1;
    } else {
      const saved = await api.putLista(lista.remote_id, {
        nombre: lista.nombre,
        cerrada: lista.cerrada === 1,
        codigo_compartir: lista.codigo_compartir ?? null,
      });
      await markListaSynced(db, lista.id, saved.updated_at);
      pushedListas += 1;
    }
  }

  // 2. Subir ítems pendientes
  const pendingItems = await getPendingItems(db);
  for (const item of pendingItems) {
    const parentLista = await getListaById(db, item.lista_id);
    if (!parentLista) {
      continue;
    }

    if (item.deleted === 1) {
      try {
        await api.deleteItem(item.remote_id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          throw err;
        }
      }
      await markItemSynced(db, item.id, new Date().toISOString());
      pushedItems += 1;
    } else {
      const saved = await api.putItem(item.remote_id, {
        lista_id: parentLista.remote_id,
        nombre: item.nombre,
        cantidad: item.cantidad,
        categoria: item.categoria,
        comprado: item.comprado === 1,
      });
      await markItemSynced(db, item.id, saved.updated_at);
      pushedItems += 1;
    }
  }

  // 3. Descarga incremental de listas (páginas de máx 500)
  let listaCursor = await getSyncMeta(db, META_LAST_SYNC_LISTA);
  let hasMoreListas = true;
  let safetyPages = 0;

  while (hasMoreListas && safetyPages < 100) {
    safetyPages += 1;
    const page = await api.getListasSince(listaCursor);
    lastServidorAhora = page.servidor_ahora;

    for (const remoteLista of page.items) {
      await upsertListaFromRemote(db, remoteLista);
      pulledListas += 1;
    }

    if (page.items.length === PAGE_LIMIT) {
      const lastItem = page.items[page.items.length - 1];
      if (!lastItem || lastItem.updated_at === listaCursor) {
        hasMoreListas = false;
      } else {
        listaCursor = lastItem.updated_at;
      }
    } else {
      hasMoreListas = false;
    }
  }

  if (lastServidorAhora) {
    await setSyncMeta(db, META_LAST_SYNC_LISTA, lastServidorAhora);
  }

  // 4. Descarga incremental de ítems (páginas de máx 500)
  let itemCursor = await getSyncMeta(db, META_LAST_SYNC_ITEM);
  let hasMoreItems = true;
  safetyPages = 0;

  while (hasMoreItems && safetyPages < 100) {
    safetyPages += 1;
    const page = await api.getItemsSince(itemCursor);
    lastServidorAhora = page.servidor_ahora;

    for (const remoteItem of page.items) {
      const localLista = await getListaByRemoteId(db, remoteItem.lista_id);
      if (!localLista) {
        continue;
      }
      await upsertItemFromRemote(db, remoteItem, localLista.id);
      pulledItems += 1;
    }

    if (page.items.length === PAGE_LIMIT) {
      const lastItem = page.items[page.items.length - 1];
      if (!lastItem || lastItem.updated_at === itemCursor) {
        hasMoreItems = false;
      } else {
        itemCursor = lastItem.updated_at;
      }
    } else {
      hasMoreItems = false;
    }
  }

  if (lastServidorAhora) {
    await setSyncMeta(db, META_LAST_SYNC_ITEM, lastServidorAhora);
  }

  return {
    pushedListas,
    pushedItems,
    pulledListas,
    pulledItems,
    servidorAhora: lastServidorAhora,
  };
}
