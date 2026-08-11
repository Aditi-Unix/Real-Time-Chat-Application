import Conversation from "../models/Conversation.js";
import User from "../models/User.js";

export const createConversation = async (req, res) => {
    try {
        const { receiverId } = req.body;

        // Check receiver ID
        if (!receiverId) {
            return res.status(400).json({
                message: "Receiver ID is required"
            });
        }

        // Check receiver exists
        const receiver = await User.findById(receiverId);

        if (!receiver) {
            return res.status(404).json({
                message: "Receiver not found"
            });
        }

        // Prevent chatting with yourself
        if (req.user._id.toString() === receiverId) {
            return res.status(400).json({
                message: "You cannot create a conversation with yourself"
            });
        }

        // Check existing conversation
        const existingConversation = await Conversation.findOne({
            participants: {
                $all: [req.user._id, receiverId]
            }
        });

        if (existingConversation) {
            return res.status(200).json({
                message: "Conversation already exists",
                conversation: existingConversation
            });
        }

        // Create new conversation
        const conversation = await Conversation.create({
            participants: [
                req.user._id,
                receiverId
            ]
        });

        res.status(201).json({
            message: "Conversation created successfully",
            conversation
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
};
export const getMyConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id
        })
            .populate("participants", "name email profileImage")
            .populate("lastMessage");

        res.status(200).json({
            message: "Conversations fetched successfully",
            conversations
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: "Server error"
        });
    }
};