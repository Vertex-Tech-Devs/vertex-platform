import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getGitHubPat, ALLOWED_ORIGINS, PLATFORM_PROJECT, getDeployToken } from './helpers';

interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  html_url: string;
  body?: string;
}

export interface TemplateVersion {
  version: string;
  tag: string;
  publishedAt: string;
  isLatest: boolean;
  notes?: string;
}

export const listTemplateVersions = onCall(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can list template versions.');
    }

    try {
      const pat = await getGitHubPat();
      const res = await fetch(
        'https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/releases?per_page=20',
        {
          headers: {
            Authorization: `Bearer ${pat}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!res.ok) {
        throw new Error(`GitHub releases API failed: ${res.status}`);
      }

      const releases = (await res.json()) as GitHubRelease[];
      const published = releases.filter((r) => !r.draft && !r.prerelease);

      const versions: TemplateVersion[] = published.map((r, i) => ({
        version: r.tag_name.replace(/^v/, ''),
        tag: r.tag_name,
        publishedAt: r.published_at,
        isLatest: i === 0,
        notes: r.body ?? undefined,
      }));

      if (versions.length === 0) {
        const tagsRes = await fetch(
          'https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/tags?per_page=20',
          {
            headers: {
              Authorization: `Bearer ${pat}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          },
        );
        if (tagsRes.ok) {
          const tags = (await tagsRes.json()) as { name: string }[];
          const tagVersions: TemplateVersion[] = tags
            .filter((t) => t.name.startsWith('v'))
            .map((t, i) => ({
              version: t.name.replace(/^v/, ''),
              tag: t.name,
              publishedAt: new Date().toISOString(),
              isLatest: i === 0,
              notes: 'Git tag release fallback',
            }));
          return { versions: tagVersions };
        }
      }

      return { versions };
    } catch (err) {
      console.warn('[listTemplateVersions] Failed to fetch releases:', err);
      return { versions: [] };
    }
  },
);

export const updateStoreVersion = onCall<{ storeId: string; version: string }>(
  { cors: ALLOWED_ORIGINS, invoker: 'public' },
  async (request) => {
    if (!request.auth?.token['platformAdmin']) {
      throw new HttpsError('permission-denied', 'Only platform admins can update store versions.');
    }

    const { storeId, version } = request.data;
    if (!storeId || !version) {
      throw new HttpsError('invalid-argument', 'storeId and version are required.');
    }

    const db = getFirestore();
    const storeRef = db.collection('stores').doc(storeId);
    const snap = await storeRef.get();

    if (!snap.exists) {
      throw new HttpsError('not-found', 'Store not found.');
    }

    const storeData = snap.data()!;
    if (storeData['status'] !== 'active') {
      throw new HttpsError('failed-precondition', 'Store must be active to update its version.');
    }

    if (storeData['versionUpdateStatus'] === 'updating') {
      throw new HttpsError('failed-precondition', 'A version update is already in progress.');
    }

    const pat = await getGitHubPat();

    const tagRes = await fetch(
      `https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/git/refs/tags/v${version}`,
      {
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );

    if (!tagRes.ok) {
      throw new HttpsError('not-found', `Version v${version} does not exist in the repository.`);
    }

    const configSnap = await db
      .collection('stores')
      .doc(storeId)
      .collection('private')
      .doc('firebaseConfig')
      .get();

    if (!configSnap.exists) {
      throw new HttpsError('failed-precondition', 'Store Firebase config not found.');
    }

    const firebaseConfig = configSnap.data() as Record<string, string>;

    const deployToken = await getDeployToken();

    const res = await fetch(
      'https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/dispatches',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${pat}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event_type: 'update-store-version',
          client_payload: {
            store_id: storeId,
            tenant_id: storeData['slug'],
            site_id: storeData['runtimeSiteId'] || 'default',
            project_id: storeData['firebaseProjectId'],
            firebase_config: JSON.stringify(firebaseConfig),
            ref: `refs/tags/v${version}`,
            version,
            platform_project_id: PLATFORM_PROJECT,
            deploy_token: deployToken,
          },
        }),
      },
    );

    if (!res.ok && res.status !== 204) {
      throw new HttpsError('internal', `Failed to trigger GitHub Actions: ${res.status}`);
    }

    await storeRef.update({
      versionUpdateStatus: 'updating',
      versionUpdateTarget: version,
      updatedAt: new Date(),
    });

    return { success: true };
  },
);

export const completeVersionUpdate = onCall<{
  storeId: string;
  success: boolean;
  deployToken: string;
  version: string;
}>({ cors: ALLOWED_ORIGINS, invoker: 'public' }, async (request) => {
  const { storeId, success, deployToken, version } = request.data;

  if (!storeId || !deployToken) {
    throw new HttpsError('invalid-argument', 'storeId and deployToken are required.');
  }

  const expected = await getDeployToken();
  if (deployToken !== expected) {
    throw new HttpsError('permission-denied', 'Invalid deploy token.');
  }

  const db = getFirestore();
  const storeRef = db.collection('stores').doc(storeId);

  if (success) {
    await storeRef.update({
      templateVersion: version,
      versionUpdateStatus: 'idle',
      versionUpdateTarget: null,
      lastDeployedAt: new Date(),
      updatedAt: new Date(),
    });
  } else {
    await storeRef.update({
      versionUpdateStatus: 'failed',
      updatedAt: new Date(),
    });
  }

  return { success: true };
});
