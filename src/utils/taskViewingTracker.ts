/**
 * Simple in-memory tracker for users currently viewing tasks
 * Maps taskId -> Set of userIds viewing that task
 * 
 * Note: In production, consider using Redis for distributed systems
 */
const taskViewers = new Map<string, Map<string, number>>() // taskId -> userId -> timestamp

const VIEWING_TIMEOUT = 15000 // 15 seconds - if no heartbeat, consider user not viewing

/**
 * Mark a user as viewing a task
 */
export const markUserViewingTask = (taskId: string, userId: string): void => {
  if (!taskId || !userId) return
  
  if (!taskViewers.has(taskId)) {
    taskViewers.set(taskId, new Map())
  }
  
  const viewers = taskViewers.get(taskId)!
  viewers.set(userId, Date.now())
  
  // Clean up old entries periodically
  cleanupOldViewers(taskId)
}

/**
 * Check if a user is currently viewing a task
 */
export const isUserViewingTask = (taskId: string, userId: string): boolean => {
  if (!taskId || !userId) return false
  
  const viewers = taskViewers.get(taskId)
  if (!viewers) return false
  
  const lastSeen = viewers.get(userId)
  if (!lastSeen) return false
  
  // Check if viewing status is still valid (within timeout)
  const isRecent = Date.now() - lastSeen < VIEWING_TIMEOUT
  if (!isRecent) {
    viewers.delete(userId)
    return false
  }
  
  return true
}

/**
 * Remove a user from viewing a task
 */
export const markUserNotViewingTask = (taskId: string, userId: string): void => {
  if (!taskId || !userId) return
  
  const viewers = taskViewers.get(taskId)
  if (viewers) {
    viewers.delete(userId)
    if (viewers.size === 0) {
      taskViewers.delete(taskId)
    }
  }
}

/**
 * Clean up old viewers for a specific task
 */
const cleanupOldViewers = (taskId: string): void => {
  const viewers = taskViewers.get(taskId)
  if (!viewers) return
  
  const now = Date.now()
  for (const [userId, timestamp] of viewers.entries()) {
    if (now - timestamp > VIEWING_TIMEOUT) {
      viewers.delete(userId)
    }
  }
  
  if (viewers.size === 0) {
    taskViewers.delete(taskId)
  }
}

/**
 * Periodic cleanup of all old viewers (runs every minute)
 */
setInterval(() => {
  for (const taskId of taskViewers.keys()) {
    cleanupOldViewers(taskId)
  }
}, 60000) // Every minute

