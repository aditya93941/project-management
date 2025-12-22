import { z } from 'zod'

export const projectStatusSchema = z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'])
export const projectPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])

export const createProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  status: projectStatusSchema,
  priority: projectPrioritySchema,
  start_date: z.coerce.date(),
  end_date: z.coerce.date().optional(),
  team_lead: z.string().optional(),
  progress: z.number().min(0).max(100).default(0),
})

export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: projectStatusSchema.optional(),
  priority: projectPrioritySchema.optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  team_lead: z.string().optional(),
  progress: z.number().min(0).max(100).optional(),
})

export const projectParamsSchema = z.object({
  id: z.string().min(1, 'Project ID is required'),
})

// Schema for adding project member - projectId comes from URL params, not body
export const addProjectMemberSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  // projectId is added from URL params in the controller, not required in body
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
