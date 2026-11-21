import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  marcarItemListaCompartida,
  obtenerListaCompartidaPorCodigo,
  type SharedListaResponse,
} from '../../src/api/sharedListaApi';
import { useAppContext } from '../../src/components/AppContext';
import type { ItemRow, ListaRow } from '../../src/db/types';
import { getItemsByListaId } from '../../src/repositories/itemRepository';
import { getListaById } from '../../src/repositories/listaRepository';
import { useShareLista } from '../../src/sensors/useShareLista';
import {
  agruparItemsPorCategoria,
  listaComoTexto,
  obtenerEtiquetaCategoria,
} from '../../src/services/formatters';
import { duplicarLista } from '../../src/services/listaService';

export default function ListaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { db, notifyDataChanged } = useAppContext();
  const { compartirTexto, copiarTexto } = useShareLista();

  const rawId = Array.isArray(id) ? id[0] : (id ?? '');
  const isSharedCode =
    rawId.startsWith('codigo-') || (/^[A-Za-z0-9]{6}$/.test(rawId) && Number.isNaN(Number(rawId)));
  const sharedCode = rawId.startsWith('codigo-')
    ? rawId.slice('codigo-'.length).toUpperCase()
    : rawId.toUpperCase();

  const [localLista, setLocalLista] = useState<ListaRow | null>(null);
  const [localItems, setLocalItems] = useState<ItemRow[]>([]);
  const [sharedData, setSharedData] = useState<SharedListaResponse | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      if (isSharedCode) {
        const res = await obtenerListaCompartidaPorCodigo(sharedCode);
        setSharedData(res);
      } else {
        if (!db) return;
        const numericId = Number(rawId);
        const found = await getListaById(db, numericId);
        if (!found) {
          setError('Lista no encontrada.');
          return;
        }
        const items = await getItemsByListaId(db, numericId);
        setLocalLista(found);
        setLocalItems(items);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo cargar la lista.'
      );
    } finally {
      setCargando(false);
    }
  }, [db, isSharedCode, rawId, sharedCode]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const localGrupos = useMemo(
    () => agruparItemsPorCategoria(localItems),
    [localItems]
  );

  const handleDuplicarLocal = async () => {
    if (!db || !localLista) return;
    await duplicarLista(db, localLista.id, { activarComoActual: true });
    notifyDataChanged();
    router.replace('/');
  };

  const handleCompartirLocal = async () => {
    if (!localLista) return;
    const texto = listaComoTexto(localLista, localItems);
    const status = await compartirTexto(texto, localLista.nombre);
    if (status === 'copied') {
      setMensaje('Texto copiado al portapapeles.');
    }
  };

  const handleCopiarLocal = async () => {
    if (!localLista) return;
    const texto = listaComoTexto(localLista, localItems);
    await copiarTexto(texto);
    setMensaje('Texto de pendientes copiado al portapapeles.');
  };

  const handleToggleSharedItem = async (itemId: string, currentComprado: boolean) => {
    try {
      const updated = await marcarItemListaCompartida(
        sharedCode,
        itemId,
        !currentComprado
      );
      setSharedData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === itemId ? { ...item, comprado: updated.comprado } : item
              ),
            }
          : prev
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo actualizar el estado del producto compartido.'
      );
    }
  };

  if (cargando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (isSharedCode && sharedData) {
    return (
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.headerTitle}>{sharedData.lista.nombre}</Text>
          <Text style={styles.headerMeta}>
            Lista compartida · Código {sharedCode} · Toca un producto para marcarlo comprado
          </Text>
        </View>

        {sharedData.items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              void handleToggleSharedItem(item.id, item.comprado);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: item.comprado }}
            accessibilityLabel={
              item.comprado
                ? `Desmarcar ${item.nombre} como comprado`
                : `Marcar ${item.nombre} como comprado`
            }
            style={styles.itemRow}
          >
            <View
              style={[styles.checkbox, item.comprado && styles.checkboxChecked]}
            >
              <Text style={styles.checkboxMark}>{item.comprado ? '✓' : ''}</Text>
            </View>
            <View style={styles.itemInfo}>
              <Text
                style={[styles.itemName, item.comprado && styles.itemStruck]}
              >
                {item.nombre}
              </Text>
              <Text style={styles.itemMeta}>
                {obtenerEtiquetaCategoria(item.categoria)} · Cantidad: {item.cantidad}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  if (!localLista) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Lista no disponible.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.headerCard}>
        <Text style={styles.headerTitle}>{localLista.nombre}</Text>
        <Text style={styles.headerMeta}>
          Creada: {localLista.creada_en.slice(0, 10)} · {localItems.length} productos
        </Text>
      </View>

      {mensaje ? <Text style={styles.infoBanner}>{mensaje}</Text> : null}

      <View style={styles.actionRow}>
        <Pressable
          onPress={handleDuplicarLocal}
          accessibilityRole="button"
          accessibilityLabel={`Duplicar lista ${localLista.nombre}`}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>Duplicar como activa</Text>
        </Pressable>

        <Pressable
          onPress={handleCompartirLocal}
          accessibilityRole="button"
          accessibilityLabel="Compartir productos pendientes"
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryBtnText}>Compartir</Text>
        </Pressable>

        <Pressable
          onPress={handleCopiarLocal}
          accessibilityRole="button"
          accessibilityLabel="Copiar productos pendientes"
          style={styles.secondaryBtn}
        >
          <Text style={styles.secondaryBtnText}>Copiar</Text>
        </Pressable>
      </View>

      {localGrupos.map((grupo) => (
        <View key={grupo.categoria} style={styles.groupBlock}>
          <Text style={styles.groupTitle}>{grupo.etiqueta}</Text>
          {grupo.items.map((item) => (
            <View key={item.id} style={styles.itemRow}>
              <Text
                style={[
                  styles.itemName,
                  item.comprado === 1 && styles.itemStruck,
                ]}
              >
                {item.comprado === 1 ? '✓ ' : '• '}
                {item.nombre} (x{item.cantidad})
              </Text>
            </View>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  infoBanner: {
    backgroundColor: '#CCFBF1',
    color: '#115E59',
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
    fontWeight: '600',
  },
  headerCard: {
    backgroundColor: '#0F766E',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerMeta: {
    fontSize: 13,
    color: '#CCFBF1',
    marginTop: 4,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#0F766E',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  secondaryBtn: {
    backgroundColor: '#E2E8F0',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  groupBlock: {
    marginBottom: 14,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#0F766E',
  },
  checkboxMark: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  itemStruck: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  itemMeta: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
});
