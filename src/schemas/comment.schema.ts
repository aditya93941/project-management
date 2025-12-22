import { z } from 'zod'

export const createCommentSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  content: z.string().min(1, 'Comment content is required'),
})

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
})

export const commentParamsSchema = z.object({
  id: z.string().min(1, 'Comment ID is required'),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
