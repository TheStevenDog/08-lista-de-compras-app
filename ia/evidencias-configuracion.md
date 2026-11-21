# Evidencias de Configuración de IA — Guía de Demostración en Vivo

Este documento detalla cómo demostrar en vivo durante la sustentación que la configuración de IA del repositorio `08-lista-de-compras-app` cumple íntegramente con la Sección 14 de `08-lista-de-compras.md`.

## 1. Evidencia de Primer Commit Obligatorio

Ejecutar en la raíz del repositorio `08-lista-de-compras-app`:

```bash
git log --reverse --stat -n 1
```

**Resultado esperado:** El primer commit (`chore(ia): configuracion inicial de IA, reglas de seguridad y evidencias`) contiene exclusivamente la configuración de IA, las restricciones de seguridad, el auditor automático `scripts/verify-ai-safety.mjs` y la carpeta `ia/`, antes de cualquier archivo de código de la aplicación.

## 2. Demostración de Reglas del Proyecto para la IA

Mostrar los archivos versionados:
- `AGENTS.md`: reglas completas de arquitectura, stack, seguridad, gestos accesibles, sensores con `isAvailableAsync()` y comandos de verificación.
- `CLAUDE.md` y `.cursorrules`: instrucciones operativas equivalentes para distintos asistentes.

## 3. Demostración de Restricciones Técnicas de Seguridad

### 3.1 Bloqueo de lectura de `.env*`, keystores, claves y salida del repositorio
Inspeccionar:
- `.claude/settings.json` (`permissions.deny` bloquea `Read(.env*)`, `Read(*.keystore)`, `Read(*.jks)`, `Read(*.pem)`, `Read(../*)`, `Bash(cat .env*)`, etc.; `permissions.ask` exige permiso humano antes de `git push`, `eas build`, `eas submit`).
- `.aiignore` y `.cursorignore` (excluyen `.env*`, `*.keystore`, `*.jks`, `*.pem`, `google-services.json`, `GoogleService-Info.plist` y `../*`).
- `.gitignore` (impide versionar `.env*` excepto `.env.example`, keystores y certificados).

### 3.2 Prueba en vivo con el auditor de seguridad y calidad
Ejecutar:

```bash
npm run verify:ai-safety
```

**Resultado esperado:** `[OK] Auditoria de IA y seguridad superada (... 0 violaciones).`

### 3.3 Prueba en vivo de bloqueo automático (casos negativos)
Ejecutar la suite automatizada de pruebas de restricciones:

```bash
npx jest ia/verify-restrictions.test.ts
```

Esta prueba crea directorios temporales aislados e inyecta deliberadamente violaciones prohibidas para demostrar que el auditor las detecta y detiene la integración:
1. Presencia de un archivo `.env` o `release.keystore` en el repositorio.
2. Inyección de `firebaseConfig` o import de `firebase` en código de la app.
3. Uso de `AsyncStorage` para tokens en lugar de `expo-secure-store`.
4. Declaración de una variable `EXPO_PUBLIC_FIREBASE_KEY` distinta de `EXPO_PUBLIC_API_URL`.
5. URL `http://localhost:3000` hardcodeada en el código fuente.
6. Consulta SQLite con interpolación de string en `src/repositories/` en lugar de parámetros `?`.

## 4. Verificación Final de Calidad Completa

```bash
npm run verify:ai-safety
npm run typecheck
npm test
```

Todos los comandos deben finalizar con código de salida `0`.
