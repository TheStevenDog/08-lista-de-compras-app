import { getItemsByListaId } from '../../repositories/itemRepository';
import { InMemorySQLiteDb } from '../../testUtils/inMemoryDb';
import {
  agregarProducto,
  asegurarListaActiva,
  cerrarListaActiva,
  duplicarLista,
  obtenerHistorial,
  obtenerProductosFrecuentes,
} from '../listaService';

describe('listaService — reglas de negocio y criterios de aceptación', () => {
  test('Criterio 1: agregar un producto duplicado («Leche») suma su cantidad sin duplicar fila', async () => {
    const db = new InMemorySQLiteDb();
    const lista = await asegurarListaActiva(db, 'Supermercado semanal');

    const primero = await agregarProducto(db, {
      listaId: lista.id,
      nombre: 'Leche',
      cantidad: 2,
      categoria: 'lacteos',
    });
    expect(primero.acumulado).toBe(false);
    expect(primero.item.cantidad).toBe(2);

    const segundo = await agregarProducto(db, {
      listaId: lista.id,
      nombre: '  leche ',
      cantidad: 3,
      categoria: 'lacteos',
    });
    expect(segundo.acumulado).toBe(true);
    expect(segundo.item.id).toBe(primero.item.id);
    expect(segundo.item.cantidad).toBe(5);

    const items = await getItemsByListaId(db, lista.id);
    expect(items).toHaveLength(1);
    expect(items[0].nombre).toBe('Leche');
    expect(items[0].cantidad).toBe(5);
  });

  test('Validación: rechaza nombre vacío y cantidades fuera de entero 1..99', async () => {
    const db = new InMemorySQLiteDb();
    const lista = await asegurarListaActiva(db);

    await expect(
      agregarProducto(db, { listaId: lista.id, nombre: '   ', cantidad: 1 })
    ).rejects.toThrow(/obligatorio/i);

    await expect(
      agregarProducto(db, { listaId: lista.id, nombre: 'Pan', cantidad: 0 })
    ).rejects.toThrow(/entre 1 y 99/i);

    await expect(
      agregarProducto(db, { listaId: lista.id, nombre: 'Pan', cantidad: 100 })
    ).rejects.toThrow(/entre 1 y 99/i);

    await expect(
      agregarProducto(db, { listaId: lista.id, nombre: 'Pan', cantidad: 2.5 })
    ).rejects.toThrow(/entero/i);
  });

  test('Criterio 2: al cerrar la lista activa, pasa al historial (cerrada=1) y se crea una nueva vacía', async () => {
    const db = new InMemorySQLiteDb();
    const inicial = await asegurarListaActiva(db, 'Compras quincena');
    await agregarProducto(db, {
      listaId: inicial.id,
      nombre: 'Arroz',
      cantidad: 2,
      categoria: 'despensa',
    });

    const { listaCerrada, nuevaLista } = await cerrarListaActiva(db, inicial.id);

    expect(listaCerrada.id).toBe(inicial.id);
    expect(listaCerrada.cerrada).toBe(1);
    expect(nuevaLista.id).not.toBe(inicial.id);
    expect(nuevaLista.remote_id).not.toBe(inicial.remote_id);
    expect(nuevaLista.cerrada).toBe(0);

    const historial = await obtenerHistorial(db);
    expect(historial.map((l) => l.id)).toContain(inicial.id);

    const itemsNueva = await getItemsByListaId(db, nuevaLista.id);
    expect(itemsNueva).toHaveLength(0);
  });

  test('Sección 11: duplicar lista crea nuevos IDs locales y nuevos remote_id (UUIDs)', async () => {
    const db = new InMemorySQLiteDb();
    const original = await asegurarListaActiva(db, 'Mercado domingo');
    const leche = await agregarProducto(db, {
      listaId: original.id,
      nombre: 'Leche',
      cantidad: 2,
      categoria: 'lacteos',
    });
    const pan = await agregarProducto(db, {
      listaId: original.id,
      nombre: 'Pan integral',
      cantidad: 1,
      categoria: 'panaderia',
    });

    const { lista: copia, items: itemsCopia } = await duplicarLista(db, original.id);

    expect(copia.id).not.toBe(original.id);
    expect(copia.remote_id).not.toBe(original.remote_id);
    expect(itemsCopia).toHaveLength(2);

    const originalIds = new Set([leche.item.id, pan.item.id]);
    const originalRemoteIds = new Set([leche.item.remote_id, pan.item.remote_id]);

    for (const item of itemsCopia) {
      expect(item.lista_id).toBe(copia.id);
      expect(originalIds.has(item.id)).toBe(false);
      expect(originalRemoteIds.has(item.remote_id)).toBe(false);
      expect(item.comprado).toBe(0);
    }
  });

  test('Reto opcional (Sección 12): detecta productos frecuentes del historial y excluye los de la lista activa', async () => {
    const db = new InMemorySQLiteDb();

    const l1 = await asegurarListaActiva(db, 'Semana 1');
    await agregarProducto(db, { listaId: l1.id, nombre: 'Leche', cantidad: 1, categoria: 'lacteos' });
    await agregarProducto(db, { listaId: l1.id, nombre: 'Huevos', cantidad: 12, categoria: 'carnes' });
    const { nuevaLista: l2 } = await cerrarListaActiva(db, l1.id, 'Semana 2');

    await agregarProducto(db, { listaId: l2.id, nombre: 'Leche', cantidad: 2, categoria: 'lacteos' });
    await agregarProducto(db, { listaId: l2.id, nombre: 'Pan', cantidad: 1, categoria: 'panaderia' });
    const { nuevaLista: l3 } = await cerrarListaActiva(db, l2.id, 'Semana 3');

    await agregarProducto(db, { listaId: l3.id, nombre: 'Pan', cantidad: 1, categoria: 'panaderia' });

    const sugerencias = await obtenerProductosFrecuentes(db, {
      limite: 5,
      excluirListaId: l3.id,
    });

    // Pan ya está en l3, por lo que no debe sugerirse; Leche aparece 2 veces y va primero
    expect(sugerencias.some((s) => s.nombre === 'Pan')).toBe(false);
    expect(sugerencias[0]).toEqual({
      nombre: 'Leche',
      categoria: 'lacteos',
      frecuencia: 2,
    });
  });
});
