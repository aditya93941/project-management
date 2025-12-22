import mongoose, { Schema, Document } from 'mongoose'

export enum EODStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

export interface IEODReport extends Document<string> {
  _id: string
  userId: string
  reportDate: Date
  // Legacy fields (kept for backward compatibility, calculated from tasks)
  tasksCompleted: number
  tasksInProgress: number
  blockers: number
  blockersText?: string // Text description of blockers
  blockedTasks?: string[] // Array of task IDs that are blocked
  planForTomorrow?: string // Plan for tomorrow
  notes?: string
  status: EODStatus
  submittedAt?: Date
  scheduledSubmitAt?: Date // When to auto-submit (if scheduled)
  isFinal: boolean // True after end of day, prevents further edits
  createdAt: Date
  updatedAt: Date
}

const EODReportSchema = new Schema<IEODReport>(
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
    reportDate: {
      type: Date,
      required: true,
      index: true,
    },
    tasksCompleted: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    tasksInProgress: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    blockers: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    blockersText: {
      type: String,
      maxlength: 500,
    },
    blockedTasks: {
      type: [String],
      default: [],
    },
    planForTomorrow: {
      type: String,
      maxlength: 500,
    },
    notes: {
      type: String,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: Object.values(EODStatus),
      default: EODStatus.DRAFT,
    },
    submittedAt: {
      type: Date,
    },
    scheduledSubmitAt: {
      type: Date,
      index: true, // Index for cron job queries
    },
    isFinal: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
)

// Compound index to ensure one EOD per user per day
EODReportSchema.index({ userId: 1, reportDate: 1 }, { unique: true })

export const EODReport = mongoose.model<IEODReport>('EODReport', EODReportSchema)

