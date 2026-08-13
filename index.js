import express from "express";
import cors from "cors";
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

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://localhost:5175",
    ],
  }),
);

app.use(express.json());

// ======================================================
// API ROUTES
// ======================================================

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use(
  "/api/conversations",
  conversationRoutes,
);

// ======================================================
// HOME
// ======================================================

app.get("/", (req, res) => {
  res.send("Real Time Chat Server Running");
});

// ======================================================
// PROTECTED USER ROUTE
// ======================================================

app.get(
  "/api/auth/me",
  authMiddleware,
  async (req, res) => {
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
  },
);

// ======================================================
// HTTP SERVER
// ======================================================

const server = http.createServer(app);

// ======================================================
// SOCKET.IO
// ======================================================

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5175",
    ],
    methods: ["GET", "POST"],
  },
});

// ======================================================
// MULTIPLE TAB / DEVICE TRACKING
// ======================================================

const userSocketCounts = new Map();

// ======================================================
// SOCKET JWT AUTH
// ======================================================

io.use((socket, next) => {
  try {
    console.log(
      "Checking socket authentication...",
    );

    const token =
      socket.handshake.auth?.token;

    if (!token) {
      return next(
        new Error(
          "Authentication token required",
        ),
      );
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
    );

    socket.userId = decoded.userId;

    console.log(
      "Socket authenticated user:",
      socket.userId,
    );

    next();
  } catch (error) {
    console.log(
      "SOCKET AUTH ERROR:",
      error.message,
    );

    next(
      new Error(
        "Invalid or expired token",
      ),
    );
  }
});

// ======================================================
// SOCKET CONNECTION
// ======================================================

