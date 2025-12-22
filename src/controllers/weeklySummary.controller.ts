import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { WeeklySummary, UserRole } from '../models'

/**
 * Get weekly summaries with RBAC
 */
export const getWeeklySummaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const { userId, weekNumber, year } = req.query

    const filter: any = {}

    if (user.role === UserRole.DEVELOPER) {
      filter.userId = user.id
    } else if (user.role === UserRole.TEAM_LEAD) {
      if (userId) {
        filter.userId = userId
      } else {
        filter.userId = user.id
      }
    } else if (user.role === UserRole.GROUP_HEAD || user.role === UserRole.MANAGER) {
      if (userId) {
        filter.userId = userId
      }
    }

    if (weekNumber) {
      filter.weekNumber = parseInt(weekNumber as string)
    }
    if (year) {
      filter.year = parseInt(year as string)
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const skip = (page - 1) * limit

    const [summaries, total] = await Promise.all([
      WeeklySummary.find(filter)
        .populate('userId', 'name email role')
        .sort({ year: -1, weekNumber: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WeeklySummary.countDocuments(filter),
    ])

    res.json({
      data: summaries,
      total,
      page,
      limit,
    })
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

/**
 * Get a specific weekly summary
 */
export const getWeeklySummaryById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const user = req.user

    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const summary = await WeeklySummary.findById(id)
      .populate('userId', 'name email role')
      .lean()

    if (!summary) {
      res.status(404).json({ message: 'Weekly summary not found' })
      return
    }

    // RBAC check
    if (user.role === UserRole.DEVELOPER && summary.userId !== user.id) {
      res.status(403).json({ message: 'You can only view your own summaries' })
      return
    }

    res.json(summary)
  } catch (error: any) {
    res.status(400).json({ message: error.message })
  }
}

