import mongoose, { Schema, Document } from 'mongoose'

// Fix for: Interface 'INotification' incorrectly extends interface 'Document'. Types of property '_id' are incompatible.
export interface INotification extends Omit<Document, '_id'> {
    _id: string
    recipientId: string
    senderId?: string // Optional for system notifications
    taskId?: string
    message: string
    isRead: boolean
    type: 'INFO' | 'PROJECT_ADD' | 'TASK_ASSIGN' | 'PERMISSION_APPROVED' | 'PERMISSION_REJECTED' | 'PERMISSION_REQUESTED' | 'PERMISSION_GRANTED' | 'PERMISSION_REVOKED' | 'PERMISSION_EXPIRING' | 'PERMISSION_EXPIRED' | 'EOD_REMINDER'
    relatedId?: string // To store project ID, task ID, or permission ID for navigation
    projectId?: string // For permission notifications, store project ID directly
    createdAt: Date
}

const NotificationSchema = new Schema<INotification>(
    {
        _id: {
            type: String,
            required: true,
        },
        recipientId: {
            type: String,
            required: true,
            ref: 'User',
        },
        senderId: {
            type: String,
            required: false, // Optional for system notifications
            ref: 'User',
        },
        taskId: {
            type: String,
            required: false, // Optional for project notifications
            ref: 'Task',
        },
        message: {
            type: String,
            required: true,
        },
        isRead: {
            type: Boolean,
            default: false,
        },
        type: {
            type: String,
            enum: ['INFO', 'PROJECT_ADD', 'TASK_ASSIGN', 'PERMISSION_APPROVED', 'PERMISSION_REJECTED', 'PERMISSION_REQUESTED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'PERMISSION_EXPIRING', 'PERMISSION_EXPIRED', 'EOD_REMINDER'],
            default: 'INFO',
        },
        relatedId: {
            type: String,
            required: false,
        },
        projectId: {
            type: String,
            required: false,
            ref: 'Project',
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
        _id: false,
    }
)

NotificationSchema.index({ recipientId: 1, isRead: 1 })
NotificationSchema.index({ createdAt: -1 })

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema)
