# 💬 Real-Time Chat Application — Backend

A production-oriented **real-time chat application backend** built with **Node.js, Express.js, MongoDB, Socket.IO, and JWT authentication**.

The project combines **REST APIs** with **WebSocket-based real-time communication** to provide secure private conversations, real-time messaging, typing indicators, online/offline presence, last-seen tracking, and delivered/seen message status.

---

## 🚀 Project Overview

The Real-Time Chat Application provides the backend infrastructure for a modern messaging platform.

It is designed around two communication layers:

### REST API Layer

Responsible for:

* User registration and login
* JWT authentication
* User management
* Conversation management
* Protected API resources
* Request validation and authorization

### Real-Time Communication Layer

Powered by **Socket.IO** and responsible for:

* Real-time messaging
* Private conversation rooms
* Typing indicators
* Online/offline presence
* Last-seen tracking
* Message delivery status
* Message seen status
* Authenticated socket connections

Messages and conversations are persisted in **MongoDB**, allowing data to remain available across socket disconnections and reconnects.

---

# ✨ Features

## 🔐 Authentication & Authorization

* User registration
* User login
* JWT-based authentication
* Protected REST API routes
* Password hashing
* Authenticated Socket.IO connections
* JWT validation during socket connection
* User-specific conversation authorization

---

## 👤 User Management

The backend maintains user information including:

* Name
* Email
* Password hash
* Profile image
* Online/offline status
* Last-seen timestamp

User presence is automatically updated when a user connects or disconnects from the Socket.IO server.

---

## 💬 Private Conversations

The application supports private conversations between authenticated users.

Conversation functionality includes:

* Creating conversations
* Preventing duplicate conversations
* Managing participants
* Validating conversation membership
* Joining private Socket.IO rooms
* Preventing unauthorized users from accessing conversations

---

## ⚡ Real-Time Messaging

Messages are delivered using **Socket.IO private rooms**.

### Message Flow

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
Emit to Other Participants
  ↓
Recipient Receives Message
```

The sender does not receive a duplicate `receiveMessage` event, while the recipient receives the message in real time.

---

## ⌨️ Typing Indicators

The backend provides real-time typing events:

```text
User starts typing
        ↓
Socket.IO
        ↓
Conversation Room
        ↓
Other Participant
        ↓
"User is typing..."
```

Supported events:

* `typing`
* `stopTyping`
* `userTyping`
* `userStoppedTyping`

---

## 🟢 Online & Offline Presence

The application tracks the user's real-time presence.

When a user connects:

```text
isOnline = true
```

When the user disconnects:

```text
isOnline = false
lastSeen = current timestamp
```

Other connected users receive a `userStatusChanged` event.

---

## ✓ Message Delivery & Seen Status

Messages support delivery tracking:

```text
sent
  ↓
delivered
  ↓
seen
```

The backend provides:

* Message delivered event
* Message seen event
* Persistent message status
* Real-time status updates to conversation participants

---

# 🏗️ Architecture

```text
                    ┌─────────────────────┐
                    │      Client         │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
          REST API Layer              Socket.IO Layer
                 │                           │
                 ▼                           ▼
          Express.js                  Real-Time Events
                 │                           │
                 └─────────────┬─────────────┘
                               │
                               ▼
                       Authentication
                               │
                               ▼
                         MongoDB Database
                               │
                ┌──────────────┴──────────────┐
                ▼                             ▼
             Users                       Conversations
                                              │
                                              ▼
                                           Messages
