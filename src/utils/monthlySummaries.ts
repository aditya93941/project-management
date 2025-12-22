import { WeeklySummary, MonthlySummary, User, UserRole } from '../models'
import { generateId } from './generateId'

/**
 * Generate monthly summaries from weekly summaries
 * Runs at the beginning of each month
 */
export async function generateMonthlySummaries(): Promise<{
  generatedCount: number
  error?: string
}> {
  try {
    // Get last month
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const month = lastMonth.getMonth() + 1 // 1-12
    const year = lastMonth.getFullYear()

    // Get all developers
    const developers = await User.find({ role: UserRole.DEVELOPER })

    let generatedCount = 0

    for (const developer of developers) {
      // Check if summary already exists for this month
      const existingSummary = await MonthlySummary.findOne({
        userId: developer._id,
        month,
        year,
      })

      if (existingSummary) {
        continue // Already generated
      }

      // Get all weekly summaries for last month
      const weeklySummaries = await WeeklySummary.find({
        userId: developer._id,
        year,
      }).lean()

      // Filter by month (approximate - using week start dates)
      const monthSummaries = weeklySummaries.filter((ws) => {
        const weekStart = new Date(ws.weekStartDate)
        return weekStart.getMonth() + 1 === month && weekStart.getFullYear() === year
      })

      if (monthSummaries.length === 0) {
        continue // No data for this month
      }

      // Aggregate data
      const totalTasksCompleted = monthSummaries.reduce(
        (sum, ws) => sum + ws.tasksCompleted,
        0
      )
      const totalBlockers = monthSummaries.reduce((sum, ws) => sum + ws.blockers, 0)

      // Calculate average daily progress (approximate)
      const totalDays = monthSummaries.length * 5 // Approximate working days per week
      const averageDailyProgress = totalDays > 0 ? totalTasksCompleted / totalDays : 0

      // Blocker trends (by week)
      const blockerTrends = monthSummaries.map((ws) => ({
        week: ws.weekNumber,
        blockers: ws.blockers,
      }))

      // Create monthly summary
      const summaryId = generateId()
      await MonthlySummary.create({
        _id: summaryId,
        userId: developer._id,
        month,
        year,
        totalTasksCompleted,
        averageDailyProgress,
        totalBlockers,
        blockerTrends,
        weeklySummaries: monthSummaries.map((ws) => ws._id),
      })

      generatedCount++
    }

    return { generatedCount }
  } catch (error: any) {
    console.error('Error generating monthly summaries:', error)
    return { generatedCount: 0, error: error.message }
  }
}

