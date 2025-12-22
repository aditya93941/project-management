import { EODReport, EODReminder, User, UserRole, Notification } from '../models'
import { generateId } from './generateId'

/**
 * Send EOD reminders to developers who haven't submitted their report for today
 * Runs daily at 6:30 PM
 * Idempotent: Only sends one reminder per user per day
 */
export async function sendEODReminders(): Promise<{
  sentCount: number
  error?: string
}> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Get all developers
    const developers = await User.find({ role: UserRole.DEVELOPER })

    // Check which developers have submitted EOD for today
    const submittedReports = await EODReport.find({
      reportDate: {
        $gte: today,
        $lt: tomorrow,
      },
      status: 'SUBMITTED',
    }).select('userId')

    const submittedUserIds = new Set(submittedReports.map((r) => r.userId.toString()))

    // Filter developers who haven't submitted
    const developersWithoutEOD = developers.filter(
      (dev) => !submittedUserIds.has(dev._id.toString())
    )

    let sentCount = 0

    // Send reminders (idempotent - check if already sent today)
    for (const developer of developersWithoutEOD) {
      // Check if reminder already sent today
      const existingReminder = await EODReminder.findOne({
        userId: developer._id,
        reminderDate: today,
      })

      if (existingReminder) {
        continue // Already sent
      }

      // Create reminder record
      const reminderId = generateId()
      await EODReminder.create({
        _id: reminderId,
        userId: developer._id,
        reminderDate: today,
        sentAt: new Date(),
      })

      // Create notification
      const notificationId = generateId()
      await Notification.create({
        _id: notificationId,
        recipientId: developer._id,
        message: 'Please submit your EOD report for today.',
        type: 'EOD_REMINDER',
        isRead: false,
      })

      sentCount++
    }

    return { sentCount }
  } catch (error: any) {
    console.error('Error sending EOD reminders:', error)
    return { sentCount: 0, error: error.message }
  }
}

