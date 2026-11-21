# Instrucciones de Proyecto para Claude — `08-lista-de-compras-app`

Lee y cumple íntegramente `AGENTS.md` y `.claude/settings.json`.

## Resumen Operativo

- **Stack:** Expo + React Native + TypeScript (`strict: true`) + Expo Router + `expo-sqlite` + `expo-secure-store` + `react-native-gesture-handler` + `react-native-reanimated`.
- **Restricciones duras (enforced por `.claude/settings.json`, `.aiignore` y `scripts/verify-ai-safety.mjs`):**
  - Prohibido leer `.env*`, `*.keystore`, `*.jks`, `*.pem`, `*.key`, `google-services.json`, `GoogleService-Info.plist`.
  - Prohibido salir de la carpeta del repositorio (`../*`).
  - Pedir permiso antes de `git push`, `eas build`, `eas submit` o peticiones externas.
  - Prohibido incluir `firebaseConfig`, SDK de Firebase, `AsyncStorage` para tokens, `http://localhost` en producción o variables `EXPO_PUBLIC_` distintas de `EXPO_PUBLIC_API_URL`.
- **Calidad y Accesibilidad:**
  - Todo SQL en `src/repositories/` usa parámetros `?`.
  - Todo gesto (`Gesture.Pan`, `Gesture.LongPress`, reordenamiento) tiene botón alternativo con `accessibilityLabel`.
  - Todo sensor llama a `isAvailableAsync()`, solicita permisos bajo demanda con explicación, limpia `subscription.remove()` y delega cálculos a funciones puras testeables.
- **Verificación automática obligatoria tras cada edición:**
  - `npm run verify:ai-safety`
  - `npm run typecheck`
  - `npm test`
