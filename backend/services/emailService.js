/**
 * emailService.js — Production Transactional Email Service
 *
 * Provider strategy (priority order):
 *   1. Resend  (RESEND_API_KEY)  — primary production provider
 *   2. SMTP    (SMTP / GMAIL vars) — fallback / local development
  * 3. Console — development fallback when neither is configured
    *
 * Why Resend over Gmail SMTP:
 *   • REST API — no TCP connection, no DNS resolution, no IP routing issues
  *   • 99.9 % SLA, dedicated infrastructure, dedicated IPs
    *   • Built -in SPF / DKIM / DMARC on resend.dev domain(no DNS config needed for dev)
 *   • Free tier: 3,000 emails / month, 100 / day
  *   • Automatic retry and delivery tracking in the dashboard
    *   • No "App Password" complexity, no 2FA SMTP issues
      */

import { Resend } from "resend";
import nodemailer from "nodemailer";
import { Resolver } from "dns";
import dotenv from "dotenv";
dotenv.config();

// ── Configuration validation ──────────────────────────────────────────────────
const isPlaceholder = (v) => {
  if (!v) return true;
  const s = String(v).trim().toLowerCase();
  return s === "" || s.startsWith("your_") || s === "changeme" || s.includes("example.com");
};

export const EMAIL_CONFIG = {
  resendApiKey: process.env.RESEND_API_KEY || null,
  smtpUser: (process.env.SMTP_USER || process.env.GMAIL_USER || ""),
  smtpPass: (process.env.SMTP_PASS || process.env.GMAIL_PASSWORD || "").replace(/\s+/g, ""),
  fromAddress: process.env.EMAIL_FROM || process.env.SMTP_FROM ||
    (process.env.RESEND_API_KEY
      ? "DateClone <onboarding@resend.dev>"        // free Resend sandbox
      : `DateClone <${process.env.GMAIL_USER || "noreply@dateclone.com"}>`),
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
};

// Active provider: "resend" | "smtp" | "console"
export const getActiveProvider = () => {
  if (!isPlaceholder(EMAIL_CONFIG.resendApiKey)) return "resend";
  if (!isPlaceholder(EMAIL_CONFIG.smtpUser) && !isPlaceholder(EMAIL_CONFIG.smtpPass)) return "smtp";
  return "console";
};

// ── Resend client (lazy) ──────────────────────────────────────────────────────
let _resendClient = null;
const getResendClient = () => {
  if (!_resendClient) {
    _resendClient = new Resend(EMAIL_CONFIG.resendApiKey);
  }
  return _resendClient;
};

// ── SMTP transporter (lazy, with DNS bypass) ──────────────────────────────────
let _transporter = null;
let _transporterAt = 0;
let _transporterPromise = null;
const TRANSPORTER_TTL = 4 * 60 * 60 * 1000;

const resolveViaGoogle = (hostname) =>
  new Promise((resolve) => {
    const r = new Resolver();
    r.setServers(["8.8.8.8"]);
    r.resolve4(hostname, (err, addrs) => resolve(err ? null : addrs?.[0] ?? null));
  });

const buildSmtpTransporter = async () => {
  const { smtpUser, smtpPass } = EMAIL_CONFIG;
  if (isPlaceholder(smtpUser) || isPlaceholder(smtpPass)) return null;

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === "true";

  const ip = await resolveViaGoogle(host);
  console.log(`[EmailService/SMTP] ${host} → ${ip ?? "hostname (DNS bypass failed)"}`);

  const config = ip
    ? { host: ip, port, secure, tls: { servername: host, rejectUnauthorized: true }, auth: { user: smtpUser, pass: smtpPass } }
    : { service: host === "smtp.gmail.com" ? "gmail" : undefined, host, port, secure, auth: { user: smtpUser, pass: smtpPass } };

  const t = nodemailer.createTransport(config);
  try {
    await t.verify();
    console.log("[EmailService/SMTP] ✅ SMTP verified and ready");
  } catch (err) {
    console.error(`[EmailService/SMTP] ❌ verify failed: ${err.message}`);
  }
  return t;
};

const getSmtpTransporter = async () => {
  if (_transporter && Date.now() - _transporterAt < TRANSPORTER_TTL) return _transporter;
  if (_transporterPromise) return _transporterPromise;
  _transporterPromise = buildSmtpTransporter()
    .then(t => { _transporter = t; _transporterAt = Date.now(); _transporterPromise = null; return t; })
    .catch(err => { _transporterPromise = null; throw err; });
  return _transporterPromise;
};

// ── Core send function ────────────────────────────────────────────────────────
/**
 * Send an email using the configured provider.
 * Always logs OTP to console as development fallback.
 *
 * @param {{ to, subject, html, text }} options
 * @returns {{ messageId, provider }} on success
 * @throws on unrecoverable failure (caller decides how to handle)
 */
