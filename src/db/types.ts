export type CategoriaProducto =
  | 'frutas_verduras'
  | 'lacteos'
  | 'carnes'
  | 'panaderia'
  | 'despensa'
  | 'bebidas'
  | 'aseo'
  | 'otros';

export interface ListaRow {
  id: number;
  nombre: string;
  cerrada: number; // 0 | 1
  creada_en: string;
  codigo_compartir: string | null;
  remote_id: string;
  updated_at: string;
  deleted: number; // 0 | 1
  pending: number; // 0 | 1
}

export interface ItemRow {
  id: number;
  lista_id: number;
  nombre: string;
  cantidad: number;
  categoria: CategoriaProducto | string;
  comprado: number; // 0 | 1
  orden: number;
  remote_id: string;
  updated_at: string;
  deleted: number; // 0 | 1
  pending: number; // 0 | 1
}

export interface SupermercadoRow {
  id: number;
  nombre: string;
  latitud: number;
  longitud: number;
}

export interface SQLiteRunResult {
  lastInsertRowId: number;
  changes: number;
}

export type SQLiteBindParam = string | number | null;

export interface SQLiteDatabaseLike {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, params?: SQLiteBindParam[]): Promise<SQLiteRunResult>;
  getAllAsync<T>(source: string, params?: SQLiteBindParam[]): Promise<T[]>;
  getFirstAsync<T>(source: string, params?: SQLiteBindParam[]): Promise<T | null>;
}
