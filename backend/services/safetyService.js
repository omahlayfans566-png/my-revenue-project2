/**
 * Safety Service — Scam detection, spam filtering, content moderation
 */
import { User } from "../models/User.js";
import { Message } from "../models/Message.js";
import { Report } from "../models/Report.js";
import { createNotification } from "./notificationService.js";

// ─── Suspicious Activity Detection ─────────────────────────────────────────────

const SUSPICIOUS_PATTERNS = [
    /\b(cashapp|bitcoin|crypto|wire\s*transfer|western\s*union|money\s*gram)\b/i,
    /\b(urgent|emergency|please\s*help|send\s*money)\b/i,
    /\b(\d{4}\s*-\s*\d{4}\s*-\s*\d{4}\s*-\s*\d{4})\b/, // credit card numbers
    /\b(password|ssn|social\s*security|bank\s*account)\b/i,
];

const SPAM_PATTERNS = [
    /(https?:\/\/[^\s]+){3,}/, // 3+ links in a message
    /(@everyone|@here|@all)/i,
    /(buy\s*now|click\s*here|limited\s*offer|act\s*now)/i,
    /([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i, // email addresses
];

const OFFENSIVE_WORDS = [
    "fuck", "shit", "ass", "bitch", "damn", "bastard", "crap",
    "dick", "piss", "slut", "whore", "idiot", "stupid",
];

export const checkMessageForScam = (content) => {
    if (!content) return { isScam: false, reasons: [] };
    const reasons = [];
    for (const pattern of SUSPICIOUS_PATTERNS) {
        if (pattern.test(content)) {
            reasons.push(`Matched suspicious pattern: ${pattern}`);
        }
    }
    return { isScam: reasons.length > 0, reasons };
};

export const checkMessageForSpam = (content) => {
    if (!content) return { isSpam: false, reasons: [] };
    const reasons = [];
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(content)) {
            reasons.push(`Matched spam pattern: ${pattern}`);
        }
    }
    return { isSpam: reasons.length > 0, reasons };
};

export const checkMessageForOffensive = (content) => {
    if (!content) return { isOffensive: false, words: [] };
    const found = [];
    const lower = content.toLowerCase();
    for (const word of OFFENSIVE_WORDS) {
        if (lower.includes(word)) {
            found.push(word);
        }
    }
    return { isOffensive: found.length > 0, words: found };
};

