import { io } from "socket.io-client";

// ======================================================
// CONFIG
// ======================================================

const SERVER_URL = "http://localhost:5000";

const CONVERSATION_ID = "6a7b6166ab0bd805b1d1473a";

// ------------------------------------------------------
// IMPORTANT:
// Dono users ke VALID JWT tokens yahan paste karo.
// User A ka token = login user A
// User B ka token = login user B
// ------------------------------------------------------

const TOKEN_A =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTdiNWVlYmE3YTQzMDJiOTc1YTBkYzgiLCJpYXQiOjE3ODY0NzAxNTQsImV4cCI6MTc4NzA3NDk1NH0.JAEe8s_Y9Emv1-0YcKHiYMDyjboKJT6Cw99h3ACsKfo";

const TOKEN_B =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2YTdiNWYzMGE3YTQzMDJiOTc1YTBkYzkiLCJpYXQiOjE3ODY0NzA2MjAsImV4cCI6MTc4NzA3NTQyMH0.EgjvFxaJTPD-9HsbXarLhtduI1053A4YxeUX5ZgdllU";

// ======================================================
// CREATE CLIENT A
// ======================================================

const clientA = io(SERVER_URL, {
  auth: {
    token: TOKEN_A,
  },

  transports: ["polling", "websocket"],

  reconnection: false,
});

// ======================================================
// CREATE CLIENT B
// ======================================================

const clientB = io(SERVER_URL, {
  auth: {
    token: TOKEN_B,
  },

  transports: ["polling", "websocket"],

  reconnection: false,
});

// ======================================================
// CLIENT A
// ======================================================

clientA.on("connect", () => {
  console.log("\n================================");

  console.log("CLIENT A CONNECTED");

  console.log("Client A Socket ID:", clientA.id);

  console.log("================================");

  // Join conversation
  clientA.emit("joinConversation", CONVERSATION_ID, (response) => {
    console.log("CLIENT A JOIN ACK:", response);
  });

  console.log("Client A joined conversation:", CONVERSATION_ID);
});

// ======================================================
// CLIENT A - CONVERSATION JOINED
// ======================================================

clientA.on("conversationJoined", (data) => {
  console.log("CLIENT A CONVERSATION JOINED:", data);
});

// ======================================================
// CLIENT A - STATUS
// ======================================================

clientA.on("userStatusChanged", (data) => {
  console.log("CLIENT A USER STATUS:", data);
});

// ======================================================
// CLIENT A - RECEIVE MESSAGE
// ======================================================

clientA.on("receiveMessage", (message) => {
  console.log("\n📩 CLIENT A RECEIVED:");

  console.log(message);

  // If message came from B,
  // mark it delivered and seen.

  clientA.emit("messageDelivered", message._id);

  setTimeout(() => {
    clientA.emit("messageSeen", message._id);
  }, 500);
});

// ======================================================
// CLIENT A - MESSAGE STATUS
// ======================================================

clientA.on("messageStatusUpdated", (message) => {
  console.log("CLIENT A MESSAGE STATUS:", message._id, "=>", message.status);
});

// ======================================================
// CLIENT A - TYPING
// ======================================================

clientA.on("userTyping", (data) => {
  console.log("CLIENT A:", data.userId, "is typing...");
});

clientA.on("userStoppedTyping", (data) => {
  console.log("CLIENT A:", data.userId, "stopped typing");
});

// ======================================================
// CLIENT A - ERROR
// ======================================================

clientA.on("messageError", (error) => {
  console.log("CLIENT A MESSAGE ERROR:", error);
});

clientA.on("conversationError", (error) => {
  console.log("CLIENT A CONVERSATION ERROR:", error);
});

clientA.on("connect_error", (error) => {
  console.log("CLIENT A CONNECTION ERROR:", error.message);
});

// ======================================================
// CLIENT B
// ======================================================

clientB.on("connect", () => {
  console.log("\n================================");

  console.log("CLIENT B CONNECTED");

  console.log("Client B Socket ID:", clientB.id);

  console.log("================================");

  // Join conversation
  clientB.emit("joinConversation", CONVERSATION_ID, (response) => {
    console.log("CLIENT B JOIN ACK:", response);
  });

  console.log("Client B joined conversation:", CONVERSATION_ID);
});

// ======================================================
// CLIENT B - CONVERSATION JOINED
// ======================================================

clientB.on("conversationJoined", (data) => {
  console.log("CLIENT B CONVERSATION JOINED:", data);
});

// ======================================================
// CLIENT B - STATUS
// ======================================================

clientB.on("userStatusChanged", (data) => {
  console.log("CLIENT B USER STATUS:", data);
});

// ======================================================
// CLIENT B - RECEIVE MESSAGE
// ======================================================

clientB.on("receiveMessage", (message) => {
  console.log("\n📩 CLIENT B RECEIVED:");

  console.log(message);

  // Mark delivered
  clientB.emit("messageDelivered", message._id);

  // Mark seen
  setTimeout(() => {
    clientB.emit("messageSeen", message._id);
  }, 500);
});

// ======================================================
// CLIENT B - MESSAGE STATUS
// ======================================================

clientB.on("messageStatusUpdated", (message) => {
  console.log("CLIENT B MESSAGE STATUS:", message._id, "=>", message.status);
});

// ======================================================
// CLIENT B - TYPING
// ======================================================

clientB.on("userTyping", (data) => {
  console.log("CLIENT B:", data.userId, "is typing...");
});

clientB.on("userStoppedTyping", (data) => {
  console.log("CLIENT B:", data.userId, "stopped typing");
});

// ======================================================
// CLIENT B - ERROR
// ======================================================

clientB.on("messageError", (error) => {
  console.log("CLIENT B MESSAGE ERROR:", error);
});

clientB.on("conversationError", (error) => {
  console.log("CLIENT B CONVERSATION ERROR:", error);
});

clientB.on("connect_error", (error) => {
  console.log("CLIENT B CONNECTION ERROR:", error.message);
});

// ======================================================
// START REAL-TIME TEST
// ======================================================

// Wait for both clients to connect.

setTimeout(() => {
  console.log("\n================================");

  console.log("STARTING TWO-USER CHAT TEST");

  console.log("================================");

  // ------------------------------------------------
  // CLIENT A TYPING
  // ------------------------------------------------

  clientA.emit("typing", CONVERSATION_ID);

  console.log("\nCLIENT A: Typing started...");

  setTimeout(() => {
    clientA.emit("stopTyping", CONVERSATION_ID);

    console.log("CLIENT A: Typing stopped...");
  }, 1500);

  // ------------------------------------------------
  // CLIENT A → CLIENT B
  // ------------------------------------------------

  setTimeout(() => {
    console.log("\n📤 CLIENT A → CLIENT B");

    clientA.emit("sendMessage", {
      conversationId: CONVERSATION_ID,

      text: "Hello Rahul! Message from Client A.",
    });
  }, 2500);

  // ------------------------------------------------
  // CLIENT B → CLIENT A
  // ------------------------------------------------

  setTimeout(() => {
    console.log("\n📤 CLIENT B → CLIENT A");

    clientB.emit("sendMessage", {
      conversationId: CONVERSATION_ID,

      text: "Hi Aditi! Message from Client B.",
    });
  }, 5000);

  // ------------------------------------------------
  // END TEST
  // ------------------------------------------------

  setTimeout(() => {
    console.log("\n================================");

    console.log("TWO-USER TEST FINISHED");

    console.log("================================");

    clientA.disconnect();
    clientB.disconnect();
  }, 8000);
}, 3000);
