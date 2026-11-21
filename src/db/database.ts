import * as SQLite from 'expo-sqlite';
import { runMigrations } from './migrations';
import type { SQLiteDatabaseLike } from './types';

const DB_NAME = 'lista_compras_08.db';

let dbInstance: SQLiteDatabaseLike | null = null;
let initPromise: Promise<SQLiteDatabaseLike> | null = null;

export async function getDatabase(): Promise<SQLiteDatabaseLike> {
  if (dbInstance) {
    return dbInstance;
  }

  if (!initPromise) {
    initPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      const adapter: SQLiteDatabaseLike = {
        execAsync: (source) => db.execAsync(source),
        runAsync: (source, params = []) => db.runAsync(source, params),
        getAllAsync: <T>(source: string, params = []) => db.getAllAsync<T>(source, params),
        getFirstAsync: <T>(source: string, params = []) => db.getFirstAsync<T>(source, params),
      };
      await runMigrations(adapter);
      dbInstance = adapter;
      return adapter;
    })();
  }

  return initPromise;
}

export function resetDatabaseInstanceForTests(): void {
  dbInstance = null;
  initPromise = null;
}
