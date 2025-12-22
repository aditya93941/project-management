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
        const subject = 'Welcome to Position2 Project Management'

        // Base64 encoded logo
        const logoBase64 = 'PHN2ZyB3aWR0aD0iMTE3IiBoZWlnaHQ9IjQwIiB2aWV3Qm94PSIwIDAgMTE3IDQwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTY3LjcyNjUgMjUuODUxNEM2Ni45NjE0IDI1LjA3MDQgNjUuOTkgMjQuNjc4OSA2NC44MTM1IDI0LjY3ODlDNjMuNjM3IDI0LjY3ODkgNjIuNjY1NyAyNS4wNzA0IDYxLjkwMDUgMjUuODUxNEM2MS4xMzU0IDI2LjYzMzQgNjAuNzUyOCAyNy42NDQ0IDYwLjc1MjggMjguODg0NEM2MC43NTI4IDMwLjEyNDMgNjEuMTM1NCAzMS4xMzYzIDYxLjkwMDUgMzEuOTE3M0M2Mi42NjY3IDMyLjY5OTMgNjMuNjM3IDMzLjA4OTggNjQuODEzNSAzMy4wODk4QzY1Ljk5IDMzLjA4OTggNjYuOTYwNCAzMi42OTkzIDY3LjcyNjUgMzEuOTE3M0M2OC40OTI3IDMxLjEzNjMgNjguODc0MyAzMC4xMjUzIDY4Ljg3NDMgMjguODg0NEM2OC44NzQzIDI3LjY0MzQgNjguNDkyNyAyNi42MzM0IDY3LjcyNjUgMjUuODUxNFpNMCA0MC4wMDAyVjIyLjQ1NjdIMi43MDY4NFYyMy42MjIzQzMuODc2NCAyMi43MTY0IDUuMjc0OTIgMjIuMjYzNSA2LjkwMjM5IDIyLjI2MzVDOC44MzYxNCAyMi4yNjM1IDEwLjQ0NjggMjIuOTA0NyAxMS43MzYzIDI0LjE4NDNDMTMuMDI0OCAyNS40NjQ5IDEzLjY3IDI3LjAzMTkgMTMuNjcgMjguODg0NEMxMy42NyAzMC43MzY4IDEzLjAyNDggMzIuMzAzOCAxMS43MzYzIDMzLjU4NDRDMTAuNDQ2OCAzNC44NjUgOC44MzUxNCAzNS41MDUzIDYuOTAyMzkgMzUuNTA1M0M1LjI3NTkxIDM1LjUwNTMgMy44NzczOSAzNS4wNTIzIDIuNzA2ODQgMzQuMTQ2NFYzOS45OTkySDBWNDAuMDAwMlpNOS44MTQ0IDI1Ljg1MTRDOS4wNDkyMyAyNS4wNzA0IDguMDc4ODkgMjQuNjc4OSA2LjkwMjM5IDI0LjY3ODlDNS43MjU5IDI0LjY3ODkgNC43NTU1NiAyNS4wNzA0IDMuOTg5MzkgMjUuODUxNEMzLjIyNDIyIDI2LjYzMzQgMi44NDA2NSAyNy42NDQ0IDIuODQwNjUgMjguODg0NEMyLjg0MDY1IDMwLjEyNDMgMy4yMjMyMyAzMS4xMzYzIDMuOTg5MzkgMzEuOTE3M0M0Ljc1NDU2IDMyLjY5OTMgNS43MjQ5IDMzLjA4OTggNi45MDIzOSAzMy4wODk4QzguMDc5ODkgMzMuMDg5OCA5LjA0OTIzIDMyLjY5OTMgOS44MTQ0IDMxLjkxNzNDMTAuNTc5NiAzMS4xMzYzIDEwLjk2MzIgMzAuMTI1MyAxMC45NjMyIDI4Ljg4NDRDMTAuOTYzMiAyNy42NDM0IDEwLjU3OTYgMjYuNjMzNCA5LjgxNDQgMjUuODUxNFpNNjkuNjQ4NCAzMy41ODU0QzY4LjM1ODkgMzQuODY2IDY2Ljc0NzMgMzUuNTA2MyA2NC44MTQ1IDM1LjUwNjNDNjIuODgxOCAzNS41MDYzIDYxLjI2OTIgMzQuODY2IDU5Ljk3OTcgMzMuNTg1NEM1OC42OTAyIDMyLjMwMzggNTguMDQ1OSAzMC43Mzc4IDU4LjA0NTkgMjguODg1NEM1OC4wNDU5IDI3LjAzMjkgNTguNjkwMiAyNS40NjU5IDU5Ljk3OTcgMjQuMTg1M0M2MS4yNjkyIDIyLjkwNDcgNjIuODc5OCAyMi4yNjQ0IDY0LjgxNDUgMjIuMjY0NEM2Ni43NDkzIDIyLjI2NDQgNjguMzU4OSAyMi45MDU3IDY5LjY0ODQgMjQuMTg1M0M3MC45Mzc5IDI1LjQ2NTkgNzEuNTgyMSAyNy4wMzI5IDcxLjU4MjEgMjguODg1NEM3MS41ODIxIDMwLjczNzggNzAuOTM3OSAzMi4zMDQ4IDY5LjY0ODQgMzMuNTg1NFpNNTYuNTQ4MyAzNS4zMTNINTMuODQxNVYyMi40NTc3SDU2LjU0ODNWMzUuMzEzWk01Ni40Mjc0IDE5Ljg5NTZDNTYuMDg5NCAyMC4yMzM2IDU1LjY4NSAyMC40MDMxIDU1LjIxOTIgMjAuNDAzMUM1NC43NTMzIDIwLjQwMzEgNTQuMzQ3OSAyMC4yMzM2IDU0LjAxIDE5Ljg5NTZDNTMuNjcyIDE5LjU1NjYgNTMuNTAyNSAxOS4xNTQyIDUzLjUwMjUgMTguNjg3NEM1My41MDI1IDE4LjIyMDUgNTMuNjcyIDE3LjgxNzEgNTQuMDEgMTcuNDc5MkM1NC4zNDc5IDE3LjE0MTIgNTQuNzUwMyAxNi45NzE3IDU1LjIxOTIgMTYuOTcxN0M1NS42ODggMTYuOTcxNyA1Ni4wODk0IDE3LjE0MTIgNTYuNDI3NCAxNy40NzkyQzU2Ljc2NTQgMTcuODE4MSA1Ni45MzQ4IDE4LjIyMDUgNTYuOTM0OCAxOC42ODc0QzU2LjkzNDggMTkuMTU0MiA1Ni43NjU0IDE5LjU1NzYgNTYuNDI3NCAxOS44OTU2Wk00OS4xMjc1IDMyLjYxOEM0OS40NDg3IDMyLjk4MDggNDkuOTAxNiAzMy4xNjIyIDUwLjQ4MTQgMzMuMTYyMkM1MS4wNjEzIDMzLjE2MjIgNTEuNjE3MyAzMi44ODA3IDUyLjE0OTYgMzIuMzE2N0w1My4yNjA2IDM0LjIyNDdDNTIuMzA5MSAzNS4wNzkxIDUxLjI1NzUgMzUuNTA1MyA1MC4xMDU4IDM1LjUwNTNDNDguOTU0MSAzNS41MDUzIDQ3Ljk3MDkgMzUuMTA2OCA0Ny4xNTcxIDM0LjMwOTlDNDYuMzQzNCAzMy41MTIxIDQ1LjkzNiAzMi40Mzc2IDQ1LjkzNiAzMS4wODM3VjI0LjYzMjNINDQuMzE2NVYyMi40NTc3SDQ1LjkzNlYxOC40MjE3SDQ4LjY0MjlWMjIuNDU3N0g1Mi4wMjY2VjI0LjYzMjNINDguNjQyOVYzMS4xNTcxQzQ4LjY0MjkgMzEuNzY5NiA0OC44MDM0IDMyLjI1NjMgNDkuMTI2NSAzMi42MThNNDIuOTYzNSAzNS4zMTNINDAuMjU1N1YyMi40NTc3SDQyLjk2MzVWMzUuMzEzWk00Mi44NDI2IDE5Ljg5NTZDNDIuNTA0NiAyMC4yMzM2IDQyLjEwMTIgMjAuNDAzMSA0MS42MzQ0IDIwLjQwMzFDNDEuMTY3NiAyMC40MDMxIDQwLjc2NDIgMjAuMjMzNiA0MC40MjYyIDE5Ljg5NTZDNDAuMDg3MiAxOS41NTY2IDM5LjkxODcgMTkuMTU0MiAzOS45MTg3IDE4LjY4NzRDMzkuOTE4NyAxOC4yMjA1IDQwLjA4NzIgMTcuODE3MSA0MC40MjYyIDE3LjQ3OTJDNDAuNzY1MiAxNy4xNDEyIDQxLjE2NzYgMTYuOTcxNyA0MS42MzQ0IDE2Ljk3MTdDNDIuMTAxMiAxNi45NzE3IDQyLjUwNTYgMTcuMTQxMiA0Mi44NDI2IDE3LjQ3OTJDNDMuMTgxNiAxNy44MTgxIDQzLjM1MDEgMTguMjIwNSA0My4zNTAxIDE4LjY4NzRDNDMuMzUwMSAxOS4xNTQyIDQzLjE4MDYgMTkuNTU3NiA0Mi44NDI2IDE5Ljg5NTZaTTMzLjk5NjYgMjQuNTM1MkMzMy4zNTIzIDI0LjUzNTIgMzIuODI4IDI0LjY1MjEgMzIuNDI0NiAyNC44ODZDMzIuMDIyMiAyNS4xMTkgMzEuODIxIDI1LjQ2OTggMzEuODIxIDI1LjkzNzdDMzEuODIxIDI2LjM1NTkgMzIuMDMwMSAyNi42NjIyIDMyLjQ0OTQgMjYuODU1NUMzMi43Mzk4IDI3LjAwMDIgMzMuMTQ2MiAyNy4xMzc5IDMzLjY3MDUgMjcuMjY1OEMzNC4xOTM4IDI3LjM5NTYgMzQuNjU2NyAyNy41MjQ1IDM1LjA2MTEgMjcuNjUzM0MzNS40NjM1IDI3Ljc4MjIgMzUuODU0IDI3LjkyNjkgMzYuMjMyNiAyOC4wODg1QzM2LjYxMTIgMjguMjUgMzcuMDE4NiAyOC40NzUgMzcuNDUzNyAyOC43NjQ0QzM4LjMyNCAyOS4zNDQzIDM4Ljc1ODEgMzAuMjQ3MiAzOC43NTgxIDMxLjQ3MDNDMzguNzU4MSAzMi42OTM0IDM4LjMxNSAzMy42NzM2IDM3LjQyODkgMzQuNDA3MUMzNi41NDI5IDM1LjEzOTUgMzUuNDA2IDM1LjUwNjMgMzQuMDIxNCAzNS41MDYzQzMzLjA4NjcgMzUuNTA2MyAzMi4xMTU0IDM1LjMzNzggMzEuMTA4NCAzNC45OTg4QzMwLjEwMDMgMzQuNjU5OCAyOS4yMTAzIDM0LjE4NTEgMjguNDM3MiAzMy41NzM1TDI5Ljc0MjUgMzEuNDcxM0MzMS4yNDEyIDMyLjU5OTIgMzIuNjkxMiAzMy4xNjMyIDM0LjA5MjcgMzMuMTYzMkMzNC43MDUyIDMzLjE2MzIgMzUuMTg4OSAzMy4wMjI0IDM1LjU0MzggMzIuNzM5OUMzNS44OTc2IDMyLjQ1ODUgMzYuMDc1IDMyLjA5OTcgMzYuMDc1IDMxLjY2NTVDMzYuMDc1IDMxLjAyMTMgMzUuMjIwNiAzMC40NDE1IDMzLjUxMjkgMjkuOTI2MUMzMy4zODMgMjkuODc3NSAzMy4yODY5IDI5Ljg0NTggMzMuMjIyNSAyOS44Mjk5QzMwLjU0NzQgMjkuMTA1NCAyOS4yMTAzIDI3Ljg5NjIgMjkuMjEwMyAyNi4yMDUzQzI5LjIxMDMgMjUuMDEyOSAyOS42NzMyIDI0LjA1ODQgMzAuNTk5OSAyMy4zNDE4QzMxLjUyNjYgMjIuNjI1MiAzMi43MzA5IDIyLjI2NjQgMzQuMjEzNiAyMi4yNjY0QzM1LjY5NjQgMjIuMjY2NCAzNy4wOTc5IDIyLjcwMTUgMzguNDIwMSAyMy41NzE4TDM3LjQwNDIgMjUuNTc2OUMzNi4zNTY1IDI0Ljg4NDEgMzUuMjIwNiAyNC41MzgxIDMzLjk5NjYgMjQuNTM4MU0yNC4yNDI2IDI1Ljg1MTRDMjMuNDc3NSAyNS4wNzA0IDIyLjUwNjEgMjQuNjc4OSAyMS4zMjk2IDI0LjY3ODlDMjAuMTUzMSAyNC42Nzg5IDE5LjE4MTggMjUuMDcwNCAxOC40MTY2IDI1Ljg1MTRDMTcuNjUxNSAyNi42MzM0IDE3LjI2ODkgMjcuNjQ0NCAxNy4yNjg5IDI4Ljg4NDRDMTcuMjY4OSAzMC4xMjQzIDE3LjY1MTUgMzEuMTM2MyAxOC40MTY2IDMxLjkxNzNDMTkuMTgxOCAzMi42OTkzIDIwLjE1MzEgMzMuMDg5OCAyMS4zMjk2IDMzLjA4OThDMjIuNTA2MSAzMy4wODk4IDIzLjQ3NjUgMzIuNjk5MyAyNC4yNDI2IDMxLjkxNzNDMjUuMDA3OCAzMS4xMzYzIDI1LjM5MTQgMzAuMTI1MyAyNS4zOTE0IDI4Ljg4NDRDMjUuMzkxNCAyNy42NDM0IDI1LjAwNzggMjYuNjMzNCAyNC4yNDI2IDI1Ljg1MTRaTTI2LjE2NDUgMzMuNTg1NEMyNC44NzYgMzQuODY2IDIzLjI2NDQgMzUuNTA2MyAyMS4zMzA2IDM1LjUwNjNDMTkuMzk2OSAzNS41MDYzIDE3Ljc4NTMgMzQuODY2IDE2LjQ5NjggMzMuNTg1NEMxNS4yMDczIDMyLjMwMzggMTQuNTYzIDMwLjczNzggMTQuNTYzIDI4Ljg4NTRDMTQuNTYzIDI3LjAzMjkgMTUuMjA3MyAyNS40NjU5IDE2LjQ5NjggMjQuMTg1M0MxNy43ODUzIDIyLjkwNDcgMTkuMzk3OSAyMi4yNjQ0IDIxLjMzMDYgMjIuMjY0NEMyMy4yNjM0IDIyLjI2NDQgMjQuODc2IDIyLjkwNTcgMjYuMTY0NSAyNC4xODUzQzI3LjQ1NCAyNS40NjU5IDI4LjA5ODIgMjcuMDMyOSAyOC4wOTgyIDI4Ljg4NTRDMjguMDk4MiAzMC43Mzc4IDI3LjQ1MyAzMi4zMDQ4IDI2LjE2NDUgMzMuNTg1NFoiIGZpbGw9IiMyNDVFOTgiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03Ni41Mjk4IDI1LjMzMzZDNzcuMjQ3MyAyNC42OTE0IDc4LjA5MDggMjQuMzcwMiA3OS4wNTkyIDI0LjM3MDJDODEuMDk2IDI0LjM3MDIgODIuMTEzOSAyNS41OTczIDgyLjExMzkgMjguMDUxNFYzNS4zNjMxSDg0LjkxNzlWMjcuMkM4NC45MTc5IDI1LjQ2MzUgODQuNDU0IDI0LjEzNjMgODMuNTI4MyAyMy4yMTc1QzgyLjYwMTYgMjIuMjk5NyA4MS4zODc0IDIxLjg0MDggNzkuODg1OCAyMS44NDA4Qzc4Ljk2NyAyMS44NDA4IDc4LjExMTYgMjIuMDc0NyA3Ny4zMTk3IDIyLjU0MTZDNzYuNTI2OCAyMy4wMDk0IDc1LjkwNTMgMjMuNjUxNyA3NS40NTUzIDI0LjQ3MDRWMjIuMDQxSDcyLjY1MTRWMzUuMzYzMUg3NS40NTUzVjI4LjE1MDVDNzUuNDU1MyAyNi45MTU1IDc1LjgxMzEgMjUuOTc1OSA3Ni41MzA3IDI1LjMzMzZINzYuNTI5OFoiIGZpbGw9IiMyNDVFOTgiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik03OC4wNDU3IDBDODEuNDg0MSAwIDg0LjI3MTIgMi43OTAxIDg0LjI3MTIgNi4yMzMzN0M4NC4yNzEyIDkuNjc2NjQgODEuNDg0MSAxMi40NjY3IDc4LjA0NTcgMTIuNDY2N0M3NC42MDc0IDEyLjQ2NjcgNzEuODIwMyA5LjY3NjY0IDcxLjgyMDMgNi4yMzMzN0M3MS44MjAzIDIuNzkwMSA3NC42MDg0IDAgNzguMDQ1NyAwWiIgZmlsbD0iI0YwQjgxNiIvPgo8cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGNsaXAtcnVsZT0iZXZlbm9kZCIgZD0iTTY1LjIxODkgMi43NTA5OEM2Ny43NTIzIDIuNzUwOTggNjkuODA1IDQuODExNTkgNjkuODA1IDcuMzUyOUM2OS44MDUgOS44OTQyMiA2Ny43NTEzIDExLjk1NDggNjUuMjE4OSAxMS45NTQ4QzYyLjY4NjUgMTEuOTU0OCA2MC42MzI4IDkuODk1MjEgNjAuNjMyOCA3LjM1MjlDNjAuNjMyOCA0LjgxMDU5IDYyLjY4NjUgMi43NTA5OCA2NS4yMTg5IDIuNzUwOThaIiBmaWxsPSIjMjQ1RTk4Ii8+CjxwYXRoIGZpbGwtcnVsZT0iZXZlbm9kZCIgY2xpcC1ydWxlPSJldmVub2RkIiBkPSJNNTguMTU5MiAxMC4yMjU2QzU5LjYyNDEgMTAuMjI1NiA2MC44MTI1IDExLjQxNCA2MC44MTI1IDEyLjg3OTlDNjAuODEyNSAxNC4zNDU4IDU5LjYyNDEgMTUuNTMzMiA1OC4xNTkyIDE1LjUzMzJDNTYuNjk0MyAxNS41MzMyIDU1LjUwNDkgMTQuMzQ0OCA1NS41MDQ5IDEyLjg3OTlDNTUuNTA0OSAxMS40MTUgNTYuNjkzMyAxMC4yMjU2IDU4LjE1OTIgMTAuMjI1NloiIGZpbGw9IiMxREE2NEIiLz4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik05My44NzkyIDE4LjYxMTdIODkuODU2MUw5MS45MzY2IDE2LjQ5MDdDOTIuNTcxOSAxNS44Mzk1IDkzLjAwOCAxNS4zMDUyIDkzLjI0MzkgMTQuODkwOUM5My40ODA4IDE0LjQ3NjYgOTMuNTk5NyAxNC4wNDA1IDkzLjU5OTcgMTMuNTgzNkM5My41OTk3IDEyLjc3MDkgOTMuMzIwMiAxMi4xMjk2IDkyLjc2MjIgMTEuNjU5OEM5Mi4yMDMyIDExLjE5IDkxLjU1NCAxMC45NTUxIDkwLjgxMzYgMTAuOTU1MUM5MC4wNzMyIDEwLjk1NTEgODkuNDY3NiAxMS4xMDI3IDg4Ljk5ODggMTEuNDAwMUM4OC41MjkgMTEuNjk2NSA4OC4wOTk4IDEyLjEzNjUgODcuNzEwMyAxMi43MjAzTDg4LjkxNjUgMTMuNDE4MUM4OS4zOTgyIDEyLjY3MzcgOTAuMDAzOCAxMi4zMDExIDkwLjczMjMgMTIuMzAxMUM5MS4xNDU2IDEyLjMwMTEgOTEuNDg5NSAxMi40MjU5IDkxLjc2MDEgMTIuNjc1N0M5Mi4wMzA3IDEyLjkyNTUgOTIuMTY1NSAxMy4yMjc4IDkyLjE2NTUgMTMuNTgzNkM5Mi4xNjU1IDEzLjkzOTQgOTIuMDM4NiAxNC4yOTAzIDkxLjc4NDkgMTQuNjM3MkM5MS41MzEyIDE0Ljk4NDEgOTEuMTA0IDE1LjQ2MjggOTAuNTAzMyAxNi4wNzE0TDg3LjgxMjQgMTguNzc2M1YyMC4wNDQ5SDkzLjg3OTJWMTguNjEwN1YxOC42MTE3Wk05MC43MDc1IDI0LjEzNTRDODYuMjU2MyAyNC4xMzU0IDgyLjY0NzUgMjAuNTE2NyA4Mi42NDc1IDE2LjA1MzZDODIuNjQ3NSAxMS41OTA0IDg2LjI1NjMgNy45NzA3IDkwLjcwNzUgNy45NzA3Qzk1LjE1ODggNy45NzA3IDk4Ljc2NzYgMTEuNTg5NCA5OC43Njc2IDE2LjA1MzZDOTguNzY3NiAyMC41MTc3IDk1LjE1OTggMjQuMTM1NCA5MC43MDc1IDI0LjEzNTRaIiBmaWxsPSIjRDMzNDJFIi8+Cjwvc3ZnPgoK'
        
        const html = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>Welcome to P2 Internal Tool</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; 
            line-height: 1.6; 
            color: #1f2937; 
            background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf1 100%);
            padding: 20px;
          }
          .email-wrapper { 
            max-width: 600px; 
            margin: 0 auto; 
            background: #ffffff; 
            border-radius: 16px; 
            overflow: hidden; 
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            padding: 40px 40px 30px;
            text-align: center;
            border-bottom: 1px solid #e5e7eb;
          }
          .logo-container {
            margin-bottom: 20px;
          }
          .logo { 
            height: 50px; 
            width: auto; 
            display: inline-block;
          }
          .header-title {
            font-size: 24px;
            font-weight: 700;
            color: #111827;
            margin-top: 16px;
            letter-spacing: -0.5px;
          }
          .content { 
            padding: 40px; 
            background: #ffffff;
          }
          .welcome-section {
            margin-bottom: 32px;
          }
          .welcome-text { 
            font-size: 18px; 
            color: #111827; 
            margin-bottom: 16px;
            font-weight: 600;
          }
          .intro-text {
            font-size: 15px;
            color: #4b5563;
            line-height: 1.7;
            margin-bottom: 24px;
          }
          .role-badge { 
            display: inline-flex;
            align-items: center;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            color: #1e40af;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            border: 1px solid #bfdbfe;
            margin-top: 8px;
          }
          .credentials-card { 
            background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 28px;
            margin: 32px 0;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
          }
          .credential-item {
            margin-bottom: 20px;
          }
          .credential-item:last-child {
            margin-bottom: 0;
          }
          .label { 
            font-size: 11px; 
            text-transform: uppercase; 
            color: #64748b; 
            font-weight: 700; 
            margin-bottom: 8px; 
            display: block;
            letter-spacing: 0.5px;
          }
          .value { 
            font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
            font-size: 16px; 
            color: #0f172a; 
            font-weight: 600;
            background: #ffffff;
            padding: 12px 16px;
            border-radius: 8px;
            border: 1px solid #e2e8f0;
            display: block;
            word-break: break-all;
          }
          .button-container { 
            text-align: center; 
            margin: 40px 0 32px;
          }
          .button { 
            display: inline-block;
            background: linear-gradient(135deg, #245E98 0%, #1e4a7a 100%);
            color: #ffffff; 
            padding: 16px 40px; 
            border-radius: 10px; 
            text-decoration: none; 
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 12px rgba(36, 94, 152, 0.3);
            transition: all 0.3s ease;
            letter-spacing: 0.3px;
          }
          .button:hover { 
            background: linear-gradient(135deg, #1e4a7a 0%, #163a5f 100%);
            box-shadow: 0 6px 16px rgba(36, 94, 152, 0.4);
            transform: translateY(-2px);
          }
          .security-note {
            background: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 16px 20px;
            border-radius: 8px;
            margin-top: 32px;
          }
          .security-note-text {
            font-size: 14px;
            color: #92400e;
            line-height: 1.6;
            display: flex;
            align-items: flex-start;
            gap: 12px;
          }
          .security-icon {
            font-size: 18px;
            flex-shrink: 0;
            margin-top: 2px;
          }
          .footer { 
            background: #f8fafc;
            padding: 32px 40px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer-text {
            font-size: 12px;
            color: #6b7280;
            line-height: 1.6;
          }
          .footer-text a {
            color: #245E98;
            text-decoration: none;
          }
          @media only screen and (max-width: 600px) {
            body { padding: 10px; }
            .content, .header, .footer { padding: 24px; }
            .welcome-text { font-size: 16px; }
            .button { padding: 14px 32px; font-size: 14px; }
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="logo-container">
              <img src="data:image/svg+xml;base64,${logoBase64}" alt="P2 Internal Tool" class="logo" />
            </div>
            <div class="header-title">Welcome to P2 Internal Tool</div>
          </div>
          <div class="content">
            <div class="welcome-section">
              <p class="welcome-text">Hello ${name} 👋</p>
              <p class="intro-text">
                You've been invited to join our <strong>Project Management Platform</strong>. 
                Get started by logging in with your credentials below.
              </p>
              <div>
                <span class="role-badge">${role}</span>
              </div>
            </div>
            
            <div class="credentials-card">
              <div class="credential-item">
                <span class="label">📧 Email Address</span>
                <span class="value">${email}</span>
              </div>
              ${password ? `
              <div class="credential-item">
                <span class="label">🔑 Temporary Password</span>
                <span class="value">${password}</span>
              </div>
              ` : ''}
            </div>

            <div class="button-container">
              <a href="${url}/login" class="button">🚀 Login to Dashboard</a>
            </div>
            
            <div class="security-note">
              <p class="security-note-text">
                <span class="security-icon">🔒</span>
                <span><strong>Security Tip:</strong> Please change your password after your first login to keep your account secure.</span>
              </p>
            </div>
          </div>
          <div class="footer">
            <p class="footer-text">
              &copy; ${new Date().getFullYear()} Position2 Inc. All rights reserved.<br>
              This is an automated message. Please do not reply to this email.<br>
              <a href="${url}">Visit P2 Internal Tool</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `

        return this.sendEmail({ to: email, subject, html })
    }
}

export const emailService = new EmailService()
