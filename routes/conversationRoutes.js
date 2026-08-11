import express from "express";
import Conversation from "../models/Conversation.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import authMiddleware from "../middleware/authMiddleware.js";

const router = express.Router();


// ==========================================
// CREATE / GET CONVERSATION
// POST /api/conversations
// ==========================================

router.post(
    "/",
    authMiddleware,
    async (req, res) => {

        try {

            const currentUserId =
                req.user._id;

            const { userId } =
                req.body;


            if (!userId) {

                return res.status(400).json({
                    message:
                        "userId is required"
                });

            }


            if (
                currentUserId.toString() ===
                userId.toString()
            ) {

                return res.status(400).json({
                    message:
                        "You cannot create a conversation with yourself"
                });

            }


            const targetUser =
                await User.findById(userId);


            if (!targetUser) {

                return res.status(404).json({
                    message:
                        "User not found"
                });

            }


            let conversation =
                await Conversation.findOne({

                    participants: {
                        $all: [
                            currentUserId,
                            userId
                        ]
                    }

                });


            if (conversation) {

                await conversation.populate(
                    "participants",
                    "name email profileImage"
                );

                return res.status(200).json({

                    message:
                        "Conversation already exists",

                    conversation

                });

            }


            conversation =
                await Conversation.create({

                    participants: [
                        currentUserId,
                        userId
                    ]

                });


            await conversation.populate(
                "participants",
                "name email profileImage"
            );


            res.status(201).json({

                message:
                    "Conversation created successfully",

                conversation

            });

        } catch (error) {

            console.log(
                "CREATE CONVERSATION ERROR:",
                error
            );


            res.status(500).json({

                message:
                    "Error creating conversation",

                error:
                    error.message

            });

        }

    }
);


// ==========================================
// GET MY CONVERSATIONS
// GET /api/conversations
// ==========================================

router.get(
    "/",
    authMiddleware,
    async (req, res) => {

        try {

            const conversations =
                await Conversation.find({

                    participants:
                        req.user._id

                })
                .populate(
                    "participants",
                    "name email profileImage isOnline lastSeen"
                )
                .populate(
                    "lastMessage"
                )
                .sort({
                    updatedAt: -1
                });


            res.status(200).json({

                message:
                    "Conversations fetched successfully",

                count:
                    conversations.length,

                conversations

            });

        } catch (error) {

            console.log(
                "FETCH CONVERSATIONS ERROR:",
                error
            );


            res.status(500).json({

                message:
                    "Error fetching conversations",

                error:
                    error.message

            });

        }

    }
);


// ==========================================
// GET CHAT HISTORY
// GET /api/conversations/:conversationId/messages
// ==========================================

router.get(
    "/:conversationId/messages",
    authMiddleware,
    async (req, res) => {

        try {

            const {
                conversationId
            } = req.params;


            const conversation =
                await Conversation.findById(
                    conversationId
                );


            if (!conversation) {

                return res.status(404).json({

                    message:
                        "Conversation not found"

                });

            }


            const isParticipant =
                conversation.participants.some(
                    (participantId) =>
                        participantId.toString() ===
                        req.user._id.toString()
                );


            if (!isParticipant) {

                return res.status(403).json({

                    message:
                        "You are not a participant of this conversation"

                });

            }


            const messages =
                await Message.find({

                    conversation:
                        conversationId

                })
                .populate(
                    "sender",
                    "name email profileImage"
                )
                .sort({
                    createdAt: 1
                });


            res.status(200).json({

                message:
                    "Messages fetched successfully",

                count:
                    messages.length,

                messages

            });

        } catch (error) {

            console.log(
                "FETCH MESSAGES ERROR:",
                error
            );


            res.status(500).json({

                message:
                    "Error fetching messages",

                error:
                    error.message

            });

        }

    }
);


export default router;