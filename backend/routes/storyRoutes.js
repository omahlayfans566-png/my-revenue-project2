import express from "express";
import mongoose from "mongoose";
import { Story } from "../models/Story.js";
import { authenticateToken } from "../middleware/auth.js";
import {
    createStory,
    getActiveStories,
    getUserStories,
    viewStory,
    reactToStory,
    replyToStory,
    deleteStory,
    getArchivedStories,
    archiveStory,
} from "../services/storyService.js";

const router = express.Router();
router.use(authenticateToken);

// GET /stories — get all active stories from matched users
router.get("/", async (req, res) => {
    try {
        const stories = await getActiveStories(req.user.userId);
        res.json({ success: true, stories });
    } catch (error) {
        console.error("[Stories List]", error);
        res.status(500).json({ success: false, message: "Failed to fetch stories" });
    }
});

// GET /stories/my — get own active stories
router.get("/my", async (req, res) => {
    try {
        const stories = await getUserStories(req.user.userId);
        res.json({ success: true, stories });
    } catch (error) {
        console.error("[Stories My]", error);
        res.status(500).json({ success: false, message: "Failed to fetch stories" });
    }
});

// GET /stories/user/:userId — get stories for a specific user
router.get("/user/:userId", async (req, res) => {
    try {
        const { userId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ success: false, message: "Invalid user ID" });
        }
        const stories = await getUserStories(userId);
        res.json({ success: true, stories });
    } catch (error) {
        console.error("[Stories User]", error);
        res.status(500).json({ success: false, message: "Failed to fetch stories" });
    }
});

// POST /stories/create — create a new story
router.post("/create", async (req, res) => {
    try {
        const { mediaUrl, mediaType, caption, backgroundColor, textColor } = req.body;
        if (!mediaUrl) {
            return res.status(400).json({ success: false, message: "Media URL is required" });
        }
        const story = await createStory(req.user.userId, {
            mediaUrl,
            mediaType,
            caption,
            backgroundColor,
            textColor,
        });

        // Emit socket event
        if (global.io) {
            global.io.emit("new_story", {
                userId: req.user.userId,
                storyId: story._id,
                mediaType: story.mediaType,
            });
        }

        res.status(201).json({ success: true, message: "Story created", story });
    } catch (error) {
        console.error("[Stories Create]", error);
        res.status(500).json({ success: false, message: error.message || "Failed to create story" });
    }
});

// POST /stories/:storyId/view — view a story
router.post("/:storyId/view", async (req, res) => {
    try {
        const { storyId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(storyId)) {
            return res.status(400).json({ success: false, message: "Invalid story ID" });
        }
        const story = await viewStory(storyId, req.user.userId);

        if (global.io) {
            global.io.to(`user:${story.userId}`).emit("story_viewed", {
                storyId: story._id,
                userId: req.user.userId,
            });
        }

        res.json({ success: true, story });
    } catch (error) {
        console.error("[Stories View]", error);
        res.status(error.message === "Story not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to view story" });
    }
});

// POST /stories/:storyId/react — react to a story
router.post("/:storyId/react", async (req, res) => {
    try {
        const { storyId } = req.params;
        const { reaction } = req.body;
        if (!mongoose.Types.ObjectId.isValid(storyId)) {
            return res.status(400).json({ success: false, message: "Invalid story ID" });
        }
        if (!reaction) {
            return res.status(400).json({ success: false, message: "Reaction is required" });
        }
        const story = await reactToStory(storyId, req.user.userId, reaction);

        if (global.io) {
            global.io.to(`user:${story.userId}`).emit("story_reaction", {
                storyId: story._id,
                userId: req.user.userId,
                reaction,
            });
        }

        res.json({ success: true, story });
    } catch (error) {
        console.error("[Stories React]", error);
        res.status(error.message === "Story not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to react to story" });
    }
});

// POST /stories/:storyId/reply — reply to a story
router.post("/:storyId/reply", async (req, res) => {
    try {
        const { storyId } = req.params;
        const { message } = req.body;
        if (!mongoose.Types.ObjectId.isValid(storyId)) {
            return res.status(400).json({ success: false, message: "Invalid story ID" });
        }
        if (!message) {
            return res.status(400).json({ success: false, message: "Reply message is required" });
        }
        const story = await replyToStory(storyId, req.user.userId, message);

        if (global.io) {
            global.io.to(`user:${story.userId}`).emit("story_reply", {
                storyId: story._id,
                userId: req.user.userId,
                message,
            });
        }

        res.json({ success: true, story });
    } catch (error) {
        console.error("[Stories Reply]", error);
        res.status(error.message === "Story not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to reply to story" });
    }
});

// DELETE /stories/:storyId — delete a story
router.delete("/:storyId", async (req, res) => {
    try {
        const { storyId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(storyId)) {
            return res.status(400).json({ success: false, message: "Invalid story ID" });
        }
        const result = await deleteStory(storyId, req.user.userId);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error("[Stories Delete]", error);
        res.status(error.message === "Story not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to delete story" });
    }
});

// GET /stories/archived — get archived stories
router.get("/archived", async (req, res) => {
    try {
        const stories = await getArchivedStories(req.user.userId);
        res.json({ success: true, stories });
    } catch (error) {
        console.error("[Stories Archived]", error);
        res.status(500).json({ success: false, message: "Failed to fetch archived stories" });
    }
});

// POST /stories/:storyId/archive — archive a story
router.post("/:storyId/archive", async (req, res) => {
    try {
        const { storyId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(storyId)) {
            return res.status(400).json({ success: false, message: "Invalid story ID" });
        }
        const story = await archiveStory(storyId, req.user.userId);
        res.json({ success: true, message: "Story archived", story });
    } catch (error) {
        console.error("[Stories Archive]", error);
        res.status(error.message === "Story not found" ? 404 : 500)
            .json({ success: false, message: error.message || "Failed to archive story" });
    }
});

export default router;