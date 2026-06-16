import * as p from '@clack/prompts';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const ENVIRONMENTS = {
  development: {
    projectId: 'ecommerce-vertex-dev',
    alias: 'development',
    siteUrl: 'https://ecommerce-vertex-dev.web.app',
    functionsUrl: 'https://us-central1-ecommerce-vertex-dev.cloudfunctions.net',
    emulatorUrl: 'http://127.0.0.1:5001/ecommerce-vertex-dev/us-central1',
    production: false,
    mpKeyPrefix: 'TEST-',
  },
  production: {
    projectId: 'ecommerce-vertex',
    alias: 'production',
    siteUrl: 'https://ecommerce-vertex.web.app',
    functionsUrl: 'https://us-central1-ecommerce-vertex.cloudfunctions.net',
    emulatorUrl: 'http://127.0.0.1:5001/ecommerce-vertex/us-central1',
    production: true,
    mpKeyPrefix: 'APP_USR-',
  },
} as const;

type EnvKey = keyof typeof ENVIRONMENTS;

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

interface MpCredentials {
  publicKey: string;
  accessToken: string;
}

const onCancel = (): void => {
  p.cancel('Setup cancelado.');
  process.exit(0);
};

// ─── Firebase CLI helpers ────────────────────────────────────────────────────

function checkFirebaseCli(): boolean {
  try {
    execSync('firebase --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function checkFirebaseAuth(): boolean {
  try {
    const out = execSync('firebase projects:list --json', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 10_000,
    });
    return (JSON.parse(out) as { status: string }).status === 'success';
  } catch {
    return false;
  }
}

function fetchFirebaseConfig(alias: string): FirebaseConfig | null {
  try {
    const appsOut = execSync(`firebase apps:list --project ${alias} --json`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 15_000,
    });
    const webApp = (
      (JSON.parse(appsOut) as { result: Array<{ platform: string; appId: string }> }).result ?? []
    ).find((a) => a.platform === 'WEB');
    if (!webApp) return null;

    const sdkOut = execSync(`firebase apps:sdkconfig web ${webApp.appId} --project ${alias}`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
      timeout: 15_000,
    });
    const match = sdkOut.match(/\{[\s\S]*\}/);
    return match ? (JSON.parse(match[0]) as FirebaseConfig) : null;
  } catch {
    return null;
  }
}

// ─── Status helpers ──────────────────────────────────────────────────────────

function readCurrentProjectId(filePath: string): string | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const match = raw.match(/"?projectId"?\s*[=:]\s*["']?([^"',\s}]+)["']?/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function readFunctionsEnvProject(filePath: string): string | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const match = raw.match(/SITE_URL=https?:\/\/[^.]+\.([^.]+)\./);
    return match ? raw.match(/SITE_URL=https?:\/\/([^/\n]+)/)?.[1] ?? null : null;
  } catch {
    return null;
  }
}

function showCurrentStatus(): void {
  const files = [
    { label: 'src/firebase-config.json', path: resolve(ROOT, 'src/firebase-config.json'), reader: readCurrentProjectId },
    { label: 'src/environments/environment.ts', path: resolve(ROOT, 'src/environments/environment.ts'), reader: readCurrentProjectId },
    { label: 'functions/.env.ecommerce-vertex-dev', path: resolve(ROOT, 'functions/.env.ecommerce-vertex-dev'), reader: readFunctionsEnvProject },
    { label: 'functions/.env.ecommerce-vertex', path: resolve(ROOT, 'functions/.env.ecommerce-vertex'), reader: readFunctionsEnvProject },
    { label: 'functions/.env.local', path: resolve(ROOT, 'functions/.env.local'), reader: readFunctionsEnvProject },
  ];

  const lines = files.map(({ label, path, reader }) => {
    if (!existsSync(path)) return `  ✗  ${label}`;
    const project = reader(path);
    return `  ✔  ${label}${project ? `  →  ${project}` : ''}`;
  });

  p.note(lines.join('\n'), 'Estado actual');
}

// ─── Manual prompts ──────────────────────────────────────────────────────────

