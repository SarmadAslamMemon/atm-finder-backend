import fs from 'node:fs';
import path from 'node:path';
import { Resend } from 'resend';
import nodemailer from 'nodemailer';

let cachedLogoBuffer: Buffer | null = null;
function getLogoBuffer(): Buffer | null {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    const p = path.resolve('assets/app_logo.png');
    if (fs.existsSync(p)) {
      cachedLogoBuffer = fs.readFileSync(p);
      return cachedLogoBuffer;
    }
  } catch {}
  return null;
}

function buildOtpEmailHtml(otp: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ATM Finder Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #FAF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #1C1917;">
  <!-- Preheader -->
  <div style="display: none; font-size: 1px; color: #FAF8F5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${otp} is your ATM Finder verification code. Valid for 10 minutes.
  </div>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FAF8F5; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card -->
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(229, 83, 42, 0.08), 0 8px 10px -6px rgba(0, 0, 0, 0.03); border: 1px solid #F2ECE6;" cellspacing="0" cellpadding="0" border="0">
          
          <!-- Top Sunset Coral Gradient Accent -->
          <tr>
            <td style="height: 6px; background: linear-gradient(90deg, #FF6A42 0%, #FF8F6B 50%, #FFA27E 100%);"></td>
          </tr>

          <!-- Header / Logo & App Name -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td align="center">
                    <img src="https://raw.githubusercontent.com/SarmadAslamMemon/atm-finder-backend/main/assets/app_logo.png" alt="ATM Finder Logo" width="56" height="56" style="width: 56px; height: 56px; border-radius: 14px; display: block; border: 0; margin: 0 auto 12px auto; box-shadow: 0 4px 10px rgba(255, 106, 66, 0.18);" />
                    <div style="font-size: 21px; font-weight: 800; color: #1C1917; letter-spacing: -0.3px;">ATM Finder</div>
                    <div style="font-size: 13px; color: #78716C; font-weight: 500; margin-top: 2px;">Pakistan Branch &amp; ATM Locator</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Soft Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid #F7F3EE;"></div>
            </td>
          </tr>

          <!-- Main Body -->
          <tr>
            <td style="padding: 28px 36px 24px 36px;">
              <h1 style="font-size: 19px; font-weight: 700; color: #1C1917; margin: 0 0 10px 0; letter-spacing: -0.2px;">
                Verify your account
              </h1>
              <p style="font-size: 14px; line-height: 1.6; color: #57534E; margin: 0 0 24px 0;">
                Welcome to ATM Finder. Please enter the one-time verification code below into the application to complete your sign-in:
              </p>

              <!-- OTP Code Display Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin: 0 0 24px 0;">
                <tr>
                  <td align="center" style="background: #FFF6F2; border: 1.5px solid #FFDEC9; border-radius: 16px; padding: 26px 16px;">
                    <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; color: #E5532A; margin-bottom: 8px;">
                      Verification Code
                    </div>
                    <div style="font-family: 'SF Mono', Monaco, Menlo, Consolas, 'Courier New', monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #E5532A; padding-left: 10px;">
                      ${otp}
                    </div>
                    <div style="margin-top: 10px;">
                      <span style="display: inline-block; background-color: #FFFFFF; border: 1px solid #FFDEC9; color: #78716C; font-size: 12px; font-weight: 500; padding: 4px 12px; border-radius: 20px;">
                        ⏱️ Expires in 10 minutes
                      </span>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Security Callout -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FFFBEB; border: 1px solid #FEF3C7; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px;">
                    <p style="font-size: 12px; color: #92400E; line-height: 1.5; margin: 0;">
                      <strong>Security Tip:</strong> Never share this code with anyone. ATM Finder support will never call or message asking for your code.
                    </p>
                  </td>
                </tr>
              </table>

              <p style="font-size: 13px; color: #A8A29E; line-height: 1.5; margin: 0;">
                If you did not request this verification, you can safely disregard this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF8F5; border-top: 1px solid #F2ECE6; padding: 24px 36px; text-align: center;">
              <!-- Navigation Links -->
              <div style="font-size: 12px; color: #78716C; margin-bottom: 12px;">
                <a href="https://atmfinder.varbox.dev" style="color: #FF6A42; text-decoration: none; font-weight: 600;" target="_blank">Website</a>
                <span style="color: #D6D3D1; margin: 0 8px;">•</span>
                <a href="https://atmfinder.varbox.dev/privacy" style="color: #FF6A42; text-decoration: none; font-weight: 600;" target="_blank">Privacy</a>
                <span style="color: #D6D3D1; margin: 0 8px;">•</span>
                <a href="https://atmfinder.varbox.dev/terms" style="color: #FF6A42; text-decoration: none; font-weight: 600;" target="_blank">Terms</a>
                <span style="color: #D6D3D1; margin: 0 8px;">•</span>
                <a href="mailto:support@varbox.dev" style="color: #FF6A42; text-decoration: none; font-weight: 600;">Support</a>
              </div>

              <div style="font-size: 11px; color: #A8A29E; line-height: 1.6;">
                ATM Finder Pakistan • Locate 15,000+ ATMs &amp; Branches<br />
                Powered by <strong>Varbox</strong> • &copy; 2026 Varbox. All rights reserved.
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
  const logoBuffer = getLogoBuffer();

  // 1. Try Resend HTTP API first (Uses HTTPS port 443 - works seamlessly on Render)
  if (resendApiKey) {
    try {
      const resend = new Resend(resendApiKey);
      const from = process.env.RESEND_FROM || 'ATM Finder <noreply@varbox.dev>';

      const attachments = logoBuffer
        ? [
            {
              filename: 'app_logo.png',
              content: logoBuffer,
              content_id: 'app_logo',
            },
          ]
        : [];

      const { data, error } = await resend.emails.send({
        from,
        to: email,
        reply_to: 'support@varbox.dev',
        subject,
        text: textContent,
        html: htmlContent,
        attachments,
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

    const attachments = logoBuffer
      ? [
          {
            filename: 'app_logo.png',
            content: logoBuffer,
            cid: 'app_logo',
          },
        ]
      : [];

    await transporter.sendMail({
      from: `"ATM Finder Pakistan" <${from}>`,
      to: email,
      subject,
      text: textContent,
      html: htmlContent,
      attachments,
    });
    console.log(`[Email] OTP successfully sent to ${email}`);
  } catch (error) {
    console.error(`[Email Error] Failed to send email to ${email}:`, error);
  }
}
