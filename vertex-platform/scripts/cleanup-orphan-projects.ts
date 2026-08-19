#!/usr/bin/env node
/**
 * cleanup-orphan-projects.ts — Script de eliminación segura de proyectos huérfanos GCP.
 *
 * Valida de forma estricta contra SAFE_LIST antes de ejecutar cualquier comando de borrado.
 */
import { execSync } from 'child_process';

const SAFE_LIST = new Set([
  'vertex-platform-dev',
  'ecommerce-vertex-dev',
  'gen-lang-client-0165157701',
  'vtx-sd-w5f87ci9',
  'vtx-sd-kk0pnfg6',
  'vtx-sd-c3732d17',
  'vtx-sd-j9db0rkj',
  'vtx-sd-aia7f0ao',
  'vtx-sd-5792sth2',
  'vtx-sd-3am2uj4h',
  'vtx-sd-3z5twz4j',
  'vtx-sd-qncajqrx',
]);

const ORPHAN_PROJECTS_TO_DELETE = [
  'kasakalle-dev',
  'vtx-sd-3kwttxmt',
  'vtx-sd-h8hhzl94',
  'vtx-sd-m542px06',
  'vtx-sd-nqqr42x0',
  'vtx-sd-rkdg3g53',
  'vtx-sd-v28rjcsb',
  'vtx-sd-wlvswkm2',
  'vtx-sd-xm3rsn2y',
];

async function main(): Promise<void> {
  console.log('=== Limpieza Automatizada de Proyectos Huérfanos GCP ===\n');

  // 1. Verificación de seguridad de SAFE_LIST
  console.log('[1/2] Validando proyectos contra SAFE_LIST...');
  const unsafeTargets = ORPHAN_PROJECTS_TO_DELETE.filter((id) => SAFE_LIST.has(id));
  if (unsafeTargets.length > 0) {
    console.error(
      `❌ ERROR CRÍTICO DE SEGURIDAD: Intentando borrar proyectos intocables: ${unsafeTargets.join(', ')}`,
    );
    process.exit(1);
  }
  console.log('✅ Validación completada. Ningún proyecto a borrar pertenece a la SAFE_LIST.\n');

  // 2. Eliminación de proyectos huérfanos
  console.log('[2/2] Eliminando 9 proyectos huérfanos...');
  let successCount = 0;
  let failCount = 0;

  for (const projectId of ORPHAN_PROJECTS_TO_DELETE) {
    if (SAFE_LIST.has(projectId)) {
      console.error(`🔒 OMITIDO (SAFE-LIST): ${projectId}`);
      continue;
    }

    try {
      console.log(`🗑️ Eliminando proyecto: ${projectId}...`);
      execSync(`gcloud projects delete ${projectId} --quiet`, { stdio: 'pipe' });
      console.log(`✅ Proyecto eliminado exitosamente: ${projectId}`);
      successCount++;
    } catch (err: any) {
      const errMsg = err?.stderr?.toString() || err?.message || String(err);
      console.error(`❌ Error al eliminar ${projectId}: ${errMsg.trim()}`);
      failCount++;
    }
  }

  console.log('\n=== REPORTE FINAL DE ELIMINACIÓN DE PROYECTOS ===');
  console.log(`Proyectos procesados: ${ORPHAN_PROJECTS_TO_DELETE.length}`);
  console.log(`Proyectos eliminados exitosamente: ${successCount}`);
  console.log(`Errores: ${failCount}`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
