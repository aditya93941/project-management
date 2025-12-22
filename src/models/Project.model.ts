import mongoose, { Schema, Document } from 'mongoose'
import { ProjectPriority, ProjectStatus } from '../types'

export interface IProject extends Document<string> {
  _id: string
  name: string
  description?: string
  priority: ProjectPriority
  status: ProjectStatus
  start_date?: Date
  end_date?: Date
  team_lead: string
  progress: number
  createdAt: Date
  updatedAt: Date
}

const ProjectSchema = new Schema<IProject>(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    priority: {
      type: String,
      enum: Object.values(ProjectPriority),
      default: ProjectPriority.MEDIUM,
    },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      default: ProjectStatus.ACTIVE,
    },
    start_date: {
      type: Date,
    },
    end_date: {
      type: Date,
    },
    team_lead: {
      type: String,
      required: true,
      ref: 'User',
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
)

// Indexes for better query performance
ProjectSchema.index({ team_lead: 1 })
ProjectSchema.index({ status: 1 }) // For filtering by status
ProjectSchema.index({ priority: 1 }) // For filtering by priority
ProjectSchema.index({ createdAt: -1 }) // For sorting by creation date
ProjectSchema.index({ team_lead: 1, status: 1 }) // Common query: projects by team lead and status

export const Project = mongoose.model<IProject>('Project', ProjectSchema)

// ProjectMember model
export interface IProjectMember extends Document<string> {
  _id: string
  userId: string
  projectId: string
}

const ProjectMemberSchema = new Schema<IProjectMember>(
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
    projectId: {
      type: String,
      required: true,
      ref: 'Project',
    },
  },
  {
    timestamps: false,
    _id: false,
  }
)

ProjectMemberSchema.index({ userId: 1, projectId: 1 }, { unique: true })

export const ProjectMember = mongoose.model<IProjectMember>(
  'ProjectMember',
  ProjectMemberSchema
)

