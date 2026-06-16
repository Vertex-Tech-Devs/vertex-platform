import { z } from 'zod';

export const StoreConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  firebaseProjectId: z.string(),
  mercadopagoPublicKey: z.string(),
  theme: z.object({
    primaryColor: z.string(),
    secondaryColor: z.string(),
    fontId: z.string(),
  }),
}).strict();
