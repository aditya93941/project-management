import mongoose, { Schema, Document } from 'mongoose'
import { TaskStatus, TaskType, TaskPriority } from '../types'

export interface ITask extends Omit<Document, '_id'> {
  _id: string
  projectId: string
  title: string
  description?: string
  status: TaskStatus
  type: TaskType
  priority: TaskPriority
  assigneeId: string
  createdById: string
  due_date: Date
  createdAt: Date
  updatedAt: Date
}

const TaskSchema = new Schema<ITask>(
  {
    _id: {
      type: String,
      required: true,
    },
    projectId: {
      type: String,
      required: true,
      ref: 'Project',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      default: TaskStatus.TODO,
    },
    type: {
      type: String,
      enum: Object.values(TaskType),
      default: TaskType.TASK,
    },
    priority: {
      type: String,
      enum: Object.values(TaskPriority),
      default: TaskPriority.MEDIUM,
    },
    assigneeId: {
      type: String,
      required: false, // Allow unassigned tasks
      ref: 'User',
    },
    createdById: {
      type: String,
      required: true,
      ref: 'User',
    },
    due_date: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
)

// Indexes for better query performance
TaskSchema.index({ projectId: 1, status: 1 }) // Common query: tasks by project and status
TaskSchema.index({ assigneeId: 1, status: 1 }) // Common query: tasks by assignee and status
TaskSchema.index({ projectId: 1, assigneeId: 1 }) // Common query: tasks by project and assignee
TaskSchema.index({ due_date: 1 })
TaskSchema.index({ createdAt: -1 }) // For sorting by creation date
TaskSchema.index({ status: 1 }) // For filtering by status

export const Task = mongoose.model<ITask>('Task', TaskSchema)

