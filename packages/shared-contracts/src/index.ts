import { z } from 'zod';
import { StoreConfigSchema } from './store.schema';
import { FooterConfigSchema } from './footer.schema';
import { RoleSchema, AdminRoleRecordSchema } from './role.schema';

export { StoreConfigSchema } from './store.schema';
export { FooterConfigSchema } from './footer.schema';
export { RoleSchema, AdminRoleRecordSchema } from './role.schema';

export type StoreConfig = z.infer<typeof StoreConfigSchema>;
export type FooterConfig = z.infer<typeof FooterConfigSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type AdminRoleRecord = z.infer<typeof AdminRoleRecordSchema>;
