import mongoose, { Schema, Document } from 'mongoose'

export interface IComment extends Document<string> {
  _id: string
  content: string
  userId: string
  taskId: string
  createdAt: Date
  edited?: boolean
  editedAt?: Date
}

const CommentSchema = new Schema<IComment>(
  {
    _id: {
      type: String,
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
      ref: 'User',
    },
    taskId: {
      type: String,
      required: true,
      ref: 'Task',
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    _id: false,
  }
)

CommentSchema.index({ taskId: 1 })
CommentSchema.index({ userId: 1 })

export const Comment = mongoose.model<IComment>('Comment', CommentSchema)

