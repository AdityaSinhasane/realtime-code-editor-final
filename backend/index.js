import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from 'path'
import axios from 'axios'

const app = express();

const server = http.createServer(app);

const url = `https://render-hosting-se2b.onrender.com`;
const interval = 30000;

function reloadWebsite() {
  axios
    .get(url)
    .then((response) => {
      console.log("website reloded");
    })
    .catch((error) => {
      console.error(`Error : ${error.message}`);
    });
}

setInterval(reloadWebsite, interval);


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

  socket.on("compileCode", async({code, roomId, language, version})=>{
    if(rooms.has(roomId)){
      const room = rooms.get(roomId);
      try{
        const response = await axios.post("https://emkc.org/api/v2/piston/execute",{
          language,
          version,
          files:[
            {
              content: code
            }
          ]
        })
        room.output = response.data.run.output;
        io.to(roomId).emit("codeResponse", response.data);

      }
      catch(err){
        io.to(roomId).emit("codeResponse", { run: { output: "Error: Code execution failed." } });
      }
      
    }
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

const __dirname = path.dirname(new URL(import.meta.url).pathname);

app.use(express.static(path.join(__dirname, "/frontend/dist")));

app.get("*",(re,res)=>{
  res.sendFile(path.join(__dirname,"frontend","dist","index.html"));
});

server.listen(port, () => {
  console.log("Server is Working on Port 5000");
});

