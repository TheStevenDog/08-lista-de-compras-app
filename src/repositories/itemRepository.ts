import type { CategoriaProducto, ItemRow, SQLiteDatabaseLike } from '../db/types';

export interface CreateItemInput {
  lista_id: number;
  nombre: string;
  cantidad: number;
  categoria: CategoriaProducto | string;
  comprado?: number;
  orden?: number;
  remote_id: string;
  updated_at: string;
  deleted?: number;
  pending?: number;
}

export async function getItemsByListaId(
  db: SQLiteDatabaseLike,
  listaId: number,
  search?: string
): Promise<ItemRow[]> {
  if (search && search.trim().length > 0) {
    const pattern = `%${search.trim().toLowerCase()}%`;
    return db.getAllAsync<ItemRow>(
      `SELECT * FROM item
       WHERE lista_id = ? AND deleted = 0 AND LOWER(nombre) LIKE ?
       ORDER BY orden ASC, id ASC`,
      [listaId, pattern]
    );
  }

  return db.getAllAsync<ItemRow>(
    `SELECT * FROM item
     WHERE lista_id = ? AND deleted = 0
     ORDER BY orden ASC, id ASC`,
    [listaId]
  );
}

export async function getItemById(db: SQLiteDatabaseLike, id: number): Promise<ItemRow | null> {
  return db.getFirstAsync<ItemRow>('SELECT * FROM item WHERE id = ? LIMIT 1', [id]);
}

export async function getItemByRemoteId(
  db: SQLiteDatabaseLike,
  remoteId: string
): Promise<ItemRow | null> {
  return db.getFirstAsync<ItemRow>('SELECT * FROM item WHERE remote_id = ? LIMIT 1', [remoteId]);
}

export async function getAllActiveItems(db: SQLiteDatabaseLike): Promise<ItemRow[]> {
  return db.getAllAsync<ItemRow>(
    'SELECT * FROM item WHERE deleted = 0 ORDER BY id DESC'
  );
}

export async function createItem(
  db: SQLiteDatabaseLike,
  input: CreateItemInput
): Promise<ItemRow> {
  const result = await db.runAsync(
    `INSERT INTO item (lista_id, nombre, cantidad, categoria, comprado, orden, remote_id, updated_at, deleted, pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.lista_id,
      input.nombre,
      input.cantidad,
      input.categoria,
      input.comprado ?? 0,
      input.orden ?? 0,
      input.remote_id,
      input.updated_at,
      input.deleted ?? 0,
      input.pending ?? 1,
    ]
  );

  const created = await getItemById(db, result.lastInsertRowId);
  if (!created) {
    throw new Error('No se pudo recuperar el producto recién creado.');
  }
  return created;
}

export async function updateItemCantidadYEstado(
  db: SQLiteDatabaseLike,
  id: number,
  cantidad: number,
  comprado: number,
  nowIso: string
): Promise<ItemRow> {
  await db.runAsync(
    'UPDATE item SET cantidad = ?, comprado = ?, updated_at = ?, pending = 1 WHERE id = ?',
    [cantidad, comprado, nowIso, id]
  );
  const updated = await getItemById(db, id);
  if (!updated) {
    throw new Error('Producto no encontrado tras actualizar cantidad.');
  }
  return updated;
}

export async function updateItemComprado(
  db: SQLiteDatabaseLike,
  id: number,
  comprado: number,
  nowIso: string
): Promise<ItemRow> {
  await db.runAsync(
    'UPDATE item SET comprado = ?, updated_at = ?, pending = 1 WHERE id = ?',
    [comprado, nowIso, id]
  );
  const updated = await getItemById(db, id);
  if (!updated) {
    throw new Error('Producto no encontrado tras actualizar estado.');
  }
  return updated;
}

export async function updateItemOrden(
  db: SQLiteDatabaseLike,
  id: number,
  orden: number,
  nowIso: string
): Promise<void> {
  await db.runAsync(
    'UPDATE item SET orden = ?, updated_at = ?, pending = 1 WHERE id = ?',
    [orden, nowIso, id]
  );
}

export async function softDeleteItem(
  db: SQLiteDatabaseLike,
  id: number,
  nowIso: string
): Promise<void> {
  await db.runAsync(
    'UPDATE item SET deleted = 1, updated_at = ?, pending = 1 WHERE id = ?',
    [nowIso, id]
  );
}

export async function getPendingItems(db: SQLiteDatabaseLike): Promise<ItemRow[]> {
  return db.getAllAsync<ItemRow>(
    'SELECT * FROM item WHERE pending = 1 ORDER BY updated_at ASC'
  );
}

export async function markItemSynced(
  db: SQLiteDatabaseLike,
  id: number,
  serverUpdatedAt: string
): Promise<void> {
  await db.runAsync(
    'UPDATE item SET pending = 0, updated_at = ? WHERE id = ?',
    [serverUpdatedAt, id]
  );
}

export async function upsertItemFromRemote(
  db: SQLiteDatabaseLike,
  remote: {
    id: string;
    nombre: string;
    cantidad: number;
    categoria: string;
    comprado: boolean;
    updated_at: string;
    deleted_at: string | null;
  },
  localListaId: number
): Promise<ItemRow> {
  const existing = await getItemByRemoteId(db, remote.id);
  const deletedFlag = remote.deleted_at ? 1 : 0;
  const compradoFlag = remote.comprado ? 1 : 0;

  if (!existing) {
    return createItem(db, {
      lista_id: localListaId,
      nombre: remote.nombre,
      cantidad: remote.cantidad,
      categoria: remote.categoria,
      comprado: compradoFlag,
      orden: 0,
      remote_id: remote.id,
      updated_at: remote.updated_at,
      deleted: deletedFlag,
      pending: 0,
    });
  }

  // Resolución de conflictos: gana la última escritura (updated_at del servidor)
  if (existing.pending === 0 || remote.updated_at >= existing.updated_at) {
    await db.runAsync(
      `UPDATE item
       SET lista_id = ?, nombre = ?, cantidad = ?, categoria = ?, comprado = ?, updated_at = ?, deleted = ?, pending = 0
       WHERE id = ?`,
      [
        localListaId,
        remote.nombre,
        remote.cantidad,
        remote.categoria,
        compradoFlag,
        remote.updated_at,
        deletedFlag,
        existing.id,
      ]
    );
    const updated = await getItemById(db, existing.id);
    if (updated) return updated;
  }

  return existing;
}
