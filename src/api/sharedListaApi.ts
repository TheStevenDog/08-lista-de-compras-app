import { apiRequest } from './httpClient';

export interface CompartirListaResponse {
  codigo: string;
  lista_id: string;
  creada_en?: string;
}

export interface SharedListaItemDto {
  id: string;
  lista_id: string;
  nombre: string;
  cantidad: number;
  categoria: string;
  comprado: boolean;
  updated_at?: string;
}

export interface SharedListaResponse {
  codigo: string;
  lista: {
    id: string;
    nombre: string;
    cerrada: boolean;
    codigo_compartir: string | null;
  };
  items: SharedListaItemDto[];
}

export async function generarCodigoCompartirApi(
  remoteListaId: string
): Promise<CompartirListaResponse> {
  const data = await apiRequest<
    CompartirListaResponse & { codigo_compartir?: string }
  >(`/api/listas/${encodeURIComponent(remoteListaId)}/compartir`, {
    method: 'POST',
    auth: true,
  });

  return {
    codigo: data.codigo ?? data.codigo_compartir ?? '',
    lista_id: data.lista_id ?? remoteListaId,
    creada_en: data.creada_en,
  };
}

export async function obtenerListaCompartidaPorCodigo(
  codigo: string
): Promise<SharedListaResponse> {
  const cleanCode = codigo.trim().toUpperCase();
  return apiRequest<SharedListaResponse>(
    `/api/listas/codigo/${encodeURIComponent(cleanCode)}`,
    {
      method: 'GET',
      auth: false,
    }
  );
}

export async function marcarItemListaCompartida(
  codigo: string,
  itemId: string,
  comprado: boolean
): Promise<SharedListaItemDto> {
  const cleanCode = codigo.trim().toUpperCase();
  return apiRequest<SharedListaItemDto>(
    `/api/listas/codigo/${encodeURIComponent(cleanCode)}/items/${encodeURIComponent(itemId)}`,
    {
      method: 'PATCH',
      auth: false,
      body: { comprado },
    }
  );
}
