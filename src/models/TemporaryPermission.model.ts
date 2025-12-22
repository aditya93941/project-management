import mongoose, { Schema, Document } from 'mongoose'

export interface ITemporaryPermission extends Document<string> {
  _id: string
  userId: string // Developer who receives the permission
  projectId: string // Project scope restriction
  grantedBy: string // Admin/Group Lead/Manager who granted it
  expiresAt: Date // Auto-expiry date
  isActive: boolean // Can be manually revoked
  reason?: string // Optional reason for granting
  createdAt: Date
  updatedAt: Date
}

const TemporaryPermissionSchema = new Schema<ITemporaryPermission>(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
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
    grantedBy: {
      type: String,
      required: true,
      ref: 'User',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    reason: {
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
TemporaryPermissionSchema.index({ userId: 1, projectId: 1, isActive: 1, expiresAt: 1 })
TemporaryPermissionSchema.index({ expiresAt: 1, isActive: 1 }) // For expiry cleanup

// Virtual to check if permission is currently valid
TemporaryPermissionSchema.virtual('isValid').get(function () {
  return this.isActive && this.expiresAt > new Date()
})

export const TemporaryPermission = mongoose.model<ITemporaryPermission>(
  'TemporaryPermission',
  TemporaryPermissionSchema
)

