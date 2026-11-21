import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { generarCodigoCompartirApi } from '../../src/api/sharedListaApi';
import { useAppContext } from '../../src/components/AppContext';
import { AuthSyncModal } from '../../src/components/AuthSyncModal';
import { ListTitleHeader } from '../../src/components/ListTitleHeader';
import { SupermarketProximityBanner } from '../../src/components/SupermarketProximityBanner';
import { SwipeableProductRow } from '../../src/components/SwipeableProductRow';
import type { ItemRow, ListaRow, SupermercadoRow } from '../../src/db/types';
import { getItemsByListaId } from '../../src/repositories/itemRepository';
import {
  createSupermercado,
  getSupermercados,
} from '../../src/repositories/syncMetaRepository';
import { useShake } from '../../src/sensors/useShake';
import { useShareLista } from '../../src/sensors/useShareLista';
import { useSupermarketProximity } from '../../src/sensors/useSupermarketProximity';
import {
  agruparItemsPorCategoria,
  listaComoTexto,
} from '../../src/services/formatters';
import {
  alternarComprado,
  asegurarListaActiva,
  cerrarListaActiva,
  duplicarLista,
  eliminarProducto,
  guardarCodigoCompartirLocal,
  reordenarProductos,
} from '../../src/services/listaService';

