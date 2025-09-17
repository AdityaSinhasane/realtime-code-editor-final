


// ------------------- IMPORT MODULES -------------------
import express from "express";       // Web framework for Node.js
import http from "http";             // Built-in HTTP server (wraps Express)
import { Server } from "socket.io";  // Socket.IO for real-time events
import path from "path";             // To resolve file paths
import axios from "axios";           // For making HTTP requests (code execution)

// ------------------- INIT EXPRESS + HTTP SERVER -------------------
const app = express();                  // Create express app
const server = http.createServer(app);  // Create HTTP server using express


// URL of the deployed site (used to keep it awake)
const url = `https://realtime-code-editor-final-89hc.onrender.com`;
const interval = 30000; // Ping interval in ms (30 sec)

// Function to "wake up" the Render server by calling it repeatedly
function reloadWebsite() {
  axios
    .get(url) // Make GET request to the site
    .then((response) => {
      console.log("website reloded"); // Log success
    })
    .catch((error) => {
      console.error(`Error : ${error.message}`); // Log error if request fails
    });
}

// Call reloadWebsite() every 30 seconds
setInterval(reloadWebsite, interval);




// ------------------- INIT SOCKET.IO -------------------
const io = new Server(server, {
  cors: { origin: "*" },                // Allow all origins (dev)
});

// ------------------- DATA STORE -------------------
// Map<roomId, { users:Set<string>, code:string, output?:string }>
const rooms = new Map();

// ------------------- SOCKET HANDLERS -------------------
io.on("connection", (socket) => {
    console.log("✅ User connected:", socket.id);

    let currentRoom = null;   // Track which room this socket is in
    let currentUser = null;   // Track user name

    // -------- JOIN ROOM --------
    socket.on("join", ({ roomId, userName }) => {
      // If socket was already inside a room → remove from there
      if (currentRoom && rooms.has(currentRoom)) {
        rooms.get(currentRoom).users.delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom).users));
        socket.leave(currentRoom);
      }

      currentRoom = roomId;
      currentUser = userName;

      // Create room if not exists
      if (!rooms.has(roomId)) {
        rooms.set(roomId, { users: new Set(), code: "// start code here" });
      }

      rooms.get(roomId).users.add(userName); // Add user
      socket.join(roomId);                   // Join socket.io room

      // Send existing code to new user only
      socket.emit("codeUpdate", rooms.get(roomId).code);

      // Broadcast updated user list to all in the room
      io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId).users));
    });

    // -------- CODE CHANGE --------
    socket.on("codeChange", ({ roomId, code }) => {
      if (rooms.has(roomId)) rooms.get(roomId).code = code;
      socket.to(roomId).emit("codeUpdate", code); // notify others
    });

    // -------- TYPING --------
    socket.on("typing", ({ roomId, userName }) => {
      socket.to(roomId).emit("userTyping", userName);
    });

    // -------- LANGUAGE CHANGE --------
    socket.on("languageChange", ({ roomId, language }) => {
      io.to(roomId).emit("languageUpdate", language);
    });

    // -------- EXECUTE CODE --------
    socket.on("compileCode", async ({ code, roomId, language, version, input }) => {
      try {
        const res = await axios.post("https://emkc.org/api/v2/piston/execute", {
          language,
          version,
          files: [{ content: code }],
          stdin: input,                     // ✅ Pass input correctly
        });

        const out = res.data.run.output;
        if (rooms.has(roomId)) rooms.get(roomId).output = out;

        io.to(roomId).emit("codeResponse", res.data);
      } catch (err) {
        console.error("🚨 Execution error:", err.message);
        io.to(roomId).emit("codeResponse", { run: { output: "Error executing code" } });
      }
    });

    // -------- LEAVE ROOM --------
    socket.on("leaveRoom", () => {
      if (currentRoom && currentUser && rooms.has(currentRoom)) {
        rooms.get(currentRoom).users.delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom).users));
        socket.leave(currentRoom);
        currentRoom = null;
        currentUser = null;
      }
    });

    // -------- DISCONNECT --------
    socket.on("disconnect", () => {
      if (currentRoom && currentUser && rooms.has(currentRoom)) {
        rooms.get(currentRoom).users.delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom).users));
      }
      console.log("❌ User disconnected:", socket.id);
    });
});

// ------------------- SERVE FRONTEND -------------------
const port = process.env.PORT || 5000;
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "frontend", "dist")));
app.get("*", (req, res) =>
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"))
);

// ------------------- START SERVER -------------------
server.listen(port, () => console.log(`🚀 Server running on port ${port}`));


