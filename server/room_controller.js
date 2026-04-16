const crypto = require("crypto");
let rooms = {};

// Join game and enter game listing page
const enterGameListPage = function(socket, players, playerName) {
	players[socket.id] = { name: playerName, joinedRoomID: null, inGame: false };
	socket.emit("join_success");
	socket.emit("update_rooms", rooms);

	console.dir({rooms, players}, { depth: null });
};

// Make current player leave an already joined room (if any)
function leaveOldRoom(socket, players){
	let oldRoomID = players[socket.id].joinedRoomID;
	let oldRoom = rooms[oldRoomID];
	players[socket.id].joinedRoomID = null;

	if (oldRoom != null){
		delete oldRoom.players[socket.id];

		// Delete room if there are no players in it
		if (Object.keys(oldRoom.players).length == 0) {
			delete rooms[oldRoomID];
		}
	}
}

// Make current player join a new room
function joinNewRoom(socket, players, roomID){
	let newRoom = rooms[roomID];
	newRoom.players[socket.id] = { name: players[socket.id].name, ready: false };
	players[socket.id].joinedRoomID = newRoom.roomID;
}

const createRoom = function(socket, io, players) {
	let roomID = crypto.randomUUID();
	rooms[roomID] = { roomID: roomID, players: {} };

	leaveOldRoom(socket, players);
	joinNewRoom(socket, players, roomID);

	socket.emit("room_page_success", "Successfully created a new room.");
	io.emit("update_rooms", rooms);

	console.dir({rooms, players}, { depth: null });
};

const joinRoom = function(socket, io, players, roomID) {
	if (players[socket.id].joinedRoomID === roomID) {
		socket.emit("room_page_error", "You are already in this room.");
		return;
	}

	if (Object.keys(rooms[roomID].players).length >= 2) {
		socket.emit("room_page_error", "The room is full already.");
		return;
	}
	
	leaveOldRoom(socket, players);
	joinNewRoom(socket, players, roomID);

	socket.emit("room_page_success", "Successfully joined the room.");
	io.emit("update_rooms", rooms);

	console.dir({rooms, players}, { depth: null });
};

const leaveRoom = function(socket, io, players, roomID) {
	if (players[socket.id].joinedRoomID != roomID) {
		socket.emit("room_page_error", "You can't leave a room you haven't joined.");
		return;
	}

	leaveOldRoom(socket, players);

	socket.emit("room_page_success", "Successfully left the room.");
	io.emit("update_rooms", rooms);

	console.dir({rooms, players}, { depth: null });
};

const readyUp = function(socket, io, players, roomID) {
	if (players[socket.id].joinedRoomID != roomID) {
		socket.emit("room_page_error", "You can't ready up in a room you haven't joined.");
		return;
	}

	let newRoom = rooms[roomID];
	newRoom.players[socket.id].ready = !newRoom.players[socket.id].ready;
	io.emit("update_rooms", rooms);
	socket.emit("room_page_success", "You are " + (newRoom.players[socket.id].ready ? "ready" : "not ready") + ".");

	console.dir({rooms, players}, { depth: null });
};

const disconnectInRoom = function(socket, io, players) {
	if (!(socket.id in players)) return;

	if (!players[socket.id].inGame) {
		leaveOldRoom(socket, players);
		delete players[socket.id];
		io.emit("update_rooms", rooms);
	}

	console.dir({rooms, players}, { depth: null });
};

module.exports = { enterGameListPage, createRoom, joinRoom, leaveRoom, readyUp, disconnectInRoom };