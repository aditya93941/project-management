import mongoose, { Schema, Document } from 'mongoose'

export enum AccessRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface IAccessRequest extends Document<string> {
  _id: string
  name: string
  email: string
  status: AccessRequestStatus
  requestedAt: Date
  reviewedAt?: Date
  reviewedBy?: string
  createdAt: Date
  updatedAt: Date
}

const AccessRequestSchema = new Schema<IAccessRequest>(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(AccessRequestStatus),
      default: AccessRequestStatus.PENDING,
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    reviewedAt: {
      type: Date,
    },
    reviewedBy: {
      type: String,
      ref: 'User',
    },
  },
  {
    timestamps: true,
    _id: false,
  }
)

export const AccessRequest = mongoose.model<IAccessRequest>('AccessRequest', AccessRequestSchema)

