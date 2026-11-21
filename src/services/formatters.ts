import type { CategoriaProducto, ItemRow, ListaRow } from '../db/types';

export interface CategoriaMeta {
  id: CategoriaProducto;
  etiqueta: string;
  ordenPasillo: number;
}

export const CATEGORIAS: readonly CategoriaMeta[] = [
  { id: 'frutas_verduras', etiqueta: 'Frutas y verduras', ordenPasillo: 1 },
  { id: 'lacteos', etiqueta: 'Lácteos', ordenPasillo: 2 },
  { id: 'carnes', etiqueta: 'Carnes y proteínas', ordenPasillo: 3 },
  { id: 'panaderia', etiqueta: 'Panadería', ordenPasillo: 4 },
  { id: 'despensa', etiqueta: 'Despensa', ordenPasillo: 5 },
  { id: 'bebidas', etiqueta: 'Bebidas', ordenPasillo: 6 },
  { id: 'aseo', etiqueta: 'Aseo y hogar', ordenPasillo: 7 },
  { id: 'otros', etiqueta: 'Otros', ordenPasillo: 8 },
] as const;

const CATEGORIA_META_MAP = new Map<string, CategoriaMeta>(
  CATEGORIAS.map((c) => [c.id, c])
);

export function obtenerEtiquetaCategoria(categoria: string): string {
  const key = categoria.trim().toLowerCase();
  const meta = CATEGORIA_META_MAP.get(key);
  if (meta) {
    return meta.etiqueta;
  }
  return categoria.trim().length > 0
    ? categoria.charAt(0).toUpperCase() + categoria.slice(1)
    : 'Otros';
}

export function obtenerOrdenCategoria(categoria: string): number {
  return CATEGORIA_META_MAP.get(categoria.trim().toLowerCase())?.ordenPasillo ?? 99;
}

export function normalizarNombreProducto(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export interface ValidacionProductoResult {
  valido: boolean;
  errores: string[];
}

export function validarProductoInput(
  nombre: string,
  cantidad: number
): ValidacionProductoResult {
  const errores: string[] = [];

  if (!nombre || nombre.trim().length === 0) {
    errores.push('El nombre del producto es obligatorio.');
  }

  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 99) {
    errores.push('La cantidad debe ser un número entero entre 1 y 99.');
  }

  return {
    valido: errores.length === 0,
    errores,
  };
}

export interface GrupoCategoria {
  categoria: string;
  etiqueta: string;
  items: ItemRow[];
}

export function agruparItemsPorCategoria(items: ItemRow[]): GrupoCategoria[] {
  const activos = items.filter((item) => item.deleted === 0);
  const map = new Map<string, ItemRow[]>();

  for (const item of activos) {
    const key = item.categoria.trim().toLowerCase() || 'otros';
    const existing = map.get(key) ?? [];
    existing.push(item);
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .sort(([catA], [catB]) => obtenerOrdenCategoria(catA) - obtenerOrdenCategoria(catB))
    .map(([categoria, groupItems]) => ({
      categoria,
      etiqueta: obtenerEtiquetaCategoria(categoria),
      items: [...groupItems].sort((a, b) => a.orden - b.orden || a.id - b.id),
    }));
}

/**
 * Formatea una lista como texto plano agrupado por categoría para WhatsApp o portapapeles.
 * Criterio de aceptación 3: incluye ÚNICAMENTE los productos no comprados (y no borrados).
 */
export function listaComoTexto(
  lista: Pick<ListaRow, 'nombre'> & { codigo_compartir?: string | null },
  items: ItemRow[]
): string {
  const pendientes = items.filter((item) => item.deleted === 0 && item.comprado === 0);
  const header = `Lista: ${lista.nombre}`;

  if (pendientes.length === 0) {
    const emptyLines = [header, '', 'Todos los productos han sido comprados.'];
    if (lista.codigo_compartir) {
      emptyLines.push('', `Código compartido: ${lista.codigo_compartir}`);
    }
    return emptyLines.join('\n');
  }

  const grupos = agruparItemsPorCategoria(pendientes);
  const lines: string[] = [header, ''];

  for (const grupo of grupos) {
    lines.push(`${grupo.etiqueta}:`);
    for (const item of grupo.items) {
      const qtyText = item.cantidad > 1 ? ` (x${item.cantidad})` : ' (x1)';
      lines.push(`- ${item.nombre}${qtyText}`);
    }
    lines.push('');
  }

  if (lista.codigo_compartir) {
    lines.push(`Código compartido: ${lista.codigo_compartir}`);
  }

  return lines.join('\n').trim();
}
