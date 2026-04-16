// Run with node server/server.js at root directory

const gameListingController = require("./lobby_controller");

const express = require("express");
const crypto = require("crypto");

// Create the Express app
const app = express();

// Use the 'public' folder to serve static files
app.use(express.static("public"));

// Create the Socket.IO server
const { createServer } = require("http");
const { Server } = require("socket.io");
const { join } = require("path");
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
	// Join game and enter game listing page
	socket.on("join", (playerName) => {
		players[socket.id] = { name: playerName, joinedRoomID: null, inGame: false };
		socket.emit("join_success");
		socket.emit("update_rooms", rooms);

		console.dir({rooms, players}, { depth: null });
	});

	// Make current player leave an already joined room (if any)
	function leaveOldRoom(){
		let oldRoomID = players[socket.id].joinedRoomID;
		let oldRoom = rooms[oldRoomID];
		if (oldRoom != null){
			socket.leave(oldRoom.roomID);
			delete oldRoom.players[socket.id];
		}
	}

	// Make current player join a new room
	function joinNewRoom(roomID){
		let newRoom = rooms[roomID];
		socket.join(newRoom.roomID);
		newRoom.players[socket.id] = { name: players[socket.id].name, ready: false };
		players[socket.id].joinedRoomID = newRoom.roomID;
	}

	socket.on("join_room", (roomID) => {
		if (players[socket.id].joinedRoomID === roomID) {
			socket.emit("room_page_error", "You are already in this room.");
			return;
		}

		if (Object.keys(rooms[roomID].players).length >= 2) {
			socket.emit("room_page_error", "The room is full already.");
			return;
		}
		
		leaveOldRoom();
		joinNewRoom(roomID);

		socket.emit("room_page_success", "Successfully joined the room.");
		io.emit("update_rooms", rooms);

		console.dir({rooms, players}, { depth: null });
	});

	socket.on("leave_room", (roomID) => {
		if (players[socket.id].joinedRoomID != roomID) {
			socket.emit("room_page_error", "You can't leave a room you haven't joined.");
			return;
		}

		leaveOldRoom();

		socket.emit("room_page_success", "Successfully left the room.");
		io.emit("update_rooms", rooms);

		console.dir({rooms, players}, { depth: null });
	});

	socket.on("ready", (roomID) => {
		if (players[socket.id].joinedRoomID != roomID) {
			socket.emit("room_page_error", "You can't ready up in a room you haven't joined.");
			return;
		}

		let newRoom = rooms[roomID];
		newRoom.players[socket.id].ready = !newRoom.players[socket.id].ready;
		io.emit("update_rooms", rooms);
		socket.emit("room_page_success", "You are " + (newRoom.players[socket.id].ready ? "ready" : "not ready") + ".");

		console.dir({rooms, players}, { depth: null });
	});
});

// Use a web server to listen at port 8000
// Note that httpServer is used for a WebSocket server
httpServer.listen(8000, () => {
	console.log("The game server has started...");
});
