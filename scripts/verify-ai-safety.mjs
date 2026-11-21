import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const REQUIRED_GOVERNANCE_FILES = [
  '.gitignore',
  '.aiignore',
  '.cursorignore',
  '.claude/settings.json',
  'AGENTS.md',
  'CLAUDE.md',
  '.cursorrules',
  'ia/bitacora-ia.md',
  'ia/evidencias-configuracion.md',
  'ia/verify-restrictions.test.ts',
];

const FORBIDDEN_SECRET_FILE_PATTERNS = [
  /^\.env$/i,
  /^\.env\.(?!example$).+/i,
  /\.keystore$/i,
  /\.jks$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.p8$/i,
  /^google-services\.json$/i,
  /^GoogleService-Info\.plist$/i,
  /firebase-adminsdk.*\.json$/i,
  /^service-account.*\.json$/i,
];

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.expo',
  'dist',
  'coverage',
  'web-build',
  'android',
  'ios',
]);

const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);

/**
 * Escanea el contenido de un archivo de código/configuración en busca de violaciones de seguridad.
 * @param {string} content
 * @param {string} relPath
 * @returns {Array<{ rule: string, file: string, message: string }>}
 */
export function scanSourceText(content, relPath) {
  const normalized = relPath.replace(/\\/g, '/');
  const violations = [];

  // Ignorar archivos de pruebas, este propio script y documentación de IA
  if (
    normalized === 'scripts/verify-ai-safety.mjs' ||
    normalized.startsWith('ia/') ||
    /(^|\/)__tests__\//.test(normalized) ||
    /\.(test|spec)\.[jt]sx?$/.test(normalized)
  ) {
    return violations;
  }

  if (/\bfirebaseConfig\b/.test(content)) {
    violations.push({
      rule: 'no-firebase-config',
      file: normalized,
      message: 'Se detectó `firebaseConfig` en la app móvil (prohibido por la Sección 2 y 9.1).',
    });
  }

  if (
    /from\s+['"](firebase|firebase\/|firebase-admin|@react-native-firebase)/.test(content) ||
    /require\(\s*['"](firebase|firebase\/|firebase-admin|@react-native-firebase)/.test(content) ||
    (normalized === 'package.json' && /"(firebase|firebase-admin|@react-native-firebase[^"]*)"\s*:/.test(content))
  ) {
    violations.push({
      rule: 'no-firebase-sdk',
      file: normalized,
      message: 'Se detectó dependencia o importación del SDK de Firebase en la app móvil.',
    });
  }

  if (
    /AsyncStorage\b/.test(content) ||
    /@react-native-async-storage\/async-storage/.test(content)
  ) {
    violations.push({
      rule: 'no-async-storage-tokens',
      file: normalized,
      message: 'Se detectó AsyncStorage; use exclusivamente expo-secure-store para tokens y SQLite para datos.',
    });
  }

  if (/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(content)) {
    violations.push({
      rule: 'no-private-key',
      file: normalized,
      message: 'Se detectó una clave privada embebida en el código.',
    });
  }

  if (/AIza[0-9A-Za-z_-]{35}/.test(content)) {
    violations.push({
      rule: 'no-google-api-key',
      file: normalized,
      message: 'Se detectó una posible clave de API de Google/Firebase embebida.',
    });
  }

  const expoPublicMatches = content.match(/\bEXPO_PUBLIC_[A-Z0-9_]+\b/g) ?? [];
  for (const envName of new Set(expoPublicMatches)) {
    if (envName !== 'EXPO_PUBLIC_API_URL') {
      violations.push({
        rule: 'only-allowed-expo-public-var',
        file: normalized,
        message: `Variable pública no autorizada: ${envName}. Solo se permite EXPO_PUBLIC_API_URL.`,
      });
    }
  }

  if (/https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(content)) {
    violations.push({
      rule: 'no-hardcoded-localhost',
      file: normalized,
      message: 'Se detectó una URL con localhost/127.0.0.1 hardcodeada; utilice HTTPS mediante EXPO_PUBLIC_API_URL.',
    });
  }

  if (
    normalized.startsWith('src/repositories/') &&
    /(runAsync|getAllAsync|getFirstAsync|execAsync)\s*\(\s*`[^`]*\$\{/.test(content)
  ) {
    violations.push({
      rule: 'sql-parameterized-only',
      file: normalized,
      message: 'Interpolación insegura en consulta SQLite detectada; use parámetros posicionales `?`.',
    });
  }

  return violations;
}

function walkFiles(dir, rootDir, collected = []) {
  if (!fs.existsSync(dir)) return collected;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      walkFiles(fullPath, rootDir, collected);
    } else if (entry.isFile()) {
      collected.push({ fullPath, relPath, name: entry.name });
    }
  }
  return collected;
}

function checkGovernanceFiles(rootDir) {
  const violations = [];

  for (const rel of REQUIRED_GOVERNANCE_FILES) {
    const full = path.join(rootDir, rel);
    if (!fs.existsSync(full)) {
      violations.push({
        rule: 'governance-file-missing',
        file: rel,
        message: `Falta el archivo obligatorio de gobernanza de IA: ${rel}`,
      });
    }
  }

  const gitignorePath = path.join(rootDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const requiredPatterns = ['.env', '*.keystore', '*.jks', '*.pem', 'google-services.json', 'GoogleService-Info.plist'];
    for (const pattern of requiredPatterns) {
      if (!content.includes(pattern)) {
        violations.push({
          rule: 'gitignore-missing-pattern',
          file: '.gitignore',
          message: `.gitignore debe bloquear el patrón de seguridad: ${pattern}`,
        });
      }
    }
  }

  for (const ignoreFile of ['.aiignore', '.cursorignore']) {
    const ignorePath = path.join(rootDir, ignoreFile);
    if (fs.existsSync(ignorePath)) {
      const content = fs.readFileSync(ignorePath, 'utf8');
      for (const pattern of ['.env', '*.keystore', '*.jks', '*.pem', '../*']) {
        if (!content.includes(pattern)) {
          violations.push({
            rule: 'aiignore-missing-pattern',
            file: ignoreFile,
            message: `${ignoreFile} debe incluir la restricción: ${pattern}`,
          });
        }
      }
    }
  }

  const claudeSettingsPath = path.join(rootDir, '.claude/settings.json');
  if (fs.existsSync(claudeSettingsPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(claudeSettingsPath, 'utf8'));
      const denyList = parsed?.permissions?.deny ?? [];
      const askList = parsed?.permissions?.ask ?? [];
      const denyJoined = denyList.join('\n');

      for (const requiredDeny of ['.env', '.keystore', '.jks', '.pem', '../*']) {
        if (!denyJoined.includes(requiredDeny)) {
          violations.push({
            rule: 'claude-settings-missing-deny',
            file: '.claude/settings.json',
            message: `.claude/settings.json debe declarar una regla deny para: ${requiredDeny}`,
          });
        }
      }

      if (!Array.isArray(askList) || askList.length === 0) {
        violations.push({
          rule: 'claude-settings-missing-ask',
          file: '.claude/settings.json',
          message: '.claude/settings.json debe requerir confirmación (ask) para acciones con efecto externo.',
        });
      }
    } catch (err) {
      violations.push({
        rule: 'claude-settings-invalid-json',
        file: '.claude/settings.json',
        message: `JSON inválido en .claude/settings.json: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  return violations;
}

/**
 * Ejecuta la auditoría completa de seguridad y reglas de IA sobre un directorio de repositorio.
 * @param {string} rootDir
 * @returns {{ ok: boolean, scannedFiles: number, violations: Array<{ rule: string, file: string, message: string }> }}
 */
export function auditRepository(rootDir) {
  const violations = [...checkGovernanceFiles(rootDir)];
  const allFiles = walkFiles(rootDir, rootDir);
  let scannedFiles = 0;

  for (const file of allFiles) {
    for (const pattern of FORBIDDEN_SECRET_FILE_PATTERNS) {
      if (pattern.test(file.name)) {
        violations.push({
          rule: 'forbidden-secret-file-present',
          file: file.relPath,
          message: `Archivo sensible prohibido detectado en el repositorio: ${file.relPath}`,
        });
      }
    }

    const ext = path.extname(file.name).toLowerCase();
    const shouldScan =
      file.relPath.startsWith('app/') ||
      file.relPath.startsWith('src/') ||
      file.relPath === 'package.json' ||
      file.relPath === 'app.json' ||
      file.relPath === '.env.example';

    if (shouldScan && (CODE_EXTENSIONS.has(ext) || file.relPath === '.env.example')) {
      scannedFiles += 1;
      const content = fs.readFileSync(file.fullPath, 'utf8');
      violations.push(...scanSourceText(content, file.relPath));
    }
  }

  return {
    ok: violations.length === 0,
    scannedFiles,
    violations,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  let rootDir = path.resolve(__dirname, '..');
  let jsonOutput = false;

  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--root' && args[i + 1]) {
      rootDir = path.resolve(args[i + 1]);
      i += 1;
    } else if (args[i] === '--json') {
      jsonOutput = true;
    }
  }

  const result = auditRepository(rootDir);

  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else if (result.ok) {
    console.log(
      `[OK] Auditoria de IA y seguridad superada (${result.scannedFiles} archivos de codigo/configuracion inspeccionados, 0 violaciones).`
    );
  } else {
    console.error(`[ERROR] Se detectaron ${result.violations.length} violaciones de seguridad/calidad:`);
    for (const v of result.violations) {
      console.error(`  - [${v.rule}] ${v.file}: ${v.message}`);
    }
  }

  process.exit(result.ok ? 0 : 1);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  runCli();
}
