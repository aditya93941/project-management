import mongoose, { Schema, Document } from 'mongoose'

export enum PermissionRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IPermissionRequest extends Document<string> {
  _id: string
  requestedBy: string // Developer requesting permission
  projectId: string // Project they want permission for
  requestedDurationDays: number // How many days they're requesting
  reason: string // Why they need the permission
  status: PermissionRequestStatus
  reviewedBy?: string // Admin/Manager who reviewed it
  reviewedAt?: Date
  reviewNotes?: string // Optional notes from reviewer
  createdAt: Date
  updatedAt: Date
}

const PermissionRequestSchema = new Schema<IPermissionRequest>(
  {
    _id: {
      type: String,
      required: true,
    },
    requestedBy: {
      type: String,
      required: true,
      ref: 'User',
      index: true,
    },
    projectId: {
      type: String,
      required: true,
      ref: 'Project',
      index: true,
    },
    requestedDurationDays: {
      type: Number,
      required: true,
      min: 1,
      max: 90,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      enum: Object.values(PermissionRequestStatus),
      default: PermissionRequestStatus.PENDING,
      index: true,
    },
    reviewedBy: {
      type: String,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    reviewNotes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
)

// Compound index for efficient queries
PermissionRequestSchema.index({ requestedBy: 1, status: 1 })
PermissionRequestSchema.index({ projectId: 1, status: 1 })
PermissionRequestSchema.index({ status: 1, createdAt: -1 })

export const PermissionRequest = mongoose.model<IPermissionRequest>(
  'PermissionRequest',
  PermissionRequestSchema
)

