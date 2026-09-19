/**
 * Clasificación de sitios de Firebase Hosting para la auditoría de capacidad.
 * Pura (sin I/O) para poder testearla: recibe los sitios de un shard y las
 * referencias de las tiendas, y decide qué es huérfano/protegido/en uso.
 */

export type SiteClass = 'PROTECTED' | 'IN_USE' | 'ORPHAN';

export interface SiteClassification {
  projectId: string;
  siteId: string;
  klass: SiteClass;
  hasReleases: boolean;
  /** Sólo los ORPHAN sin releases son candidatos a limpieza automática. */
  safeToDelete: boolean;
}

/** Deriva el ID de sitio a partir del nombre de recurso de Hosting. */
export function siteIdFromName(name: string): string {
  return String(name || '')
    .split('/')
    .pop()!
    .trim();
}

/**
 * Clasifica un sitio:
 * - PROTECTED: es el sitio DEFAULT del proyecto (su id == projectId).
 * - IN_USE: está referenciado por alguna tienda (principal, siteId, subdomain o alias).
 * - ORPHAN: no lo referencia ninguna tienda. `safeToDelete` sólo si además no tiene releases.
 */
export function classifySite(
  projectId: string,
  siteId: string,
  referenced: ReadonlySet<string>,
  hasReleases: boolean,
): SiteClassification {
  if (siteId === projectId) {
    return { projectId, siteId, klass: 'PROTECTED', hasReleases, safeToDelete: false };
  }
  if (referenced.has(siteId)) {
    return { projectId, siteId, klass: 'IN_USE', hasReleases, safeToDelete: false };
  }
  return { projectId, siteId, klass: 'ORPHAN', hasReleases, safeToDelete: !hasReleases };
}

export interface SitesAuditSummary {
  date: string;
  shards: number;
  totalSites: number;
  inUse: number;
  orphan: number;
  protectedSites: number;
  deleted: string[];
  pendingReview: Array<{ projectId: string; siteId: string }>;
}

/** Arma el resumen/reporte diario a partir de las clasificaciones y los borrados. */
export function buildAuditReport(
  classifications: SiteClassification[],
  deleted: Array<{ projectId: string; siteId: string }>,
  date = new Date().toISOString().slice(0, 10),
): SitesAuditSummary {
  const inUse = classifications.filter((c) => c.klass === 'IN_USE').length;
  const orphan = classifications.filter((c) => c.klass === 'ORPHAN');
  return {
    date,
    shards: new Set(classifications.map((c) => c.projectId)).size,
    totalSites: classifications.length,
    inUse,
    orphan: orphan.length,
    protectedSites: classifications.filter((c) => c.klass === 'PROTECTED').length,
    deleted: deleted.map((d) => `${d.projectId}/${d.siteId}`),
    pendingReview: orphan
      .filter((c) => !c.safeToDelete)
      .map((c) => ({ projectId: c.projectId, siteId: c.siteId })),
  };
}
