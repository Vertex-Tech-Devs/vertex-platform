import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as functions from 'firebase-functions/v1';
import type { ManageAdminPayload, AdminInfo } from './types';
import { ALLOWED_ORIGINS } from './helpers';
import { z } from 'zod';

const PROTECTED_SUPER_ADMINS = new Set(['juan.l.espeche@gmail.com', 'leivalihue@gmail.com', 'vertex.tech.dev@gmail.com']);

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

const provisionStoreAdminSchema = z.object({
  email: z.string().email(),
  storeName: z.string().min(1),
  tenantId: z.string().min(1),
  contact: z.object({
    phone: z.string().min(1),
    email: z.string().email(),
    whatsApp: z.string().optional().or(z.literal('')),
    instagram: z.string().optional().or(z.literal('')),
    facebook: z.string().optional().or(z.literal('')),
  }),
});

export const provisionStoreAdmin = onCall(
  { cors: true, invoker: 'public', maxInstances: 5 },
  async (request) => {
    let parsedData;
    try {
      parsedData = provisionStoreAdminSchema.parse(request.data);
    } catch (err: any) {
      throw new HttpsError('invalid-argument', `Validation failed: ${err.message}`);
    }

    const { email, storeName, tenantId } = parsedData;
    const db = getFirestore();
    const auth = getAuth();
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Create user in Firebase central Auth if they do not exist
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(normalizedEmail);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        try {
          userRecord = await auth.createUser({
            email: normalizedEmail,
            emailVerified: true,
          });
        } catch (createErr: any) {
          console.error('Error creating user in Auth:', createErr);
          throw new HttpsError(
            'internal',
            `Failed to create user administrator: ${createErr.message}`,
          );
        }
      } else {
        console.error('Error checking user in Auth:', err);
        throw new HttpsError('internal', `Failed to check user administrator: ${err.message}`);
      }
    }

    // 2. Idempotency Check: Verify if an email was already sent for this tenantId or email in the last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const emailMailSnap = await db
        .collection('mail')
        .where('to', 'array-contains', normalizedEmail)
        .get();

      const duplicateByEmail = emailMailSnap.docs.some((doc) => {
        const cAt = doc.data()['createdAt'];
        const date = cAt instanceof Date ? cAt : cAt?.toDate ? cAt.toDate() : new Date(cAt);
        return date >= oneDayAgo;
      });

      const tenantMailSnap = await db.collection('mail').where('tenantId', '==', tenantId).get();

      const duplicateByTenant = tenantMailSnap.docs.some((doc) => {
        const cAt = doc.data()['createdAt'];
        const date = cAt instanceof Date ? cAt : cAt?.toDate ? cAt.toDate() : new Date(cAt);
        return date >= oneDayAgo;
      });

      if (duplicateByEmail || duplicateByTenant) {
        console.log(
          `Duplicate onboarding email request ignored (idempotency triggered) for ${normalizedEmail} / ${tenantId}.`,
        );
        return { success: true, message: 'Onboarding processed (duplicate email skipped).' };
      }
    } catch (queryErr) {
      console.error('Error performing idempotency check:', queryErr);
    }

    // 3. Atomically write the notification document to 'mail' collection
    const loginUrl = `https://${tenantId}.web.app/admin/login`;
    const emailSubject = `¡Bienvenido a ${storeName}! Configuración completada - Vertex`;
    const emailHtml = `
      <div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1);">
          <div style="padding:24px;background:linear-gradient(135deg,#0f172a,#2563eb);color:#ffffff;">
            <p style="margin:0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;opacity:.8;">Vertex Platform</p>
            <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;">¡Tu tienda está lista!</h1>
          </div>
          <div style="padding:24px;line-height:1.6;">
            <p style="margin:0 0 16px;font-size:16px;">Hola,</p>
            <p style="margin:0 0 16px;">¡Felicitaciones! Tu tienda <strong>${storeName}</strong> ha sido aprovisionada con éxito en el tenant <code>${tenantId}</code>.</p>
            <p style="margin:0 0 20px;">Tu cuenta de administrador con el correo <strong>${normalizedEmail}</strong> ya está activa. Podés ingresar directamente al panel de control utilizando tus credenciales desde el siguiente enlace:</p>
            <p style="margin:0 0 24px;text-align:center;">
              <a href="${loginUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;box-shadow:0 2px 4px rgb(37 99 235 / 0.2);">Ingresar al panel</a>
            </p>
            <hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;" />
            <p style="margin:0 0 8px;color:#64748b;font-size:12px;">Si el botón de arriba no funciona, copiá y pegá esta URL en tu navegador:</p>
            <p style="margin:0;color:#2563eb;font-size:12px;word-break:break-all;">${loginUrl}</p>
          </div>
          <div style="padding:16px 24px;background:#f1f5f9;color:#64748b;font-size:12px;text-align:center;">
            Este correo fue enviado de forma automática por Vertex Platform.
          </div>
        </div>
      </div>
    `;

    try {
      await db.collection('mail').add({
        to: [normalizedEmail],
        tenantId,
        createdAt: new Date(),
        message: {
          subject: emailSubject,
          html: emailHtml,
          text: `¡Bienvenido a ${storeName}! Tu cuenta de administrador con email ${normalizedEmail} está lista. Ingresá al panel en: ${loginUrl}`,
        },
      });
    } catch (mailErr: any) {
      console.error('Error writing mail to queue:', mailErr);
      throw new HttpsError('internal', `Failed to queue onboarding email: ${mailErr.message}`);
    }

    return { success: true, userId: userRecord.uid };
  },
);
