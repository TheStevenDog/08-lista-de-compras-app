import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export interface ListTitleHeaderProps {
  nombre: string;
  pendientesCount: number;
  totalCount: number;
  codigoCompartir: string | null;
  onDuplicate: () => void;
}

/**
 * Encabezado de lista con gesto `Gesture.LongPress` para duplicar la lista
 * y botón accesible explícito `accessibilityLabel` (Sección 4).
 */
export function ListTitleHeader({
  nombre,
  pendientesCount,
  totalCount,
  codigoCompartir,
  onDuplicate,
}: ListTitleHeaderProps) {
  const longPressGesture = useMemo(
    () =>
      Gesture.LongPress()
        .minDuration(450)
        .onStart(() => {
          runOnJS(onDuplicate)();
        }),
    [onDuplicate]
  );

  return (
    <View style={styles.container}>
      <GestureDetector gesture={longPressGesture}>
        <View
          style={styles.titleBox}
          accessible
          accessibilityHint="Mantén presionado para duplicar esta lista"
        >
          <Text style={styles.title}>{nombre}</Text>
          <Text style={styles.subtitle}>
            {pendientesCount} pendientes de {totalCount} productos
            {codigoCompartir ? ` · Código: ${codigoCompartir}` : ''}
          </Text>
          <Text style={styles.hint}>
            Mantén presionado el título para duplicar
          </Text>
        </View>
      </GestureDetector>

      <Pressable
        onPress={onDuplicate}
        accessibilityRole="button"
        accessibilityLabel="Duplicar lista actual"
        style={styles.duplicateButton}
      >
        <Text style={styles.duplicateButtonText}>Duplicar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0F766E',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  titleBox: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 13,
    color: '#CCFBF1',
    marginTop: 4,
  },
  hint: {
    fontSize: 11,
    color: '#99F6E4',
    marginTop: 4,
  },
  duplicateButton: {
    backgroundColor: '#115E59',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#5EEAD4',
  },
  duplicateButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
