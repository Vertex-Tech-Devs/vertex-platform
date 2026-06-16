import { z } from 'zod';

export const FooterConfigSchema = z.object({
  phone: z.string(),
  email: z.string(),
  socials: z.object({
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    whatsApp: z.string().optional(),
  }),
}).strict();
