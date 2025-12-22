import { Project, Task } from '../models'
import { TaskStatus } from '../types'
import { logger } from './logger'

/**
 * Calculate project progress based on task completion
 * Formula: (Completed tasks + (In-progress tasks * average progress)) / Total tasks * 100
 * If no tasks exist, returns 0
 */
export const calculateProjectProgress = async (projectId: string): Promise<number> => {
  try {
    const tasks = await Task.find({ projectId })
    
    if (tasks.length === 0) {
      return 0
    }

    const completedTasks = tasks.filter(t => t.status === TaskStatus.DONE)
    const inProgressTasks = tasks.filter(t => t.status === TaskStatus.IN_PROGRESS)
    const totalTasks = tasks.length

    // Get progress from EOD reports for in-progress tasks
    // For now, we'll use a simple calculation: in-progress tasks count as 50% complete
    // This can be enhanced later to use actual progress from EOD reports
    const inProgressWeight = inProgressTasks.length * 0.5 // 50% weight for in-progress tasks
    
    // Calculate progress: (completed + in-progress weighted) / total * 100
    const progress = Math.round(((completedTasks.length + inProgressWeight) / totalTasks) * 100)
    
    // Ensure progress is between 0 and 100
    return Math.max(0, Math.min(100, progress))
  } catch (error) {
    // If calculation fails, return 0
    logger.error(`[calculateProjectProgress] Error calculating progress for project ${projectId}:`, error)
    return 0
  }
}

/**
 * Update project progress automatically
 */
export const updateProjectProgress = async (projectId: string): Promise<void> => {
  try {
    const progress = await calculateProjectProgress(projectId)
    await Project.findByIdAndUpdate(projectId, { progress }, { new: true })
  } catch (error) {
    // Log error but don't throw - progress update is non-critical
    logger.error(`[updateProjectProgress] Error updating progress for project ${projectId}:`, error)
  }
}

