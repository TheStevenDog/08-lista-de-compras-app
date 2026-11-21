import type { SQLiteDatabaseLike, SupermercadoRow } from '../db/types';

export async function getSyncMeta(
  db: SQLiteDatabaseLike,
  clave: string
): Promise<string | null> {
  const row = await db.getFirstAsync<{ valor: string }>(
    'SELECT valor FROM sync_meta WHERE clave = ? LIMIT 1',
    [clave]
  );
  return row?.valor ?? null;
}

export async function setSyncMeta(
  db: SQLiteDatabaseLike,
  clave: string,
  valor: string
): Promise<void> {
  await db.runAsync(
    `INSERT INTO sync_meta (clave, valor) VALUES (?, ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    [clave, valor]
  );
}

export async function getSupermercados(db: SQLiteDatabaseLike): Promise<SupermercadoRow[]> {
  return db.getAllAsync<SupermercadoRow>('SELECT * FROM supermercado ORDER BY nombre ASC');
}

export async function createSupermercado(
  db: SQLiteDatabaseLike,
  nombre: string,
  latitud: number,
  longitud: number
): Promise<SupermercadoRow> {
  const res = await db.runAsync(
    'INSERT INTO supermercado (nombre, latitud, longitud) VALUES (?, ?, ?)',
    [nombre, latitud, longitud]
  );
  const created = await db.getFirstAsync<SupermercadoRow>(
    'SELECT * FROM supermercado WHERE id = ? LIMIT 1',
    [res.lastInsertRowId]
  );
  if (!created) {
    throw new Error('No se pudo guardar el supermercado.');
  }
  return created;
}

export async function deleteSupermercado(
  db: SQLiteDatabaseLike,
  id: number
): Promise<void> {
  await db.runAsync('DELETE FROM supermercado WHERE id = ?', [id]);
}
