import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
    {
        fromUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        toUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        content: { type: String, default: "" },
        image: String,
        messageType: {
            type: String,
            enum: ["text", "image", "gif"],
            default: "text",
        },
        isRead: { type: Boolean, default: false },
        readAt: Date,
        isDelivered: { type: Boolean, default: false },
        deliveredAt: Date,
        isDeleted: { type: Boolean, default: false },
        deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        editedAt: Date,
        reaction: String,
        reactions: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, emoji: String }],
        reactionCount: { type: Number, default: 0 },
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
        },
        replyContent: String,
        replyFrom: String,
        isFlagged: { type: Boolean, default: false },
        flagReasons: [String],
        flaggedAt: Date,
        fileUrl: String,
        fileName: String,
        fileSize: Number,
        gifUrl: String,
        isForwarded: { type: Boolean, default: false },
        forwardedFrom: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    },
    { timestamps: true }
);

// Indexes for fast queries
messageSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });
messageSchema.index({ toUserId: 1, isRead: 1, isDeleted: 1 });
messageSchema.index({ toUserId: 1, isDelivered: 1 });

export const Message = mongoose.model("Message", messageSchema);