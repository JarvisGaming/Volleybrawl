/**
 * Run with node server/server.js at root directory
 */

const { initialize } = require("./shared.js");

const roomController = require("./controller/room_controller.js").eventHandlers;
const gameController = require("./controller/game_controller.js").eventHandlers;

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

// Initialize the shared io instance, so we don't have to pass it explictly into controller functions
initialize(io);

// Handle the web socket connection
io.on("connection", (socket) => {
	// Room controller
	socket.on("enter_room_listing_page", (playerName) => roomController.enterRoomListingPage(socket, playerName));
	socket.on("create_room", () => roomController.createRoom(socket));
	socket.on("join_room", (roomID) => roomController.joinRoom(socket, roomID));
	socket.on("leave_room", (roomID) => roomController.leaveRoom(socket, roomID));
	socket.on("ready", (roomID) => roomController.readyUp(socket, roomID));

	// Game controller
	socket.on("game_loaded", () => gameController.gameLoaded(socket));
	socket.on("send_inputs", (inputsArray) => gameController.updatePlayerInputs(socket, new Set(inputsArray)));

	// Handle disconnect across controllers (each one will check whether the player is in their player list and do the necessary clean up if so)
	socket.on("disconnect", () => roomController.disconnectInRoom(socket));
});

// Use a web server to listen at port 8000
// Note that httpServer is used for a WebSocket server
httpServer.listen(8000, () => {
	console.log("The game server has started...");
});
