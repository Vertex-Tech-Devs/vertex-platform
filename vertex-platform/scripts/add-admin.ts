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
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
const email = args.find((a) => !a.startsWith('--'));
const remove = args.includes('--remove');
const isDev = args.includes('--dev');

if (!email) {
  console.error('Usage: npm run add-admin <email> [--remove] [--dev]');
  process.exit(1);
}

const projectId = isDev ? 'vertex-platform-dev' : 'vertex-platform-app';
initializeApp({ projectId });

const auth = getAuth();
const db = getFirestore();

void (async () => {
  try {
    const user = await auth.getUserByEmail(email);
    const currentClaims = user.customClaims ?? {};
    const normalizedEmail = email.trim().toLowerCase();

    if (remove) {
      const { platformAdmin: _, superAdmin: __, ...rest } = currentClaims as Record<string, unknown>;
      await auth.setCustomUserClaims(user.uid, rest);
      await db.collection('platformAdmins').doc(normalizedEmail).delete();
      console.log(`✅ Removed super admin access and Firestore document for ${email} in project "${projectId}"`);
    } else {
      await auth.setCustomUserClaims(user.uid, {
        ...currentClaims,
        platformAdmin: true,
        superAdmin: true,
      });
      await db.collection('platformAdmins').doc(normalizedEmail).set({
        email: normalizedEmail,
        role: 'superAdmin',
        addedAt: new Date(),
        addedBy: 'cli-script',
      });
      console.log(`✅ ${email} is now a super admin in project "${projectId}"`);
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
