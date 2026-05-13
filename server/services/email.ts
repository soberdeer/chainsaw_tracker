import nodemailer from 'nodemailer';

export async function sendInviteEmail(input: { to: string; inviteUrl: string; workspaceName: string; role: string }) {
  const from = process.env.MAIL_FROM || 'Compact Tracker <no-reply@local.app>';
  const subject = `Invite to ${input.workspaceName}`;
  const text = [
    `You were invited to ${input.workspaceName} as ${input.role}.`,
    '',
    `Open this link to accept: ${input.inviteUrl}`
  ].join('\n');

  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
        : undefined
    });
    await transporter.sendMail({ from, to: input.to, subject, text });
    return { sent: true, provider: 'smtp' };
  }

  console.info(`[invite-email:dev]\nTo: ${input.to}\n${text}`);
  return { sent: false, provider: 'console' };
}