export const sendEmail = async ({ to, subject, html, text }) => {
  const provider = getActiveProvider();
  console.log(`[EmailService] send → ${to} | subject: "${subject}" | provider: ${provider}`);

  if (provider === "resend") {
    return sendViaResend({ to, subject, html, text });
  }
  if (provider === "smtp") {
    return sendViaSmtp({ to, subject, html, text });
  }

  // Console-only mode
  console.log(`[EmailService] Console-only mode — email not delivered:\n  To: ${to}\n  Subject: ${subject}`);
  return { messageId: "console-only", provider: "console" };
};

// ── Resend provider ────────────────────────────────────────────────────────────
const sendViaResend = async ({ to, subject, html, text }, attempt = 1, maxAttempts = 3) => {
  try {
    const client = getResendClient();
    const result = await client.emails.send({
      from: EMAIL_CONFIG.fromAddress,
      to: [to],
      subject,
      html,
      text: text || stripHtml(html),
      tags: [{ name: "app", value: "dateclone" }],
    });

    if (result.error) {
      const err = new Error(result.error.message || "Resend API error");
      err.code = result.error.name;
      err.statusCode = result.error.statusCode;
      throw err;
    }

    console.log(
      `[EmailService/Resend] ✅ Accepted\n` +
      `   To:        ${to}\n` +
      `   MessageId: ${result.data?.id}\n` +
      `   Subject:   ${subject}`
    );

    return { messageId: result.data?.id, provider: "resend" };

  } catch (err) {
    const isTransient = err.statusCode >= 429 || err.statusCode >= 500 || err.code === "ECONNRESET";
    console.error(
      `[EmailService/Resend] ❌ Attempt ${attempt}/${maxAttempts} failed:\n` +
      `   To:      ${to}\n` +
      `   Error:   ${err.message}\n` +
      `   Code:    ${err.code ?? "n/a"}\n` +
      `   Status:  ${err.statusCode ?? "n/a"}` +
      (isTransient && attempt < maxAttempts ? "\n   ↳ Transient — will retry" : "")
    );

    if (isTransient && attempt < maxAttempts) {
      await new Promise(r => setTimeout(r, 1000 * attempt)); // exponential backoff
      return sendViaResend({ to, subject, html, text }, attempt + 1, maxAttempts);
    }

    throw err;
  }
};

// ── SMTP provider (fallback) ───────────────────────────────────────────────────
const sendViaSmtp = async ({ to, subject, html, text }, attempt = 1, maxAttempts = 3) => {
  try {
    const t = await getSmtpTransporter();
    if (!t) throw new Error("SMTP transporter unavailable");

    const info = await t.sendMail({
      from: EMAIL_CONFIG.fromAddress,
      to,
      subject,
      html,
      text: text || stripHtml(html),
    });

    console.log(
      `[EmailService/SMTP] ✅ Accepted\n` +
      `   To:        ${to}\n` +
      `   MessageId: ${info.messageId}\n` +
      `   Accepted:  ${JSON.stringify(info.accepted)}`
    );

    return { messageId: info.messageId, provider: "smtp" };

  } catch (err) {
    const isTransient =
      err.code === "ECONNRESET" || err.code === "ETIMEDOUT" ||
      err.code === "ECONNREFUSED" || err.code === "EAI_AGAIN" ||
      (err.responseCode && err.responseCode >= 421);

    console.error(
      `[EmailService/SMTP] ❌ Attempt ${attempt}/${maxAttempts}:\n` +
      `   To:     ${to}\n` +
      `   Error:  ${err.message}` +
      (isTransient && attempt < maxAttempts ? "\n   ↳ Transient — will retry" : "")
    );

    if (isTransient && attempt < maxAttempts) {
      _transporter = null; // force reconnect on retry
      await new Promise(r => setTimeout(r, 1000 * attempt));
      return sendViaSmtp({ to, subject, html, text }, attempt + 1, maxAttempts);
    }

    throw err;
  }
};

// ── Plain-text fallback ───────────────────────────────────────────────────────
const stripHtml = (html = "") =>
  html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);

// ── Startup verification ──────────────────────────────────────────────────────
export const verifyEmailService = async () => {
  const provider = getActiveProvider();
  console.log(`\n📧 [EmailService] Active provider: ${provider.toUpperCase()}`);

  if (provider === "resend") {
    console.log(`   API key: re_***${EMAIL_CONFIG.resendApiKey.slice(-4)}`);
    console.log(`   From:    ${EMAIL_CONFIG.fromAddress}`);
    console.log("   ✅ Resend is configured — emails will be delivered via Resend API\n");
    return true;
  }

  if (provider === "smtp") {
    console.log(`   User: ${EMAIL_CONFIG.smtpUser}`);
    await getSmtpTransporter();
    return true;
  }

  console.warn(
    "   ⚠️  No email provider configured — running in console-OTP mode.\n" +
    "   Set RESEND_API_KEY in backend/.env to enable production delivery.\n"
  );
  return false;
};

