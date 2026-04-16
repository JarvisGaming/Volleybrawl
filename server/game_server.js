// Start with node server/game_server.js at root directory
const lobbyController = require("./lobby_controller");

const express = require("express");

// Create the Express app
const app = express();

// Use the 'public' folder to serve static files
app.use(express.static("public"));

// Create the Socket.IO server
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const io = new Server(httpServer);


let gameState = {
	roomID: "room1",

	// A JavaScript object storing the players in a particular match
	// { socketId: Player }
	players: {},

	// Indicate whether a game has started
	gameStarted: false,
};

// Handle the web socket connection
io.on("connection", (socket) => {
	console.log("Player connected:", socket.id);
	socket.join(gameState.roomID);

	// Wait for a player to join the game
	socket.on("join", (name) => lobbyController.playerJoin(socket, io, gameState, name));

	// Wait for a player to get ready in the game
	socket.on("ready", () => lobbyController.playerReady(socket, io, gameState));

	// Set up the choose event
	socket.on("choose", (sign) => lobbyController.chooseSign(socket, io, gameState, sign));

	// In case a player is disconnected from the game
	socket.on("disconnect", () => lobbyController.playerDisconnect(socket, io, gameState));
});

// Use a web server to listen at port 8000
// Note that httpServer is used for a WebSocket server
httpServer.listen(8000, () => {
	console.log("The game server has started...");
});
