/**
 * Story Service — Story management with 24-hour expiry
 */
import { Story } from "../models/Story.js";
import { User } from "../models/User.js";
import { createNotification } from "./notificationService.js";

// ─── Create Story ──────────────────────────────────────────────────────────────

export const createStory = async (userId, storyData) => {
    const { mediaUrl, mediaType, caption, backgroundColor, textColor } = storyData;

    if (!mediaUrl) throw new Error("Media URL is required");

    const story = new Story({
        userId,
        mediaUrl,
        mediaType: mediaType || "image",
        caption: caption || "",
        backgroundColor: backgroundColor || "#000000",
        textColor: textColor || "#ffffff",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    await story.save();

    // Notify followers/matches about new story
    try {
        const user = await User.findById(userId).select("firstName lastName");
        const matches = await (await import("../models/Match.js")).Match.find({
            $or: [
                { userId, status: "matched" },
                { matchedUserId: userId, status: "matched" },
            ],
        });

        const notifiedUsers = new Set();
        for (const match of matches) {
            const otherUserId = match.userId.toString() === userId
                ? match.matchedUserId.toString()
                : match.userId.toString();

            if (!notifiedUsers.has(otherUserId)) {
                notifiedUsers.add(otherUserId);
                await createNotification({
                    userId: otherUserId,
                    type: "story",
                    title: "New Story",
                    message: `${user?.firstName || "Someone"} posted a new story`,
                    referenceId: story._id,
                    referenceModel: "Story",
                    metadata: { userId, mediaType },
                }).catch(() => {});
            }
        }
    } catch (e) { /* silent */ }

    return story;
};

// ─── Get Stories ───────────────────────────────────────────────────────────────

export const getActiveStories = async (userId) => {
    // Get stories from matched users and own stories
    const { Match } = await import("../models/Match.js");
    const matches = await Match.find({
        $or: [
            { userId, status: "matched" },
            { matchedUserId: userId, status: "matched" },
        ],
    });

    const matchedUserIds = matches.map(m =>
        m.userId.toString() === userId ? m.matchedUserId.toString() : m.userId.toString()
    );

    // Include own stories
    matchedUserIds.push(userId);

    const stories = await Story.find({
        userId: { $in: matchedUserIds },
        isActive: true,
        expiresAt: { $gt: new Date() },
    })
        .populate("userId", "firstName lastName profilePicture")
        .sort({ createdAt: -1 });

    // Group by user
    const grouped = {};
    for (const story of stories) {
        const uid = story.userId._id.toString();
        if (!grouped[uid]) {
            grouped[uid] = {
                user: story.userId,
                stories: [],
            };
        }
        grouped[uid].stories.push(story);
    }

    return Object.values(grouped);
};

export const getUserStories = async (targetUserId) => {
    return Story.find({
        userId: targetUserId,
        isActive: true,
        expiresAt: { $gt: new Date() },
    })
        .populate("userId", "firstName lastName profilePicture")
        .sort({ createdAt: -1 });
};

// ─── Story Interactions ────────────────────────────────────────────────────────

export const viewStory = async (storyId, userId) => {
    const story = await Story.findById(storyId);
    if (!story) throw new Error("Story not found");

    // Check if already viewed
    const alreadyViewed = story.viewers?.some(v => v.userId.toString() === userId);
    if (!alreadyViewed) {
        story.viewers = story.viewers || [];
        story.viewers.push({ userId, viewedAt: new Date() });
        await story.save();
    }

    return story;
};

export const reactToStory = async (storyId, userId, reaction) => {
    const story = await Story.findById(storyId);
    if (!story) throw new Error("Story not found");

    // Store reaction in viewers array
    story.viewers = story.viewers || [];
    const existingViewer = story.viewers.find(v => v.userId.toString() === userId);
    if (existingViewer) {
        existingViewer.reaction = reaction;
    } else {
        story.viewers.push({ userId, viewedAt: new Date(), reaction });
    }
    await story.save();

    // Notify story owner
    if (story.userId.toString() !== userId) {
        const user = await User.findById(userId).select("firstName");
        await createNotification({
            userId: story.userId,
            type: "story_reaction",
            title: "Story Reaction",
            message: `${user?.firstName || "Someone"} reacted ${reaction} to your story`,
            referenceId: story._id,
            referenceModel: "Story",
            metadata: { userId, reaction },
        }).catch(() => {});
    }

    return story;
};

export const replyToStory = async (storyId, userId, message) => {
    const story = await Story.findById(storyId);
    if (!story) throw new Error("Story not found");

    // Store reply
    story.replies = story.replies || [];
    story.replies.push({ userId, message, repliedAt: new Date() });
    await story.save();

    // Notify story owner
    if (story.userId.toString() !== userId) {
        const user = await User.findById(userId).select("firstName");
        await createNotification({
            userId: story.userId,
            type: "story_reply",
            title: "Story Reply",
            message: `${user?.firstName || "Someone"} replied to your story: "${message}"`,
            referenceId: story._id,
            referenceModel: "Story",
            metadata: { userId, message },
        }).catch(() => {});
    }

    return story;
};

// ─── Delete Story ──────────────────────────────────────────────────────────────

export const deleteStory = async (storyId, userId) => {
    const story = await Story.findOne({ _id: storyId, userId });
    if (!story) throw new Error("Story not found");

    story.isActive = false;
    await story.save();
    return { deleted: true };
};

// ─── Archive ────────────────────────────────────────────────────────────────────

export const getArchivedStories = async (userId) => {
    return Story.find({
        userId,
        isActive: false,
    })
        .sort({ createdAt: -1 })
        .limit(50);
};

export const archiveStory = async (storyId, userId) => {
    const story = await Story.findOne({ _id: storyId, userId });
    if (!story) throw new Error("Story not found");

    story.isActive = false;
    await story.save();
    return story;
};