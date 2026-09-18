import nodemailer from 'nodemailer'
import type { ReviewRecord } from './store.ts'

function transport() {
  return nodemailer.createTransport({
    host: 'smtp.gmail.com', port: 465, secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  })
}
export async function sendEmail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) throw new Error('Email is not configured')
  await transport().sendMail({ from: { name: 'Yali Sponsors', address: process.env.SMTP_USER }, to, subject, text })
}
export async function sendStatus(record: ReviewRecord) {
  const description = record.status === 'pending'
    ? 'Your sponsorship request is under review. It will appear on the sponsor wall after we verify your payment and approve your entry.'
    : record.status === 'approved'
      ? 'Your sponsorship has been approved and is now on the sponsor wall. Thank you for supporting Yali!'
      : record.status === 'revoked'
        ? 'Approval for this contribution has been revoked. It has been removed from the public sponsor wall and total. Your other approved contributions are unaffected. This does not issue a refund. Please reply to this email if you have questions.'
      : 'We could not approve your sponsorship request. Please reply to this email so we can help check your payment details. This does not mean a payment was refunded.'
  await sendEmail(record.email, `Yali sponsorship: ${record.status === 'pending' ? 'under review' : record.status}`,
    `Hello ${record.name},\n\n${description}\n\nAmount: INR ${record.amount}\nUsername: @${record.user_id}\nRequest: ${record.request_id}\n\nஉங்கள் ஆதரவு, எங்கள் வலிமை.\nYali\n`)
}
