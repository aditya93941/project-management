import mongoose, { Schema, Document } from 'mongoose'

export interface IEODReminder extends Document<string> {
  _id: string
  userId: string
  reminderDate: Date
  sentAt: Date
  createdAt: Date
}

const EODReminderSchema = new Schema<IEODReminder>(
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
    reminderDate: {
      type: Date,
      required: true,
      index: true,
    },
    sentAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
)

// Compound index to ensure one reminder per user per day
EODReminderSchema.index({ userId: 1, reminderDate: 1 }, { unique: true })

export const EODReminder = mongoose.model<IEODReminder>('EODReminder', EODReminderSchema)

