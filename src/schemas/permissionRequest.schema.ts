import { z } from 'zod'

export const createPermissionRequestSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  requestedDurationDays: z.number().int().min(1).max(90),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000, 'Reason must not exceed 1000 characters'),
})

export const reviewPermissionRequestSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewNotes: z.string().max(500).optional(),
})

export const permissionRequestParamsSchema = z.object({
  id: z.string().min(1, 'Request ID is required'),
})

export type CreatePermissionRequestInput = z.infer<typeof createPermissionRequestSchema>
export type ReviewPermissionRequestInput = z.infer<typeof reviewPermissionRequestSchema>

