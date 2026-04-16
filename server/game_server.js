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

let rooms = {
	"room1": {
		roomID: "room1",
		players: {},
	},
	"room2": {
		roomID: "room2",
		players: {},
	},
	"room3": {
		roomID: "room3",
		players: {},
	},
};

let roomState = {
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
	socket.join(roomState.roomID);

	// Wait for a player to join the game
	socket.on("join", (name) => lobbyController.playerJoin(socket, io, roomState, name));

	socket.on("join_room", (roomID) => {
		socket.leave(roomState.roomID);
		delete roomState.players[socket.id];

		roomState = rooms[roomID];
		socket.join(roomState.roomID);
		roomState.players[socket.id] = { name: "Player", ready: false };

		socket.emit("join_room_success");
		io.emit("update_rooms", rooms);
		console.dir(rooms, { depth: null });
	});

	socket.on("ready", (roomID) => {
		roomState = rooms[roomID];
		roomState.players[socket.id].ready = !roomState.players[socket.id].ready;
		io.emit("update_rooms", rooms);
		console.dir(rooms, { depth: null });
	});

	// Wait for a player to get ready in the game
	// socket.on("ready", () => lobbyController.playerReady(socket, io, roomState));

	// Set up the choose event
	// socket.on("choose", (sign) => lobbyController.chooseSign(socket, io, roomState, sign));

	// In case a player is disconnected from the game
	// socket.on("disconnect", () => lobbyController.playerDisconnect(socket, io, roomState));
});

// Use a web server to listen at port 8000
// Note that httpServer is used for a WebSocket server
httpServer.listen(8000, () => {
	console.log("The game server has started...");
});
