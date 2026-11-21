import type { SQLiteDatabaseLike } from './types';

export const SCHEMA_VERSION = 1;

export const MIGRATION_V1_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS lista (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  cerrada INTEGER NOT NULL DEFAULT 0,
  creada_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  codigo_compartir TEXT,
  remote_id TEXT NOT NULL UNIQUE,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS item (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lista_id INTEGER NOT NULL REFERENCES lista(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0 AND cantidad <= 99),
  categoria TEXT NOT NULL DEFAULT 'otros',
  comprado INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  remote_id TEXT NOT NULL UNIQUE,
  updated_at TEXT NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  pending INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sync_meta (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS supermercado (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  latitud REAL NOT NULL,
  longitud REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lista_cerrada_deleted ON lista(cerrada, deleted);
CREATE INDEX IF NOT EXISTS idx_lista_pending ON lista(pending);
CREATE INDEX IF NOT EXISTS idx_item_lista_deleted ON item(lista_id, deleted);
CREATE INDEX IF NOT EXISTS idx_item_pending ON item(pending);
`;

export async function runMigrations(db: SQLiteDatabaseLike): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = row?.user_version ?? 0;

  if (currentVersion < 1) {
    await db.execAsync(MIGRATION_V1_SQL);
    await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }
}
