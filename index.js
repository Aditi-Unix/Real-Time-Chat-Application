import express from "express";
import http from "http";
import { Server } from "socket.io";
import mongoose from "mongoose";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

import User from "./models/User.js";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";

import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import conversationRoutes from "./routes/conversationRoutes.js";

import authMiddleware from "./middleware/authMiddleware.js";

dotenv.config();

const app = express();

// ======================================================
// MIDDLEWARE
// ======================================================

app.use(express.json());

// ======================================================
// API ROUTES
// ======================================================

app.use("/api/auth", authRoutes);

app.use("/api/users", userRoutes);

app.use("/api/conversations", conversationRoutes);

// ======================================================
// HOME ROUTE
// ======================================================

app.get("/", (req, res) => {
  res.send("Real Time Chat Server Running");
});

// ======================================================
// PROTECTED USER ROUTE
// ======================================================

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    res.status(200).json({
      message: "Authenticated user",

      user: req.user,
    });
  } catch (error) {
    console.log("ME ERROR:", error);

    res.status(500).json({
      message: "Error fetching user",

      error: error.message,
    });
  }
});

// ======================================================
// HTTP SERVER
// ======================================================

const server = http.createServer(app);

// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// ======================================================
// SOCKET JWT AUTHENTICATION
// ======================================================

