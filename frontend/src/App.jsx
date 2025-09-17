// Import React hooks and other dependencies
import { useEffect, useState } from "react"; // React hooks for state and lifecycle
import "./App.css"; // App styling
import io from "socket.io-client"; // Client for Socket.IO (real-time)
import Editor from "@monaco-editor/react"; // Monaco code editor component
import {v4 as uuid} from "uuid"

// Connect to the Socket.IO server
const socket = io("https://realtime-code-editor-final-89hc.onrender.com");

const App = () => {
  // ------------------- STATE VARIABLES -------------------
  const [joined, setJoined] = useState(false);         // Whether user joined a room
  const [roomId, setRoomId] = useState("");            // Room ID entered by user
  const [userName, setUserName] = useState("");        // User's name
  const [language, setLanguage] = useState("javascript"); // Selected language
  const [code, setCode] = useState("// start code here"); // Current code in editor
  const [copySuccess, setCopySuccess] = useState("");  // Message after copying Room ID
  const [users, setUsers] = useState([]);              // List of users in the room
  const [typing, setTyping] = useState("");            // Typing indicator message
  const [outPut, setOutPut] = useState("");            // Output from code execution
  const [version, setVersion] = useState("*");         // Version for execution API

  // ------------------- SOCKET EVENT HANDLERS -------------------
  useEffect(() => {
    // When server sends updated user list
    socket.on("userJoined", ( users) => {
      setUsers(users);
    });

    // When someone updates the code
    socket.on("codeUpdate", (newCode) => {
      setCode(newCode);
    });

    // When someone is typing
    socket.on("userTyping", (user) => {
      setTyping(`${user.slice(0, 8)}... is Typing`); // Show typing message
      setTimeout(() => setTyping(""), 2000);         // Clear message after 2 sec
    });

    // When language changes in the room
    socket.on("languageUpdate", (newLanguage) => {
      setLanguage(newLanguage);
    });

    // When code execution response comes back
    socket.on("codeResponse", (response) => {
      setOutPut(response.run.output);
    });

    // Cleanup: remove listeners on component unmount
    return () => {
      socket.off("userJoined");
      socket.off("codeUpdate");
      socket.off("userTyping");
      socket.off("languageUpdate");
      socket.off("codeResponse");
    };
  }, []); // Run once on mount

  // ------------------- HANDLE LEAVE ON PAGE CLOSE -------------------
  useEffect(() => {
    // Notify server if user closes browser/tab
    const handleBeforeUnload = () => {
      socket.emit("leaveRoom");
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  // ------------------- JOIN / LEAVE ROOM -------------------
  const joinRoom = () => {
    if (roomId && userName) {
      socket.emit("join", { roomId, userName }); // Send join request to server
      setJoined(true);                           // Mark as joined
    }
  };

  const leaveRoom = () => {
    socket.emit("leaveRoom");                    // Tell server user left
    setJoined(false);                            // Reset UI to "join" screen
    setRoomId("");
    setUserName("");
    setCode("// start code here");
    setLanguage("javascript");
  };

  // ------------------- UTILITY FUNCTIONS -------------------
  const copyRoomId = () => {
    navigator.clipboard.writeText(roomId); // Copy Room ID to clipboard
    setCopySuccess("Copied!");             // Show success message
    setTimeout(() => setCopySuccess(""), 2000); // Clear message after 2 sec
  };

  // When user edits code in editor
  const handleCodeChange = (newCode) => {
    setCode(newCode); // Update local state
    socket.emit("codeChange", { roomId, code: newCode }); // Send to others
    socket.emit("typing", { roomId, userName });          // Notify typing
  };

  // When user changes programming language
  const handleLanguageChange = (e) => {
    const newLanguage = e.target.value;
    setLanguage(newLanguage); // Update state
    socket.emit("languageChange", { roomId, language: newLanguage }); // Notify server
  };

  const [userInput, setUserInput] = useState("");


  // Execute the code using backend
 const runCode = () => {
  socket.emit("compileCode", { 
    code, 
    roomId, 
    language, 
    version, 
    input: userInput    // ✅ pass user input
  });
};


  const createRoomId = () =>{
    const roomId = uuid()
    setRoomId(roomId);
  }

  // ------------------- RENDER -------------------
  // If user hasn't joined a room yet, show join form
  if (!joined) {
    return (
      <div className="join-container">
        <div className="join-form">
          <h1>Join Code Room</h1>
          <input
            type="text"
            placeholder="Room Id"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}

          />
          <button onClick={createRoomId}>Create id</button>
          <input
            type="text"
            placeholder="Your Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
          />
          <button onClick={joinRoom}>Join Room</button>
        </div>
      </div>
    );
  }
  

  // Main editor interface after joining
  return (
    <div className="editor-container">
      {/* Sidebar with room info and users */}
      <div className="sidebar">
        <div className="room-info">
          <h2>Code Room: {roomId}</h2>
          <button onClick={copyRoomId} className="copy-button">
            Copy Id
          </button>
          {copySuccess && <span className="copy-success">{copySuccess}</span>}
        </div>

        <h3>Users in Room:</h3>
        <ul>
          {users.map((user, index) => (
            <li key={index}>{user.slice(0, 8)}...</li> 
          ))}
        </ul>

        <p className="typing-indicator">{typing}</p>

        {/* Dropdown to choose language */}
        <select
          className="language-selector"
          value={language}
          onChange={handleLanguageChange}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="java">Java</option>
          <option value="cpp">C++</option>
        </select>

        {/* Leave room button */}
        <button className="leave-button" onClick={leaveRoom}>
          Leave Room
        </button>
      </div>

      {/* Code editor + output */}
      <div className="editor-wrapper">
        <Editor
          height={"60%"}                 // Height of editor
          defaultLanguage={language}     // Default language
          language={language}            // Current language
          value={code}                   // Current code text
          onChange={handleCodeChange}    // Handle typing
          theme="vs-dark"                // Editor theme
          options={{
            minimap: { enabled: false }, // Hide minimap
            fontSize: 16,                // Font size
          }}
        />
        <textarea className="input-console" value={userInput} onChange={e=>setUserInput(e.target.value)} placeholder="Enter input here..."/>
        <button className="run-btn" onClick={runCode}>
          Execute
        </button>
        <textarea
          className="output-console"
          value={outPut}
          readOnly
          placeholder="Output will appear over here ..."
        />
      </div>
    </div>
  );
};

export default App; // Export component