export default function ListaActivaScreen() {
  const router = useRouter();
  const { db, dbReady, dbError, autenticado, dataVersion, notifyDataChanged } =
    useAppContext();

  const [lista, setLista] = useState<ListaRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [supermercados, setSupermercados] = useState<SupermercadoRow[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [ocultarComprados, setOcultarComprados] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [modalNubeVisible, setModalNubeVisible] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const { compartirTexto, copiarTexto } = useShareLista();
  const proximity = useSupermarketProximity(supermercados, 300);

  const cargarDatos = useCallback(async () => {
    if (!db) return;
    setCargando(true);
    try {
      const activa = await asegurarListaActiva(db);
      const [listaItems, supers] = await Promise.all([
        getItemsByListaId(db, activa.id, busqueda),
        getSupermercados(db),
      ]);
      setLista(activa);
      setItems(listaItems);
      setSupermercados(supers);
    } catch (err) {
      setFeedback(
        err instanceof Error ? err.message : 'Error cargando la lista activa.'
      );
    } finally {
      setCargando(false);
    }
  }, [db, busqueda]);

  useFocusEffect(
    useCallback(() => {
      if (dbReady && db) {
        void cargarDatos();
      }
    }, [dbReady, db, cargarDatos, dataVersion])
  );

  // Sensor Accelerometer: sacudir para ocultar comprados (con botón accesible abajo)
  const { disponible: shakeDisponible } = useShake(
    useCallback(() => {
      setOcultarComprados(true);
      setFeedback('Sacudida detectada: productos comprados ocultos.');
    }, []),
    { enabled: true }
  );

  const itemsVisibles = useMemo(
    () => (ocultarComprados ? items.filter((item) => item.comprado === 0) : items),
    [items, ocultarComprados]
  );

  const grupos = useMemo(
    () => agruparItemsPorCategoria(itemsVisibles),
    [itemsVisibles]
  );

  const pendientesCount = useMemo(
    () => items.filter((i) => i.comprado === 0).length,
    [items]
  );

  const handleToggleComprado = useCallback(
    async (item: ItemRow) => {
      if (!db) return;
      await alternarComprado(db, item.id);
      notifyDataChanged();
      await cargarDatos();
    },
    [db, notifyDataChanged, cargarDatos]
  );

  const handleDeleteItem = useCallback(
    async (item: ItemRow) => {
      if (!db) return;
      await eliminarProducto(db, item.id);
      setFeedback(`"${item.nombre}" eliminado.`);
      notifyDataChanged();
      await cargarDatos();
    },
    [db, notifyDataChanged, cargarDatos]
  );

  const handleMoveItem = useCallback(
    async (groupItems: ItemRow[], item: ItemRow, direction: -1 | 1) => {
      if (!db) return;
      const idx = groupItems.findIndex((i) => i.id === item.id);
      const targetIdx = idx + direction;
      if (idx < 0 || targetIdx < 0 || targetIdx >= groupItems.length) {
        return;
      }

      const reorderedGroup = [...groupItems];
      const [moved] = reorderedGroup.splice(idx, 1);
      reorderedGroup.splice(targetIdx, 0, moved);

      // Reconstruir orden global conservando otras categorías
      const groupIds = new Set(groupItems.map((g) => g.id));
      let cursor = 0;
      const newGlobalOrder = items.map((existing) => {
        if (!groupIds.has(existing.id)) {
          return existing.id;
        }
        const replacement = reorderedGroup[cursor];
        cursor += 1;
        return replacement.id;
      });

      await reordenarProductos(db, newGlobalOrder);
      notifyDataChanged();
      await cargarDatos();
    },
    [db, items, notifyDataChanged, cargarDatos]
  );

  const handleDuplicateList = useCallback(async () => {
    if (!db || !lista) return;
    await duplicarLista(db, lista.id, { activarComoActual: true });
    setFeedback('Lista duplicada con nuevos productos pendientes.');
    notifyDataChanged();
    await cargarDatos();
  }, [db, lista, notifyDataChanged, cargarDatos]);

  const handleCerrarLista = useCallback(async () => {
    if (!db || !lista) return;
    await cerrarListaActiva(db, lista.id);
    setOcultarComprados(false);
    setFeedback('Lista enviada al historial. Se creó una nueva lista vacía.');
    notifyDataChanged();
    await cargarDatos();
  }, [db, lista, notifyDataChanged, cargarDatos]);

  const handleCompartir = useCallback(async () => {
    if (!lista) return;
    const texto = listaComoTexto(lista, items);
    const status = await compartirTexto(texto, lista.nombre);
    if (status === 'copied') {
      setFeedback('Lista copiada al portapapeles (solo productos pendientes).');
    } else if (status === 'shared') {
      setFeedback('Lista compartida correctamente.');
    }
  }, [lista, items, compartirTexto]);

  const handleCopiar = useCallback(async () => {
    if (!lista) return;
    const texto = listaComoTexto(lista, items);
    const ok = await copiarTexto(texto);
    setFeedback(
      ok
        ? 'Texto de pendientes copiado al portapapeles.'
        : 'No se pudo copiar al portapapeles.'
    );
  }, [lista, items, copiarTexto]);

  const handleGenerateShareCode = useCallback(async () => {
    if (!db || !lista) return;
    const res = await generarCodigoCompartirApi(lista.remote_id);
    await guardarCodigoCompartirLocal(db, lista.id, res.codigo);
    notifyDataChanged();
    await cargarDatos();
  }, [db, lista, notifyDataChanged, cargarDatos]);

  const handleSaveCurrentSupermarket = useCallback(async () => {
    if (!db) return;
    try {
      const services = await Location.hasServicesEnabledAsync();
      if (!services) {
        Alert.alert(
          'Ubicación desactivada',
          'Activa el GPS para guardar tu supermercado actual.'
        );
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'Necesitamos permiso de ubicación para registrar las coordenadas del supermercado.'
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      await createSupermercado(
        db,
        `Supermercado #${supermercados.length + 1}`,
        pos.coords.latitude,
        pos.coords.longitude
      );
      setFeedback('Supermercado guardado para alertas de proximidad (< 300 m).');
      await cargarDatos();
    } catch {
      setFeedback('No se pudo guardar la ubicación del supermercado.');
    }
  }, [db, supermercados.length, cargarDatos]);

  if (dbError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorBanner}>{dbError}</Text>
      </View>
    );
  }

  if (!dbReady || (cargando && !lista)) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0F766E" />
        <Text style={styles.loadingText}>Preparando base de datos local...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {lista ? (
          <ListTitleHeader
            nombre={lista.nombre}
            pendientesCount={pendientesCount}
            totalCount={items.length}
            codigoCompartir={lista.codigo_compartir}
            onDuplicate={handleDuplicateList}
          />
        ) : null}

        <SupermarketProximityBanner
          estadoPermiso={proximity.estadoPermiso}
          resultado={proximity.resultado}
          cargando={proximity.cargando}
          error={proximity.error}
          supermercadosCount={supermercados.length}
          onActivateProximity={() => {
            void proximity.activarYVerificar();
          }}
          onSaveCurrentSupermarket={() => {
            void handleSaveCurrentSupermarket();
          }}
        />

        {feedback ? (
          <View style={styles.feedbackBar}>
            <Text style={styles.feedbackText}>{feedback}</Text>
            <Pressable
              onPress={() => setFeedback(null)}
              accessibilityRole="button"
              accessibilityLabel="Ocultar aviso"
            >
              <Text style={styles.feedbackDismiss}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        <TextInput
          value={busqueda}
          onChangeText={setBusqueda}
          placeholder="Buscar producto en la lista..."
          accessibilityLabel="Buscar producto en la lista activa"
          style={styles.searchInput}
        />

        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setOcultarComprados((prev) => !prev)}
            accessibilityRole="button"
            accessibilityLabel={
              ocultarComprados
                ? 'Mostrar productos comprados'
                : 'Ocultar productos comprados'
            }
            style={[
              styles.toolChip,
              ocultarComprados && styles.toolChipActive,
            ]}
          >
            <Text
              style={[
                styles.toolChipText,
                ocultarComprados && styles.toolChipTextActive,
              ]}
            >
              {ocultarComprados ? 'Mostrar comprados' : 'Ocultar comprados'}
              {shakeDisponible ? ' (o sacude)' : ''}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCompartir}
            accessibilityRole="button"
            accessibilityLabel="Compartir lista por WhatsApp o mensajería"
            style={styles.toolChip}
          >
            <Text style={styles.toolChipText}>Compartir</Text>
          </Pressable>

          <Pressable
            onPress={handleCopiar}
            accessibilityRole="button"
            accessibilityLabel="Copiar lista de pendientes al portapapeles"
            style={styles.toolChip}
          >
            <Text style={styles.toolChipText}>Copiar</Text>
          </Pressable>

          <Pressable
            onPress={() => setModalNubeVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Abrir opciones de cuenta, sincronización y código compartido"
            style={styles.toolChip}
          >
            <Text style={styles.toolChipText}>
              {autenticado ? 'Nube ✓' : 'Nube / Código'}
            </Text>
          </Pressable>
        </View>

        {grupos.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>
              {items.length === 0
                ? 'Tu lista está vacía'
                : 'No hay productos visibles con el filtro actual'}
            </Text>
            <Text style={styles.emptySubtitle}>
              Agrega productos por categoría. Desliza a la derecha para marcar comprado o a la izquierda para eliminar.
            </Text>
          </View>
        ) : (
          grupos.map((grupo) => (
            <View key={grupo.categoria} style={styles.categoryBlock}>
              <Text style={styles.categoryTitle}>
                {grupo.etiqueta} ({grupo.items.length})
              </Text>
              {grupo.items.map((item, idx) => (
                <SwipeableProductRow
                  key={item.id}
                  item={item}
                  canMoveUp={idx > 0}
                  canMoveDown={idx < grupo.items.length - 1}
                  onToggleComprado={(target) => {
                    void handleToggleComprado(target);
                  }}
                  onDelete={(target) => {
                    void handleDeleteItem(target);
                  }}
                  onMoveUp={(target) => {
                    void handleMoveItem(grupo.items, target, -1);
                  }}
                  onMoveDown={(target) => {
                    void handleMoveItem(grupo.items, target, 1);
                  }}
                />
              ))}
            </View>
          ))
        )}

        <View style={styles.footerActions}>
          <Pressable
            onPress={handleCerrarLista}
            accessibilityRole="button"
            accessibilityLabel="Cerrar lista actual y pasar al historial"
            style={styles.closeListBtn}
          >
            <Text style={styles.closeListBtnText}>
              Cerrar lista y crear nueva
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/producto/nuevo')}
        accessibilityRole="button"
        accessibilityLabel="Agregar nuevo producto a la lista"
        style={styles.fab}
      >
        <Text style={styles.fabText}>+ Producto</Text>
      </Pressable>

      <AuthSyncModal
        visible={modalNubeVisible}
        onClose={() => setModalNubeVisible(false)}
        onGenerateShareCode={handleGenerateShareCode}
        onOpenSharedCode={(codigo) => {
          router.push(`/lista/codigo-${codigo}`);
        }}
        codigoActual={lista?.codigo_compartir ?? null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: '#475569',
    fontSize: 15,
  },
  errorBanner: {
    color: '#B91C1C',
    fontSize: 15,
    fontWeight: '600',
  },
  feedbackBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#CCFBF1',
    borderColor: '#14B8A6',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  feedbackText: {
    flex: 1,
    color: '#115E59',
    fontSize: 13,
    fontWeight: '600',
  },
  feedbackDismiss: {
    color: '#115E59',
    fontWeight: '700',
    marginLeft: 8,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    marginBottom: 10,
  },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  toolChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  toolChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  toolChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  toolChipTextActive: {
    color: '#FFFFFF',
  },
  categoryBlock: {
    marginBottom: 16,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  footerActions: {
    marginTop: 12,
  },
  closeListBtn: {
    backgroundColor: '#1E293B',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  closeListBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    backgroundColor: '#0F766E',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    elevation: 4,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
