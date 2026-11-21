import type { CategoriaProducto, ItemRow, ListaRow, SQLiteDatabaseLike } from '../db/types';
import {
  createItem,
  getAllActiveItems,
  getItemById,
  getItemsByListaId,
  softDeleteItem,
  updateItemCantidadYEstado,
  updateItemComprado,
  updateItemOrden,
} from '../repositories/itemRepository';
import {
  closeLista,
  createLista,
  getActiveLista,
  getHistorialListas,
  getListaById,
  setListaCodigoCompartir,
  updateListaNombre,
} from '../repositories/listaRepository';
import { normalizarNombreProducto, validarProductoInput } from './formatters';
import { generateUuid } from './uuid';

export interface AgregarProductoParams {
  listaId: number;
  nombre: string;
  cantidad?: number;
  categoria?: CategoriaProducto | string;
}

export interface ProductoFrecuente {
  nombre: string;
  categoria: string;
  frecuencia: number;
}

export async function asegurarListaActiva(
  db: SQLiteDatabaseLike,
  nombrePorDefecto = 'Lista de compras'
): Promise<ListaRow> {
  const existing = await getActiveLista(db);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  return createLista(db, {
    nombre: nombrePorDefecto,
    cerrada: 0,
    creada_en: now,
    codigo_compartir: null,
    remote_id: generateUuid(),
    updated_at: now,
    deleted: 0,
    pending: 1,
  });
}

export async function renombrarLista(
  db: SQLiteDatabaseLike,
  listaId: number,
  nuevoNombre: string
): Promise<ListaRow> {
  const limpio = nuevoNombre.trim();
  if (!limpio) {
    throw new Error('El nombre de la lista es obligatorio.');
  }
  const now = new Date().toISOString();
  await updateListaNombre(db, listaId, limpio, now);
  const updated = await getListaById(db, listaId);
  if (!updated) {
    throw new Error('Lista no encontrada.');
  }
  return updated;
}

/**
 * Agrega un producto a la lista o suma la cantidad si ya existe uno con el mismo nombre normalizado.
 * Criterio de aceptación 1 y Sección 7.
 */
export async function agregarProducto(
  db: SQLiteDatabaseLike,
  params: AgregarProductoParams
): Promise<{ item: ItemRow; acumulado: boolean }> {
  const cantidad = params.cantidad ?? 1;
  const validacion = validarProductoInput(params.nombre, cantidad);
  if (!validacion.valido) {
    throw new Error(validacion.errores.join(' '));
  }

  const nombreLimpio = params.nombre.trim();
  const nombreNormalizado = normalizarNombreProducto(nombreLimpio);
  const itemsActuales = await getItemsByListaId(db, params.listaId);
  const now = new Date().toISOString();

  const existente = itemsActuales.find(
    (item) => normalizarNombreProducto(item.nombre) === nombreNormalizado
  );

  if (existente) {
    const nuevaCantidad = Math.min(99, existente.cantidad + cantidad);
    const updated = await updateItemCantidadYEstado(
      db,
      existente.id,
      nuevaCantidad,
      0, // Si estaba tachado y se vuelve a pedir, regresa como pendiente
      now
    );
    return { item: updated, acumulado: true };
  }

  const maxOrden = itemsActuales.reduce((max, item) => Math.max(max, item.orden), -1);
  const created = await createItem(db, {
    lista_id: params.listaId,
    nombre: nombreLimpio,
    cantidad,
    categoria: params.categoria ?? 'otros',
    comprado: 0,
    orden: maxOrden + 1,
    remote_id: generateUuid(),
    updated_at: now,
    deleted: 0,
    pending: 1,
  });

  return { item: created, acumulado: false };
}

export async function alternarComprado(
  db: SQLiteDatabaseLike,
  itemId: number
): Promise<ItemRow> {
  const existing = await getItemById(db, itemId);
  if (!existing || existing.deleted === 1) {
    throw new Error('El producto no existe.');
  }
  const nuevoEstado = existing.comprado === 1 ? 0 : 1;
  return updateItemComprado(db, itemId, nuevoEstado, new Date().toISOString());
}

export async function marcarComprado(
  db: SQLiteDatabaseLike,
  itemId: number,
  comprado: boolean
): Promise<ItemRow> {
  const existing = await getItemById(db, itemId);
  if (!existing || existing.deleted === 1) {
    throw new Error('El producto no existe.');
  }
  return updateItemComprado(db, itemId, comprado ? 1 : 0, new Date().toISOString());
}

export async function eliminarProducto(
  db: SQLiteDatabaseLike,
  itemId: number
): Promise<void> {
  await softDeleteItem(db, itemId, new Date().toISOString());
}

export async function reordenarProductos(
  db: SQLiteDatabaseLike,
  orderedIds: number[]
): Promise<void> {
  const now = new Date().toISOString();
  for (let index = 0; index < orderedIds.length; index += 1) {
    await updateItemOrden(db, orderedIds[index], index, now);
  }
}

/**
 * Cierra la lista actual (pasa al historial con cerrada = 1) y crea automáticamente una nueva lista vacía.
 * Criterio de aceptación 2.
 */