```

---

# 🛠️ Tech Stack

| Technology   | Purpose                 |
| ------------ | ----------------------- |
| Node.js      | Backend runtime         |
| Express.js   | REST API framework      |
| MongoDB      | Database                |
| Mongoose     | MongoDB ODM             |
| Socket.IO    | Real-time communication |
| JWT          | Authentication          |
| bcrypt       | Password hashing        |
| Postman      | API testing             |
| Git & GitHub | Version control         |

---

# 📁 Project Structure

```text
Real-Time-Chat-Application/
│
├── controllers/
│   ├── authController.js
│   ├── conversationController.js
│   └── userController.js
│
├── middleware/
│   └── authMiddleware.js
│
├── models/
│   ├── User.js
│   ├── Conversation.js
│   └── Message.js
│
├── routes/
│   ├── authRoutes.js
│   ├── userRoutes.js
│   └── conversationRoutes.js
│
├── test/
│   └── socketTest.js
│
├── .env
├── .gitignore
├── index.js
├── package.json
└── package-lock.json
```

---

# 🔌 Core Socket Events

| Event                  | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `joinConversation`     | Join a private conversation room                 |
| `conversationJoined`   | Confirms successful room joining                 |
| `sendMessage`          | Sends a real-time message                        |
| `receiveMessage`       | Receives a message from another participant      |
| `typing`               | Indicates that a user started typing             |
| `stopTyping`           | Indicates that a user stopped typing             |
| `userTyping`           | Notifies another participant about typing        |
| `userStoppedTyping`    | Notifies another participant that typing stopped |
| `messageDelivered`     | Marks a message as delivered                     |
| `messageSeen`          | Marks a message as seen                          |
| `messageStatusUpdated` | Broadcasts message status changes                |
| `userStatusChanged`    | Updates online/offline presence                  |

---

# 🔐 Security

The backend implements multiple security mechanisms:

* JWT-based authentication
* Protected REST endpoints
* Authenticated Socket.IO connections
* Password hashing using bcrypt
* Conversation participant validation
* Unauthorized conversation access prevention
* Environment variables for sensitive configuration
* Input validation and error handling

---

# 🧪 Testing

The project includes a dedicated Socket.IO test client for validating real-time functionality with **two authenticated users**.

The test verifies:

* Client A connection
* Client B connection
* JWT socket authentication
* Conversation room joining
* Participant authorization
* Typing indicators
* A → B real-time messaging
* B → A real-time messaging
* Delivered status
* Seen status
* Online/offline presence

Run the backend:

```bash
npm install
npm run dev
```

Run the two-user Socket.IO test:

```bash
node test/socketTest.js
```

---

# ⚙️ Environment Variables

Create a `.env` file in the project root:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

Never commit real credentials or secrets to GitHub.

---

# 🚀 Getting Started

## 1. Clone the repository

```bash
git clone https://github.com/Aditi-Unix/Real-Time-Chat-Application.git
```

## 2. Navigate to the project

```bash
cd Real-Time-Chat-Application
```

## 3. Install dependencies

```bash
npm install
```

## 4. Configure environment variables

Create a `.env` file and add the required MongoDB and JWT configuration.

## 5. Start the development server

```bash
npm run dev
```

The server runs on:

```text
http://localhost:5000
```

---

# 📡 API Overview

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Users

```text
GET /api/users
```

### Conversations

```text
POST /api/conversations
GET  /api/conversations
```

All protected endpoints require a valid JWT access token.

---

# 📈 Future Improvements

Possible future enhancements include:

* Group conversations
* Message editing and deletion
* File and image sharing
* Message reactions
* Push notifications
* Message search
* Pagination and infinite scrolling
* Redis-based Socket.IO scaling
* Rate limiting
* Docker deployment
* Automated API and integration tests
* React-based frontend client

---

# 🎯 Project Highlights

This project demonstrates practical backend engineering concepts including:

* RESTful API design
* JWT authentication
* Authorization
* MongoDB data modeling
* Mongoose relationships
* WebSocket communication
* Socket.IO rooms
* Real-time event handling
* Presence tracking
* Message lifecycle management
* Error handling
* API testing
* Two-client real-time testing
* Modular backend architecture

---

# 👩‍💻 Author

**Aditi Rathi**

Backend Developer | Node.js | Express.js | MongoDB | REST APIs | Socket.IO

---

⭐ If you find this project useful, consider giving the repository a star.

**Built with Node.js, Express.js, MongoDB, Socket.IO & JWT by Aditi Rathi.**
