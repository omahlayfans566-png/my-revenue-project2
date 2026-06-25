/**
 * emailService.js
 *
 * Lazy-initialises the nodemailer transporter so a missing/placeholder
 * GMAIL_USER never crashes the server on startup.
 */
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

// ── Lazy transporter ──────────────────────────────────────────────────────────
let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;

  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_PASSWORD;

  if (!user || user === "your_email@gmail.com" || !pass || pass === "your_16_char_app_password") {
    // Return a dummy transporter that logs instead of sending
    return null;
  }

  _transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });
  return _transporter;
};

/**
 * Send an email. Silently no-ops if email is not configured (dev mode).
 */
const sendMail = async (options) => {
  const t = getTransporter();
  if (!t) {
    // Dev fallback — log to console so you can copy the OTP during testing
    console.log("\n╔══════════════════════════════════════╗");
    console.log("║  📧 EMAIL NOT CONFIGURED — DEV MODE  ║");
    console.log("╠══════════════════════════════════════╣");
    console.log(`║  To:      ${options.to}`);
    console.log(`║  Subject: ${options.subject}`);
    if (options._otp) {
      console.log(`║  OTP CODE: ${options._otp}  ← use this to verify`);
    }
    console.log("╚══════════════════════════════════════╝\n");
    return { messageId: "dev-mode-no-email-sent" };
  }
  return t.sendMail(options);
};

// ── Public API ────────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (email, otp) => {
  return sendMail({
    from: `"DateClone 💕" <${process.env.GMAIL_USER || "noreply@dateclone.com"}>`,
    to: email,
    subject: "Your DateClone Verification Code",
    _otp: otp,   // used by dev fallback logger
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:linear-gradient(135deg,#ff1744,#ff4081);padding:24px 20px;border-radius:12px 12px 0 0;text-align:center;">
          <h1 style="color:white;margin:0;font-size:26px;">DateClone 💕</h1>
          <p style="color:rgba(255,255,255,.85);margin:6px 0 0;font-size:14px;">Verify your account</p>
        </div>
        <div style="padding:36px 30px;background:#fff;border-radius:0 0 12px 12px;border:1px solid #f0f0f0;border-top:none;">
          <p style="color:#333;font-size:16px;margin-top:0;">Hi there! 👋</p>
          <p style="color:#666;line-height:1.7;font-size:15px;">
            Use the verification code below to confirm your email and activate your DateClone account.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <div style="display:inline-block;background:#fff5f7;border:2px dashed #ff4081;border-radius:14px;padding:20px 40px;">
              <p style="color:#999;font-size:12px;text-transform:uppercase;letter-spacing:1.5px;margin:0 0 8px;">Your verification code</p>
              <p style="font-size:42px;font-weight:800;letter-spacing:10px;color:#ff1744;margin:0;font-family:'Courier New',monospace;">${otp}</p>
            </div>
          </div>
          <p style="color:#888;font-size:13px;text-align:center;margin-bottom:4px;">⏱ Expires in <strong>10 minutes</strong>.</p>
          <p style="color:#aaa;font-size:12px;text-align:center;">If you didn't sign up for DateClone, ignore this email.</p>
        </div>
      </div>`,
  });
};

export const sendWelcomeEmail = async (email, firstName) => {
  return sendMail({
    from: `"DateClone 💕" <${process.env.GMAIL_USER || "noreply@dateclone.com"}>`,
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
    from: `"DateClone 💕" <${process.env.GMAIL_USER || "noreply@dateclone.com"}>`,
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
    from: `"DateClone 💕" <${process.env.GMAIL_USER || "noreply@dateclone.com"}>`,
    to: email,
    subject: "Reset Your DateClone Password",
    _otp: resetToken,
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
