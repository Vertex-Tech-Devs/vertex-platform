import { z } from 'zod';
import { StoreConfigSchema } from './store.schema';
import { FooterConfigSchema } from './footer.schema';

export { StoreConfigSchema } from './store.schema';
export { FooterConfigSchema } from './footer.schema';

export type StoreConfig = z.infer<typeof StoreConfigSchema>;
export type FooterConfig = z.infer<typeof FooterConfigSchema>;
