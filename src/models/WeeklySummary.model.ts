import mongoose, { Schema, Document } from 'mongoose'

export interface IWeeklySummary extends Document<string> {
  _id: string
  userId: string
  weekStartDate: Date
  weekEndDate: Date
  weekNumber: number
  year: number
  tasksCompleted: number
  tasksInProgress: number
  blockers: number
  completedTaskDetails?: Array<{
    taskId: string
    title: string
    type?: string
    priority?: string
  }>
  inProgressTaskDetails?: Array<{
    taskId: string
    title: string
    type?: string
    priority?: string
    progress: number
  }>
  createdAt: Date
  updatedAt: Date
}

const WeeklySummarySchema = new Schema<IWeeklySummary>(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    weekStartDate: {
      type: Date,
      required: true,
      index: true,
    },
    weekEndDate: {
      type: Date,
      required: true,
    },
    weekNumber: {
      type: Number,
      required: true,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    tasksCompleted: {
      type: Number,
      required: true,
      default: 0,
    },
    tasksInProgress: {
      type: Number,
      required: true,
      default: 0,
    },
    blockers: {
      type: Number,
      required: true,
      default: 0,
    },
    completedTaskDetails: [
      {
        taskId: String,
        title: String,
        type: String,
        priority: String,
      },
    ],
    inProgressTaskDetails: [
      {
        taskId: String,
        title: String,
        type: String,
        priority: String,
        progress: Number,
      },
    ],
  },
  {
    timestamps: true,
    _id: false,
  }
)

// Compound index to ensure one summary per user per week
WeeklySummarySchema.index({ userId: 1, weekNumber: 1, year: 1 }, { unique: true })

export const WeeklySummary = mongoose.model<IWeeklySummary>('WeeklySummary', WeeklySummarySchema)

