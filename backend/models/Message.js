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
            enum: ["text", "image", "gif", "voice"],
            default: "text",
        },
        isRead: { type: Boolean, default: false },
        readAt: Date,
        isDelivered: { type: Boolean, default: false },
        deliveredAt: Date,
        isDeleted: { type: Boolean, default: false },
        deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        reaction: String, // emoji reaction
        replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
        },
        replyContent: String, // cached content of replied message
        replyFrom: String, // name of replied message sender
    },
    { timestamps: true }
);

// Indexes for fast queries
messageSchema.index({ fromUserId: 1, toUserId: 1, createdAt: -1 });
messageSchema.index({ toUserId: 1, isRead: 1, isDeleted: 1 });
messageSchema.index({ toUserId: 1, isDelivered: 1 });

export const Message = mongoose.model("Message", messageSchema);