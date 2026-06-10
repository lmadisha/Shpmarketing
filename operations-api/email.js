const nodemailer = require("nodemailer");

function createSesTransporter() {
  let SESv2Client;
  let SendEmailCommand;
  try {
    ({ SESv2Client, SendEmailCommand } = require("@aws-sdk/client-sesv2"));
  } catch (error) {
    throw new Error(
      "EMAIL_PROVIDER=ses requires @aws-sdk/client-sesv2. Install it in operations-api dependencies.",
      { cause: error },
    );
  }

  const sesConfig = { region: process.env.AWS_REGION || "us-east-1" };

  if (process.env.AWS_ACCESS_KEY_ID) {
    sesConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }
  // If AWS_ACCESS_KEY_ID is absent, SDK uses default credential chain (IAM role)

  const sesClient = new SESv2Client(sesConfig);
  return nodemailer.createTransport({ SES: { sesClient, SendEmailCommand } });
}

function createTransporter() {
  const provider = (process.env.EMAIL_PROVIDER || "smtp").toLowerCase();

  if (provider === "ses") {
    return createSesTransporter();
  }

  // SMTP (default)
  if (!process.env.SMTP_HOST) {
    return null;
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

function buildWelcomeHtml({ fullName, email, password, permissions, appUrl }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px; background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#006aea; padding:28px 32px;">
              <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:600;">Welcome to FrostLink</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 20px; color:#334155; font-size:15px; line-height:1.6;">
                Hi <strong>${fullName}</strong>,
              </p>
              <p style="margin:0 0 24px; color:#334155; font-size:15px; line-height:1.6;">
                An account has been created for you. Here are your login details:
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px; border-bottom:1px solid #e2e8f0;">
                    <span style="color:#64748b; font-size:13px;">Email</span><br>
                    <strong style="color:#0f172a; font-size:15px;">${email}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px; border-bottom:1px solid #e2e8f0;">
                    <span style="color:#64748b; font-size:13px;">Password</span><br>
                    <strong style="color:#0f172a; font-size:15px; font-family:monospace;">${password}</strong>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 20px;">
                    <span style="color:#64748b; font-size:13px;">Role</span><br>
                    <strong style="color:#0f172a; font-size:15px;">${permissions}</strong>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#006aea; border-radius:8px;">
                    <a href="${appUrl}" target="_blank" style="display:inline-block; padding:12px 32px; color:#ffffff; font-size:15px; font-weight:600; text-decoration:none;">
                      Open Application
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0; color:#94a3b8; font-size:13px; line-height:1.5;">
                For security, please change your password after your first login.
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px; border-top:1px solid #e2e8f0;">
              <p style="margin:0; color:#94a3b8; font-size:12px; text-align:center;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendWelcomeEmail({ to, fullName, password, permissions, appUrl }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn("[email] Email transport not configured — skipping welcome email for", to);
    return;
  }

  const from = process.env.SES_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  const html = buildWelcomeHtml({
    fullName: fullName || "User",
    email: to,
    password,
    permissions,
    appUrl: appUrl || "https://uat.frostlink.digital/",
  });

  const info = await transport.sendMail({
    from,
    to,
    subject: "Your FrostLink account has been created",
    html,
  });

  console.info("[email] Welcome email sent to", to, "messageId:", info.messageId);
}

module.exports = { sendWelcomeEmail };
