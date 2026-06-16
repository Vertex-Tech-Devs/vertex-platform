import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as functions from "firebase-functions/v1";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { COLLECTIONS } from "./core/config";

const auth = admin.auth();
const db = admin.firestore();
const AUTHORIZED_ROLES = new Set(['admin', 'owner']);

function resolveTenantId(request: any): string {
  if (request.data && typeof request.data === 'object' && request.data.tenantId) {
    return String(request.data.tenantId);
  }
  if (request.auth?.token?.["tenantId"]) {
    return String(request.auth.token["tenantId"]);
  }
  const origin = request.rawRequest?.headers?.origin || "";
  const host = origin.replace(/^https?:\/\//, "").split(":")[0];
  let firstLabel = host.split(".")[0];
  if (firstLabel && firstLabel.startsWith("vtx-")) {
    firstLabel = firstLabel.substring(4);
  }
  return firstLabel && firstLabel !== "localhost" ? firstLabel : "store";
}

/**
 * Triggered when a document is written in the 'admin_roles' collection.
 * Sets the corresponding custom claim on the user's auth token.
 */
export const onRoleChange = onDocumentWritten(`${COLLECTIONS.ADMIN_ROLES}/{compositeId}`, async (event) => {
  const compositeId = event.params.compositeId;
  const firstUnderscore = compositeId.indexOf('_');
  if (firstUnderscore === -1) return;
  const tenantId = compositeId.substring(0, firstUnderscore);
  const email = compositeId.substring(firstUnderscore + 1);

  const afterData = event.data?.after.data();
  const nextRole = String(afterData?.role || '').trim().toLowerCase();
  const isAuthorizedRole = AUTHORIZED_ROLES.has(nextRole);

  let user: admin.auth.UserRecord;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error: any) {
    if (error.code === 'auth/user-not-found') {
      logger.warn(`User with email ${email} not found in Firebase Auth.`);
    } else {
      logger.error(`Error fetching user ${email}:`, error);
    }
    return;
  }
  
  if (!afterData || !isAuthorizedRole) {
    logger.info(`Revoking admin access for user: ${email} (UID: ${user.uid})`);
    await auth.setCustomUserClaims(user.uid, { admin: false, role: null, tenantId: null });
    return;
  }

  if (event.data?.before.data()?.role === nextRole) {
    logger.info(`Role for ${email} already set to ${nextRole}. No change needed.`);
    return;
  }

  logger.info(`Setting admin access claims for user: ${email} (UID: ${user.uid}) role=${nextRole} tenantId=${tenantId}`);
  await auth.setCustomUserClaims(user.uid, { admin: true, role: nextRole, tenantId });
});

/**
 * Triggered when a new user is created in Firebase Auth.
 * If their email is pre-configured as an admin in the 'admin_roles' collection,
 * sets the admin custom claim on their account immediately.
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  if (!user || !user.email) return;

  const email = user.email.trim().toLowerCase();
  try {
    const snapshot = await db.collection(COLLECTIONS.ADMIN_ROLES).get();
    const doc = snapshot.docs.find(d => d.id.endsWith(`_${email}`));
    if (doc) {
      const data = doc.data();
      const role = String(data?.role || '').trim().toLowerCase();
      const tenantId = data?.tenantId || '';
      if (AUTHORIZED_ROLES.has(role)) {
        logger.info(`Setting admin access claims for newly registered user: ${email} (UID: ${user.uid}) role=${role} tenantId=${tenantId}`);
        await auth.setCustomUserClaims(user.uid, { admin: true, role, tenantId });
      }
    }
  } catch (error) {
    logger.error(`Error setting admin claim on user creation for ${email}:`, error);
  }
});

/**
 * Callable that syncs admin claims for the authenticated caller.
 * Called from the login flow if the user doesn't yet have an admin claim,
 * to handle the race condition where onRoleChange ran before the user existed in Auth.
 */
export const refreshMyAdminClaim = onCall({ cors: true, invoker: 'public' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }

  const email = request.auth.token['email'];
  if (!email) {
    throw new HttpsError('invalid-argument', 'User account has no email.');
  }

  const uid = request.auth.uid;
  const tenantId = resolveTenantId(request);
  const compositeKey = `${tenantId}_${String(email).trim().toLowerCase()}`;

  const doc = await db.collection(COLLECTIONS.ADMIN_ROLES).doc(compositeKey).get();
  const role = String(doc.data()?.role || '').trim().toLowerCase();

  if (doc.exists && AUTHORIZED_ROLES.has(role)) {
    logger.info(`refreshMyAdminClaim: granting admin claim to ${email} (UID: ${uid}) tenantId=${tenantId}`);
    await auth.setCustomUserClaims(uid, { admin: true, role, tenantId });
    return { granted: true };
  }

  logger.info(`refreshMyAdminClaim: no admin_roles entry for ${email}`);
  return { granted: false };
});