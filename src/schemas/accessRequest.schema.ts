import { z } from 'zod'

export const createAccessRequestSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
})

export const updateAccessRequestSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']),
})

export type CreateAccessRequestInput = z.infer<typeof createAccessRequestSchema>
export type UpdateAccessRequestInput = z.infer<typeof updateAccessRequestSchema>

