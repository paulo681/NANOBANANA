import sgMail from '@sendgrid/mail';

type SendEmailOptions = {
  to: string;
  subject: string;
  text?: string;
  html?: string;
};

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;

if (apiKey && fromEmail) {
  sgMail.setApiKey(apiKey);
}

export async function sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<void> {
  if (!apiKey || !fromEmail) {
    console.warn('SendGrid non configuré. Email non envoyé.', { to, subject });
    return;
  }

  const fallbackText = text ?? (html ? html.replace(/<[^>]+>/g, '') : '');

  await sgMail.send({
    to,
    from: fromEmail,
    subject,
    text: fallbackText,
    ...(html ? { html } : {}),
  });
}
