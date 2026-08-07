import { Storage } from '@google-cloud/storage';

const storage = new Storage();

const CORS_RULES = [
  {
    maxAgeSeconds: 3600,
    method: ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS'],
    origin: ['*'],
    responseHeader: ['*'],
  },
];

export async function setBucketCors(bucketName: string): Promise<void> {
  try {
    console.log(`⏳ Aplicando reglas CORS para gs://${bucketName}...`);
    await storage.bucket(bucketName).setCorsConfiguration(CORS_RULES);
    console.log(`✅ CORS configurado exitosamente para gs://${bucketName}`);
  } catch (err) {
    console.error(`❌ Error al configurar CORS en gs://${bucketName}:`, err);
  }
}

async function main() {
  const targetBucket = process.argv[2];
  if (targetBucket) {
    await setBucketCors(targetBucket);
    return;
  }

  const defaultBuckets = [
    'ecommerce-vertex-dev.appspot.com',
    'ecommerce-vertex-dev.firebasestorage.app',
    'ecommerce-vertex.appspot.com',
    'ecommerce-vertex.firebasestorage.app',
    'vertex-platform-dev.appspot.com',
    'vertex-platform-app.appspot.com',
  ];

  console.log('🚀 Aplicando configuración CORS predeterminada a buckets activos...');
  for (const bucket of defaultBuckets) {
    await setBucketCors(bucket);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
