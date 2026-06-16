import * as p from '@clack/prompts';
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'src/environments/store.config.ts');

const required = (v: string): string | undefined =>
  v.trim() ? undefined : 'Campo obligatorio';

const CURRENCY_MAP: Record<string, { symbol: string; country: string }> = {
  ARS: { symbol: '$', country: 'AR' },
  USD: { symbol: 'US$', country: 'US' },
  MXN: { symbol: '$', country: 'MX' },
  BRL: { symbol: 'R$', country: 'BR' },
  CLP: { symbol: '$', country: 'CL' },
  COP: { symbol: '$', country: 'CO' },
  EUR: { symbol: '€', country: 'ES' },
};

const onCancel = (): void => {
  p.cancel('Setup cancelado.');
  process.exit(0);
};

function generateFile(cfg: Record<string, string>): string {
  return `import type { StoreConfig } from '../app/core/models/store-config.model';

export const STORE_CONFIG: Omit<StoreConfig, 'id'> = {
  storeName: ${JSON.stringify(cfg['storeName'])},
  strapline: ${JSON.stringify(cfg['strapline'])},
  logoUrl: ${JSON.stringify(cfg['logoUrl'])},
  contact: {
    email: ${JSON.stringify(cfg['email'])},
    phone: ${JSON.stringify(cfg['phone'])},
    whatsapp: ${JSON.stringify(cfg['whatsapp'])},
    instagram: ${JSON.stringify(cfg['instagram'])},
    facebook: ${JSON.stringify(cfg['facebook'])},
  },
  seo: {
    metaTitle: ${JSON.stringify(cfg['metaTitle'])},
    metaDescription: ${JSON.stringify(cfg['metaDescription'])},
  },
  features: {
    seedDataEnabled: true,
    reviewsEnabled: false,
    wishlistEnabled: false,
    blogEnabled: false,
  },
  currency: ${JSON.stringify(cfg['currency'])},
  currencySymbol: ${JSON.stringify(cfg['currencySymbol'])},
  country: ${JSON.stringify(cfg['country'])},
  createdAt: new Date(),
};
`;
}

async function main(): Promise<void> {
  p.intro('  Vertex Template — Store Setup Wizard  ');

  const identity = await p.group(
    {
      storeName: () =>
        p.text({ message: 'Nombre de tu tienda', placeholder: 'Mi Tienda', validate: required }),
      strapline: () =>
        p.text({
          message: 'Slogan o descripción corta',
          placeholder: 'Tu tienda online',
          defaultValue: 'Tu tienda online',
        }),
      logoUrl: () =>
        p.text({
          message: 'URL del logo (opcional)',
          placeholder: 'https://tudominio.com/logo.png',
          defaultValue: '',
        }),
    },
    { onCancel }
  );

  const contact = await p.group(
    {
      email: () =>
        p.text({ message: 'Email de contacto', placeholder: 'hola@tutienda.com', defaultValue: '' }),
      phone: () =>
        p.text({ message: 'Teléfono (opcional)', placeholder: '+54 11 1234-5678', defaultValue: '' }),
      whatsapp: () =>
        p.text({
          message: 'WhatsApp — número completo con código país (opcional)',
          placeholder: '+5491112345678',
          defaultValue: '',
        }),
      instagram: () =>
        p.text({
          message: 'URL de Instagram (opcional)',
          placeholder: 'https://instagram.com/tutienda',
          defaultValue: '',
        }),
      facebook: () =>
        p.text({
          message: 'URL de Facebook (opcional)',
          placeholder: 'https://facebook.com/tutienda',
          defaultValue: '',
        }),
    },
    { onCancel }
  );

  const seo = await p.group(
    {
      metaTitle: () =>
        p.text({
          message: 'Meta title (SEO)',
          placeholder: identity.storeName,
          defaultValue: identity.storeName,
        }),
      metaDescription: () =>
        p.text({
          message: 'Meta description (SEO)',
          placeholder: 'Bienvenido a nuestra tienda online.',
          defaultValue: 'Bienvenido a nuestra tienda online.',
        }),
    },
    { onCancel }
  );

  const regional = await p.group(
    {
      currency: () =>
        p.select({
          message: 'Moneda',
          options: [
            { value: 'ARS', label: 'ARS — Peso argentino ($)' },
            { value: 'USD', label: 'USD — Dólar estadounidense (US$)' },
            { value: 'MXN', label: 'MXN — Peso mexicano ($)' },
            { value: 'BRL', label: 'BRL — Real brasileño (R$)' },
            { value: 'CLP', label: 'CLP — Peso chileno ($)' },
            { value: 'COP', label: 'COP — Peso colombiano ($)' },
            { value: 'EUR', label: 'EUR — Euro (€)' },
          ],
          initialValue: 'ARS',
        }),
    },
    { onCancel }
  );

  const currency = regional.currency as string;
  const { symbol: currencySymbol, country } = CURRENCY_MAP[currency] ?? {
    symbol: '$',
    country: 'AR',
  };

  const cfg: Record<string, string> = {
    ...identity,
    ...contact,
    ...seo,
    currency,
    currencySymbol,
    country,
  };

  writeFileSync(OUTPUT, generateFile(cfg), 'utf-8');

  p.outro(
    `Listo. ${OUTPUT} generado.\n  Próximo paso: abrí la app y usá el seed tool (/dev/seed) para poblar Firestore.`
  );
}

void main();
