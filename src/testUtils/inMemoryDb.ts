import type {
  ItemRow,
  ListaRow,
  SQLiteBindParam,
  SQLiteDatabaseLike,
  SQLiteRunResult,
  SupermercadoRow,
} from '../db/types';

/**
 * Base de datos SQLite en memoria para pruebas unitarias e integración rápida
 * sobre los repositorios parametrizados (`listaRepository`, `itemRepository`, `syncMetaRepository`).
 */
export class InMemorySQLiteDb implements SQLiteDatabaseLike {
  private listas: ListaRow[] = [];
  private items: ItemRow[] = [];
  private syncMeta = new Map<string, string>();
  private supermercados: SupermercadoRow[] = [];
  private nextListaId = 1;
  private nextItemId = 1;
  private nextSuperId = 1;
  private userVersion = 0;

  async execAsync(source: string): Promise<void> {
    const match = /PRAGMA\s+user_version\s*=\s*(\d+)/i.exec(source);
    if (match) {
      this.userVersion = Number(match[1]);
    }
  }

  async runAsync(
    source: string,
    params: SQLiteBindParam[] = []
  ): Promise<SQLiteRunResult> {
    const sql = source.replace(/\s+/g, ' ').trim();

    if (/^INSERT INTO lista/i.test(sql)) {
      const id = this.nextListaId++;
      const row: ListaRow = {
        id,
        nombre: String(params[0]),
        cerrada: Number(params[1]),
        creada_en: String(params[2]),
        codigo_compartir: params[3] === null ? null : String(params[3]),
        remote_id: String(params[4]),
        updated_at: String(params[5]),
        deleted: Number(params[6]),
        pending: Number(params[7]),
      };
      this.listas.push(row);
      return { lastInsertRowId: id, changes: 1 };
    }

    if (/^UPDATE lista SET nombre = \?, updated_at = \?, pending = 1 WHERE id = \?$/i.test(sql)) {
      const target = this.listas.find((l) => l.id === Number(params[2]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.nombre = String(params[0]);
      target.updated_at = String(params[1]);
      target.pending = 1;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE lista SET cerrada = 1, updated_at = \?, pending = 1 WHERE id = \?$/i.test(sql)) {
      const target = this.listas.find((l) => l.id === Number(params[1]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.cerrada = 1;
      target.updated_at = String(params[0]);
      target.pending = 1;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE lista SET codigo_compartir = \?, updated_at = \?, pending = 1 WHERE id = \?$/i.test(sql)) {
      const target = this.listas.find((l) => l.id === Number(params[2]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.codigo_compartir = params[0] === null ? null : String(params[0]);
      target.updated_at = String(params[1]);
      target.pending = 1;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE lista SET deleted = 1, updated_at = \?, pending = 1 WHERE id = \?$/i.test(sql)) {
      const target = this.listas.find((l) => l.id === Number(params[1]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.deleted = 1;
      target.updated_at = String(params[0]);
      target.pending = 1;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE lista SET pending = 0, updated_at = \? WHERE id = \?$/i.test(sql)) {
      const target = this.listas.find((l) => l.id === Number(params[1]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.pending = 0;
      target.updated_at = String(params[0]);
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE lista SET nombre = \?, cerrada = \?, codigo_compartir = \?, updated_at = \?, deleted = \?, pending = 0 WHERE id = \?$/i.test(sql)) {
      const target = this.listas.find((l) => l.id === Number(params[5]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.nombre = String(params[0]);
      target.cerrada = Number(params[1]);
      target.codigo_compartir = params[2] === null ? null : String(params[2]);
      target.updated_at = String(params[3]);
      target.deleted = Number(params[4]);
      target.pending = 0;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^INSERT INTO item/i.test(sql)) {
      const id = this.nextItemId++;
      const row: ItemRow = {
        id,
        lista_id: Number(params[0]),
        nombre: String(params[1]),
        cantidad: Number(params[2]),
        categoria: String(params[3]),
        comprado: Number(params[4]),
        orden: Number(params[5]),
        remote_id: String(params[6]),
        updated_at: String(params[7]),
        deleted: Number(params[8]),
        pending: Number(params[9]),
      };
      this.items.push(row);
      return { lastInsertRowId: id, changes: 1 };
    }

    if (/^UPDATE item SET cantidad = \?, comprado = \?, updated_at = \?, pending = 1 WHERE id = \?$/i.test(sql)) {
      const target = this.items.find((i) => i.id === Number(params[3]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.cantidad = Number(params[0]);
      target.comprado = Number(params[1]);
      target.updated_at = String(params[2]);
      target.pending = 1;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE item SET comprado = \?, updated_at = \?, pending = 1 WHERE id = \?$/i.test(sql)) {
      const target = this.items.find((i) => i.id === Number(params[2]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.comprado = Number(params[0]);
      target.updated_at = String(params[1]);
      target.pending = 1;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE item SET orden = \?, updated_at = \?, pending = 1 WHERE id = \?$/i.test(sql)) {
      const target = this.items.find((i) => i.id === Number(params[2]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.orden = Number(params[0]);
      target.updated_at = String(params[1]);
      target.pending = 1;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE item SET deleted = 1, updated_at = \?, pending = 1 WHERE id = \?$/i.test(sql)) {
      const target = this.items.find((i) => i.id === Number(params[1]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.deleted = 1;
      target.updated_at = String(params[0]);
      target.pending = 1;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE item SET pending = 0, updated_at = \? WHERE id = \?$/i.test(sql)) {
      const target = this.items.find((i) => i.id === Number(params[1]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.pending = 0;
      target.updated_at = String(params[0]);
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^UPDATE item SET lista_id = \?, nombre = \?, cantidad = \?, categoria = \?, comprado = \?, updated_at = \?, deleted = \?, pending = 0 WHERE id = \?$/i.test(sql)) {
      const target = this.items.find((i) => i.id === Number(params[7]));
      if (!target) return { lastInsertRowId: 0, changes: 0 };
      target.lista_id = Number(params[0]);
      target.nombre = String(params[1]);
      target.cantidad = Number(params[2]);
      target.categoria = String(params[3]);
      target.comprado = Number(params[4]);
      target.updated_at = String(params[5]);
      target.deleted = Number(params[6]);
      target.pending = 0;
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^INSERT INTO sync_meta/i.test(sql)) {
      this.syncMeta.set(String(params[0]), String(params[1]));
      return { lastInsertRowId: 0, changes: 1 };
    }

    if (/^INSERT INTO supermercado/i.test(sql)) {
      const id = this.nextSuperId++;
      this.supermercados.push({
        id,
        nombre: String(params[0]),
        latitud: Number(params[1]),
        longitud: Number(params[2]),
      });
      return { lastInsertRowId: id, changes: 1 };
    }

    if (/^DELETE FROM supermercado WHERE id = \?$/i.test(sql)) {
      const before = this.supermercados.length;
      this.supermercados = this.supermercados.filter((s) => s.id !== Number(params[0]));
      return { lastInsertRowId: 0, changes: before - this.supermercados.length };
    }

    throw new Error(`SQL no soportado en InMemorySQLiteDb.runAsync: ${sql}`);
  }

  async getAllAsync<T>(
    source: string,
    params: SQLiteBindParam[] = []
  ): Promise<T[]> {
    const sql = source.replace(/\s+/g, ' ').trim();

    if (/^SELECT \* FROM lista WHERE cerrada = 1 AND deleted = 0/i.test(sql)) {
      return this.listas
        .filter((l) => l.cerrada === 1 && l.deleted === 0)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)
        .map((l) => ({ ...l })) as unknown as T[];
    }

    if (/^SELECT \* FROM lista WHERE deleted = 0/i.test(sql)) {
      return this.listas
        .filter((l) => l.deleted === 0)
        .map((l) => ({ ...l })) as unknown as T[];
    }

    if (/^SELECT \* FROM lista WHERE pending = 1/i.test(sql)) {
      return this.listas
        .filter((l) => l.pending === 1)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
        .map((l) => ({ ...l })) as unknown as T[];
    }

    if (/^SELECT \* FROM item WHERE lista_id = \? AND deleted = 0 AND LOWER\(nombre\) LIKE \?/i.test(sql)) {
      const listaId = Number(params[0]);
      const rawLike = String(params[1]).replace(/%/g, '').toLowerCase();
      return this.items
        .filter(
          (i) =>
            i.lista_id === listaId &&
            i.deleted === 0 &&
            i.nombre.toLowerCase().includes(rawLike)
        )
        .sort((a, b) => a.orden - b.orden || a.id - b.id)
        .map((i) => ({ ...i })) as unknown as T[];
    }

    if (/^SELECT \* FROM item WHERE lista_id = \? AND deleted = 0/i.test(sql)) {
      const listaId = Number(params[0]);
      return this.items
        .filter((i) => i.lista_id === listaId && i.deleted === 0)
        .sort((a, b) => a.orden - b.orden || a.id - b.id)
        .map((i) => ({ ...i })) as unknown as T[];
    }

    if (/^SELECT \* FROM item WHERE deleted = 0/i.test(sql)) {
      return this.items
        .filter((i) => i.deleted === 0)
        .sort((a, b) => b.id - a.id)
        .map((i) => ({ ...i })) as unknown as T[];
    }

    if (/^SELECT \* FROM item WHERE pending = 1/i.test(sql)) {
      return this.items
        .filter((i) => i.pending === 1)
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
        .map((i) => ({ ...i })) as unknown as T[];
    }

    if (/^SELECT \* FROM supermercado/i.test(sql)) {
      return [...this.supermercados].sort((a, b) =>
        a.nombre.localeCompare(b.nombre)
      ) as unknown as T[];
    }

    throw new Error(`SQL no soportado en InMemorySQLiteDb.getAllAsync: ${sql}`);
  }

  async getFirstAsync<T>(
    source: string,
    params: SQLiteBindParam[] = []
  ): Promise<T | null> {
    const sql = source.replace(/\s+/g, ' ').trim();

    if (/^PRAGMA user_version$/i.test(sql)) {
      return { user_version: this.userVersion } as unknown as T;
    }

    if (/^SELECT \* FROM lista WHERE cerrada = 0 AND deleted = 0/i.test(sql)) {
      const found = this.listas
        .filter((l) => l.cerrada === 0 && l.deleted === 0)
        .sort((a, b) => b.id - a.id)[0];
      return found ? ({ ...found } as unknown as T) : null;
    }

    if (/^SELECT \* FROM lista WHERE id = \?/i.test(sql)) {
      const found = this.listas.find((l) => l.id === Number(params[0]));
      return found ? ({ ...found } as unknown as T) : null;
    }

    if (/^SELECT \* FROM lista WHERE remote_id = \?/i.test(sql)) {
      const found = this.listas.find((l) => l.remote_id === String(params[0]));
      return found ? ({ ...found } as unknown as T) : null;
    }

    if (/^SELECT \* FROM item WHERE id = \?/i.test(sql)) {
      const found = this.items.find((i) => i.id === Number(params[0]));
      return found ? ({ ...found } as unknown as T) : null;
    }

    if (/^SELECT \* FROM item WHERE remote_id = \?/i.test(sql)) {
      const found = this.items.find((i) => i.remote_id === String(params[0]));
      return found ? ({ ...found } as unknown as T) : null;
    }

    if (/^SELECT valor FROM sync_meta WHERE clave = \?/i.test(sql)) {
      const val = this.syncMeta.get(String(params[0]));
      return val !== undefined ? ({ valor: val } as unknown as T) : null;
    }

    if (/^SELECT \* FROM supermercado WHERE id = \?/i.test(sql)) {
      const found = this.supermercados.find((s) => s.id === Number(params[0]));
      return found ? ({ ...found } as unknown as T) : null;
    }

    throw new Error(`SQL no soportado en InMemorySQLiteDb.getFirstAsync: ${sql}`);
  }
}