// ════════════════════════════════════════════════════════════════════════════════
// PUBLIC EMAIL FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════════

// ── Verification email ─────────────────────────────────────────────────────────
export const sendVerificationEmail = async (email, otp) => {
  // Always print OTP to console — works as dev fallback and audit trail
  console.log(
    `\n📧 [EmailService] OTP for ${email}\n` +
    `   ┌──────────────────────────┐\n` +
    `   │  Code: ${otp}  (10 min) │\n` +
    `   └──────────────────────────┘\n`
  );

  const html = verificationTemplate(otp);
  const text = `Your DateClone verification code is: ${otp}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

  return sendEmail({
    to: email,
    subject: "Your DateClone Verification Code",
    html,
    text,
  });
};

// ── Welcome email ──────────────────────────────────────────────────────────────
export const sendWelcomeEmail = async (email, firstName) => {
  return sendEmail({
    to: email,
    subject: "Welcome to DateClone! 💕",
    html: welcomeTemplate(firstName),
    text: `Welcome to DateClone, ${firstName}! Your account is now active. Start exploring and find your perfect match.`,
  }).catch(err => {
    console.warn("[EmailService] Welcome email failed (non-fatal):", err.message);
  });
};

// ── Password reset email ───────────────────────────────────────────────────────
export const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${EMAIL_CONFIG.frontendUrl}/reset-password?token=${resetToken}`;
  console.log(`[EmailService] Password reset link for ${email}: ${resetUrl}`);

  return sendEmail({
    to: email,
    subject: "Reset Your DateClone Password",
    html: resetTemplate(resetUrl),
    text: `Reset your DateClone password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
};

// ── 2FA code email ────────────────────────────────────────────────────────────
export const send2FACode = async (email, otp) => {
  console.log(
    `\n📧 [EmailService] 2FA code for ${email}\n` +
    `   ┌──────────────────────────┐\n` +
    `   │  Code: ${otp}  (5 min) │\n` +
    `   └──────────────────────────┘\n`
  );

  const html = twoFATemplate(otp);
  const text = `Your DateClone two-factor authentication code is: ${otp}\n\nThis code expires in 5 minutes. Do not share it with anyone.`;

  return sendEmail({
    to: email,
    subject: "Your DateClone 2FA Code",
    html,
    text,
  });
};

// ── Email change verification ─────────────────────────────────────────────────
export const sendEmailChangeVerification = async (email, token) => {
  const verifyUrl = `${EMAIL_CONFIG.frontendUrl}/settings?verifyEmail=${token}`;
  console.log(`[EmailService] Email change verification for ${email}: ${verifyUrl}`);

  const html = emailChangeTemplate(verifyUrl);
  const text = `Verify your new email address: ${verifyUrl}\n\nThis link expires in 1 hour.`;

  return sendEmail({
    to: email,
    subject: "Verify Your New Email Address - DateClone",
    html,
    text,
  });
};

// ── Premium activation email ───────────────────────────────────────────────────
export const sendPremiumActivationEmail = async (email, tier, expiryDate) => {
  return sendEmail({
    to: email,
    subject: `✨ Premium ${tier.charAt(0).toUpperCase() + tier.slice(1)} Activated!`,
    html: premiumTemplate(tier, expiryDate),
    text: `Your DateClone Premium ${tier} subscription is now active until ${expiryDate}.`,
  }).catch(err => {
    console.warn("[EmailService] Premium email failed (non-fatal):", err.message);
  });
};

// ════════════════════════════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ════════════════════════════════════════════════════════════════════════════════

const verificationTemplate = (otp) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your DateClone email</title>
</head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#FF4D8D 0%,#FF7AA8 100%);padding:36px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:800;letter-spacing:-0.5px;">DateClone 💕</h1>
            <p style="color:rgba(255,255,255,0.88);margin:8px 0 0;font-size:15px;font-weight:400;">Africa's Premier Dating Platform</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px 36px;">
            <p style="color:#1a1a2e;font-size:17px;font-weight:600;margin:0 0 8px;">Hi there 👋</p>
            <p style="color:#555;font-size:15px;line-height:1.7;margin:0 0 28px;">
              Thanks for joining DateClone! Enter this code to verify your email address and activate your account.
            </p>
            <!-- OTP Box -->
            <div style="text-align:center;margin:0 0 28px;">
              <div style="display:inline-block;background:#FFF1F6;border:2px dashed #FF4D8D;border-radius:18px;padding:28px 52px;">
                <p style="color:#999;font-size:11px;text-transform:uppercase;letter-spacing:2.5px;margin:0 0 12px;font-weight:600;">Verification Code</p>
                <p style="font-size:48px;font-weight:900;letter-spacing:14px;color:#FF4D8D;margin:0;font-family:'Courier New',Courier,monospace;line-height:1;">${otp}</p>
              </div>
            </div>
            <!-- Expiry notice -->
            <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 18px;margin:0 0 24px;">
              <p style="color:#92400e;font-size:13px;margin:0;font-weight:500;">
                ⏱ This code expires in <strong>10 minutes</strong>. Do not share it with anyone.
              </p>
            </div>
            <!-- Security notice -->
            <p style="color:#999;font-size:12px;line-height:1.6;text-align:center;margin:0;">
              If you didn't create a DateClone account, please ignore this email.
              Your email address will not be used for any purpose.
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#fafafa;padding:20px 36px;border-top:1px solid #f0f0f0;text-align:center;">
            <p style="color:#ccc;font-size:11px;margin:0;">DateClone · Find your perfect match across Africa</p>
            <p style="color:#ddd;font-size:11px;margin:4px 0 0;">This is an automated message — please do not reply.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const welcomeTemplate = (firstName) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);padding:36px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">Welcome, ${firstName}! 💕</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="color:#333;font-size:16px;line-height:1.7;margin:0 0 16px;">Your account is now verified and active!</p>
            <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 24px;">
              Start exploring profiles, discover compatible matches, and find your perfect connection across Africa.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${EMAIL_CONFIG.frontendUrl}/discover" style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);color:#fff;padding:14px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;box-shadow:0 4px 14px rgba(255,77,141,0.35);">
                Start Discovering →
              </a>
            </div>
            <p style="color:#999;font-size:12px;text-align:center;margin:0;">Happy matching! 🌍</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const resetTemplate = (resetUrl) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);padding:36px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">DateClone 💕</h1>
            <p style="color:rgba(255,255,255,0.9);margin:8px 0 0;font-size:14px;">Password Reset Request</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="color:#333;font-size:16px;margin:0 0 16px;">Hi there 👋</p>
            <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 28px;">
              We received a request to reset your DateClone password. Click the button below — this link expires in <strong>1 hour</strong>.
            </p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${resetUrl}" style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);color:#fff;padding:14px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;box-shadow:0 4px 14px rgba(255,77,141,0.35);">
                Reset Password
              </a>
            </div>
            <p style="color:#aaa;font-size:12px;text-align:center;">If you didn't request this, your account is safe — just ignore this email.</p>
            <p style="color:#ccc;font-size:11px;text-align:center;word-break:break-all;margin-top:8px;">${resetUrl}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const twoFATemplate = (otp) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1a1a2e,#16213e);padding:36px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">DateClone 🔐</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="color:#333;font-size:16px;margin:0 0 16px;">Two-Factor Authentication</p>
            <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 28px;">Enter this code to complete your login.</p>
            <div style="text-align:center;margin:28px 0;">
              <div style="display:inline-block;background:#f0f0ff;border:2px solid #4f46e5;border-radius:18px;padding:24px 48px;">
                <p style="font-size:42px;font-weight:900;letter-spacing:12px;color:#4f46e5;margin:0;font-family:'Courier New',monospace;">${otp}</p>
              </div>
            </div>
            <p style="color:#92400e;font-size:13px;text-align:center;background:#fffbeb;padding:12px;border-radius:10px;">⏱ Expires in 5 minutes. Never share this code.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const emailChangeTemplate = (verifyUrl) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);padding:36px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">DateClone 📧</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="color:#333;font-size:16px;margin:0 0 16px;">Email Change Request</p>
            <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 28px;">Click the button below to verify your new email address. This link expires in 1 hour.</p>
            <div style="text-align:center;margin:28px 0;">
              <a href="${verifyUrl}" style="background:linear-gradient(135deg,#FF4D8D,#FF7AA8);color:#fff;padding:14px 36px;border-radius:50px;text-decoration:none;font-weight:700;font-size:16px;display:inline-block;">Verify Email</a>
            </div>
            <p style="color:#999;font-size:12px;text-align:center;">If you didn't request this, your email will remain unchanged.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const premiumTemplate = (tier, expiryDate) => `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f7f7f7;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f7f7f7;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b,#fbbf24);padding:36px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;">✨ Premium ${tier.charAt(0).toUpperCase() + tier.slice(1)} Unlocked!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px;">
            <p style="color:#333;font-size:16px;line-height:1.7;margin:0 0 16px;">
              Your <strong>DateClone Premium ${tier}</strong> subscription is now active!
            </p>
            <p style="color:#666;font-size:15px;line-height:1.7;margin:0 0 16px;">
              Active until: <strong>${expiryDate}</strong>
            </p>
            <p style="color:#999;font-size:13px;">Enjoy all premium features — unlimited likes, see who liked you, and priority visibility.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
