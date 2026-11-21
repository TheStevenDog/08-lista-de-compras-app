import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import type { ItemRow } from '../db/types';

export interface SwipeableProductRowProps {
  item: ItemRow;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onToggleComprado: (item: ItemRow) => void;
  onDelete: (item: ItemRow) => void;
  onMoveUp: (item: ItemRow) => void;
  onMoveDown: (item: ItemRow) => void;
}

const SWIPE_THRESHOLD = 72;

/**
 * Fila de producto con gestos (deslizar derecha = marcar comprado, deslizar izquierda = eliminar)
 * y botones alternativos explícitos con `accessibilityLabel` para cada acción (Sección 4).
 */
export function SwipeableProductRow({
  item,
  canMoveUp,
  canMoveDown,
  onToggleComprado,
  onDelete,
  onMoveUp,
  onMoveDown,
}: SwipeableProductRowProps) {
  const translateX = useSharedValue(0);
  const comprado = item.comprado === 1;

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-16, 16])
        .failOffsetY([-12, 12])
        .onUpdate((event) => {
          translateX.value = Math.max(-110, Math.min(110, event.translationX));
        })
        .onEnd((event) => {
          if (event.translationX >= SWIPE_THRESHOLD) {
            runOnJS(onToggleComprado)(item);
          } else if (event.translationX <= -SWIPE_THRESHOLD) {
            runOnJS(onDelete)(item);
          }
          translateX.value = withSpring(0);
        }),
    [item, onDelete, onToggleComprado, translateX]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View style={styles.wrapper}>
      <View style={styles.backdrop} accessible={false}>
        <Text style={styles.backdropLeft}>✓ Comprado</Text>
        <Text style={styles.backdropRight}>Eliminar ✕</Text>
      </View>

      <GestureDetector gesture={panGesture}>
        <Animated.View style={[styles.row, comprado && styles.rowComprado, animatedStyle]}>
          <Pressable
            onPress={() => onToggleComprado(item)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: comprado }}
            accessibilityLabel={
              comprado
                ? `Desmarcar ${item.nombre} como comprado`
                : `Marcar ${item.nombre} como comprado`
            }
            style={[styles.checkbox, comprado && styles.checkboxChecked]}
          >
            <Text style={styles.checkboxText}>{comprado ? '✓' : ''}</Text>
          </Pressable>

          <View style={styles.info}>
            <Text style={[styles.nombre, comprado && styles.nombreTachado]}>
              {item.nombre}
            </Text>
            <Text style={styles.cantidad}>Cantidad: {item.cantidad}</Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={() => onMoveUp(item)}
              disabled={!canMoveUp}
              accessibilityRole="button"
              accessibilityLabel={`Subir ${item.nombre} en el orden del pasillo`}
              style={[styles.iconButton, !canMoveUp && styles.iconButtonDisabled]}
            >
              <Text style={styles.iconButtonText}>↑</Text>
            </Pressable>

            <Pressable
              onPress={() => onMoveDown(item)}
              disabled={!canMoveDown}
              accessibilityRole="button"
              accessibilityLabel={`Bajar ${item.nombre} en el orden del pasillo`}
              style={[styles.iconButton, !canMoveDown && styles.iconButtonDisabled]}
            >
              <Text style={styles.iconButtonText}>↓</Text>
            </Pressable>

            <Pressable
              onPress={() => onDelete(item)}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar ${item.nombre} de la lista`}
              style={[styles.iconButton, styles.deleteButton]}
            >
              <Text style={styles.deleteButtonText}>✕</Text>
            </Pressable>
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#E2E8F0',
  },
  backdropLeft: {
    color: '#15803D',
    fontWeight: '700',
    fontSize: 13,
  },
  backdropRight: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowComprado: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0F766E',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#0F766E',
  },
  checkboxText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  info: {
    flex: 1,
  },
  nombre: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
  },
  nombreTachado: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  cantidad: {
    fontSize: 13,
    color: '#475569',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.35,
  },
  iconButtonText: {
    color: '#334155',
    fontWeight: '700',
    fontSize: 14,
  },
  deleteButton: {
    backgroundColor: '#FEE2E2',
  },
  deleteButtonText: {
    color: '#B91C1C',
    fontWeight: '700',
    fontSize: 14,
  },
});
