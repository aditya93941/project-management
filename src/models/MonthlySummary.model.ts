import mongoose, { Schema, Document } from 'mongoose'

export interface IMonthlySummary extends Document<string> {
  _id: string
  userId: string
  month: number
  year: number
  totalTasksCompleted: number
  averageDailyProgress: number
  totalBlockers: number
  blockerTrends: Array<{
    week: number
    blockers: number
  }>
  weeklySummaries: string[] // Array of WeeklySummary IDs
  createdAt: Date
  updatedAt: Date
}

const MonthlySummarySchema = new Schema<IMonthlySummary>(
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
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
      index: true,
    },
    totalTasksCompleted: {
      type: Number,
      required: true,
      default: 0,
    },
    averageDailyProgress: {
      type: Number,
      required: true,
      default: 0,
    },
    totalBlockers: {
      type: Number,
      required: true,
      default: 0,
    },
    blockerTrends: [
      {
        week: Number,
        blockers: Number,
      },
    ],
    weeklySummaries: [
      {
        type: String,
        ref: 'WeeklySummary',
      },
    ],
  },
  {
    timestamps: true,
    _id: false,
  }
)

// Compound index to ensure one summary per user per month
MonthlySummarySchema.index({ userId: 1, month: 1, year: 1 }, { unique: true })

export const MonthlySummary = mongoose.model<IMonthlySummary>('MonthlySummary', MonthlySummarySchema)

