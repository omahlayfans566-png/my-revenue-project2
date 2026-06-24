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

export const sendVerificationEmail = async (email, verificationToken) => {
    const verificationLink = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

    const mailOptions = {
        from: process.env.GMAIL_USER,
        to: email,
        subject: "Verify Your DateClone Account",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff1744, #ff4081); padding: 20px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0;">Welcome to DateClone 💕</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9; border-radius: 0 0 10px 10px;">
          <p style="color: #333; font-size: 16px;">Hi there!</p>
          <p style="color: #666; line-height: 1.6;">Thank you for creating your DateClone account. To complete your registration and start finding meaningful connections, please verify your email address by clicking the button below.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="background: linear-gradient(135deg, #ff1744, #ff4081); color: white; padding: 12px 30px; border-radius: 25px; text-decoration: none; font-weight: bold; display: inline-block;">Verify Email Address</a>
          </div>
          <p style="color: #999; font-size: 12px;">This link will expire in 24 hours.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">If you didn't create this account, please ignore this email.</p>
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