async function promptFirebaseConfigManually(projectId: string): Promise<FirebaseConfig> {
  p.note(
    `Firebase Console → proyecto "${projectId}" → ⚙ Configuración → Tus apps → SDK config`,
    'Ingresá las credenciales manualmente'
  );
  const cfg = await p.group(
    {
      apiKey: () => p.text({ message: 'apiKey', validate: (v) => (v.trim() ? undefined : 'Requerido') }),
      authDomain: () => p.text({ message: 'authDomain', placeholder: `${projectId}.firebaseapp.com`, defaultValue: `${projectId}.firebaseapp.com` }),
      storageBucket: () => p.text({ message: 'storageBucket', placeholder: `${projectId}.firebasestorage.app`, defaultValue: `${projectId}.firebasestorage.app` }),
      messagingSenderId: () => p.text({ message: 'messagingSenderId', validate: (v) => (v.trim() ? undefined : 'Requerido') }),
      appId: () => p.text({ message: 'appId', validate: (v) => (v.trim() ? undefined : 'Requerido') }),
      measurementId: () => p.text({ message: 'measurementId (opcional)', defaultValue: '' }),
    },
    { onCancel }
  );
  return {
    apiKey: cfg.apiKey,
    authDomain: cfg.authDomain,
    projectId,
    storageBucket: cfg.storageBucket,
    messagingSenderId: cfg.messagingSenderId,
    appId: cfg.appId,
    ...(cfg.measurementId ? { measurementId: cfg.measurementId } : {}),
  };
}

async function promptMpCredentials(env: (typeof ENVIRONMENTS)[EnvKey]): Promise<MpCredentials> {
  const isProd = env.production;
  p.note(
    `https://www.mercadopago.com/developers/panel/credentials\n\nUsá credenciales ${isProd ? 'productivas' : 'de prueba (TEST-)'}.`,
    'MercadoPago'
  );
  const creds = await p.group(
    {
      publicKey: () =>
        p.text({
          message: `Public Key (${isProd ? 'productiva' : 'TEST-'})`,
          placeholder: `${env.mpKeyPrefix}...`,
          validate: (v) => (v.trim() ? undefined : 'Requerido'),
        }),
      accessToken: () =>
        p.text({
          message: `Access Token (${isProd ? 'productivo' : 'TEST-'})`,
          placeholder: `${env.mpKeyPrefix}...`,
          validate: (v) => (v.trim() ? undefined : 'Requerido'),
        }),
    },
    { onCancel }
  );
  return creds;
}

// ─── File writers ─────────────────────────────────────────────────────────────

function writeFirebaseConfig(config: FirebaseConfig): void {
  writeFileSync(
    resolve(ROOT, 'src/firebase-config.json'),
    JSON.stringify(config, null, 2) + '\n',
    'utf-8'
  );
}

function writeEnvironmentTs(
  config: FirebaseConfig,
  env: (typeof ENVIRONMENTS)[EnvKey],
  apiUrl: string,
  mpPublicKey: string
): void {
  writeFileSync(
    resolve(ROOT, 'src/environments/environment.ts'),
    `export const environment = {
  production: ${env.production},
  firebaseConfig: {
    apiKey: '${config.apiKey}',
    authDomain: '${config.authDomain}',
    projectId: '${config.projectId}',
    storageBucket: '${config.storageBucket}',
    messagingSenderId: '${config.messagingSenderId}',
    appId: '${config.appId}',${config.measurementId ? `\n    measurementId: '${config.measurementId}',` : ''}
  },
  mercadoPago: {
    publicKey: '${mpPublicKey}',
  },
  api: {
    cloudFunctionsUrl: '${apiUrl}',
  },
  features: {
    seedDataEnabled: ${!env.production},
    debugLogging: false,
  },
};
`,
    'utf-8'
  );
}

function writeFunctionsEnvFile(filePath: string, mpAccessToken: string, webhookUrl: string, siteUrl: string): void {
  writeFileSync(
    filePath,
    `MERCADOPAGO_ACCESSTOKEN=${mpAccessToken}\nMERCADOPAGO_WEBHOOK_URL=${webhookUrl}\nSITE_URL=${siteUrl}\n`,
    'utf-8'
  );
}

// ─── Firebase config fetcher with CLI + manual fallback ───────────────────────

async function getFirebaseConfig(env: (typeof ENVIRONMENTS)[EnvKey], hasCli: boolean, isAuth: boolean): Promise<FirebaseConfig> {
  if (hasCli && isAuth) {
    const spinner = p.spinner();
    spinner.start(`Obteniendo config de Firebase para "${env.projectId}"...`);
    const config = fetchFirebaseConfig(env.alias);
    if (config) {
      spinner.stop(`Config obtenida automáticamente para "${env.projectId}"`);
      return config;
    }
    spinner.stop('No se pudo obtener automáticamente.');
  }
  return promptFirebaseConfigManually(env.projectId);
}

