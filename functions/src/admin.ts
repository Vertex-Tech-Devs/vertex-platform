import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as functions from 'firebase-functions/v1';
import type { ManageAdminPayload, AdminInfo } from './types';
import { ALLOWED_ORIGINS } from './helpers';

const PROTECTED_SUPER_ADMINS = new Set(['juan.l.espeche@gmail.com', 'vertex.tech.dev@gmail.com']);

const ensureProtectedSuperAdmins = async (db: FirebaseFirestore.Firestore): Promise<void> => {
  for (const email of PROTECTED_SUPER_ADMINS) {
    await db.collection('platformAdmins').doc(email).set(
      {
        email,
        role: 'superAdmin',
        protected: true,
        addedBy: 'system',
        updatedAt: new Date(),
      },
      { merge: true },
    );
  }
};

export const manageAdmin = onCall<ManageAdminPayload>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    // Only super admins can manage platform administrators and roles
    if (!request.auth?.token['superAdmin']) {
      throw new HttpsError('permission-denied', 'Only super admins can manage platform roles.');
    }

    const { email, action, role } = request.data;
    if (!email || !['add', 'remove'].includes(action)) {
      throw new HttpsError('invalid-argument', 'Invalid email or action.');
    }

    const targetRole = role || 'platformAdmin';
    if (!['superAdmin', 'platformAdmin'].includes(targetRole)) {
      throw new HttpsError('invalid-argument', 'Invalid role specified.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const isProtectedAdmin = PROTECTED_SUPER_ADMINS.has(normalizedEmail);
    const db = getFirestore();
    const auth = getAuth();

    if (action === 'remove' && isProtectedAdmin) {
      throw new HttpsError(
        'failed-precondition',
        'Protected super admin accounts cannot be removed.',
      );
    }

    const effectiveRole = isProtectedAdmin ? 'superAdmin' : targetRole;

    try {
      if (action === 'add') {
        // Pre-authorize email in Firestore platformAdmins collection with role
        await db
          .collection('platformAdmins')
          .doc(normalizedEmail)
          .set({
            email: normalizedEmail,
            role: effectiveRole,
            protected: isProtectedAdmin,
            addedAt: new Date(),
            addedBy: request.auth.token.email || 'system',
          });

        // Sync custom claim immediately if user is already signed up
        try {
          const user = await auth.getUserByEmail(normalizedEmail);
          const currentClaims = (user.customClaims as Record<string, unknown>) ?? {};
          await auth.setCustomUserClaims(user.uid, {
            ...currentClaims,
            platformAdmin: true,
            superAdmin: effectiveRole === 'superAdmin',
          });
        } catch (err: any) {
          if (err.code !== 'auth/user-not-found') {
            console.error('Error syncing claims in manageAdmin (add):', err);
          }
        }
      } else {
        // Revoke/Delete from Firestore platformAdmins collection
        await db.collection('platformAdmins').doc(normalizedEmail).delete();

        // Revoke claim immediately if user already exists
        try {
          const user = await auth.getUserByEmail(normalizedEmail);
          const currentClaims = (user.customClaims as Record<string, unknown>) ?? {};
          const { platformAdmin: _, superAdmin: __, ...rest } = currentClaims;
          await auth.setCustomUserClaims(user.uid, rest);
        } catch (err: any) {
          if (err.code !== 'auth/user-not-found') {
            console.error('Error syncing claims in manageAdmin (remove):', err);
          }
        }
      }
      return { success: true };
    } catch (err: unknown) {
      console.error('manageAdmin error:', err);
      throw new HttpsError('internal', 'An unexpected error occurred.');
    }
  },
);

