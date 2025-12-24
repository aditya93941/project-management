import { Project, Task, EODTask } from '../models'
import { TaskStatus, ProjectStatus } from '../types'
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

    // Get actual progress from EOD reports for in-progress tasks
    let inProgressWeight = 0
    if (inProgressTasks.length > 0) {
      const inProgressTaskIds = inProgressTasks.map(t => t._id.toString())
      
      // Get the latest EOD task progress for each in-progress task
      // Use the most recent progress value for each task
      const eodTasks = await EODTask.find({
        taskId: { $in: inProgressTaskIds },
        status: 'IN_PROGRESS',
      })
        .sort({ createdAt: -1 }) // Get most recent first
        .lean()
      
      // Create a map of taskId -> latest progress
      const taskProgressMap = new Map<string, number>()
      for (const eodTask of eodTasks) {
        const taskId = eodTask.taskId.toString()
        if (!taskProgressMap.has(taskId)) {
          // Use the first (most recent) progress value for each task
          taskProgressMap.set(taskId, eodTask.progress || 0)
        }
      }
      
      // Calculate weighted progress for in-progress tasks
      for (const task of inProgressTasks) {
        const taskId = task._id.toString()
        const progress = taskProgressMap.get(taskId) || 50 // Default to 50% if no EOD data
        inProgressWeight += progress / 100 // Convert percentage to decimal
      }
    } else {
      // Fallback: if no EOD data available, use 50% as default
      inProgressWeight = inProgressTasks.length * 0.5
    }
    
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

/**
 * Update project status automatically based on task completion
 * - Auto-complete project if all tasks are done
 * - Reactivate project if it was completed but now has incomplete tasks
 */
export const updateProjectStatus = async (projectId: string): Promise<void> => {
  try {
    const tasks = await Task.find({ projectId })
    const project = await Project.findById(projectId)
    
    if (!project) {
      logger.error(`[updateProjectStatus] Project ${projectId} not found`)
      return
    }
    
    if (tasks.length === 0) {
      // No tasks - keep current status (could be PLANNING)
      return
    }
    
    const allTasksDone = tasks.every(t => t.status === TaskStatus.DONE)
    
    if (allTasksDone && project.status !== ProjectStatus.COMPLETED) {
      // All tasks done - auto-complete project
      await Project.findByIdAndUpdate(projectId, { 
        status: ProjectStatus.COMPLETED 
      })
      logger.log(`[updateProjectStatus] Auto-completed project ${projectId} - all tasks done`)
    } else if (!allTasksDone && project.status === ProjectStatus.COMPLETED) {
      // Project was completed but now has incomplete tasks - reactivate
      await Project.findByIdAndUpdate(projectId, { 
        status: ProjectStatus.ACTIVE 
      })
      logger.log(`[updateProjectStatus] Reactivated project ${projectId} - incomplete tasks found`)
    }
  } catch (error) {
    // Log error but don't throw - status update is non-critical
    logger.error(`[updateProjectStatus] Error updating status for project ${projectId}:`, error)
  }
}

