import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';
import {
  calcularDistanciaMetros,
  detectarSacudida,
  estaCercaDeSupermercado,
  estimarCambioPisosBarometro,
} from '../sensorLogic';
import { useShake } from '../useShake';
import { useShareLista } from '../useShareLista';
import { useSupermarketProximity } from '../useSupermarketProximity';

jest.mock('expo-sensors', () => ({
  Accelerometer: {
    isAvailableAsync: jest.fn(),
    setUpdateInterval: jest.fn(),
    addListener: jest.fn(),
  },
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  hasServicesEnabledAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(),
}));

jest.mock('expo-file-system', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(),
}));

describe('Sensores — funciones puras (Sección 5 y 11)', () => {
  test('detectarSacudida distingue reposo (~1g) de una sacudida fuerte (>= 1.78g)', () => {
    expect(detectarSacudida({ x: 0, y: 0, z: 1.0 })).toBe(false);
    expect(detectarSacudida({ x: 0.2, y: 0.1, z: 0.98 })).toBe(false);
    expect(detectarSacudida({ x: 1.5, y: 1.2, z: 0.5 })).toBe(true);
  });

  test('calcularDistanciaMetros y estaCercaDeSupermercado evalúan radio < 300 m', () => {
    const supermercados = [
      { id: 1, nombre: 'Super Centro', latitud: 4.6500, longitud: -74.0500 },
      { id: 2, nombre: 'Super Norte', latitud: 4.7200, longitud: -74.0500 },
    ];

    // ~111 m al norte de Super Centro (0.001 grados de latitud ≈ 111 m)
    const posicionCercana = { latitud: 4.6510, longitud: -74.0500 };
    const dist = calcularDistanciaMetros(posicionCercana, supermercados[0]);
    expect(dist).toBeGreaterThan(90);
    expect(dist).toBeLessThan(130);

    const resultadoCerca = estaCercaDeSupermercado(posicionCercana, supermercados, 300);
    expect(resultadoCerca.cerca).toBe(true);
    expect(resultadoCerca.supermercado?.nombre).toBe('Super Centro');

    // A ~2 km de distancia
    const posicionLejana = { latitud: 4.6700, longitud: -74.0500 };
    const resultadoLejos = estaCercaDeSupermercado(posicionLejana, supermercados, 300);
    expect(resultadoLejos.cerca).toBe(false);
  });

  test('estimarCambioPisosBarometro calcula cambio de piso (~0.12 hPa/piso)', () => {
    expect(estimarCambioPisosBarometro(1013.25, 1013.01)).toBe(2);
    expect(estimarCambioPisosBarometro(1013.25, 1013.25)).toBe(0);
  });
});

describe('Sensores — hooks con mocks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('useShake verifica isAvailableAsync(), dispara onShake y llama subscription.remove() al desmontar', async () => {
    const removeMock = jest.fn();
    let capturedListener: ((data: { x: number; y: number; z: number }) => void) | null = null;

    (Accelerometer.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Accelerometer.addListener as jest.Mock).mockImplementation((cb) => {
      capturedListener = cb;
      return { remove: removeMock };
    });

    const onShake = jest.fn();
    const { result, unmount } = renderHook(() => useShake(onShake, { cooldownMs: 0 }));

    await waitFor(() => {
      expect(result.current.disponible).toBe(true);
    });
    expect(Accelerometer.isAvailableAsync).toHaveBeenCalledTimes(1);

    // En reposo no dispara
    act(() => {
      capturedListener?.({ x: 0, y: 0, z: 1 });
    });
    expect(onShake).not.toHaveBeenCalled();

    // Al sacudir sí dispara
    act(() => {
      capturedListener?.({ x: 1.6, y: 1.2, z: 0.4 });
    });
    expect(onShake).toHaveBeenCalledTimes(1);

    // Al salir limpia suscripción
    unmount();
    expect(removeMock).toHaveBeenCalledTimes(1);
  });

  test('useShake no falla cuando el acelerómetro no está disponible', async () => {
    (Accelerometer.isAvailableAsync as jest.Mock).mockResolvedValue(false);

    const onShake = jest.fn();
    const { result } = renderHook(() => useShake(onShake));

    await waitFor(() => {
      expect(Accelerometer.isAvailableAsync).toHaveBeenCalledTimes(1);
    });
    expect(result.current.disponible).toBe(false);
    expect(Accelerometer.addListener).not.toHaveBeenCalled();
  });

  test('useSupermarketProximity pide permiso bajo demanda y detecta supermercado < 300 m', async () => {
    (Location.getForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'undetermined',
    });
    (Location.hasServicesEnabledAsync as jest.Mock).mockResolvedValue(true);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
      status: 'granted',
    });
    (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
      coords: { latitude: 4.6505, longitude: -74.0500 },
    });

    const supers = [{ id: 1, nombre: 'Mercado Barrio', latitud: 4.6500, longitud: -74.0500 }];
    const { result } = renderHook(() => useSupermarketProximity(supers, 300));

    // No solicita permiso automáticamente al montar
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.activarYVerificar();
    });

    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(result.current.estadoPermiso).toBe('concedido');
    expect(result.current.resultado?.cerca).toBe(true);
    expect(result.current.resultado?.supermercado?.nombre).toBe('Mercado Barrio');
  });

  test('useShareLista verifica Sharing.isAvailableAsync(), comparte y copia al portapapeles', async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(true);
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction } as never);

    const { result } = renderHook(() => useShareLista());

    await waitFor(() => {
      expect(result.current.sharingDisponible).toBe(true);
    });

    const shareStatus = await result.current.compartirTexto('Lista: Casa\n- Leche (x1)');
    expect(shareStatus).toBe('shared');
    expect(shareSpy).toHaveBeenCalledTimes(1);

    const copied = await result.current.copiarTexto('Lista: Casa');
    expect(copied).toBe(true);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('Lista: Casa');

    shareSpy.mockRestore();
  });
});
