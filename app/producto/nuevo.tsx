import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useAppContext } from '../../src/components/AppContext';
import type { CategoriaProducto } from '../../src/db/types';
import { CATEGORIAS, validarProductoInput } from '../../src/services/formatters';
import {
  agregarProducto,
  asegurarListaActiva,
  obtenerProductosFrecuentes,
  type ProductoFrecuente,
} from '../../src/services/listaService';

export default function NuevoProductoScreen() {
  const router = useRouter();
  const { db, notifyDataChanged } = useAppContext();

  const [nombre, setNombre] = useState('');
  const [cantidadTexto, setCantidadTexto] = useState('1');
  const [categoria, setCategoria] = useState<CategoriaProducto>('otros');
  const [sugerencias, setSugerencias] = useState<ProductoFrecuente[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let active = true;
    const cargarSugerencias = async () => {
      if (!db) return;
      const activa = await asegurarListaActiva(db);
      const frecuentes = await obtenerProductosFrecuentes(db, {
        limite: 8,
        excluirListaId: activa.id,
      });
      if (active) {
        setSugerencias(frecuentes);
      }
    };
    void cargarSugerencias();
    return () => {
      active = false;
    };
  }, [db]);

  const cantidadNumero = Number(cantidadTexto);

  const ajustarCantidad = (delta: number) => {
    const actual = Number.isInteger(cantidadNumero) ? cantidadNumero : 1;
    const siguiente = Math.max(1, Math.min(99, actual + delta));
    setCantidadTexto(String(siguiente));
  };

  const handleGuardar = async () => {
    if (!db) return;
    setError(null);

    const parsedQty = Number(cantidadTexto);
    const validacion = validarProductoInput(nombre, parsedQty);
    if (!validacion.valido) {
      setError(validacion.errores.join(' '));
      return;
    }

    setGuardando(true);
    try {
      const activa = await asegurarListaActiva(db);
      await agregarProducto(db, {
        listaId: activa.id,
        nombre,
        cantidad: parsedQty,
        categoria,
      });
      notifyDataChanged();
      router.back();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo guardar el producto.'
      );
    } finally {
      setGuardando(false);
    }
  };

  const handleUsarSugerencia = (sugerencia: ProductoFrecuente) => {
    setNombre(sugerencia.nombre);
    const matched = CATEGORIAS.find((c) => c.id === sugerencia.categoria);
    if (matched) {
      setCategoria(matched.id);
    }
    setError(null);
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.label}>Nombre del producto *</Text>
      <TextInput
        value={nombre}
        onChangeText={(text) => {
          setNombre(text);
          if (error) setError(null);
        }}
        placeholder="Ej. Leche, Pan, Manzanas..."
        accessibilityLabel="Nombre del producto"
        style={styles.input}
        autoFocus
      />
      <Text style={styles.helper}>
        Si el producto ya existe en la lista activa, se sumará su cantidad automáticamente.
      </Text>

      <Text style={styles.label}>Cantidad (1 a 99) *</Text>
      <View style={styles.qtyRow}>
        <Pressable
          onPress={() => ajustarCantidad(-1)}
          accessibilityRole="button"
          accessibilityLabel="Disminuir cantidad"
          style={styles.stepperBtn}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </Pressable>

        <TextInput
          value={cantidadTexto}
          onChangeText={setCantidadTexto}
          keyboardType="number-pad"
          maxLength={2}
          accessibilityLabel="Cantidad del producto"
          style={styles.qtyInput}
        />

        <Pressable
          onPress={() => ajustarCantidad(1)}
          accessibilityRole="button"
          accessibilityLabel="Aumentar cantidad"
          style={styles.stepperBtn}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Categoría / Pasillo</Text>
      <View style={styles.chipsWrap}>
        {CATEGORIAS.map((cat) => {
          const selected = categoria === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => setCategoria(cat.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`Seleccionar categoría ${cat.etiqueta}`}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                {cat.etiqueta}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {sugerencias.length > 0 ? (
        <View style={styles.suggestionsBlock}>
          <Text style={styles.label}>Productos frecuentes (sugeridos)</Text>
          <View style={styles.chipsWrap}>
            {sugerencias.map((sug) => (
              <Pressable
                key={sug.nombre}
                onPress={() => handleUsarSugerencia(sug)}
                accessibilityRole="button"
                accessibilityLabel={`Usar producto frecuente ${sug.nombre}`}
                style={styles.suggestionChip}
              >
                <Text style={styles.suggestionChipText}>
                  + {sug.nombre} ({sug.frecuencia})
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {error ? (
        <Text style={styles.errorText} accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <Pressable
        onPress={handleGuardar}
        disabled={guardando}
        accessibilityRole="button"
        accessibilityLabel="Guardar producto en la lista activa"
        style={styles.submitBtn}
      >
        <Text style={styles.submitBtnText}>
          {guardando ? 'Guardando...' : 'Agregar a la lista'}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#0F172A',
  },
  helper: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  qtyInput: {
    width: 72,
    textAlign: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 10,
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipSelected: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  suggestionsBlock: {
    marginTop: 8,
  },
  suggestionChip: {
    backgroundColor: '#CCFBF1',
    borderColor: '#14B8A6',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  suggestionChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#115E59',
  },
  errorText: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    padding: 12,
    borderRadius: 10,
    marginTop: 16,
    fontSize: 13,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: '#0F766E',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