export const moderateMessage = async (messageId) => {
    try {
        const message = await Message.findById(messageId);
        if (!message) return;

        const content = message.content || "";
        const scam = checkMessageForScam(content);
        const spam = checkMessageForSpam(content);
        const offensive = checkMessageForOffensive(content);

        if (scam.isScam || spam.isSpam || offensive.isOffensive) {
            // Flag the message
            message.isFlagged = true;
            message.flagReasons = [
                ...(scam.isScam ? ["scam"] : []),
                ...(spam.isSpam ? ["spam"] : []),
                ...(offensive.isOffensive ? ["offensive"] : []),
            ];
            await message.save();

            // Auto-report user if threshold reached
            const user = await User.findById(message.fromUserId);
            if (user) {
                user.reportCount = (user.reportCount || 0) + 1;
                if (user.reportCount >= 3) {
                    user.flaggedForReview = true;
                }
                await user.save();
            }

            // Notify admins
            const admins = await User.find({ role: { $in: ["admin", "super_admin"] } });
            for (const admin of admins) {
                await createNotification({
                    userId: admin._id,
                    type: "moderation",
                    title: "Message Flagged",
                    message: `Message ${messageId} flagged: ${message.flagReasons.join(", ")}`,
                    referenceId: message._id,
                    referenceModel: "Message",
                    icon: "🚩",
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.error("[Safety] Moderate message error:", e.message);
    }
};

// ─── Fake Profile Detection ────────────────────────────────────────────────────

export const checkForFakeProfile = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return { isFake: false, score: 0, reasons: [] };

    let score = 0;
    const reasons = [];

    // Check profile completeness
    if (!user.profilePicture) { score += 20; reasons.push("No profile picture"); }
    if (!user.aboutMe && !user.bio) { score += 15; reasons.push("No bio"); }
    if (!user.dateOfBirth) { score += 10; reasons.push("No date of birth"); }
    if (!user.interests || user.interests.length === 0) { score += 10; reasons.push("No interests"); }

    // Check account age
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    if (accountAge < 24 * 60 * 60 * 1000) { score += 10; reasons.push("Account less than 24 hours old"); }

    // Check for suspicious patterns in bio
    if (user.aboutMe) {
        const links = (user.aboutMe.match(/https?:\/\/[^\s]+/g) || []).length;
        if (links > 2) { score += 15; reasons.push("Too many links in bio"); }
    }

    // Check report count
    if (user.reportCount > 0) { score += user.reportCount * 10; reasons.push(`${user.reportCount} reports`); }

    const isFake = score >= 50;
    if (isFake) {
        user.flaggedForReview = true;
        await user.save();
    }

    return { isFake, score, reasons };
};

// ─── Duplicate Account Detection ───────────────────────────────────────────────

export const checkForDuplicateAccounts = async (userId) => {
    const user = await User.findById(userId);
    if (!user) return { hasDuplicates: false, duplicates: [] };

    // Check for accounts with same email domain, similar names, same IP
    const emailDomain = user.email?.split("@")[1];
    const firstName = user.firstName?.toLowerCase();
    const lastName = user.lastName?.toLowerCase();

    const potentialDuplicates = await User.find({
        _id: { $ne: userId },
        $or: [
            { email: { $regex: `@${emailDomain}$`, $options: "i" } },
            {
                firstName: { $regex: `^${firstName}$`, $options: "i" },
                lastName: { $regex: `^${lastName}$`, $options: "i" },
            },
        ],
        deletedAt: { $exists: false },
    }).select("firstName lastName email createdAt");

    return {
        hasDuplicates: potentialDuplicates.length > 0,
        duplicates: potentialDuplicates,
    };
};

// ─── Report Categories ─────────────────────────────────────────────────────────

export const REPORT_CATEGORIES = [
    { id: "fake_profile", label: "Fake Profile", description: "This profile is pretending to be someone else" },
    { id: "scam", label: "Scam or Fraud", description: "This user is trying to scam me" },
    { id: "harassment", label: "Harassment", description: "This user is harassing or bullying me" },
    { id: "inappropriate", label: "Inappropriate Content", description: "This user shared inappropriate content" },
    { id: "underage", label: "Underage User", description: "This user appears to be under 18" },
    { id: "spam", label: "Spam", description: "This user is sending spam messages" },
    { id: "offensive", label: "Offensive Language", description: "This user is using offensive language" },
    { id: "catfish", label: "Catfish", description: "This user is using fake photos" },
    { id: "other", label: "Other", description: "Something else" },
];

// ─── Safety Tips ───────────────────────────────────────────────────────────────

export const SAFETY_TIPS = [
    {
        title: "Keep Personal Info Private",
        content: "Never share your home address, financial information, or social security number with someone you just met online.",
        icon: "🔒",
    },
    {
        title: "Video Chat Before Meeting",
        content: "Always video chat with your match before meeting in person to verify they are who they say they are.",
        icon: "📹",
    },
    {
        title: "Meet in Public Places",
        content: "For your first few dates, always meet in a public, well-lit location. Tell a friend where you're going.",
        icon: "📍",
    },
    {
        title: "Trust Your Instincts",
        content: "If something feels off, it probably is. You can always block and report any user who makes you uncomfortable.",
        icon: "💡",
    },
    {
        title: "No Financial Transactions",
        content: "Never send money or financial information to someone you've only met online, no matter how convincing their story is.",
        icon: "💰",
    },
    {
        title: "Use In-App Messaging",
        content: "Keep conversations within the app until you're comfortable. This helps us monitor and protect you from scams.",
        icon: "💬",
    },
    {
        title: "Report Suspicious Behavior",
        content: "If someone asks for money, makes you uncomfortable, or breaks the rules, report them immediately.",
        icon: "🚩",
    },
    {
        title: "Verify Social Media",
        content: "Check their social media presence. A real person usually has a consistent online footprint across platforms.",
        icon: "📱",
    },
];