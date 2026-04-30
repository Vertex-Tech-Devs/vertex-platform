/**
 * Sets platformAdmin: true custom claim on a Firebase Auth user.
 * Uses gcloud Application Default Credentials — no service account key file needed.
 *
 * Usage:
 *   npm run add-admin juan@email.com
 *   npm run remove-admin juan@email.com
 */
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const [, , email, flag] = process.argv;
const remove = flag === '--remove';

if (!email) {
  console.error('Usage: npm run add-admin <email>');
  console.error('       npm run add-admin <email> --remove');
  process.exit(1);
}

initializeApp({ projectId: 'vertex-platform-app' });

const auth = getAuth();

void (async () => {
  try {
    const user = await auth.getUserByEmail(email);
    const currentClaims = user.customClaims ?? {};

    if (remove) {
      const { platformAdmin: _, ...rest } = currentClaims as Record<string, unknown>;
      await auth.setCustomUserClaims(user.uid, rest);
      console.log(`✅ Removed platform admin access from ${email}`);
    } else {
      await auth.setCustomUserClaims(user.uid, { ...currentClaims, platformAdmin: true });
      console.log(`✅ ${email} is now a platform admin`);
      console.log('   They must sign out and back in for the claim to take effect.');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('no user record')) {
      console.error(`❌ No Firebase user found for ${email}`);
      console.error('   The user must log in at least once before being granted admin access.');
    } else {
      console.error(`❌ Error: ${msg}`);
    }
    process.exit(1);
  }
})();
