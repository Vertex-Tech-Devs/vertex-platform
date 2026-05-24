import { GoogleAuth } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const env = readArg('env') || 'dev';
const projectId = env === 'prod' ? 'vertex-platform-app' : 'vertex-platform-dev';

void (async () => {
  try {
    const envFilePath = path.join(__dirname, `../extensions/firestore-send-email.env.${projectId}`);
    console.log(`[SMTP Config] Loading parameters from ${envFilePath}...`);
    if (!fs.existsSync(envFilePath)) {
      throw new Error(`Parameter file not found: ${envFilePath}`);
    }

    const envContent = fs.readFileSync(envFilePath, 'utf8');
    const params: Record<string, string> = {};
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const index = trimmed.indexOf('=');
      if (index === -1) return;
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      params[key] = value;
    });

    const connectionUri = params['SMTP_CONNECTION_URI'];
    const smtpPassword = params['SMTP_PASSWORD'];
    const defaultFrom = params['DEFAULT_FROM'];
    const defaultFromName = params['DEFAULT_FROM_NAME'];

    if (!connectionUri || !smtpPassword || !defaultFrom) {
      throw new Error('Missing required SMTP configuration parameters in .env file.');
    }

    if (env === 'prod' && smtpPassword === 'YOUR_PRODUCTION_SMTP_PASSWORD') {
      console.warn('⚠️ WARNING: Using production placeholder SMTP_PASSWORD. Please configure a real password before deploying to production.');
    }

    // Parse SMTP connection URI
    // Format 1: smtp://username@domain.com@host:port (secure format, no password in URI)
    // Format 2: smtp://username:password@host:port (legacy format)
    let protocol = 'smtp';
    let username = '';
    let host = '';
    let port = 587;
    let uriPassword = '';

    try {
      const authAndHost = connectionUri.slice(connectionUri.indexOf('://') + 3);
      const lastAtIndex = authAndHost.lastIndexOf('@');
      if (lastAtIndex !== -1) {
        const authPart = authAndHost.slice(0, lastAtIndex);
        const hostPortPart = authAndHost.slice(lastAtIndex + 1);
        
        // Host and port
        const portIndex = hostPortPart.indexOf(':');
        host = portIndex !== -1 ? hostPortPart.slice(0, portIndex) : hostPortPart;
        const portStr = portIndex !== -1 ? hostPortPart.slice(portIndex + 1) : '';
        if (portStr) {
          port = parseInt(portStr, 10);
        }
        
        // Auth part (can be user:pass or just user)
        const colonIndex = authPart.indexOf(':');
        if (colonIndex !== -1) {
          username = authPart.slice(0, colonIndex);
          uriPassword = authPart.slice(colonIndex + 1);
        } else {
          username = authPart;
        }
      } else {
        const parsedUrl = new URL(connectionUri);
        protocol = parsedUrl.protocol.replace(':', '');
        username = parsedUrl.username;
        uriPassword = parsedUrl.password;
        host = parsedUrl.hostname;
        if (parsedUrl.port) {
          port = parseInt(parsedUrl.port, 10);
        } else {
          port = protocol === 'smtps' ? 465 : 587;
        }
      }
    } catch (e) {
      throw new Error(`Invalid SMTP_CONNECTION_URI format: ${connectionUri}`);
    }

    const decodedUsername = decodeURIComponent(username);
    
    // Use the password from SMTP_PASSWORD if specified, otherwise fall back to decoded URI password
    let password = (smtpPassword && smtpPassword !== 'YOUR_PRODUCTION_SMTP_PASSWORD') ? smtpPassword : decodeURIComponent(uriPassword);

    // If the password is a GCP Secret Manager reference, try to resolve it
    if (password.startsWith('projects/') && password.includes('/secrets/')) {
      const isUriDevPasswordValid = uriPassword && uriPassword !== 'YOUR_PRODUCTION_SMTP_PASSWORD' && !uriPassword.startsWith('projects/');
      if (isUriDevPasswordValid) {
        password = decodeURIComponent(uriPassword);
      } else {
        console.log(`[SMTP Config] Resolving secret from GCP Secret Manager: ${password}...`);
        try {
          const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
          const smClient = new SecretManagerServiceClient();
          const [version] = await smClient.accessSecretVersion({ name: password });
          password = version.payload?.data?.toString() || '';
        } catch (e: any) {
          console.log(`[SMTP Config] Secret Manager API client failed (${e.message || e}). Trying gcloud CLI fallback...`);
          const { execSync } = require('child_process');
          try {
            const parts = password.split('/');
            const projId = parts[1];
            const secretName = parts[3];
            const versionId = parts[5] || 'latest';
            
            const cmd = `gcloud secrets versions access ${versionId} --secret="${secretName}" --project="${projId}"`;
            password = execSync(cmd, { encoding: 'utf8' }).trim();
            console.log(`[SMTP Config] Successfully resolved secret using gcloud CLI fallback!`);
          } catch (cliErr: any) {
            throw new Error(`Secret Manager resolution failed: ${cliErr.message || cliErr}`);
          }
        }
      }
    }

    const securityMode = port === 465 ? 'SSL' : (port === 587 ? 'START_TLS' : 'NONE');

    const smtpConfig = {
      senderEmail: defaultFrom,
      host,
      port,
      username: decodedUsername,
      password,
      securityMode
    };

    console.log(`[SMTP Config] Initializing Auth for project "${projectId}"...`);
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });
    const client = await auth.getClient();

    console.log(`[SMTP Config] Sending request to Identity Platform API...`);
    const url = `https://identitytoolkit.googleapis.com/admin/v2/projects/${projectId}/config?updateMask=notification.sendEmail`;
    
    const res = await client.request({
      url,
      method: 'PATCH',
      data: {
        notification: {
          sendEmail: {
            method: 'CUSTOM_SMTP',
            smtp: smtpConfig
          }
        }
      }
    });

    console.log('✅ SMTP Configuration successful! Response:', JSON.stringify(res.data, null, 2));
  } catch (err: any) {
    console.error('❌ Failed to configure SMTP:', err.message || err);
  }
})();

