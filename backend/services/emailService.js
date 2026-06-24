import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASSWORD,
  },
});

export const sendVerificationEmail = async (email, otp) => {
  const mailOptions = {
    from: `"DateClone 💕" <${process.env.GMAIL_USER}>`,
    to: email,
    subject: "Your DateClone Verification Code",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff1744, #ff4081); padding: 24px 20px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 26px; letter-spacing: -0.5px;">DateClone 💕</h1>
          <p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">Verify your account</p>
        </div>
        <div style="padding: 36px 30px; background: #ffffff; border-radius: 0 0 12px 12px; border: 1px solid #f0f0f0; border-top: none;">
          <p style="color: #333; font-size: 16px; margin-top: 0;">Hi there! 👋</p>
          <p style="color: #666; line-height: 1.7; font-size: 15px;">
            Use the verification code below to confirm your email address and activate your DateClone account.
          </p>

          <!-- OTP Box -->
          <div style="text-align: center; margin: 32px 0;">
            <div style="display: inline-block; background: #fff5f7; border: 2px dashed #ff4081; border-radius: 14px; padding: 20px 40px;">
              <p style="color: #999; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 8px;">Your verification code</p>
              <p style="font-size: 42px; font-weight: 800; letter-spacing: 10px; color: #ff1744; margin: 0; font-family: 'Courier New', monospace;">${otp}</p>
            </div>
          </div>

          <p style="color: #888; font-size: 13px; text-align: center; margin-bottom: 4px;">⏱ This code expires in <strong>10 minutes</strong>.</p>
          <p style="color: #aaa; font-size: 12px; text-align: center;">If you didn't create a DateClone account, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

export const sendWelcomeEmail = async (email, firstName) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: "Welcome to DateClone! 🎉",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff1744, #ff4081); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome, ${firstName}! 💕</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Your account is now active!</p>
          <p style="color: #666; line-height: 1.6;">Start exploring profiles and find your perfect match. Complete your profile to increase your chances of being seen by compatible singles.</p>
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ff1744;">
            <h3 style="color: #ff1744; margin-top: 0;">Get Started:</h3>
            <ul style="color: #666; line-height: 1.8;">
              <li>Complete your profile with more photos</li>
              <li>Add your interests and preferences</li>
              <li>Like profiles to start matching</li>
              <li>Message your matches</li>
            </ul>
          </div>
          <p style="color: #666;">Happy matching! 🎯</p>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

export const sendPremiumActivationEmail = async (email, tier, expiryDate) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: `🎉 Premium ${tier.toUpperCase()} Activated!`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff1744, #ff4081); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Premium Unlocked! ✨</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Congratulations! Your ${tier} premium membership is now active.</p>
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ff1744;">
            <h3 style="color: #ff1744; margin-top: 0;">Premium Features Unlocked:</h3>
            <ul style="color: #666; line-height: 1.8;">
              ${tier === "gold" ? "<li>✓ See who likes you</li><li>✓ Advanced filters</li><li>✓ Message anyone</li>" : ""}
              ${tier === "platinum" ? "<li>✓ See who likes you</li><li>✓ Advanced filters</li><li>✓ Message anyone</li><li>✓ Priority visibility</li><li>✓ Verified badge</li><li>✓ Instant messaging</li>" : ""}
            </ul>
          </div>
          <p style="color: #666;">Your premium membership expires on: <strong>${expiryDate}</strong></p>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};