export async function cerrarListaActiva(
  db: SQLiteDatabaseLike,
  listaId: number,
  nombreNuevaLista = 'Lista de compras'
): Promise<{ listaCerrada: ListaRow; nuevaLista: ListaRow }> {
  const lista = await getListaById(db, listaId);
  if (!lista || lista.deleted === 1) {
    throw new Error('La lista a cerrar no existe.');
  }

  const now = new Date().toISOString();
  await closeLista(db, listaId, now);

  const listaCerrada = await getListaById(db, listaId);
  if (!listaCerrada) {
    throw new Error('Error al leer la lista cerrada.');
  }

  const nuevaLista = await createLista(db, {
    nombre: nombreNuevaLista,
    cerrada: 0,
    creada_en: now,
    codigo_compartir: null,
    remote_id: generateUuid(),
    updated_at: now,
    deleted: 0,
    pending: 1,
  });

  return { listaCerrada, nuevaLista };
}

/**
 * Duplica una lista y todos sus productos no eliminados generando nuevos IDs locales y nuevos remote_id (UUID).
 * RF-05 y Sección 11.
 */
export async function duplicarLista(
  db: SQLiteDatabaseLike,
  sourceListaId: number,
  options?: { nuevoNombre?: string; activarComoActual?: boolean }
): Promise<{ lista: ListaRow; items: ItemRow[] }> {
  const origen = await getListaById(db, sourceListaId);
  if (!origen || origen.deleted === 1) {
    throw new Error('La lista origen no existe.');
  }

  const now = new Date().toISOString();

  if (options?.activarComoActual) {
    const activaActual = await getActiveLista(db);
    if (activaActual && activaActual.id !== sourceListaId) {
      await closeLista(db, activaActual.id, now);
    } else if (activaActual && activaActual.id === sourceListaId) {
      await closeLista(db, activaActual.id, now);
    }
  }

  const nombreCopia = options?.nuevoNombre?.trim() || `${origen.nombre} (copia)`;
  const nuevaLista = await createLista(db, {
    nombre: nombreCopia,
    cerrada: 0,
    creada_en: now,
    codigo_compartir: null,
    remote_id: generateUuid(),
    updated_at: now,
    deleted: 0,
    pending: 1,
  });

  const itemsOrigen = await getItemsByListaId(db, sourceListaId);
  const nuevosItems: ItemRow[] = [];

  for (let i = 0; i < itemsOrigen.length; i += 1) {
    const src = itemsOrigen[i];
    const cloned = await createItem(db, {
      lista_id: nuevaLista.id,
      nombre: src.nombre,
      cantidad: src.cantidad,
      categoria: src.categoria,
      comprado: 0,
      orden: i,
      remote_id: generateUuid(),
      updated_at: now,
      deleted: 0,
      pending: 1,
    });
    nuevosItems.push(cloned);
  }

  return { lista: nuevaLista, items: nuevosItems };
}

export async function guardarCodigoCompartirLocal(
  db: SQLiteDatabaseLike,
  listaId: number,
  codigo: string
): Promise<void> {
  await setListaCodigoCompartir(db, listaId, codigo, new Date().toISOString());
}

export async function obtenerHistorial(db: SQLiteDatabaseLike): Promise<ListaRow[]> {
  return getHistorialListas(db);
}

/**
 * Reto opcional (Sección 12): detecta los productos más frecuentes del historial para sugerirlos al usuario.
 */
export async function obtenerProductosFrecuentes(
  db: SQLiteDatabaseLike,
  options?: { limite?: number; excluirListaId?: number }
): Promise<ProductoFrecuente[]> {
  const limite = options?.limite ?? 8;
  const todos = await getAllActiveItems(db);

  const excluidos = new Set<string>();
  if (options?.excluirListaId !== undefined) {
    const enLista = await getItemsByListaId(db, options.excluirListaId);
    for (const item of enLista) {
      excluidos.add(normalizarNombreProducto(item.nombre));
    }
  }

  const contador = new Map<
    string,
    { nombre: string; categoriaCounts: Map<string, number>; frecuencia: number }
  >();

  for (const item of todos) {
    const norm = normalizarNombreProducto(item.nombre);
    if (!norm || excluidos.has(norm)) {
      continue;
    }

    const entry = contador.get(norm) ?? {
      nombre: item.nombre,
      categoriaCounts: new Map<string, number>(),
      frecuencia: 0,
    };
    entry.frecuencia += 1;
    entry.categoriaCounts.set(
      item.categoria,
      (entry.categoriaCounts.get(item.categoria) ?? 0) + 1
    );
    contador.set(norm, entry);
  }

  return Array.from(contador.values())
    .map((entry) => {
      let topCategoria = 'otros';
      let topCount = -1;
      for (const [cat, count] of entry.categoriaCounts.entries()) {
        if (count > topCount) {
          topCount = count;
          topCategoria = cat;
        }
      }
      return {
        nombre: entry.nombre,
        categoria: topCategoria,
        frecuencia: entry.frecuencia,
      };
    })
    .sort((a, b) => b.frecuencia - a.frecuencia || a.nombre.localeCompare(b.nombre))
    .slice(0, limite);
}
