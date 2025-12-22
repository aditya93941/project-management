import mongoose, { Schema, Document } from 'mongoose'

export enum EODTaskStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
}

export interface IEODTask extends Document<string> {
  _id: string
  eodReportId: string // Reference to EODReport
  taskId: string // Reference to Task
  status: EODTaskStatus
  progress?: number // 0-100, only for IN_PROGRESS tasks
  createdAt: Date
}

const EODTaskSchema = new Schema<IEODTask>(
  {
    _id: {
      type: String,
      required: true,
    },
    eodReportId: {
      type: String,
      required: true,
      ref: 'EODReport',
      index: true,
    },
    taskId: {
      type: String,
      required: true,
      ref: 'Task',
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(EODTaskStatus),
      required: true,
    },
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    _id: false,
  }
)

// Compound index to prevent duplicate task entries in same EOD
EODTaskSchema.index({ eodReportId: 1, taskId: 1 }, { unique: true })

export const EODTask = mongoose.model<IEODTask>('EODTask', EODTaskSchema)

