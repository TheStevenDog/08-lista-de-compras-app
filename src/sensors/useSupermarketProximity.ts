import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import {
  estaCercaDeSupermercado,
  type ResultadoProximidad,
  type SupermercadoUbicacion,
} from './sensorLogic';

export type EstadoPermisoUbicacion =
  | 'sin_solicitar'
  | 'concedido'
  | 'denegado'
  | 'no_disponible';

export interface UseSupermarketProximityResult {
  estadoPermiso: EstadoPermisoUbicacion;
  resultado: ResultadoProximidad | null;
  cargando: boolean;
  error: string | null;
  activarYVerificar: () => Promise<ResultadoProximidad | null>;
  verificarSiPermitido: () => Promise<ResultadoProximidad | null>;
}

/**
 * Hook de proximidad a supermercados guardados (< 300 m) con `expo-location` (Sección 5).
 * Reglas cumplidas:
 * - Verifica disponibilidad de servicios antes de leer GPS.
 * - Solicita permiso únicamente cuando el usuario activa la función (`activarYVerificar`).
 * - Si ya tenía permiso concedido previamente, comprueba discretamente al abrir.
 * - Nunca rompe la app si el permiso o el GPS no están disponibles.
 */
export function useSupermarketProximity(
  supermercados: SupermercadoUbicacion[],
  radioMetros = 300
): UseSupermarketProximityResult {
  const [estadoPermiso, setEstadoPermiso] =
    useState<EstadoPermisoUbicacion>('sin_solicitar');
  const [resultado, setResultado] = useState<ResultadoProximidad | null>(null);
  const [cargando, setCargando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const leerPosicionYEvaluar = useCallback(async (): Promise<ResultadoProximidad | null> => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) {
        setEstadoPermiso('no_disponible');
        setError('Los servicios de ubicación están desactivados.');
        return null;
      }

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const evaluacion = estaCercaDeSupermercado(
        {
          latitud: pos.coords.latitude,
          longitud: pos.coords.longitude,
        },
        supermercados,
        radioMetros
      );
      setResultado(evaluacion);
      setError(null);
      return evaluacion;
    } catch {
      setError('No se pudo obtener la ubicación actual.');
      return null;
    }
  }, [supermercados, radioMetros]);

  const verificarSiPermitido = useCallback(async (): Promise<ResultadoProximidad | null> => {
    if (supermercados.length === 0) {
      return null;
    }
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }
      setEstadoPermiso('concedido');
      setCargando(true);
      return await leerPosicionYEvaluar();
    } catch {
      return null;
    } finally {
      setCargando(false);
    }
  }, [supermercados.length, leerPosicionYEvaluar]);

  const activarYVerificar = useCallback(async (): Promise<ResultadoProximidad | null> => {
    setCargando(true);
    setError(null);
    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setEstadoPermiso('no_disponible');
        setError('Activa el GPS para detectar supermercados cercanos.');
        return null;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setEstadoPermiso('denegado');
        setError('Permiso de ubicación no concedido. La app continúa funcionando sin avisos.');
        return null;
      }

      setEstadoPermiso('concedido');
      return await leerPosicionYEvaluar();
    } catch {
      setEstadoPermiso('no_disponible');
      setError('Sensor de ubicación no disponible en este dispositivo.');
      return null;
    } finally {
      setCargando(false);
    }
  }, [leerPosicionYEvaluar]);

  useEffect(() => {
    void verificarSiPermitido();
  }, [verificarSiPermitido]);

  return {
    estadoPermiso,
    resultado,
    cargando,
    error,
    activarYVerificar,
    verificarSiPermitido,
  };
}
