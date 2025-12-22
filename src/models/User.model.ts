import mongoose, { Schema, Document } from 'mongoose'

export enum UserRole {
  MANAGER = 'MANAGER',           // Superadmin
  GROUP_HEAD = 'GROUP_HEAD',      // Admin
  TEAM_LEAD = 'TEAM_LEAD',        // Team Lead
  DEVELOPER = 'DEVELOPER',        // Developer
}

export interface IUser extends Document<string> {
  _id: string
  name: string
  email: string
  image: string
  role: UserRole
  password?: string
  localCreatedAt?: string
  createdAt: Date
  updatedAt: Date
}

const UserSchema = new Schema<IUser>(
  {
    _id: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.DEVELOPER,
      required: true,
    },
    localCreatedAt: {
      type: String,
      required: false,
    },
    password: {
      type: String,
      select: false, // Don't include password in queries by default
    },
  },
  {
    timestamps: true,
    _id: false, // Use custom _id
  }
)

// Note: email index is automatically created by unique: true
// Additional indexes for better query performance
UserSchema.index({ role: 1 }) // For filtering by role
UserSchema.index({ createdAt: -1 }) // For sorting by creation date

export const User = mongoose.model<IUser>('User', UserSchema)

