import { Resend } from 'resend';
import nodemailer from 'nodemailer';

function buildOtpEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ATM Finder Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1e293b;">
  <!-- Invisible preheader for inbox preview -->
  <div style="display: none; font-size: 1px; color: #f4f6f9; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    Your ATM Finder verification code is ${otp}. Valid for 10 minutes.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f6f9; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06); border: 1px solid #e2e8f0;" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Top Accent Line -->
          <tr>
            <td style="height: 5px; background: linear-gradient(90deg, #4f46e5 0%, #7c3aed 100%);"></td>
          </tr>

          <!-- Header / Brand -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="vertical-align: middle;">
                    <img src="https://atmfinder.varbox.dev/app_logo.png" alt="ATM Finder Logo" width="44" height="44" style="border-radius: 10px; display: block; border: 0;" />
                  </td>
                  <td style="vertical-align: middle; padding-left: 12px; text-align: left;">
                    <div style="font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.2px;">ATM Finder</div>
                    <div style="font-size: 12px; color: #64748b; font-weight: 500;">Pakistan Branch &amp; ATM Locator</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 32px;">
              <div style="border-top: 1px solid #f1f5f9;"></div>
            </td>
          </tr>

          <!-- Content Body -->
          <tr>
            <td style="padding: 28px 32px 20px 32px;">
              <h1 style="font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; letter-spacing: -0.3px;">
                Confirm your verification code
              </h1>
              <p style="font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 24px 0;">
                Hello, thank you for using ATM Finder. Please enter this 6-digit one-time password (OTP) in the application to complete verification:
              </p>

              <!-- OTP Code Display Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 12px; padding: 22px 16px;">
                    <div style="font-family: 'SF Mono', Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #4338ca; padding-left: 10px;">
                      ${otp}
                    </div>
                    <div style="font-size: 12px; color: #64748b; font-weight: 500; margin-top: 8px;">
                      ⏱ This code expires in <strong>10 minutes</strong>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Notice -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="font-size: 12px; color: #854d0e; line-height: 1.5; margin: 0;">
                      <strong>Security Tip:</strong> Never share this code with anyone. ATM Finder support will never ask you for your verification code.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin: 0;">
                If you did not request this verification, please safely ignore this email or contact support if you suspect unauthorized activity.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px 32px; text-align: center;">
              <!-- Quick Links -->
              <div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">
                <a href="https://atmfinder.varbox.dev" style="color: #4f46e5; text-decoration: none; font-weight: 500;" target="_blank">Website</a>
                <span style="color: #cbd5e1; margin: 0 8px;">•</span>
                <a href="https://atmfinder.varbox.dev/privacy" style="color: #4f46e5; text-decoration: none; font-weight: 500;" target="_blank">Privacy Policy</a>
                <span style="color: #cbd5e1; margin: 0 8px;">•</span>
                <a href="https://atmfinder.varbox.dev/terms" style="color: #4f46e5; text-decoration: none; font-weight: 500;" target="_blank">Terms of Service</a>
                <span style="color: #cbd5e1; margin: 0 8px;">•</span>
                <a href="mailto:support@varbox.dev" style="color: #4f46e5; text-decoration: none; font-weight: 500;">Support</a>
              </div>

              <div style="font-size: 11px; color: #94a3b8; line-height: 1.5;">
                ATM Finder Pakistan • Powered by Varbox<br />
                &copy; 2026 Varbox. All rights reserved.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const subject = `${otp} is your ATM Finder verification code`;
  const textContent = `Your ATM Finder verification code is: ${otp}\n\nThis code will expire in 10 minutes.\n\nIf you did not request this code, you can safely ignore this email.\n\nVisit: https://atmfinder.varbox.dev\nSupport: support@varbox.dev`;
  const htmlContent = buildOtpEmailHtml(otp);

  const resendApiKey = process.env.RESEND_API_KEY;

  // 1. Try Resend HTTP API first (Uses HTTPS port 443 - works seamlessly on Render)
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const from = process.env.RESEND_FROM || 'ATM Finder <noreply@varbox.dev>';

      const { data, error } = await resend.emails.send({
        from,
        to: email,
        reply_to: 'support@varbox.dev',
        subject,
        text: textContent,
        html: htmlContent,
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
      subject,
      text: textContent,
      html: htmlContent,
    });
    console.log(`[Email] OTP successfully sent to ${email}`);
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${email}:`, error);
  }
}
