import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from 'path'

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const rooms = new Map();

io.on("connection", (socket) => {
  console.log("User Connected", socket.id);

  let currentRoom = null;
  let currentUser = null;

  socket.on("join", ({ roomId, userName }) => {
    if (currentRoom) {
      socket.leave(currentRoom);
      rooms.get(currentRoom).delete(currentUser);
      io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }

    currentRoom = roomId;
    currentUser = userName;

    // Add the room if it doesn't exist
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    // Add the user to the room
    rooms.get(roomId).add(userName);
    socket.join(roomId);

    // Emit the updated list of users in the room
    io.to(roomId).emit("userJoined", Array.from(rooms.get(roomId)));
  });

  socket.on("codeChange", ({ roomId, code }) => {
    socket.to(roomId).emit("codeUpdate", code);
  });

  socket.on("leaveRoom",()=>{
    if(currentRoom && currentUser){
        rooms.get(currentRoom).delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));

        socket.leave(currentRoom);
        currentRoom = null;
        currentUser = null;
    }
  });

  socket.on("typing",({roomId, userName})=>{
    socket.to(roomId).emit("userTyping", userName);
  });

  socket.on("languageChange",({roomId, language})=>{
    io.to(roomId).emit("languageUpdate", language);
  });

  socket.on("disconnect",()=>{
    if(currentRoom && currentUser){
        rooms.get(currentRoom).delete(currentUser);
        io.to(currentRoom).emit("userJoined", Array.from(rooms.get(currentRoom)));
    }
    console.log("User Disconnected");
  });
});

const port = process.env.port || 5000;

const __dirname = path.resolve();

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("*",(re,res)=>{
  res.sendFile(path.join(__dirname,"frontend","dist","index.html"));
});

server.listen(port, () => {
  console.log("Server is Working on Port 5000");
});
