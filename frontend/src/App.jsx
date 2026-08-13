import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { io } from "socket.io-client";
import EmojiPicker from "emoji-picker-react";

const API_URL =
  "https://real-time-chat-app-60f4.onrender.com";

const SOCKET_URL =
  "https://real-time-chat-app-60f4.onrender.com";

// ======================================================
// HELPERS
// ======================================================

function getUserIdFromToken(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId;
  } catch {
    return null;
  }
}

function getId(value) {
  if (!value) return null;

  if (typeof value === "object") {
    return value._id || value.id || null;
  }

  return value;
}

// ======================================================
// APP
// ======================================================

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("chatToken"),
  );

  const [userId, setUserId] = useState(
    token ? getUserIdFromToken(token) : null,
  );

  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("chatTheme") === "dark",
  );

  // ====================================================
  // AUTH FORMS
  // ====================================================

  const [loginForm, setLoginForm] = useState({
    email: "",
    password: "",
  });

  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [showSignup, setShowSignup] = useState(false);

  // ====================================================
  // CHAT STATE
  // ====================================================

  const [users, setUsers] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);

  const [conversation, setConversation] = useState(null);

  const [messages, setMessages] = useState([]);

  const [text, setText] = useState("");

  // ====================================================
  // UI STATE
  // ====================================================

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const [typingUser, setTypingUser] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState({});

  const [lastSeenUsers, setLastSeenUsers] = useState({});

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  // ====================================================
  // REFS
  // ====================================================

  const socketRef = useRef(null);

  const typingTimerRef = useRef(null);

  const bottomRef = useRef(null);

  const conversationRef = useRef(null);

  const selectedUserRef = useRef(null);

  /*
   * IMPORTANT
   *
   * Messages received for a conversation which is NOT
   * currently open are temporarily stored here.
   *
   * Example:
   *
   * A -> B message
   *
   * B is logged in but chatting with C.
   *
   * Message goes into:
   *
   * pendingMessagesRef.current[conversationId]
   *
   * When B opens A chat, we merge those messages.
   */
  const pendingMessagesRef = useRef({});

  // ====================================================
  // AUTH HEADERS
  // ====================================================

  const authHeaders = useMemo(
    () => ({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }),
    [token],
  );

  // ======================================================
  // SOCKET CONNECTION
  // ======================================================

  useEffect(() => {
    if (!token) {
      return;
    }

    loadUsers();

    const socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],

      auth: {
        token,
      },

      reconnection: true,

      reconnectionAttempts: Infinity,

      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    // ====================================================
    // CONNECT
    // ====================================================

    socket.on("connect", () => {
      console.log(
        "🟢 Socket connected:",
        socket.id,
      );

      setError("");

      /*
       * If user reconnects and a chat was already open,
       * join that conversation again.
       */
      const currentConversation =
        conversationRef.current;

      if (currentConversation?._id) {
        socket.emit(
          "joinConversation",
          currentConversation._id,
          (ack) => {
            console.log(
              "🔄 REJOIN ACK:",
              ack,
            );
          },
        );
      }
    });

    // ====================================================
    // CONNECTION ERROR
    // ====================================================

    socket.on("connect_error", (err) => {
      console.error(
        "🔴 Socket error:",
        err.message,
      );

      setError(
        "Socket connection failed. Please refresh and try again.",
      );
    });

    // ====================================================
    // CONVERSATION JOINED
    // ====================================================

    socket.on(
      "conversationJoined",
      (data) => {
        console.log(
          "💬 Conversation joined:",
          data,
        );
      },
    );

    // ====================================================
    // RECEIVE MESSAGE
    // ====================================================

    socket.on(
      "receiveMessage",
      (message) => {
        console.log(
          "📩 RECEIVED MESSAGE:",
          message,
        );

        if (!message?._id) {
          return;
        }

        const messageConversationId =
          getId(message.conversation);

        const messageSenderId =
          getId(message.sender);

        if (!messageConversationId) {
          console.log(
            "❌ Message conversation ID missing",
          );

          return;
        }

        const conversationId =
          String(messageConversationId);

        const currentConversationId =
          String(
            conversationRef.current?._id || "",
          );

        const isCurrentConversation =
          currentConversationId ===
          conversationId;

        // ==================================================
        // RECEIVER / SENDER MESSAGE HANDLING
        // ==================================================

        if (isCurrentConversation) {
          /*
           * Current chat is open.
           *
           * Directly add message to UI.
           */
          setMessages((prev) => {
            // ----------------------------------------------
            // DUPLICATE CHECK
            // ----------------------------------------------

            const alreadyExists =
              prev.some(
                (item) =>
                  String(item._id) ===
                  String(message._id),
              );

            if (alreadyExists) {
              return prev;
            }

            // ----------------------------------------------
            // REPLACE TEMP MESSAGE
            // ----------------------------------------------

            const tempIndex =
              prev.findIndex(
                (item) =>
                  item.temp === true &&
                  item.text ===
                    message.text &&
                  String(
                    getId(item.sender),
                  ) ===
                    String(messageSenderId),
              );

            if (tempIndex !== -1) {
              const updated = [...prev];

              updated[tempIndex] =
                message;

              return updated;
            }

            // ----------------------------------------------
            // ADD REAL MESSAGE
            // ----------------------------------------------

            return [
              ...prev,
              message,
            ];
          });
        } else {
          /*
           * IMPORTANT FIX
           *
           * Current chat is different.
           *
           * DO NOT discard the message.
           *
           * Store it temporarily against conversationId.
           */

          setPendingMessagesRef(
            conversationId,
            message,
          );

          console.log(
            "📦 Message stored as pending:",
            conversationId,
          );
        }

        // ==================================================
        // RECEIVER SIDE
        // ==================================================

        if (
          String(messageSenderId) !==
          String(userId)
        ) {
          /*
           * Message reached this logged-in client.
           *
           * Tell backend that message is delivered.
           */
          socket.emit(
            "messageDelivered",
            message._id,
          );

          // ----------------------------------------------
          // MARK SEEN ONLY IF CURRENT CHAT IS OPEN
          // ----------------------------------------------

          if (isCurrentConversation) {
            setTimeout(() => {
              const latestConversation =
                conversationRef.current;

              if (
                latestConversation?._id &&
                String(
                  latestConversation._id,
                ) === conversationId
              ) {
                socket.emit(
                  "messageSeen",
                  message._id,
                );
              }
            }, 400);
          }
        }
      },
    );

    // ====================================================
    // MESSAGE STATUS UPDATED
    // ====================================================

    socket.on(
      "messageStatusUpdated",
      (message) => {
        console.log(
          "📌 MESSAGE STATUS UPDATED:",
          message,
        );

        // ----------------------------------------------
        // CURRENT CHAT
        // ----------------------------------------------

        setMessages((prev) =>
          prev.map((item) =>
            String(item._id) ===
            String(message._id)
              ? {
                  ...item,
                  status:
                    message.status,
                  temp: false,
                }
              : item,
          ),
        );

        // ----------------------------------------------
        // PENDING MESSAGES
        // ----------------------------------------------

        const conversationId =
          getId(message.conversation);

        if (!conversationId) {
          return;
        }

        const key =
          String(conversationId);

        const pending =
          pendingMessagesRef.current[
            key
          ];

        if (!pending) {
          return;
        }

        pendingMessagesRef.current[key] =
          pending.map((item) =>
            String(item._id) ===
            String(message._id)
              ? {
                  ...item,
                  status:
                    message.status,
                  temp: false,
                }
              : item,
          );
      },
    );

    // ====================================================
    // TYPING START
    // ====================================================

    socket.on(
      "userTyping",
      (data) => {
        console.log(
          "🔥 USER TYPING RECEIVED:",
          data,
        );

        const typingUserId =
          String(
            data?.userId || "",
          );

        const typingConversationId =
          String(
            data?.conversationId || "",
          );

        const currentSelectedUser =
          selectedUserRef.current;

        const currentSelectedUserId =
          String(
            currentSelectedUser?._id ||
              currentSelectedUser?.id ||
              "",
          );

        const currentConversationId =
          String(
            conversationRef.current?._id ||
              "",
          );

        if (
          typingUserId &&
          currentSelectedUserId &&
          typingUserId ===
            currentSelectedUserId &&
          typingConversationId ===
            currentConversationId
        ) {
          setTypingUser(
            typingUserId,
          );

          clearTimeout(
            typingTimerRef.current,
          );

          typingTimerRef.current =
            setTimeout(() => {
              setTypingUser(null);
            }, 2000);
        }
      },
    );

    // ====================================================
    // TYPING STOP
    // ====================================================

    socket.on(
      "userStoppedTyping",
      (data) => {
        console.log(
          "🛑 USER STOPPED TYPING:",
          data,
        );

        const stoppedUserId =
          String(
            data?.userId || "",
          );

        const stoppedConversationId =
          String(
            data?.conversationId || "",
          );

        const currentSelectedUser =
          selectedUserRef.current;

        const currentSelectedUserId =
          String(
            currentSelectedUser?._id ||
              currentSelectedUser?.id ||
              "",
          );

        const currentConversationId =
          String(
            conversationRef.current?._id ||
              "",
          );

        if (
          stoppedUserId ===
            currentSelectedUserId &&
          stoppedConversationId ===
            currentConversationId
        ) {
          setTypingUser(null);

          clearTimeout(
            typingTimerRef.current,
          );
        }
      },
    );

    // ====================================================
    // ONLINE / OFFLINE
    // ====================================================

    socket.on(
      "userStatusChanged",
      (data) => {
        console.log(
          "👤 USER STATUS:",
          data,
        );

        const statusUserId =
          getId(data?.userId);

        if (!statusUserId) {
          return;
        }

        setOnlineUsers((prev) => ({
          ...prev,

          [statusUserId]:
            Boolean(
              data.isOnline,
            ),
        }));

        if (data.lastSeen) {
          setLastSeenUsers(
            (prev) => ({
              ...prev,

              [statusUserId]:
                data.lastSeen,
            }),
          );
        }
      },
    );

    // ====================================================
    // MESSAGE ERROR
    // ====================================================

    socket.on(
      "messageError",
      (data) => {
        console.error(
          "MESSAGE ERROR:",
          data,
        );

        setError(
          data?.message ||
            "Message could not be sent.",
        );
      },
    );

    // ====================================================
    // CONVERSATION ERROR
    // ====================================================

    socket.on(
      "conversationError",
      (data) => {
        console.error(
          "CONVERSATION ERROR:",
          data,
        );

        setError(
          data?.message ||
            "Conversation error.",
        );
      },
    );

    // ====================================================
    // CLEANUP
    // ====================================================

    return () => {
      console.log(
        "🔴 Cleaning socket...",
      );

      clearTimeout(
        typingTimerRef.current,
      );

      socket.removeAllListeners();

      socket.disconnect();

      if (
        socketRef.current ===
        socket
      ) {
        socketRef.current = null;
      }
    };
  }, [token, userId]);

  // ======================================================
  // AUTO SCROLL
  // ======================================================

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [
    messages,
    typingUser,
  ]);

  // ======================================================
  // STORE PENDING MESSAGE
  // ======================================================

  function setPendingMessagesRef(
    conversationId,
    message,
  ) {
    if (!conversationId || !message) {
      return;
    }

    const key =
      String(conversationId);

    const current =
      pendingMessagesRef.current[
        key
      ] || [];

    // Prevent duplicate
    if (
      current.some(
        (item) =>
          String(item._id) ===
          String(message._id),
      )
    ) {
      return;
    }

    pendingMessagesRef.current[key] =
      [
        ...current,
        message,
      ];
  }

  // ======================================================
  // GET PENDING MESSAGES
  // ======================================================

  function getPendingMessages(
    conversationId,
  ) {
    if (!conversationId) {
      return [];
    }

    return (
      pendingMessagesRef.current[
        String(conversationId)
      ] || []
    );
  }

  // ======================================================
  // CLEAR PENDING MESSAGES
  // ======================================================

  function clearPendingMessages(
    conversationId,
  ) {
    if (!conversationId) {
      return;
    }

    delete pendingMessagesRef.current[
      String(conversationId)
    ];
  }

  // ======================================================
  // LOAD USERS
  // ======================================================

  async function loadUsers() {
    try {
      setError("");

      const response =
        await axios.get(
          `${API_URL}/api/users`,
          authHeaders,
        );

      const data =
        response.data;

      const list =
        data?.users ||
        data?.data ||
        data;

      const userList =
        Array.isArray(list)
          ? list
          : [];

      setUsers(userList);

      const initialOnlineStatus =
        {};

      const initialLastSeen =
        {};

      userList.forEach(
        (user) => {
          const id =
            user._id ||
            user.id;

          if (!id) {
            return;
          }

          initialOnlineStatus[id] =
            Boolean(
              user.isOnline,
            );

          if (user.lastSeen) {
            initialLastSeen[id] =
              user.lastSeen;
          }
        },
      );

      setOnlineUsers(
        initialOnlineStatus,
      );

      setLastSeenUsers(
        initialLastSeen,
      );
    } catch (err) {
      console.error(
        "LOAD USERS ERROR:",
        err,
      );

      setError(
        err.response?.data
          ?.message ||
          "Users load nahi ho rahe. Backend API route check karo.",
      );
    }
  }

  // ======================================================
  // LOGIN
  // ======================================================

  async function login(e) {
    e.preventDefault();

    try {
      setLoading(true);

      setError("");

      const response =
        await axios.post(
          `${API_URL}/api/auth/login`,
          {
            email:
              loginForm.email,

            password:
              loginForm.password,
          },
        );

      const newToken =
        response.data?.token;

      if (!newToken) {
        throw new Error(
          "Token not returned by backend.",
        );
      }

      localStorage.setItem(
        "chatToken",
        newToken,
      );

      const newUserId =
        getUserIdFromToken(
          newToken,
        );

      // Clear old pending state
      pendingMessagesRef.current =
        {};

      conversationRef.current =
        null;

      selectedUserRef.current =
        null;

      setToken(newToken);

      setUserId(newUserId);

      setSelectedUser(null);

      setConversation(null);

      setMessages([]);

      setLoginForm({
        email: "",
        password: "",
      });
    } catch (err) {
      console.error(
        "LOGIN ERROR:",
        err,
      );

      setError(
        err.response?.data
          ?.message ||
          "Login failed. Email/password check karo.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ======================================================
  // SIGNUP
  // ======================================================

  async function signup(e) {
    e.preventDefault();

    try {
      setLoading(true);

      setError("");

      await axios.post(
        `${API_URL}/api/auth/register`,
        {
          name:
            signupForm.name,

          email:
            signupForm.email,

          password:
            signupForm.password,
        },
      );

      setLoginForm({
        email:
          signupForm.email,

        password:
          signupForm.password,
      });

      setSignupForm({
        name: "",
        email: "",
        password: "",
      });

      setShowSignup(false);

      setError("");

      alert(
        "Account created successfully. Please login.",
      );
    } catch (err) {
      console.error(
        "SIGNUP ERROR:",
        err,
      );

      setError(
        err.response?.data
          ?.message ||
          "Signup failed. Please check the details and try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ======================================================
  // THEME
  // ======================================================

  function toggleTheme() {
    setDarkMode((prev) => {
      const newTheme =
        !prev;

      localStorage.setItem(
        "chatTheme",
        newTheme
          ? "dark"
          : "light",
      );

      return newTheme;
    });
  }

  // ======================================================
  // LOGOUT
  // ======================================================

  function logout() {
    clearTimeout(
      typingTimerRef.current,
    );

    socketRef.current?.disconnect();

    localStorage.removeItem(
      "chatToken",
    );

    pendingMessagesRef.current =
      {};

    conversationRef.current =
      null;

    selectedUserRef.current =
      null;

    setToken(null);

    setUserId(null);

    setUsers([]);

    setSelectedUser(null);

    setConversation(null);

    setMessages([]);

    setTypingUser(null);

    setOnlineUsers({});

    setLastSeenUsers({});

    setText("");
  }

  // ======================================================
  // OPEN CHAT
  // ======================================================

  async function openChat(friend) {
    try {
      setError("");

      setSelectedUser(friend);

      selectedUserRef.current =
        friend;

      setMessages([]);

      setTypingUser(null);

      clearTimeout(
        typingTimerRef.current,
      );

      setText("");

      setShowEmojiPicker(false);

      conversationRef.current =
        null;

      const friendId =
        friend._id ||
        friend.id;

      if (!friendId) {
        setError(
          "User ID is missing.",
        );

        return;
      }

      // ==================================================
      // GET / CREATE CONVERSATION
      // ==================================================

      const response =
        await axios.post(
          `${API_URL}/api/conversations`,
          {
            userId:
              friendId,

            receiverId:
              friendId,
          },
          authHeaders,
        );

      const conv =
        response.data
          ?.conversation;

      if (!conv?._id) {
        throw new Error(
          "Conversation ID missing from backend response.",
        );
      }

      const conversationId =
        String(conv._id);

      // IMPORTANT
      conversationRef.current =
        conv;

      setConversation(conv);

      // ==================================================
      // JOIN SOCKET ROOM
      // ==================================================

      if (
        socketRef.current?.connected
      ) {
        socketRef.current.emit(
          "joinConversation",
          conversationId,
          (ack) => {
            console.log(
              "JOIN ACK:",
              ack,
            );

            if (!ack?.success) {
              setError(
                ack?.message ||
                  "Could not join conversation.",
              );
            }
          },
        );
      } else {
        console.log(
          "⚠️ Socket not connected yet.",
        );
      }

      // ==================================================
      // LOAD OLD MESSAGES
      // ==================================================

      let existingMessages = [];

      try {
        const messageResponse =
          await axios.get(
            `${API_URL}/api/conversations/${conversationId}/messages`,
            authHeaders,
          );

        existingMessages =
          messageResponse.data
            ?.messages ||
          messageResponse.data
            ?.data ||
          messageResponse.data;

        if (
          !Array.isArray(
            existingMessages,
          )
        ) {
          existingMessages = [];
        }
      } catch (messageError) {
        console.log(
          "Messages API error:",
          messageError
            ?.response?.data
            ?.message ||
            messageError.message,
        );
      }

      // ==================================================
      // GET PENDING REAL-TIME MESSAGES
      // ==================================================

      const pendingMessages =
        getPendingMessages(
          conversationId,
        );

      // ==================================================
      // MERGE HISTORY + PENDING
      // ==================================================

      const merged = [
        ...existingMessages,
        ...pendingMessages,
      ];

      const uniqueMessages = [];

      const seenIds = new Set();

      for (const message of merged) {
        if (!message?._id) {
          continue;
        }

        const id =
          String(message._id);

        if (seenIds.has(id)) {
          continue;
        }

        seenIds.add(id);

        uniqueMessages.push(
          message,
        );
      }

      // Sort oldest -> newest
      uniqueMessages.sort(
        (a, b) =>
          new Date(
            a.createdAt || 0,
          ) -
          new Date(
            b.createdAt || 0,
          ),
      );

      setMessages(
        uniqueMessages,
      );

      // ==================================================
      // PENDING MESSAGES ARE NOW LOADED
      // ==================================================

      clearPendingMessages(
        conversationId,
      );

      // ==================================================
      // DELIVER + SEEN
      // ==================================================

      if (
        socketRef.current
      ) {
        uniqueMessages.forEach(
          (message) => {
            const senderId =
              getId(
                message.sender,
              );

            // Only receiver
            if (
              !senderId ||
              String(senderId) ===
                String(userId)
            ) {
              return;
            }

            // Mark delivered
            if (
              message.status !==
                "seen"
            ) {
              socketRef.current.emit(
                "messageDelivered",
                message._id,
              );
            }

            // Current chat is open,
            // so mark seen
            socketRef.current.emit(
              "messageSeen",
              message._id,
            );
          },
        );
      }
    } catch (err) {
      console.error(
        "OPEN CHAT ERROR:",
        err,
      );

      setError(
        err.response?.data
          ?.message ||
          "Conversation create/open nahi ho rahi.",
      );
    }
  }

  // ======================================================
  // SEND MESSAGE
  // ======================================================

  function sendMessage(e) {
    e?.preventDefault();

    const cleanText =
      text.trim();

    if (
      !cleanText ||
      !conversation ||
      !socketRef.current
    ) {
      return;
    }

    if (
      !socketRef.current.connected
    ) {
      setError(
        "Socket disconnected. Please wait a moment and try again.",
      );

      return;
    }

    const tempMessage = {
      _id: `temp-${Date.now()}-${Math.random()}`,

      conversation:
        conversation._id,

      sender: {
        _id: userId,
      },

      text: cleanText,

      createdAt:
        new Date().toISOString(),

      status: "sent",

      temp: true,
    };

    // Show instantly on sender side
    setMessages(
      (prev) => [
        ...prev,
        tempMessage,
      ],
    );

    // Send to backend
    socketRef.current.emit(
      "sendMessage",
      {
        conversationId:
          conversation._id,

        text: cleanText,
      },
    );

    setText("");

    setShowEmojiPicker(false);

    socketRef.current.emit(
      "stopTyping",
      conversation._id,
    );

    clearTimeout(
      typingTimerRef.current,
    );
  }

  // ======================================================
  // EMOJI
  // ======================================================

  function handleEmojiClick(
    emojiData,
  ) {
    setText(
      (prev) =>
        prev +
        emojiData.emoji,
    );
  }

  // ======================================================
  // TYPING
  // ======================================================

  function handleTyping(e) {
    const value =
      e.target.value;

    setText(value);

    if (
      !conversation ||
      !socketRef.current
    ) {
      return;
    }

    if (
      !socketRef.current.connected
    ) {
      return;
    }

    const conversationId =
      conversation._id;

    // ==================================================
    // EMPTY INPUT
    // ==================================================

    if (!value.trim()) {
      socketRef.current.emit(
        "stopTyping",
        conversationId,
      );

      clearTimeout(
        typingTimerRef.current,
      );

      return;
    }

    console.log(
      "⌨️ SENDING TYPING:",
      conversationId,
    );

    // ==================================================
    // TYPING START
    // ==================================================

    socketRef.current.emit(
      "typing",
      conversationId,
    );

    // ==================================================
    // RESET TIMER
    // ==================================================

    clearTimeout(
      typingTimerRef.current,
    );

    // ==================================================
    // STOP AFTER 1.5 SEC
    // ==================================================

    typingTimerRef.current =
      setTimeout(() => {
        console.log(
          "⌨️ SENDING STOP TYPING:",
          conversationId,
        );

        socketRef.current?.emit(
          "stopTyping",
          conversationId,
        );
      }, 1500);
  }

  // ======================================================
  // LOGIN / SIGNUP PAGE
  // ======================================================

  if (!token) {
    return (
      <div className="login-page">
        <form
          className="login-card"
          onSubmit={
            showSignup
              ? signup
              : login
          }
        >
          <div className="logo">
            💬
          </div>

          <h1>
            {showSignup
              ? "Create Account"
              : "Real-Time Chat"}
          </h1>

          <p>
            {showSignup
              ? "Create an account to start chatting with your friends."
              : "Login to start chatting with your friends."}
          </p>

          {error && (
            <div className="error">
              {error}
            </div>
          )}

          {showSignup && (
            <>
              <label>
                Name
              </label>

              <input
                type="text"
                placeholder="Enter your name"
                value={
                  signupForm.name
                }
                onChange={(e) =>
                  setSignupForm({
                    ...signupForm,

                    name:
                      e.target.value,
                  })
                }
                required
              />
            </>
          )}

          <label>
            Email
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={
              showSignup
                ? signupForm.email
                : loginForm.email
            }
            onChange={(e) =>
              showSignup
                ? setSignupForm({
                    ...signupForm,

                    email:
                      e.target.value,
                  })
                : setLoginForm({
                    ...loginForm,

                    email:
                      e.target.value,
                  })
            }
            required
          />

          <label>
            Password
          </label>

          <input
            type="password"
            placeholder="Enter your password"
            value={
              showSignup
                ? signupForm.password
                : loginForm.password
            }
            onChange={(e) =>
              showSignup
                ? setSignupForm({
                    ...signupForm,

                    password:
                      e.target.value,
                  })
                : setLoginForm({
                    ...loginForm,

                    password:
                      e.target.value,
                  })
            }
            required
          />

          <button
            className="primary-btn"
            disabled={loading}
          >
            {loading
              ? showSignup
                ? "Creating account..."
                : "Logging in..."
              : showSignup
                ? "Sign Up"
                : "Login"}
          </button>

          <button
            type="button"
            className="switch-btn"
            onClick={() => {
              setShowSignup(
                !showSignup,
              );

              setError("");
            }}
          >
            {showSignup
              ? "Already have an account? Login"
              : "New here? Create an account"}
          </button>
        </form>
      </div>
    );
  }

  // ======================================================
  // CHAT APPLICATION
  // ======================================================

  return (
    <div
      className={`app ${
        darkMode
          ? "dark-mode"
          : ""
      }`}
    >
      {/* ==================================================
          SIDEBAR
      ================================================== */}

      <aside className="sidebar">
        <div className="sidebar-top">
          <div>
            <h2>
              ChatZone
            </h2>
          </div>

          <div className="top-actions">
            <button
              className="theme-btn"
              onClick={
                toggleTheme
              }
            >
              {darkMode
                ? "☀️"
                : "🌙"}
            </button>

            <button
              className="logout-btn"
              onClick={
                logout
              }
            >
              Logout
            </button>
          </div>
        </div>

        <div className="user-list">
          {users.length ===
            0 && (
            <p className="empty">
              No other users
              found.
            </p>
          )}

          {users
            .filter(
              (user) =>
                String(
                  user._id ||
                    user.id,
                ) !==
                String(userId),
            )
            .filter(
              (
                user,
                index,
                self,
              ) =>
                index ===
                self.findIndex(
                  (u) =>
                    String(
                      u._id ||
                        u.id,
                    ) ===
                    String(
                      user._id ||
                        user.id,
                    ),
                ),
            )
            .map((user) => {
              const currentUserId =
                user._id ||
                user.id;

              return (
                <button
                  className={`user-item ${
                    String(
                      selectedUser?._id ||
                        selectedUser?.id,
                    ) ===
                    String(
                      currentUserId,
                    )
                      ? "active"
                      : ""
                  }`}
                  key={
                    currentUserId
                  }
                  onClick={() =>
                    openChat(
                      user,
                    )
                  }
                >
                  <div className="avatar">
                    {(
                      user.name ||
                      user.email ||
                      "?"
                    )
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="user-info">
                    <strong>
                      {user.name ||
                        user.email}
                    </strong>

                    <span>
                      {onlineUsers[
                        currentUserId
                      ]
                        ? "Online"
                        : lastSeenUsers[
                              currentUserId
                            ]
                          ? `Last seen ${new Date(
                              lastSeenUsers[
                                currentUserId
                              ],
                            ).toLocaleTimeString(
                              [],
                              {
                                hour:
                                  "2-digit",
                                minute:
                                  "2-digit",
                              },
                            )}`
                          : "Tap to chat"}
                    </span>
                  </div>

                  {onlineUsers[
                    currentUserId
                  ] && (
                    <span className="green-dot" />
                  )}
                </button>
              );
            })}
        </div>
      </aside>

      {/* ==================================================
          CHAT
      ================================================== */}

      <main className="chat">
        {!selectedUser ? (
          <div className="welcome">
            <div className="welcome-icon">
              💬
            </div>

            <h2>
              Select a friend
            </h2>

            <p>
              Choose a user from
              the left and start a
              real-time
              conversation.
            </p>
          </div>
        ) : (
          <>
            {/* ============================================
                CHAT HEADER
            ============================================ */}

            <header className="chat-header">
              <div className="avatar large">
                {(
                  selectedUser.name ||
                  selectedUser.email ||
                  "?"
                )
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>
                <h2>
                  {selectedUser.name ||
                    selectedUser.email}
                </h2>

                <span
                  style={{
                    color:
                      typingUser
                        ? "#25D366"
                        : undefined,

                    fontWeight:
                      typingUser
                        ? 500
                        : undefined,
                  }}
                >
                  {typingUser
                    ? "typing..."
                    : onlineUsers[
                          selectedUser._id ||
                            selectedUser.id
                        ]
                      ? "Online"
                      : lastSeenUsers[
                            selectedUser._id ||
                              selectedUser.id
                          ]
                        ? `Last seen ${new Date(
                            lastSeenUsers[
                              selectedUser._id ||
                                selectedUser.id
                            ],
                          ).toLocaleString(
                            [],
                            {
                              day: "2-digit",
                              month:
                                "short",
                              hour:
                                "2-digit",
                              minute:
                                "2-digit",
                            },
                          )}`
                        : "Offline"}
                </span>
              </div>
            </header>

            {error && (
              <div className="chat-error">
                {error}
              </div>
            )}

            {/* ============================================
                MESSAGES
            ============================================ */}

            <section className="messages">
              {messages.length ===
                0 && (
                <div className="empty-chat">
                  <span>
                    👋
                  </span>

                  <p>
                    Say hello and
                    start the
                    conversation.
                  </p>
                </div>
              )}

              {messages.map(
                (message) => {
                  const messageSenderId =
                    getId(
                      message.sender,
                    );

                  const isMine =
                    String(
                      messageSenderId,
                    ) ===
                    String(userId);

                  return (
                    <div
                      className={`message-row ${
                        isMine
                          ? "mine"
                          : "theirs"
                      }`}
                      key={
                        message._id
                      }
                    >
                      <div className="message-bubble">
                        <p>
                          {
                            message.text
                          }
                        </p>

                        <small>
                          {message.createdAt
                            ? new Date(
                                message.createdAt,
                              ).toLocaleTimeString(
                                [],
                                {
                                  hour:
                                    "2-digit",
                                  minute:
                                    "2-digit",
                                },
                              )
                            : ""}

                          {isMine && (
                            <span className="status">
                              {message.status ===
                              "seen"
                                ? " ✓✓"
                                : message.status ===
                                    "delivered"
                                  ? " ✓✓"
                                  : " ✓"}
                            </span>
                          )}
                        </small>
                      </div>
                    </div>
                  );
                },
              )}

              {/* ==========================================
                  TYPING BUBBLE
              ========================================== */}

              {typingUser && (
                <div className="typing">
                  <span />
                  <span />
                  <span />
                  is typing...
                </div>
              )}

              <div
                ref={
                  bottomRef
                }
              />
            </section>

            {/* ============================================
                MESSAGE FORM
            ============================================ */}

            <form
              className="message-form"
              onSubmit={
                sendMessage
              }
            >
              <div className="emoji-wrapper">
                <button
                  type="button"
                  className="emoji-btn"
                  onClick={() =>
                    setShowEmojiPicker(
                      (prev) =>
                        !prev,
                    )
                  }
                >
                  😊
                </button>

                {showEmojiPicker && (
                  <div className="emoji-picker">
                    <EmojiPicker
                      onEmojiClick={
                        handleEmojiClick
                      }
                      theme={
                        darkMode
                          ? "dark"
                          : "light"
                      }
                      width={320}
                      height={400}
                    />
                  </div>
                )}
              </div>

              <input
                value={text}
                onChange={
                  handleTyping
                }
                placeholder="Type a message..."
                autoComplete="off"
              />

              <button
                className="send-btn"
                type="submit"
                disabled={
                  !text.trim()
                }
              >
                Send
              </button>
            </form>
          </>
        )}
      </main>
    </div>
  );
}

export default App;