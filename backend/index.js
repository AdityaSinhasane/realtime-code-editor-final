// Importing required modules
import express from "express";       // Web framework for Node.js
import http from "http";             // Node's built-in HTTP module (used to create server)
import { Server } from "socket.io";  // Socket.IO for real-time communication
import path from "path";             // For working with file and directory paths
import axios from "axios";           // For making HTTP requests

// Initialize the Express app
const app = express();

// Create an HTTP server using the Express app
const server = http.createServer(app);

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

// Initialize Socket.IO server with CORS enabled (allow all origins)
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Create a Map to store rooms
// Key = roomId, Value = Set of user names (who joined that room)
const rooms = new Map();

// Handle Socket.IO connections
io.on("connection", (socket) => {
    console.log("User Connected", socket.id); // Log new connection

    // Variables to track the current room and user for this socket
    let currentRoom = null;
    let currentUser = null;

    // Handle "join" event (when a user joins a room)
    socket.on("join", ({ roomId, userName }) => {
      // If the user was already in a room, remove them from it
      if (currentRoom) {
        socket.leave(currentRoom); // Leave the previous room
        rooms.get(currentRoom).delete(currentUser); // Remove user from Set
        // Send updated user list to everyone in that room
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
      }

      // Save the new room and user info
      currentRoom = roomId;
      currentUser = userName;

      socket.join(roomId); // Add the socket to the new room

      // If the room doesn’t exist in Map, create it with an empty Set
      if (!rooms.has(roomId)) {
        rooms.set(roomId, new Set());
      }

      rooms.get(roomId).add(userName); // Add user to the room’s Set

      // Broadcast updated list of users in the new room
      io.to(roomId).emit("userJoined", Array.from(rooms.get(currentRoom)));
    });

    // Handle "codeChange" event (when user edits code)
    socket.on("codeChange", ({ roomId, code }) => {
      // Send the code update to everyone else in the room (except sender)
      socket.to(roomId).emit("codeUpdate", code);
    });

    // Handle "leaveRoom" event
    socket.on("leaveRoom", () => {
      if (currentRoom && currentUser) {
        rooms.get(currentRoom).delete(currentUser); // Remove user from Set
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom))); // Broadcast updated user list

        socket.leave(currentRoom); // Remove socket from room

        // Reset variables
        currentRoom = null;
        currentUser = null;
      }
    });

    // Handle "typing" event (notify others when someone is typing)
    socket.on("typing", ({ roomId, userName }) => {
      socket.to(roomId).emit("userTyping", userName);
    });

    // Handle "languageChange" event (broadcast selected language to room)
    socket.on("languageChange", ({ roomId, language }) => {
      io.to(roomId).emit("languageUpdate", language);
    });

    // Handle "compileCode" event (send code to API for execution)
    socket.on("compileCode", async ({ code, roomId, language, version }) => {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId); // Get the room info
        // Send POST request to Piston API to execute the code
        const response = await axios.post(
          "https://emkc.org/api/v2/piston/execute",
          {
            language,  // Programming language
            version,   // Version of the language
            files: [
              {
                content: code, // Code content to run
              },
            ],
          }
        );

        room.output = response.data.run.output; // Save API output in room (optional)
        // Send the execution result to all users in the room
        io.to(roomId).emit("codeResponse", response.data);
      }
    });

    // Handle disconnection of a user
    socket.on("disconnect", () => {
      if (currentRoom && currentUser) {
        rooms.get(currentRoom).delete(currentUser); // Remove user from Set
        io.to(currentRoom).emit(" ", Array.from(rooms.get(currentRoom))); // Notify others
      }
      console.log("user Disconnected");
    });
});

// Port for the server (from env or fallback to 5000)
const port = process.env.PORT || 5000;

// Resolve __dirname (for ES modules)
const __dirname = path.resolve();

// Serve static frontend files (React build)
app.use(express.static(path.join(__dirname, "/frontend/dist")));

// For any unknown route, send React's index.html (SPA fallback)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

// Start the HTTP server
server.listen(port, () => {
  console.log("server is working on port 5000");
});
