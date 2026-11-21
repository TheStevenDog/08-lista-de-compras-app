# 08 · Lista de compras compartible (`08-lista-de-compras-app`)

Aplicación móvil **offline-first** en Expo + React Native + TypeScript + Expo Router para gestionar listas de compras familiares por categorías, con tachado de productos, historial, duplicación, envío por WhatsApp/portapapeles, gestos accesibles, sensores del dispositivo y sincronización contra `08-lista-de-compras-api`.

## Arquitectura y Seguridad

- **SQLite local (`expo-sqlite`):** tablas `lista`, `item`, `sync_meta` y `supermercado` con consultas 100% parametrizadas (`?`) y soporte offline-first (`remote_id`, `updated_at`, `deleted`, `pending`).
- **Cero secretos ni Firebase en la app:** no existe `firebaseConfig` ni ningún SDK de Firebase en el repositorio móvil. La única variable pública admitida es `EXPO_PUBLIC_API_URL` (HTTPS).
- **Tokens seguros:** `token` y `refreshToken` se guardan exclusivamente en `expo-secure-store`, con renovación automática única ante `401` mediante `POST /api/auth/refresh`.
- **Gestos accesibles (`react-native-gesture-handler` + `react-native-reanimated`):**
  - Deslizar a la derecha → marcar comprado (alternativa: botón checkbox con `accessibilityLabel`).
  - Deslizar a la izquierda → eliminar producto (alternativa: botón eliminar con `accessibilityLabel`).
  - Pulsación larga en el título → duplicar lista (alternativa: botón «Duplicar» con `accessibilityLabel`).
  - Reordenar según el pasillo (botones accesibles subir/bajar por categoría).
- **Sensores y capacidades del dispositivo:**
  - `expo-sharing` / `Share` + `expo-clipboard` (envío de solo pendientes agrupados por categoría).
  - `Accelerometer` (`expo-sensors`) para sacudir y ocultar comprados (con `isAvailableAsync()`, `subscription.remove()` y botón alternativo).
  - `expo-location` con permiso bajo demanda explicado al usuario para avisar si estás a menos de 300 m de un supermercado guardado.
- **Reto opcional:** detección y sugerencia de productos frecuentes del historial en la pantalla de alta rápida.

## Puesta en marcha

```bash
npm install
cp .env.example .env
# Ajustar EXPO_PUBLIC_API_URL con la URL HTTPS desplegada en Vercel
npm start
```

## Verificación, pruebas y auditoría de IA

```bash
# 1. Auditoría automatizada de seguridad y gobernanza de IA (Sección 14)
npm run verify:ai-safety

# 2. Verificación estricta de TypeScript
npm run typecheck

# 3. Pruebas unitarias y de integración (Jest + jest-expo + React Native Testing Library)
npm test
```

## Generación de APK con EAS Build

```bash
npx eas-cli build --platform android --profile preview
```

El perfil `preview` definido en `eas.json` genera directamente un `.apk` instalable apuntando por HTTPS a la API desplegada.

## Gobernanza de IA (Sección 14)

- Commit #1 dedicado exclusivamente a reglas de IA, restricciones técnicas (`.gitignore`, `.aiignore`, `.cursorignore`, `.claude/settings.json`), `scripts/verify-ai-safety.mjs` y carpeta `ia/`.
- Ver bitácora en `ia/bitacora-ia.md`, guía de demostración en vivo en `ia/evidencias-configuracion.md` y pruebas ejecutables en `ia/verify-restrictions.test.ts`.
