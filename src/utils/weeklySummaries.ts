import { EODReport, EODTask, EODTaskStatus, WeeklySummary, User, UserRole } from '../models'
import { generateId } from './generateId'

/**
 * Get week number and dates for a given date
 */
function getWeekInfo(date: Date): { weekNumber: number; year: number; startDate: Date; endDate: Date } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  const year = d.getUTCFullYear()

  // Calculate week start (Monday) and end (Sunday)
  const startDate = new Date(d)
  startDate.setUTCDate(startDate.getUTCDate() - 3) // Monday
  startDate.setUTCHours(0, 0, 0, 0)

  const endDate = new Date(startDate)
  endDate.setUTCDate(endDate.getUTCDate() + 6) // Sunday
  endDate.setUTCHours(23, 59, 59, 999)

  return { weekNumber, year, startDate, endDate }
}

/**
 * Generate weekly summaries for all developers
 * Runs every Sunday night or Monday morning
 * Aggregates EOD reports from the past week
 */
export async function generateWeeklySummaries(): Promise<{
  generatedCount: number
  error?: string
}> {
  try {
    // Get last week's date range (Sunday to Sunday)
    const now = new Date()
    const lastWeek = new Date(now)
    lastWeek.setDate(lastWeek.getDate() - 7)

    const weekInfo = getWeekInfo(lastWeek)

    // Get all developers
    const developers = await User.find({ role: UserRole.DEVELOPER })

    let generatedCount = 0

    for (const developer of developers) {
      // Check if summary already exists for this week
      const existingSummary = await WeeklySummary.findOne({
        userId: developer._id,
        weekNumber: weekInfo.weekNumber,
        year: weekInfo.year,
      })

      if (existingSummary) {
        continue // Already generated
      }

      // Get all submitted EOD reports for this week
      const eodReports = await EODReport.find({
        userId: developer._id,
        reportDate: {
          $gte: weekInfo.startDate,
          $lte: weekInfo.endDate,
        },
        status: 'SUBMITTED',
      })

      // Get all EOD task records for this week's reports
      const reportIds = eodReports.map(r => r._id)
      const eodTasks = await EODTask.find({ eodReportId: { $in: reportIds } })
        .populate('taskId', 'title status type priority')
        .lean()

      // Aggregate task data
      const completedTasks = eodTasks.filter(et => et.status === EODTaskStatus.COMPLETED)
      const inProgressTasks = eodTasks.filter(et => et.status === EODTaskStatus.IN_PROGRESS)
      
      // Get unique task IDs to count
      const completedTaskIds = new Set(completedTasks.map(et => {
        const taskId = typeof et.taskId === 'object' && et.taskId !== null ? (et.taskId as any)._id : et.taskId
        return String(taskId)
      }))
      const inProgressTaskIds = new Set(inProgressTasks.map(et => {
        const taskId = typeof et.taskId === 'object' && et.taskId !== null ? (et.taskId as any)._id : et.taskId
        return String(taskId)
      }))

      const tasksCompleted = completedTaskIds.size || eodReports.reduce((sum, report) => sum + (report.tasksCompleted || 0), 0)
      const tasksInProgress = inProgressTaskIds.size || eodReports.reduce((sum, report) => sum + (report.tasksInProgress || 0), 0)
      const blockers = eodReports.reduce((sum, report) => sum + (report.blockers || 0), 0)

      // Store task details for drill-down
      const completedTaskDetails = completedTasks.map(et => {
        const task = typeof et.taskId === 'object' && et.taskId !== null ? (et.taskId as any) : null
        return {
          taskId: typeof et.taskId === 'object' && et.taskId !== null ? (et.taskId as any)._id : et.taskId,
          title: task?.title || 'Unknown Task',
          type: task?.type,
          priority: task?.priority,
        }
      })

      const inProgressTaskDetails = inProgressTasks.map(et => {
        const task = typeof et.taskId === 'object' && et.taskId !== null ? (et.taskId as any) : null
        return {
          taskId: typeof et.taskId === 'object' && et.taskId !== null ? (et.taskId as any)._id : et.taskId,
          title: task?.title || 'Unknown Task',
          type: task?.type,
          priority: task?.priority,
          progress: et.progress || 0,
        }
      })

      // Create weekly summary
      const summaryId = generateId()
      await WeeklySummary.create({
        _id: summaryId,
        userId: developer._id,
        weekStartDate: weekInfo.startDate,
        weekEndDate: weekInfo.endDate,
        weekNumber: weekInfo.weekNumber,
        year: weekInfo.year,
        tasksCompleted,
        tasksInProgress,
        blockers,
        // Store task details for manager drill-down
        completedTaskDetails,
        inProgressTaskDetails,
      })

      generatedCount++
    }

    return { generatedCount }
  } catch (error: any) {
    console.error('Error generating weekly summaries:', error)
    return { generatedCount: 0, error: error.message }
  }
}