export const listAdmins = onCall({ cors: ALLOWED_ORIGINS, invoker: 'public' }, async (request) => {
  if (!request.auth?.token['platformAdmin']) {
    throw new HttpsError('permission-denied', 'Only platform admins can list admins.');
  }

  const db = getFirestore();
  const auth = getAuth();

  await ensureProtectedSuperAdmins(db);

  // Read pre-authorized admins from Firestore collection
  const snapshot = await db.collection('platformAdmins').get();
  const adminMap = new Map(
    snapshot.docs.map((doc) => [doc.id, doc.data()?.['role'] || 'platformAdmin']),
  );

  const admins: AdminInfo[] = [];

  // For each email, retrieve display profile if user already signed up
  for (const [email, role] of adminMap.entries()) {
    try {
      const user = await auth.getUserByEmail(email);
      admins.push({
        uid: user.uid,
        email: user.email ?? email,
        displayName: user.displayName || undefined,
        photoURL: user.photoURL || undefined,
        role: role as 'superAdmin' | 'platformAdmin',
      });
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // Show as invited/pending registration
        admins.push({
          uid: `invited-${email}`,
          email,
          displayName: 'Invitado (Pendiente)',
          photoURL: undefined,
          role: role as 'superAdmin' | 'platformAdmin',
        });
      } else {
        console.error(`Error loading details for admin ${email}:`, err);
      }
    }
  }

  return { admins };
});

/**
 * Triggered reactively when a document is written in the 'platformAdmins' collection.
 * Concedes or revokes custom claims on the user's Auth record.
 */
export const onPlatformAdminRoleChange = onDocumentWritten(
  'platformAdmins/{email}',
  async (event) => {
    const email = event.params.email;
    const afterData = event.data?.after.data();
    const auth = getAuth();
    const db = getFirestore();
    const isProtectedAdmin = PROTECTED_SUPER_ADMINS.has(email);

    if (!afterData && isProtectedAdmin) {
      await ensureProtectedSuperAdmins(db);
    }

    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        console.log(`User ${email} not found in Auth. Claims will be synced when they log in.`);
      } else {
        console.error(`Error fetching user ${email}:`, err);
      }
      return;
    }

    const currentClaims = (user.customClaims as Record<string, unknown>) ?? {};

    if (!afterData) {
      if (isProtectedAdmin) {
        console.log(`Protected admin ${email} was restored; enforcing superAdmin claim.`);
        await auth.setCustomUserClaims(user.uid, {
          ...currentClaims,
          platformAdmin: true,
          superAdmin: true,
        });
        return;
      }

      console.log(`Revoking platformAdmin and superAdmin claims for ${email} (UID: ${user.uid})`);
      const { platformAdmin: _, superAdmin: __, ...rest } = currentClaims;
      await auth.setCustomUserClaims(user.uid, rest);
    } else {
      const afterRole = isProtectedAdmin ? 'superAdmin' : afterData['role'] || 'platformAdmin';
      if (isProtectedAdmin && afterData['role'] !== 'superAdmin') {
        await db
          .collection('platformAdmins')
          .doc(email)
          .set({ role: 'superAdmin', protected: true, updatedAt: new Date() }, { merge: true });
      }
      console.log(`Setting claims for ${email} with role: ${afterRole} (UID: ${user.uid})`);
      await auth.setCustomUserClaims(user.uid, {
        ...currentClaims,
        platformAdmin: true,
        superAdmin: afterRole === 'superAdmin',
      });
    }
  },
);

/**
 * Triggered when a new user registers in Firebase Auth on the platform.
 * If their email is pre-authorized in the 'platformAdmins' collection,
 * sets the custom claim immediately.
 */
export const onPlatformUserCreated = functions.auth.user().onCreate(async (user) => {
  if (!user || !user.email) return;

  const email = user.email.toLowerCase();
  const db = getFirestore();
  const auth = getAuth();
  const isProtectedAdmin = PROTECTED_SUPER_ADMINS.has(email);

  try {
    const docRef = db.collection('platformAdmins').doc(email);
    const docSnap = await docRef.get();

    if (!docSnap.exists && isProtectedAdmin) {
      await ensureProtectedSuperAdmins(db);
    }

    if (docSnap.exists || isProtectedAdmin) {
      const role = isProtectedAdmin ? 'superAdmin' : docSnap.data()?.['role'] || 'platformAdmin';
      console.log(
        `Auto-setting claims for newly registered user: ${email} with role: ${role} (UID: ${user.uid})`,
      );
      const currentClaims = (user.customClaims as Record<string, unknown>) ?? {};
      await auth.setCustomUserClaims(user.uid, {
        ...currentClaims,
        platformAdmin: true,
        superAdmin: role === 'superAdmin',
      });
    }
  } catch (err) {
    console.error(`Error checking/setting platformAdmin claim for ${email}:`, err);
  }
});
