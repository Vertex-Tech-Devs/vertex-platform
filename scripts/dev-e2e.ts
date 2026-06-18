import { spawn, ChildProcess, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';

const processes: ChildProcess[] = [];

function log(service: string, message: string) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${service}] ${message.trim()}`);
}

function checkPort(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path: '/', method: 'GET' }, () => {
      resolve(true);
      req.destroy();
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

async function waitPort(port: number, name: string): Promise<void> {
  log('Orchestrator', `Waiting for ${name} on port ${port}...`);
  for (let i = 0; i < 60; i++) {
    if (await checkPort(port)) {
      log('Orchestrator', `${name} is ready on port ${port}.`);
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`Timeout waiting for ${name} on port ${port}`);
}

function startProcess(command: string, args: string[], cwd: string, service: string): ChildProcess {
  log('Orchestrator', `Starting ${service}...`);
  const proc = spawn(command, args, {
    cwd,
    shell: true,
    stdio: 'pipe',
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  proc.stdout?.on('data', (data) => {
    log(service, data.toString());
  });

  proc.stderr?.on('data', (data) => {
    log(`${service}-Error`, data.toString());
  });

  proc.on('close', (code) => {
    log(service, `Process exited with code ${code}`);
    cleanup();
    process.exit(code ?? 1);
  });

  processes.push(proc);
  return proc;
}

function cleanup() {
  log('Orchestrator', 'Cleaning up processes...');
  for (const proc of processes) {
    if (proc.pid && !proc.killed) {
      try {
        process.kill(-proc.pid, 'SIGINT');
      } catch {
        proc.kill('SIGINT');
      }
    }
  }
}

async function main() {
  process.on('SIGINT', () => {
    cleanup();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    cleanup();
    process.exit(0);
  });

  try {
    log('Orchestrator', 'Building contracts and Cloud Functions...');
    execSync('npm run build --workspace=@vertex/contracts', { stdio: 'inherit' });
    execSync('npm run build --prefix vertex-platform/functions', { stdio: 'inherit' });
    if (fs.existsSync('packages/ecommerce-vertex/functions')) {
      execSync('npm run build --prefix packages/ecommerce-vertex/functions', { stdio: 'inherit' });
    }

    // 1. Start Firebase Emulators
    startProcess('npx', ['firebase', 'emulators:start'], process.cwd(), 'FirebaseEmulators');
    
    // Wait for Firestore (8080) and Functions (5001)
    await waitPort(8080, 'Firestore Emulator');
    await waitPort(5001, 'Functions Emulator');

    // 2. Start Platform Frontend
    startProcess('npm', ['run', 'start', '--', '--host', 'localhost', '--port', '4200', '--open', 'false'], 'vertex-platform', 'PlatformApp');

    // 3. Start Storefront Template Frontend
    startProcess('npm', ['run', 'start', '--', '--host', 'localhost', '--port', '4201', '--open', 'false'], 'packages/ecommerce-vertex', 'StorefrontApp');

    // Wait for frontends to be ready
    await waitPort(4200, 'Platform Frontend');
    await waitPort(4201, 'Storefront Frontend');

    log('Orchestrator', 'Opening application links in your default browser...');
    spawn('open', ['http://localhost:4200']);
    spawn('open', ['http://localhost:4201/admin']);
    spawn('open', ['http://localhost:4201/shop?tenantId=tienda-dos']);

    log('Orchestrator', 'All services launched. Press Ctrl+C to terminate.');
  } catch (error: any) {
    console.error('Error starting E2E development environment:', error);
    cleanup();
    process.exit(1);
  }
}

main().catch(console.error);
