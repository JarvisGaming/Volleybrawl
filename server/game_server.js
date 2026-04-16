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

let players = {};

// Handle the web socket connection
io.on("connection", (socket) => {
	console.log("Player connected:", socket.id);

	// Wait for a player to join the game
	socket.on("join", (playerName) => {
		players[socket.id] = { name: playerName, joinedRoomID: null, inGame: false };
		socket.emit("join_success");
		console.dir(players, { depth: null });
		socket.emit("update_rooms", rooms);
	});

	socket.on("join_room", (roomID) => {
		let oldRoomID = players[socket.id].joinedRoomID;
		let oldRoom = rooms[oldRoomID];
		let newRoom = rooms[roomID];

		if (Object.keys(newRoom.players).length >= 2) {
			socket.emit("join_room_error", "The room is full already.");
			return;
		}
		
		if (oldRoom != null){
			socket.leave(oldRoom.roomID);
			delete oldRoom.players[socket.id];
		}
		
		socket.join(newRoom.roomID);
		newRoom.players[socket.id] = { name: players[socket.id].name, ready: false };

		players[socket.id].joinedRoomID = newRoom.roomID;

		socket.emit("join_room_success", "Successfully joined the room.");
		io.emit("update_rooms", rooms);
		console.dir(rooms, { depth: null });
	});

	socket.on("ready", (roomID) => {
		if (players[socket.id].joinedRoomID != roomID) {
			socket.emit("ready_error", "You can't ready up in a room you haven't joined.");
			return;
		}

		let newRoom = rooms[roomID];
		newRoom.players[socket.id].ready = !newRoom.players[socket.id].ready;
		io.emit("update_rooms", rooms);
		console.dir(rooms, { depth: null });
	});
});

// Use a web server to listen at port 8000
// Note that httpServer is used for a WebSocket server
httpServer.listen(8000, () => {
	console.log("The game server has started...");
});
