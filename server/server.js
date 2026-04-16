// Run with node server/server.js at root directory

const roomController = require("./room_controller.js");


// Create the Express app
const express = require("express");
const app = express();

// Use the 'public' folder to serve static files
app.use(express.static("public"));

// Create the Socket.IO server
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer);

/**
 * Represents all connected clients.
 * @typedef {import("./room_controller.js").Player} Player
 * @type {Object.<string, Player>}
 */
let players = {};

// Handle the web socket connection
io.on("connection", (socket) => {
	// Room controller
	socket.on("join", (playerName) => roomController.enterGameListPage(socket, players, playerName));
	socket.on("create_room", () => roomController.createRoom(socket, io, players));
	socket.on("join_room", (roomID) => roomController.joinRoom(socket, io, players, roomID));
	socket.on("leave_room", (roomID) => roomController.leaveRoom(socket, io, players, roomID));
	socket.on("ready", (roomID) => roomController.readyUp(socket, io, players, roomID));
	socket.on("disconnect", () => roomController.disconnectInRoom(socket, io, players));
});

// Use a web server to listen at port 8000
// Note that httpServer is used for a WebSocket server
httpServer.listen(8000, () => {
	console.log("The game server has started...");
});
