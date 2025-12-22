import { z } from 'zod'

export const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE'])
export const taskTypeSchema = z.enum(['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT', 'OTHER'])
export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])

export const createTaskSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  title: z.string().min(1, 'Task title is required'),
  description: z.string().optional(),
  status: taskStatusSchema.default('TODO'),
  type: taskTypeSchema.default('TASK'),
  priority: taskPrioritySchema.default('MEDIUM'),
  assigneeId: z.string().optional(),
  due_date: z.coerce.date(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: taskStatusSchema.optional(),
  type: taskTypeSchema.optional(),
  priority: taskPrioritySchema.optional(),
  assigneeId: z.string().optional(),
  due_date: z.coerce.date().optional(),
})

export const taskParamsSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
