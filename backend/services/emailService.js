/**
 * emailService.js
 *
 * Nodemailer email service with DNS-bypass for environments where the local
 * resolver cannot reach smtp.gmail.com (EAI_AGAIN / DNS blocked by router).
 *
 * Strategy:
 *   1. Try to resolve smtp.gmail.com via Google Public DNS (8.8.8.8) first.
 *   2. If that succeeds, connect directly by IP and set the SNI servername
 *      so TLS still verifies correctly.
 *   3. Fall back to the hostname on direct-connect failure.
 *   4. Retry up to 3 times on transient send failures.
 *
 * OTP codes are ALWAYS printed to the backend console so developers can
 * complete verification during local development even if SMTP is not set up.
 */

import nodemailer from "nodemailer";
import { Resolver } from "dns";
import dotenv from "dotenv";
dotenv.config();

// ── DNS helper ────────────────────────────────────────────────────────────────
/**
 * Resolve a hostname via a specific DNS server (defaults to Google 8.8.8.8).
 * Returns the first A record, or null on failure.
 */
const resolveViaGoogle = (hostname, dnsServer = "8.8.8.8") =>
  new Promise((resolve) => {
    const resolver = new Resolver();
    resolver.setServers([dnsServer]);
    resolver.resolve4(hostname, (err, addresses) => {
      if (err || !addresses?.length) {
        console.warn(`[EmailService] DNS lookup for ${hostname} via ${dnsServer} failed: ${err?.message}`);
        resolve(null);
      } else {
        resolve(addresses[0]);
      }
    });
  });

// ── Credential helpers ────────────────────────────────────────────────────────
const looksLikePlaceholder = (value) => {
  if (!value) return true;
  const v = String(value).trim().toLowerCase();
  return (
    v.startsWith("your_") ||
    v.includes("example.com") ||
    v === "changeme" ||
    v === "test" ||
    v === ""
  );
};

const getCredentials = () => {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  // Strip ALL whitespace from the password — Google App Passwords are displayed
  // with spaces (e.g. "abcd efgh ijkl mnop") but must be sent WITHOUT spaces.
  // This one-liner makes .env format irrelevant.
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_PASSWORD || "";
  const pass = rawPass.replace(/\s+/g, "");
  const from = process.env.SMTP_FROM || `"DateClone" <${user || "noreply@dateclone.com"}>`;
  return { user, pass, from };
};

// ── Transporter factory ───────────────────────────────────────────────────────
let _transporter = null;
let _transporterCreatedAt = 0;
let _transporterPromise = null;   // in-flight guard: prevents concurrent creations

// Re-create the transporter every 4 hours so a resolved IP doesn't go stale
const TRANSPORTER_TTL_MS = 4 * 60 * 60 * 1000;

const createTransporter = async () => {
  const { user, pass } = getCredentials();

  if (looksLikePlaceholder(user) || looksLikePlaceholder(pass)) {
    console.warn(
      "[EmailService] ⚠️  SMTP credentials are not configured.\n" +
      "   Set GMAIL_USER and GMAIL_PASSWORD (App Password) in backend/.env\n" +
      "   OTP codes will still be printed to the console.\n"
    );
    return null;
  }

  const smtpHostname = process.env.SMTP_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpSecure = String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";

  console.log(`[EmailService] Resolving ${smtpHostname} via Google DNS (8.8.8.8)…`);
  const resolvedIp = await resolveViaGoogle(smtpHostname);

  if (resolvedIp) {
    console.log(`[EmailService] Resolved to IP: ${resolvedIp}`);
  } else {
    console.warn(`[EmailService] DNS resolution failed — falling back to hostname`);
  }

  const transportConfig = resolvedIp
    ? {
      host: resolvedIp,
      port: smtpPort,
      secure: smtpSecure,
      tls: {
        servername: smtpHostname,
        rejectUnauthorized: true,
      },
      auth: { user, pass },
    }
    : {
      service: process.env.SMTP_HOST ? undefined : "gmail",
      host: process.env.SMTP_HOST || undefined,
      port: process.env.SMTP_HOST ? smtpPort : undefined,
      secure: process.env.SMTP_HOST ? smtpSecure : undefined,
      auth: { user, pass },
    };

  console.log(`[EmailService] Creating transporter → ${resolvedIp ?? smtpHostname}:${smtpPort} user=${user}`);
  const t = nodemailer.createTransport(transportConfig);

  try {
    await t.verify();
    console.log(`[EmailService] ✅ SMTP connection verified and ready`);
  } catch (verifyErr) {
    console.error(
      `[EmailService] ❌ SMTP verify failed: ${verifyErr.message}\n` +
      `   Code: ${verifyErr.code ?? "n/a"} | Response: ${verifyErr.response ?? "n/a"}\n` +
      "   Check: GMAIL_USER / GMAIL_PASSWORD App Password, 2-Step Verification ON\n"
    );
    // Return the transporter anyway — sendMail may still work (some SMTP servers
    // allow sending even if verify() fails due to capability negotiation quirks).
  }

  return t;
};

