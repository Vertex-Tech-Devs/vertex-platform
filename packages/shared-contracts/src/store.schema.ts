import { z } from 'zod';

export const StoreConfigSchema = z.object({
  setupCompleted: z.boolean(),
  storeName: z.string(),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  colorPrimary: z.string(),
  colorAccent: z.string(),
  colorBackground: z.string(),
  mercadoPagoPublicKey: z.string().optional(),
  contactPhone: z.string().optional(),
  contactEmail: z.string(),
  whatsappNumber: z.string().optional(),
  instagramUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  metaDescription: z.string().optional(),
  updatedAt: z.string().optional(),
}).strict();
