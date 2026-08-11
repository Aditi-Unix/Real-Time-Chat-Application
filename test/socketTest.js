import { io } from "socket.io-client";

console.log("Starting client...");

const TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTdiM2EyNzk1MDRmM2M5NmRlNDYxNDUiLCJpYXQiOjE3ODY0Njg3ODgsImV4cCI6MTc4NzA3MzU4OH0.AyoBDAzFrCLkC6Hh-MT1PGBSx3rnsWx-iTegoRxEn5k";

const CONVERSATION_ID = "6a7b4335e6ed2b955b8c499f";

const socket = io("http://localhost:5000", {
  auth: {
    token: TOKEN,
  },

  transports: ["websocket"],

  reconnection: false,
});

// ==================================================
// CONNECT
// ==================================================

socket.on("connect", () => {
  console.log("Connected!");
  console.log("Socket ID:", socket.id);

  console.log("Sending joinConversation...");

  socket.emit("joinConversation", CONVERSATION_ID, (response) => {
    console.log("JOIN ACK:", response);

    if (!response || !response.success) {
      console.log("JOIN FAILED");

      return;
    }

    console.log("Joined conversation:", response.conversationId);

    // ==========================================
    // TYPING
    // ==========================================

    setTimeout(() => {
      socket.emit("typing", CONVERSATION_ID);

      console.log("Typing started...");
    }, 1000);

    setTimeout(() => {
      socket.emit("stopTyping", CONVERSATION_ID);

      console.log("Typing stopped...");
    }, 2500);

    // ==========================================
    // SEND MESSAGE
    // ==========================================

    setTimeout(() => {
      socket.emit("sendMessage", {
        conversationId: CONVERSATION_ID,

        text: "Hello! Final backend test message.",
      });

      console.log("Message sent...");
    }, 3500);
  });

  console.log("Join request sent:", CONVERSATION_ID);
});

// ==================================================
// CONVERSATION JOINED
// ==================================================

socket.on("conversationJoined", (data) => {
  console.log("CONVERSATION JOINED EVENT:", data);
});

// ==================================================
// TYPING
// ==================================================

socket.on("userTyping", (data) => {
  console.log("User Typing:", data);
});

socket.on("userStoppedTyping", (data) => {
  console.log("User Stopped Typing:", data);
});

// ==================================================
// RECEIVE MESSAGE
// ==================================================

socket.on("receiveMessage", (message) => {
  console.log("Received Message:", message);

  // Delivered
  socket.emit("messageDelivered", message._id);
});

// ==================================================
// MESSAGE STATUS
// ==================================================

socket.on("messageStatusUpdated", (message) => {
  console.log("Message Status:", message._id, "=>", message.status);

  // Seen
  if (message.status === "delivered") {
    setTimeout(() => {
      socket.emit("messageSeen", message._id);
    }, 1000);
  }
});

// ==================================================
// USER STATUS
// ==================================================

socket.on("userStatusChanged", (data) => {
  console.log("User Status Changed:", data);
});

// ==================================================
// ERRORS
// ==================================================

socket.on("conversationError", (error) => {
  console.log("CONVERSATION ERROR:", error);
});

socket.on("messageError", (error) => {
  console.log("MESSAGE ERROR:", error);
});

socket.on("connect_error", (error) => {
  console.log("Connection Error:", error.message);
});

// ==================================================
// DISCONNECT
// ==================================================

socket.on("disconnect", (reason) => {
  console.log("Disconnected:", reason);
});
