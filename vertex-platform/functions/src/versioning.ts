import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getFirestore } from 'firebase-admin/firestore';
import { getGitHubPat, ALLOWED_ORIGINS, PLATFORM_PROJECT, getDeployToken } from './helpers';
import { verifyGitHubOidcToken } from './github-oidc';

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

      // Releases publicadas (fuente primaria: notas + fecha real).
      let releases: GitHubRelease[] = [];
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
      releases = (await res.json()) as GitHubRelease[];
      const published = releases.filter((r) => !r.draft && !r.prerelease);

      // Tags (fuente secundaria): versiones con tag pero sin release publicada.
      // Se fusionan para que el selector muestre TODAS las versiones compatibles,
      // no solo la latest.
      const byVersion = new Map<string, TemplateVersion>();
      for (const r of published) {
        byVersion.set(r.tag_name.replace(/^v/, ''), {
          version: r.tag_name.replace(/^v/, ''),
          tag: r.tag_name,
          publishedAt: r.published_at,
          isLatest: false,
          notes: r.body ?? undefined,
        });
      }

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
        const tags = (await tagsRes.json()) as {
          name: string;
          commit?: { sha: string };
        }[];
        for (const t of tags.filter((x) => x.name.startsWith('v'))) {
          const v = t.name.replace(/^v/, '');
          if (!byVersion.has(v)) {
            // Fecha real del tag: la del commit al que apunta (no "ahora").
            let publishedAt = new Date().toISOString();
            if (t.commit?.sha) {
              try {
                const cRes = await fetch(
                  `https://api.github.com/repos/Vertex-Tech-Devs/ecommerce-vertex/commits/${t.commit.sha}`,
                  {
                    headers: {
                      Authorization: `Bearer ${pat}`,
                      Accept: 'application/vnd.github+json',
                      'X-GitHub-Api-Version': '2022-11-28',
                    },
                  },
                );
                if (cRes.ok) {
                  const c = (await cRes.json()) as {
                    commit?: { committer?: { date?: string } };
                  };
                  publishedAt = c.commit?.committer?.date ?? publishedAt;
                }
              } catch {
                // Se conserva la fecha fallback si la llamada falla.
              }
            }
            byVersion.set(v, {
              version: v,
              tag: t.name,
              publishedAt,
              isLatest: false,
              notes: 'Git tag (sin release publicada)',
            });
          }
        }
      }

      // Orden desc por semver y marca la más alta como latest.
      const versions = [...byVersion.values()].sort((a, b) =>
        compareVersions(b.version, a.version),
      );
      if (versions.length > 0) {
        versions[0] = { ...versions[0], isLatest: true };
      }

      return { versions };
    } catch (err) {
      console.warn('[listTemplateVersions] Failed to fetch releases:', err);
      return { versions: [] };
    }
  },
);

/** Compara versiones semver (x.y.z) numéricamente, ignorando pre-releases. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

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
      versionUpdateProgress: { step: 'Encolando deploy', pct: 5, updatedAt: new Date().toISOString() },
      updatedAt: new Date(),
    });

    return { success: true };
  },
);

export const reportVersionUpdateProgress = onCall<{
  storeId: string;
  deployToken: string;
  step: string;
  pct: number;
}>({ cors: ALLOWED_ORIGINS, invoker: 'public' }, async (request) => {
  const { storeId, deployToken, step, pct } = request.data;
  if (!storeId || !deployToken || !step || typeof pct !== 'number') {
    throw new HttpsError('invalid-argument', 'storeId, deployToken, step and pct are required.');
  }

  // Misma verificación de deploy token que completeVersionUpdate (el workflow es quien reporta).
  const expected = await getDeployToken();
  if (deployToken !== expected) {
    throw new HttpsError('permission-denied', 'Invalid deploy token.');
  }

  const db = getFirestore();
  await db.collection('stores').doc(storeId).update({
    versionUpdateProgress: {
      step,
      pct: Math.max(0, Math.min(100, Math.round(pct))),
      updatedAt: new Date().toISOString(),
    },
    updatedAt: new Date(),
  });

  return { success: true };
});

export const completeVersionUpdate = onCall<{
  storeId: string;
  success: boolean;
  deployToken: string;
  idToken?: string;
  version: string;
}>({ cors: ALLOWED_ORIGINS, invoker: 'public' }, async (request) => {
  const { storeId, success, deployToken, idToken, version } = request.data;

  if (!storeId) {
    throw new HttpsError('invalid-argument', 'storeId is required.');
  }

  // Verificación OIDC de GitHub Actions (automatizada) o fallback al deploy token legacy.
  if (idToken) {
    const oidcValid = await verifyGitHubOidcToken(idToken, {
      repository: 'Vertex-Tech-Devs/ecommerce-vertex',
    });
    if (!oidcValid) {
      throw new HttpsError('permission-denied', 'Invalid GitHub OIDC token.');
    }
  } else if (deployToken) {
    const expected = await getDeployToken();
    if (deployToken !== expected) {
      throw new HttpsError('permission-denied', 'Invalid deploy token.');
    }
  } else {
    throw new HttpsError(
      'invalid-argument',
      'A valid deploy token or GitHub OIDC token is required.',
    );
  }

  const db = getFirestore();
  const storeRef = db.collection('stores').doc(storeId);

  if (success) {
    await storeRef.update({
      templateVersion: version,
      appVersion: `v${version.replace(/^v/, '')}`,
      targetChannel: 'stable',
      versionUpdateStatus: 'idle',
      versionUpdateTarget: null,
      versionUpdateProgress: null,
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
