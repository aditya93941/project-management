import { z } from 'zod'

// Schema for task in EOD report
const eodTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
  status: z.enum(['COMPLETED', 'IN_PROGRESS']),
  progress: z.number().int().min(0).max(100).optional(), // Required for IN_PROGRESS
})

export const createEODReportSchema = z.object({
  reportDate: z.string().optional(), // ISO date string, defaults to today
  // New task-based fields
  completedTasks: z.array(eodTaskSchema).default([]), // Array of task IDs marked as completed
  inProgressTasks: z.array(eodTaskSchema).default([]), // Array of task IDs with progress
  blockedTasks: z.array(z.string()).default([]), // Array of task IDs that are blocked
  blockersText: z.string().max(500).optional(), // Text description of blockers
  planForTomorrow: z.string().max(500).optional(), // Plan for tomorrow
  notes: z.string().max(1000).optional(),
  // Legacy fields (kept for backward compatibility)
  tasksCompleted: z.number().int().min(0).default(0).optional(),
  tasksInProgress: z.number().int().min(0).default(0).optional(),
  blockers: z.number().int().min(0).default(0).optional(),
}).refine(
  (data) => {
    // Validate that IN_PROGRESS tasks have progress
    return data.inProgressTasks.every(
      (task) => task.status === 'IN_PROGRESS' ? (task.progress !== undefined && task.progress >= 0 && task.progress <= 100) : true
    )
  },
  {
    message: 'IN_PROGRESS tasks must have progress percentage (0-100)',
    path: ['inProgressTasks'],
  }
)

export const updateEODReportSchema = z.object({
  completedTasks: z.array(eodTaskSchema).optional(),
  inProgressTasks: z.array(eodTaskSchema).optional(),
  blockedTasks: z.array(z.string()).optional(),
  blockersText: z.string().max(500).optional(),
  planForTomorrow: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
  // Legacy fields
  tasksCompleted: z.number().int().min(0).optional(),
  tasksInProgress: z.number().int().min(0).optional(),
  blockers: z.number().int().min(0).optional(),
}).refine(
  (data) => {
    if (!data.inProgressTasks) return true
    return data.inProgressTasks.every(
      (task) => task.status === 'IN_PROGRESS' ? (task.progress !== undefined && task.progress >= 0 && task.progress <= 100) : true
    )
  },
  {
    message: 'IN_PROGRESS tasks must have progress percentage (0-100)',
    path: ['inProgressTasks'],
  }
)

export const submitEODReportSchema = z.object({
  reportDate: z.string().optional(), // ISO date string, defaults to today
  scheduledSubmitAt: z.string().optional(), // ISO date string for scheduled submission
  submitNow: z.boolean().optional().default(true), // If true, submit immediately; if false, schedule
  // Allow task updates during submission (for resubmission)
  completedTasks: z.array(eodTaskSchema).optional(),
  inProgressTasks: z.array(eodTaskSchema).optional(),
  blockedTasks: z.array(z.string()).optional(),
  blockersText: z.string().max(500).optional(),
  planForTomorrow: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
})

export const eodReportParamsSchema = z.object({
  id: z.string().min(1, 'EOD Report ID is required'),
})

export const eodReportQuerySchema = z.object({
  userId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  month: z.string().optional(),
  year: z.string().optional(),
})

export type CreateEODReportInput = z.infer<typeof createEODReportSchema>
export type UpdateEODReportInput = z.infer<typeof updateEODReportSchema>
export type SubmitEODReportInput = z.infer<typeof submitEODReportSchema>

