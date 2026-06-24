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
        content: { type: String, required: true },
        image: String,
        isRead: { type: Boolean, default: false },
        readAt: Date,
        isDeleted: { type: Boolean, default: false },
        reaction: String, // emoji reaction
    },
    { timestamps: true }
);

export const Message = mongoose.model("Message", messageSchema);
