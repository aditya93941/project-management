import { Response } from 'express'
import { AuthRequest } from '../middleware/auth.middleware'
import { MonthlySummary, UserRole } from '../models'

/**
 * Get monthly summaries with RBAC
 */
export const getMonthlySummaries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user
    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const { userId, month, year } = req.query

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

    if (month) {
      filter.month = parseInt(month as string)
    }
    if (year) {
      filter.year = parseInt(year as string)
    }

    const page = parseInt(req.query.page as string) || 1
    const limit = parseInt(req.query.limit as string) || 50
    const skip = (page - 1) * limit

    const [summaries, total] = await Promise.all([
      MonthlySummary.find(filter)
        .populate('userId', 'name email role')
        .populate('weeklySummaries')
        .sort({ year: -1, month: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      MonthlySummary.countDocuments(filter),
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
 * Get a specific monthly summary
 */
export const getMonthlySummaryById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const user = req.user

    if (!user) {
      res.status(401).json({ message: 'Authentication required' })
      return
    }

    const summary = await MonthlySummary.findById(id)
      .populate('userId', 'name email role')
      .populate('weeklySummaries')
      .lean()

    if (!summary) {
      res.status(404).json({ message: 'Monthly summary not found' })
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

