import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ApiError } from '../api/httpClient';
import { useAppContext } from './AppContext';

export interface AuthSyncModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerateShareCode: () => Promise<void>;
  onOpenSharedCode: (codigo: string) => void;
  codigoActual: string | null;
}

export function AuthSyncModal({
  visible,
  onClose,
  onGenerateShareCode,
  onOpenSharedCode,
  codigoActual,
}: AuthSyncModalProps) {
  const {
    usuario,
    autenticado,
    sincronizando,
    ultimaSincronizacion,
    login,
    register,
    logout,
    syncNow,
  } = useAppContext();

  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [codigoInput, setCodigoInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async () => {
    setError(null);
    setMensaje(null);
    if (!email.trim() || password.length < 8) {
      setError('Ingresa un correo válido y una contraseña de al menos 8 caracteres.');
      return;
    }

    setCargando(true);
    try {
      if (modo === 'login') {
        await login(email, password);
        setMensaje('Sesión iniciada con éxito.');
      } else {
        await register(email, password);
        setMensaje('Cuenta creada y sesión iniciada.');
      }
      setPassword('');
    } catch (err) {
      setError(
        err instanceof ApiError || err instanceof Error
          ? err.message
          : 'No se pudo autenticar.'
      );
    } finally {
      setCargando(false);
    }
  };

  const handleSync = async () => {
    setError(null);
    setMensaje(null);
    try {
      const res = await syncNow();
      setMensaje(
        `Sincronización completa: ↑${res.pushedListas} listas / ${res.pushedItems} ítems, ↓${res.pulledListas} listas / ${res.pulledItems} ítems.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Error al sincronizar con el servidor.'
      );
    }
  };

  const handleShareCode = async () => {
    setError(null);
    setMensaje(null);
    setCargando(true);
    try {
      await onGenerateShareCode();
      setMensaje('Código de 6 caracteres generado.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'No se pudo generar el código compartido.'
      );
    } finally {
      setCargando(false);
    }
  };

  const handleOpenCode = () => {
    const clean = codigoInput.trim().toUpperCase();
    if (clean.length !== 6) {
      setError('El código compartido debe tener exactamente 6 caracteres.');
      return;
    }
    setError(null);
    onClose();
    onOpenSharedCode(clean);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.header}>
              <Text style={styles.title}>Nube, Cuenta y Código Familiar</Text>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Cerrar ventana de sincronización"
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>✕</Text>
              </Pressable>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {mensaje ? <Text style={styles.successText}>{mensaje}</Text> : null}

            {autenticado && usuario ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Sesión activa</Text>
                <Text style={styles.metaText}>Cuenta: {usuario.email}</Text>
                {ultimaSincronizacion ? (
                  <Text style={styles.metaText}>
                    Última sincronización: {ultimaSincronizacion}
                  </Text>
                ) : null}

                <View style={styles.rowButtons}>
                  <Pressable
                    onPress={handleSync}
                    disabled={sincronizando}
                    accessibilityRole="button"
                    accessibilityLabel="Sincronizar listas con la nube"
                    style={styles.primaryBtn}
                  >
                    <Text style={styles.primaryBtnText}>
                      {sincronizando ? 'Sincronizando...' : 'Sincronizar ahora'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={handleShareCode}
                    disabled={cargando}
                    accessibilityRole="button"
                    accessibilityLabel="Generar código de 6 caracteres para compartir"
                    style={styles.secondaryBtn}
                  >
                    <Text style={styles.secondaryBtnText}>
                      {codigoActual ? `Código: ${codigoActual}` : 'Generar código'}
                    </Text>
                  </Pressable>
                </View>

                <Pressable
                  onPress={logout}
                  accessibilityRole="button"
                  accessibilityLabel="Cerrar sesión"
                  style={styles.dangerBtn}
                >
                  <Text style={styles.dangerBtnText}>Cerrar sesión</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.section}>
                <View style={styles.tabs}>
                  <Pressable
                    onPress={() => setModo('login')}
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar a iniciar sesión"
                    style={[styles.tab, modo === 'login' && styles.tabActive]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        modo === 'login' && styles.tabTextActive,
                      ]}
                    >
                      Iniciar sesión
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setModo('registro')}
                    accessibilityRole="button"
                    accessibilityLabel="Cambiar a crear cuenta"
                    style={[styles.tab, modo === 'registro' && styles.tabActive]}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        modo === 'registro' && styles.tabTextActive,
                      ]}
                    >
                      Registrarse
                    </Text>
                  </Pressable>
                </View>

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="correo@familia.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  accessibilityLabel="Correo electrónico"
                  style={styles.input}
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Contraseña (mínimo 8 caracteres)"
                  secureTextEntry
                  accessibilityLabel="Contraseña"
                  style={styles.input}
                />

                <Pressable
                  onPress={handleAuth}
                  disabled={cargando}
                  accessibilityRole="button"
                  accessibilityLabel={
                    modo === 'login' ? 'Entrar a mi cuenta' : 'Crear cuenta nueva'
                  }
                  style={styles.primaryBtn}
                >
                  <Text style={styles.primaryBtnText}>
                    {cargando
                      ? 'Procesando...'
                      : modo === 'login'
                        ? 'Iniciar sesión'
                        : 'Crear cuenta'}
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Abrir lista compartida por código</Text>
              <Text style={styles.metaText}>
                Ingresa el código de 6 caracteres para ver y tachar productos de otra persona.
              </Text>
              <TextInput
                value={codigoInput}
                onChangeText={setCodigoInput}
                placeholder="Ej: ABC123"
                maxLength={6}
                autoCapitalize="characters"
                accessibilityLabel="Código de lista compartida de 6 caracteres"
                style={styles.input}
              />
              <Pressable
                onPress={handleOpenCode}
                accessibilityRole="button"
                accessibilityLabel="Abrir lista con código compartido"
                style={styles.secondaryBtn}
              >
                <Text style={styles.secondaryBtnText}>Ver lista compartida</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '88%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontWeight: '700',
    color: '#334155',
  },
  section: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 6,
  },
  metaText: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 8,
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#0F766E',
  },
  tabText: {
    color: '#334155',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 15,
    color: '#0F172A',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#0F766E',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: '#0F172A',
    fontWeight: '700',
  },
  dangerBtn: {
    marginTop: 4,
    backgroundColor: '#FEE2E2',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  errorText: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    fontSize: 13,
  },
  successText: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
    fontSize: 13,
  },
});
