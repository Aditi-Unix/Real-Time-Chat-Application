# 💬 Real-Time Chat Application — Backend

A production-oriented **real-time chat application backend** built with **Node.js, Express.js, MongoDB, Socket.IO, and JWT authentication**.

The project focuses on building a secure and scalable backend architecture for real-time communication. It combines traditional REST APIs with WebSocket-based communication to provide authenticated users with private conversations, real-time messaging, online/offline presence, typing indicators, and message delivery and seen status.

---

## 🚀 Project Overview

The **Real-Time Chat Application** provides the backend infrastructure required for a modern messaging platform.

The application supports two major communication layers:

### REST API Layer

Used for:

- User registration
- User login
- JWT authentication
- User management
- Conversation management
- Protected resources

### Real-Time Communication Layer

Powered by **Socket.IO** and used for:

- Real-time message delivery
- Private conversation rooms
- Typing indicators
- Online/offline presence
- Last seen tracking
- Message delivered status
- Message seen status

All messages are persisted in **MongoDB**, allowing conversations and messages to remain available after socket disconnections.

---

# ✨ Features

## 🔐 Authentication & Authorization

- User registration
- User login
- JWT-based authentication
- Protected REST API routes
- Password hashing
- Authenticated Socket.IO connections
- Token validation for real-time communication
- User-specific authorization for conversations

---

## 👤 User Management

The backend maintains user information including:

- Name
- Email
- Password hash
- Online status
- Last seen timestamp

User presence is updated automatically when a user connects or disconnects from the Socket.IO server.

---

## 💬 Private Conversations

The application supports private conversations between users.

Conversation functionality includes:

- Creating conversations
- Checking whether a conversation already exists
- Adding participants
- Verifying conversation participants
- Joining private Socket.IO rooms
- Restricting unauthorized users from accessing conversations

---

## ⚡ Real-Time Messaging

Messages are transmitted using **Socket.IO**.

Message flow:

```text
User
  ↓
Socket.IO Connection
  ↓
JWT Authentication
  ↓
Conversation Room
  ↓
Send Message
  ↓
Validate Conversation
  ↓
Save Message in MongoDB
  ↓
Emit Message
  ↓
Recipient Receives Message