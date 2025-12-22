import { z } from 'zod'

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  name: z.string().min(1, 'Name is required'),
  image: z.string().url().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['MANAGER', 'GROUP_HEAD', 'TEAM_LEAD', 'DEVELOPER']).optional().default('DEVELOPER'),
  localCreatedAt: z.string().optional(),
})

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email address').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  image: z.string().optional(), // Allow any string (URL or initials)
  role: z.enum(['MANAGER', 'GROUP_HEAD', 'TEAM_LEAD', 'DEVELOPER']).optional(),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
})

export const userParamsSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
