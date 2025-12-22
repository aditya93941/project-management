import { Response } from 'express'
import { Notification } from '../models'
import { AuthRequest } from '../middleware/auth.middleware'

export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized' })
            return
        }

        const notifications = await Notification.find({ recipientId: userId })
            .populate('senderId', 'name image') // Populate sender details for UI
            .populate('taskId', 'title projectId') // Populate task details
            .populate('projectId', 'name') // Populate project details for permission notifications
            .sort({ createdAt: -1 })
            .limit(50) // Limit to last 50 notifications

        res.json(notifications)
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

export const markAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const { id } = req.params
        const userId = req.user?.id

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipientId: userId },
            { isRead: true },
            { new: true }
        )

        if (!notification) {
            res.status(404).json({ message: 'Notification not found' })
            return
        }

        res.json(notification)
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}

export const markAllAsRead = async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id

        await Notification.updateMany(
            { recipientId: userId, isRead: false },
            { isRead: true }
        )

        res.json({ message: 'All notifications marked as read' })
    } catch (error: any) {
        res.status(500).json({ message: error.message })
    }
}
