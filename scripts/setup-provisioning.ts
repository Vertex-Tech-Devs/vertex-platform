/**
 * One-time setup: stores Application Default Credentials and GitHub PAT
 * in Google Cloud Secret Manager so the provisionStore Cloud Function can use them.
 *
 * Prerequisites:
 *   1. gcloud auth application-default login  (already done)
 *   2. A GitHub PAT with scopes: repo + workflow
 *
 * Usage:
 *   npm run setup-provisioning
 *   npm run setup-provisioning -- --github-pat=ghp_xxxxxxxxxxxx
 */
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const PROJECT_ID = 'vertex-platform-app';

const args = process.argv.slice(2);
const patArg = args.find((a) => a.startsWith('--github-pat='));
const githubPat = patArg?.split('=')[1];

void (async () => {
  const client = new SecretManagerServiceClient();

  // ── Store ADC credentials ────────────────────────────────────────────────
  const adcPath = join(homedir(), '.config', 'gcloud', 'application_default_credentials.json');
  let adcJson: string;
  try {
    adcJson = readFileSync(adcPath, 'utf-8');
    const parsed = JSON.parse(adcJson) as { type: string };
    if (parsed.type !== 'authorized_user') {
      console.error(`❌ ADC credentials are type "${parsed.type}", need "authorized_user".`);
      console.error('   Run: gcloud auth application-default login');
      process.exit(1);
    }
  } catch {
    console.error('❌ Could not read ADC credentials.');
    console.error('   Run: gcloud auth application-default login');
    process.exit(1);
  }

  await upsertSecret(client, 'platform-owner-credentials', adcJson);
  console.log('✅ ADC credentials stored in Secret Manager.');

  // ── Store GitHub PAT ─────────────────────────────────────────────────────
  if (githubPat) {
    await upsertSecret(client, 'github-pat', githubPat);
    console.log('✅ GitHub PAT stored in Secret Manager.');
  } else {
    console.log('\n⚠️  GitHub PAT not provided. Provisioning will fail at the deploy step.');
    console.log(
      '   Create a PAT at https://github.com/settings/tokens with scopes: repo, workflow'
    );
    console.log('   Then run: npm run setup-provisioning -- --github-pat=ghp_xxxx');
  }

  console.log('\n✅ Setup complete. You can now create stores from the platform.');
})();

async function upsertSecret(
  client: SecretManagerServiceClient,
  secretId: string,
  payload: string
): Promise<void> {
  const secretName = `projects/${PROJECT_ID}/secrets/${secretId}`;

  // Create secret if it doesn't exist
  try {
    await client.createSecret({
      parent: `projects/${PROJECT_ID}`,
      secretId,
      secret: { replication: { automatic: {} } },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes('already exists') && !msg.includes('409')) throw err;
  }

  // Add a new version
  await client.addSecretVersion({
    parent: secretName,
    payload: { data: Buffer.from(payload, 'utf-8') },
  });
}
