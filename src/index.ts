import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import morgan from 'morgan'
import cron from 'node-cron'
import { connectDatabase } from './config/database'
import routes from './routes'
import { expirePermissions, checkExpiringPermissions } from './utils/expirePermissions'
import { sendEODReminders } from './utils/eodReminders'
import { generateWeeklySummaries } from './utils/weeklySummaries'
import { generateMonthlySummaries } from './utils/monthlySummaries'
import { processScheduledSubmissions, autoSubmitDraftsAtEndOfDay, finalizeReportsAtMidnight } from './utils/eodAutoSubmit'
import { logger } from './utils/logger'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware - CORS configuration
// Support multiple origins in production (comma-separated)
// Set FRONTEND_URL environment variable with comma-separated URLs:
// Development: FRONTEND_URL=http://localhost:3000
// Production: FRONTEND_URL=https://project-manegnent.vercel.app
// Multiple: FRONTEND_URL=https://project-manegnent.vercel.app,http://localhost:3000
const getCorsOrigins = (): string | string[] => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
  
  // If multiple origins are provided (comma-separated), split them
  if (frontendUrl.includes(',')) {
    return frontendUrl.split(',').map(url => url.trim()).filter(url => url.length > 0)
  }
  
  return frontendUrl
}

app.use(cors({
  origin: getCorsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control'],
}))

// HTTP request logger - morgan - log full URL including query params
// Only log in development or if DEBUG is enabled
if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
  app.use(morgan(':method :url :status :response-time ms'))
}

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Routes - mount at root level (original setup)
// Frontend components handle /api prefix in their API_URL
app.use('/', routes)

// Health check endpoint with diagnostic information
app.get('/health', (_req, res) => {
  const healthStatus = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    // Only include sensitive info in development
    ...(process.env.NODE_ENV !== 'production' && {
      nodeVersion: process.version,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB',
      },
    }),
  }
  res.json(healthStatus)
})

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Error:', err)
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  })
})

// Validate critical environment variables
const validateEnv = () => {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check JWT_SECRET
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret || jwtSecret === 'secret' || jwtSecret.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      errors.push('JWT_SECRET must be set and at least 32 characters long in production')
    } else {
      warnings.push('JWT_SECRET is not set or too short. Using default (insecure for production)')
    }
  }
  
  // Check MONGODB_URI
  if (!process.env.MONGODB_URI) {
    errors.push('MONGODB_URI is required')
  } else if (!process.env.MONGODB_URI.startsWith('mongodb://') && !process.env.MONGODB_URI.startsWith('mongodb+srv://')) {
    warnings.push('MONGODB_URI format may be incorrect')
  }
  
  // Check FRONTEND_URL in production
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
    warnings.push('FRONTEND_URL is not set. CORS may not work correctly in production')
  }
  
  // Log warnings
  if (warnings.length > 0) {
    warnings.forEach(warning => logger.warn(`⚠️  WARNING: ${warning}`))
  }
  
  // Log errors and exit if in production
  if (errors.length > 0) {
    logger.error('❌ ENVIRONMENT VARIABLE ERRORS:')
    errors.forEach(error => logger.error(`   - ${error}`))
    logger.error('\n💡 Please check your .env file and ensure all required variables are set.')
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  }
}

// Start scheduled tasks
const startScheduledTasks = () => {
  // Run permission expiry check every hour
  cron.schedule('0 * * * *', async () => {
    try {
      const result = await expirePermissions()
      if (result.expiredCount > 0) {
        logger.log(`✅ Expired ${result.expiredCount} temporary permission(s)`)
      }
    } catch (error) {
      logger.error('❌ Error in permission expiry cron job:', error)
    }
  })

  // Check for expiring permissions daily at 9 AM
  cron.schedule('0 9 * * *', async () => {
    try {
      const result = await checkExpiringPermissions()
      if (result.notifiedCount > 0) {
        logger.log(`📧 Notified ${result.notifiedCount} user(s) about expiring permissions`)
      }
    } catch (error) {
      logger.error('❌ Error in expiring permissions check cron job:', error)
    }
  })

  // Send EOD reminders daily at 6:30 PM (working days only)
  cron.schedule('30 18 * * 1-5', async () => {
    try {
      const result = await sendEODReminders()
      if (result.sentCount > 0) {
        logger.log(`📧 Sent ${result.sentCount} EOD reminder(s)`)
      }
    } catch (error) {
      logger.error('❌ Error in EOD reminder cron job:', error)
    }
  })

  // Generate weekly summaries every Sunday at 11:59 PM
  cron.schedule('59 23 * * 0', async () => {
    try {
      const result = await generateWeeklySummaries()
      if (result.generatedCount > 0) {
        logger.log(`📊 Generated ${result.generatedCount} weekly summary(ies)`)
      }
    } catch (error) {
      logger.error('❌ Error in weekly summary generation cron job:', error)
    }
  })

  // Generate monthly summaries on the 1st of each month at 12:00 AM
  cron.schedule('0 0 1 * *', async () => {
    try {
      const result = await generateMonthlySummaries()
      if (result.generatedCount > 0) {
        logger.log(`📈 Generated ${result.generatedCount} monthly summary(ies)`)
      }
    } catch (error) {
      logger.error('❌ Error in monthly summary generation cron job:', error)
    }
  })

  // Process scheduled EOD submissions every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processScheduledSubmissions()
    } catch (error) {
      logger.error('❌ Error in scheduled EOD submission cron job:', error)
    }
  })

  // Auto-submit all drafts at end of day (11:59 PM)
  cron.schedule('59 23 * * *', async () => {
    try {
      await autoSubmitDraftsAtEndOfDay()
    } catch (error) {
      logger.error('❌ Error in auto-submit drafts cron job:', error)
    }
  })

  // Finalize all submitted reports at midnight (00:00:01)
  cron.schedule('1 0 * * *', async () => {
    try {
      await finalizeReportsAtMidnight()
    } catch (error) {
      logger.error('❌ Error in finalize reports cron job:', error)
    }
  })

  logger.log('⏰ Scheduled tasks started:')
  logger.log('  - Permission expiry: hourly')
  logger.log('  - Permission expiring check: daily at 9 AM')
  logger.log('  - EOD reminders: daily at 6:30 PM (Mon-Fri)')
  logger.log('  - Weekly summaries: Sunday at 11:59 PM')
  logger.log('  - Monthly summaries: 1st of month at 12:00 AM')
  logger.log('  - Scheduled EOD submissions: every minute')
  logger.log('  - Auto-submit drafts: daily at 11:59 PM')
  logger.log('  - Finalize reports: daily at 12:00:01 AM')
}

// Start server
const startServer = async () => {
  try {
    validateEnv()
    await connectDatabase()
    
    // Start scheduled tasks
    startScheduledTasks()
    
    app.listen(PORT, () => {
      logger.log(`🚀 Server running on port ${PORT}`)
      if (process.env.NODE_ENV !== 'production') {
        logger.log(`   Local: http://localhost:${PORT}`)
      }
    })
  } catch (error) {
    logger.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