const getTransporter = async () => {
  const now = Date.now();

  // Return cached transporter if still fresh
  if (_transporter && (now - _transporterCreatedAt) < TRANSPORTER_TTL_MS) {
    return _transporter;
  }

  // Deduplicate: if a creation is already in-flight, wait for it
  if (_transporterPromise) {
    return _transporterPromise;
  }

  // Start a new creation and cache the promise so concurrent calls share it
  _transporterPromise = createTransporter()
    .then((t) => {
      _transporter = t;
      _transporterCreatedAt = Date.now();
      _transporterPromise = null;
      return t;
    })
    .catch((err) => {
      _transporterPromise = null;
      throw err;
    });

  return _transporterPromise;
};

// ── Retry helper ──────────────────────────────────────────────────────────────
const sendWithRetry = async (options, maxRetries = 3, delayMs = 1000) => {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const t = await getTransporter();
      if (!t) {
        // SMTP not configured — console-only mode
        console.log(`[EmailService] Console-only mode — email to ${options.to} not sent via SMTP`);
        return { messageId: "console-only" };
      }
      console.log(`[EmailService] Sending to ${options.to} (attempt ${attempt}/${maxRetries})…`);
      const info = await t.sendMail(options);
      console.log(
        `[EmailService] ✅ Email accepted by SMTP server\n` +
        `   To:        ${options.to}\n` +
        `   Subject:   ${options.subject}\n` +
        `   MessageId: ${info.messageId}\n` +
        `   Accepted:  ${JSON.stringify(info.accepted)}\n` +
        `   Rejected:  ${JSON.stringify(info.rejected)}`
      );
      return info;
    } catch (err) {
      lastErr = err;
      const isTransient =
        err.code === "ECONNRESET" ||
        err.code === "ETIMEDOUT" ||
        err.code === "ECONNREFUSED" ||
        err.code === "EAI_AGAIN" ||
        (err.responseCode && err.responseCode >= 421);

      console.error(
        `[EmailService] ❌ Send attempt ${attempt}/${maxRetries} FAILED:\n` +
        `   To:       ${options.to}\n` +
        `   Error:    ${err.message}\n` +
        `   Code:     ${err.code ?? "n/a"}\n` +
        `   SMTP res: ${err.response ?? "n/a"}\n` +
        `   Command:  ${err.command ?? "n/a"}` +
        (isTransient ? "\n   ↳ Transient error — will retry" : "")
      );

      if (!isTransient || attempt === maxRetries) break;

      // Force transporter rebuild on transient errors so we get a fresh IP
      _transporter = null;
      await new Promise(r => setTimeout(r, delayMs * attempt));
    }
  }
  throw lastErr;
};

// ── Startup verification (called from server.js) ──────────────────────────────
export const verifyEmailService = async () => {
  const { user, pass } = getCredentials();
  if (looksLikePlaceholder(user) || looksLikePlaceholder(pass)) {
    console.warn(
      "\n⚠️  Email service not configured — running in console-OTP mode.\n" +
      "   Set GMAIL_USER and GMAIL_PASSWORD in backend/.env to enable email delivery.\n"
    );
    return false;
  }
  await getTransporter(); // triggers verify() inside createTransporter
  return true;
};

