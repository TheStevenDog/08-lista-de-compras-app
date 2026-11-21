import type { ItemRow } from '../../db/types';
import { listaComoTexto } from '../formatters';

function buildItem(partial: Partial<ItemRow> & Pick<ItemRow, 'id' | 'nombre'>): ItemRow {
  return {
    lista_id: 1,
    cantidad: 1,
    categoria: 'otros',
    comprado: 0,
    orden: 0,
    remote_id: `uuid-${partial.id}`,
    updated_at: '2026-11-20T12:00:00.000Z',
    deleted: 0,
    pending: 0,
    ...partial,
  };
}

describe('formatters — listaComoTexto()', () => {
  test('Criterio 3 y Sección 11: agrupa por categoría y excluye los productos comprados', () => {
    const items: ItemRow[] = [
      buildItem({ id: 1, nombre: 'Leche', cantidad: 2, categoria: 'lacteos', comprado: 0 }),
      buildItem({ id: 2, nombre: 'Yogur', cantidad: 1, categoria: 'lacteos', comprado: 1 }),
      buildItem({ id: 3, nombre: 'Manzanas', cantidad: 6, categoria: 'frutas_verduras', comprado: 0 }),
      buildItem({ id: 4, nombre: 'Jabón', cantidad: 1, categoria: 'aseo', comprado: 0 }),
      buildItem({ id: 5, nombre: 'Pan borrado', cantidad: 1, categoria: 'panaderia', comprado: 0, deleted: 1 }),
    ];

    const texto = listaComoTexto(
      { nombre: 'Compras familia', codigo_compartir: 'FAM123' },
      items
    );

    expect(texto).toContain('Lista: Compras familia');
    expect(texto).toContain('Frutas y verduras:');
    expect(texto).toContain('- Manzanas (x6)');
    expect(texto).toContain('Lácteos:');
    expect(texto).toContain('- Leche (x2)');
    expect(texto).toContain('Aseo y hogar:');
    expect(texto).toContain('- Jabón (x1)');
    expect(texto).toContain('Código compartido: FAM123');

    // Excluye comprados y borrados
    expect(texto).not.toContain('Yogur');
    expect(texto).not.toContain('Pan borrado');

    // Verifica orden de pasillo: Frutas y verduras aparece antes que Lácteos y Aseo
    expect(texto.indexOf('Frutas y verduras:')).toBeLessThan(texto.indexOf('Lácteos:'));
    expect(texto.indexOf('Lácteos:')).toBeLessThan(texto.indexOf('Aseo y hogar:'));
  });

  test('informa cuando todos los productos ya están comprados', () => {
    const items: ItemRow[] = [
      buildItem({ id: 1, nombre: 'Café', cantidad: 1, categoria: 'despensa', comprado: 1 }),
    ];

    const texto = listaComoTexto({ nombre: 'Lista café' }, items);
    expect(texto).toContain('Todos los productos han sido comprados.');
    expect(texto).not.toContain('Café');
  });
});
