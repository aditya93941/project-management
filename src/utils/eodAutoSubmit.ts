import { EODReport, EODStatus } from '../models'

/**
 * Process scheduled EOD submissions
 * Should be called every minute to check for reports that need to be auto-submitted
 */
export async function processScheduledSubmissions(): Promise<void> {
  try {
    const now = new Date()
    
    // Find reports with scheduled submission time that has passed
    const scheduledReports = await EODReport.find({
      scheduledSubmitAt: { $lte: now },
      status: EODStatus.DRAFT,
      isFinal: false,
    })

    for (const report of scheduledReports) {
      report.status = EODStatus.SUBMITTED
      report.submittedAt = new Date()
      report.scheduledSubmitAt = undefined // Clear scheduled time
      await report.save()
      
      console.log(`[EOD Auto-Submit] Auto-submitted scheduled report ${report._id} for user ${report.userId}`)
    }

    if (scheduledReports.length > 0) {
      console.log(`[EOD Auto-Submit] Processed ${scheduledReports.length} scheduled submissions`)
    }
  } catch (error: any) {
    console.error('[EOD Auto-Submit] Error processing scheduled submissions:', error)
  }
}

/**
 * Auto-submit all drafts at end of day (11:59 PM)
 * Should be called at 11:59 PM daily
 */
export async function autoSubmitDraftsAtEndOfDay(): Promise<void> {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Find all draft reports for today that haven't been submitted
    const draftReports = await EODReport.find({
      reportDate: {
        $gte: today,
        $lt: tomorrow,
      },
      status: EODStatus.DRAFT,
      isFinal: false,
    })

    for (const report of draftReports) {
      report.status = EODStatus.SUBMITTED
      report.submittedAt = new Date()
      report.scheduledSubmitAt = undefined
      await report.save()
      
      console.log(`[EOD Auto-Submit] Auto-submitted draft report ${report._id} for user ${report.userId}`)
    }

    if (draftReports.length > 0) {
      console.log(`[EOD Auto-Submit] Auto-submitted ${draftReports.length} draft reports at end of day`)
    }
  } catch (error: any) {
    console.error('[EOD Auto-Submit] Error auto-submitting drafts:', error)
  }
}

/**
 * Finalize all submitted reports at midnight
 * Sets isFinal = true for all reports from previous day
 * Should be called at 00:00:01 AM daily
 */
export async function finalizeReportsAtMidnight(): Promise<void> {
  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find all submitted reports from yesterday that aren't final yet
    const reportsToFinalize = await EODReport.find({
      reportDate: {
        $gte: yesterday,
        $lt: today,
      },
      status: EODStatus.SUBMITTED,
      isFinal: false,
    })

    for (const report of reportsToFinalize) {
      report.isFinal = true
      await report.save()
      
      console.log(`[EOD Finalize] Finalized report ${report._id} for user ${report.userId}`)
    }

    if (reportsToFinalize.length > 0) {
      console.log(`[EOD Finalize] Finalized ${reportsToFinalize.length} reports at midnight`)
    }
  } catch (error: any) {
    console.error('[EOD Finalize] Error finalizing reports:', error)
  }
}

