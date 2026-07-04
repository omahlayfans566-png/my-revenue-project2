/**
 * emailService.js
 *
 * Lazy-initialises the nodemailer transporter using SMTP credentials
 * from environment variables.
 */
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// ── Lazy transporter ──────────────────────────────────────────────────────────
let _transporter = null;

const looksLikePlaceholder = (value) => {
  if (!value) return true;
  const v = String(value).trim().toLowerCase();
  return (
    v.startsWith("your_") ||
    v.includes("example.com") ||
    v === "changeme" ||
    v === "test"
  );
};

const getTransporter = () => {
  if (_transporter) return _transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_PASSWORD;

  if (!smtpUser || !smtpPass || looksLikePlaceholder(smtpUser) || looksLikePlaceholder(smtpPass)) {
    throw new Error("SMTP credentials are missing. Set SMTP_USER and SMTP_PASS (or GMAIL_USER and GMAIL_PASSWORD).");
  }

  if (smtpHost) {
    _transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
    });
    return _transporter;
  }

  _transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: smtpUser, pass: smtpPass },
  });
  return _transporter;
};

/**
 * Send an email. Throws on configuration or transport failures.
 */
const sendMail = async (options) => {
  try {
    const t = getTransporter();
    return await t.sendMail(options);
  } catch (error) {
    throw error;
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (email, otp) => {
  return sendMail({
    from: process.env.SMTP_FROM || `"DateClone" <${process.env.SMTP_USER || process.env.GMAIL_USER || "noreply@dateclone.com"}>`,
    to: email,
    subject: "Your DateClone Verification Code",
    html: `
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
      <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:20px 0;">
          <tr><td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
              <!-- Header -->
              <tr>
                <td style="background:linear-gradient(135deg,#e91e63,#ff4081);padding:32px 24px;border-radius:16px 16px 0 0;text-align:center;">
                  <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">DateClone 💕</h1>
                  <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:15px;">Welcome! Let's get you verified.</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="background-color:#ffffff;padding:40px 32px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
                  <p style="color:#333333;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi there! 👋</p>
                  <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 8px;">
                    Thanks for joining <strong style="color:#e91e63;">DateClone</strong>. Use the verification code below to confirm your email address and activate your account.
                  </p>
                  <p style="color:#555555;font-size:15px;line-height:1.7;margin:0 0 32px;">
                    This helps us keep the community authentic and secure.
                  </p>

                  <!-- OTP Code -->
                  <div style="text-align:center;margin:0 0 32px;">
                    <div style="display:inline-block;background:#fce4ec;border:2px dashed #e91e63;border-radius:16px;padding:24px 48px;">
                      <p style="color:#888888;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Verification Code</p>
                      <p style="font-size:44px;font-weight:800;letter-spacing:12px;color:#e91e63;margin:0;font-family:'Courier New',Courier,monospace;">${otp}</p>
                    </div>
                  </div>

                  <div style="background:#fff8e1;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
                    <p style="color:#f57f17;font-size:13px;margin:0;">
                      ⏱ This code expires in <strong>10 minutes</strong>. For your security, do not share this code with anyone.
                    </p>
                  </div>

                  <p style="color:#999999;font-size:12px;line-height:1.6;text-align:center;margin:0;">
                    If you didn't sign up for DateClone, you can safely ignore this email.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color:#fafafa;padding:24px 32px;border-radius:0 0 16px 16px;border:1px solid #e0e0e0;border-top:none;text-align:center;">
                  <p style="color:#bbbbbb;font-size:12px;margin:0 0 4px;">DateClone — Find your perfect match</p>
                  <p style="color:#cccccc;font-size:11px;margin:0;">
                    This is an automated message, please do not reply directly.
                  </p>
                </td>
              </tr>
            </table>
          </td></tr>
        </table>
      </body>
      </html>`,
  });
};

export const sendWelcomeEmail = async (email, firstName) => {
  return sendMail({
    from: process.env.SMTP_FROM || `"DateClone" <${process.env.SMTP_USER || process.env.GMAIL_USER || "noreply@dateclone.com"}>`,
    to: email,
    subject: "Welcome to DateClone! 🎉",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#ff1744,#ff4081);padding:20px;border-radius:10px 10px 0 0;">
          <h1 style="color:white;margin:0;">Welcome, ${firstName}! 💕</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;border-radius:0 0 10px 10px;">
          <p style="color:#333;font-size:16px;">Your account is now active!</p>
          <p style="color:#666;line-height:1.6;">Start exploring profiles and find your perfect match.</p>
          <p style="color:#666;">Happy matching! 🎯</p>
        </div>
      </div>`,
  });
};

export const sendPremiumActivationEmail = async (email, tier, expiryDate) => {
  return sendMail({
    from: process.env.SMTP_FROM || `"DateClone" <${process.env.SMTP_USER || process.env.GMAIL_USER || "noreply@dateclone.com"}>`,
    to: email,
    subject: `🎉 Premium ${tier.toUpperCase()} Activated!`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#ff1744,#ff4081);padding:20px;border-radius:10px 10px 0 0;">
          <h1 style="color:white;margin:0;">Premium Unlocked! ✨</h1>
        </div>
        <div style="padding:30px;background:#f9f9f9;border-radius:0 0 10px 10px;">
          <p style="color:#333;font-size:16px;">Your ${tier} membership is now active until ${expiryDate}.</p>
        </div>
      </div>`,
  });
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5174"}/reset-password?token=${resetToken}`;
  return sendMail({
    from: process.env.SMTP_FROM || `"DateClone" <${process.env.SMTP_USER || process.env.GMAIL_USER || "noreply@dateclone.com"}>`,
    to: email,
    subject: "Reset Your DateClone Password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#ff1744,#ff4081);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;">DateClone 💕</h1>
          <p style="color:rgba(255,255,255,.85);margin:6px 0 0;">Password Reset</p>
        </div>
        <div style="padding:36px 30px;background:#fff;border-radius:0 0 12px 12px;border:1px solid #f0f0f0;border-top:none;">
          <p style="color:#333;font-size:16px;margin-top:0;">Hi there! 👋</p>
          <p style="color:#666;line-height:1.7;">We received a request to reset your password. Click the button below — this link expires in <strong>1 hour</strong>.</p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="background:linear-gradient(135deg,#ff1744,#ff4081);color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">Reset Password</a>
          </div>
          <p style="color:#aaa;font-size:12px;text-align:center;">If you didn't request this, ignore this email — your password won't change.</p>
          <p style="color:#ccc;font-size:11px;text-align:center;margin-top:8px;">Or copy this link: ${resetUrl}</p>
        </div>
      </div>`,
  });
};
