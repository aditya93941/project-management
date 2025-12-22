import nodemailer from 'nodemailer'
import { logger } from './logger'

interface SendEmailOptions {
    to: string | string[]
    subject: string
    html: string
    text?: string
}

interface InvitationOptions {
    email: string
    name: string
    password?: string
    role: string
    loginUrl?: string
}

class EmailService {
    private transporter: nodemailer.Transporter

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: process.env.EMAIL_SERVICE || 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        })
    }

    /**
     * Send a generic email
     */
    async sendEmail({ to, subject, html, text }: SendEmailOptions): Promise<boolean> {
        try {
            if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
                logger.warn('Email service not configured. Skipping email sending.')
                return false
            }

            const info = await this.transporter.sendMail({
                from: `"${process.env.EMAIL_FROM_NAME || 'Project Management'}" <${process.env.EMAIL_USER}>`,
                to,
                subject,
                html,
                text: text || html.replace(/<[^>]*>/g, ''), // Basic fallback
            })

            logger.info(`Email sent: ${info.messageId}`)
            return true
        } catch (error) {
            logger.error('Error sending email:', error)
            return false
        }
    }

    /**
     * Send an invitation email to a new user
     */
    async sendInvitation({ email, name, password, role, loginUrl }: InvitationOptions): Promise<boolean> {
        const url = loginUrl || process.env.FRONTEND_URL || 'http://localhost:3000'
        const subject = 'Position2 Project Management Invitation'

        // IMPORTANT: Replace this with a base64-encoded PNG version of your logo
        // Steps to convert:
        // 1. Open logo.svg in an image editor (Photoshop, GIMP, or online tool)
        // 2. Export as PNG (recommended: 300px width, transparent background)
        // 3. Convert PNG to base64 using: https://www.base64-image.de/ or run: base64 -i logo.png
        // 4. Replace 'REPLACE_WITH_PNG_BASE64' below with the actual base64 string
        const logoBase64 = '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'
        
        // Role labels for display
        const roleLabels: Record<string, string> = {
            'MANAGER': 'Manager',
            'GROUP_HEAD': 'Group Head',
            'TEAM_LEAD': 'Team Lead',
            'DEVELOPER': 'Developer'
        }
        
        const displayRole = roleLabels[role] || role

        const html = `
      <!DOCTYPE html>
<html lang="en">
      <head>
    <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>Position2 Project Management Invitation</title>
    <!--[if mso]>
    <style type="text/css">
        body, table, td {font-family: Arial, sans-serif !important;}
        </style>
    <![endif]-->
      </head>
<body style="margin: 0; padding: 0; background-color: #f5f7fa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <!-- Wrapper Table -->
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f7fa;">
        <tr>
            <td align="center" style="padding: 40px 20px;">
                <!-- Main Container Table -->
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="padding: 40px 40px 30px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding-bottom: 20px;">
                                        <img src="data:image/png;base64,${logoBase64}" alt="Position2" width="150" height="auto" style="display: block; max-width: 150px; height: auto;" />
                                    </td>
                                </tr>
                                <tr>
                                    <td align="center">
                                        <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #111827; letter-spacing: -0.5px;">Position2 Invitation</h1>
                                        <p style="margin: 8px 0 0; font-size: 16px; color: #6b7280; font-weight: 400;">Position2 Project Management Invitation</p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px;">
                            <!-- Welcome Section -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-bottom: 24px;">
                                        <p style="margin: 0 0 12px; font-size: 18px; font-weight: 600; color: #111827; line-height: 1.5;">Hello ${name},</p>
                                        <p style="margin: 0 0 20px; font-size: 15px; color: #4b5563; line-height: 1.7;">You have been invited to join the Position2 Project Management System. Your account has been created with the following credentials:</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding-bottom: 8px;">
                                        <span style="display: inline-block; background-color: #eff6ff; color: #1e40af; padding: 6px 14px; border-radius: 6px; font-size: 13px; font-weight: 600; border: 1px solid #bfdbfe;">${displayRole}</span>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Credentials Card -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 32px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
                                <tr>
                                    <td style="padding: 28px;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                            <tr>
                                                <td style="padding-bottom: 20px;">
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="padding-bottom: 6px;">
                                                                <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Email Address</p>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>
                                                                <p style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 600; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; background-color: #ffffff; padding: 12px 16px; border-radius: 6px; border: 1px solid #e2e8f0; word-break: break-all;">${email}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
              ${password ? `
                                            <tr>
                                                <td>
                                                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                                        <tr>
                                                            <td style="padding-bottom: 6px;">
                                                                <p style="margin: 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700; letter-spacing: 0.5px;">Temporary Password</p>
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td>
                                                                <p style="margin: 0; font-size: 16px; color: #0f172a; font-weight: 600; font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; background-color: #ffffff; padding: 12px 16px; border-radius: 6px; border: 1px solid #e2e8f0; word-break: break-all;">${password}</p>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
              ` : ''}
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Button -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center" style="padding: 32px 0;">
                                        <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                                            <tr>
                                                <td align="center" style="background-color: #245E98; border-radius: 6px;">
                                                    <a href="${url}/login" style="display: inline-block; padding: 14px 32px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; background-color: #245E98;">Login to Dashboard</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Security Note -->
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 32px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 6px;">
                                <tr>
                                    <td style="padding: 16px 20px;">
                                        <p style="margin: 0; font-size: 14px; color: #92400e; line-height: 1.6;">
                                            <strong>Security Tip:</strong> Please change your password after your first login to keep your account secure.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="padding: 32px 40px; background-color: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center; border-radius: 0 0 8px 8px;">
                            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr>
                                    <td align="center">
                                        <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; line-height: 1.6;">
                                            &copy; ${new Date().getFullYear()} Position2 Inc. All rights reserved.
                                        </p>
                                        <p style="margin: 0 0 8px; font-size: 12px; color: #6b7280; line-height: 1.6;">
            This is an automated message. Please do not reply to this email.
                                        </p>
                                        <p style="margin: 0; font-size: 12px; line-height: 1.6;">
                                            <a href="${url}" style="color: #245E98; text-decoration: none;">Visit Position2 Project Management</a>
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                </table>
            </td>
        </tr>
    </table>
      </body>
      </html>
    `

        return this.sendEmail({ to: email, subject, html })
    }
}

export const emailService = new EmailService()
