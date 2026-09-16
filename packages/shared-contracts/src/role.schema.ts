import { z } from 'zod';

export const RoleSchema = z.enum(['owner', 'admin', 'staff']);
export type Role = z.infer<typeof RoleSchema>;

export const AdminRoleRecordSchema = z.object({
  role: RoleSchema,
  tenantId: z.string(),
  email: z.string().email().optional(),
  source: z.string().optional(),
  createdAt: z.any().optional(),
  updatedAt: z.any().optional(),
});
export type AdminRoleRecord = z.infer<typeof AdminRoleRecordSchema>;