// ── Public API ────────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (email, otp) => {
  // ALWAYS log OTP to console for development / fallback
  console.log(
    `\n📧 [EmailService] Verification OTP for ${email}\n` +
    `   ┌─────────────────────────┐\n` +
    `   │   OTP Code:  ${otp}   │\n` +
    `   └─────────────────────────┘\n` +
    `   (expires in 10 minutes)\n`
  );

  const { from } = getCredentials();

  return sendWithRetry({
    from,
    to: email,
    subject: "Your DateClone Verification Code",
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);padding:32px 24px;border-radius:16px 16px 0 0;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">DateClone 💕</h1>
            <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:15px;">Welcome! Let's get you verified.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#fff;padding:40px 32px;border-left:1px solid #e0e0e0;border-right:1px solid #e0e0e0;">
            <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 20px;">Hi there! 👋</p>
            <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 32px;">
              Use the verification code below to confirm your email and activate your account.
            </p>
            <div style="text-align:center;margin:0 0 32px;">
              <div style="display:inline-block;background:#FFF1F6;border:2px dashed #FF4D8D;border-radius:16px;padding:24px 48px;">
                <p style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:2px;margin:0 0 10px;">Verification Code</p>
                <p style="font-size:44px;font-weight:800;letter-spacing:12px;color:#FF4D8D;margin:0;font-family:'Courier New',Courier,monospace;">${otp}</p>
              </div>
            </div>
            <div style="background:#fff8e1;border-radius:10px;padding:16px 20px;margin:0 0 24px;">
              <p style="color:#f57f17;font-size:13px;margin:0;">
                ⏱ This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
              </p>
            </div>
            <p style="color:#999;font-size:12px;line-height:1.6;text-align:center;margin:0;">
              If you didn't sign up for DateClone, you can safely ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#fafafa;padding:24px 32px;border-radius:0 0 16px 16px;border:1px solid #e0e0e0;border-top:none;text-align:center;">
            <p style="color:#bbb;font-size:12px;margin:0 0 4px;">DateClone — Find your perfect match</p>
            <p style="color:#ccc;font-size:11px;margin:0;">Automated message — please do not reply.</p>
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
  const { from } = getCredentials();
  return sendWithRetry({
    from,
    to: email,
    subject: "Welcome to DateClone! 🎉",
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);padding:20px;border-radius:10px 10px 0 0;">
    <h1 style="color:white;margin:0;">Welcome, ${firstName}! 💕</h1>
  </div>
  <div style="padding:30px;background:#f9f9f9;border-radius:0 0 10px 10px;">
    <p style="color:#333;font-size:16px;">Your account is now active!</p>
    <p style="color:#666;line-height:1.6;">Start exploring profiles and find your perfect match.</p>
    <p style="color:#666;">Happy matching! 🎯</p>
  </div>
</div>`,
  }).catch(err => {
    // Welcome email failure is non-fatal
    console.warn("[EmailService] Welcome email failed (non-fatal):", err.message);
  });
};

export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || "http://localhost:5174"}/reset-password?token=${resetToken}`;
  const { from } = getCredentials();

  console.log(`[EmailService] Password reset link for ${email}: ${resetUrl}`);

  return sendWithRetry({
    from,
    to: email,
    subject: "Reset Your DateClone Password",
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
    <h1 style="color:white;margin:0;">DateClone 💕</h1>
    <p style="color:rgba(255,255,255,.85);margin:6px 0 0;">Password Reset</p>
  </div>
  <div style="padding:36px 30px;background:#fff;border-radius:0 0 12px 12px;border:1px solid #f0f0f0;border-top:none;">
    <p style="color:#333;font-size:16px;margin-top:0;">Hi there! 👋</p>
    <p style="color:#666;line-height:1.7;">Click the button below to reset your password — link expires in <strong>1 hour</strong>.</p>
    <div style="text-align:center;margin:32px 0;">
      <a href="${resetUrl}" style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);color:white;padding:14px 32px;border-radius:50px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">
        Reset Password
      </a>
    </div>
    <p style="color:#aaa;font-size:12px;text-align:center;">If you didn't request this, ignore this email.</p>
    <p style="color:#ccc;font-size:11px;text-align:center;margin-top:8px;word-break:break-all;">${resetUrl}</p>
  </div>
</div>`,
  });
};

export const sendPremiumActivationEmail = async (email, tier, expiryDate) => {
  const { from } = getCredentials();
  return sendWithRetry({
    from,
    to: email,
    subject: `🎉 Premium ${tier.toUpperCase()} Activated!`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
  <div style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);padding:20px;border-radius:10px 10px 0 0;">
    <h1 style="color:white;margin:0;">Premium Unlocked! ✨</h1>
  </div>
  <div style="padding:30px;background:#f9f9f9;border-radius:0 0 10px 10px;">
    <p style="color:#333;font-size:16px;">Your ${tier} membership is now active until ${expiryDate}.</p>
  </div>
</div>`,
  }).catch(err => {
    console.warn("[EmailService] Premium activation email failed (non-fatal):", err.message);
  });
};
