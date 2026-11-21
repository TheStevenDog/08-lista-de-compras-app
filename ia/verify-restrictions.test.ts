import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = path.resolve(__dirname, '..');
const SAFETY_SCRIPT = path.join(REPO_ROOT, 'scripts', 'verify-ai-safety.mjs');

interface AuditViolation {
  rule: string;
  file: string;
  message: string;
}

interface AuditResult {
  ok: boolean;
  scannedFiles: number;
  violations: AuditViolation[];
}

function runSafetyAudit(targetRoot: string): { exitCode: number; result: AuditResult } {
  try {
    const stdout = execFileSync(process.execPath, [SAFETY_SCRIPT, '--root', targetRoot, '--json'], {
      encoding: 'utf8',
    });
    return { exitCode: 0, result: JSON.parse(stdout) as AuditResult };
  } catch (error: unknown) {
    const err = error as { status?: number; stdout?: string };
    const stdout = err.stdout ?? '{}';
    return { exitCode: err.status ?? 1, result: JSON.parse(stdout) as AuditResult };
  }
}

function createTempRepoCopy(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-safety-test-'));
  const filesToCopy = [
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

  for (const rel of filesToCopy) {
    const src = path.join(REPO_ROOT, rel);
    const dest = path.join(tmpDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }

  return tmpDir;
}

describe('Restricciones de seguridad y gobernanza de IA (Sección 14)', () => {
  test('el repositorio actual pasa la auditoría de seguridad con 0 violaciones', () => {
    const { exitCode, result } = runSafetyAudit(REPO_ROOT);
    expect(exitCode).toBe(0);
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  test('.claude/settings.json deniega lectura de .env*, keystores, claves y salida de carpeta (../*)', () => {
    const raw = fs.readFileSync(path.join(REPO_ROOT, '.claude', 'settings.json'), 'utf8');
    const settings = JSON.parse(raw) as {
      permissions: { deny: string[]; ask: string[] };
    };

    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        'Read(.env)',
        'Read(.env.*)',
        'Read(*.keystore)',
        'Read(*.jks)',
        'Read(*.pem)',
        'Read(../*)',
        'Read(../**)',
      ])
    );
    expect(settings.permissions.ask.length).toBeGreaterThan(0);
  });

  test('.gitignore, .aiignore y .cursorignore bloquean secretos y keystores', () => {
    for (const fileName of ['.gitignore', '.aiignore', '.cursorignore']) {
      const content = fs.readFileSync(path.join(REPO_ROOT, fileName), 'utf8');
      expect(content).toContain('.env');
      expect(content).toContain('*.keystore');
      expect(content).toContain('*.jks');
      expect(content).toContain('*.pem');
    }
  });

  test('detecta y bloquea presencia de archivo .env o keystore en el repositorio', () => {
    const tmpDir = createTempRepoCopy();
    try {
      fs.writeFileSync(path.join(tmpDir, '.env'), 'SECRET=123\n', 'utf8');
      fs.writeFileSync(path.join(tmpDir, 'upload.keystore'), 'fake-keystore', 'utf8');

      const { exitCode, result } = runSafetyAudit(tmpDir);
      expect(exitCode).toBe(1);
      expect(result.ok).toBe(false);
      expect(result.violations.some((v) => v.rule === 'forbidden-secret-file-present' && v.file === '.env')).toBe(
        true
      );
      expect(
        result.violations.some((v) => v.rule === 'forbidden-secret-file-present' && v.file === 'upload.keystore')
      ).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('detecta firebaseConfig, AsyncStorage, EXPO_PUBLIC_ no autorizada, localhost y SQL inseguro', () => {
    const tmpDir = createTempRepoCopy();
    try {
      fs.mkdirSync(path.join(tmpDir, 'src', 'repositories'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'badCode.ts'),
        [
          'import AsyncStorage from "@react-native-async-storage/async-storage";',
          'export const firebaseConfig = { apiKey: "fake" };',
          'export const secret = process.env.EXPO_PUBLIC_SECRET_KEY;',
          'export const url = "http://localhost:3000";',
          'export const store = AsyncStorage;',
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(tmpDir, 'src', 'repositories', 'unsafeRepo.ts'),
        'export const bad = (db: any, id: string) => db.getAllAsync(`SELECT * FROM lista WHERE id = ${id}`);',
        'utf8'
      );

      const { exitCode, result } = runSafetyAudit(tmpDir);
      expect(exitCode).toBe(1);
      expect(result.ok).toBe(false);

      const rules = new Set(result.violations.map((v) => v.rule));
      expect(rules.has('no-firebase-config')).toBe(true);
      expect(rules.has('no-async-storage-tokens')).toBe(true);
      expect(rules.has('only-allowed-expo-public-var')).toBe(true);
      expect(rules.has('no-hardcoded-localhost')).toBe(true);
      expect(rules.has('sql-parameterized-only')).toBe(true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
