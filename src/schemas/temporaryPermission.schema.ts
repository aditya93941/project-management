import { z } from 'zod'

export const grantTemporaryPermissionSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  projectId: z.string().min(1, 'Project ID is required'),
  durationDays: z.number().int().min(1).max(90).optional().default(7), // Default 7 days, max 90
  customExpiryDate: z.coerce.date().optional(), // Alternative to durationDays
  reason: z.string().max(500).optional(),
})

export const revokeTemporaryPermissionSchema = z.object({
  permissionId: z.string().min(1, 'Permission ID is required'),
})

export const temporaryPermissionParamsSchema = z.object({
  id: z.string().min(1, 'Permission ID is required'),
})

export type GrantTemporaryPermissionInput = z.infer<typeof grantTemporaryPermissionSchema>
export type RevokeTemporaryPermissionInput = z.infer<typeof revokeTemporaryPermissionSchema>

