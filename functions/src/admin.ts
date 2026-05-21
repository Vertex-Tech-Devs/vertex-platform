import { getAuth } from 'firebase-admin/auth';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import type { ManageAdminPayload, AdminInfo } from './types';
import { ALLOWED_ORIGINS } from './helpers';

export const manageAdmin = onCall<ManageAdminPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can manage other admins.');
    }

    const { email, action } = request.data;
    if (!email || !['add', 'remove'].includes(action)) {
      throw new HttpsError('invalid-argument', 'Invalid email or action.');
    }

    const auth = getAuth();
    try {
      const user = await auth.getUserByEmail(email);
      const currentClaims = (user.customClaims as Record<string, unknown>) ?? {};

      if (action === 'add') {
        await auth.setCustomUserClaims(user.uid, { ...currentClaims, platformAdmin: true });
      } else {
        const { platformAdmin: _, ...rest } = currentClaims;
        await auth.setCustomUserClaims(user.uid, rest);
      }
      return { success: true, uid: user.uid };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('no user record')) {
        throw new HttpsError('not-found', `No user found for ${email}. They must sign in first.`);
      }
      console.error('manageAdmin error:', err);
      throw new HttpsError('internal', 'An unexpected error occurred.');
    }
  }
);

export const listAdmins = onCall({ cors: ALLOWED_ORIGINS, invoker: 'public' }, async (request) => {
  if (!request.auth?.token['platformAdmin']) {
    throw new HttpsError('permission-denied', 'Only platform admins can list admins.');
  }

  const auth = getAuth();
  const result = await auth.listUsers(1000);
  const admins: AdminInfo[] = result.users
    .filter((u) => (u.customClaims as Record<string, unknown> | undefined)?.['platformAdmin'])
    .map((u) => ({
      uid: u.uid,
      email: u.email ?? '',
      displayName: u.displayName,
      photoURL: u.photoURL,
    }));

  return { admins };
});
