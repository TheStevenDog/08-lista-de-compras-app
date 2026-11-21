import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ResultadoProximidad } from '../sensors/sensorLogic';
import type { EstadoPermisoUbicacion } from '../sensors/useSupermarketProximity';

export interface SupermarketProximityBannerProps {
  estadoPermiso: EstadoPermisoUbicacion;
  resultado: ResultadoProximidad | null;
  cargando: boolean;
  error: string | null;
  supermercadosCount: number;
  onActivateProximity: () => void;
  onSaveCurrentSupermarket: () => void;
}

export function SupermarketProximityBanner({
  estadoPermiso,
  resultado,
  cargando,
  error,
  supermercadosCount,
  onActivateProximity,
  onSaveCurrentSupermarket,
}: SupermarketProximityBannerProps) {
  if (resultado?.cerca && resultado.supermercado) {
    return (
      <View
        style={styles.alertBanner}
        accessibilityRole="alert"
        accessibilityLabel={`Estás cerca de ${resultado.supermercado.nombre} a ${resultado.distanciaMetros} metros`}
      >
        <Text style={styles.alertTitle}>
          ¡Estás cerca de {resultado.supermercado.nombre}!
        </Text>
        <Text style={styles.alertBody}>
          A solo {resultado.distanciaMetros} m (menos de 300 m). Aprovecha para tachar tus compras.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.textBlock}>
        <Text style={styles.cardTitle}>Aviso de supermercado cercano (&lt; 300 m)</Text>
        <Text style={styles.cardDescription}>
          {estadoPermiso === 'sin_solicitar'
            ? 'Activa tu ubicación bajo demanda para avisarte al acercarte a un supermercado guardado.'
            : estadoPermiso === 'concedido'
              ? supermercadosCount === 0
                ? 'Permiso activo. Guarda un supermercado para recibir avisos al acercarte.'
                : resultado?.supermercado
                  ? `Supermercado más cercano: ${resultado.supermercado.nombre} (${resultado.distanciaMetros} m).`
                  : 'Ubicación activa. Verificando cercanía...'
              : error ?? 'La ubicación no está disponible. La app funciona normal sin avisos.'}
        </Text>
      </View>

      <View style={styles.buttons}>
        <Pressable
          onPress={onActivateProximity}
          disabled={cargando}
          accessibilityRole="button"
          accessibilityLabel="Verificar si estoy cerca de un supermercado"
          style={styles.btnPrimary}
        >
          <Text style={styles.btnPrimaryText}>
            {cargando ? 'Ubicando...' : 'Revisar GPS'}
          </Text>
        </Pressable>

        <Pressable
          onPress={onSaveCurrentSupermarket}
          accessibilityRole="button"
          accessibilityLabel="Guardar supermercado frecuente"
          style={styles.btnSecondary}
        >
          <Text style={styles.btnSecondaryText}>+ Supermercado</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  alertBanner: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  alertTitle: {
    color: '#92400E',
    fontWeight: '700',
    fontSize: 15,
  },
  alertBody: {
    color: '#78350F',
    fontSize: 13,
    marginTop: 4,
  },
  card: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  textBlock: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardDescription: {
    fontSize: 12,
    color: '#475569',
    marginTop: 2,
  },
  buttons: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPrimary: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnSecondaryText: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '600',
  },
});
