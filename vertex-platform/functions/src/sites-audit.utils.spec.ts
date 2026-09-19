import { describe, expect, it } from 'vitest';
import { classifySite, buildAuditReport, siteIdFromName } from './sites-audit.utils';

const REF = new Set(['vtx-locura', 'kasa-kalle-ar']);

describe('classifySite', () => {
  it('protege el sitio default del proyecto', () => {
    const c = classifySite('vtx-sd-abc', 'vtx-sd-abc', REF, false);
    expect(c.klass).toBe('PROTECTED');
    expect(c.safeToDelete).toBe(false);
  });

  it('marca IN_USE si está referenciado por una tienda', () => {
    const c = classifySite('vtx-sd-abc', 'kasa-kalle-ar', REF, true);
    expect(c.klass).toBe('IN_USE');
    expect(c.safeToDelete).toBe(false);
  });

  it('marca ORPHAN y permite borrar si no tiene releases', () => {
    const c = classifySite('vtx-sd-abc', 'vtx-viejo', REF, false);
    expect(c.klass).toBe('ORPHAN');
    expect(c.safeToDelete).toBe(true);
  });

  it('ORPHAN con releases no se borra automáticamente', () => {
    const c = classifySite('vtx-sd-abc', 'vtx-viejo', REF, true);
    expect(c.klass).toBe('ORPHAN');
    expect(c.safeToDelete).toBe(false);
  });
});

describe('buildAuditReport', () => {
  it('resume conteos, borrados y pendientes de revisión', () => {
    const list = [
      classifySite('p', 'p', REF, false),
      classifySite('p', 'kasa-kalle-ar', REF, true),
      classifySite('p', 'vtx-viejo', REF, false),
      classifySite('p', 'vtx-con-contenido', REF, true),
    ];
    const report = buildAuditReport(list, [{ projectId: 'p', siteId: 'vtx-viejo' }], '2026-09-19');
    expect(report.date).toBe('2026-09-19');
    expect(report.totalSites).toBe(4);
    expect(report.inUse).toBe(1);
    expect(report.orphan).toBe(2);
    expect(report.protectedSites).toBe(1);
    expect(report.deleted).toEqual(['p/vtx-viejo']);
    expect(report.pendingReview).toEqual([{ projectId: 'p', siteId: 'vtx-con-contenido' }]);
  });
});

describe('siteIdFromName', () => {
  it('extrae el id del recurso de Hosting', () => {
    expect(siteIdFromName('projects/vtx-sd-abc/sites/vtx-locura')).toBe('vtx-locura');
  });
});