// ─── Configure one environment ───────────────────────────────────────────────

async function configureEnvironment(
  envKey: EnvKey,
  hasCli: boolean,
  isAuth: boolean
): Promise<string[]> {
  const env = ENVIRONMENTS[envKey];
  const written: string[] = [];

  p.log.step(`Configurando: ${env.projectId}`);

  // Firebase config
  const firebaseConfig = await getFirebaseConfig(env, hasCli, isAuth);

  // API URL (only relevant for frontend/emulator choice in dev)
  let apiUrl: string = env.functionsUrl;
  let useEmulator = false;
  if (!env.production) {
    const answer = await p.confirm({
      message: '¿Usás el emulator de Firebase Functions localmente?',
      initialValue: true,
    });
    if (p.isCancel(answer)) onCancel();
    useEmulator = answer as boolean;
    apiUrl = useEmulator ? env.emulatorUrl : env.functionsUrl;
  }

  // MercadoPago
  const configureMp = await p.confirm({
    message: '¿Configurar credenciales de MercadoPago?',
    initialValue: true,
  });
  if (p.isCancel(configureMp)) onCancel();

  let mp: MpCredentials = { publicKey: '', accessToken: '' };
  if (configureMp) {
    mp = await promptMpCredentials(env);
  }

  // Write files
  writeFirebaseConfig(firebaseConfig);
  written.push('src/firebase-config.json');

  writeEnvironmentTs(firebaseConfig, env, apiUrl, mp.publicKey);
  written.push('src/environments/environment.ts');

  if (configureMp && mp.accessToken) {
    const webhookUrl = `${env.functionsUrl}/mercadoPagoWebhookHandler`;

    writeFunctionsEnvFile(
      resolve(ROOT, `functions/.env.${env.projectId}`),
      mp.accessToken,
      webhookUrl,
      env.siteUrl
    );
    written.push(`functions/.env.${env.projectId}`);

    // For dev: also write .env.local (used by the emulator)
    if (!env.production) {
      const localWebhookUrl = useEmulator
        ? 'http://127.0.0.1:5001/ecommerce-vertex-dev/us-central1/mercadoPagoWebhookHandler'
        : webhookUrl;
      writeFunctionsEnvFile(
        resolve(ROOT, 'functions/.env.local'),
        mp.accessToken,
        localWebhookUrl,
        env.siteUrl
      );
      written.push('functions/.env.local');
    }
  }

  return written;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  p.intro('  Vertex — Setup de Credenciales  ');

  // Show current state
  showCurrentStatus();

  // Check Firebase CLI once
  const hasCli = checkFirebaseCli();
  let isAuth = false;
  if (hasCli) {
    const spinner = p.spinner();
    spinner.start('Verificando sesión de Firebase CLI...');
    isAuth = checkFirebaseAuth();
    spinner.stop(isAuth ? 'Firebase CLI autenticado' : 'Firebase CLI no autenticado — se usará ingreso manual');
  } else {
    p.log.warn('Firebase CLI no encontrado — se usará ingreso manual para las credenciales.');
  }

  // Choose scope
  const scope = await p.select({
    message: '¿Qué querés configurar?',
    options: [
      { value: 'development', label: 'Development  (ecommerce-vertex-dev)', hint: 'para ng serve local' },
      { value: 'production', label: 'Production   (ecommerce-vertex)', hint: 'para deploy prod' },
      { value: 'both', label: 'Ambos', hint: 'dev primero, luego prod' },
    ],
    initialValue: 'development',
  });
  if (p.isCancel(scope)) onCancel();

  const envsToRun: EnvKey[] =
    scope === 'both' ? ['development', 'production'] : [scope as EnvKey];

  const allWritten: string[] = [];

  for (const envKey of envsToRun) {
    const written = await configureEnvironment(envKey, hasCli, isAuth);
    allWritten.push(...written);
  }

  // Summary
  p.note(allWritten.map((f) => `✔  ${f}`).join('\n'), 'Archivos configurados');

  const firstEnv = ENVIRONMENTS[envsToRun[0]];
  p.outro(`Listo. Corré "npm start" para levantar la app con ${firstEnv.projectId}.`);
}

void main();
