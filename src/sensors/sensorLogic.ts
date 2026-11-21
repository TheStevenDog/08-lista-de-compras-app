export interface LecturaAcelerometro {
  x: number;
  y: number;
  z: number;
}

export interface Coordenadas {
  latitud: number;
  longitud: number;
}

export interface SupermercadoUbicacion extends Coordenadas {
  id?: number;
  nombre: string;
}

export interface ResultadoProximidad {
  cerca: boolean;
  supermercado: SupermercadoUbicacion | null;
  distanciaMetros: number | null;
}

const RADIO_TIERRA_METROS = 6_371_000;

/**
 * Función pura: determina si una lectura del acelerómetro (en unidades de gravedad g)
 * supera el umbral de sacudida. En reposo la magnitud es ~1.0g.
 */
export function detectarSacudida(
  lectura: LecturaAcelerometro,
  umbralG = 1.78
): boolean {
  const magnitud = Math.sqrt(
    lectura.x * lectura.x + lectura.y * lectura.y + lectura.z * lectura.z
  );
  return magnitud >= umbralG;
}

function gradosARadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

/**
 * Función pura: distancia en metros entre dos coordenadas geográficas usando la fórmula de Haversine.
 */
export function calcularDistanciaMetros(a: Coordenadas, b: Coordenadas): number {
  const dLat = gradosARadianes(b.latitud - a.latitud);
  const dLon = gradosARadianes(b.longitud - a.longitud);
  const lat1 = gradosARadianes(a.latitud);
  const lat2 = gradosARadianes(b.latitud);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return RADIO_TIERRA_METROS * c;
}

/**
 * Función pura: evalúa si la posición actual está a menos de `radioMetros` (por defecto 300 m)
 * de algún supermercado guardado y devuelve el más cercano.
 */
export function estaCercaDeSupermercado(
  posicionActual: Coordenadas,
  supermercados: SupermercadoUbicacion[],
  radioMetros = 300
): ResultadoProximidad {
  if (supermercados.length === 0) {
    return { cerca: false, supermercado: null, distanciaMetros: null };
  }

  let masCercano: SupermercadoUbicacion | null = null;
  let menorDistancia = Number.POSITIVE_INFINITY;

  for (const supermercado of supermercados) {
    const distancia = calcularDistanciaMetros(posicionActual, supermercado);
    if (distancia < menorDistancia) {
      menorDistancia = distancia;
      masCercano = supermercado;
    }
  }

  const distanciaRedondeada = Math.round(menorDistancia);
  const estaCerca = menorDistancia < radioMetros;

  return {
    cerca: estaCerca,
    supermercado: masCercano,
    distanciaMetros: distanciaRedondeada,
  };
}

/**
 * Función pura auxiliar (Barometer, Sección 5): estima pisos recorridos a ~0.12 hPa por piso.
 */
export function estimarCambioPisosBarometro(
  presionReferenciaHpa: number,
  presionActualHpa: number,
  hpaPorPiso = 0.12
): number {
  if (hpaPorPiso <= 0) return 0;
  // Al subir pisos disminuye la presión atmosférica (~0.12 hPa/piso)
  return Math.round((presionReferenciaHpa - presionActualHpa) / hpaPorPiso);
}
