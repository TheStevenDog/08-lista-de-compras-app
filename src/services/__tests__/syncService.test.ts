import { getItemsByListaId } from '../../repositories/itemRepository';
import { getListaById } from '../../repositories/listaRepository';
import { InMemorySQLiteDb } from '../../testUtils/inMemoryDb';
import { agregarProducto, asegurarListaActiva } from '../listaService';
import {
  sincronizarTodo,
  type RemoteItemDoc,
  type RemoteListaDoc,
  type SyncApiAdapter,
} from '../syncService';

describe('syncService — sincronización offline-first y conflictos', () => {
  test('envía pendientes (PUT), descarga cambios (?since=) y aplica gana la última escritura', async () => {
    const db = new InMemorySQLiteDb();
    const lista = await asegurarListaActiva(db, 'Lista local');
    const { item } = await agregarProducto(db, {
      listaId: lista.id,
      nombre: 'Leche',
      cantidad: 1,
      categoria: 'lacteos',
    });

    const putListaMock = jest.fn(async (id: string, body: Record<string, unknown>): Promise<RemoteListaDoc> => ({
      id,
      nombre: String(body.nombre),
      cerrada: Boolean(body.cerrada),
      codigo_compartir: (body.codigo_compartir as string | null) ?? null,
      created_at: '2026-11-20T10:00:00.000Z',
      updated_at: '2026-11-20T10:01:00.000Z',
      deleted_at: null,
    }));

    const putItemMock = jest.fn(async (id: string, body: Record<string, unknown>): Promise<RemoteItemDoc> => ({
      id,
      lista_id: String(body.lista_id),
      nombre: String(body.nombre),
      cantidad: Number(body.cantidad),
      categoria: String(body.categoria),
      comprado: Boolean(body.comprado),
      created_at: '2026-11-20T10:00:00.000Z',
      updated_at: '2026-11-20T10:01:00.000Z',
      deleted_at: null,
    }));

    const adapter: SyncApiAdapter = {
      putLista: putListaMock,
      deleteLista: jest.fn(async () => ({ ok: true })),
      getListasSince: jest.fn(async () => ({
        items: [
          {
            id: lista.remote_id,
            nombre: 'Lista renombrada en servidor',
            cerrada: false,
            codigo_compartir: 'XYZ789',
            created_at: '2026-11-20T10:00:00.000Z',
            updated_at: '2026-11-20T10:05:00.000Z',
            deleted_at: null,
          },
        ],
        servidor_ahora: '2026-11-20T10:06:00.000Z',
      })),
      putItem: putItemMock,
      deleteItem: jest.fn(async () => ({ ok: true })),
      getItemsSince: jest.fn(async () => ({
        items: [
          {
            id: item.remote_id,
            lista_id: lista.remote_id,
            nombre: 'Leche',
            cantidad: 4,
            categoria: 'lacteos',
            comprado: true,
            created_at: '2026-11-20T10:00:00.000Z',
            updated_at: '2026-11-20T10:05:00.000Z',
            deleted_at: null,
          },
        ],
        servidor_ahora: '2026-11-20T10:06:00.000Z',
      })),
    };

    const summary = await sincronizarTodo(db, adapter, { skipAuthCheck: true });

    expect(summary.pushedListas).toBe(1);
    expect(summary.pushedItems).toBe(1);
    expect(summary.pulledListas).toBe(1);
    expect(summary.pulledItems).toBe(1);
    expect(putListaMock).toHaveBeenCalledTimes(1);
    expect(putItemMock).toHaveBeenCalledTimes(1);

    const updatedLista = await getListaById(db, lista.id);
    expect(updatedLista?.nombre).toBe('Lista renombrada en servidor');
    expect(updatedLista?.codigo_compartir).toBe('XYZ789');
    expect(updatedLista?.pending).toBe(0);

    const updatedItems = await getItemsByListaId(db, lista.id);
    expect(updatedItems[0].cantidad).toBe(4);
    expect(updatedItems[0].comprado).toBe(1);
    expect(updatedItems[0].pending).toBe(0);
  });
});