io.on("connection", (socket) => {
  console.log(
    "======================================",
  );

  const userIdString =
    socket.userId.toString();

  // ==================================================
  // PERSONAL USER ROOM
  // ==================================================

  socket.join(userIdString);

  console.log(
    "USER CONNECTED:",
    socket.id,
  );

  console.log(
    "AUTHENTICATED USER:",
    socket.userId,
  );

  console.log(
    "======================================",
  );

  // ==================================================
  // MULTIPLE TAB COUNT
  // ==================================================

  const currentSocketCount =
    userSocketCounts.get(
      userIdString,
    ) || 0;

  userSocketCounts.set(
    userIdString,
    currentSocketCount + 1,
  );

  // ==================================================
  // DEBUG
  // ==================================================

  socket.onAny(
    (event, ...args) => {
      console.log(
        "SOCKET EVENT:",
        event,
        args,
      );
    },
  );

  // ==================================================
  // USER ONLINE
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
      if (!user) return;

      io.emit(
        "userStatusChanged",
        {
          userId:
            user._id.toString(),

          isOnline: true,

          lastSeen:
            user.lastSeen,
        },
      );
    })
    .catch((error) => {
      console.log(
        "ONLINE STATUS ERROR:",
        error,
      );
    });

  // ==================================================
  // JOIN CONVERSATION
  // ==================================================

  socket.on(
    "joinConversation",
    async (
      conversationId,
      callback,
    ) => {
      try {
        console.log(
          "JOIN REQUEST:",
          conversationId,
        );

        if (!conversationId) {
          const result = {
            success: false,
            message:
              "Conversation ID required",
          };

          socket.emit(
            "conversationError",
            result,
          );

          callback?.(result);

          return;
        }

        const conversation =
          await Conversation.findById(
            conversationId,
          );

        if (!conversation) {
          const result = {
            success: false,
            message:
              "Conversation not found",
          };

          socket.emit(
            "conversationError",
            result,
          );

          callback?.(result);

          return;
        }

        // ==================================================
        // PARTICIPANT CHECK
        // ==================================================

        const isParticipant =
          conversation.participants.some(
            (participantId) =>
              participantId.toString() ===
              socket.userId.toString(),
          );

        if (!isParticipant) {
          const result = {
            success: false,
            message:
              "You are not a participant of this conversation",
          };

          socket.emit(
            "conversationError",
            result,
          );

          callback?.(result);

          return;
        }

        // ==================================================
        // JOIN ROOM
        // ==================================================

        const roomId =
          conversationId.toString();

        await socket.join(roomId);

        console.log(
          "ROOM JOINED:",
          roomId,
        );

        console.log(
          "ROOM MEMBERS:",
          Array.from(
            io.sockets.adapter.rooms.get(
              roomId,
            ) || [],
          ),
        );

        const result = {
          success: true,
          message:
            "Conversation joined successfully",
          conversationId: roomId,
        };

        socket.emit(
          "conversationJoined",
          {
            conversationId:
              roomId,
          },
        );

        callback?.(result);
      } catch (error) {
        console.log(
          "JOIN CONVERSATION ERROR:",
          error,
        );

        const result = {
          success: false,
          message:
            error.message,
        };

        socket.emit(
          "conversationError",
          result,
        );

        callback?.(result);
      }
    },
  );

  // ==================================================
  // TYPING START
  // ==================================================

  socket.on(
    "typing",
    async (conversationId) => {
      try {
        console.log(
          "⌨️ TYPING:",
          socket.userId.toString(),
          conversationId,
        );

        if (!conversationId) {
          return;
        }

        const conversation =
          await Conversation.findById(
            conversationId,
          );

        if (!conversation) {
          return;
        }

        const isParticipant =
          conversation.participants.some(
            (participantId) =>
              participantId.toString() ===
              socket.userId.toString(),
          );

        if (!isParticipant) {
          return;
        }

        const roomId =
          conversationId.toString();

        // Send typing to other participant
        for (const participantId of
          conversation.participants) {

          const participantIdString =
            participantId.toString();

          if (
            participantIdString ===
            socket.userId.toString()
          ) {
            continue;
          }

          io.to(participantIdString).emit(
            "userTyping",
            {
              userId:
                socket.userId.toString(),

              conversationId:
                roomId,
            },
          );
        }

        console.log(
          "✅ TYPING SENT TO ROOM:",
          roomId,
        );
      } catch (error) {
        console.log(
          "TYPING ERROR:",
          error,
        );
      }
    },
  );

  // ==================================================
  // TYPING STOP
  // ==================================================

  socket.on(
    "stopTyping",
    async (conversationId) => {
      try {
        console.log(
          "🛑 STOP TYPING:",
          socket.userId.toString(),
          conversationId,
        );

        if (!conversationId) {
          return;
        }

        const conversation =
          await Conversation.findById(
            conversationId,
          );

        if (!conversation) {
          return;
        }

        const isParticipant =
          conversation.participants.some(
            (participantId) =>
              participantId.toString() ===
              socket.userId.toString(),
          );

        if (!isParticipant) {
          return;
        }

        const roomId =
          conversationId.toString();

        // Send stop typing to other participant
        for (const participantId of
          conversation.participants) {

          const participantIdString =
            participantId.toString();

          if (
            participantIdString ===
            socket.userId.toString()
          ) {
            continue;
          }

          io.to(participantIdString).emit(
            "userStoppedTyping",
            {
              userId:
                socket.userId.toString(),

              conversationId:
                roomId,
            },
          );
        }
      } catch (error) {
        console.log(
          "STOP TYPING ERROR:",
          error,
        );
      }
    },
  );

  // ==================================================
  // SEND MESSAGE
  // ==================================================

  socket.on(
    "sendMessage",
    async (data) => {
      try {
        console.log(
          "MESSAGE RECEIVED:",
          data,
        );

        const conversationId =
          data?.conversationId;

        const text =
          data?.text;

        if (
          !conversationId ||
          !text ||
          !text.trim()
        ) {
          socket.emit(
            "messageError",
            {
              message:
                "conversationId and text are required",
            },
          );

          return;
        }

        // ==================================================
        // FIND CONVERSATION
        // ==================================================

        const conversation =
          await Conversation.findById(
            conversationId,
          );

        if (!conversation) {
          socket.emit(
            "messageError",
            {
              message:
                "Conversation not found",
            },
          );

          return;
        }

        // ==================================================
        // PARTICIPANT CHECK
        // ==================================================

        const isParticipant =
          conversation.participants.some(
            (participantId) =>
              participantId.toString() ===
              socket.userId.toString(),
          );

        if (!isParticipant) {
          socket.emit(
            "messageError",
            {
              message:
                "You are not a participant of this conversation",
            },
          );

          return;
        }

        // ==================================================
        // CREATE MESSAGE
        // ==================================================

        const newMessage =
          await Message.create({
            conversation:
              conversationId,

            sender:
              socket.userId,

            text:
              text.trim(),

            status: "sent",
          });

        // ==================================================
        // UPDATE CONVERSATION
        // ==================================================

        await Conversation.findByIdAndUpdate(
          conversationId,
          {
            lastMessage:
              newMessage._id,
          },
        );

        // ==================================================
        // POPULATE MESSAGE
        // ==================================================

        const populatedMessage =
          await Message.findById(
            newMessage._id,
          )
            .populate(
              "sender",
              "name email profileImage",
            )
            .populate(
              "conversation",
            );

        if (!populatedMessage) {
          socket.emit(
            "messageError",
            {
              message:
                "Message could not be loaded",
            },
          );

          return;
        }

        // ==================================================
        // SEND ONLY TO CONVERSATION PARTICIPANTS
        // ==================================================

        for (const participantId of
          conversation.participants) {

          const participantSockets =
            await io
              .in(
                participantId.toString(),
              )
              .fetchSockets();

          participantSockets.forEach(
            (participantSocket) => {
              participantSocket.emit(
                "receiveMessage",
                populatedMessage,
              );
            },
          );
        }

        // ==================================================
        // RECIPIENT ONLINE CHECK
        // ==================================================

        let recipientIsOnline =
          false;

        for (const participantId of
          conversation.participants) {

          const participantIdString =
            participantId.toString();

          if (
            participantIdString ===
            socket.userId.toString()
          ) {
            continue;
          }

          const recipientSockets =
            await io
              .in(
                participantIdString,
              )
              .fetchSockets();

          if (
            recipientSockets.length > 0
          ) {
            recipientIsOnline =
              true;
          }
        }

        // ==================================================
        // AUTOMATIC DELIVERED
        // ==================================================

        if (recipientIsOnline) {
          const deliveredMessage =
            await Message.findByIdAndUpdate(
              newMessage._id,
              {
                status:
                  "delivered",
              },
              {
                new: true,
              },
            );

          // Sender ke all tabs ko status
          const senderSockets =
            await io
              .in(
                socket.userId.toString(),
              )
              .fetchSockets();

          senderSockets.forEach(
            (senderSocket) => {
              senderSocket.emit(
                "messageStatusUpdated",
                deliveredMessage,
              );
            },
          );
        }

        console.log(
          "MESSAGE SENT:",
          newMessage._id.toString(),
        );
      } catch (error) {
        console.log(
          "MESSAGE ERROR:",
          error,
        );

        socket.emit(
          "messageError",
          {
            message:
              error.message,
          },
        );
      }
    },
  );

  // ==================================================
  // MESSAGE DELIVERED
  // ==================================================

  socket.on(
    "messageDelivered",
    async (messageId) => {
      try {
        const message =
          await Message.findByIdAndUpdate(
            messageId,
            {
              status:
                "delivered",
            },
            {
              new: true,
            },
          );

        if (!message) return;

        const conversation =
          await Conversation.findById(
            message.conversation,
          );

        if (!conversation) return;

        for (const participantId of
          conversation.participants) {

          const participantSockets =
            await io
              .in(
                participantId.toString(),
              )
              .fetchSockets();

          participantSockets.forEach(
            (participantSocket) => {
              participantSocket.emit(
                "messageStatusUpdated",
                message,
              );
            },
          );
        }
      } catch (error) {
        console.log(
          "DELIVERED ERROR:",
          error,
        );
      }
    },
  );

  // ==================================================
  // MESSAGE SEEN
  // ==================================================

  socket.on(
    "messageSeen",
    async (messageId) => {
      try {
        const message =
          await Message.findByIdAndUpdate(
            messageId,
            {
              status: "seen",
            },
            {
              new: true,
            },
          );

        if (!message) return;

        const conversation =
          await Conversation.findById(
            message.conversation,
          );

        if (!conversation) return;

        for (const participantId of
          conversation.participants) {

          const participantSockets =
            await io
              .in(
                participantId.toString(),
              )
              .fetchSockets();

          participantSockets.forEach(
            (participantSocket) => {
              participantSocket.emit(
                "messageStatusUpdated",
                message,
              );
            },
          );
        }
      } catch (error) {
        console.log(
          "SEEN ERROR:",
          error,
        );
      }
    },
  );

  // ==================================================
  // DISCONNECT
  // ==================================================

  socket.on(
    "disconnect",
    async (reason) => {
      console.log(
        "USER DISCONNECTED:",
        socket.id,
        reason,
      );

      try {
        const userIdString =
          socket.userId.toString();

        const currentCount =
          userSocketCounts.get(
            userIdString,
          ) || 0;

        const newCount =
          Math.max(
            currentCount - 1,
            0,
          );

        if (newCount === 0) {
          userSocketCounts.delete(
            userIdString,
          );

          const user =
            await User.findByIdAndUpdate(
              socket.userId,
              {
                isOnline: false,
                lastSeen:
                  new Date(),
              },
              {
                new: true,
              },
            );

          if (user) {
            io.emit(
              "userStatusChanged",
              {
                userId:
                  user._id.toString(),

                isOnline: false,

                lastSeen:
                  user.lastSeen,
              },
            );
          }
        } else {
          userSocketCounts.set(
            userIdString,
            newCount,
          );
        }
      } catch (error) {
        console.log(
          "OFFLINE STATUS ERROR:",
          error,
        );
      }
    },
  );
});

// ======================================================
// MONGODB
// ======================================================

mongoose
  .connect(
    process.env.MONGO_URI,
  )
  .then(() => {
    console.log(
      "MongoDB Connected Successfully",
    );
  })
  .catch((error) => {
    console.log(
      "MongoDB Error:",
      error,
    );
  });

// ======================================================
// START SERVER
// ======================================================

const PORT = process.env.PORT || 5000;

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Server running on port ${PORT}`,
    );
  },
);