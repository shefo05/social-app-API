interface OtpEmailOptions {
  otp: string | number;
  expiryMinutes: number;
}

/**
 * Fully inline-styled (no <style> blocks / external CSS) so Gmail and
 * Outlook don't strip the design. Outer <table> layout for Outlook
 * desktop's Word rendering engine; inner content uses simple divs.
 */
export function otpEmailTemplate({ otp, expiryMinutes }: OtpEmailOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Verify your email</title>
  </head>
  <body style="margin:0;padding:0;background-color:#f4f5f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background-color:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
            <tr>
              <td style="padding:32px 32px 0 32px;text-align:center;">
                <div style="font-size:32px;line-height:1;margin-bottom:8px;">💬</div>
                <div style="font-size:18px;font-weight:600;color:#111827;letter-spacing:-0.01em;">Social App</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;text-align:center;">
                <p style="margin:0 0 6px 0;font-size:20px;font-weight:600;color:#111827;">Verify your email</p>
                <p style="margin:0;font-size:15px;line-height:1.5;color:#6b7280;">
                  Enter this code to confirm it's you. That's it, no strings attached.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px;text-align:center;">
                <div style="display:inline-block;background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:18px 28px;">
                  <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#111827;">${otp}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px 32px;text-align:center;">
                <p style="margin:0;font-size:13px;color:#9ca3af;">This code expires in ${expiryMinutes} minutes.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px;">
                <div style="border-top:1px solid #eef0f2;"></div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 28px 32px;text-align:center;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#9ca3af;">
                  Didn't request this? No action needed — just ignore this email.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0 0;font-size:11px;color:#b0b4ba;">Sent by Social App</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
