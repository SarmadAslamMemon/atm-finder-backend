import { Resend } from 'resend';
import nodemailer from 'nodemailer';

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const resendApiKey = process.env.RESEND_API_KEY;

  // 1. Try Resend HTTP API first (Uses HTTPS port 443 - works seamlessly on Render)
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const from = process.env.RESEND_FROM || 'ATM Finder <onboarding@resend.dev>';

      const { data, error } = await resend.emails.send({
        from,
        to: email,
        subject: 'Verify your ATM Finder account',
        text: `Your OTP code is: ${otp}. It will expire in 10 minutes.`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
            <h2 style="color: #6200ee; text-align: center;">ATM Finder Pakistan</h2>
            <hr />
            <p>Hello,</p>
            <p>Thank you for registering. Please use the following One-Time Password (OTP) to verify and activate your account:</p>
            <div style="font-size: 24px; font-weight: bold; text-align: center; margin: 30px 0; letter-spacing: 5px; color: #6200ee;">
              ${otp}
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you did not request this code, you can safely ignore this email.</p>
            <hr />
            <p style="font-size: 12px; color: #777; text-align: center;">&copy; 2026 ATM Finder Pakistan</p>
          </div>
        `,
      });

      if (error) {
        console.error(`[Resend Error] Failed to send email to ${email}:`, error);
      } else {
        console.log(`[Email] OTP successfully sent via Resend to ${email} (ID: ${data?.id})`);
        return;
      }
    } catch (err) {
      console.error(`[Resend Exception] Error sending to ${email}:`, err);
    }
  }

  // 2. Fallback to standard SMTP (local development)
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@atmfinder.pk';

  if (!host || !user || !pass) {
    console.log('\n======================================================');
    console.log(`📧 DEVELOPMENT OTP EMAIL SIMULATION`);
    console.log(`Recipient: ${email}`);
    console.log(`OTP Code:  ${otp}`);
    console.log('======================================================\n');
    return;
  }

  try {
    const isGmail = host.toLowerCase().includes('gmail');
    const transporter = nodemailer.createTransport(
      isGmail
        ? {
            service: 'gmail',
            auth: { user, pass },
          }
        : {
            host,
            port: port ? parseInt(port, 10) : 587,
            secure: port === '465',
            auth: { user, pass },
          }
    );

    await transporter.sendMail({
      from: `"ATM Finder Pakistan" <${from}>`,
      to: email,
      subject: 'Verify your ATM Finder account',
      text: `Your OTP code is: ${otp}. It will expire in 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee;">
          <h2 style="color: #6200ee; text-align: center;">ATM Finder Pakistan</h2>
          <hr />
          <p>Hello,</p>
          <p>Thank you for registering. Please use the following One-Time Password (OTP) to verify and activate your account:</p>
          <div style="font-size: 24px; font-weight: bold; text-align: center; margin: 30px 0; letter-spacing: 5px; color: #6200ee;">
            ${otp}
          </div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you did not request this code, you can safely ignore this email.</p>
          <hr />
          <p style="font-size: 12px; color: #777; text-align: center;">&copy; 2026 ATM Finder Pakistan</p>
        </div>
      `,
    });
    console.log(`[Email] OTP successfully sent to ${email}`);
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${email}:`, error);
  }
}
