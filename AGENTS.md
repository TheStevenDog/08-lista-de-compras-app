# Reglas del Proyecto para Agentes de IA — `08-lista-de-compras-app`

## 1. Propósito y Stack Tecnológico

Aplicación móvil **offline-first** para gestionar listas de compras familiares por categorías, con tachado de productos, historial, duplicación, envío por WhatsApp/portapapeles y sincronización contra la API propia (`08-lista-de-compras-api`).

- **Framework:** Expo + React Native + TypeScript (`strict: true`)
- **Enrutamiento:** Expo Router (`app/`)
- **Base de datos local:** `expo-sqlite` (SQL 100% parametrizado con `?`)
- **Almacenamiento seguro:** `expo-secure-store` (exclusivo para `token` y `refreshToken`)
- **Gestos y animaciones:** `react-native-gesture-handler` + `react-native-reanimated`
- **Sensores / capacidades:** `expo-sharing`, `expo-clipboard`, `expo-sensors` (`Accelerometer`, `Barometer`), `expo-location`, `expo-camera`
- **Pruebas:** Jest + `jest-expo` + `@testing-library/react-native`

## 2. Estructura Obligatoria

```text
app/
├── _layout.tsx            # GestureHandlerRootView, proveedor de sesión y SQLite
├── (tabs)/
│   ├── _layout.tsx
│   ├── index.tsx          # Lista activa agrupada por categoría
│   └── historial.tsx      # Listas cerradas anteriores
├── producto/nuevo.tsx     # Alta rápida validada + sugerencias frecuentes
└── lista/[id].tsx         # Detalle de lista pasada o compartida por código
src/
├── db/                    # Apertura de SQLite y migraciones
├── repositories/          # Consultas SQL parametrizadas (?)
├── services/              # Reglas de negocio, formateadores y sincronización offline-first
├── api/                   # Cliente HTTP (fetch + Bearer + refresh único + errores)
├── sensors/               # Funciones puras separadas + hooks seguros con mocks
└── components/            # UI reutilizable, gestos y accesibilidad
scripts/
└── verify-ai-safety.mjs   # Auditoría automática de seguridad y calidad
ia/
├── bitacora-ia.md
├── evidencias-configuracion.md
└── verify-restrictions.test.ts
```

## 3. Reglas Estrictas de Seguridad (OBLIGATORIAS)

1. **Cero credenciales ni Firebase en la app móvil:**
   - **PROHIBIDO** incluir `firebaseConfig`, `firebase`, `firebase-admin`, `@react-native-firebase`, claves de API o secretos en cualquier archivo de la app.
   - Toda comunicación con Firebase ocurre únicamente en el servidor (`08-lista-de-compras-api` en Vercel).
2. **Variables de entorno públicas:**
   - La **única** variable `EXPO_PUBLIC_*` permitida es `EXPO_PUBLIC_API_URL`.
   - Toda variable `EXPO_PUBLIC_*` queda embebida en texto plano dentro del APK.
3. **Tokens de sesión:**
   - Guardar `token` y `refreshToken` **exclusivamente** en `expo-secure-store`.
   - **PROHIBIDO** usar `AsyncStorage` o SQLite para tokens de autenticación.
4. **Transporte seguro:**
   - Usar HTTPS por defecto en `EXPO_PUBLIC_API_URL`.
   - **PROHIBIDO** dejar `http://localhost` o `http://127.0.0.1` hardcodeado en el código de producción o en el APK.
5. **Restricciones de acceso para la IA:**
   - **NUNCA** leer ni modificar `.env`, `.env.*`, `*.keystore`, `*.jks`, `*.pem`, `*.key`, `google-services.json`, `GoogleService-Info.plist` ni archivos fuera de la carpeta del repositorio (`../`).
   - Pedir confirmación explícita antes de acciones con efecto externo (`git push`, `eas build`, despliegues).
6. **SQL parametrizado:**
   - Todas las consultas SQLite en `src/repositories/` deben usar marcadores `?`. Prohibido interpolar entradas del usuario en strings SQL.

## 4. Reglas de Gestos, Accesibilidad y Sensores

- **Gestos:** Implementar con `react-native-gesture-handler` (`Gesture.Pan`, `Gesture.LongPress`) y `react-native-reanimated`.
- **Accesibilidad obligatoria:** Cada acción ejecutada mediante gesto (marcar comprado, eliminar, duplicar lista, reordenar) **DEBE** tener un botón alternativo visible o accesible con `accessibilityLabel` explícito.
- **Sensores:**
  1. Llamar siempre a `isAvailableAsync()` antes de usar cualquier sensor o API de compartir.
  2. Pedir permisos únicamente bajo demanda, explicando al usuario para qué se necesitan.
  3. Cancelar suscripciones (`subscription.remove()`) al desmontar el componente/pantalla.
  4. Separar la lógica en **funciones puras** (`detectarSacudida`, `calcularDistanciaMetros`, `estaCercaDeSupermercado`) para pruebas unitarias con mocks.
  5. La aplicación nunca debe fallar si el sensor o permiso no está disponible.

## 5. Reglas de Negocio y Criterios de Aceptación

- Nombre de producto obligatorio; cantidad entera en rango `1..99`.
- **Criterio 1:** Si se agrega un producto ya existente en la misma lista (insensible a mayúsculas/espacios, ej. «Leche»), no se duplica; suma su cantidad (respetando máximo 99 o validación).
- **Criterio 2:** Al cerrar la lista activa, pasa al historial (`cerrada = 1`) y se crea automáticamente una nueva lista activa vacía.
- **Criterio 3:** `listaComoTexto(lista, items)` agrupa por categoría y exporta **únicamente los productos no comprados**.
- Duplicar una lista anterior genera nuevos IDs locales y nuevos `remote_id` (UUID v4) para la lista y sus ítems.

## 6. Comandos de Verificación

Antes de concluir cualquier cambio (humano o generado por IA), ejecutar y validar:

```bash
npm run verify:ai-safety
npm run typecheck
npm test
```
