import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useAppContext } from '../../src/components/AppContext';
import type { ListaRow } from '../../src/db/types';
import { getItemsByListaId } from '../../src/repositories/itemRepository';
import {
  duplicarLista,
  obtenerHistorial,
} from '../../src/services/listaService';

interface ListaResumen {
  lista: ListaRow;
  totalItems: number;
  comprados: number;
}

export default function HistorialScreen() {
  const router = useRouter();
  const { db, dbReady, dataVersion, notifyDataChanged } = useAppContext();

  const [listas, setListas] = useState<ListaResumen[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargarHistorial = useCallback(async () => {
    if (!db) return;
    setCargando(true);
    try {
      const cerradas = await obtenerHistorial(db);
      const resumenes = await Promise.all(
        cerradas.map(async (lista) => {
          const items = await getItemsByListaId(db, lista.id);
          return {
            lista,
            totalItems: items.length,
            comprados: items.filter((i) => i.comprado === 1).length,
          };
        })
      );
      setListas(resumenes);
    } finally {
      setCargando(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      if (dbReady && db) {
        void cargarHistorial();
      }
    }, [dbReady, db, cargarHistorial, dataVersion])
  );

  const handleDuplicar = async (listaId: number) => {
    if (!db) return;
    await duplicarLista(db, listaId, { activarComoActual: true });
    notifyDataChanged();
    router.replace('/');
  };

  if (!dbReady || cargando) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {listas.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Aún no tienes listas cerradas</Text>
          <Text style={styles.emptySubtitle}>
            Cuando cierres tu lista activa aparecerá aquí para consultarla o duplicarla en cualquier momento.
          </Text>
        </View>
      ) : (
        listas.map(({ lista, totalItems, comprados }) => (
          <View key={lista.id} style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.cardTitle}>{lista.nombre}</Text>
              <Text style={styles.cardMeta}>
                {comprados}/{totalItems} comprados · {lista.creada_en.slice(0, 10)}
              </Text>
              {lista.codigo_compartir ? (
                <Text style={styles.codeBadge}>
                  Código: {lista.codigo_compartir}
                </Text>
              ) : null}
            </View>

            <View style={styles.cardActions}>
              <Pressable
                onPress={() => router.push(`/lista/${lista.id}`)}
                accessibilityRole="button"
                accessibilityLabel={`Ver detalle de ${lista.nombre}`}
                style={styles.detailBtn}
              >
                <Text style={styles.detailBtnText}>Ver</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  void handleDuplicar(lista.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Duplicar lista ${lista.nombre} como nueva lista activa`}
                style={styles.duplicateBtn}
              >
                <Text style={styles.duplicateBtnText}>Duplicar</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
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
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 6,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardMeta: {
    fontSize: 13,
    color: '#475569',
    marginTop: 4,
  },
  codeBadge: {
    fontSize: 12,
    color: '#0F766E',
    fontWeight: '600',
    marginTop: 4,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  detailBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  detailBtnText: {
    color: '#0F172A',
    fontWeight: '700',
    fontSize: 13,
  },
  duplicateBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  duplicateBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