io.use((socket, next) => {
  try {
    console.log("Checking socket authentication...");

    const token = socket.handshake.auth?.token;

    // No token
    if (!token) {
      console.log("Authentication token missing");

      return next(new Error("Authentication token required"));
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Store authenticated user
    socket.userId = decoded.userId;

    console.log("Socket authenticated user:", socket.userId);

    next();
  } catch (error) {
    console.log("SOCKET AUTH ERROR:", error.message);

    next(new Error("Invalid or expired token"));
  }
});

// ======================================================
// SOCKET CONNECTION
// ======================================================

io.on("connection", (socket) => {
  console.log("======================================");

  console.log("USER CONNECTED:", socket.id);

  console.log("AUTHENTICATED USER:", socket.userId);

  console.log("======================================");

  // ==================================================
  // DEBUG ALL SOCKET EVENTS
  // ==================================================

  socket.onAny((event, ...args) => {
    console.log("SOCKET EVENT RECEIVED:", event, args);
  });

  // ==================================================
  // JOIN CONVERSATION
  // ==================================================

  socket.on("joinConversation", async (conversationId, callback) => {
    console.log("======================================");

    console.log("JOIN REQUEST RECEIVED:", conversationId);

    console.log("JOIN USER:", socket.userId);

    console.log("======================================");

    try {
      // --------------------------------------
      // Check conversation ID
      // --------------------------------------

      if (!conversationId) {
        const result = {
          success: false,

          message: "Conversation ID required",
        };

        socket.emit("conversationError", result);

        if (callback) {
          callback(result);
        }

        return;
      }

      // --------------------------------------
      // Find conversation
      // --------------------------------------

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        console.log("Conversation not found");

        const result = {
          success: false,

          message: "Conversation not found",
        };

        socket.emit("conversationError", result);

        if (callback) {
          callback(result);
        }

        return;
      }

      console.log("Conversation found:", conversation._id.toString());

      // --------------------------------------
      // Check participant
      // --------------------------------------

      const isParticipant = conversation.participants.some((participantId) => {
        return participantId.toString() === socket.userId.toString();
      });

      console.log("Is participant:", isParticipant);

      if (!isParticipant) {
        console.log("USER IS NOT PARTICIPANT");

        const result = {
          success: false,

          message: "You are not a participant of this conversation",
        };

        socket.emit("conversationError", result);

        if (callback) {
          callback(result);
        }

        return;
      }

      // --------------------------------------
      // JOIN ROOM
      // --------------------------------------

      await socket.join(conversationId);

      console.log("ROOM JOINED:", conversationId);

      // --------------------------------------
      // ROOM MEMBERS
      // --------------------------------------

      const roomMembers = Array.from(
        io.sockets.adapter.rooms.get(conversationId) || [],
      );

      console.log("ROOM MEMBERS:", roomMembers);

      console.log("ROOM MEMBER COUNT:", roomMembers.length);

      // --------------------------------------
      // SUCCESS RESPONSE
      // --------------------------------------

      const result = {
        success: true,

        message: "Conversation joined successfully",

        conversationId: conversationId,
      };

      socket.emit("conversationJoined", {
        conversationId,
      });

      if (callback) {
        callback(result);
      }

      console.log("JOIN CONFIRMATION SENT");
    } catch (error) {
      console.log("JOIN CONVERSATION ERROR:", error);

      const result = {
        success: false,

        message: error.message,
      };

      socket.emit("conversationError", result);

      if (callback) {
        callback(result);
      }
    }
  });

  // ==================================================
  // TYPING START
  // ==================================================

  socket.on("typing", (conversationId) => {
    console.log("TYPING START:", conversationId);

    socket.to(conversationId).emit("userTyping", {
      userId: socket.userId,
    });
  });

  // ==================================================
  // TYPING STOP
  // ==================================================

  socket.on("stopTyping", (conversationId) => {
    console.log("TYPING STOP:", conversationId);

    socket.to(conversationId).emit("userStoppedTyping", {
      userId: socket.userId,
    });
  });

  // ==================================================
  // SEND MESSAGE
  // ==================================================

  socket.on("sendMessage", async (data) => {
    try {
      console.log("======================================");

      console.log("MESSAGE RECEIVED:", data);

      console.log("MESSAGE USER:", socket.userId);

      console.log("======================================");

      const conversationId = data.conversationId;

      const text = data.text;

      // --------------------------------------
      // Validate data
      // --------------------------------------

      if (!conversationId || !text || !text.trim()) {
        socket.emit("messageError", {
          message: "conversationId and text are required",
        });

        return;
      }

      // --------------------------------------
      // Find conversation
      // --------------------------------------

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        socket.emit("messageError", {
          message: "Conversation not found",
        });

        return;
      }

      // --------------------------------------
      // Check participant
      // --------------------------------------

      const isParticipant = conversation.participants.some((participantId) => {
        return participantId.toString() === socket.userId.toString();
      });

      if (!isParticipant) {
        socket.emit("messageError", {
          message: "You are not a participant of this conversation",
        });

        return;
      }

      // --------------------------------------
      // Create message
      // --------------------------------------

      const newMessage = await Message.create({
        conversation: conversationId,

        sender: socket.userId,

        text: text.trim(),
      });

      console.log("MESSAGE SAVED:", newMessage);

      // --------------------------------------
      // Update last message
      // --------------------------------------

      await Conversation.findByIdAndUpdate(
        conversationId,

        {
          lastMessage: newMessage._id,
        },
      );

      // --------------------------------------
      // Send message to room
      // --------------------------------------

      io.to(conversationId).emit("receiveMessage", newMessage);

      console.log("MESSAGE SENT TO ROOM:", conversationId);
    } catch (error) {
      console.log("MESSAGE ERROR:", error);

      socket.emit("messageError", {
        message: error.message,
      });
    }
  });

  // ==================================================
  // MESSAGE DELIVERED
  // ==================================================

  socket.on("messageDelivered", async (messageId) => {
    try {
      console.log("DELIVERED REQUEST:", messageId);

      const message = await Message.findByIdAndUpdate(
        messageId,

        {
          status: "delivered",
        },

        {
          new: true,
        },
      );

      if (!message) {
        console.log("Message not found");

        return;
      }

      console.log("MESSAGE DELIVERED:", message._id.toString());

      io.to(message.conversation.toString()).emit(
        "messageStatusUpdated",
        message,
      );
    } catch (error) {
      console.log("DELIVERED ERROR:", error);
    }
  });

  // ==================================================
  // MESSAGE SEEN
  // ==================================================

  socket.on("messageSeen", async (messageId) => {
    try {
      console.log("SEEN REQUEST:", messageId);

      const message = await Message.findByIdAndUpdate(
        messageId,

        {
          status: "seen",
        },

        {
          new: true,
        },
      );

      if (!message) {
        console.log("Message not found");

        return;
      }

      console.log("MESSAGE SEEN:", message._id.toString());

      socket.to(conversationId).emit("receiveMessage", newMessage);
    } catch (error) {
      console.log("SEEN ERROR:", error);
    }
  });

  // ==================================================
  // DISCONNECT
  // ==================================================

  socket.on("disconnect", async (reason) => {
    console.log("======================================");

    console.log("USER DISCONNECTED:", socket.id);

    console.log("REASON:", reason);

    console.log("======================================");

    try {
      const user = await User.findByIdAndUpdate(
        socket.userId,

        {
          isOnline: false,

          lastSeen: new Date(),
        },

        {
          new: true,
        },
      );

      if (user) {
        io.emit("userStatusChanged", {
          userId: user._id.toString(),

          isOnline: false,

          lastSeen: user.lastSeen,
        });
      }
    } catch (error) {
      console.log("OFFLINE STATUS ERROR:", error);
    }
  });

  // ==================================================
  // USER ONLINE
  // IMPORTANT:
  // THIS IS LAST SO THAT ALL SOCKET LISTENERS
  // ARE REGISTERED BEFORE ASYNC WORK STARTS
  // ==================================================

  User.findByIdAndUpdate(
    socket.userId,

    {
      isOnline: true,
    },

    {
      new: true,
    },
  )
    .then((user) => {
      if (user) {
        console.log("User is ONLINE:", user._id.toString());

        io.emit("userStatusChanged", {
          userId: user._id.toString(),

          isOnline: true,

          lastSeen: user.lastSeen,
        });
      }
    })
    .catch((error) => {
      console.log("ONLINE STATUS ERROR:", error);
    });
});

// ======================================================
// MONGODB CONNECTION
// ======================================================

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected Successfully");
  })
  .catch((error) => {
    console.log("MongoDB Error:", error);
  });

// ======================================================
// START SERVER
// ======================================================

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
