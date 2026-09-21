/**
 * Daily digest transport — replaces base44.asServiceRole.integrations.Core.SendEmail.
 * Prefers the admin's connected Gmail; falls back to SMTP from .env.
 */
import nodemailer from 'nodemailer';
import { getCurrentAppUserConnection, buildRawEmail, sendGmail, getProfile } from './gmail.js';

export async function SendEmail({ to, subject, body, from_name, viaUserId }) {
  if (viaUserId) {
    const conn = await getCurrentAppUserConnection(viaUserId);
    if (conn?.access_token) {
      const profile = await getProfile(conn.access_token);
      const raw = buildRawEmail({ from: profile.emailAddress, fromName: from_name, to, subject, body });
      await sendGmail(conn.access_token, raw);
      return { transport: 'gmail' };
    }
  }

  if (!process.env.SMTP_HOST) {
    throw Object.assign(new Error('No email transport available: connect Gmail or configure SMTP_* in .env'), { status: 503, code: 'email_not_configured' });
  }
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT || 587) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from: from_name ? `"${String(from_name).replace(/["\r\n]/g, '')}" <${fromAddr}>` : fromAddr,
    to,
    subject: String(subject).replace(/[\r\n]+/g, ' '),
    text: body,
  });
  return { transport: 'smtp' };
}
