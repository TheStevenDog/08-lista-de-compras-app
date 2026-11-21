import { Accelerometer } from 'expo-sensors';
import { useEffect, useRef, useState } from 'react';
import { detectarSacudida } from './sensorLogic';

export interface UseShakeOptions {
  enabled?: boolean;
  umbralG?: number;
  cooldownMs?: number;
}

/**
 * Hook de acelerómetro para detectar sacudida y ocultar productos comprados (Sección 5).
 * Reglas cumplidas:
 * 1. Llama siempre a `Accelerometer.isAvailableAsync()`.
 * 2. Cancela la suscripción con `subscription.remove()` al desmontar.
 * 3. Nunca rompe la app si el sensor no está disponible.
 */
export function useShake(
  onShake: () => void,
  options: UseShakeOptions = {}
): { disponible: boolean } {
  const { enabled = true, umbralG = 1.78, cooldownMs = 1200 } = options;
  const [disponible, setDisponible] = useState<boolean>(false);
  const onShakeRef = useRef(onShake);
  const lastTriggerRef = useRef<number>(0);

  useEffect(() => {
    onShakeRef.current = onShake;
  }, [onShake]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    let active = true;
    let subscription: { remove: () => void } | null = null;

    const iniciar = async () => {
      try {
        const isAvailable = await Accelerometer.isAvailableAsync();
        if (!active) return;
        setDisponible(Boolean(isAvailable));

        if (!isAvailable) {
          return;
        }

        Accelerometer.setUpdateInterval(150);
        subscription = Accelerometer.addListener((lectura) => {
          if (!detectarSacudida(lectura, umbralG)) {
            return;
          }
          const now = Date.now();
          if (now - lastTriggerRef.current >= cooldownMs) {
            lastTriggerRef.current = now;
            onShakeRef.current();
          }
        });
      } catch {
        if (active) {
          setDisponible(false);
        }
      }
    };

    void iniciar();

    return () => {
      active = false;
      if (subscription) {
        subscription.remove();
        subscription = null;
      }
    };
  }, [enabled, umbralG, cooldownMs]);

  return { disponible };
}
