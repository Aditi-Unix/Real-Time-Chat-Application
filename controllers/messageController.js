import Message from "../models/Message.js";
import Conversation from "../models/Conversation.js";

export const sendMessage = async (req, res) => {
    try {
        const { conversationId, text } = req.body;

        console.log("================================");
        console.log("Conversation ID:", conversationId);
        console.log("Message:", text);
        console.log("User ID:", req.user._id);
        console.log("================================");

        // Check request data
        if (!conversationId || !text) {
            return res.status(400).json({
                message: "Conversation ID and message text are required"
            });
        }

        // Find conversation
        const conversation = await Conversation.findById(conversationId);

        console.log("FOUND CONVERSATION:", conversation);

        if (!conversation) {
            return res.status(404).json({
                message: "Conversation not found"
            });
        }

        // Check user is participant
        const isParticipant = conversation.participants.some(
            (participant) =>
                participant.toString() === req.user._id.toString()
        );

        if (!isParticipant) {
            return res.status(403).json({
                message: "You are not a participant of this conversation"
            });
        }

        // Create message
        const message = await Message.create({
            conversation: conversationId,
            sender: req.user._id,
            text: text
        });

        // Update last message
        conversation.lastMessage = message._id;

        await conversation.save();

        res.status(201).json({
            message: "Message sent successfully",
            data: message
        });

    } catch (error) {
        console.error("SEND MESSAGE ERROR:", error);

        res.status(500).json({
            message: "Server error"
        });
    }
};