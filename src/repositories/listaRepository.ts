import type { ListaRow, SQLiteDatabaseLike } from '../db/types';

export interface CreateListaInput {
  nombre: string;
  cerrada?: number;
  creada_en: string;
  codigo_compartir?: string | null;
  remote_id: string;
  updated_at: string;
  deleted?: number;
  pending?: number;
}

export async function getActiveLista(db: SQLiteDatabaseLike): Promise<ListaRow | null> {
  return db.getFirstAsync<ListaRow>(
    'SELECT * FROM lista WHERE cerrada = 0 AND deleted = 0 ORDER BY id DESC LIMIT 1'
  );
}

export async function getListaById(db: SQLiteDatabaseLike, id: number): Promise<ListaRow | null> {
  return db.getFirstAsync<ListaRow>('SELECT * FROM lista WHERE id = ? LIMIT 1', [id]);
}

export async function getListaByRemoteId(
  db: SQLiteDatabaseLike,
  remoteId: string
): Promise<ListaRow | null> {
  return db.getFirstAsync<ListaRow>('SELECT * FROM lista WHERE remote_id = ? LIMIT 1', [remoteId]);
}

export async function getHistorialListas(db: SQLiteDatabaseLike): Promise<ListaRow[]> {
  return db.getAllAsync<ListaRow>(
    'SELECT * FROM lista WHERE cerrada = 1 AND deleted = 0 ORDER BY updated_at DESC, id DESC'
  );
}

export async function getAllListas(db: SQLiteDatabaseLike): Promise<ListaRow[]> {
  return db.getAllAsync<ListaRow>(
    'SELECT * FROM lista WHERE deleted = 0 ORDER BY cerrada ASC, updated_at DESC, id DESC'
  );
}

export async function createLista(
  db: SQLiteDatabaseLike,
  input: CreateListaInput
): Promise<ListaRow> {
  const result = await db.runAsync(
    `INSERT INTO lista (nombre, cerrada, creada_en, codigo_compartir, remote_id, updated_at, deleted, pending)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.nombre,
      input.cerrada ?? 0,
      input.creada_en,
      input.codigo_compartir ?? null,
      input.remote_id,
      input.updated_at,
      input.deleted ?? 0,
      input.pending ?? 1,
    ]
  );

  const created = await getListaById(db, result.lastInsertRowId);
  if (!created) {
    throw new Error('No se pudo recuperar la lista recién creada.');
  }
  return created;
}

export async function updateListaNombre(
  db: SQLiteDatabaseLike,
  id: number,
  nombre: string,
  nowIso: string
): Promise<void> {
  await db.runAsync(
    'UPDATE lista SET nombre = ?, updated_at = ?, pending = 1 WHERE id = ?',
    [nombre, nowIso, id]
  );
}

export async function closeLista(
  db: SQLiteDatabaseLike,
  id: number,
  nowIso: string
): Promise<void> {
  await db.runAsync(
    'UPDATE lista SET cerrada = 1, updated_at = ?, pending = 1 WHERE id = ?',
    [nowIso, id]
  );
}

export async function setListaCodigoCompartir(
  db: SQLiteDatabaseLike,
  id: number,
  codigo: string | null,
  nowIso: string
): Promise<void> {
  await db.runAsync(
    'UPDATE lista SET codigo_compartir = ?, updated_at = ?, pending = 1 WHERE id = ?',
    [codigo, nowIso, id]
  );
}

export async function softDeleteLista(
  db: SQLiteDatabaseLike,
  id: number,
  nowIso: string
): Promise<void> {
  await db.runAsync(
    'UPDATE lista SET deleted = 1, updated_at = ?, pending = 1 WHERE id = ?',
    [nowIso, id]
  );
}

export async function getPendingListas(db: SQLiteDatabaseLike): Promise<ListaRow[]> {
  return db.getAllAsync<ListaRow>(
    'SELECT * FROM lista WHERE pending = 1 ORDER BY updated_at ASC'
  );
}

export async function markListaSynced(
  db: SQLiteDatabaseLike,
  id: number,
  serverUpdatedAt: string
): Promise<void> {
  await db.runAsync(
    'UPDATE lista SET pending = 0, updated_at = ? WHERE id = ?',
    [serverUpdatedAt, id]
  );
}

export async function upsertListaFromRemote(
  db: SQLiteDatabaseLike,
  remote: {
    id: string;
    nombre: string;
    cerrada: boolean;
    codigo_compartir: string | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
  }
): Promise<ListaRow> {
  const existing = await getListaByRemoteId(db, remote.id);
  const deletedFlag = remote.deleted_at ? 1 : 0;
  const cerradaFlag = remote.cerrada ? 1 : 0;

  if (!existing) {
    return createLista(db, {
      nombre: remote.nombre,
      cerrada: cerradaFlag,
      creada_en: remote.created_at,
      codigo_compartir: remote.codigo_compartir ?? null,
      remote_id: remote.id,
      updated_at: remote.updated_at,
      deleted: deletedFlag,
      pending: 0,
    });
  }

  // Resolución de conflictos: gana la última escritura (updated_at del servidor)
  if (existing.pending === 0 || remote.updated_at >= existing.updated_at) {
    await db.runAsync(
      `UPDATE lista
       SET nombre = ?, cerrada = ?, codigo_compartir = ?, updated_at = ?, deleted = ?, pending = 0
       WHERE id = ?`,
      [
        remote.nombre,
        cerradaFlag,
        remote.codigo_compartir ?? null,
        remote.updated_at,
        deletedFlag,
        existing.id,
      ]
    );
    const updated = await getListaById(db, existing.id);
    if (updated) return updated;
  }

  return existing;
}
