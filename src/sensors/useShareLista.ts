import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useState } from 'react';
import { Share } from 'react-native';

export interface UseShareListaResult {
  sharingDisponible: boolean;
  copiarTexto: (texto: string) => Promise<boolean>;
  compartirTexto: (texto: string, titulo?: string) => Promise<'shared' | 'copied' | 'cancelled'>;
}

/**
 * Hook de envío y copiado de la lista (Sección 5 - Capacidad Principal).
 * Verifica `Sharing.isAvailableAsync()`, usa Share nativo (WhatsApp / apps de mensajería)
 * y ofrece `expo-clipboard` como alternativa segura.
 */
export function useShareLista(): UseShareListaResult {
  const [sharingDisponible, setSharingDisponible] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    Sharing.isAvailableAsync()
      .then((available) => {
        if (active) setSharingDisponible(Boolean(available));
      })
      .catch(() => {
        if (active) setSharingDisponible(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const copiarTexto = useCallback(async (texto: string): Promise<boolean> => {
    try {
      await Clipboard.setStringAsync(texto);
      return true;
    } catch {
      return false;
    }
  }, []);

  const compartirTexto = useCallback(
    async (
      texto: string,
      titulo = 'Lista de compras'
    ): Promise<'shared' | 'copied' | 'cancelled'> => {
      try {
        const result = await Share.share({
          title: titulo,
          message: texto,
        });

        if (result.action === Share.sharedAction) {
          return 'shared';
        }
        return 'cancelled';
      } catch {
        // Plan B con expo-sharing escribiendo archivo temporal si está disponible
        try {
          const canShareFile = await Sharing.isAvailableAsync();
          if (canShareFile && FileSystem.cacheDirectory) {
            const fileUri = `${FileSystem.cacheDirectory}lista-de-compras.txt`;
            await FileSystem.writeAsStringAsync(fileUri, texto, {
              encoding: FileSystem.EncodingType.UTF8,
            });
            await Sharing.shareAsync(fileUri, {
              mimeType: 'text/plain',
              dialogTitle: titulo,
            });
            return 'shared';
          }
        } catch {
          // Cae al portapapeles como último recurso seguro
        }

        await copiarTexto(texto);
        return 'copied';
      }
    },
    [copiarTexto]
  );

  return {
    sharingDisponible,
    copiarTexto,
    compartirTexto,
  };
}
